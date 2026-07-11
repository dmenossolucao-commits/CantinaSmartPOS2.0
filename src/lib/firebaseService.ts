import { db } from './firebase';
import { 
  collection, doc, getDocs, setDoc, writeBatch, deleteDoc, updateDoc
} from 'firebase/firestore';
import { Product, Client, Transaction, BackupHistory, SupportTicket, NotificationLog, AppUser } from '../types';

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
    // 0. Fetch existing tables to determine if db is already in use
    const userSnap = await getDocs(collection(db, 'users'));
    const prodSnap = await getDocs(collection(db, 'products'));
    const clientSnap = await getDocs(collection(db, 'clients'));
    const settingsSnap = await getDocs(collection(db, 'settings'));

    const isSystemInitialized = settingsSnap.docs.some(doc => doc.id === 'system');
    const isAnyDataPresent = !prodSnap.empty || !clientSnap.empty || isSystemInitialized;

    // Seed default administrator user if not present
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
      await setDoc(doc(db, 'users', adminUser.id), adminUser);
    }

    if (isAnyDataPresent) {
      console.log('Database already initialized. Skipping seeding.');
      if (!isSystemInitialized) {
        await setDoc(doc(db, 'settings', 'system'), {
          key: 'system_initialized',
          seeded: true,
          seededAt: new Date().toISOString()
        });
      }
      return;
    }

    // 1. Products
    if (prodSnap.empty && localProducts.length > 0) {
      console.log('Populating initial products to Firestore cloud...');
      const batch = writeBatch(db);
      localProducts.forEach(p => {
        batch.set(doc(db, 'products', p.id), p);
      });
      await batch.commit();
    }

    // 2. Clients
    if (clientSnap.empty && localClients.length > 0) {
      console.log('Populating clients to Firestore cloud...');
      const batch = writeBatch(db);
      localClients.forEach(c => {
        batch.set(doc(db, 'clients', c.id), c);
      });
      await batch.commit();
    }

    // 3. Transactions
    const txSnap = await getDocs(collection(db, 'transactions'));
    if (txSnap.empty && localTransactions.length > 0) {
      console.log('Populating transactions to Firestore cloud...');
      // Batch writes can handle up to 500 documents. If the user has more, let's chunk them
      const chunk = <T>(arr: T[], size: number): T[][] => 
        Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
          arr.slice(i * size, i * size + size)
        );
      
      const chunks = chunk(localTransactions, 200);
      for (const itemChunk of chunks) {
        const batch = writeBatch(db);
        itemChunk.forEach(t => {
          batch.set(doc(db, 'transactions', t.id), t);
        });
        await batch.commit();
      }
    }

    // 4. Backups
    const backupSnap = await getDocs(collection(db, 'backups'));
    if (backupSnap.empty && localBackups.length > 0) {
      const batch = writeBatch(db);
      localBackups.forEach(b => {
        batch.set(doc(db, 'backups', b.id), b);
      });
      await batch.commit();
    }

    // 5. Support Tickets
    const ticketSnap = await getDocs(collection(db, 'tickets'));
    if (ticketSnap.empty && localTickets.length > 0) {
      const batch = writeBatch(db);
      localTickets.forEach(t => {
        batch.set(doc(db, 'tickets', t.id), t);
      });
      await batch.commit();
    }

    // 6. Notification logs
    const notifSnap = await getDocs(collection(db, 'notifications'));
    if (notifSnap.empty && localNotifications.length > 0) {
      const batch = writeBatch(db);
      localNotifications.forEach(n => {
        batch.set(doc(db, 'notifications', n.id), n);
      });
      await batch.commit();
    }

    // 7. Pix key settings
    const pixDoc = doc(db, 'settings', 'pix');
    if (settingsSnap.empty) {
      await setDoc(pixDoc, { key: localPixKey });
    }

    // 8. Mark as seeded
    await setDoc(doc(db, 'settings', 'system'), {
      key: 'system_initialized',
      seeded: true,
      seededAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error migrating/initializing data to Firestore:', err);
  }
}

// Product helpers
export async function saveProductInCloud(p: Product) {
  await setDoc(doc(db, 'products', p.id), p);
}

