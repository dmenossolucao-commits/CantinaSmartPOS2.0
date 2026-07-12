import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { runSaaSMigration } from './lib/migrationService';

// Safely expose the migration tool on the window/globalThis object for manual admin execution
if (typeof window !== 'undefined') {
  (window as any).runSaaSMigration = runSaaSMigration;
  
  // Expose to parent/top windows to handle cases where the DevTools console has the wrong frame context active
  try {
    if (window.parent && window.parent !== window) {
      (window.parent as any).runSaaSMigration = runSaaSMigration;
    }
  } catch (e) {
    // Cross-origin boundaries handled gracefully
  }
  try {
    if (window.top && window.top !== window) {
      (window.top as any).runSaaSMigration = runSaaSMigration;
    }
  } catch (e) {
    // Cross-origin boundaries handled gracefully
  }
}
if (typeof globalThis !== 'undefined') {
  (globalThis as any).runSaaSMigration = runSaaSMigration;
}
console.log('[CantinaSmart POS] Manual SaaS Migration tool registered. Execute "await window.runSaaSMigration()" in console to run.');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
