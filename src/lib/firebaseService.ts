import { db, auth } from './firebase';
import { 
  collection, doc, getDocs, setDoc, writeBatch, deleteDoc, updateDoc, onSnapshot, query, where
} from 'firebase/firestore';
import { Product, Client, Transaction, BackupHistory, SupportTicket, NotificationLog, AppUser } from '../types';
import { withTenant, resolveCollectionPath, resolveCurrentTenantId } from './tenantService';
import { companyService } from './companyService';

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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function safeSetDoc(docRef: any, data: any, collectionPath: string) {
  try {
    await setDoc(docRef, data);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, collectionPath);
  }
}

export async function safeDeleteDoc(docRef: any, collectionPath: string) {
  try {
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, collectionPath);
  }
}

export async function safeUpdateDoc(docRef: any, data: any, collectionPath: string) {
  try {
    await updateDoc(docRef, data);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, collectionPath);
  }
}

export async function safeCommit(batch: any, collectionPath: string) {
  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, collectionPath);
  }
}

export function wrapOnError(onError: (err: any) => void, operationType: OperationType, path: string | null) {
  return (err: any) => {
    try {
      handleFirestoreError(err, operationType, path);
    } catch (wrappedErr) {
      onError(wrappedErr);
    }
  };
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
    // Ensure the default company is created and all existing/current users are associated with it
    await companyService.initializeDefaultCompany();
    await companyService.associateUsersToDefaultCompany();

    const userPath = resolveCollectionPath('users');
    const prodPath = resolveCollectionPath('products');
    const clientPath = resolveCollectionPath('clients');
    const settingsPath = resolveCollectionPath('settings');
    const txPath = resolveCollectionPath('transactions');
    const backupPath = resolveCollectionPath('backups');
    const ticketPath = resolveCollectionPath('tickets');
    const notifPath = resolveCollectionPath('notifications');

    // 0. Fetch existing tables to determine if db is already in use using resolved paths
    let userSnap, prodSnap, clientSnap, settingsSnap;
    try {
      userSnap = await getDocs(collection(db, userPath));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, userPath);
    }
    try {
      prodSnap = await getDocs(collection(db, prodPath));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, prodPath);
    }
    try {
      clientSnap = await getDocs(collection(db, clientPath));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, clientPath);
    }
    try {
      settingsSnap = await getDocs(collection(db, settingsPath));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, settingsPath);
    }

    const tenantId = resolveCurrentTenantId();
    const isSystemInitialized = settingsSnap.docs.some(doc => doc.id === 'system' || doc.id === `system_${tenantId}`);
    const isAnyDataPresent = !prodSnap.empty || !clientSnap.empty || isSystemInitialized;

    // Seed default administrator user if not present
    const adminExists = userSnap.docs.some(doc => {
      const u = doc.data() as AppUser;
      return u.username === 'admin' || u.role === 'admin';
    });
    if (!adminExists) {
      console.log('Seeding default administrator user...');
      const adminUser: AppUser = withTenant({
        id: 'u_admin',
        username: 'admin',
        name: 'Administrador',
        role: 'admin',
        passwordHash: '8848',
        createdAt: new Date().toISOString()
      });
      await safeSetDoc(doc(db, userPath, adminUser.id), adminUser, userPath);
    }

    if (!isSystemInitialized) {
      await safeSetDoc(doc(db, settingsPath, `system_${tenantId}`), {
        key: 'system_initialized',
        seeded: true,
        seededAt: new Date().toISOString(),
        companyId: tenantId
      }, settingsPath);
    }

    // 1. Products
    if (prodSnap.empty && localProducts.length > 0) {
      console.log('Populating initial products to Firestore cloud...');
      const batch = writeBatch(db);
      localProducts.forEach(p => {
        const tenantProduct = withTenant(p);
        batch.set(doc(db, prodPath, tenantProduct.id), tenantProduct);
      });
      await safeCommit(batch, prodPath);
    }

    // 2. Clients
    if (clientSnap.empty && localClients.length > 0) {
      console.log('Populating clients to Firestore cloud...');
      const batch = writeBatch(db);
      localClients.forEach(c => {
        const tenantClient = withTenant(c);
        batch.set(doc(db, clientPath, tenantClient.id), tenantClient);
      });
      await safeCommit(batch, clientPath);
    }

    // 3. Transactions
    let txSnap;
    try {
      txSnap = await getDocs(collection(db, txPath));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, txPath);
    }
    if (txSnap.empty && localTransactions.length > 0) {
      console.log('Populating transactions to Firestore cloud...');
      const chunk = <T>(arr: T[], size: number): T[][] => 
        Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
          arr.slice(i * size, i * size + size)
        );
      
      const chunks = chunk(localTransactions, 200);
      for (const itemChunk of chunks) {
        const batch = writeBatch(db);
        itemChunk.forEach(t => {
          const tenantTx = withTenant(t);
          batch.set(doc(db, txPath, tenantTx.id), tenantTx);
        });
        await safeCommit(batch, txPath);
      }
    }

    // 4. Backups
    let backupSnap;
    try {
      backupSnap = await getDocs(collection(db, backupPath));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, backupPath);
    }
    if (backupSnap.empty && localBackups.length > 0) {
      const batch = writeBatch(db);
      localBackups.forEach(b => {
        const tenantBackup = withTenant(b);
        batch.set(doc(db, backupPath, tenantBackup.id), tenantBackup);
      });
      await safeCommit(batch, backupPath);
    }

    // 5. Support Tickets
    let ticketSnap;
    try {
      ticketSnap = await getDocs(collection(db, ticketPath));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, ticketPath);
    }
    if (ticketSnap.empty && localTickets.length > 0) {
      const batch = writeBatch(db);
      localTickets.forEach(t => {
        const tenantTicket = withTenant(t);
        batch.set(doc(db, ticketPath, tenantTicket.id), tenantTicket);
      });
      await safeCommit(batch, ticketPath);
    }

    // 6. Notification logs
    let notifSnap;
    try {
      notifSnap = await getDocs(collection(db, notifPath));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, notifPath);
    }
    if (notifSnap.empty && localNotifications.length > 0) {
      const batch = writeBatch(db);
      localNotifications.forEach(n => {
        const tenantNotification = withTenant(n);
        batch.set(doc(db, notifPath, tenantNotification.id), tenantNotification);
      });
      await safeCommit(batch, notifPath);
    }

    // 7. Pix key settings
    const pixDoc = doc(db, settingsPath, `pix_${tenantId}`);
    const hasPixForTenant = settingsSnap.docs.some(doc => doc.id === `pix_${tenantId}` || doc.id === 'pix');
    if (!hasPixForTenant) {
      await safeSetDoc(pixDoc, { key: localPixKey, companyId: tenantId }, settingsPath);
    }

    // 8. Mark as seeded
    await safeSetDoc(doc(db, settingsPath, `system_${tenantId}`), {
      key: 'system_initialized',
      seeded: true,
      seededAt: new Date().toISOString(),
      companyId: tenantId
    }, settingsPath);
  } catch (err) {
    console.error('Error migrating/initializing data to Firestore:', err);
  }
}

