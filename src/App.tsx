/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Product, Client, Transaction, BackupHistory, SupportTicket, NotificationLog, AppUser } from './types';
import { 
  INITIAL_PRODUCTS, INITIAL_CLIENTS, INITIAL_TRANSACTIONS, INITIAL_BACKUPS, INITIAL_SUPPORT 
} from './data';
import PDVTerminal from './components/PDVTerminal';
import ClientManager from './components/ClientManager';
import ProductManager from './components/ProductManager';
import DashboardView from './components/DashboardView';
import MobilePortal from './components/MobilePortal';
import SalesHistory from './components/SalesHistory';
import OutstandingAccounts from './components/OutstandingAccounts';
import LoginView from './components/LoginView';
import UserManager from './components/UserManager';
import { 
  ShoppingCart, Users, Package, TrendingUp, Smartphone, 
  CheckCircle, AlertCircle, CalendarClock, History, LogOut, Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Import Firebase config & Firestore handlers
import { signInAnonymously } from 'firebase/auth';
import { auth } from './lib/firebase';
import { 
  checkAndPopulateInitialData,
  saveProductInCloud,
  deleteProductInCloud,
  saveClientInCloud,
  deleteClientInCloud,
  saveTransactionInCloud,
  saveNotificationInCloud,
  saveBackupInCloud,
  saveTicketInCloud,
  savePixKeyInCloud,
  completeSaleInCloud,
  zeroStockInCloud,
  zeroClientsInCloud,
  cancelSaleInCloud,
  deleteSaleInCloud,
  clearAllTransactionsInCloud,
  mobileAddCreditInCloud,
  saveUserInCloud,
  deleteUserInCloud,
  subscribeUsers,
  subscribeProducts,
  subscribeClients,
  subscribeTransactions,
  subscribeBackups,
  subscribeTickets,
  subscribeNotifications,
  subscribePixKey,
  subscribeStockControl,
  saveStockControlInCloud,
  markNotificationAsReadInCloud,
  markAllNotificationsAsReadInCloud
} from './lib/firebaseService';

type ActiveTab = 'pdv' | 'clientes' | 'prazo' | 'historico' | 'cardapio' | 'admin' | 'mobile' | 'usuarios';

interface PushAlert {
  id: string;
  title: string;
  body: string;
  type: 'info' | 'success' | 'warn';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('pdv');
  const [loading, setLoading] = useState(true);
  
  // User Authentication States
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    const saved = localStorage.getItem('udv_current_user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [users, setUsers] = useState<AppUser[]>([]);
  
  // Cloud Sync States
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [backups, setBackups] = useState<BackupHistory[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [pixKey, setPixKey] = useState<string>('pix@udvcantina.com');
  const [useStockControl, setUseStockControl] = useState<boolean>(true);

  // Active floating push notifications list
  const [pushAlerts, setPushAlerts] = useState<PushAlert[]>([]);

  // Setup Firestore synchronization
  useEffect(() => {
    async function setupCloudSync() {
      try {
        // Attempt anonymous sign-in to satisfy standard Firestore rules demanding authentication
        try {
          await signInAnonymously(auth);
        } catch (authErr) {
          console.warn('Could not authenticate anonymously with Firebase Auth, proceeding anyway:', authErr);
        }

        // Prepare migration data from localStorage if available, fallback to default seed data
        const localProducts = (() => {
          const local = localStorage.getItem('udv_canteen_products');
          if (local) {
            try {
              const parsed = JSON.parse(local) as Product[];
              const missing = INITIAL_PRODUCTS.filter(ip => !parsed.some(p => p.id === ip.id));
              return missing.length > 0 ? [...parsed, ...missing] : parsed;
            } catch (e) {
              return INITIAL_PRODUCTS;
            }
          }
          return INITIAL_PRODUCTS;
        })();

        const localClients = (() => {
          const local = localStorage.getItem('udv_canteen_clients');
          try { return local ? JSON.parse(local) : INITIAL_CLIENTS; } catch (e) { return INITIAL_CLIENTS; }
        })();

        const localTransactions = (() => {
          const local = localStorage.getItem('udv_canteen_transactions');
          try { return local ? JSON.parse(local) : INITIAL_TRANSACTIONS; } catch (e) { return INITIAL_TRANSACTIONS; }
        })();

        const localBackups = (() => {
          const local = localStorage.getItem('udv_canteen_backups');
          try { return local ? JSON.parse(local) : INITIAL_BACKUPS; } catch (e) { return INITIAL_BACKUPS; }
        })();

        const localTickets = (() => {
          const local = localStorage.getItem('udv_canteen_tickets');
          try { return local ? JSON.parse(local) : INITIAL_SUPPORT; } catch (e) { return INITIAL_SUPPORT; }
        })();

        const localNotifications = (() => {
          const local = localStorage.getItem('udv_canteen_notifications');
          try { return local ? JSON.parse(local) : []; } catch (e) { return []; }
        })();

        const localPixKey = localStorage.getItem('udv_pix_key') || 'pix@udvcantina.com';

        // 1. Core check and seed database in the cloud
        await checkAndPopulateInitialData(
          localProducts,
          localClients,
          localTransactions,
          localBackups,
          localTickets,
          localNotifications,
          localPixKey
        );

        // Track listener hydration to turn off loading screen
        let loadedCount = 0;
        const totalCollections = 8;
        const checkLoadingHydration = () => {
          loadedCount++;
          if (loadedCount >= totalCollections) {
            setLoading(false);
          }
        };

        // 2. Realtime subscription to cloud collections
        const unsubUsers = subscribeUsers((list) => {
          setUsers(list);
          if (loadedCount < totalCollections) checkLoadingHydration();
        }, (err) => {
          console.error('Error syncing users:', err);
          if (loadedCount < totalCollections) checkLoadingHydration();
        });

        const unsubProducts = subscribeProducts((list) => {
          setProducts(list);
          if (loadedCount < totalCollections) checkLoadingHydration();
        }, (err) => {
          console.error('Error syncing products:', err);
          if (loadedCount < totalCollections) checkLoadingHydration();
        });

        const unsubClients = subscribeClients((list) => {
          setClients(list);
          if (loadedCount < totalCollections) checkLoadingHydration();
        }, (err) => {
          console.error('Error syncing clients:', err);
          if (loadedCount < totalCollections) checkLoadingHydration();
        });

        const unsubTransactions = subscribeTransactions((list) => {
          setTransactions(list);
          if (loadedCount < totalCollections) checkLoadingHydration();
        }, (err) => {
          console.error('Error syncing transactions:', err);
          if (loadedCount < totalCollections) checkLoadingHydration();
        });

        const unsubBackups = subscribeBackups((list) => {
          setBackups(list);
          if (loadedCount < totalCollections) checkLoadingHydration();
        }, (err) => {
          console.error('Error syncing backups:', err);
          if (loadedCount < totalCollections) checkLoadingHydration();
        });

        const unsubTickets = subscribeTickets((list) => {
          setTickets(list);
          if (loadedCount < totalCollections) checkLoadingHydration();
        }, (err) => {
          console.error('Error syncing tickets:', err);
          if (loadedCount < totalCollections) checkLoadingHydration();
        });

        const unsubNotifications = subscribeNotifications((list) => {
          setNotifications(list);
          if (loadedCount < totalCollections) checkLoadingHydration();
        }, (err) => {
          console.error('Error syncing notifications:', err);
          if (loadedCount < totalCollections) checkLoadingHydration();
        });

        const unsubPix = subscribePixKey((key) => {
          setPixKey(key);
          if (loadedCount < totalCollections) checkLoadingHydration();
        }, (err) => {
          console.error('Error syncing settings:', err);
          if (loadedCount < totalCollections) checkLoadingHydration();
        });

        const unsubStock = subscribeStockControl((enabled) => {
          setUseStockControl(enabled);
        }, (err) => {
          console.error('Error syncing stock control settings:', err);
        });

        return () => {
          unsubUsers();
          unsubProducts();
          unsubClients();
          unsubTransactions();
          unsubBackups();
          unsubTickets();
          unsubNotifications();
          unsubPix();
          unsubStock();
        };
      } catch (err) {
        console.error('Cloud Sync initialization error:', err);
        setLoading(false);
      }
    }

    setupCloudSync();
  }, [currentUser?.companyId]);

  // Push Alert Generator
  const triggerPushNotification = (title: string, body: string, type: 'info' | 'success' | 'warn' = 'success') => {
    const id = 'alert_' + Math.random().toString(36).substring(2, 9);
    const newAlert: PushAlert = { id, title, body, type };
    
    setPushAlerts(prev => [...prev, newAlert]);

    // Also append to permanent notifications history in Cloud Firestore
    const log: NotificationLog = {
      id: 'log_' + Math.random().toString(36).substring(2, 9),
      clientId: 'broadcast',
      clientName: 'Geral',
      type: 'saldo_atualizado',
      channel: 'push',
      message: `${title}: ${body}`,
      timestamp: new Date().toISOString(),
      status: 'enviado'
    };
    saveNotificationInCloud(log).catch(console.error);

    // HTML5 native browser alert (optional popup extra if granted)
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, { body });
      } catch (e) {
        // block inside nested iframes
      }
    }

    // Dismiss floating card in 4.5 seconds
    setTimeout(() => {
      setPushAlerts(prev => prev.filter(a => a.id !== id));
    }, 4500);
  };

  // Ask for Web Notification permission on initial mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Complete PDV transaction callback
  const handleCompleteSale = async (tx: Transaction, updatedClients: Client[], updatedProducts: Product[]) => {
    // Optimistic UI updates to synchronize instantly:
    setProducts(updatedProducts);
    setClients(updatedClients);
    setTransactions(prev => {
      const nextList = [tx, ...prev];
      localStorage.setItem('udv_canteen_transactions', JSON.stringify(nextList));
      return nextList;
    });
    localStorage.setItem('udv_canteen_products', JSON.stringify(updatedProducts));
    localStorage.setItem('udv_canteen_clients', JSON.stringify(updatedClients));
    
    try {
      await completeSaleInCloud(tx, updatedClients, updatedProducts);
    } catch (err) {
      console.error(err);
      triggerPushNotification('Venda Salva', 'Salvo no navegador (Erro de sincronização na nuvem).', 'warn');
    }
  };

  const handleAddTransaction = async (tx: Transaction) => {
    setTransactions(prev => {
      const nextList = [tx, ...prev];
      localStorage.setItem('udv_canteen_transactions', JSON.stringify(nextList));
      return nextList;
    });
    try {
      await saveTransactionInCloud(tx);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleStockControl = async () => {
    const nextVal = !useStockControl;
    setUseStockControl(nextVal);
    try {
      await saveStockControlInCloud(nextVal);
      triggerPushNotification('Estoque', `Controle de estoque foi ${nextVal ? 'ativado' : 'desativado'}.`, 'success');
    } catch (err) {
      console.error(err);
      triggerPushNotification('Aviso de Sincronização', 'Configuração de estoque salva no navegador.', 'warn');
    }
  };

  const handleZeroStock = async () => {
    const previousProducts = [...products];
    setProducts(prev => prev.map(p => ({ ...p, stock: 0 })));
    try {
      await zeroStockInCloud(products);
      triggerPushNotification('Estoque Zerado', 'O estoque de todos os produtos foi zerado via comando administrativo.', 'warn');
    } catch (err) {
      console.error(err);
      setProducts(previousProducts);
    }
  };

  const handleZeroClients = async () => {
    const previousClients = [...clients];
    setClients(prev => prev.map(c => ({ ...c, balance: 0 })));
    try {
      await zeroClientsInCloud(clients);
      triggerPushNotification('Clientes Zerados', 'O saldo de todos os clientes foi zerado para R$ 0,00 via comando administrativo.', 'warn');
    } catch (err) {
      console.error(err);
      setClients(previousClients);
    }
  };

  // Add / Edit / Delete Client
  const handleAddClient = async (c: Client) => {
    setClients(prev => {
      const nextList = [...prev, c];
      localStorage.setItem('udv_canteen_clients', JSON.stringify(nextList));
      return nextList;
    });
    try {
      await saveClientInCloud(c);
      triggerPushNotification('Novo Cliente Cadastrado', `${c.name} foi adicionado ao banco com limite de R$ ${c.creditLimit.toFixed(2)}.`);
    } catch (err) {
      console.error(err);
      triggerPushNotification('Salvo Localmente', `${c.name} salvo no navegador (Sincronização pendente).`, 'warn');
    }
  };

  const handleUpdateClient = async (c: Client) => {
    setClients(prev => {
      const nextList = prev.map(cl => cl.id === c.id ? c : cl);
      localStorage.setItem('udv_canteen_clients', JSON.stringify(nextList));
      return nextList;
    });
    try {
      await saveClientInCloud(c);
    } catch (err) {
      console.error(err);
      triggerPushNotification('Salvo Localmente', `Alterações de ${c.name} salvas no navegador (Sincronização pendente).`, 'warn');
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    setClients(prev => {
      const nextList = prev.filter(cl => cl.id !== clientId);
      localStorage.setItem('udv_canteen_clients', JSON.stringify(nextList));
      return nextList;
    });
    try {
      await deleteClientInCloud(clientId);
      triggerPushNotification('Cadastro Excluído', 'O cliente foi removido com sucesso.', 'warn');
    } catch (err) {
      console.error(err);
      triggerPushNotification('Excluído Localmente', 'O cliente foi removido no navegador (Sincronização pendente).', 'warn');
    }
  };

  // Add / Edit / Delete Product
  const handleAddProduct = async (p: Product) => {
    // Prevent negative minStock
    p.minStock = Math.max(0, p.minStock || 0);
    setProducts(prev => {
      const nextList = [...prev, p];
      localStorage.setItem('udv_canteen_products', JSON.stringify(nextList));
      return nextList;
    });
    try {
      await saveProductInCloud(p);
      triggerPushNotification('Cardápio Atualizado', `Novo produto "${p.name}" foi disponibilizado no PDV.`, 'success');
    } catch (err) {
      console.error('Error saving new product to cloud:', err);
      triggerPushNotification('Salvo Localmente', `Produto "${p.name}" salvo no navegador (Sincronização pendente).`, 'warn');
    }
  };

  const handleUpdateProduct = async (p: Product) => {
    // Prevent negative minStock
    p.minStock = Math.max(0, p.minStock || 0);
    setProducts(prev => {
      const nextList = prev.map(prod => prod.id === p.id ? p : prod);
      localStorage.setItem('udv_canteen_products', JSON.stringify(nextList));
      return nextList;
    });
    try {
      await saveProductInCloud(p);
      triggerPushNotification('Cardápio Atualizado', `O produto "${p.name}" foi salvo com sucesso.`, 'success');
    } catch (err) {
      console.error('Error updating product in cloud:', err);
      triggerPushNotification('Salvo Localmente', `Produto "${p.name}" salvo no navegador (Sincronização pendente).`, 'warn');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    const productToDelete = products.find(prod => prod.id === productId);
    const productName = productToDelete ? productToDelete.name : 'Produto';
    setProducts(prev => {
      const nextList = prev.filter(prod => prod.id !== productId);
      localStorage.setItem('udv_canteen_products', JSON.stringify(nextList));
      return nextList;
    });
    try {
      await deleteProductInCloud(productId);
      triggerPushNotification('Cardápio Atualizado', `O produto "${productName}" foi excluído.`, 'success');
    } catch (err) {
      console.error('Error deleting product in cloud:', err);
      triggerPushNotification('Excluído Localmente', `O produto "${productName}" foi excluído no navegador (Sincronização pendente).`, 'warn');
    }
  };

  // Mobile Portal Balance Update payment simulation callback
  const handleMobileAddCredit = async (clientId: string, amount: number) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const tx: Transaction = {
      id: 'tx_rec_' + Math.random().toString(36).substring(2, 9),
      clientId: clientId,
      clientName: client.name,
      items: [
        { productId: 'recharge', productName: 'Recarga de Saldo Pix (Mobile)', price: amount, quantity: 1 }
      ],
      total: amount,
      paymentMethod: 'pix',
      timestamp: new Date().toISOString(),
      status: 'concluido'
    };

    try {
      await mobileAddCreditInCloud(clientId, amount, client.balance, tx);
    } catch (err) {
      console.error(err);
    }
  };

  // Add ticket
  const handleAddTicket = async (t: SupportTicket) => {
    try {
      await saveTicketInCloud(t);
    } catch (err) {
      console.error(err);
    }
  };

  // Trigger manual cloud backup callback
  const handleTriggerBackup = async () => {
    const filename = `backup_manual_${new Date().toISOString().split('T')[0]}_${Math.random().toString(36).substring(2, 5)}.json`;
    const newB: BackupHistory = {
      id: 'b_' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      filename,
      status: 'sucesso',
      size: `${(JSON.stringify({ products, clients, transactions }).length / 1024).toFixed(1)} KB`
    };
    
    try {
      await saveBackupInCloud(newB);

      // Download physical file copy for offline backup as requested "sistema de backup automático na nuvem"
      try {
        const dbContent = JSON.stringify({ products, clients, transactions, backups, tickets, notifications }, null, 2);
        const blob = new Blob([dbContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.warn('Silent download skipped inside restricted iframe sandbox');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearTransactions = async () => {
    const previousTransactions = [...transactions];
    try {
      // Optimistically clear the local transactions state to trigger a full UI re-render instantly
      setTransactions([]);
      await clearAllTransactionsInCloud(transactions);
      triggerPushNotification('Dados Resetados', 'O histórico de vendas do PDV foi limpo com sucesso.', 'warn');
    } catch (err) {
      console.error(err);
      setTransactions(previousTransactions);
      triggerPushNotification('Erro ao Limpar', 'Não foi possível limpar o histórico na nuvem.', 'warn');
    }
  };

  const handleCancelSale = async (txId: string) => {
    const tx = transactions.find(t => t.id === txId);
    if (!tx) return;
    if (tx.status === 'cancelado') {
      triggerPushNotification('Já Cancelado', 'Esta venda já foi cancelada anteriormente.', 'warn');
      return;
    }

    const previousTransactions = [...transactions];
    try {
      // Optimistically update the transaction status locally to cancelado to trigger immediate re-render
      setTransactions(prev => prev.map(t => t.id === txId ? { ...t, status: 'cancelado' } : t));
      await cancelSaleInCloud(tx, products, clients);
      triggerPushNotification('Venda Cancelada', `Venda ${txId} de R$ ${tx.total.toFixed(2)} foi cancelada com sucesso. Estoque restabelecido!`, 'warn');
    } catch (err) {
      console.error(err);
      setTransactions(previousTransactions);
      triggerPushNotification('Erro ao Cancelar', 'Não foi possível cancelar a venda no banco de dados.', 'warn');
    }
  };

  const handleDeleteSale = async (txId: string) => {
    const tx = transactions.find(t => t.id === txId);
    if (!tx) return;

    const previousTransactions = [...transactions];
    try {
      // Optimistically filter out the deleted transaction from local state to trigger immediate re-render
      setTransactions(prev => prev.filter(t => t.id !== txId));
      await deleteSaleInCloud(tx, products, clients);
      triggerPushNotification('Venda Excluída', `A venda ${txId} de R$ ${tx.total.toFixed(2)} foi excluída definitivamente do histórico.`, 'warn');
    } catch (err) {
      console.error(err);
      setTransactions(previousTransactions);
      triggerPushNotification('Erro ao Excluir', 'Não foi possível excluir a venda no banco de dados.', 'warn');
    }
  };

  const handleAddUser = async (u: AppUser) => {
    await saveUserInCloud(u);
  };

  const handleDeleteUser = async (userId: string) => {
    await deleteUserInCloud(userId);
  };

  const handleLogin = (u: AppUser) => {
    const userCompanyId = u.companyId || 'default_udv_company';
    const userWithCompany = { ...u, companyId: userCompanyId };
    
    // Set active tenant in local storage for both general and user specific checks
    localStorage.setItem('udv_active_tenant_id', userCompanyId);
    localStorage.setItem('udv_current_user', JSON.stringify(userWithCompany));
    setCurrentUser(userWithCompany);
    
    triggerPushNotification('Acesso Permitido', `Seja bem-vindo, ${u.name}!`, 'success');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('udv_current_user');
    localStorage.removeItem('udv_active_tenant_id');
    triggerPushNotification('Sessão Encerrada', 'Você saiu do sistema com segurança.', 'info');
  };

  const handleMarkNotificationAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    try {
      await markNotificationAsReadInCloud(id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllNotificationsAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try {
      await markAllNotificationsAsReadInCloud(notifications);
    } catch (err) {
      console.error(err);
    }
  };


  const debtorCount = clients.filter(c => c.balance < 0).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f8f6] flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="relative flex flex-col items-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-400 via-amber-500 to-emerald-600 flex items-center justify-center text-white font-display font-black text-xl tracking-tight shadow-xl animate-bounce">
            UDV
          </div>
          <div className="w-12 h-12 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
          <div className="space-y-1 animate-pulse">
            <h3 className="font-sans font-bold text-gray-800 text-sm">Conectando à Nuvem...</h3>
            <p className="font-sans text-[11px] text-gray-500">Sincronizando banco de dados em tempo real</p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView users={users} onLogin={handleLogin} />;
  }

  return (
    <div id="udv-canteen-app" className="min-h-screen bg-[#f5f8f6] bg-grid-pattern flex flex-col font-sans text-gray-900 leading-normal antialiased">
      
      {/* Upper Navigation Header Bar */}
      <header className="sticky top-0 bg-gradient-to-r from-[#012518] via-[#023e26] to-[#012518] text-white z-40 px-4 py-3 shadow-xl border-b border-[#045233]/40">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-center gap-4">
          
          {/* App Title & Logo */}
          <div className="flex items-center justify-between w-full lg:w-auto gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-950/40 font-display font-black text-xs tracking-tight animate-heart-pulse">
                UDV
              </div>
              <div>
                <h1 className="font-display font-bold text-sm md:text-base tracking-tight text-white flex items-center gap-2">
                  UDV Cantina Segura
                  <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full font-mono uppercase font-bold tracking-wider">PRO</span>
                </h1>
                <p className="text-[10px] text-emerald-300 font-mono">PDV de Balcão & Gestão de Crédito</p>
              </div>
            </div>

            {/* Current user & Logout button */}
            <div className="flex items-center gap-2 bg-[#00170f]/80 py-1 px-2.5 rounded-xl border border-emerald-800/30">
              <div className="text-right">
                <span className="text-[10px] text-emerald-300 font-bold block leading-tight">
                  {currentUser?.name || 'Operador'}
                </span>
                <span className="text-[8px] text-emerald-500 font-mono block uppercase tracking-wider">
                  {currentUser?.role === 'admin' ? 'Administrador' : 'Operador'}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="p-1 text-emerald-100/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                title="Sair do Sistema"
              >
                <LogOut size={13} />
              </button>
            </div>

            {/* Live System Indicators (Responsive) */}
            <div className="hidden md:flex items-center gap-3 text-[10px] font-mono text-emerald-300 bg-[#00170f]/80 py-1.5 px-3.5 rounded-full border border-emerald-800/30">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                Backup Nuvem: Ativo
              </span>
              <span className="text-emerald-800">|</span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                Biometria: OK
              </span>
            </div>
          </div>

          {/* Tab Navigation buttons */}
          <nav className="flex items-center gap-1 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0 scrollbar-none border-t border-white/5 pt-2.5 lg:pt-0 lg:border-t-0">
            <button
              id="nav-tab-pdv"
              onClick={() => setActiveTab('pdv')}
              className={`py-2 px-3.5 rounded-xl font-sans text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                activeTab === 'pdv' 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 scale-102 border-b-2 border-emerald-300/30' 
                  : 'text-emerald-100/70 hover:text-white hover:bg-white/5'
              }`}
            >
              <ShoppingCart size={14} className={activeTab === 'pdv' ? 'text-amber-300' : ''} /> PDV Caixa
            </button>
            <button
              id="nav-tab-clientes"
              onClick={() => setActiveTab('clientes')}
              className={`py-2 px-3.5 rounded-xl font-sans text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                activeTab === 'clientes' 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 scale-102 border-b-2 border-emerald-300/30' 
                  : 'text-emerald-100/70 hover:text-white hover:bg-white/5'
              }`}
            >
              <Users size={14} className={activeTab === 'clientes' ? 'text-amber-300' : ''} /> Contas Clientes
            </button>
            <button
              id="nav-tab-prazo"
              onClick={() => setActiveTab('prazo')}
              className={`py-2 px-3.5 rounded-xl font-sans text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                activeTab === 'prazo' 
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/20 scale-102 border-b-2 border-amber-300/30' 
                  : 'text-emerald-100/70 hover:text-white hover:bg-white/5'
              }`}
            >
              <CalendarClock size={14} className={activeTab === 'prazo' ? 'text-amber-300' : ''} /> Contas a Prazo
              {debtorCount > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse ml-1 shadow-md">
                  {debtorCount}
                </span>
              )}
            </button>
            <button
              id="nav-tab-historico"
              onClick={() => setActiveTab('historico')}
              className={`py-2 px-3.5 rounded-xl font-sans text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                activeTab === 'historico' 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 scale-102 border-b-2 border-emerald-300/30' 
                  : 'text-emerald-100/70 hover:text-white hover:bg-white/5'
              }`}
            >
              <History size={14} className={activeTab === 'historico' ? 'text-amber-300' : ''} /> Histórico de Vendas
            </button>
            <button
              id="nav-tab-cardapio"
              onClick={() => setActiveTab('cardapio')}
              className={`py-2 px-3.5 rounded-xl font-sans text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                activeTab === 'cardapio' 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 scale-102 border-b-2 border-emerald-300/30' 
                  : 'text-emerald-100/70 hover:text-white hover:bg-white/5'
              }`}
            >
              <Package size={14} className={activeTab === 'cardapio' ? 'text-amber-300' : ''} /> Cardápio / Estoque
            </button>
            {currentUser?.role === 'admin' && (
              <button
                id="nav-tab-admin"
                onClick={() => setActiveTab('admin')}
                className={`py-2 px-3.5 rounded-xl font-sans text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                  activeTab === 'admin' 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 scale-102 border-b-2 border-emerald-300/30' 
                    : 'text-emerald-100/70 hover:text-white hover:bg-white/5'
                }`}
              >
                <TrendingUp size={14} className={activeTab === 'admin' ? 'text-amber-300' : ''} /> Gestão Admin
              </button>
            )}
            {currentUser?.role === 'admin' && (
              <button
                id="nav-tab-usuarios"
                onClick={() => setActiveTab('usuarios')}
                className={`py-2 px-3.5 rounded-xl font-sans text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                  activeTab === 'usuarios' 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 scale-102 border-b-2 border-emerald-300/30' 
                    : 'text-emerald-100/70 hover:text-white hover:bg-white/5'
                }`}
              >
                <Users size={14} className={activeTab === 'usuarios' ? 'text-amber-300' : ''} /> Usuários
              </button>
            )}
            <button
              id="nav-tab-mobile"
              onClick={() => setActiveTab('mobile')}
              className={`py-2 px-3.5 rounded-xl font-sans text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                activeTab === 'mobile' 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 scale-102 border-b-2 border-emerald-300/30' 
                  : 'text-emerald-100/70 hover:text-white hover:bg-white/5'
              }`}
            >
              <Smartphone size={14} className={activeTab === 'mobile' ? 'text-amber-300' : ''} /> Portal Mobile
            </button>
          </nav>
        </div>
      </header>

      {/* Main Viewport Container with slide-up screen animation */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="h-full"
          >
            {activeTab === 'pdv' && (
              <PDVTerminal
                products={products}
                clients={clients}
                onCompleteSale={handleCompleteSale}
                onAddClient={handleAddClient}
                triggerPushNotification={triggerPushNotification}
                pixKey={pixKey}
                useStockControl={useStockControl}
              />
            )}

            {activeTab === 'prazo' && (
              <OutstandingAccounts
                clients={clients}
                transactions={transactions}
                products={products}
                onCompleteSale={handleCompleteSale}
                triggerPushNotification={triggerPushNotification}
                pixKey={pixKey}
                onUpdatePixKey={savePixKeyInCloud}
              />
            )}

            {activeTab === 'clientes' && (
              <ClientManager
                clients={clients}
                transactions={transactions}
                onAddClient={handleAddClient}
                onUpdateClient={handleUpdateClient}
                onDeleteClient={handleDeleteClient}
                onLogNotification={(log) => saveNotificationInCloud(log).catch(console.error)}
                onCancelSale={handleCancelSale}
                onDeleteSale={handleDeleteSale}
                onAddTransaction={handleAddTransaction}
                onZeroClients={handleZeroClients}
              />
            )}

            {activeTab === 'historico' && (
              <SalesHistory
                transactions={transactions}
                onCancelSale={handleCancelSale}
                onDeleteSale={handleDeleteSale}
                products={products}
              />
            )}

            {activeTab === 'cardapio' && (
              <ProductManager
                products={products}
                onAddProduct={handleAddProduct}
                onUpdateProduct={handleUpdateProduct}
                onDeleteProduct={handleDeleteProduct}
                onZeroStock={handleZeroStock}
                useStockControl={useStockControl}
                onToggleStockControl={handleToggleStockControl}
              />
            )}

            {activeTab === 'admin' && (
              <DashboardView
                products={products}
                clients={clients}
                transactions={transactions}
                backups={backups}
                notifications={notifications}
                onTriggerBackup={handleTriggerBackup}
                onClearTransactions={handleClearTransactions}
                onCancelSale={handleCancelSale}
                onDeleteSale={handleDeleteSale}
                pixKey={pixKey}
                onUpdatePixKey={savePixKeyInCloud}
                onMarkNotificationAsRead={handleMarkNotificationAsRead}
                onMarkAllNotificationsAsRead={handleMarkAllNotificationsAsRead}
              />
            )}

            {activeTab === 'mobile' && (
              <MobilePortal
                clients={clients}
                transactions={transactions}
                onAddCredit={handleMobileAddCredit}
                triggerPushNotification={triggerPushNotification}
                pixKey={pixKey}
              />
            )}

            {activeTab === 'usuarios' && currentUser?.role === 'admin' && (
              <UserManager
                users={users}
                currentUser={currentUser}
                onAddUser={handleAddUser}
                onDeleteUser={handleDeleteUser}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* FLOATING SLIDING CUSTOM PUSH NOTIFICATION ALERTS OVERLAY */}
      <div className="fixed bottom-6 right-6 z-50 pointer-events-none space-y-2 max-w-sm w-full px-4 sm:px-0">
        <AnimatePresence>
          {pushAlerts.map(alert => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 260, damping: 25 }}
              className="pointer-events-auto bg-gray-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl p-4.5 border border-emerald-500/20 border-glow flex items-start gap-3.5"
            >
              <div className={`p-2 rounded-xl text-white shrink-0 mt-0.5 ${
                alert.type === 'warn' ? 'bg-red-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'
              }`}>
                {alert.type === 'warn' ? <AlertCircle size={15} /> : <CheckCircle size={15} />}
              </div>
              <div className="flex-1 min-w-0">
                <h5 className="font-sans font-bold text-xs text-white flex items-center justify-between">
                  {alert.title}
                  <span className="text-[8px] font-mono text-gray-500">agora</span>
                </h5>
                <p className="text-[11px] text-gray-300 font-sans mt-1 leading-relaxed">
                  {alert.body}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Subtle footer */}
      <footer className="py-4 px-4 bg-[#eef3f0]/60 border-t border-gray-200/80 text-center text-[10px] text-gray-400 font-mono">
        PDV UDV Cantina Segura • Sistema Integrado com Backup Automático na Nuvem • 2026
      </footer>

    </div>
  );
}
