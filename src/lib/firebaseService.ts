import { db } from './firebase';
import { 
  collection, doc, getDocs, setDoc, writeBatch, deleteDoc, updateDoc, onSnapshot, query, where
} from 'firebase/firestore';
import { Product, Client, Transaction, BackupHistory, SupportTicket, NotificationLog, AppUser } from '../types';
import { withTenant, resolveCollectionPath, resolveCurrentTenantId } from './tenantService';
import { companyService } from './companyService';

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

    // 0. Fetch existing tables to determine if db is already in use using resolved paths
    const userSnap = await getDocs(collection(db, resolveCollectionPath('users')));
    const prodSnap = await getDocs(collection(db, resolveCollectionPath('products')));
    const clientSnap = await getDocs(collection(db, resolveCollectionPath('clients')));
    const settingsSnap = await getDocs(collection(db, resolveCollectionPath('settings')));

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
      await setDoc(doc(db, resolveCollectionPath('users'), adminUser.id), adminUser);
    }

    if (isAnyDataPresent) {
      console.log('Database already initialized. Skipping seeding.');
      if (!isSystemInitialized) {
        await setDoc(doc(db, resolveCollectionPath('settings'), `system_${tenantId}`), {
          key: 'system_initialized',
          seeded: true,
          seededAt: new Date().toISOString(),
          companyId: tenantId
        });
      }
      return;
    }

    // 1. Products
    if (prodSnap.empty && localProducts.length > 0) {
      console.log('Populating initial products to Firestore cloud...');
      const batch = writeBatch(db);
      localProducts.forEach(p => {
        const tenantProduct = withTenant(p);
        batch.set(doc(db, resolveCollectionPath('products'), tenantProduct.id), tenantProduct);
      });
      await batch.commit();
    }

    // 2. Clients
    if (clientSnap.empty && localClients.length > 0) {
      console.log('Populating clients to Firestore cloud...');
      const batch = writeBatch(db);
      localClients.forEach(c => {
        const tenantClient = withTenant(c);
        batch.set(doc(db, resolveCollectionPath('clients'), tenantClient.id), tenantClient);
      });
      await batch.commit();
    }

    // 3. Transactions
    const txSnap = await getDocs(collection(db, resolveCollectionPath('transactions')));
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
          batch.set(doc(db, resolveCollectionPath('transactions'), tenantTx.id), tenantTx);
        });
        await batch.commit();
      }
    }

    // 4. Backups
    const backupSnap = await getDocs(collection(db, resolveCollectionPath('backups')));
    if (backupSnap.empty && localBackups.length > 0) {
      const batch = writeBatch(db);
      localBackups.forEach(b => {
        const tenantBackup = withTenant(b);
        batch.set(doc(db, resolveCollectionPath('backups'), tenantBackup.id), tenantBackup);
      });
      await batch.commit();
    }

    // 5. Support Tickets
    const ticketSnap = await getDocs(collection(db, resolveCollectionPath('tickets')));
    if (ticketSnap.empty && localTickets.length > 0) {
      const batch = writeBatch(db);
      localTickets.forEach(t => {
        const tenantTicket = withTenant(t);
        batch.set(doc(db, resolveCollectionPath('tickets'), tenantTicket.id), tenantTicket);
      });
      await batch.commit();
    }

    // 6. Notification logs
    const notifSnap = await getDocs(collection(db, resolveCollectionPath('notifications')));
    if (notifSnap.empty && localNotifications.length > 0) {
      const batch = writeBatch(db);
      localNotifications.forEach(n => {
        const tenantNotification = withTenant(n);
        batch.set(doc(db, resolveCollectionPath('notifications'), tenantNotification.id), tenantNotification);
      });
      await batch.commit();
    }

    // 7. Pix key settings
    const pixDoc = doc(db, resolveCollectionPath('settings'), `pix_${tenantId}`);
    const hasPixForTenant = settingsSnap.docs.some(doc => doc.id === `pix_${tenantId}` || doc.id === 'pix');
    if (!hasPixForTenant) {
      await setDoc(pixDoc, { key: localPixKey, companyId: tenantId });
    }

    // 8. Mark as seeded
    await setDoc(doc(db, resolveCollectionPath('settings'), `system_${tenantId}`), {
      key: 'system_initialized',
      seeded: true,
      seededAt: new Date().toISOString(),
      companyId: tenantId
    });
  } catch (err) {
    console.error('Error migrating/initializing data to Firestore:', err);
  }
}

