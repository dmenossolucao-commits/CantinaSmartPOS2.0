/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Tenant } from '../types';

/**
 * Strategy pattern for Firestore Multi-Tenancy.
 * In a multi-company SaaS, there are two primary ways of organizing data:
 * 
 * 1. SHARED_COLLECTION_FIELD_FILTER:
 *    All companies write to the same top-level collection (e.g., 'products'), but every document
 *    contains a 'companyId' field. Access rules and queries filter strictly by 'companyId'.
 *    - Pros: Simpler code, easier to aggregate data across tenants for global analytics.
 *    - Cons: Requires indexes on 'companyId' for almost all queries, rules are more coupled.
 * 
 * 2. HIERARCHICAL_SUBCOLLECTIONS:
 *    Data is isolated in subcollections under each company document (e.g., 'companies/{companyId}/products/{productId}').
 *    - Pros: Native physical/logical isolation, simple security rules (just check if user belongs to companyId),
 *      easier data deletion (delete company and its subcollections).
 *    - Cons: Multi-collection group queries are required for cross-tenant aggregates.
 */
export type MultiTenantStrategy = 'SHARED_COLLECTION_FIELD_FILTER' | 'HIERARCHICAL_SUBCOLLECTIONS';

export interface TenantConfig {
  activeStrategy: MultiTenantStrategy;
  defaultTenantId: string;
}

export const TENANT_CONFIG: TenantConfig = {
  // Currently defaulting to shared collection approach for backward compatibility with existing single-tenant database paths
  activeStrategy: 'SHARED_COLLECTION_FIELD_FILTER',
  defaultTenantId: 'default_udv_company',
};

/**
 * Resolves the current active Tenant ID dynamically.
 * In the future, this can be customized to resolve via:
 * 1. Subdomain (e.g., tenant-a.cantinapos.com)
 * 2. URL search parameters (e.g., ?tenant=tenant-a)
 * 3. Logged-in user's custom claim or profile ('companyId' on AppUser)
 * 4. Local storage / session storage
 */
export function resolveCurrentTenantId(): string {
  // 1. Check URL query parameters (prioritizing ?company=, fallback to companyId or tenantId)
  try {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const companyParam = urlParams.get('company') || urlParams.get('companyId') || urlParams.get('tenantId');
      if (companyParam) {
        // Persist to local storage to keep state under priority 3
        try {
          localStorage.setItem('udv_active_tenant_id', companyParam);
        } catch (err) {}
        return companyParam;
      }
    }
  } catch (e) {
    // Fail silently in environments where window is not defined
  }

  // 2. Check logged-in user's companyId from localStorage
  try {
    const userStored = localStorage.getItem('udv_current_user');
    if (userStored) {
      const parsedUser = JSON.parse(userStored);
      if (parsedUser && parsedUser.companyId) {
        return parsedUser.companyId;
      }
    }
  } catch (e) {}

  // 3. Check local storage for active tenant ID
  try {
    const stored = localStorage.getItem('udv_active_tenant_id');
    if (stored) return stored;
  } catch (e) {}

  // 4. Fallback to default tenant ID
  return TENANT_CONFIG.defaultTenantId;
}

/**
 * Changes the active tenant ID in local state (for testing/future switches)
 */
export function setActiveTenantId(tenantId: string): void {
  try {
    localStorage.setItem('udv_active_tenant_id', tenantId);
  } catch (e) {}
}

/**
 * Prepares data for persistence by ensuring the 'companyId' field is set.
 */
export function withTenant<T extends object>(data: T, tenantId: string = resolveCurrentTenantId()): T & { companyId: string } {
  return {
    ...data,
    companyId: (data as any).companyId || tenantId,
  } as T & { companyId: string };
}

/**
 * Filters a client-side list of items by the current active Tenant ID (useful for local state fallback or hybrid setups).
 */
export function filterListByTenant<T extends { companyId?: string }>(
  list: T[],
  tenantId: string = resolveCurrentTenantId()
): T[] {
  return list.filter(item => !item.companyId || item.companyId === tenantId);
}

/**
 * Utility to resolve dynamic Firestore collection path depending on the active multi-tenancy strategy.
 * For HIERARCHICAL_SUBCOLLECTIONS, it returns: 'companies/{companyId}/collectionName'
 * For SHARED_COLLECTION_FIELD_FILTER, it returns: 'collectionName'
 */
export function resolveCollectionPath(collectionName: string, tenantId: string = resolveCurrentTenantId()): string {
  if (TENANT_CONFIG.activeStrategy === 'HIERARCHICAL_SUBCOLLECTIONS') {
    return `companies/${tenantId}/${collectionName}`;
  }
  return collectionName;
}

/**
 * Mock companies list for simulation or initial multi-tenant options.
 */
export const SEEDED_TENANTS: Tenant[] = [
  {
    id: 'default_udv_company',
    name: 'UDV Cantina Segura (Sede Central)',
    cnpj: '00.000.000/0001-00',
    logoUrl: '',
    subdomain: 'central',
    isActive: true,
    createdAt: new Date().toISOString(),
    settings: {
      pixKey: 'pix@udvcantina.com',
      creditLimitDefault: 150.00,
      themeColor: '#012518'
    }
  },
  {
    id: 'cantina_unidade_sul',
    name: 'Cantina UDV - Unidade Sul',
    cnpj: '11.111.111/0001-11',
    logoUrl: '',
    subdomain: 'sul',
    isActive: true,
    createdAt: new Date().toISOString(),
    settings: {
      pixKey: 'pix-sul@udvcantina.com',
      creditLimitDefault: 200.00,
      themeColor: '#023e26'
    }
  },
  {
    id: 'cantina_unidade_norte',
    name: 'Cantina UDV - Unidade Norte',
    cnpj: '22.222.222/0001-22',
    logoUrl: '',
    subdomain: 'norte',
    isActive: true,
    createdAt: new Date().toISOString(),
    settings: {
      pixKey: 'pix-norte@udvcantina.com',
      creditLimitDefault: 100.00,
      themeColor: '#035c3a'
    }
  }
];
