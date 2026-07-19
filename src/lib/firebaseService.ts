import { db } from './firebase';
import { 
  collection, doc, getDoc, getDocs, setDoc, writeBatch, deleteDoc
} from 'firebase/firestore';
import { 
  Product, Client, Transaction, BackupHistory, SupportTicket, NotificationLog, AppUser,
  AdminSecuritySettings, AdminSecurityLog, ProviderChangeLog, PaymentMessageLog 
} from '../types';
import { INITIAL_CLIENTS, INITIAL_TRANSACTIONS } from '../data';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: any, operationType: OperationType, path: string | null): never {
  console.error('--- FIRESTORE ERROR DETECTED ---');
  console.error('Operation:', operationType);
  console.error('Path:', path);
  if (error) {
    console.error('Error Code:', error.code || 'NO_CODE');
    console.error('Error Message:', error.message || String(error));
    console.error('Error Stack:', error.stack || 'NO_STACK');
  } else {
    console.error('Unknown Error');
  }
  console.error('--------------------------------');

  const errInfo = {
    code: error?.code || 'unknown',
    message: error?.message || String(error),
    stack: error?.stack,
    operationType,
    path
  };
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Checks if collections are empty in Firestore and, if so, populates them with the
 * user's existing local storage data or initial default data to ensure zero-loss migration to the cloud.
 */
export async function checkAndPopulateInitialData(
  localProducts: Product[],
  localClients: Client[],
  localTransactions: Transaction[],
  localBackups: BackupHistory[],
  localTickets: SupportTicket[],
  localNotifications: NotificationLog[],
  localPixKey: string
) {
  try {
    // 0. Users (seed admin if not present)
    let userSnap;
    try {
      userSnap = await getDocs(collection(db, 'users'));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'users');
    }

    const adminExists = userSnap.docs.some(doc => {
      const u = doc.data() as AppUser;
      return u.username === 'admin' || u.role === 'admin';
    });
    if (!adminExists) {
      console.log('Seeding default administrator user...');
      const adminUser: AppUser = {
        id: 'u_admin',
        username: 'admin',
        name: 'Administrador',
        role: 'admin',
        passwordHash: '8848',
        createdAt: new Date().toISOString()
      };
      try {
        await setDoc(doc(db, 'users', adminUser.id), adminUser);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${adminUser.id}`);
      }
    }

    // Seeding admin security settings
    const adminSecurityDocRef = doc(db, 'settings', 'admin_security');
    const adminSecuritySnap = await getDoc(adminSecurityDocRef);
    if (!adminSecuritySnap.exists()) {
      console.log('Seeding default admin security credentials...');
      const defaultSecurity: AdminSecuritySettings = {
        passwordHash: '8b2aae9771701faeaf731c84dbd88bec5d02c240a21741046fafccdfc7877ca8', // SHA-256 of F@b486875
        failedAttempts: 0,
        blockedUntil: null,
        updatedAt: new Date().toISOString()
      };
      await setDoc(adminSecurityDocRef, defaultSecurity);
    }

    // 1. Products
    let prodSnap;
    try {
      prodSnap = await getDocs(collection(db, 'products'));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'products');
    }

    if (prodSnap.empty && localProducts.length > 0) {
      console.log('Populating initial products to Firestore cloud...');
      const batch = writeBatch(db);
      localProducts.forEach(p => {
        batch.set(doc(db, 'products', p.id), p);
      });
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'products (batch)');
      }
    }

    // 2. Clients
    let clientSnap;
    try {
      clientSnap = await getDocs(collection(db, 'clients'));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'clients');
    }

    const existingClientIds = new Set(clientSnap.docs.map(doc => doc.id));
    // Merge source of truth (localClients + INITIAL_CLIENTS) to ensure they are all checked
    const allExpectedClients = [...localClients];
    INITIAL_CLIENTS.forEach(ic => {
      if (!allExpectedClients.some(ac => ac.id === ic.id)) {
        allExpectedClients.push(ic);
      }
    });

    const missingClients = allExpectedClients.filter(c => !existingClientIds.has(c.id));

    if (missingClients.length > 0) {
      console.log(`Populating ${missingClients.length} missing/new clients to Firestore cloud...`);
      const batch = writeBatch(db);
      missingClients.forEach(c => {
        batch.set(doc(db, 'clients', c.id), c);
      });
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'clients (batch)');
      }
    }

    // 3. Transactions
    let txSnap;
    try {
      txSnap = await getDocs(collection(db, 'transactions'));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'transactions');
    }

    const existingTxIds = new Set(txSnap.docs.map(doc => doc.id));
    // Merge source of truth (localTransactions + INITIAL_TRANSACTIONS) to ensure they are all checked
    const allExpectedTransactions = [...localTransactions];
    INITIAL_TRANSACTIONS.forEach(it => {
      if (!allExpectedTransactions.some(at => at.id === it.id)) {
        allExpectedTransactions.push(it);
      }
    });

    const missingTransactions = allExpectedTransactions.filter(t => !existingTxIds.has(t.id));

    if (missingTransactions.length > 0) {
      console.log(`Populating ${missingTransactions.length} missing/new transactions to Firestore cloud...`);
      const chunk = <T>(arr: T[], size: number): T[][] => 
        Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
          arr.slice(i * size, i * size + size)
        );
      
      const chunks = chunk(missingTransactions, 200);
      for (const itemChunk of chunks) {
        const batch = writeBatch(db);
        itemChunk.forEach(t => {
          batch.set(doc(db, 'transactions', t.id), t);
        });
        try {
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'transactions (batch)');
        }
      }
    }

    // 4. Backups
    let backupSnap;
    try {
      backupSnap = await getDocs(collection(db, 'backups'));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'backups');
    }

    if (backupSnap.empty && localBackups.length > 0) {
      const batch = writeBatch(db);
      localBackups.forEach(b => {
        batch.set(doc(db, 'backups', b.id), b);
      });
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'backups (batch)');
      }
    }

    // 5. Support Tickets
    let ticketSnap;
    try {
      ticketSnap = await getDocs(collection(db, 'tickets'));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'tickets');
    }

    if (ticketSnap.empty && localTickets.length > 0) {
      const batch = writeBatch(db);
      localTickets.forEach(t => {
        batch.set(doc(db, 'tickets', t.id), t);
      });
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'tickets (batch)');
      }
    }

    // 6. Notification logs
    let notifSnap;
    try {
      notifSnap = await getDocs(collection(db, 'notifications'));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'notifications');
    }

    if (notifSnap.empty && localNotifications.length > 0) {
      const batch = writeBatch(db);
      localNotifications.forEach(n => {
        batch.set(doc(db, 'notifications', n.id), n);
      });
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'notifications (batch)');
      }
    }

    // 7. Pix key settings
    const pixDoc = doc(db, 'settings', 'pix');
    let settingsSnap;
    try {
      settingsSnap = await getDocs(collection(db, 'settings'));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'settings');
    }

    if (settingsSnap.empty) {
      try {
        await setDoc(pixDoc, { key: localPixKey });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'settings/pix');
      }
    }
  } catch (err) {
    console.error('Error migrating/initializing data to Firestore:', err);
    throw err;
  }
}

// Product helpers
export async function saveProductInCloud(p: Product) {
  try {
    await setDoc(doc(db, 'products', p.id), p);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `products/${p.id}`);
  }
}

export async function deleteProductInCloud(productId: string) {
  try {
    await deleteDoc(doc(db, 'products', productId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `products/${productId}`);
  }
}

// Client helpers
export async function saveClientInCloud(c: Client) {
  try {
    await setDoc(doc(db, 'clients', c.id), c);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `clients/${c.id}`);
  }
}

export async function deleteClientInCloud(clientId: string) {
  try {
    await deleteDoc(doc(db, 'clients', clientId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `clients/${clientId}`);
  }
}

// Transaction helpers
export async function saveTransactionInCloud(t: Transaction) {
  try {
    await setDoc(doc(db, 'transactions', t.id), t);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `transactions/${t.id}`);
  }
}

// Notification helpers
export async function saveNotificationInCloud(n: NotificationLog) {
  try {
    await setDoc(doc(db, 'notifications', n.id), n);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `notifications/${n.id}`);
  }
}

// Backup helpers
export async function saveBackupInCloud(b: BackupHistory) {
  try {
    await setDoc(doc(db, 'backups', b.id), b);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `backups/${b.id}`);
  }
}

// Support ticket helpers
export async function saveTicketInCloud(t: SupportTicket) {
  try {
    await setDoc(doc(db, 'tickets', t.id), t);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `tickets/${t.id}`);
  }
}

// Settings helpers
export async function savePixKeyInCloud(key: string) {
  try {
    await setDoc(doc(db, 'settings', 'pix'), { key });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings/pix');
  }
}

// Complete sales with atomic batch transactions
export async function completeSaleInCloud(
  tx: Transaction, 
  updatedClients: Client[], 
  updatedProducts: Product[],
  updatedTransactions?: Transaction[]
) {
  const batch = writeBatch(db);
  
  // Save transaction
  batch.set(doc(db, 'transactions', tx.id), tx);

  // Update relevant clients
  updatedClients.forEach(c => {
    batch.set(doc(db, 'clients', c.id), c);
  });

  // Update relevant products (stocks)
  updatedProducts.forEach(p => {
    batch.set(doc(db, 'products', p.id), p);
  });

  // Update other transactions if provided
  if (updatedTransactions && updatedTransactions.length > 0) {
    updatedTransactions.forEach(t => {
      batch.set(doc(db, 'transactions', t.id), t);
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'completeSale batch');
  }
}

// Admin Commands
export async function zeroStockInCloud(products: Product[]) {
  const batch = writeBatch(db);
  products.forEach(p => {
    batch.update(doc(db, 'products', p.id), { stock: 0 });
  });
  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'zeroStock batch');
  }
}

export async function zeroClientsInCloud(clients: Client[]) {
  const batch = writeBatch(db);
  clients.forEach(c => {
    batch.update(doc(db, 'clients', c.id), { balance: 0 });
  });
  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'zeroClients batch');
  }
}

// Cancel Sale Transaction
export async function cancelSaleInCloud(tx: Transaction, products: Product[], clients: Client[]) {
  const batch = writeBatch(db);

  // 1. Cancel transaction
  batch.update(doc(db, 'transactions', tx.id), { status: 'cancelado' });

  // 2. Restore product stock
  tx.items.forEach(item => {
    const p = products.find(prod => prod.id === item.productId);
    if (p) {
      batch.update(doc(db, 'products', p.id), { stock: p.stock + item.quantity });
    }
  });

  // 3. Revert client balance if credit line (prazo)
  if (tx.clientId && tx.paymentMethod === 'prazo') {
    const c = clients.find(cl => cl.id === tx.clientId);
    if (c) {
      batch.update(doc(db, 'clients', c.id), { balance: c.balance + tx.total });
    }
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'cancelSale batch');
  }
}

// Delete Sale Transaction permanently
export async function deleteSaleInCloud(tx: Transaction, products: Product[], clients: Client[]) {
  const batch = writeBatch(db);

  // 1. Delete transaction
  batch.delete(doc(db, 'transactions', tx.id));

  // 2. Restore stock and revert balance only if not already cancelled
  if (tx.status !== 'cancelado') {
    tx.items.forEach(item => {
      const p = products.find(prod => prod.id === item.productId);
      if (p) {
        batch.update(doc(db, 'products', p.id), { stock: p.stock + item.quantity });
      }
    });

    if (tx.clientId && tx.paymentMethod === 'prazo') {
      const c = clients.find(cl => cl.id === tx.clientId);
      if (c) {
        batch.update(doc(db, 'clients', c.id), { balance: c.balance + tx.total });
      }
    }
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'deleteSale batch');
  }
}

// Clear transactions
export async function clearAllTransactionsInCloud(transactions: Transaction[]) {
  const batch = writeBatch(db);
  transactions.forEach(t => {
    batch.delete(doc(db, 'transactions', t.id));
  });
  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'clearAllTransactions batch');
  }
}

// Mobile Portal: Balance Add Credit and Transaction
export async function mobileAddCreditInCloud(clientId: string, amount: number, currentBalance: number, tx: Transaction) {
  const batch = writeBatch(db);
  
  batch.update(doc(db, 'clients', clientId), { balance: currentBalance + amount });
  batch.set(doc(db, 'transactions', tx.id), tx);
  
  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'mobileAddCredit batch');
  }
}

// User Helpers
export async function saveUserInCloud(u: AppUser) {
  try {
    await setDoc(doc(db, 'users', u.id), u);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${u.id}`);
  }
}

export async function deleteUserInCloud(userId: string) {
  try {
    await deleteDoc(doc(db, 'users', userId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${userId}`);
  }
}

// Smart Cobrança helpers
export async function saveSmartCobrancaSettingsInCloud(s: any) {
  try {
    await setDoc(doc(db, 'settings', 'smart_cobranca'), s);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings/smart_cobranca');
  }
}

export async function saveSmartCollectionInCloud(sc: any) {
  try {
    const sDocRef = doc(db, 'settings', 'smart_collections');
    const sSnap = await getDoc(sDocRef);
    let list: any[] = [];
    if (sSnap.exists()) {
      list = sSnap.data().list || [];
    }
    const index = list.findIndex((item: any) => item.id === sc.id);
    if (index >= 0) {
      list[index] = sc;
    } else {
      list.push(sc);
    }
    await setDoc(sDocRef, { list });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `settings/smart_collections (save ${sc.id})`);
  }
}

export async function deleteSmartCollectionInCloud(scId: string) {
  try {
    const sDocRef = doc(db, 'settings', 'smart_collections');
    const sSnap = await getDoc(sDocRef);
    if (sSnap.exists()) {
      const list = sSnap.data().list || [];
      const updatedList = list.filter((item: any) => item.id !== scId);
      await setDoc(sDocRef, { list: updatedList });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `settings/smart_collections (delete ${scId})`);
  }
}

// Smart Financeiro PIX Helpers
export async function savePaymentProvidersInCloud(providers: any[]) {
  try {
    await setDoc(doc(db, 'settings', 'payment_providers'), { list: providers });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings/payment_providers');
  }
}

export async function savePixChargesInCloud(charges: any[]) {
  try {
    await setDoc(doc(db, 'settings', 'pix_charges'), { list: charges });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings/pix_charges');
  }
}

export async function savePaymentLogsInCloud(logs: any[]) {
  try {
    await setDoc(doc(db, 'settings', 'payment_logs'), { list: logs });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings/payment_logs');
  }
}

export async function savePaymentWebhooksInCloud(webhooks: any[]) {
  try {
    await setDoc(doc(db, 'settings', 'payment_webhooks'), { list: webhooks });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings/payment_webhooks');
  }
}

export async function saveBankReconciliationInCloud(reconciliations: any[]) {
  try {
    await setDoc(doc(db, 'settings', 'bank_reconciliation'), { list: reconciliations });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings/bank_reconciliation');
  }
}

export async function saveFinancialSettingsInCloud(settings: any) {
  try {
    await setDoc(doc(db, 'settings', 'financial_settings'), settings);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings/financial_settings');
  }
}

export async function saveAdminSecurityInCloud(settings: AdminSecuritySettings) {
  try {
    await setDoc(doc(db, 'settings', 'admin_security'), settings);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings/admin_security');
  }
}

export async function saveAdminSecurityLogsInCloud(logs: AdminSecurityLog[]) {
  try {
    await setDoc(doc(db, 'settings', 'admin_security_logs'), { list: logs });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings/admin_security_logs');
  }
}

export async function saveProviderChangeLogsInCloud(logs: ProviderChangeLog[]) {
  try {
    await setDoc(doc(db, 'settings', 'provider_change_logs'), { list: logs });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings/provider_change_logs');
  }
}

export async function savePaymentMessageLogInCloud(log: PaymentMessageLog) {
  try {
    const sDocRef = doc(db, 'settings', 'payment_message_logs');
    const sSnap = await getDoc(sDocRef);
    let list: any[] = [];
    if (sSnap.exists()) {
      list = sSnap.data().list || [];
    }
    const index = list.findIndex((item: any) => item.id === log.id);
    if (index >= 0) {
      list[index] = log;
    } else {
      list.push(log);
    }
    await setDoc(sDocRef, { list });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `settings/payment_message_logs (save ${log.id})`);
  }
}