export async function deleteProductInCloud(productId: string) {
  await deleteDoc(doc(db, 'products', productId));
}

// Client helpers
export async function saveClientInCloud(c: Client) {
  await setDoc(doc(db, 'clients', c.id), c);
}

export async function deleteClientInCloud(clientId: string) {
  await deleteDoc(doc(db, 'clients', clientId));
}

// Transaction helpers
export async function saveTransactionInCloud(t: Transaction) {
  await setDoc(doc(db, 'transactions', t.id), t);
}

// Notification helpers
export async function saveNotificationInCloud(n: NotificationLog) {
  await setDoc(doc(db, 'notifications', n.id), n);
}

// Backup helpers
export async function saveBackupInCloud(b: BackupHistory) {
  await setDoc(doc(db, 'backups', b.id), b);
}

// Support ticket helpers
export async function saveTicketInCloud(t: SupportTicket) {
  await setDoc(doc(db, 'tickets', t.id), t);
}

// Settings helpers
export async function savePixKeyInCloud(key: string) {
  await setDoc(doc(db, 'settings', 'pix'), { key });
}

// Complete sales with atomic batch transactions
export async function completeSaleInCloud(tx: Transaction, updatedClients: Client[], updatedProducts: Product[]) {
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

  await batch.commit();
}

// Admin Commands
export async function zeroStockInCloud(products: Product[]) {
  const batch = writeBatch(db);
  products.forEach(p => {
    batch.update(doc(db, 'products', p.id), { stock: 0 });
  });
  await batch.commit();
}

export async function zeroClientsInCloud(clients: Client[]) {
  const batch = writeBatch(db);
  clients.forEach(c => {
    batch.update(doc(db, 'clients', c.id), { balance: 0 });
  });
  await batch.commit();
}

// Cancel Sale Transaction
export async function cancelSaleInCloud(tx: Transaction, products: Product[], clients: Client[]) {
  // 1. Cancel transaction
  await updateDoc(doc(db, 'transactions', tx.id), { status: 'cancelado' });

  // 2. Restore product stock and revert balance
  const promises: Promise<void>[] = [];

  tx.items.forEach(item => {
    const p = products.find(prod => prod.id === item.productId);
    if (p) {
      promises.push(
        updateDoc(doc(db, 'products', p.id), { stock: p.stock + item.quantity })
          .catch(err => console.warn(`Could not restore stock for product ${p.id}:`, err))
      );
    }
  });

  if (tx.clientId && tx.paymentMethod === 'prazo') {
    const c = clients.find(cl => cl.id === tx.clientId);
    if (c) {
      promises.push(
        updateDoc(doc(db, 'clients', c.id), { balance: c.balance + tx.total })
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
  await deleteDoc(doc(db, 'transactions', tx.id));

  // 2. Restore stock and revert balance only if not already cancelled
  if (tx.status !== 'cancelado') {
    const promises: Promise<void>[] = [];
    
    tx.items.forEach(item => {
      const p = products.find(prod => prod.id === item.productId);
      if (p) {
        promises.push(
          updateDoc(doc(db, 'products', p.id), { stock: p.stock + item.quantity })
            .catch(err => console.warn(`Could not restore stock for product ${p.id}:`, err))
        );
      }
    });

    if (tx.clientId && tx.paymentMethod === 'prazo') {
      const c = clients.find(cl => cl.id === tx.clientId);
      if (c) {
        promises.push(
          updateDoc(doc(db, 'clients', c.id), { balance: c.balance + tx.total })
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
      batch.delete(doc(db, 'transactions', t.id));
    });
    await batch.commit();
  }
}

// Mobile Portal: Balance Add Credit and Transaction
export async function mobileAddCreditInCloud(clientId: string, amount: number, currentBalance: number, tx: Transaction) {
  const batch = writeBatch(db);
  
  batch.update(doc(db, 'clients', clientId), { balance: currentBalance + amount });
  batch.set(doc(db, 'transactions', tx.id), tx);
  
  await batch.commit();
}

// User Helpers
export async function saveUserInCloud(u: AppUser) {
  await setDoc(doc(db, 'users', u.id), u);
}

export async function deleteUserInCloud(userId: string) {
  await deleteDoc(doc(db, 'users', userId));
}