// Product helpers
export async function saveProductInCloud(p: Product) {
  const tenantProduct = withTenant(p);
  const path = resolveCollectionPath('products');
  await safeSetDoc(doc(db, path, tenantProduct.id), tenantProduct, path);
}

export async function deleteProductInCloud(productId: string) {
  const path = resolveCollectionPath('products');
  await safeDeleteDoc(doc(db, path, productId), path);
}

// Client helpers
export async function saveClientInCloud(c: Client) {
  const tenantClient = withTenant(c);
  const path = resolveCollectionPath('clients');
  await safeSetDoc(doc(db, path, tenantClient.id), tenantClient, path);
}

export async function deleteClientInCloud(clientId: string) {
  const path = resolveCollectionPath('clients');
  await safeDeleteDoc(doc(db, path, clientId), path);
}

// Transaction helpers
export async function saveTransactionInCloud(t: Transaction) {
  const tenantTx = withTenant(t);
  const path = resolveCollectionPath('transactions');
  await safeSetDoc(doc(db, path, tenantTx.id), tenantTx, path);
}

// Notification helpers
export async function saveNotificationInCloud(n: NotificationLog) {
  const notificationWithRead = { read: false, ...n };
  const tenantNotification = withTenant(notificationWithRead);
  const path = resolveCollectionPath('notifications');
  await safeSetDoc(doc(db, path, tenantNotification.id), tenantNotification, path);
}

