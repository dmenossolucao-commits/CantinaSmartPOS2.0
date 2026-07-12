/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch
} from 'firebase/firestore';
import { resolveCollectionPath } from './tenantService';

export interface MigrationStatus {
  saasMigrationCompleted: boolean;
  executedAt: string;
  migratedCounts: {
    users: number;
    products: number;
    clients: number;
    transactions: number;
    backups: number;
    tickets: number;
    notifications: number;
    settings: number;
  };
  durationMs: number;
  version: string;
}

/**
 * Service to execute legacy data backfill to set companyId = 'default_udv_company'
 * on all legacy documents that do not possess a companyId yet.
 */
export async function runSaaSMigration(): Promise<{ success: boolean; message: string; data?: MigrationStatus }> {
  const startTime = Date.now();
  console.log('[SaaS Migration] Starting manual SaaS Migration (v1.7.1) backfill...');

  try {
    // 1. Check if migration has already been completed in settings
    const statusDocRef = doc(db, 'settings', 'saas_migration_status');
    const statusDocSnap = await getDoc(statusDocRef);

    if (statusDocSnap.exists()) {
      const data = statusDocSnap.data() as MigrationStatus;
      if (data.saasMigrationCompleted === true) {
        const msg = `[SaaS Migration] Aborted: Migration was already completed on ${data.executedAt} (Version: ${data.version}).`;
        console.warn(msg);
        return {
          success: false,
          message: msg,
          data
        };
      }
    }

    const defaultTenantId = 'default_udv_company';
    const collectionsToMigrate = [
      { name: 'users', path: resolveCollectionPath('users') },
      { name: 'products', path: resolveCollectionPath('products') },
      { name: 'clients', path: resolveCollectionPath('clients') },
      { name: 'transactions', path: resolveCollectionPath('transactions') },
      { name: 'backups', path: resolveCollectionPath('backups') },
      { name: 'tickets', path: resolveCollectionPath('tickets') },
      { name: 'notifications', path: resolveCollectionPath('notifications') },
      { name: 'settings', path: resolveCollectionPath('settings') }
    ];

    const stats = {
      users: 0,
      products: 0,
      clients: 0,
      transactions: 0,
      backups: 0,
      tickets: 0,
      notifications: 0,
      settings: 0
    };

    // We process using writeBatch. Firestore allows up to 500 writes per batch.
    let batch = writeBatch(db);
    let batchCount = 0;

    for (const colInfo of collectionsToMigrate) {
      console.log(`[SaaS Migration] Scanning collection: ${colInfo.name} (${colInfo.path})...`);
      const snap = await getDocs(collection(db, colInfo.path));
      
      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        
        // Skip saas_migration_status itself from settings to avoid infinite or redundant updates
        if (colInfo.name === 'settings' && docSnap.id === 'saas_migration_status') {
          continue;
        }

        // Only target documents that do NOT have a companyId or where companyId is falsy/undefined
        if (!data.companyId) {
          console.log(`[SaaS Migration] Collection ${colInfo.name} -> Document ${docSnap.id} is missing companyId. Adding default tenant ID...`);
          
          // Use batch.update to ONLY set/update the companyId without altering any other fields
          batch.update(docSnap.ref, { companyId: defaultTenantId });
          
          // Increment stats and batch counters
          stats[colInfo.name as keyof typeof stats]++;
          batchCount++;

          // Commit batch if we reach the 500 writes limit
          if (batchCount === 500) {
            console.log(`[SaaS Migration] Reached batch limit (500). Committing batch...`);
            await batch.commit();
            batch = writeBatch(db);
            batchCount = 0;
          }
        }
      }
    }

    // Commit any remaining writes
    if (batchCount > 0) {
      console.log(`[SaaS Migration] Committing final batch of ${batchCount} writes...`);
      await batch.commit();
    }

    const durationMs = Date.now() - startTime;
    const migrationResult: MigrationStatus = {
      saasMigrationCompleted: true,
      executedAt: new Date().toISOString(),
      migratedCounts: stats,
      durationMs,
      version: 'v1.7.1'
    };

    // Save migration status in settings collection
    await setDoc(statusDocRef, migrationResult);

    const successMsg = `[SaaS Migration] Successfully completed migration in ${durationMs}ms. Migrated counts: ${JSON.stringify(stats)}`;
    console.log(successMsg);

    return {
      success: true,
      message: successMsg,
      data: migrationResult
    };

  } catch (error) {
    console.error('[SaaS Migration] Critical error during migration:', error);
    return {
      success: false,
      message: `Error during migration: ${(error as Error).message}`
    };
  }
}
