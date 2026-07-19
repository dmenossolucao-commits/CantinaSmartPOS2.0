/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Product, Client, CartItem, PaymentMethod, Transaction } from '../types';
import { 
  Search, ShoppingCart, User, Fingerprint, Plus, Minus, Trash2, 
  Coins, CreditCard, QrCode, CalendarClock, ChevronRight, X, Check, 
  CheckCircle2, UserPlus, Send, Copy, Grid, List, ArrowLeft, RefreshCw,
  Download, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import BiometricsScanner from './BiometricsScanner';
import { downloadReceiptAsPNG } from '../utils/receipt';
import { generatePixPayload, getPixQRCodeUrl } from '../utils/pix';
import { TENANT_CONFIG } from '../config/tenant';

interface PDVTerminalProps {
  products: Product[];
  clients: Client[];
  onCompleteSale: (transaction: Transaction, updatedClients: Client[], updatedProducts: Product[]) => void;
  onAddClient?: (client: Client) => void;
  triggerPushNotification: (title: string, body: string, type?: 'info' | 'success' | 'warn') => void;
  pixKey: string;
}

const PRODUCT_IMAGES: Record<string, string> = {
  'p1': 'https://images.unsplash.com/photo-1626200419199-391ae4be7e41?auto=format&fit=crop&w=600&q=80', // Coxinha
  'p2': 'https://images.unsplash.com/photo-1585544314018-e0d37e124b83?auto=format&fit=crop&w=600&q=80', // Pastel
  'p3': 'https://images.unsplash.com/photo-1590137876181-2a5a7e340308?auto=format&fit=crop&w=600&q=80', // Pão de queijo
  'p4': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', // Enroladinho
  'p5': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80', // Refrigerante
  'p6': 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&w=600&q=80', // Suco de Laranja
  'p7': 'https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=600&q=80', // Agua mineral
  'p8': 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=600&q=80', // Suco del valle
  'p9': 'https://images.unsplash.com/photo-1541832676-9b763b0239ab?auto=format&fit=crop&w=600&q=80', // Brigadeiro
  'p10': 'https://images.unsplash.com/photo-1530610476181-d83430964d5b?auto=format&fit=crop&w=600&q=80', // Sonho
  'p11': 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=600&q=80', // Cookie
  'p12': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80', // Prato Feito
  'p13': 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?auto=format&fit=crop&w=600&q=80', // Lasanha
  'p14': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80', // Salada
  'p15': 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80', // Ruffles
  'p16': 'https://images.unsplash.com/photo-1582138110529-f8a75a3e144a?auto=format&fit=crop&w=600&q=80', // Chiclete
  'p17': 'https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?auto=format&fit=crop&w=600&q=80', // Pizza Margherita
  'p18': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80', // Hambúrguer
  'p19': 'https://images.unsplash.com/photo-1612874742237-6526221588e3?auto=format&fit=crop&w=600&q=80', // Pasta Carbonara
  'p20': 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=600&q=80', // Combo Sushi
};

export default function PDVTerminal({ 
  products, 
  clients, 
  onCompleteSale, 
  onAddClient,
  triggerPushNotification,
  pixKey
}: PDVTerminalProps) {
  
  // Core POS States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  
  // Checkout flow step:
  // 'idle' = Building cart (only Catalog & Cart visible)
  // 'payment_selection' = Choosing payment (Dinheiro, Pix, Crédito, Débito, Prazo)
  // 'cash_amount' = Cash input / change calculator
  // 'pix_qr' = Pix QR simulation
  // 'confirm_payment' = Final review screen (second tab/confirmation)
  // 'success' = Transaction completed, showing polite receipt & WhatsApp share
  const [checkoutStep, setCheckoutStep] = useState<'idle' | 'payment_selection' | 'cash_amount' | 'pix_qr' | 'confirm_payment' | 'success'>('idle');
  
  const [cashReceived, setCashReceived] = useState<string>('');
  const [showBiometrics, setShowBiometrics] = useState(false);
  const [searchClientTerm, setSearchClientTerm] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState<Transaction | null>(null);
  const [showClearCartConfirm, setShowClearCartConfirm] = useState(false);

  // New Client Quick Registration State (during Checkout)
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientClass, setNewClientClass] = useState('');
  const [newClientType, setNewClientType] = useState<'aluno' | 'colaborador'>('aluno');
  const [newClientLimit, setNewClientLimit] = useState('150.00');

  // Prazo de Pagamento State (deadline for deferred purchase)
  const [deadlineType, setDeadlineType] = useState<'7' | '15' | '30' | '45' | 'custom'>('15');
  const [customDeadlineDate, setCustomDeadlineDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  });

  const categories = ['Todos', 'Salgados', 'Bebidas', 'Doces', 'Almoço', 'Outros'];

  // Calculate due date based on chosen deadline type
  const calculatedDueDate = useMemo(() => {
    if (deadlineType === 'custom') {
      return new Date(customDeadlineDate + 'T23:59:59');
    }
    const days = parseInt(deadlineType);
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
  }, [deadlineType, customDeadlineDate]);

  const formattedDueDateString = useMemo(() => {
    return calculatedDueDate.toLocaleDateString('pt-BR');
  }, [calculatedDueDate]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const nameMatch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const codeMatch = p.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSearch = nameMatch || codeMatch;
      const matchesCat = selectedCategory === 'Todos' || p.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [products, searchTerm, selectedCategory]);

  // Filter clients for lookup
  const filteredClientsForLookup = useMemo(() => {
    if (!searchClientTerm) return clients.slice(0, 5);
    return clients.filter(c => 
      c.name.toLowerCase().includes(searchClientTerm.toLowerCase()) || 
      c.classOrDept.toLowerCase().includes(searchClientTerm.toLowerCase())
    );
  }, [clients, searchClientTerm]);

  // Add item to cart
  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      triggerPushNotification('Produto Esgotado', `"${product.name}" está temporariamente sem estoque.`, 'warn');
      return;
    }

    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) {
        triggerPushNotification('Estoque Limite', `Apenas ${product.stock} un disponíveis para "${product.name}".`, 'warn');
        return;
      }
      setCart(cart.map(item => 
        item.product.id === product.id 
          ? { ...item, quantity: item.quantity + 1 } 
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  // Adjust Cart Quantity
  const updateQuantity = (productId: string, delta: number) => {
    const item = cart.find(i => i.product.id === productId);
    if (!item) return;

    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      setCart(cart.filter(i => i.product.id !== productId));
    } else {
      if (delta > 0 && newQty > item.product.stock) {
        triggerPushNotification('Estoque Máximo', `Estoque máximo atingido para "${item.product.name}".`, 'warn');
        return;
      }
      setCart(cart.map(i => i.product.id === productId ? { ...i, quantity: newQty } : i));
    }
  };

  // Cart total
  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  }, [cart]);

  // Client's available credit calculation
  const clientAvailableCredit = useMemo(() => {
    if (!selectedClient) return 0;
    return selectedClient.creditLimit + selectedClient.balance;
  }, [selectedClient]);

  // Proceed to payment selection
  const handleGoToPayment = () => {
    if (cart.length === 0) return;
    setCheckoutStep('payment_selection');
  };

  // Validation before opening checkout methods
  const handleProceedToCheckout = (method: PaymentMethod) => {
    if (cart.length === 0) return;

    if (method === 'prazo') {
      if (!selectedClient) {
        triggerPushNotification('Selecione o Cliente', 'Selecione ou cadastre um cliente para comprar a Prazo!', 'warn');
        return;
      }
      if (cartTotal > clientAvailableCredit) {
        triggerPushNotification('Limite Excedido', 'O valor da venda excede o limite disponível para este cliente!', 'warn');
        return;
      }
    }

    setPaymentMethod(method);
    setCheckoutStep('confirm_payment');
    if (method === 'dinheiro') {
      setCashReceived('');
    }
  };

  // Completes purchase transaction
  const completeTransaction = (method: PaymentMethod, cashGiven?: number) => {
    const txId = 't_' + Math.random().toString(36).substring(2, 9);
    
    // Decrement stocks
    const updatedProducts = products.map(p => {
      const cartItem = cart.find(item => item.product.id === p.id);
      if (cartItem) {
        return { ...p, stock: Math.max(0, p.stock - cartItem.quantity) };
      }
      return p;
    });

    let updatedClients = [...clients];
    if (selectedClient) {
      updatedClients = clients.map(c => {
        if (c.id === selectedClient.id) {
          const balanceDiff = method === 'prazo' ? -cartTotal : 0;
          return {
            ...c,
            balance: c.balance + balanceDiff
          };
        }
        return c;
      });
    }

    let txSaldoRestante: number | undefined = undefined;
    let txStatus: 'concluido' | 'pendente' = 'concluido';

    if (method === 'prazo' && selectedClient) {
      const prevBal = selectedClient.balance;
      if (prevBal >= 0) {
        if (prevBal >= cartTotal) {
          txSaldoRestante = undefined;
          txStatus = 'concluido';
        } else {
          txSaldoRestante = cartTotal - prevBal;
          txStatus = 'pendente';
        }
      } else {
        txSaldoRestante = cartTotal;
        txStatus = 'pendente';
      }
    }

    const tx: Transaction = {
      id: txId,
      clientId: selectedClient?.id,
      clientName: selectedClient?.name,
      items: cart.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        subtotal: item.product.price * item.quantity
      })),
      total: cartTotal,
      paymentMethod: method,
      timestamp: new Date().toISOString(),
      status: txStatus,
      saldo_restante: txSaldoRestante
    };

    onCompleteSale(tx, updatedClients, updatedProducts);
    setCompletedTransaction(tx);
    setCheckoutStep('success');

    // Trigger push notification simulation
    if (selectedClient && method === 'prazo') {
      const newBal = selectedClient.balance - cartTotal;
      const formattedBal = Math.abs(newBal).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      triggerPushNotification(
        'Conta Assinada a Prazo',
        `${selectedClient.name.split(' ')[0]} acumulou R$ ${cartTotal.toFixed(2)} de débito registrado. Novo Saldo Devedor: R$ ${formattedBal}.`,
        'success'
      );
    } else {
      triggerPushNotification('Venda Concluída', `Venda de R$ ${cartTotal.toFixed(2)} recebida via ${methodLabel(method)}.`, 'success');
    }
  };

  const handleCashCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cash = parseFloat(cashReceived.replace(',', '.'));
    if (isNaN(cash) || cash < cartTotal) {
      triggerPushNotification('Valor Insuficiente', 'O valor em dinheiro informado é insuficiente!', 'warn');
      return;
    }
    completeTransaction('dinheiro', cash);
  };

  const cashChange = useMemo(() => {
    const cash = parseFloat(cashReceived.replace(',', '.'));
    if (isNaN(cash) || cash < cartTotal) return 0;
    return cash - cartTotal;
  }, [cashReceived, cartTotal]);

  const handleResetPDV = () => {
    setCart([]);
    setSelectedClient(null);
    setPaymentMethod(null);
    setCheckoutStep('idle');
    setCashReceived('');
    setCompletedTransaction(null);
    setShowQuickRegister(false);
    setDeadlineType('15');
    setIsCartDrawerOpen(false);
  };

  // Quick Inline Client Registration
  const handleQuickRegisterClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newClientPhone) {
      triggerPushNotification('Campos Obrigatórios', 'Nome e telefone do cliente são obrigatórios.', 'warn');
      return;
    }

    const cleanPhone = newClientPhone.replace(/[^0-9]/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? '+' + cleanPhone : '+55' + cleanPhone;

    const newC: Client = {
      id: 'c_reg_' + Math.random().toString(36).substring(2, 9),
      name: newClientName.trim(),
      email: `${newClientName.trim().toLowerCase().replace(/\s+/g, '.')}@cantina.com`,
      phone: formattedPhone,
      type: 'aluno',
      classOrDept: 'Geral',
      balance: 0.00,
      creditLimit: 9999,
      biometricRegistered: false
    };

    if (onAddClient) {
      onAddClient(newC);
    }
    
    // Automatically select the newly registered client
    setSelectedClient(newC);
    setShowQuickRegister(false);
    
    // Clear form fields
    setNewClientName('');
    setNewClientPhone('');

    triggerPushNotification('Cliente Vinculado', `${newC.name} foi criado e selecionado para a compra.`, 'success');
  };

  // Polite WhatsApp receipt / sale confirmation text generator
  const getWhatsAppReceiptLink = (tx: Transaction, client: Client) => {
    const space = ' ';
    const breakLine = '\n';
    
    let text = `🧾 *${TENANT_CONFIG.COMPANY_NAME.toUpperCase()}* 🧾\n`;
    text += `---------------------------------\n`;
    text += `*Cliente:* ${client.name}\n`;
    text += `*Data:* ${new Date(tx.timestamp).toLocaleString('pt-BR')}\n`;
    text += `---------------------------------\n\n`;
    text += `*Itens do Pedido:*\n`;
    
    tx.items.forEach(item => {
      text += `• ${item.quantity}x ${item.productName} - R$ ${(item.price * item.quantity).toFixed(2)}\n`;
    });
    text += `\n---------------------------------\n`;
    text += `*Total Geral: R$ ${tx.total.toFixed(2)}*\n`;
    text += `*Forma de Pagamento:* ${methodLabel(tx.paymentMethod)}\n`;
    if (tx.paymentMethod === 'prazo') {
      const prevDebt = client.balance < 0 ? Math.abs(client.balance) : 0;
      if (prevDebt > 0) {
        text += `*Saldo Devedor Anterior:* R$ ${prevDebt.toFixed(2)}\n`;
      }
      const clientNewBalance = client.balance - tx.total;
      text += `*Vencimento:* ${formattedDueDateString}\n`;
      text += `*Novo Saldo Devedor:* R$ ${Math.abs(clientNewBalance).toFixed(2)}\n`;
    }
    text += `---------------------------------\n\n`;
    text += `Agradecemos a preferência! 😊✨\n\n`;
    text += `_(O recibo detalhado em formato de imagem PNG foi baixado no seu dispositivo. Você pode anexar a imagem junto a esta mensagem!)_`;

    return `https://api.whatsapp.com/send?phone=${client.phone.replace(/[^0-9]/g, '')}&text=${encodeURIComponent(text)}`;
  };

  const methodLabel = (method: PaymentMethod): string => {
    const labels: Record<PaymentMethod, string> = {
      dinheiro: 'Dinheiro',
      pix: 'Pix',
      crédito: 'Cartão de Crédito',
      débito: 'Cartão de Débito',
      prazo: 'Conta a Prazo (Carteira)'
    };
    return labels[method];
  };

  // Helper to map category name to visual mockup category labels
  const getCategoryVisualLabel = (product: Product): string => {
    const n = product.name.toLowerCase();
    if (n.includes('pizza') || n.includes('carbonara') || n.includes('lasanha')) return 'Italiana';
    if (n.includes('sushi') || n.includes('combo sushi')) return 'Japonesa';
    if (product.category === 'Salgados') return 'Lanches';
    if (product.category === 'Almoço') return 'Lanches'; // Lanches category inside the mockup serves hamburgers / general food
    return product.category;
  };

  // Helper to get image URL
  const getProductImage = (productId: string): string => {
    const product = products.find(p => p.id === productId);
    if (product && product.imageUrl) {
      return product.imageUrl;
    }
    return PRODUCT_IMAGES[productId] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';
  };

  const isDrawerOpen = isCartDrawerOpen || checkoutStep !== 'idle';

  return (
    <div id="pdv-terminal-root" className="relative bg-gray-50/30 rounded-3xl min-h-[calc(100vh-140px)] pb-24 select-none">
      
      {/* PHONE VIEWPORT MAIN COLUMN - STYLED TO LOOK EXACTLY LIKE THE MOCKUP */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        
        {/* HEADER AREA */}
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                if (cart.length > 0) {
                  if (confirm('Deseja cancelar o pedido atual?')) {
                    handleResetPDV();
                  }
                }
              }}
              className="w-10 h-10 rounded-full flex items-center justify-center text-gray-800 hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft size={24} strokeWidth={2.5} />
            </button>
            <h1 className="font-sans font-bold text-gray-900 text-[24px]">
              Frente de caixa
            </h1>
          </div>

          {cart.length > 0 && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-2xl flex flex-col items-end shadow-sm"
            >
              <span className="text-[9px] text-emerald-800 font-bold uppercase tracking-wider font-sans">Valor Acumulado</span>
              <span className="font-mono font-black text-emerald-600 text-sm">
                R$ {cartTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </motion.div>
          )}
        </div>

        {/* SEARCH BAR INPUT */}
        <div className="relative mb-5">
          <span className="absolute inset-y-0 left-4 flex items-center text-gray-400">
            <Search size={20} />
          </span>
          <input
            id="product-search-input"
            type="text"
            placeholder="Código, nome ou código de barras"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-gray-100 border-0 focus:bg-white rounded-2xl font-sans text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-all text-gray-800 placeholder-gray-500"
          />
        </div>

        {/* CATEGORY PILLS HORIZONTAL LIST */}
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-none scroll-smooth">
          {categories.map(cat => (
            <button
              key={cat}
              id={`category-tab-${cat}`}
              onClick={() => setSelectedCategory(cat)}
              className={`py-2 px-5 rounded-full font-sans text-sm font-semibold transition-all shrink-0 select-none ${
                selectedCategory === cat 
                  ? 'bg-[#1D4ED8] text-white shadow-sm' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200/80'
              }`}
            >
              {cat === 'Salgados' ? 'Lanches' : cat}
            </button>
          ))}
        </div>

        {/* VIEW TOGGLE DIVIDER ROW */}
        <div className="flex items-center justify-end py-3 border-y border-gray-200/60 mb-5">
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'grid' 
                  ? 'bg-white text-[#1D4ED8] shadow-sm' 
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Grid size={18} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'list' 
                  ? 'bg-white text-[#1D4ED8] shadow-sm' 
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <List size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* PRODUCTS AREA */}
        {filteredProducts.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <Search size={48} className="text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-500 font-sans">Nenhum produto correspondente encontrado.</p>
          </div>
        ) : viewMode === 'grid' ? (
          /* GRID VIEW */
          <div className="grid grid-cols-2 gap-4">
            {filteredProducts.map(product => {
              const cartItem = cart.find(item => item.product.id === product.id);
              const quantityInCart = cartItem ? cartItem.quantity : 0;
              return (
                <div
                  key={product.id}
                  id={`product-card-${product.id}`}
                  onClick={() => product.stock > 0 && addToCart(product)}
                  className={`group bg-white border rounded-3xl hover:shadow-md active:scale-[0.99] transition-all flex flex-col justify-between h-full relative cursor-pointer ${
                    product.stock <= 0 
                      ? 'opacity-60 bg-gray-50/50 cursor-not-allowed border-gray-150/70' 
                      : quantityInCart > 0 
                        ? 'border-[#1D4ED8] ring-2 ring-blue-600/20' 
                        : 'border-gray-150/70 hover:border-blue-400'
                  }`}
                >
                  {/* Quantity Badge (Bolinha) - High Contrast & Salient, Floating Outside Card */}
                  {quantityInCart > 0 && (
                    <div className="absolute -top-2.5 -right-2.5 z-30 bg-[#1D4ED8] text-white font-sans font-black text-sm w-8.5 h-8.5 rounded-full flex items-center justify-center shadow-lg border-[3px] border-white transition-transform transform hover:scale-110 active:scale-95">
                      {quantityInCart}
                    </div>
                  )}

                  {/* Stock Indicator Badge */}
                  <span className={`absolute top-3 left-3 z-10 px-2 py-0.5 rounded-lg text-[9px] font-mono font-bold ${
                    product.stock <= 0 
                      ? 'bg-red-50 text-red-600' 
                      : product.stock <= product.minStock 
                        ? 'bg-amber-50 text-amber-700 animate-pulse' 
                        : 'bg-emerald-50 text-emerald-700'
                  }`}>
                    {product.stock <= 0 ? 'Esgotado' : `Est: ${product.stock}`}
                  </span>

                  {/* IMAGE TOP SECTION WITH OVERLAY - overflow-hidden here preserves rounded corners */}
                  <div className="relative h-44 w-full bg-gray-100 overflow-hidden rounded-t-[22px] shrink-0">
                    <img 
                      src={getProductImage(product.id)} 
                      alt={product.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                    {/* Category overlay label in blue matching mockup */}
                    <span className="absolute top-3 right-3 bg-[#1D4ED8] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                      {getCategoryVisualLabel(product)}
                    </span>
                  </div>

                  {/* CARD BODY */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-sans font-medium text-gray-800 text-[14px] leading-snug line-clamp-2">
                        {product.name}
                      </h3>
                      <p className="font-sans font-bold text-[#1D4ED8] text-[16px] mt-1.5">
                        R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    {/* ADICIONAR FULL WIDTH BLUE BUTTON (Visual only, container handles click) */}
                    <div
                      className={`mt-4 w-full py-2 px-4 font-sans text-[13px] font-semibold rounded-2xl transition-colors flex items-center justify-center gap-1 shadow-sm ${
                        product.stock <= 0 
                          ? 'bg-gray-200 text-gray-400' 
                          : quantityInCart > 0 
                            ? 'bg-emerald-600 text-white' 
                            : 'bg-[#1D4ED8] hover:bg-blue-800 text-white'
                      }`}
                    >
                      {product.stock <= 0 ? 'Esgotado' : quantityInCart > 0 ? `Selecionado (${quantityInCart})` : 'Adicionar'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* LIST VIEW */
          <div className="space-y-3">
            {filteredProducts.map(product => {
              const cartItem = cart.find(item => item.product.id === product.id);
              const quantityInCart = cartItem ? cartItem.quantity : 0;
              return (
                <div
                  key={product.id}
                  onClick={() => product.stock > 0 && addToCart(product)}
                  className={`bg-white border p-3 rounded-2xl flex items-center justify-between gap-3 hover:shadow-sm transition-all cursor-pointer ${
                    product.stock <= 0 
                      ? 'opacity-60 cursor-not-allowed border-gray-150/70' 
                      : quantityInCart > 0 
                        ? 'border-[#1D4ED8] ring-2 ring-blue-600/20' 
                        : 'border-gray-150/70 hover:border-blue-400'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-14 h-14 bg-gray-100 rounded-xl shrink-0 relative">
                      <img 
                        src={getProductImage(product.id)} 
                        alt={product.name} 
                        className="w-full h-full object-cover rounded-xl"
                        referrerPolicy="no-referrer"
                      />
                      {/* Quantity Badge in List View - Floating Outside Thumbnail and Highly Salient */}
                      {quantityInCart > 0 && (
                        <div className="absolute -top-2 -right-2 z-20 bg-[#1D4ED8] text-white font-sans font-black text-xs w-6.5 h-6.5 rounded-full flex items-center justify-center shadow-md border-2 border-white animate-scale-in">
                          {quantityInCart}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-[#1D4ED8] bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
                          {getCategoryVisualLabel(product)}
                        </span>
                        {product.stock <= product.minStock && (
                          <span className="text-[9px] font-mono text-amber-600 font-bold">Est: {product.stock}</span>
                        )}
                      </div>
                      <h4 className="font-sans font-medium text-gray-800 text-sm truncate mt-1">
                        {product.name}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-sans font-bold text-[#1D4ED8] text-sm">
                      R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <div
                      className={`py-1.5 px-3 font-sans text-xs font-semibold rounded-xl transition-colors ${
                        product.stock <= 0 
                          ? 'bg-gray-200 text-gray-400' 
                          : quantityInCart > 0 
                            ? 'bg-emerald-600 text-white' 
                            : 'bg-[#1D4ED8] text-white'
                      }`}
                    >
                      {product.stock <= 0 ? 'Esgotado' : quantityInCart > 0 ? `${quantityInCart}x` : '+ Add'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* FLOATING BOTTOM CHECKOUT ACTION BAR */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-30">
        <div className="bg-white/90 backdrop-blur-md rounded-full shadow-xl border border-gray-150/60 p-2.5 flex items-center gap-3">
          {/* LIVE TOTAL VALUE SUMMED */}
          {cart.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="pl-3.5 flex flex-col justify-center shrink-0 border-r border-gray-150/60 pr-3"
            >
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-sans">Soma Atual</span>
              <span className="font-mono font-black text-emerald-600 text-[14px] whitespace-nowrap">
                R$ {cartTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </motion.div>
          )}

          {/* PAY BUTTON */}
          <button
            id="proceed-checkout-btn"
            onClick={() => {
              if (cart.length > 0) {
                setIsCartDrawerOpen(true);
                setCheckoutStep('payment_selection');
              } else {
                triggerPushNotification('Cesta Vazia', 'Adicione produtos à cesta antes de pagar!', 'warn');
              }
            }}
            disabled={cart.length === 0}
            className="flex-1 py-3.5 bg-[#1D4ED8] hover:bg-blue-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-sans text-[15px] font-bold rounded-full transition-all flex items-center justify-center shadow-md active:scale-98"
          >
            Pagar
          </button>

          {/* CART CIRCULAR ICON WITH COUNTER BADGE */}
          <button
            onClick={() => {
              if (cart.length > 0) {
                setIsCartDrawerOpen(true);
                setCheckoutStep('idle');
              } else {
                triggerPushNotification('Cesta Vazia', 'Sua cesta de compras está vazia.', 'info');
              }
            }}
            className="w-12 h-12 rounded-full bg-white text-gray-800 hover:bg-gray-100 flex items-center justify-center relative shadow-lg border border-gray-150 shrink-0"
          >
            <ShoppingCart size={22} className="text-gray-700" />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#1D4ED8] text-white font-sans text-[11px] font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* CHECKOUT BOTTOM SHEET DRAWER OVERLAY */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            {/* BACKDROP BACKGOUND BLUR */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (checkoutStep === 'idle' || checkoutStep === 'payment_selection') {
                  setIsCartDrawerOpen(false);
                  setCheckoutStep('idle');
                }
              }}
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
            />

            {/* SLIDE-UP SHEET CONTAINER */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 max-h-[85vh] bg-white rounded-t-[32px] shadow-2xl z-50 overflow-hidden flex flex-col max-w-lg mx-auto border-t border-gray-100"
            >
              
              {/* DRAWER TOP BAR PULL ACCENT */}
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto my-3 shrink-0" />

              {/* STEP 1: CART BASKET REVIEW */}
              {checkoutStep === 'idle' && (
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="px-5 pb-3 border-b border-gray-100 flex justify-between items-center shrink-0">
                    <h3 className="font-sans font-bold text-gray-900 text-[18px] flex items-center gap-2">
                      🛒 Cesta de Compras
                      <span className="text-xs bg-blue-50 text-[#1D4ED8] px-2.5 py-0.5 rounded-full font-bold">
                        {cart.reduce((s, i) => s + i.quantity, 0)} itens
                      </span>
                    </h3>
                    <button
                      onClick={() => setShowClearCartConfirm(true)}
                      className="text-red-500 hover:text-red-700 py-1 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1"
                    >
                      <Trash2 size={14} />
                      Limpar
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    {cart.map(item => (
                      <div 
                        key={item.product.id}
                        className="flex items-center justify-between border border-gray-100 rounded-2xl p-3 bg-gray-50/50"
                      >
                        <div className="flex-1 min-w-0 pr-3">
                          <h5 className="text-sm font-bold text-gray-800 truncate leading-tight">
                            {item.product.name}
                          </h5>
                          <p className="text-xs text-gray-400 font-mono mt-0.5">
                            R$ {item.product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} un
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center border border-gray-200 bg-white rounded-xl overflow-hidden shadow-sm">
                            <button
                              onClick={() => updateQuantity(item.product.id, -1)}
                              className="p-2 text-gray-500 hover:bg-gray-100"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="px-3.5 font-mono text-sm font-black text-gray-800">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.product.id, 1)}
                              className="p-2 text-gray-500 hover:bg-gray-100"
                            >
                              <Plus size={12} />
                            </button>
                          </div>

                          <span className="font-mono font-bold text-gray-900 text-sm w-20 text-right">
                            R$ {(item.product.price * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>

                          <button
                            onClick={() => {
                              if (confirm(`Remover "${item.product.name}" do pedido?`)) {
                                updateQuantity(item.product.id, -item.quantity);
                              }
                            }}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                            title="Remover Item"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-5 border-t border-gray-100 bg-gray-50/60 shrink-0 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="font-sans text-sm font-bold text-gray-500 uppercase">Valor do Pedido:</span>
                      <span className="font-mono text-2xl font-black text-gray-900">
                        R$ {cartTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <button
                      onClick={handleGoToPayment}
                      className="w-full py-4 bg-[#1D4ED8] hover:bg-blue-800 text-white font-sans text-sm font-bold rounded-2xl flex items-center justify-center gap-1.5 shadow-lg active:scale-98 transition-all"
                    >
                      Avançar para Pagamento
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: PAYMENT METHOD AND CLIENT ASSIGNMENT */}
              {checkoutStep === 'payment_selection' && (
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="px-5 pb-3 border-b border-gray-100 flex justify-between items-center shrink-0">
                    <button
                      onClick={() => setCheckoutStep('idle')}
                      className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 font-bold"
                    >
                      <X size={14} /> Voltar à Cesta
                    </button>
                    <span className="text-xs text-gray-400 font-mono font-bold">
                      Subtotal: R$ {cartTotal.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    
                    {/* CLIENT MANAGER AT TOP */}
                    <div className="bg-gray-50 border border-gray-150 p-4 rounded-2xl space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide block">
                          Identificar Cliente
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowBiometrics(true)}
                            className="text-[11px] bg-blue-50 hover:bg-blue-100 text-[#1D4ED8] py-1 px-2.5 rounded-lg font-bold border border-blue-100 flex items-center gap-1 transition-all"
                          >
                            <Fingerprint size={13} /> Biometria
                          </button>
                          <button
                            onClick={() => setShowQuickRegister(!showQuickRegister)}
                            className="text-[11px] bg-amber-50 hover:bg-amber-100 text-amber-700 py-1 px-2.5 rounded-lg font-bold border border-amber-100 flex items-center gap-1 transition-all"
                          >
                            <UserPlus size={13} /> {showQuickRegister ? 'Cancelar' : 'Cadastrar'}
                          </button>
                        </div>
                      </div>

                       <AnimatePresence mode="wait">
                        {showQuickRegister ? (
                          <motion.form 
                            key="quick-register-form"
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            onSubmit={handleQuickRegisterClient}
                            className="bg-white p-3.5 border border-amber-200 rounded-xl space-y-3 shadow-inner"
                          >
                            <h4 className="text-xs font-bold text-amber-800 flex items-center gap-1 pb-1 border-b border-amber-100">
                              <UserPlus size={14} /> Novo Cliente Rápido
                            </h4>
                            
                            <div>
                              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Nome Completo</label>
                              <input
                                type="text"
                                value={newClientName}
                                onChange={(e) => setNewClientName(e.target.value)}
                                placeholder="Ex: Lucas Henrique Souza"
                                required
                                className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">WhatsApp</label>
                              <input
                                type="text"
                                value={newClientPhone}
                                onChange={(e) => setNewClientPhone(e.target.value)}
                                placeholder="Ex: 11988887777"
                                required
                                className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white"
                              />
                            </div>

                            <button
                              type="submit"
                              className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors"
                            >
                              Salvar e Selecionar
                            </button>
                          </motion.form>
                        ) : selectedClient ? (
                          <motion.div 
                            key="selected-client-profile"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-sans font-extrabold text-xs">
                                {selectedClient.name.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <h5 className="font-sans font-bold text-xs text-gray-950">
                                  {selectedClient.name}
                                </h5>
                                <p className="text-[10px] text-gray-500 font-mono">
                                  {selectedClient.phone}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <p className="text-xs font-mono font-extrabold text-red-600">
                                  Saldo Devedor: R$ {selectedClient.balance < 0 ? Math.abs(selectedClient.balance).toFixed(2) : '0,00'}
                                </p>
                              </div>
                              <button
                                onClick={() => setSelectedClient(null)}
                                className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1 rounded-full transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div key="client-search-box" className="relative">
                            <span className="absolute inset-y-0 left-3 flex items-center pl-1 text-gray-400">
                              <User size={15} />
                            </span>
                            <input
                              type="text"
                              placeholder="Buscar cliente para pagamento..."
                              value={searchClientTerm}
                              onFocus={() => setShowClientDropdown(true)}
                              onChange={(e) => {
                                  setSearchClientTerm(e.target.value);
                                  setShowClientDropdown(true);
                              }}
                              className="w-full pl-10 pr-8 py-2 bg-white border border-gray-200 rounded-xl font-sans text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                            />
                            {searchClientTerm && (
                              <button
                                onClick={() => setSearchClientTerm('')}
                                className="absolute inset-y-0 right-3 flex items-center text-gray-400"
                              >
                                <X size={12} />
                              </button>
                            )}

                            {showClientDropdown && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowClientDropdown(false)} />
                                <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-40 overflow-y-auto py-1">
                                  {filteredClientsForLookup.length === 0 ? (
                                    <div className="p-3 text-center text-xs text-gray-400">
                                      Nenhum correspondente
                                    </div>
                                  ) : (
                                    filteredClientsForLookup.map(client => (
                                      <button
                                        key={client.id}
                                        type="button"
                                        onClick={() => {
                                          setSelectedClient(client);
                                          setSearchClientTerm('');
                                          setShowClientDropdown(false);
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-blue-50 text-xs border-b border-gray-50 last:border-b-0 flex justify-between items-center"
                                      >
                                        <div>
                                          <p className="font-bold text-gray-800">{client.name}</p>
                                          <p className="text-[9px] text-gray-400">
                                            {client.phone}
                                          </p>
                                        </div>
                                        <span className="text-[10px] font-mono text-red-500 font-bold">
                                          Saldo Devedor: R$ {client.balance < 0 ? Math.abs(client.balance).toFixed(2) : '0,00'}
                                        </span>
                                      </button>
                                    ))
                                  )}
                                </div>
                              </>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* PAYMENT METHODS SELECTOR */}
                    <div className="space-y-3">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide block">
                        Selecione o Meio de Pagamento
                      </span>

                      <div className="grid grid-cols-2 gap-3">
                        {/* Dinheiro (Cash) */}
                        <button
                          onClick={() => handleProceedToCheckout('dinheiro')}
                          className="p-3 bg-white hover:bg-blue-50/10 border border-gray-200 hover:border-[#1D4ED8] rounded-2xl flex flex-col items-center justify-center text-center gap-2 shadow-sm transition-all"
                        >
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <Coins size={20} />
                          </div>
                          <div>
                            <span className="font-sans font-bold text-gray-800 text-xs block">Dinheiro</span>
                            <span className="text-[10px] text-gray-400 block">Calcula troco</span>
                          </div>
                        </button>

                        {/* Pix */}
                        <button
                          onClick={() => handleProceedToCheckout('pix')}
                          className="p-3 bg-white hover:bg-blue-50/10 border border-gray-200 hover:border-[#1D4ED8] rounded-2xl flex flex-col items-center justify-center text-center gap-2 shadow-sm transition-all"
                        >
                          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                            <QrCode size={20} />
                          </div>
                          <div>
                            <span className="font-sans font-bold text-gray-800 text-xs block">Pix</span>
                            <span className="text-[10px] text-gray-400 block">QR Code Pix</span>
                          </div>
                        </button>

                        {/* Crédito */}
                        <button
                          onClick={() => handleProceedToCheckout('crédito')}
                          className="p-3 bg-white hover:bg-blue-50/10 border border-gray-200 hover:border-[#1D4ED8] rounded-2xl flex flex-col items-center justify-center text-center gap-2 shadow-sm transition-all"
                        >
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <CreditCard size={20} />
                          </div>
                          <div>
                            <span className="font-sans font-bold text-gray-800 text-xs block">Crédito</span>
                            <span className="text-[10px] text-gray-400 block">Maquininha</span>
                          </div>
                        </button>

                        {/* Débito */}
                        <button
                          onClick={() => handleProceedToCheckout('débito')}
                          className="p-3 bg-white hover:bg-blue-50/10 border border-gray-200 hover:border-[#1D4ED8] rounded-2xl flex flex-col items-center justify-center text-center gap-2 shadow-sm transition-all"
                        >
                          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                            <CreditCard size={20} />
                          </div>
                          <div>
                            <span className="font-sans font-bold text-gray-800 text-xs block">Débito</span>
                            <span className="text-[10px] text-gray-400 block">Cartão</span>
                          </div>
                        </button>
                      </div>

                      {/* COMPRA A PRAZO */}
                      <div className="pt-2">
                        <button
                          onClick={() => handleProceedToCheckout('prazo')}
                          className={`w-full p-4 rounded-2xl border transition-all flex items-start gap-4 text-left shadow-sm ${
                            selectedClient 
                              ? 'bg-gradient-to-r from-amber-500/5 to-amber-500/10 border-amber-300 hover:border-amber-400' 
                              : 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-75'
                          }`}
                        >
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                            selectedClient ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-400'
                          }`}>
                            <CalendarClock size={22} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-sans font-bold text-gray-900 text-xs block">Conta a Prazo (Assinar Carteira)</span>
                              <span className="text-[8px] bg-amber-500 text-white font-bold px-2 py-0.5 rounded-full uppercase">Prazo</span>
                            </div>
                            <p className="text-[10px] font-sans mt-0.5">
                              {selectedClient ? (
                                <span className="font-bold text-red-600">Saldo Devedor Atual: R$ {selectedClient.balance < 0 ? Math.abs(selectedClient.balance).toFixed(2) : '0,00'}
                                </span>
                              ) : (
                                <span className="text-gray-400">Associe um cliente acima para habilitar esta opção.</span>
                              )}
                            </p>

                            {selectedClient && (
                              <div className="mt-2 bg-amber-50/50 border border-amber-150 rounded-xl p-3 text-[10px] text-amber-850 font-sans" onClick={(e) => e.stopPropagation()}>
                                <p className="font-bold">✨ Registro de Compra a Prazo</p>
                                <p className="mt-0.5 text-[9px] text-amber-700 leading-relaxed">
                                  Esta compra será registrada no histórico de débitos de <strong>{selectedClient.name}</strong> para controle de saldo e acerto posterior. Não há data de vencimento pré-definida.
                                </p>
                              </div>
                            )}
                          </div>
                        </button>
                      </div>

                    </div>

                  </div>
                </div>
              )}

              {/* STEP: UNIFIED PAYMENT CONFIRMATION (SECOND TAB BEFORE CONFIRMATION) */}
              {checkoutStep === 'confirm_payment' && (
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="px-5 pb-3 border-b border-gray-100 flex justify-between items-center shrink-0">
                    <button
                      onClick={() => setCheckoutStep('payment_selection')}
                      className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 font-bold"
                    >
                      <X size={14} /> Voltar/Alterar Pagamento
                    </button>
                    <span className="text-xs text-emerald-600 font-mono font-bold">Confirmação</span>
                  </div>

                  <div className="flex-1 p-5 overflow-y-auto space-y-4">
                    {/* Compact Sale Summary Header */}
                    <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4 text-center">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Total Geral do Pedido</span>
                      <h3 className="font-mono text-3xl font-black text-gray-900 mt-1">
                        R$ {cartTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </h3>
                      <div className="flex items-center justify-center gap-1.5 mt-2.5">
                        <span className="text-xs bg-blue-50 text-[#1D4ED8] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider font-mono">
                          Meio: {paymentMethod === 'prazo' ? 'A Prazo (Carteira)' : paymentMethod?.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Compact Itemized List */}
                    <div className="border border-gray-100 rounded-2xl p-3 space-y-1.5 bg-gray-50/20">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide block mb-1">Resumo dos Produtos</span>
                      <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                        {cart.map(item => (
                          <div key={item.product.id} className="flex justify-between items-center text-xs">
                            <span className="text-gray-600 truncate max-w-[220px]">
                              <strong className="text-gray-900">{item.quantity}x</strong> {item.product.name}
                            </span>
                            <span className="font-mono text-gray-500">
                              R$ {(item.product.price * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Client Info (if selected) */}
                    {selectedClient && (
                      <div className="border border-gray-100 rounded-2xl p-3 bg-gray-50/20 space-y-1.5">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide block">Cliente Associado</span>
                        <div className="flex justify-between items-baseline text-xs">
                          <span className="font-bold text-gray-800 truncate max-w-[180px]">{selectedClient.name}</span>
                          <span className="font-mono text-red-600 font-bold">
                            Saldo Devedor Atual: R$ {selectedClient.balance < 0 ? Math.abs(selectedClient.balance).toFixed(2) : '0,00'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Interactive Sub-sections based on Payment Method */}
                    
                    {/* 1. DINHEIRO RECEIVED AND CHANGE CALCULATOR */}
                    {paymentMethod === 'dinheiro' && (
                      <div className="space-y-3 pt-1">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase block">
                            Valor Recebido do Cliente (R$)
                          </label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-3.5 flex items-center text-gray-400 font-mono font-bold">R$</span>
                            <input
                              type="text"
                              placeholder="Ex: 50,00"
                              autoFocus
                              value={cashReceived}
                              onChange={(e) => setCashReceived(e.target.value)}
                              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-gray-900"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-1.5">
                          {[cartTotal, 5, 10, 20, 50, 100].map((val, idx) => {
                            const roundedVal = Math.ceil(val);
                            if (roundedVal < cartTotal && idx !== 0) return null;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setCashReceived(roundedVal.toFixed(2))}
                                className="py-1.5 px-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-mono text-xs font-bold rounded-lg transition-all"
                              >
                                R$ {roundedVal}
                              </button>
                            );
                          })}
                        </div>

                        {cashChange > 0 ? (
                          <div className="bg-emerald-50 border border-emerald-150 rounded-xl p-2.5 text-center">
                            <span className="text-[9px] text-emerald-800 uppercase block font-bold font-sans">Troco a Entregar</span>
                            <span className="font-mono text-base font-black text-emerald-950">
                              R$ {cashChange.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ) : cashReceived && parseFloat(cashReceived.replace(',', '.')) < cartTotal ? (
                          <div className="bg-red-50 border border-red-100 rounded-xl p-2 text-center">
                            <span className="text-[10px] text-red-600 font-bold font-sans">Valor informado insuficiente!</span>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* 2. PIX QR CODE SHOWCASE */}
                    {paymentMethod === 'pix' && (() => {
                      const payload = generatePixPayload(pixKey, cartTotal);
                      const qrUrl = getPixQRCodeUrl(payload);
                      return (
                        <div className="flex flex-col items-center text-center space-y-3 pt-1">
                          <div className="relative p-2.5 bg-white border-2 border-dashed border-teal-200 rounded-2xl shadow-inner inline-block">
                            <img
                              src={qrUrl}
                              alt="Pix QR Code"
                              className="w-28 h-28 rounded-xl object-contain"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-150 w-full text-left space-y-2">
                            <div className="space-y-0.5">
                              <span className="text-[8px] text-gray-400 block font-bold uppercase">Chave Pix</span>
                              <div className="flex gap-1">
                                <input
                                  type="text"
                                  readOnly
                                  value={pixKey}
                                  onClick={(e) => (e.target as HTMLInputElement).select()}
                                  className="flex-1 bg-white border border-gray-200 rounded px-2 py-0.5 text-[10px] font-mono text-gray-800 select-all focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(pixKey);
                                    triggerPushNotification('Copiado!', 'Chave Pix copiada!', 'success');
                                  }}
                                  className="p-1 bg-white border border-gray-200 hover:bg-gray-50 text-teal-700 rounded flex items-center justify-center shrink-0"
                                >
                                  <Copy size={10} />
                                </button>
                              </div>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-[8px] text-gray-400 block font-bold uppercase">Código Copia e Cola</span>
                              <div className="flex gap-1">
                                <input
                                  type="text"
                                  readOnly
                                  value={payload}
                                  onClick={(e) => (e.target as HTMLInputElement).select()}
                                  className="flex-1 bg-white border border-gray-200 rounded px-2 py-0.5 text-[10px] font-mono text-gray-800 select-all focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(payload);
                                    triggerPushNotification('Copiado!', 'Pix Copia e Cola copiado!', 'success');
                                  }}
                                  className="p-1 bg-white border border-gray-200 hover:bg-gray-50 text-teal-700 rounded flex items-center justify-center shrink-0"
                                >
                                  <Copy size={10} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 3. COMPRA A PRAZO BALANCE PREVIEW */}
                    {paymentMethod === 'prazo' && selectedClient && (
                      <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-3 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Prazo de Pagamento:</span>
                          <span className="font-bold text-amber-800">{deadlineType === 'custom' ? 'Personalizado' : `${deadlineType} Dias`}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Vencimento da Fatura:</span>
                          <span className="font-bold text-amber-800 underline">{formattedDueDateString}</span>
                        </div>
                        <div className="border-t border-amber-100 pt-2 flex justify-between font-bold text-red-600">
                          <span>Novo Saldo Devedor estimado:</span>
                          <span>
                            R$ {Math.abs(selectedClient.balance - cartTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 4. CREDIT & DEBIT CARD CARD INSTRUCTION */}
                    {(paymentMethod === 'crédito' || paymentMethod === 'débito') && (
                      <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-3.5 text-center text-xs space-y-1.5 text-blue-800">
                        <CreditCard size={20} className="mx-auto text-blue-600 animate-pulse" />
                        <p className="font-bold font-sans">Aproxime ou insira o cartão na maquininha</p>
                        <p className="text-[10px] text-blue-600 font-sans">Aguardando confirmação de transação da maquininha externa...</p>
                      </div>
                    )}
                  </div>

                  {/* Confirmation Submit Buttons Bar */}
                  <div className="p-5 border-t border-gray-100 bg-gray-50 shrink-0 flex gap-3">
                    <button
                      onClick={() => setCheckoutStep('payment_selection')}
                      className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-sans text-xs font-bold rounded-2xl transition-all"
                    >
                      Alterar Pgto
                    </button>
                    
                    <button
                      onClick={() => {
                        if (paymentMethod === 'dinheiro') {
                          const cash = parseFloat(cashReceived.replace(',', '.'));
                          if (cashReceived && (isNaN(cash) || cash < cartTotal)) {
                            triggerPushNotification('Valor Insuficiente', 'O valor em dinheiro informado é insuficiente!', 'warn');
                            return;
                          }
                          completeTransaction('dinheiro', isNaN(cash) ? cartTotal : cash);
                        } else if (paymentMethod) {
                          completeTransaction(paymentMethod);
                        }
                      }}
                      className="flex-[2] py-3 bg-[#10B981] hover:bg-emerald-600 text-white font-sans text-xs font-bold rounded-2xl flex items-center justify-center gap-1 shadow-md transition-all animate-heart-pulse"
                    >
                      <Check size={14} /> Confirmar e Registrar Venda
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: CASH RECEIVED & CHANGE CALCULATOR */}
              {checkoutStep === 'cash_amount' && (
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="px-5 pb-3 border-b border-gray-100 flex justify-between items-center shrink-0">
                    <button
                      onClick={() => setCheckoutStep('payment_selection')}
                      className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 font-bold"
                    >
                      <X size={14} /> Voltar aos Pagamentos
                    </button>
                    <span className="text-xs text-gray-400 font-mono">Dinheiro</span>
                  </div>

                  <form onSubmit={handleCashCheckoutSubmit} className="flex-1 p-5 flex flex-col justify-between overflow-y-auto">
                    <div className="space-y-4">
                      <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4 text-center">
                        <span className="text-xs text-gray-400 font-bold uppercase">Total a Pagar</span>
                        <h3 className="font-mono text-3xl font-black text-gray-900 mt-1">
                          R$ {cartTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </h3>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase block">
                          Valor Recebido do Cliente (R$)
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-3.5 flex items-center text-gray-400 font-mono font-bold">R$</span>
                          <input
                            type="text"
                            placeholder="Ex: 50,00"
                            autoFocus
                            value={cashReceived}
                            onChange={(e) => setCashReceived(e.target.value)}
                            required
                            className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5 pt-1">
                        {[cartTotal, 5, 10, 20, 50, 100].map((val, idx) => {
                          const roundedVal = Math.ceil(val);
                          if (roundedVal < cartTotal && idx !== 0) return null;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setCashReceived(roundedVal.toFixed(2))}
                              className="py-1.5 px-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-mono text-xs font-bold rounded-lg transition-all"
                            >
                              R$ {roundedVal}
                            </button>
                          );
                        })}
                      </div>

                      {cashChange > 0 ? (
                        <div className="bg-emerald-50 border border-emerald-150 rounded-2xl p-3 text-center">
                          <span className="text-[10px] text-emerald-800 uppercase block">Troco do Cliente</span>
                          <span className="font-mono text-lg font-black text-emerald-950">
                            R$ {cashChange.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ) : cashReceived && parseFloat(cashReceived.replace(',', '.')) < cartTotal ? (
                        <div className="bg-red-50 border border-red-100 rounded-2xl p-2.5 text-center">
                          <span className="text-xs text-red-600 font-bold">Valor informado insuficiente!</span>
                        </div>
                      ) : null}
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-2xl flex items-center justify-center gap-1 shadow-md mt-6"
                    >
                      <Check size={16} /> Concluir e Entregar Troco
                    </button>
                  </form>
                </div>
              )}

              {/* STEP 4: PIX QR CODE EMULATOR */}
              {checkoutStep === 'pix_qr' && (() => {
                const payload = generatePixPayload(pixKey, cartTotal);
                const qrUrl = getPixQRCodeUrl(payload);
                return (
                  <div className="flex flex-col h-full overflow-hidden">
                    <div className="px-5 pb-3 border-b border-gray-100 flex justify-between items-center shrink-0">
                      <button
                        onClick={() => setCheckoutStep('payment_selection')}
                        className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 font-bold"
                      >
                        <X size={14} /> Voltar aos Pagamentos
                      </button>
                      <span className="text-xs text-gray-400 font-mono">Pix</span>
                    </div>

                    <div className="flex-1 p-5 flex flex-col justify-between items-center text-center space-y-4 overflow-y-auto">
                      <div className="space-y-1">
                        <span className="text-[10px] text-teal-700 bg-teal-50 px-3 py-1 rounded-full uppercase tracking-wider inline-block font-bold">QR Code Real Gerado</span>
                        <p className="text-xs text-gray-500">Peça para o cliente pagar escaneando o QR Code abaixo ou copiando o código.</p>
                      </div>

                      <div className="relative p-4 bg-white border-2 border-dashed border-teal-200 rounded-3xl shadow-md">
                        <img
                          src={qrUrl}
                          alt="Pix QR Code"
                          className="w-40 h-40 object-contain mx-auto"
                          referrerPolicy="no-referrer"
                        />
                      </div>

                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-150 w-full space-y-2 text-left">
                        <p className="text-xs text-gray-500 font-sans text-center">Valor Pix: <strong className="text-gray-900">R$ {cartTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p>
                        
                        <div className="space-y-1">
                          <span className="text-[9px] text-gray-400 block font-bold uppercase">Chave Pix</span>
                          <div className="flex gap-1.5">
                            <input 
                              type="text" 
                              readOnly 
                              value={pixKey} 
                              onClick={(e) => (e.target as HTMLInputElement).select()}
                              className="flex-1 bg-white border border-gray-200 rounded-lg px-2 py-1 text-[11px] font-mono text-gray-800 select-all focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(pixKey);
                                triggerPushNotification('Copiado!', 'Chave Pix copiada!', 'success');
                              }}
                              className="p-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-teal-700 rounded-lg shrink-0 flex items-center justify-center"
                              title="Copiar Chave Pix"
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[9px] text-gray-400 block font-bold uppercase">Código Copia e Cola</span>
                          <div className="flex gap-1.5">
                            <input 
                              type="text" 
                              readOnly 
                              value={payload} 
                              onClick={(e) => (e.target as HTMLInputElement).select()}
                              className="flex-1 bg-white border border-gray-200 rounded-lg px-2 py-1 text-[11px] font-mono text-gray-800 select-all focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(payload);
                                triggerPushNotification('Copiado!', 'Código Copia e Cola copiado!', 'success');
                              }}
                              className="p-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-teal-700 rounded-lg shrink-0 flex items-center justify-center"
                              title="Copiar Código Copia e Cola"
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => completeTransaction('pix')}
                        className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-2xl flex items-center justify-center gap-1 shadow-md"
                      >
                        <Check size={16} /> Confirmar Recebimento Pix
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* STEP 5: SUCCESS & RECEIPT */}
              {checkoutStep === 'success' && completedTransaction && (
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="flex-1 p-6 flex flex-col justify-between items-center text-center space-y-5 overflow-y-auto">
                    
                    <div className="space-y-2">
                      <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
                        <CheckCircle2 size={32} />
                      </div>
                      <h3 className="font-sans font-extrabold text-gray-900 text-lg">Venda Concluída!</h3>
                      <p className="text-xs text-gray-400">A transação foi salva com sucesso.</p>
                    </div>

                    {/* RECEIPT DESIGN */}
                    <div className="w-full bg-gray-50 border border-gray-150 rounded-2xl p-4 text-left font-mono text-xs text-gray-600 space-y-2 shadow-inner">
                      <div className="border-b border-dashed border-gray-200 pb-2 text-center">
                        <h4 className="font-bold text-gray-800">{TENANT_CONFIG.COMPANY_NAME.toUpperCase()}</h4>
                        <p className="text-[10px] text-gray-400">Cupom de Venda • {new Date(completedTransaction.timestamp).toLocaleDateString('pt-BR')}</p>
                      </div>

                      <div className="space-y-1 py-1">
                        {completedTransaction.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span className="truncate max-w-[180px]">{item.quantity}x {item.productName}</span>
                            <span>R$ {(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-dashed border-gray-200 pt-2 flex justify-between font-bold text-gray-950 text-sm">
                        <span>TOTAL:</span>
                        <span>R$ {completedTransaction.total.toFixed(2)}</span>
                      </div>

                      <div className="bg-white rounded-lg p-2 border border-gray-100 text-[11px] text-gray-500 font-sans space-y-1 leading-relaxed">
                        <p><strong>Pagamento:</strong> {methodLabel(completedTransaction.paymentMethod)}</p>
                        {selectedClient && (
                          <>
                            <p><strong>Cliente:</strong> {selectedClient.name}</p>
                            {completedTransaction.paymentMethod === 'prazo' && (
                              <p className="text-amber-700 font-bold"><strong>Vencimento:</strong> {formattedDueDateString}</p>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* PNG RECEIPT DOWNLOADER */}
                    <button
                      onClick={() => {
                        const extra: string[] = [];
                        if (selectedClient) {
                          extra.push(`Cliente: ${selectedClient.name}`);
                          extra.push(`WhatsApp: ${selectedClient.phone}`);
                        }
                        if (completedTransaction.paymentMethod === 'prazo') {
                          extra.push(`Vencimento: ${formattedDueDateString}`);
                        }
                        
                        downloadReceiptAsPNG(
                          TENANT_CONFIG.SHORT_NAME,
                          'Cupom de Venda',
                          new Date(completedTransaction.timestamp).toLocaleString('pt-BR'),
                          completedTransaction.items.map(item => ({
                            name: item.productName,
                            qty: item.quantity,
                            price: item.price
                          })),
                          completedTransaction.total,
                          methodLabel(completedTransaction.paymentMethod),
                          extra,
                          `recibo_venda_${completedTransaction.id}.png`
                        );
                        triggerPushNotification('Baixando Recibo', 'O recibo PNG está sendo gerado e baixado.', 'success');
                      }}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-sans text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-indigo-100 transition-colors"
                    >
                      <Download size={14} /> Baixar Recibo PNG (Nota Fiscal)
                    </button>

                    {/* RECEIPT SHARER */}
                    {selectedClient ? (
                      <div className="w-full space-y-2">
                        <p className="text-xs text-gray-500 font-semibold">Compartilhe o recibo bem educado:</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const extra: string[] = [];
                              if (selectedClient) {
                                extra.push(`Cliente: ${selectedClient.name}`);
                                extra.push(`WhatsApp: ${selectedClient.phone}`);
                              }
                              if (completedTransaction.paymentMethod === 'prazo') {
                                extra.push(`Vencimento: ${formattedDueDateString}`);
                              }
                              
                              downloadReceiptAsPNG(
                                TENANT_CONFIG.SHORT_NAME,
                                'Cupom de Venda',
                                new Date(completedTransaction.timestamp).toLocaleString('pt-BR'),
                                completedTransaction.items.map(item => ({
                                  name: item.productName,
                                  qty: item.quantity,
                                  price: item.price
                                })),
                                completedTransaction.total,
                                methodLabel(completedTransaction.paymentMethod),
                                extra,
                                `recibo_venda_${completedTransaction.id}.png`
                              );
                              triggerPushNotification('Baixando Recibo', 'O recibo PNG está sendo gerado e baixado.', 'success');

                              const link = getWhatsAppReceiptLink(completedTransaction, selectedClient);
                              window.open(link, '_blank');
                            }}
                            className="flex-1 py-3 bg-[#25D366] hover:bg-[#128C7E] text-white font-sans text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                          >
                            <Send size={14} /> WhatsApp
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`Venda R$ ${completedTransaction.total.toFixed(2)} - ${TENANT_CONFIG.SHORT_NAME}`);
                              triggerPushNotification('Copiado!', 'Recibo copiado!', 'info');
                            }}
                            className="py-3 px-4 bg-white border border-gray-200 text-gray-700 font-sans text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 hover:bg-gray-50"
                          >
                            <Copy size={14} /> Copiar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">Cliente não associado. Sem envio de recibo.</p>
                    )}

                    <button
                      onClick={handleResetPDV}
                      className="w-full py-3.5 bg-[#1D4ED8] hover:bg-blue-800 text-white font-sans text-sm font-bold rounded-2xl flex items-center justify-center gap-1.5 shadow-lg"
                    >
                      Iniciar Nova Venda
                    </button>
                  </div>
                </div>
              )}

            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* BIOMETRICS SCANNER DIALOG OVERLAY */}
      {showBiometrics && (
        <BiometricsScanner 
          onClose={() => setShowBiometrics(false)} 
          clients={clients}
          onMatchClient={(client) => {
            setSelectedClient(client);
            setShowBiometrics(false);
            triggerPushNotification('Biometria Identificada', `Cliente "${client.name}" identificado via digital.`, 'success');
          }}
        />
      )}

      {/* CUSTOM CONFIRMATION FOR CLEAR CART */}
      <AnimatePresence>
        {showClearCartConfirm && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl border border-gray-100"
            >
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} />
              </div>
              <h4 className="font-sans font-extrabold text-gray-900 text-base mb-2">Esvaziar Cesta?</h4>
              <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                Tem certeza de que deseja remover todos os itens adicionados à sua cesta de compras? Esta operação não pode ser desfeita.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearCartConfirm(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    setCart([]);
                    setIsCartDrawerOpen(false);
                    setShowClearCartConfirm(false);
                  }}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors shadow-md shadow-red-150"
                >
                  Sim, Limpar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