// Product helpers
export async function saveProductInCloud(p: Product) {
  const tenantProduct = withTenant(p);
  await setDoc(doc(db, resolveCollectionPath('products'), tenantProduct.id), tenantProduct);
}

export async function deleteProductInCloud(productId: string) {
  await deleteDoc(doc(db, resolveCollectionPath('products'), productId));
}

// Client helpers
export async function saveClientInCloud(c: Client) {
  const tenantClient = withTenant(c);
  await setDoc(doc(db, resolveCollectionPath('clients'), tenantClient.id), tenantClient);
}

export async function deleteClientInCloud(clientId: string) {
  await deleteDoc(doc(db, resolveCollectionPath('clients'), clientId));
}

// Transaction helpers
export async function saveTransactionInCloud(t: Transaction) {
  const tenantTx = withTenant(t);
  await setDoc(doc(db, resolveCollectionPath('transactions'), tenantTx.id), tenantTx);
}

// Notification helpers
export async function saveNotificationInCloud(n: NotificationLog) {
  const tenantNotification = withTenant(n);
  await setDoc(doc(db, resolveCollectionPath('notifications'), tenantNotification.id), tenantNotification);
}

// Backup helpers
export async function saveBackupInCloud(b: BackupHistory) {
  const tenantBackup = withTenant(b);
  await setDoc(doc(db, resolveCollectionPath('backups'), tenantBackup.id), tenantBackup);
}

// Support ticket helpers
export async function saveTicketInCloud(t: SupportTicket) {
  const tenantTicket = withTenant(t);
  await setDoc(doc(db, resolveCollectionPath('tickets'), tenantTicket.id), tenantTicket);
}

// Settings helpers
export async function savePixKeyInCloud(key: string) {
  const tenantId = resolveCurrentTenantId();
  await setDoc(doc(db, resolveCollectionPath('settings'), `pix_${tenantId}`), { key, companyId: tenantId });
}

// Complete sales with atomic batch transactions
export async function completeSaleInCloud(tx: Transaction, updatedClients: Client[], updatedProducts: Product[]) {
  const batch = writeBatch(db);
  
  // Save transaction
  const tenantTx = withTenant(tx);
  batch.set(doc(db, resolveCollectionPath('transactions'), tenantTx.id), tenantTx);

  // Update relevant clients - ONLY the one associated with the transaction (if any)
  if (tx.clientId) {
    const associatedClient = updatedClients.find(c => c.id === tx.clientId);
    if (associatedClient) {
      const tenantClient = withTenant(associatedClient);
      batch.set(doc(db, resolveCollectionPath('clients'), tenantClient.id), tenantClient);
    }
  }

  // Update relevant products (stocks) - ONLY those whose stocks actually changed (present in tx.items)
  const purchasedProductIds = new Set(tx.items.map(item => item.productId));
  updatedProducts.forEach(p => {
    if (purchasedProductIds.has(p.id)) {
      const tenantProduct = withTenant(p);
      batch.set(doc(db, resolveCollectionPath('products'), tenantProduct.id), tenantProduct);
    }
  });

  await batch.commit();
}

// Admin Commands
export async function zeroStockInCloud(products: Product[]) {
  const batch = writeBatch(db);
  products.forEach(p => {
    batch.update(doc(db, resolveCollectionPath('products'), p.id), { stock: 0 });
  });
  await batch.commit();
}

// Zero Client balances helper
export async function zeroClientsInCloud(clients: Client[]) {
  const batch = writeBatch(db);
  clients.forEach(c => {
    batch.update(doc(db, resolveCollectionPath('clients'), c.id), { balance: 0 });
  });
  await batch.commit();
}

