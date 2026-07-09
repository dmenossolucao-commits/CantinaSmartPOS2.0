/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Client, Transaction, Product } from '../types';
import { 
  DollarSign, Search, CalendarClock, MessageCircle, Send, 
  Copy, CheckCircle2, UserCheck, AlertTriangle, FileText, 
  User, Check, X, Bell, Clock, Trash2, HelpCircle, Download,
  QrCode, Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { downloadReceiptAsPNG } from '../utils/receipt';
import { generatePixPayload, getPixQRCodeUrl } from '../utils/pix';

interface OutstandingAccountsProps {
  clients: Client[];
  transactions: Transaction[];
  products: Product[];
  onCompleteSale: (transaction: Transaction, updatedClients: Client[], updatedProducts: Product[]) => void;
  triggerPushNotification: (title: string, body: string, type?: 'info' | 'success' | 'warn') => void;
  pixKey: string;
  onUpdatePixKey: (newKey: string) => void;
}

export default function OutstandingAccounts({
  clients,
  transactions,
  products,
  onCompleteSale,
  triggerPushNotification,
  pixKey,
  onUpdatePixKey
}: OutstandingAccountsProps) {
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDebtor, setSelectedDebtor] = useState<Client | null>(null);
  const [billingModalClient, setBillingModalClient] = useState<Client | null>(null);
  const [customPoliteMessage, setCustomPoliteMessage] = useState('');
  const [showBillingModal, setShowBillingModal] = useState(false);

  const [showPixConfig, setShowPixConfig] = useState(false);
  const [tempPixKey, setTempPixKey] = useState(pixKey);

  // Settlement (Baixa de Débito) states
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementMethod, setSettlementMethod] = useState<'pix' | 'dinheiro' | 'crédito' | 'débito'>('pix');
  const [showSettlementForm, setShowSettlementForm] = useState(false);

  // Helper to calculate days since the oldest unpaid "prazo" transaction
  const getDebtTimeline = (clientId: string) => {
    const clientTx = transactions.filter(t => t.clientId === clientId && t.paymentMethod === 'prazo');
    if (clientTx.length === 0) return { days: 0, oldestDate: null, newestDate: null };

    const timestamps = clientTx.map(t => new Date(t.timestamp).getTime());
    const oldestTimestamp = Math.min(...timestamps);
    const newestTimestamp = Math.max(...timestamps);

    const diffTime = Math.abs(Date.now() - oldestTimestamp);
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      days,
      oldestDate: new Date(oldestTimestamp).toLocaleDateString('pt-BR'),
      newestDate: new Date(newestTimestamp).toLocaleDateString('pt-BR')
    };
  };

  // Filter clients with negative balance (outstanding debts)
  const debtors = useMemo(() => {
    return clients
      .filter(c => c.balance < 0)
      .map(c => {
        const timeline = getDebtTimeline(c.id);
        return {
          ...c,
          debtTimeline: timeline
        };
      })
      .filter(c => {
        return c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
               c.classOrDept.toLowerCase().includes(searchTerm.toLowerCase());
      })
      .sort((a, b) => b.debtTimeline.days - a.debtTimeline.days); // Sort by oldest debt first
  }, [clients, transactions, searchTerm]);

  const statsTotalOutstanding = useMemo(() => {
    return clients.reduce((sum, c) => c.balance < 0 ? sum + Math.abs(c.balance) : sum, 0);
  }, [clients]);

  const statsOverdueCount = useMemo(() => {
    return clients.filter(c => c.balance < 0).length;
  }, [clients]);

  // Find active transactions with purchased products for selected debtor
  const selectedDebtorTransactions = useMemo(() => {
    if (!selectedDebtor) return [];
    return transactions.filter(t => t.clientId === selectedDebtor.id && t.paymentMethod === 'prazo' && t.status !== 'cancelado');
  }, [selectedDebtor, transactions]);

  // Combined ledger of all debtor movements: Purchases (to be paid) vs Payments (paid)
  const selectedDebtorMovements = useMemo(() => {
    if (!selectedDebtor) return [];

    const purchases = transactions
      .filter(t => t.clientId === selectedDebtor.id && t.paymentMethod === 'prazo' && t.status !== 'cancelado')
      .map(t => ({
        ...t,
        movementType: 'a_pagar' as const,
      }));

    const payments = transactions
      .filter(t => 
        t.clientId === selectedDebtor.id && 
        t.status !== 'cancelado' && 
        t.items.some(item => item.productId === 'settlement' || item.productId === 'recharge')
      )
      .map(t => ({
        ...t,
        movementType: 'pago' as const,
      }));

    return [...purchases, ...payments].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [selectedDebtor, transactions]);

  // Totals for summary
  const debtorSummaryTotals = useMemo(() => {
    if (!selectedDebtor) return { totalAPagar: 0, totalPago: 0 };

    const purchases = transactions
      .filter(t => t.clientId === selectedDebtor.id && t.paymentMethod === 'prazo' && t.status !== 'cancelado');
    const totalAPagar = purchases.reduce((sum, t) => sum + t.total, 0);

    const payments = transactions
      .filter(t => 
        t.clientId === selectedDebtor.id && 
        t.status !== 'cancelado' && 
        t.items.some(item => item.productId === 'settlement' || item.productId === 'recharge')
      );
    const totalPago = payments.reduce((sum, t) => sum + t.total, 0);

    return { totalAPagar, totalPago };
  }, [selectedDebtor, transactions]);

  // Generate highly polite collection text
  const generatePoliteBillingMessage = (client: Client) => {
    const absBal = Math.abs(client.balance);
    const clientTx = transactions.filter(t => t.clientId === client.id && t.paymentMethod === 'prazo' && t.status !== 'cancelado');
    
    let text = `Olá, *${client.name.split(' ')[0]}*! 😊\n\n`;
    text += `Segue o detalhamento das compras pendentes na *Cantina UDV*:\n\n`;
    
    let txTotals = 0;
    if (clientTx.length > 0) {
      text += `*🛍️ Produtos Comprados:*\n`;
      clientTx.forEach(tx => {
        const dateStr = new Date(tx.timestamp).toLocaleDateString('pt-BR');
        text += `• _${dateStr}_:\n`;
        tx.items.forEach(item => {
          text += `   - ${item.quantity}x ${item.productName} (R$ ${(item.price * item.quantity).toFixed(2)})\n`;
        });
        txTotals += tx.total;
      });
      text += `\n`;
    }
    
    const prevDebt = absBal - txTotals;
    if (prevDebt > 0.01) {
      text += `*Saldo Devedor Anterior:* R$ ${prevDebt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      text += `*Valor das Compras Detalhadas:* R$ ${txTotals.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
    }
    
    text += `*💰 TOTAL DO SALDO DEVEDOR: R$ ${absBal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n\n`;
    
    text += `Favor enviar o comprovante após a transferência para registrarmos a baixa. Muito obrigado! 🙏✨\n\n`;
    
    // Add Pix info at the absolute end, separated cleanly as requested
    const payload = generatePixPayload(pixKey, absBal);
    text += `🔑 *Chave Pix:* ${pixKey}\n\n`;
    text += `Segue logo abaixo nosso Pix Copia e Cola:\n\n`;
    text += `${payload}`;
    
    return text;
  };

  const handleOpenBillingModal = (client: Client) => {
    setBillingModalClient(client);
    setCustomPoliteMessage(generatePoliteBillingMessage(client));
    setShowBillingModal(true);
  };

  const handleSendBillingMessage = () => {
    if (!billingModalClient) return;
    const url = `https://api.whatsapp.com/send?phone=${billingModalClient.phone.replace(/[^0-9]/g, '')}&text=${encodeURIComponent(customPoliteMessage)}`;
    window.open(url, '_blank');
    setShowBillingModal(false);
    triggerPushNotification(
      'Notificação Compartilhada',
      `Mensagem de cobrança enviada para ${billingModalClient.name.split(' ')[0]} via WhatsApp.`,
      'success'
    );
  };

  const handleCopyBillingMessage = () => {
    navigator.clipboard.writeText(customPoliteMessage);
    triggerPushNotification('Copiado!', 'Mensagem copiada para a área de transferência.', 'info');
  };

  // Register payment (Baixa de débito)
  const handleRegisterSettlement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebtor) return;
    
    const amount = parseFloat(settlementAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      triggerPushNotification('Valor Inválido', 'Insira um valor válido maior que zero para registrar o acerto.', 'warn');
      return;
    }

    const currentDebt = Math.abs(selectedDebtor.balance);
    const updatedClients = clients.map(c => {
      if (c.id === selectedDebtor.id) {
        return {
          ...c,
          balance: c.balance + amount // reduces debt
        };
      }
      return c;
    });

    const methodDesc = settlementMethod === 'crédito' 
      ? 'CARTÃO DE CRÉDITO' 
      : settlementMethod === 'débito' 
        ? 'CARTÃO DE DÉBITO' 
        : settlementMethod.toUpperCase();

    const tx: Transaction = {
      id: 'tx_rec_' + Math.random().toString(36).substring(2, 9),
      clientId: selectedDebtor.id,
      clientName: selectedDebtor.name,
      items: [
        { 
          productId: 'settlement', 
          productName: `Acerto Parcial/Total de Conta a Prazo (${methodDesc})`, 
          price: amount, 
          quantity: 1 
        }
      ],
      total: amount,
      paymentMethod: settlementMethod,
      timestamp: new Date().toISOString(),
      status: 'concluido'
    };

    onCompleteSale(tx, updatedClients, products);
    
    triggerPushNotification(
      'Baixa Registrada!',
      `Pagamento de R$ ${amount.toFixed(2)} de ${selectedDebtor.name.split(' ')[0]} registrado com sucesso.`,
      'success'
    );

    setSettlementAmount('');
    setShowSettlementForm(false);
    setSelectedDebtor(null);
  };

  return (
    <div id="outstanding-accounts-container" className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full select-none">
      
      {/* LEFT COLUMN: STATISTICS & DEBTORS LIST */}
      <div className="lg:col-span-8 flex flex-col bg-white rounded-3xl border border-gray-150 shadow-glow-emerald overflow-hidden h-[calc(100vh-210px)]">
        
        {/* Header and Filter */}
        <div className="p-5 border-b border-gray-100 bg-gradient-to-b from-gray-50/50 to-white space-y-4 shrink-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="font-display font-bold text-gray-900 text-sm md:text-base flex items-center gap-2">
                <CalendarClock size={18} className="text-amber-500 animate-pulse" />
                Contas a Prazo & Cobrança
              </h2>
              <p className="text-[10px] text-gray-400 font-sans mt-0.5">Gerenciamento de débitos acumulados, prazos de vencimento e alertas</p>
            </div>
            
            {/* Warning Indicator */}
            {statsOverdueCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-mono px-3 py-1.5 rounded-xl flex items-center gap-2">
                <AlertTriangle size={12} className="text-amber-600 animate-bounce shrink-0" />
                <span><strong>{statsOverdueCount} clientes</strong> devendo • Total: <strong>R$ {statsTotalOutstanding.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Search size={14} />
              </span>
              <input
                id="debtor-search-input"
                type="text"
                placeholder="Buscar devedor por nome, turma ou setor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50/50 border border-gray-200 hover:border-gray-300 focus:bg-white rounded-xl font-sans text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setShowPixConfig(!showPixConfig);
                setTempPixKey(pixKey);
              }}
              className="px-3.5 py-2 border border-gray-200 hover:border-blue-500 bg-white hover:bg-blue-50/10 text-gray-750 font-sans text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <Settings size={14} className="text-gray-500" />
              Chave Pix Cantina
            </button>
          </div>

          {/* Pix Key Config Dropdown Box */}
          <AnimatePresence>
            {showPixConfig && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 border border-blue-100 bg-blue-50/10 rounded-xl space-y-3 mt-1 shadow-inner">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-blue-900 flex items-center gap-1">
                      <Settings size={14} /> Chave Pix da Cantina UDV
                    </h4>
                    <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full uppercase">Configuração</span>
                  </div>
                  
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ex: pix@udvcantina.com ou celular/CNPJ"
                      value={tempPixKey}
                      onChange={(e) => setTempPixKey(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-white border border-gray-200 focus:border-blue-500 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        onUpdatePixKey(tempPixKey);
                        setShowPixConfig(false);
                        triggerPushNotification('Chave Pix Atualizada', `A chave Pix da Cantina foi definida para "${tempPixKey}"`, 'success');
                      }}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      Salvar
                    </button>
                  </div>
                  <p className="text-[9px] text-gray-400">Esta chave será utilizada para gerar os QR Codes e Copia e Cola em toda a aplicação.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Debtors List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-gray-50/20 scrollbar-thin">
          {debtors.length === 0 ? (
            <div className="h-60 flex flex-col items-center justify-center text-center">
              <CheckCircle2 size={40} className="text-emerald-500 mb-2" />
              <p className="text-xs text-gray-600 font-sans font-bold">Excelente! Ninguém devendo!</p>
              <p className="text-[10px] text-gray-400 font-sans mt-1">Todos os clientes estão com as contas em dia.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {debtors.map(client => {
                const isSelected = selectedDebtor?.id === client.id;
                const timeline = client.debtTimeline;
                
                // Color coding for debt age
                const timelineBadgeColor = timeline.days > 30 
                  ? 'bg-red-50 text-red-700 border-red-200' 
                  : timeline.days > 15 
                    ? 'bg-amber-50 text-amber-700 border-amber-200' 
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200';

                return (
                  <div
                    key={client.id}
                    id={`debtor-card-${client.id}`}
                    onClick={() => {
                      setSelectedDebtor(client);
                      setSettlementAmount(Math.abs(client.balance).toFixed(2));
                      setShowSettlementForm(true);
                    }}
                    className={`border rounded-2xl p-4 transition-all flex flex-col justify-between cursor-pointer ${
                      isSelected 
                        ? 'border-amber-400 bg-amber-50/10 shadow-md ring-2 ring-amber-400/10' 
                        : 'border-gray-150 bg-white hover:border-amber-300 hover:shadow-sm hover:bg-amber-50/5'
                    }`}
                  >
                    <div>
                      {/* Top Header Card */}
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center font-sans font-black text-xs">
                            {client.name.substring(0,2).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-sans font-bold text-gray-800 text-xs leading-tight">{client.name}</h4>
                            <p className="text-[9px] text-gray-400 font-mono mt-0.5">
                              {client.classOrDept} • {client.type === 'aluno' ? 'Aluno' : 'Colab.'}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-mono font-black text-red-600 block">
                            R$ {Math.abs(client.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[8px] text-gray-400 font-sans">limite: R$ {client.creditLimit.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Debt Timeline Details */}
                      <div className="bg-gray-50 rounded-xl p-2.5 mt-2 space-y-1.5 text-[10px] font-mono text-gray-500 border border-gray-100">
                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-1">
                            <Clock size={11} className="text-gray-400" />
                            Tempo devendo:
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${timelineBadgeColor}`}>
                            {timeline.days} dias ({timeline.days > 1 ? 'Atrasado' : 'Recente'})
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Primeira compra:</span>
                          <span className="font-bold text-gray-700">{timeline.oldestDate || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Última compra:</span>
                          <span className="font-bold text-gray-700">{timeline.newestDate || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons footer */}
                    <div className="mt-4 pt-3 border-t border-gray-100 flex gap-2">
                      <button
                        id={`btn-cobrar-${client.id}`}
                        onClick={() => handleOpenBillingModal(client)}
                        className="flex-1 py-1.5 px-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-sans text-[10px] font-bold rounded-xl flex items-center justify-center gap-1 shadow-sm transition-all"
                      >
                        <MessageCircle size={12} />
                        Enviar Recibo
                      </button>

                      <button
                        id={`btn-quitar-${client.id}`}
                        onClick={() => {
                          setSelectedDebtor(client);
                          setSettlementAmount(Math.abs(client.balance).toFixed(2));
                          setShowSettlementForm(true);
                        }}
                        className="py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-white font-sans text-[10px] font-bold rounded-xl flex items-center justify-center gap-1 transition-all"
                      >
                        <DollarSign size={12} />
                        Dar Baixa
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: MANUAL SETTLEMENT & PURCHASE HISTORY */}
      <div className="lg:col-span-4 flex flex-col bg-white rounded-3xl border border-gray-150 shadow-glow-emerald overflow-hidden h-full min-h-[500px]">
        
        <AnimatePresence mode="wait">
          {!showSettlementForm || !selectedDebtor ? (
            <motion.div
              key="settlement-idle"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="p-5 flex flex-col items-center justify-center text-center h-full space-y-4 my-auto"
            >
              <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-500 flex items-center justify-center border border-amber-100 shadow-sm animate-heart-pulse">
                <DollarSign size={32} />
              </div>
              <h3 className="font-display font-bold text-gray-800 text-sm">Histórico Devedor e Baixa</h3>
              <p className="text-xs text-gray-400 font-sans leading-relaxed max-w-xs">
                Selecione um dos clientes devendo à esquerda clicando em seu cartão para visualizar o <strong>histórico de produtos comprados</strong> e realizar a baixa do débito.
              </p>
            </motion.div>
          ) : (
            <motion.form
              key="settlement-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleRegisterSettlement}
              className="p-5 flex flex-col h-full justify-between space-y-5 overflow-y-auto"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                  <h3 className="font-display font-bold text-gray-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <UserCheck size={16} className="text-amber-500" />
                    Conta Detalhada
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowSettlementForm(false)}
                    className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-full transition-colors"
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Selected Debtor Summary Card */}
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 flex items-center justify-between">
                  <div>
                    <h4 className="font-sans font-bold text-xs text-amber-950">{selectedDebtor.name}</h4>
                    <p className="text-[9px] text-amber-800 font-mono">{selectedDebtor.classOrDept} • {selectedDebtor.type === 'aluno' ? 'Aluno' : 'Colab.'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono font-bold text-red-600">
                      Débito: R$ {Math.abs(selectedDebtor.balance).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Summary of Totals */}
                <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-sans">
                  <div className="bg-red-50/50 border border-red-100 rounded-xl p-2 flex flex-col justify-center">
                    <span className="text-gray-400 block font-bold uppercase tracking-wider text-[8px]">Total a Pagar</span>
                    <span className="text-red-700 font-mono font-bold text-xs mt-0.5">
                      R$ {debtorSummaryTotals.totalAPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-2 flex flex-col justify-center">
                    <span className="text-gray-400 block font-bold uppercase tracking-wider text-[8px]">Total Pago (Acertos)</span>
                    <span className="text-emerald-700 font-mono font-bold text-xs mt-0.5">
                      R$ {debtorSummaryTotals.totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* HISTÓRICO DETALHADO (A PAGAR VS PAGO) */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-sans font-bold text-gray-400 uppercase tracking-wide block flex justify-between">
                    <span>Extrato Detalhado da Conta</span>
                    <span className="text-gray-500 font-mono text-[9px] lowercase font-normal">
                      {selectedDebtorMovements.length} movimentos
                    </span>
                  </h4>
                  {selectedDebtorMovements.length === 0 ? (
                    <div className="text-center p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <p className="text-[10px] text-gray-400 font-sans italic">
                        Nenhuma movimentação registrada.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto divide-y divide-gray-100 pr-1 border border-gray-100 rounded-xl p-2 bg-gray-50/50">
                      {selectedDebtorMovements.map(m => {
                        const isAPagar = m.movementType === 'a_pagar';
                        return (
                          <div key={m.id} className="pt-2 first:pt-0 text-[11px] font-sans">
                            <div className="flex justify-between items-center font-mono text-[9px] text-gray-400">
                              <span>{new Date(m.timestamp).toLocaleString('pt-BR')}</span>
                              <span className={`font-bold px-1.5 py-0.5 rounded text-[8px] uppercase ${
                                isAPagar 
                                  ? 'bg-red-50 text-red-700' 
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}>
                                {isAPagar ? 'A Pagar' : 'Pago'}
                              </span>
                            </div>
                            <div className="flex justify-between items-start gap-2 mt-1">
                              <div className="text-gray-750 font-medium leading-snug">
                                {isAPagar 
                                  ? m.items.map(item => `${item.quantity}x ${item.productName}`).join(', ')
                                  : m.items[0]?.productName || 'Pagamento Recebido'
                                }
                              </div>
                              <span className={`font-bold font-mono shrink-0 ${isAPagar ? 'text-red-600' : 'text-emerald-600'}`}>
                                {isAPagar ? '-' : '+'} R$ {m.total.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Amount input */}
                <div className="space-y-1.5 pt-2 border-t border-gray-100">
                  <label className="text-[10px] font-sans font-bold text-gray-500 uppercase tracking-wide block">
                    Registrar Pagamento (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-500 font-mono text-xs font-bold">
                      R$
                    </span>
                    <input
                      id="settlement-amount-input"
                      type="text"
                      placeholder="0,00"
                      value={settlementAmount}
                      onChange={(e) => setSettlementAmount(e.target.value)}
                      required
                      className="w-full pl-9 pr-4 py-2 bg-gray-50/50 border border-gray-200 rounded-xl font-mono text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {/* Settlement Method Selector */}
                <div className="space-y-2">
                  <label className="text-[10px] font-sans font-bold text-gray-500 uppercase tracking-wide block">
                    Meio de Recebimento
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSettlementMethod('pix')}
                      className={`py-1.5 px-3 rounded-xl font-sans text-[11px] font-bold border transition-all flex items-center justify-center gap-1.5 ${
                        settlementMethod === 'pix'
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-800 shadow-sm'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Pix
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettlementMethod('dinheiro')}
                      className={`py-1.5 px-3 rounded-xl font-sans text-[11px] font-bold border transition-all flex items-center justify-center gap-1.5 ${
                        settlementMethod === 'dinheiro'
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-800 shadow-sm'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      Dinheiro
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettlementMethod('crédito')}
                      className={`py-1.5 px-3 rounded-xl font-sans text-[11px] font-bold border transition-all flex items-center justify-center gap-1.5 ${
                        settlementMethod === 'crédito'
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-800 shadow-sm'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      C. Crédito
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettlementMethod('débito')}
                      className={`py-1.5 px-3 rounded-xl font-sans text-[11px] font-bold border transition-all flex items-center justify-center gap-1.5 ${
                        settlementMethod === 'débito'
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-800 shadow-sm'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                      C. Débito
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-sans text-xs font-bold rounded-2xl flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg transition-all"
              >
                <Check size={14} />
                Confirmar Baixa de Débito
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {/* POLITE MESSAGE PREVIEW & WHATSAPP MODAL */}
      <AnimatePresence>
        {showBillingModal && billingModalClient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBillingModal(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-lg w-full overflow-hidden z-10 flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center shrink-0">
                <div>
                  <h3 className="font-display font-bold text-gray-900 text-sm md:text-base flex items-center gap-2">
                    <MessageCircle size={18} className="text-emerald-500" />
                    Recibo de Cobrança Educado
                  </h3>
                  <p className="text-[10px] text-gray-400 font-sans mt-0.5">
                    Notifique o cliente via WhatsApp com uma mensagem gentil e profissional
                  </p>
                </div>
                <button
                  onClick={() => setShowBillingModal(false)}
                  className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-full transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Message Preview Textarea */}
              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-3.5 flex items-center justify-between">
                  <div>
                    <h4 className="font-sans font-bold text-xs text-gray-950">{billingModalClient.name}</h4>
                    <p className="text-[9px] text-gray-500 font-mono">WhatsApp: {billingModalClient.phone}</p>
                  </div>
                  <span className="text-xs font-mono font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-lg border border-red-100">
                    Débito: R$ {Math.abs(billingModalClient.balance).toFixed(2)}
                  </span>
                </div>

                {/* REAL SCANNING DEBTOR PIX QR CODE DISPLAY */}
                <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
                    <div className="flex-1 space-y-1.5 text-center sm:text-left">
                      <span className="text-[10px] text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider font-sans">
                        QR Code Pix para Cobrança
                      </span>
                      <p className="text-[11px] text-gray-500 leading-relaxed font-sans">
                        Este QR Code foi gerado especificamente para o valor total do débito de <strong>R$ {Math.abs(billingModalClient.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> usando a chave Pix da Cantina.
                      </p>
                    </div>
                    <div className="bg-white border-2 border-dashed border-teal-200 p-2 rounded-2xl shrink-0 shadow-inner">
                      <img
                        src={getPixQRCodeUrl(generatePixPayload(pixKey, Math.abs(billingModalClient.balance)))}
                        alt="Pix Cobrança QR Code"
                        className="w-24 h-24 object-contain mx-auto"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-gray-150 space-y-2.5 text-left">
                    <div className="space-y-1">
                      <span className="text-[9px] text-gray-400 block font-bold uppercase">Chave Pix da Cantina</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={pixKey}
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                          className="flex-1 bg-gray-50 border border-gray-250 rounded-lg px-2.5 py-1 text-xs font-mono text-gray-800 select-all focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(pixKey);
                            triggerPushNotification('Copiado!', 'Chave Pix copiada!', 'success');
                          }}
                          className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold rounded-lg text-[10px] shrink-0 border border-teal-100 flex items-center gap-1"
                        >
                          <Copy size={11} /> Copiar
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] text-gray-400 block font-bold uppercase">Código Copia e Cola</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={generatePixPayload(pixKey, Math.abs(billingModalClient.balance))}
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                          className="flex-1 bg-gray-50 border border-gray-250 rounded-lg px-2.5 py-1 text-xs font-mono text-gray-800 select-all focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const payload = generatePixPayload(pixKey, Math.abs(billingModalClient.balance));
                            navigator.clipboard.writeText(payload);
                            triggerPushNotification('Copiado!', 'Código Copia e Cola copiado!', 'success');
                          }}
                          className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold rounded-lg text-[10px] shrink-0 border border-teal-100 flex items-center gap-1"
                        >
                          <Copy size={11} /> Copiar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-sans font-bold text-gray-500 uppercase tracking-wide block">
                    Mensagem de Cobrança (Edite se necessário)
                  </label>
                  <textarea
                    id="billing-message-editor"
                    rows={10}
                    value={customPoliteMessage}
                    onChange={(e) => setCustomPoliteMessage(e.target.value)}
                    className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-2xl font-sans text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all resize-none leading-relaxed"
                  />
                </div>
              </div>

              {/* Action buttons footer */}
              <div className="p-5 border-t border-gray-150 bg-gray-50/50 flex flex-col sm:flex-row gap-3 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyBillingMessage}
                  className="w-full sm:w-auto py-2.5 px-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-sans text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-colors"
                >
                  <Copy size={13} />
                  Copiar Texto
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const recentTxs = transactions.filter(tx => tx.clientId === billingModalClient.id && tx.paymentMethod === 'prazo');
                    const itemsToDraw = recentTxs.flatMap(tx => tx.items.map(item => ({
                      name: item.productName,
                      qty: item.quantity,
                      price: item.price
                    })));

                    downloadReceiptAsPNG(
                      'Cantina UDV',
                      'Nota de Cobrança',
                      new Date().toLocaleString('pt-BR'),
                      itemsToDraw,
                      Math.abs(billingModalClient.balance),
                      'Prazo (Carteira)',
                      [
                        `Cliente: ${billingModalClient.name}`,
                        `WhatsApp: ${billingModalClient.phone}`,
                        `Chave Pix: ${pixKey}`,
                        `Status: Saldo Pendente`
                      ],
                      `nota_cobranca_${billingModalClient.id}.png`
                    );
                    triggerPushNotification('Baixando Recibo', 'O recibo de cobrança PNG está sendo baixado.', 'success');
                  }}
                  className="w-full sm:w-auto py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-sans text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-colors"
                >
                  <Download size={13} />
                  Baixar Recibo PNG
                </button>

                <button
                  type="button"
                  onClick={handleSendBillingMessage}
                  className="flex-1 py-2.5 px-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-sans text-xs font-bold rounded-xl flex items-center justify-center gap-1 shadow-md hover:shadow-lg transition-all"
                >
                  <Send size={13} />
                  Enviar WhatsApp
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