export async function markNotificationAsReadInCloud(notificationId: string) {
  const path = resolveCollectionPath('notifications');
  await safeUpdateDoc(doc(db, path, notificationId), { read: true }, path);
}

export async function markAllNotificationsAsReadInCloud(notifications: NotificationLog[]) {
  const batch = writeBatch(db);
  const path = resolveCollectionPath('notifications');
  notifications.forEach(n => {
    if (!n.read) {
      batch.update(doc(db, path, n.id), { read: true });
    }
  });
  await safeCommit(batch, path);
}

// Backup helpers
export async function saveBackupInCloud(b: BackupHistory) {
  const tenantBackup = withTenant(b);
  const path = resolveCollectionPath('backups');
  await safeSetDoc(doc(db, path, tenantBackup.id), tenantBackup, path);
}

// Support ticket helpers
export async function saveTicketInCloud(t: SupportTicket) {
  const tenantTicket = withTenant(t);
  const path = resolveCollectionPath('tickets');
  await safeSetDoc(doc(db, path, tenantTicket.id), tenantTicket, path);
}

// Settings helpers
export async function savePixKeyInCloud(key: string) {
  const tenantId = resolveCurrentTenantId();
  const path = resolveCollectionPath('settings');
  await safeSetDoc(doc(db, path, `pix_${tenantId}`), { key, companyId: tenantId }, path);
}

// Complete sales with atomic batch transactions
export async function completeSaleInCloud(tx: Transaction, updatedClients: Client[], updatedProducts: Product[]) {
  const batch = writeBatch(db);
  const txPath = resolveCollectionPath('transactions');
  const clientPath = resolveCollectionPath('clients');
  const prodPath = resolveCollectionPath('products');
  
  // Save transaction
  const tenantTx = withTenant(tx);
  batch.set(doc(db, txPath, tenantTx.id), tenantTx);

  // Update relevant clients - ONLY the one associated with the transaction (if any)
  if (tx.clientId) {
    const associatedClient = updatedClients.find(c => c.id === tx.clientId);
    if (associatedClient) {
      const tenantClient = withTenant(associatedClient);
      batch.set(doc(db, clientPath, tenantClient.id), tenantClient);
    }
  }

  // Update relevant products (stocks) - ONLY those whose stocks actually changed (present in tx.items)
  const purchasedProductIds = new Set(tx.items.map(item => item.productId));
  updatedProducts.forEach(p => {
    if (purchasedProductIds.has(p.id)) {
      const tenantProduct = withTenant(p);
      batch.set(doc(db, prodPath, tenantProduct.id), tenantProduct);
    }
  });

  await safeCommit(batch, txPath);
}

// Admin Commands
export async function zeroStockInCloud(products: Product[]) {
  const batch = writeBatch(db);
  const path = resolveCollectionPath('products');
  products.forEach(p => {
    batch.update(doc(db, path, p.id), { stock: 0 });
  });
  await safeCommit(batch, path);
}

// Zero Client balances helper
export async function zeroClientsInCloud(clients: Client[]) {
  const batch = writeBatch(db);
  const path = resolveCollectionPath('clients');
  clients.forEach(c => {
    batch.update(doc(db, path, c.id), { balance: 0 });
  });
  await safeCommit(batch, path);
}

// Cancel Sale Transaction
export async function cancelSaleInCloud(tx: Transaction, products: Product[], clients: Client[]) {
  const txPath = resolveCollectionPath('transactions');
  const prodPath = resolveCollectionPath('products');
  const clientPath = resolveCollectionPath('clients');

  // 1. Cancel transaction
  await safeUpdateDoc(doc(db, txPath, tx.id), { status: 'cancelado' }, txPath);

  // 2. Restore product stock and revert balance
  const promises: Promise<void>[] = [];

  tx.items.forEach(item => {
    const p = products.find(prod => prod.id === item.productId);
    if (p) {
      promises.push(
        safeUpdateDoc(doc(db, prodPath, p.id), { stock: p.stock + item.quantity }, prodPath)
          .catch(err => console.warn(`Could not restore stock for product ${p.id}:`, err))
      );
    }
  });

  if (tx.clientId && tx.paymentMethod === 'prazo') {
    const c = clients.find(cl => cl.id === tx.clientId);
    if (c) {
      promises.push(
        safeUpdateDoc(doc(db, clientPath, c.id), { balance: c.balance + tx.total }, clientPath)
          .catch(err => console.warn(`Could not revert balance for client ${c.id}:`, err))
      );
    }
  }

  if (promises.length > 0) {
    await Promise.all(promises);
  }
}

