/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Client, Transaction, NotificationLog } from '../types';
import { 
  Users, Search, UserPlus, Phone, Mail, Award, Landmark, Plus, 
  History, Send, Trash2, Edit2, AlertCircle, CheckCircle, RefreshCw, X, MessageSquare, LandmarkIcon,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { downloadReceiptAsPNG } from '../utils/receipt';

interface ClientManagerProps {
  clients: Client[];
  transactions: Transaction[];
  onAddClient: (client: Client) => void;
  onUpdateClient: (client: Client) => void;
  onDeleteClient: (clientId: string) => void;
  onLogNotification: (log: NotificationLog) => void;
  onCancelSale?: (txId: string) => void;
  onDeleteSale?: (txId: string) => void;
  onAddTransaction?: (tx: Transaction) => void;
  onZeroClients?: () => void;
}

export default function ClientManager({ 
  clients, 
  transactions, 
  onAddClient, 
  onUpdateClient, 
  onDeleteClient,
  onLogNotification,
  onCancelSale,
  onDeleteSale,
  onAddTransaction,
  onZeroClients
}: ClientManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeClientId, setActiveClientId] = useState<string | null>(clients[0]?.id || null);

  const activeClient = useMemo(() => {
    return clients.find(c => c.id === activeClientId) || clients[0] || null;
  }, [clients, activeClientId]);

  // Form states
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formType, setFormType] = useState<'aluno' | 'colaborador'>('aluno');
  const [formClassOrDept, setFormClassOrDept] = useState('');
  const [formLimit, setFormLimit] = useState(150);
  const [formBiometric, setFormBiometric] = useState(false);

  // Add credits / pay debt state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'dinheiro' | 'pix' | 'cartão'>('pix');

  // Delete confirm modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Filter clients
  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            c.phone.includes(searchTerm);
      return matchesSearch;
    });
  }, [clients, searchTerm]);

  // Client transactions
  const clientTransactions = useMemo(() => {
    if (!activeClient) return [];
    return transactions
      .filter(t => t.clientId === activeClient.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activeClient, transactions]);

  // Handle Client Form Submit (Create or Update)
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formPhone) {
      alert('Por favor, preencha nome e telefone para contato.');
      return;
    }

    if (editingClient) {
      // Update
      const updated: Client = {
        ...editingClient,
        name: formName,
        email: formEmail,
        phone: formPhone,
        biometricRegistered: formBiometric
      };
      onUpdateClient(updated);
    } else {
      // Create
      const newC: Client = {
        id: 'c_' + Math.random().toString(36).substring(2, 9),
        name: formName,
        email: formEmail,
        phone: formPhone,
        type: 'aluno',
        classOrDept: 'Geral',
        balance: 0.0, // Starts at 0
        creditLimit: 9999,
        biometricRegistered: formBiometric
      };
      onAddClient(newC);
      setActiveClientId(newC.id);
    }

    setShowFormModal(false);
    resetForm();
  };

  const handleEditClick = (client: Client) => {
    setEditingClient(client);
    setFormName(client.name);
    setFormEmail(client.email);
    setFormPhone(client.phone);
    setFormType(client.type);
    setFormClassOrDept(client.classOrDept);
    setFormLimit(client.creditLimit);
    setFormBiometric(client.biometricRegistered);
    setShowFormModal(true);
  };

  const handleCreateClick = () => {
    setEditingClient(null);
    resetForm();
    setShowFormModal(true);
  };

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormType('aluno');
    setFormClassOrDept('');
    setFormLimit(150);
    setFormBiometric(false);
  };

  // Recharge credits or settle debt
  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClient) return;

    const amt = parseFloat(paymentAmount.replace(',', '.'));
    if (isNaN(amt) || amt <= 0) {
      alert('Insira um valor válido e maior que zero.');
      return;
    }

    // Update balance
    // Pre-paid balance goes up. Debt settles.
    // e.g. balance was -50. Add 50, becomes 0. Add 70, becomes +20.
    const updatedClient: Client = {
      ...activeClient,
      balance: activeClient.balance + amt
    };

    onUpdateClient(updatedClient);
    setShowPaymentModal(false);
    setPaymentAmount('');

    // Log Transaction for ledger history
    const txMethod = paymentMethod === 'cartão' ? 'crédito' : paymentMethod;
    const tx: Transaction = {
      id: 'tx_rec_' + Math.random().toString(36).substring(2, 9),
      clientId: activeClient.id,
      clientName: activeClient.name,
      items: [
        { 
          productId: 'recharge', 
          productName: `Pagamento / Recarga de Crédito (${paymentMethod.toUpperCase()})`, 
          price: amt, 
          quantity: 1 
        }
      ],
      total: amt,
      paymentMethod: txMethod,
      timestamp: new Date().toISOString(),
      status: 'concluido'
    };
    if (onAddTransaction) {
      onAddTransaction(tx);
    }

    // Log Notification log
    const notifLog: NotificationLog = {
      id: 'n_' + Math.random().toString(36).substring(2, 9),
      clientId: activeClient.id,
      clientName: activeClient.name,
      type: 'saldo_atualizado',
      channel: 'whatsapp',
      message: `Recarga de R$ ${amt.toFixed(2)} recebida via ${paymentMethod.toUpperCase()}. Seu saldo atual é R$ ${updatedClient.balance.toFixed(2)}.`,
      timestamp: new Date().toISOString(),
      status: 'enviado'
    };
    onLogNotification(notifLog);

    alert(`Sucesso! Saldo de ${activeClient.name} atualizado.\nNovo Saldo: R$ ${updatedClient.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  };

  const handleDeleteClick = (clientId: string) => {
    setShowDeleteConfirm(clientId);
  };

  // Generate WhatsApp billing reminder with purchased items
  const getWhatsAppBillingLink = (client: Client) => {
    const debtAmt = Math.abs(client.balance).toFixed(2);
    
    // Find up to 5 recent unpaid/prazo transactions for this client to list the items bought
    const recentPrazoTxs = transactions
      .filter(t => t.clientId === client.id && t.paymentMethod === 'prazo' && t.status !== 'cancelado')
      .slice(0, 5);
      
    let itemsText = '';
    if (recentPrazoTxs.length > 0) {
      itemsText = `*Últimas Compras a Prazo:*\n`;
      recentPrazoTxs.forEach(tx => {
        const dateStr = new Date(tx.timestamp).toLocaleDateString('pt-BR');
        const itemsList = tx.items.map(i => `${i.quantity}x ${i.productName}`).join(', ');
        itemsText += `• ${dateStr}: ${itemsList} (R$ ${tx.total.toFixed(2)})\n`;
      });
    }

    const text = `Olá, ${client.name.split(' ')[0]}!\n\n` +
      `Segue o extrato pendente da sua conta na *Cantina UDV*:\n` +
      `---------------------------------\n` +
      `*Saldo Devedor:* R$ ${debtAmt}\n` +
      `---------------------------------\n` +
      (itemsText ? itemsText + `---------------------------------\n` : '') +
      `Chave Pix: *pix@udvcantina.com*\n\n` +
      `_(O extrato detalhado em formato de imagem PNG foi gerado no seu dispositivo. Por favor, envie o comprovante por aqui. Obrigado! 😊)_`;

    return `https://api.whatsapp.com/send?phone=${client.phone.replace(/[^0-9]/g, '')}&text=${encodeURIComponent(text)}`;
  };

  // Generate automated invoice sending simulator
  const simulateSendInvoice = (client: Client, channel: 'email' | 'whatsapp') => {
    const debtAmt = Math.abs(client.balance).toFixed(2);
    const msg = `Fatura Mensal enviada por ${channel.toUpperCase()}! Saldo Devedor: R$ ${debtAmt}. Notificação gerada com sucesso.`;
    
    const log: NotificationLog = {
      id: 'n_' + Math.random().toString(36).substring(2, 9),
      clientId: client.id,
      clientName: client.name,
      type: 'fatura',
      channel: channel,
      message: `Fatura de fechamento enviada com saldo de R$ ${debtAmt}. Link Pix incluído.`,
      timestamp: new Date().toISOString(),
      status: 'enviado'
    };
    onLogNotification(log);
    alert(msg);
  };

  return (
    <div id="client-manager-root" className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)] select-none">
      
      {/* Client List - Left Side */}
      <div className="lg:col-span-5 flex flex-col bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden h-full">
        
        {/* Header Search & Create */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-sans font-bold text-gray-800 text-base flex items-center gap-2">
              <Users size={18} className="text-emerald-600" />
              Gestão de Clientes (Contas)
            </h2>
            <div className="flex gap-2">
              {onZeroClients && (
                <button
                  id="zero-clients-btn"
                  onClick={() => {
                    const password = prompt('Digite a senha administrativa para ZERAR o saldo de todos os clientes:');
                    if (password === 'admin123') {
                      if (confirm('ATENÇÃO: Deseja realmente ZERAR o saldo/dívida de TODOS os clientes? Esta ação não pode ser desfeita.')) {
                        onZeroClients();
                      }
                    } else if (password !== null) {
                      alert('Senha incorreta! Operação cancelada.');
                    }
                  }}
                  className="py-1.5 px-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-xl text-xs font-sans font-bold transition-colors flex items-center gap-1 shadow-sm font-sans"
                  title="Zerar o saldo de todos os clientes"
                >
                  <Trash2 size={13} /> Zerar Saldos
                </button>
              )}
              <button
                id="create-client-btn"
                onClick={handleCreateClick}
                className="py-1.5 px-3 bg-emerald-600 text-white rounded-xl text-xs font-sans font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-sm shadow-emerald-100"
              >
                <UserPlus size={14} /> Novo Cliente
              </button>
            </div>
          </div>

           {/* Search Inputs */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
              <Search size={15} />
            </span>
            <input
              id="search-client-input"
              type="text"
              placeholder="Buscar por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-white border border-gray-200 rounded-xl font-sans text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* List scroll */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50 bg-gray-50/20">
          {filteredClients.length === 0 ? (
            <div className="p-12 text-center">
              <Users size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400 font-sans">Nenhum cliente correspondente.</p>
            </div>
          ) : (
            filteredClients.map(client => (
              <button
                key={client.id}
                id={`client-list-item-${client.id}`}
                onClick={() => setActiveClientId(client.id)}
                className={`w-full text-left p-3.5 flex items-center justify-between border-l-4 transition-all hover:bg-gray-50 ${
                  activeClient?.id === client.id 
                    ? 'bg-emerald-50/40 border-emerald-500' 
                    : 'border-transparent'
                }`}
              >
                <div className="min-w-0 pr-3">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-sans font-bold text-xs text-gray-800 truncate">
                      {client.name}
                    </h4>
                    {client.biometricRegistered && (
                      <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1 rounded font-mono" title="Biometria Ativa">
                        Bio
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 font-sans mt-0.5 truncate">
                    {client.phone}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className={`font-mono font-bold text-xs block ${
                    client.balance < 0 ? 'text-red-600' : client.balance > 0 ? 'text-emerald-600' : 'text-gray-500'
                  }`}>
                    {client.balance < 0 ? '-' : ''}R$ {Math.abs(client.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Client Detail View - Right Side */}
      <div className="lg:col-span-7 flex flex-col bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden h-full">
        {activeClient ? (
          <div className="flex flex-col h-full overflow-hidden">
            
            {/* Detail Header Summary */}
            <div className="p-5 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-sans font-black text-lg shadow-md shadow-emerald-200">
                  {activeClient.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-sans font-bold text-gray-900 text-base leading-tight">
                    {activeClient.name}
                  </h3>
                  <div className="flex gap-3 text-[10px] text-gray-500 font-sans mt-2">
                    <span className="flex items-center gap-1"><Phone size={12} /> {activeClient.phone}</span>
                    <span className="flex items-center gap-1"><Mail size={12} /> {activeClient.email || 'Não informado'}</span>
                  </div>
                </div>
              </div>

              {/* Edit / Delete triggers */}
              <div className="flex gap-1.5 self-end md:self-center">
                <button
                  id={`edit-client-btn-${activeClient.id}`}
                  onClick={() => handleEditClick(activeClient)}
                  className="p-2 bg-white hover:bg-gray-100 border border-gray-200 text-gray-600 rounded-lg hover:text-gray-800 transition-colors"
                  title="Editar dados"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  id={`delete-client-btn-${activeClient.id}`}
                  onClick={() => handleDeleteClick(activeClient.id)}
                  className="p-2 bg-white hover:bg-red-50 border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-100 rounded-lg transition-colors"
                  title="Excluir cadastro"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Financial Ledger Balance Cards */}
            <div className="p-5 border-b border-gray-100">
              {/* Debt / Credit Card */}
              <div className="p-5 rounded-2xl border border-gray-150 bg-white shadow-inner flex flex-col justify-between w-full">
                <span className="text-[11px] text-gray-400 font-mono uppercase font-black tracking-wider">
                  {activeClient.balance < 0 ? 'Saldo Devedor' : 'Saldo Pré-pago'}
                </span>
                <span className={`text-2xl font-mono font-black block mt-2 ${
                  activeClient.balance < 0 ? 'text-red-600' : activeClient.balance > 0 ? 'text-emerald-600' : 'text-gray-700'
                }`}>
                  R$ {Math.abs(activeClient.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-gray-500 font-sans block mt-1.5 leading-normal">
                  {activeClient.balance < 0 
                    ? 'Valor pendente de pagamento para a cantina.' 
                    : activeClient.balance > 0 
                      ? 'Créditos acumulados disponíveis para consumo.' 
                      : 'Sem pendências financeiras no momento.'}
                </span>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-sans font-bold text-gray-400 uppercase tracking-wider pr-1">Ações:</span>
              
              <button
                id="add-credit-modal-btn"
                onClick={() => setShowPaymentModal(true)}
                className="py-1.5 px-3 bg-emerald-600 text-white rounded-lg text-xs font-sans font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-sm shadow-emerald-100"
              >
                <Plus size={14} /> Receber Pagamento / Adicionar Crédito
              </button>

              {activeClient.balance < 0 && (
                <>
                  <button
                    id={`whatsapp-charge-btn-${activeClient.id}`}
                    onClick={() => {
                      const recentTxs = clientTransactions.filter(tx => tx.paymentMethod === 'prazo');
                      const itemsToDraw = recentTxs.flatMap(tx => tx.items.map(item => ({
                        name: item.productName,
                        qty: item.quantity,
                        price: item.price
                      })));

                      downloadReceiptAsPNG(
                        'Cantina UDV',
                        'Extrato de Débito',
                        new Date().toLocaleString('pt-BR'),
                        itemsToDraw,
                        Math.abs(activeClient.balance),
                        'Prazo (Carteira)',
                        [
                          `Cliente: ${activeClient.name}`,
                          `Chave Pix: pix@udvcantina.com`,
                          `Status: Saldo Pendente`
                        ],
                        `extrato_${activeClient.id}.png`
                      );

                      const link = getWhatsAppBillingLink(activeClient);
                      window.open(link, '_blank');
                    }}
                    className="py-1.5 px-3 bg-[#25D366] hover:bg-[#20ba5a] text-white rounded-lg text-xs font-sans font-semibold transition-colors flex items-center gap-1"
                  >
                    <MessageSquare size={13} /> Cobrar via WhatsApp
                  </button>
                  <button
                    onClick={() => {
                      const recentTxs = clientTransactions.filter(tx => tx.paymentMethod === 'prazo');
                      const itemsToDraw = recentTxs.flatMap(tx => tx.items.map(item => ({
                        name: item.productName,
                        qty: item.quantity,
                        price: item.price
                      })));

                      downloadReceiptAsPNG(
                        'Cantina UDV',
                        'Extrato de Débito',
                        new Date().toLocaleString('pt-BR'),
                        itemsToDraw,
                        Math.abs(activeClient.balance),
                        'Prazo (Carteira)',
                        [
                          `Cliente: ${activeClient.name}`,
                          `Chave Pix: pix@udvcantina.com`,
                          `Status: Saldo Pendente`
                        ],
                        `extrato_${activeClient.id}.png`
                      );
                    }}
                    className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-sans font-semibold transition-colors flex items-center gap-1"
                  >
                    <Download size={13} /> Extrato PNG (Nota)
                  </button>
                </>
              )}

              <button
                id={`send-email-invoice-${activeClient.id}`}
                onClick={() => simulateSendInvoice(activeClient, 'email')}
                className="py-1.5 px-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-sans font-semibold transition-colors flex items-center gap-1"
              >
                <Mail size={13} /> Fatura por E-mail
              </button>
            </div>

            {/* Statement Ledger History list */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <h4 className="font-sans font-bold text-xs text-gray-700 flex items-center gap-1.5 border-b pb-2">
                <History size={14} className="text-gray-400" />
                Histórico Recente de Consumo e Lançamentos
              </h4>

              {clientTransactions.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400 font-sans">
                  Nenhuma transação registrada para este cliente.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {clientTransactions.map(tx => {
                    const isRecharge = tx.items.some(i => i.productId === 'recharge');
                    return (
                      <div 
                        key={tx.id}
                        id={`client-statement-tx-${tx.id}`}
                        className={`border rounded-xl p-3 hover:bg-gray-50/50 transition-all flex justify-between items-start ${
                          isRecharge 
                            ? 'border-emerald-150 bg-emerald-50/20 shadow-sm shadow-emerald-50/50' 
                            : 'border-gray-100 bg-white'
                        }`}
                      >
                        <div className="space-y-1">
                          <span className="text-[10px] text-gray-400 font-mono">
                            {new Date(tx.timestamp).toLocaleString('pt-BR', {
                              day: '2-digit', month: '2-digit', year: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                          
                          {/* Items listed */}
                          <div className="space-y-0.5">
                            {tx.items.map((item, index) => (
                              <p key={index} className="text-xs text-gray-800 font-sans">
                                {isRecharge ? (
                                  <span className="font-semibold text-emerald-800">{item.productName}</span>
                                ) : (
                                  <>
                                    <strong>{item.quantity}x</strong> {item.productName}
                                  </>
                                )}
                              </p>
                            ))}
                          </div>
  
                          <span className={`inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase mt-1 ${
                            isRecharge ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {isRecharge ? 'Aporte de Crédito' : `Pagamento: ${tx.paymentMethod.toUpperCase()}`}
                          </span>
                        </div>
  
                        <div className="text-right">
                          <span className={`font-mono font-bold text-xs block ${
                            tx.status === 'cancelado' 
                              ? 'text-gray-400 line-through' 
                              : isRecharge 
                                ? 'text-emerald-600' 
                                : 'text-gray-900'
                          }`}>
                            {isRecharge && tx.status !== 'cancelado' ? '+' : ''} R$ {tx.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                          <span className={`text-[10px] font-sans block ${
                            tx.status === 'cancelado' 
                              ? 'text-red-500 font-bold' 
                              : isRecharge 
                                ? 'text-emerald-600 font-semibold'
                                : tx.status === 'concluido' 
                                  ? 'text-emerald-600' 
                                  : 'text-amber-500'
                          }`}>
                            {tx.status === 'cancelado' 
                              ? '✗ Cancelada' 
                              : isRecharge 
                                ? '✓ Creditado'
                                : tx.status === 'concluido' 
                                  ? '✓ Aprovado' 
                                  : 'Pendente'}
                          </span>
                        </div>
                        
                        <div className="flex flex-col items-end gap-1 mt-1.5">
                          <button
                            onClick={() => {
                              downloadReceiptAsPNG(
                                'Cantina UDV',
                                'Cupom de Venda',
                                new Date(tx.timestamp).toLocaleString('pt-BR'),
                                tx.items.map(i => ({ name: i.productName, qty: i.quantity, price: i.price })),
                                tx.total,
                                tx.paymentMethod,
                                [
                                  `Cliente: ${activeClient.name}`,
                                  `Cupom: ${tx.id}`,
                                  tx.status === 'cancelado' ? 'STATUS: CANCELADO' : 'STATUS: CONFIRMADO'
                                ],
                                `recibo_${tx.id}.png`
                              );
                            }}
                            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5 transition-colors"
                          >
                            <Download size={10} /> Recibo PNG
                          </button>
  
                          {tx.status !== 'cancelado' && onCancelSale && (
                            <button
                              onClick={() => {
                                if (confirm(`Aviso de Confirmação:\nDeseja realmente cancelar esta venda de R$ ${tx.total.toFixed(2)}?\nOs itens voltarão ao estoque e o saldo do cliente será estornado.`)) {
                                  onCancelSale(tx.id);
                                }
                              }}
                              className="text-[10px] text-red-600 hover:text-red-800 font-bold flex items-center gap-0.5 transition-colors"
                            >
                              ✗ Cancelar Venda
                            </button>
                          )}

                          {onDeleteSale && (
                            <button
                              onClick={() => {
                                const isCancelled = tx.status === 'cancelado';
                                const confirmMsg = isCancelled
                                  ? `Deseja realmente EXCLUIR permanentemente o registro da venda #${tx.id} de R$ ${tx.total.toFixed(2)} do histórico?\nEsta ação é irreversível.`
                                  : `Deseja realmente EXCLUIR DEFINITIVAMENTE a venda #${tx.id} de R$ ${tx.total.toFixed(2)}?\nEsta ação restabelecerá o estoque do produto, estornará qualquer saldo a prazo e removerá o registro do histórico para sempre.`;
                                
                                if (confirm(confirmMsg)) {
                                  onDeleteSale(tx.id);
                                }
                              }}
                              className="text-[10px] text-red-600 hover:text-red-800 font-bold flex items-center gap-0.5 transition-colors"
                            >
                              🗑️ Excluir Venda
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <Users size={48} className="text-gray-200 mb-2" />
            <p className="text-sm text-gray-400 font-sans">Cadastre ou selecione um cliente na lista à esquerda.</p>
          </div>
        )}
      </div>

      {/* MODAL: CREATE / UPDATE CLIENT */}
      <AnimatePresence>
        {showFormModal && (
          <div id="client-form-modal" className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border"
            >
              <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h3 className="font-sans font-bold text-gray-900 text-sm">
                  {editingClient ? 'Editar Cadastro de Cliente' : 'Novo Aluno ou Colaborador'}
                </h3>
                <button 
                  id="close-client-form-btn"
                  onClick={() => setShowFormModal(false)} 
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={18} />
                </button>
              </div>

              <form id="client-data-form" onSubmit={handleFormSubmit} className="p-5 space-y-4">
                <div>
                  <label className="text-[10px] text-gray-500 font-sans block mb-1">Nome Completo *</label>
                  <input
                    id="form-client-name"
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ex: Arthur Silva Rodrigues"
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-sans focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-500 font-sans block mb-1">Telefone (WhatsApp) *</label>
                    <input
                      id="form-client-phone"
                      type="tel"
                      required
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="Ex: +5511988880000"
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-sans focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-sans block mb-1">E-mail</label>
                    <input
                      id="form-client-email"
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="Ex: arthur@escola.com"
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-sans focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center pt-2 pl-1">
                  <input
                    id="form-client-biometric-check"
                    type="checkbox"
                    checked={formBiometric}
                    onChange={(e) => setFormBiometric(e.target.checked)}
                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-200 rounded cursor-pointer"
                  />
                  <label htmlFor="form-client-biometric-check" className="ml-2 text-xs font-sans font-medium text-gray-700 cursor-pointer">
                    Ativar Biometria Balcão
                  </label>
                </div>

                <button
                  id="submit-client-btn"
                  type="submit"
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95"
                >
                  {editingClient ? 'Salvar Alterações' : 'Cadastrar Aluno / Colaborador'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: PAY DEBT / RECHARGE BALANCE */}
      <AnimatePresence>
        {showPaymentModal && activeClient && (
          <div id="payment-recharge-modal" className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border"
            >
              <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h3 className="font-sans font-bold text-gray-900 text-sm flex items-center gap-1.5">
                  <LandmarkIcon size={16} className="text-emerald-600" />
                  Receber / Abater Contas
                </h3>
                <button 
                  id="close-payment-modal-btn"
                  onClick={() => setShowPaymentModal(false)} 
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={18} />
                </button>
              </div>

              <form id="payment-recharge-form" onSubmit={handlePaymentSubmit} className="p-5 space-y-4">
                <div className="p-3 bg-gray-50 rounded-lg text-xs space-y-1">
                  <p className="text-gray-600">Cliente: <strong>{activeClient.name}</strong></p>
                  <p className="text-gray-600">
                    Saldo Atual:{' '}
                    <strong className={activeClient.balance < 0 ? 'text-red-600' : 'text-emerald-600'}>
                      {activeClient.balance < 0 ? 'Devedor ' : 'Crédito '} R$ {Math.abs(activeClient.balance).toFixed(2)}
                    </strong>
                  </p>
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 font-sans block mb-1">Valor de Pagamento / Recarga *</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-xs text-gray-400 font-mono">R$</span>
                    <input
                      id="recharge-amount-input"
                      type="text"
                      required
                      placeholder="0,00"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg font-mono text-xs font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  {activeClient.balance < 0 && (
                    <button
                      id="pay-exact-debt-shortcut"
                      type="button"
                      onClick={() => setPaymentAmount(Math.abs(activeClient.balance).toFixed(2).replace('.', ','))}
                      className="mt-1.5 text-[10px] text-emerald-600 hover:underline font-medium block"
                    >
                      Preencher valor integral do débito (R$ {Math.abs(activeClient.balance).toFixed(2)})
                    </button>
                  )}
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 font-sans block mb-1">Forma de Recebimento *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['pix', 'dinheiro', 'cartão'].map(m => (
                      <button
                        key={m}
                        id={`payment-recharge-method-${m}`}
                        type="button"
                        onClick={() => setPaymentMethod(m as any)}
                        className={`py-1.5 rounded-lg border font-sans text-[11px] font-semibold text-center transition-all ${
                          paymentMethod === m 
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-700' 
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {m.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  id="confirm-recharge-btn"
                  type="submit"
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95"
                >
                  Efetivar Recebimento
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CUSTOM CONFIRM DELETE MODAL */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div id="delete-confirm-modal" className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border p-6 text-center space-y-4"
            >
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="font-sans font-bold text-gray-900 text-sm">Excluir Cadastro</h3>
                <p className="text-xs text-gray-500 font-sans leading-relaxed">
                  Tem certeza que deseja remover este cliente? Se houver pendências de saldo devedor, é recomendado quitá-las primeiro.
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const clientId = showDeleteConfirm;
                    onDeleteClient(clientId);
                    if (activeClientId === clientId) {
                      const remaining = clients.filter(c => c.id !== clientId);
                      setActiveClientId(remaining[0]?.id || null);
                    }
                    setShowDeleteConfirm(null);
                  }}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-md"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