// Cancel Sale Transaction
export async function cancelSaleInCloud(tx: Transaction, products: Product[], clients: Client[]) {
  // 1. Cancel transaction
  await updateDoc(doc(db, resolveCollectionPath('transactions'), tx.id), { status: 'cancelado' });

  // 2. Restore product stock and revert balance
  const promises: Promise<void>[] = [];

  tx.items.forEach(item => {
    const p = products.find(prod => prod.id === item.productId);
    if (p) {
      promises.push(
        updateDoc(doc(db, resolveCollectionPath('products'), p.id), { stock: p.stock + item.quantity })
          .catch(err => console.warn(`Could not restore stock for product ${p.id}:`, err))
      );
    }
  });

  if (tx.clientId && tx.paymentMethod === 'prazo') {
    const c = clients.find(cl => cl.id === tx.clientId);
    if (c) {
      promises.push(
        updateDoc(doc(db, resolveCollectionPath('clients'), c.id), { balance: c.balance + tx.total })
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
  // 1. Delete transaction first
  await deleteDoc(doc(db, resolveCollectionPath('transactions'), tx.id));

  // 2. Restore stock and revert balance only if not already cancelled
  if (tx.status !== 'cancelado') {
    const promises: Promise<void>[] = [];
    
    tx.items.forEach(item => {
      const p = products.find(prod => prod.id === item.productId);
      if (p) {
        promises.push(
          updateDoc(doc(db, resolveCollectionPath('products'), p.id), { stock: p.stock + item.quantity })
            .catch(err => console.warn(`Could not restore stock for product ${p.id}:`, err))
        );
      }
    });

    if (tx.clientId && tx.paymentMethod === 'prazo') {
      const c = clients.find(cl => cl.id === tx.clientId);
      if (c) {
        promises.push(
          updateDoc(doc(db, resolveCollectionPath('clients'), c.id), { balance: c.balance + tx.total })
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
  for (const itemChunk of chunks) {
    const batch = writeBatch(db);
    itemChunk.forEach(t => {
      batch.delete(doc(db, resolveCollectionPath('transactions'), t.id));
    });
    await batch.commit();
  }
}

// Mobile Portal: Balance Add Credit and Transaction
export async function mobileAddCreditInCloud(clientId: string, amount: number, currentBalance: number, tx: Transaction) {
  const batch = writeBatch(db);
  
  batch.update(doc(db, resolveCollectionPath('clients'), clientId), { balance: currentBalance + amount });
  
  const tenantTx = withTenant(tx);
  batch.set(doc(db, resolveCollectionPath('transactions'), tenantTx.id), tenantTx);
  
  await batch.commit();
}

// User Helpers
export async function saveUserInCloud(u: AppUser) {
  const tenantUser = withTenant(u);
  await setDoc(doc(db, resolveCollectionPath('users'), tenantUser.id), tenantUser);
}

export async function deleteUserInCloud(userId: string) {
  await deleteDoc(doc(db, resolveCollectionPath('users'), userId));
}

// Real-time subscription helper functions for central data layer access
export function subscribeUsers(
  onUpdate: (users: AppUser[]) => void,
  onError: (err: any) => void
): () => void {
  const tenantId = resolveCurrentTenantId();
  return onSnapshot(
    query(
      collection(db, resolveCollectionPath('users')),
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
    onError
  );
}

export function subscribeProducts(
  onUpdate: (products: Product[]) => void,
  onError: (err: any) => void
): () => void {
  const tenantId = resolveCurrentTenantId();
  return onSnapshot(
    query(
      collection(db, resolveCollectionPath('products')),
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
    onError
  );
}

export function subscribeClients(
  onUpdate: (clients: Client[]) => void,
  onError: (err: any) => void
): () => void {
  const tenantId = resolveCurrentTenantId();
  return onSnapshot(
    query(
      collection(db, resolveCollectionPath('clients')),
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
    onError
  );
}

export function subscribeTransactions(
  onUpdate: (transactions: Transaction[]) => void,
  onError: (err: any) => void
): () => void {
  const tenantId = resolveCurrentTenantId();
  return onSnapshot(
    query(
      collection(db, resolveCollectionPath('transactions')),
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
    onError
  );
}

export function subscribeBackups(
  onUpdate: (backups: BackupHistory[]) => void,
  onError: (err: any) => void
): () => void {
  const tenantId = resolveCurrentTenantId();
  return onSnapshot(
    query(
      collection(db, resolveCollectionPath('backups')),
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
    onError
  );
}

export function subscribeTickets(
  onUpdate: (tickets: SupportTicket[]) => void,
  onError: (err: any) => void
): () => void {
  const tenantId = resolveCurrentTenantId();
  return onSnapshot(
    query(
      collection(db, resolveCollectionPath('tickets')),
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
    onError
  );
}

export function subscribeNotifications(
  onUpdate: (notifications: NotificationLog[]) => void,
  onError: (err: any) => void
): () => void {
  const tenantId = resolveCurrentTenantId();
  return onSnapshot(
    query(
      collection(db, resolveCollectionPath('notifications')),
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
    onError
  );
}

export function subscribePixKey(
  onUpdate: (pixKey: string) => void,
  onError: (err: any) => void
): () => void {
  const tenantId = resolveCurrentTenantId();
  return onSnapshot(
    doc(db, resolveCollectionPath('settings'), `pix_${tenantId}`),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        onUpdate(data.key);
      } else {
        onUpdate('');
      }
    },
    onError
  );
}