// Delete Sale Transaction permanently
export async function deleteSaleInCloud(tx: Transaction, products: Product[], clients: Client[]) {
  const txPath = resolveCollectionPath('transactions');
  const prodPath = resolveCollectionPath('products');
  const clientPath = resolveCollectionPath('clients');

  // 1. Delete transaction first
  await safeDeleteDoc(doc(db, txPath, tx.id), txPath);

  // 2. Restore stock and revert balance only if not already cancelled
  if (tx.status !== 'cancelado') {
    const promises: Promise<void>[] = [];
    
    tx.items.forEach(item => {
      const p = products.find(prod => prod.id === item.productId);
      if (p) {
        promises.push(
          safeUpdateDoc(doc(db, prodPath, p.id), { stock: p.stock + item.quantity }, prodPath)
            .catch(err => console.warn(`Could not restore stock for product ${p.id}:`, err))
        );
      }
    });

    if (tx.clientId && tx.paymentMethod === 'prazo') {
      const c = clients.find(cl => cl.id === tx.clientId);
      if (c) {
        promises.push(
          safeUpdateDoc(doc(db, clientPath, c.id), { balance: c.balance + tx.total }, clientPath)
            .catch(err => console.warn(`Could not revert balance for client ${c.id}:`, err))
        );
      }
    }
    
    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }
}

// Clear transactions with chunking to avoid Firestore 500-operation writeBatch limit
export async function clearAllTransactionsInCloud(transactions: Transaction[]) {
  const chunk = <T>(arr: T[], size: number): T[][] => 
    Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
      arr.slice(i * size, i * size + size)
    );
  
  const chunks = chunk(transactions, 400);
  const path = resolveCollectionPath('transactions');
  for (const itemChunk of chunks) {
    const batch = writeBatch(db);
    itemChunk.forEach(t => {
      batch.delete(doc(db, path, t.id));
    });
    await safeCommit(batch, path);
  }
}

// Mobile Portal: Balance Add Credit and Transaction
export async function mobileAddCreditInCloud(clientId: string, amount: number, currentBalance: number, tx: Transaction) {
  const batch = writeBatch(db);
  const clientPath = resolveCollectionPath('clients');
  const txPath = resolveCollectionPath('transactions');
  
  batch.update(doc(db, clientPath, clientId), { balance: currentBalance + amount });
  
  const tenantTx = withTenant(tx);
  batch.set(doc(db, txPath, tenantTx.id), tenantTx);
  
  await safeCommit(batch, clientPath);
}

// User Helpers
export async function saveUserInCloud(u: AppUser) {
  const tenantUser = withTenant(u);
  const path = resolveCollectionPath('users');
  await safeSetDoc(doc(db, path, tenantUser.id), tenantUser, path);
}

export async function deleteUserInCloud(userId: string) {
  const path = resolveCollectionPath('users');
  await safeDeleteDoc(doc(db, path, userId), path);
}

// Real-time subscription helper functions for central data layer access
export function subscribeUsers(
  onUpdate: (users: AppUser[]) => void,
  onError: (err: any) => void
): () => void {
  const tenantId = resolveCurrentTenantId();
  const path = resolveCollectionPath('users');
  return onSnapshot(
    query(
      collection(db, path),
      where('companyId', '==', tenantId)
    ),
    (snap) => {
      const list: AppUser[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as AppUser;
        list.push({
          ...data,
          companyId: data.companyId || tenantId
        });
      });
      onUpdate(list);
    },
    wrapOnError(onError, OperationType.GET, path)
  );
}

export function subscribeProducts(
  onUpdate: (products: Product[]) => void,
  onError: (err: any) => void
): () => void {
  const tenantId = resolveCurrentTenantId();
  const path = resolveCollectionPath('products');
  return onSnapshot(
    query(
      collection(db, path),
      where('companyId', '==', tenantId)
    ),
    (snap) => {
      const list: Product[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as Product;
        list.push({
          ...data,
          companyId: data.companyId || tenantId
        });
      });
      onUpdate(list);
    },
    wrapOnError(onError, OperationType.GET, path)
  );
}

