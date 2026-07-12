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
  updateDoc, 
  writeBatch 
} from 'firebase/firestore';
import { Company, AppUser } from '../types';

export const DEFAULT_COMPANY_ID = 'default_udv_company';

export const DEFAULT_COMPANY: Company = {
  id: DEFAULT_COMPANY_ID,
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
};

/**
 * Service to manage companies (tenants) in the database.
 */
export const companyService = {
  /**
   * Retrieves a company from Firestore by ID.
   */
  async getCompany(id: string): Promise<Company | null> {
    try {
      const companyDoc = await getDoc(doc(db, 'settings', `company_${id}`));
      if (companyDoc.exists()) {
        return companyDoc.data() as Company;
      }
      return null;
    } catch (error) {
      console.error(`Error retrieving company ${id}:`, error);
      return null;
    }
  },

  /**
   * Retrieves all companies from Firestore.
   */
  async listCompanies(): Promise<Company[]> {
    try {
      const settingsSnap = await getDocs(collection(db, 'settings'));
      const list: Company[] = [];
      settingsSnap.forEach(doc => {
        if (doc.id.startsWith('company_')) {
          list.push(doc.data() as Company);
        }
      });
      return list;
    } catch (error) {
      console.error('Error listing companies:', error);
      return [];
    }
  },

  /**
   * Saves or updates a company document in Firestore.
   */
  async saveCompany(company: Company): Promise<void> {
    try {
      await setDoc(doc(db, 'settings', `company_${company.id}`), company);
    } catch (error) {
      console.error(`Error saving company ${company.id}:`, error);
      throw error;
    }
  },

  /**
   * Ensures the default company is created in the database.
   */
  async initializeDefaultCompany(): Promise<void> {
    try {
      const existing = await this.getCompany(DEFAULT_COMPANY_ID);
      if (!existing) {
        console.log('Seeding default company...');
        await this.saveCompany(DEFAULT_COMPANY);
      }
    } catch (error) {
      console.error('Error initializing default company:', error);
    }
  },

  /**
   * Associates all existing users in the database with the default company.
   * Checks if users have no companyId, or updates them to ensure compatibility.
   */
  async associateUsersToDefaultCompany(): Promise<void> {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const batch = writeBatch(db);
      let needsCommit = false;

      usersSnap.forEach(userDoc => {
        const userData = userDoc.data() as AppUser;
        if (!userData.companyId) {
          console.log(`Associating user ${userData.username || userDoc.id} with default company...`);
          batch.update(doc(db, 'users', userDoc.id), { companyId: DEFAULT_COMPANY_ID });
          needsCommit = true;
        }
      });

      if (needsCommit) {
        await batch.commit();
        console.log('Successfully associated all current users to default company.');
      }
    } catch (error) {
      console.error('Error associating users to default company:', error);
    }
  }
};