export function subscribeClients(
  onUpdate: (clients: Client[]) => void,
  onError: (err: any) => void
): () => void {
  const tenantId = resolveCurrentTenantId();
  const path = resolveCollectionPath('clients');
  return onSnapshot(
    query(
      collection(db, path),
      where('companyId', '==', tenantId)
    ),
    (snap) => {
      const list: Client[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as Client;
        list.push({
          ...data,
          companyId: data.companyId || tenantId
        });
      });
      onUpdate(list);
    },
    wrapOnError(onError, OperationType.GET, path)
  );
}

export function subscribeTransactions(
  onUpdate: (transactions: Transaction[]) => void,
  onError: (err: any) => void
): () => void {
  const tenantId = resolveCurrentTenantId();
  const path = resolveCollectionPath('transactions');
  return onSnapshot(
    query(
      collection(db, path),
      where('companyId', '==', tenantId)
    ),
    (snap) => {
      const list: Transaction[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as Transaction;
        list.push({
          ...data,
          companyId: data.companyId || tenantId
        });
      });
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      onUpdate(list);
    },
    wrapOnError(onError, OperationType.GET, path)
  );
}

export function subscribeBackups(
  onUpdate: (backups: BackupHistory[]) => void,
  onError: (err: any) => void
): () => void {
  const tenantId = resolveCurrentTenantId();
  const path = resolveCollectionPath('backups');
  return onSnapshot(
    query(
      collection(db, path),
      where('companyId', '==', tenantId)
    ),
    (snap) => {
      const list: BackupHistory[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as BackupHistory;
        list.push({
          ...data,
          companyId: data.companyId || tenantId
        });
      });
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      onUpdate(list);
    },
    wrapOnError(onError, OperationType.GET, path)
  );
}

export function subscribeTickets(
  onUpdate: (tickets: SupportTicket[]) => void,
  onError: (err: any) => void
): () => void {
  const tenantId = resolveCurrentTenantId();
  const path = resolveCollectionPath('tickets');
  return onSnapshot(
    query(
      collection(db, path),
      where('companyId', '==', tenantId)
    ),
    (snap) => {
      const list: SupportTicket[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as SupportTicket;
        list.push({
          ...data,
          companyId: data.companyId || tenantId
        });
      });
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      onUpdate(list);
    },
    wrapOnError(onError, OperationType.GET, path)
  );
}

export function subscribeNotifications(
  onUpdate: (notifications: NotificationLog[]) => void,
  onError: (err: any) => void
): () => void {
  const tenantId = resolveCurrentTenantId();
  const path = resolveCollectionPath('notifications');
  return onSnapshot(
    query(
      collection(db, path),
      where('companyId', '==', tenantId)
    ),
    (snap) => {
      const list: NotificationLog[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as NotificationLog;
        list.push({
          ...data,
          companyId: data.companyId || tenantId
        });
      });
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      onUpdate(list);
    },
    wrapOnError(onError, OperationType.GET, path)
  );
}

export function subscribePixKey(
  onUpdate: (pixKey: string) => void,
  onError: (err: any) => void
): () => void {
  const tenantId = resolveCurrentTenantId();
  const path = resolveCollectionPath('settings');
  return onSnapshot(
    doc(db, path, `pix_${tenantId}`),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        onUpdate(data.key);
      } else {
        onUpdate('');
      }
    },
    wrapOnError(onError, OperationType.GET, path)
  );
}

export function subscribeStockControl(
  onUpdate: (enabled: boolean) => void,
  onError: (err: any) => void
): () => void {
  const tenantId = resolveCurrentTenantId();
  const path = resolveCollectionPath('settings');
  return onSnapshot(
    doc(db, path, `stock_${tenantId}`),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        onUpdate(data.enabled !== false);
      } else {
        onUpdate(true); // Default to true
      }
    },
    wrapOnError(onError, OperationType.GET, path)
  );
}

export async function saveStockControlInCloud(enabled: boolean) {
  const tenantId = resolveCurrentTenantId();
  const path = resolveCollectionPath('settings');
  await safeSetDoc(doc(db, path, `stock_${tenantId}`), { enabled, companyId: tenantId }, path);
}


