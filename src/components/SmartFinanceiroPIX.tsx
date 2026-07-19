/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Client, Transaction, PixCharge, BankReconciliation, PaymentLog, FinancialSettings, PaymentWebhook, AdminSecuritySettings, AdminSecurityLog, ProviderChangeLog, AppUser, PaymentMessageLog, SmartCobrancaSettings } from '../types';
import { 
  DollarSign, CreditCard, Layers, Settings, Activity, FileText, CheckCircle2, 
  AlertCircle, Calendar, Sparkles, History, Lock, ShieldCheck, Eye, EyeOff, 
  Cpu, TrendingUp, RotateCw, Search, Filter, Plus, Trash, Download, HelpCircle, 
  Send, Check, CheckSquare, XCircle, X, AlertTriangle, ShieldAlert, KeyRound, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FinancialAIService, AIAnalysisResult } from '../lib/FinancialAIService';
import { INITIAL_PROVIDERS_CONFIG, ProviderConfig, createProviderInstance, encryptKey, decryptKey } from '../providers/payments/ProviderRegistry';
import { sha256 } from '../utils/crypto';

interface SmartFinanceiroPIXProps {
  clients: Client[];
  transactions: Transaction[];
  paymentProviders: ProviderConfig[];
  pixCharges: PixCharge[];
  paymentLogs: PaymentLog[];
  paymentWebhooks: PaymentWebhook[];
  reconciliations: BankReconciliation[];
  settings: FinancialSettings;
  onSaveProviders: (providers: ProviderConfig[]) => void;
  onSaveCharges: (charges: PixCharge[]) => void;
  onSaveLogs: (logs: PaymentLog[]) => void;
  onSaveWebhooks: (webhooks: PaymentWebhook[]) => void;
  onSaveReconciliations: (reconciliations: BankReconciliation[]) => void;
  onSaveSettings: (settings: FinancialSettings) => void;
  onSaveTransactions: (venda: Transaction) => void;
  onUpdateClientBalance: (clientId: string, amount: number) => void;
  triggerPushNotification: (title: string, body: string, type?: 'info' | 'success' | 'warn') => void;
  adminSecurity: AdminSecuritySettings | null;
  adminSecurityLogs: AdminSecurityLog[];
  providerChangeLogs: ProviderChangeLog[];
  onSaveAdminSecurity: (settings: AdminSecuritySettings) => void;
  onSaveAdminSecurityLogs: (logs: AdminSecurityLog[]) => void;
  onSaveProviderChangeLogs: (logs: ProviderChangeLog[]) => void;
  currentUser: AppUser | null;
  paymentMessageLogs: PaymentMessageLog[];
  onSavePaymentMessageLog: (log: PaymentMessageLog) => void;
  smartCobrancaSettings: SmartCobrancaSettings;
  onSaveSmartCobrancaSettings: (settings: SmartCobrancaSettings) => void;
  pixKey?: string;
}

const DEFAULT_SETTINGS: FinancialSettings = {
  instituicaoPadrao: 'stone',
  instituicaoAtiva: 'stone',
  timeout: 30,
  tentativas: 3,
  ativarLogs: true,
  ativarAuditoria: true,
  criadoEm: new Date().toISOString(),
  atualizadoEm: new Date().toISOString()
};

export default function SmartFinanceiroPIX({
  clients,
  transactions,
  paymentProviders = [],
  pixCharges = [],
  paymentLogs = [],
  paymentWebhooks = [],
  reconciliations = [],
  settings = DEFAULT_SETTINGS,
  onSaveProviders,
  onSaveCharges,
  onSaveLogs,
  onSaveWebhooks,
  onSaveReconciliations,
  onSaveSettings,
  onSaveTransactions,
  onUpdateClientBalance,
  triggerPushNotification,
  adminSecurity,
  adminSecurityLogs = [],
  providerChangeLogs = [],
  onSaveAdminSecurity,
  onSaveAdminSecurityLogs,
  onSaveProviderChangeLogs,
  currentUser,
  paymentMessageLogs = [],
  onSavePaymentMessageLog,
  smartCobrancaSettings,
  onSaveSmartCobrancaSettings,
  pixKey = 'pix@udvcantina.com'
}: SmartFinanceiroPIXProps) {
  const [activeSubTab, setActiveSubTab] = useState<'recebimentos' | 'cobrancas' | 'instituicoes' | 'conciliacao' | 'historico' | 'config' | 'ia' | 'admin-center' | 'smart-cobranca'>('recebimentos');
  
  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [providerSearch, setProviderSearch] = useState('');
  const [chargeSearch, setChargeSearch] = useState('');
  const [reconcileFilter, setReconcileFilter] = useState<string>('todos');
  const [chargeFilter, setChargeFilter] = useState<string>('todos');
  
  // Create / Edit Provider Modal State
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Partial<ProviderConfig> | null>(null);
  const [showSensitiveKeys, setShowSensitiveKeys] = useState<{ [key: string]: boolean }>({});

  // Smart Admin Center Protected Session States
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminPasswordError, setAdminPasswordError] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState('');
  const [selectedProviderToSwitch, setSelectedProviderToSwitch] = useState('');
  const [showProviderSwitchConfirmModal, setShowProviderSwitchConfirmModal] = useState(false);

  // Webhook Simulator State
  const [showWebhookSimulator, setShowWebhookSimulator] = useState(false);
  const [simulatedTxid, setSimulatedTxid] = useState('');
  const [simulatedValor, setSimulatedValor] = useState(0);
  const [selectedSimulatedProvider, setSelectedSimulatedProvider] = useState('stone');

  // AI Assistant Analysis State
  const [isAIAnalyzing, setIsAIAnalyzing] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<AIAnalysisResult | null>(null);

  // Smart Cobrança States
  const [selectedCobrancaClient, setSelectedCobrancaClient] = useState<Client | null>(null);
  const [preparedPixCharge, setPreparedPixCharge] = useState<PixCharge | null>(null);
  const [isPreparingPix, setIsPreparingPix] = useState(false);
  const [customMessageText, setCustomMessageText] = useState('');
  const [selectedCobrancaFilter, setSelectedCobrancaFilter] = useState<'todos' | 'vencidos' | 'a-vencer' | 'mais-7-dias' | 'mais-30-dias'>('todos');
  const [cobrancaSearchTerm, setCobrancaSearchTerm] = useState('');
  const [showCobrancaChoiceModal, setShowCobrancaChoiceModal] = useState(false);
  const [tempCobrancaOption, setTempCobrancaOption] = useState<'copia_e_cola' | 'chave_pix'>('copia_e_cola');
  const [cobrancaFinalized, setCobrancaFinalized] = useState(false);
  const [cobrancaMethodUsed, setCobrancaMethodUsed] = useState<'copia_e_cola' | 'chave_pix'>('copia_e_cola');

  // Fallback to initial configs if empty (Firestore sync hydration)
  const providersList = useMemo(() => {
    if (!paymentProviders || paymentProviders.length === 0) {
      return INITIAL_PROVIDERS_CONFIG;
    }
    return paymentProviders;
  }, [paymentProviders]);

  // Filter eligible clients for Smart Cobrança
  const eligibleCobrancaClients = useMemo(() => {
    return clients
      .map(client => {
        const debt = client.balance < 0 ? Math.abs(client.balance) : 0;
        const pendingTransactions = transactions.filter(
          t => t.clientId === client.id && t.paymentMethod === 'prazo' && t.status === 'pendente'
        );
        const pendingPrazoSum = pendingTransactions.reduce((sum, t) => sum + t.total, 0);
        const valorPendente = debt > 0 ? debt : pendingPrazoSum;

        // Oldest pending transaction
        const oldestPending = pendingTransactions.reduce((oldest, t) => {
          if (!oldest) return t;
          return new Date(t.timestamp).getTime() < new Date(oldest.timestamp).getTime() ? t : oldest;
        }, null as Transaction | null);

        const daysInArrears = oldestPending 
          ? Math.floor((new Date().getTime() - new Date(oldestPending.timestamp).getTime()) / (1000 * 60 * 60 * 24)) 
          : (debt > 0 ? 1 : 0); // fallback if balance is negative but no transaction object exists, assume 1 day

        const status: 'vencido' | 'a-vencer' = daysInArrears > 0 ? 'vencido' : 'a-vencer';

        return {
          ...client,
          valorPendente,
          quantidadeTitulos: pendingTransactions.length || (debt > 0 ? 1 : 0),
          daysInArrears,
          status,
          oldestPendingDate: oldestPending ? oldestPending.timestamp : null
        };
      })
      .filter(c => c.valorPendente > 0) // only list with pending balances!
      .filter(c => {
        // Search filter
        if (!cobrancaSearchTerm) return true;
        const term = cobrancaSearchTerm.toLowerCase();
        return c.name.toLowerCase().includes(term) || c.phone.includes(term);
      })
      .filter(c => {
        // Status dropdown filter
        if (selectedCobrancaFilter === 'todos') return true;
        if (selectedCobrancaFilter === 'vencidos') return c.daysInArrears > 0;
        if (selectedCobrancaFilter === 'a-vencer') return c.daysInArrears === 0;
        if (selectedCobrancaFilter === 'mais-7-dias') return c.daysInArrears > 7;
        if (selectedCobrancaFilter === 'mais-30-dias') return c.daysInArrears > 30;
        return true;
      });
  }, [clients, transactions, cobrancaSearchTerm, selectedCobrancaFilter]);

  // Log registration helper
  const addLog = (type: PaymentLog['type'], action: string, details: string) => {
    const newLog: PaymentLog = {
      id: 'log_' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      type,
      action,
      details,
      user: 'Administrador'
    };
    onSaveLogs([newLog, ...paymentLogs]);
  };

  // Switch Active Provider
  const handleSetActiveProvider = async (providerId: string) => {
    const updatedProviders = providersList.map(p => ({
      ...p,
      status: p.id === providerId ? 'Ativo' as const : 'Inativo' as const
    }));
    
    onSaveProviders(updatedProviders);
    
    const targetProvider = providersList.find(p => p.id === providerId);
    const prevProvider = providersList.find(p => p.status === 'Ativo');

    const updatedSettings = {
      ...settings,
      instituicaoAtiva: providerId,
      atualizadoEm: new Date().toISOString()
    };
    onSaveSettings(updatedSettings);

    addLog('security', 'Alteração de Provedor Ativo', `Provedor alterado de ${prevProvider?.name || 'Nenhum'} para ${targetProvider?.name || providerId}`);
    triggerPushNotification('Provedor Alterado', `O sistema agora processa PIX via ${targetProvider?.name || providerId}`, 'success');
  };

  // Submit password for Smart Admin Center (Second layer authentication)
  const handleAdminPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPasswordInput) return;

    // Check if blocked
    const now = new Date();
    if (adminSecurity?.blockedUntil && new Date(adminSecurity.blockedUntil) > now) {
      setAdminPasswordError(`Acesso bloqueado temporariamente. Tente novamente após ${new Date(adminSecurity.blockedUntil).toLocaleTimeString('pt-BR')}`);
      return;
    }

    const inputHash = await sha256(adminPasswordInput);
    const targetHash = adminSecurity?.passwordHash || '8b2aae9771701faeaf731c84dbd88bec5d02c240a21741046fafccdfc7877ca8'; // F@b486875 hash

    if (inputHash === targetHash) {
      setIsAdminAuthorized(true);
      setAdminPasswordError('');
      setAdminPasswordInput('');
      
      const updatedSec: AdminSecuritySettings = {
        passwordHash: targetHash,
        failedAttempts: 0,
        blockedUntil: null,
        updatedAt: new Date().toISOString()
      };
      onSaveAdminSecurity(updatedSec);

      const newLog: AdminSecurityLog = {
        id: 'aclog_' + Math.random().toString(36).substring(2, 9),
        user: currentUser?.name || currentUser?.username || 'Administrador',
        action: 'admin_login',
        date: new Date().toISOString(),
        success: true,
        details: 'Acesso liberado ao Smart Admin Center.'
      };
      onSaveAdminSecurityLogs([newLog, ...adminSecurityLogs]);
      triggerPushNotification('Acesso Permitido', 'Bem-vindo ao painel administrativo seguro.', 'success');
    } else {
      const nextAttempts = (adminSecurity?.failedAttempts || 0) + 1;
      let blockedUntil: string | null = null;
      let errorMsg = '';

      if (nextAttempts >= 5) {
        // Block for 1 minute (60,000ms)
        blockedUntil = new Date(Date.now() + 60000).toISOString();
        errorMsg = 'Múltiplas tentativas incorretas. Acesso bloqueado por 1 minuto.';
      } else {
        errorMsg = `Senha incorreta. Tentativa ${nextAttempts} de 5.`;
      }

      const updatedSec: AdminSecuritySettings = {
        passwordHash: targetHash,
        failedAttempts: nextAttempts,
        blockedUntil,
        updatedAt: new Date().toISOString()
      };
      onSaveAdminSecurity(updatedSec);

      const newLog: AdminSecurityLog = {
        id: 'aclog_' + Math.random().toString(36).substring(2, 9),
        user: currentUser?.name || currentUser?.username || 'Administrador',
        action: 'admin_login',
        date: new Date().toISOString(),
        success: false,
        details: `Falha de login administrativo. Tentativa ${nextAttempts}/5.`
      };
      onSaveAdminSecurityLogs([newLog, ...adminSecurityLogs]);
      setAdminPasswordError(errorMsg);
      triggerPushNotification('Acesso Negado', errorMsg, 'warn');
    }
  };

  // Change Administrator Password
  const handleChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPasswordInput) return;
    if (newPasswordInput !== confirmNewPasswordInput) {
      triggerPushNotification('Erro', 'As senhas digitadas não coincidem.', 'warn');
      return;
    }

    const newHash = await sha256(newPasswordInput);
    const updatedSec: AdminSecuritySettings = {
      passwordHash: newHash,
      failedAttempts: 0,
      blockedUntil: null,
      updatedAt: new Date().toISOString()
    };
    onSaveAdminSecurity(updatedSec);

    const newLog: AdminSecurityLog = {
      id: 'aclog_' + Math.random().toString(36).substring(2, 9),
      user: currentUser?.name || currentUser?.username || 'Administrador',
      action: 'change_password',
      date: new Date().toISOString(),
      success: true,
      details: 'Senha administrativa secundária alterada com sucesso.'
    };
    onSaveAdminSecurityLogs([newLog, ...adminSecurityLogs]);

    setNewPasswordInput('');
    setConfirmNewPasswordInput('');
    triggerPushNotification('Senha Alterada', 'Nova senha administrativa configurada com sucesso.', 'success');
  };

  // Confirm manual switch of payment provider
  const handleConfirmProviderSwitch = () => {
    if (!selectedProviderToSwitch) return;

    const oldProvider = settings.instituicaoAtiva || 'stone';
    const newProvider = selectedProviderToSwitch;

    // Update the active status in the provider list
    const updatedProviders = providersList.map(p => ({
      ...p,
      status: p.id === newProvider ? 'Ativo' as const : 'Inativo' as const
    }));
    onSaveProviders(updatedProviders);

    // Update settings
    const updatedSettings = {
      ...settings,
      instituicaoAtiva: newProvider,
      atualizadoEm: new Date().toISOString()
    };
    onSaveSettings(updatedSettings);

    // Log the change
    const changeLog: ProviderChangeLog = {
      id: 'pclog_' + Math.random().toString(36).substring(2, 9),
      oldProvider,
      newProvider,
      user: currentUser?.name || currentUser?.username || 'Administrador',
      date: new Date().toISOString(),
      status: 'success'
    };
    onSaveProviderChangeLogs([changeLog, ...providerChangeLogs]);

    // Also register standard payment log
    const prevProvName = providersList.find(p => p.id === oldProvider)?.name || oldProvider;
    const newProvName = providersList.find(p => p.id === newProvider)?.name || newProvider;
    addLog('security', 'Troca de Provedor Administrativo', `Alteração de provedor ativo realizada de ${prevProvName} para ${newProvName}`);

    setShowProviderSwitchConfirmModal(false);
    setSelectedProviderToSwitch('');
    triggerPushNotification('Provedor Alterado', `Provedor PIX atualizado com sucesso para ${newProvName}.`, 'success');
  };

  // Save Credentials/Edit Provider
  const handleSaveProviderCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProvider || !editingProvider.id) return;

    // Encrypt sensitive keys if they are updated
    const updatedProvider: ProviderConfig = {
      id: editingProvider.id,
      name: editingProvider.name || 'Provedor',
      status: (editingProvider.status || 'Inativo') as 'Ativo' | 'Inativo',
      ambiente: (editingProvider.ambiente || 'Homologação') as 'Produção' | 'Homologação',
      apiKey: editingProvider.apiKey ? encryptKey(editingProvider.apiKey) : undefined,
      secretKey: editingProvider.secretKey ? encryptKey(editingProvider.secretKey) : undefined,
      clientId: editingProvider.clientId ? encryptKey(editingProvider.clientId) : undefined,
      clientSecret: editingProvider.clientSecret ? encryptKey(editingProvider.clientSecret) : undefined,
      webhookUrl: editingProvider.webhookUrl,
      observacoes: editingProvider.observacoes
    };

    const exists = providersList.some(p => p.id === updatedProvider.id);
    let newProvidersList: ProviderConfig[] = [];
    if (exists) {
      newProvidersList = providersList.map(p => p.id === updatedProvider.id ? updatedProvider : p);
    } else {
      newProvidersList = [...providersList, updatedProvider];
    }

    onSaveProviders(newProvidersList);
    addLog('operation', 'Configuração de Credenciais', `Credenciais salvas/editadas para o provedor ${updatedProvider.name}`);
    setShowProviderModal(false);
    setEditingProvider(null);
    triggerPushNotification('Credenciais Salvas', `Configurações do provedor ${updatedProvider.name} atualizadas`, 'success');
  };

  // Generate PIX Charge for Credit Sales (Vendas a Prazo)
  const handleGeneratePixForVenda = async (venda: Transaction) => {
    try {
      // Find active provider
      const activeConf = providersList.find(p => p.status === 'Ativo') || providersList[0];
      const provider = createProviderInstance(activeConf);

      const client = clients.find(c => c.id === venda.clientId);
      const clienteNome = client ? client.name : venda.clientName || 'Cliente';
      
      const charge = await provider.createPixCharge(venda.id, venda.clientId || 'guest', clienteNome, venda.total);
      
      // Save in cloud
      const updatedCharges = [charge, ...pixCharges];
      onSaveCharges(updatedCharges);

      addLog('operation', 'Cobrança PIX Gerada', `Cobrança emitida via ${activeConf.name} no valor de R$ ${venda.total.toFixed(2)} para ${clienteNome}`);
      triggerPushNotification('Cobrança PIX Criada', `Código Pix Copia e Cola gerado com sucesso via ${activeConf.name}`, 'success');
    } catch (err: any) {
      addLog('error', 'Falha ao Gerar Cobrança PIX', `Erro: ${err.message}`);
      triggerPushNotification('Erro ao Criar Pix', 'Não foi possível gerar a cobrança junto ao banco de destino.', 'warn');
    }
  };

  // Handle Simulated Webhook Notification (Simulating payment reception from Bank webhook)
  const handleSimulateWebhook = async (txid: string, amount: number, providerId: string) => {
    if (!txid) {
      triggerPushNotification('Erro', 'Por favor insira um TxID válido', 'warn');
      return;
    }

    // Check duplication in webhooks log
    const isDuplicate = paymentWebhooks.some(w => w.processado && JSON.stringify(w.payload).includes(txid));
    if (isDuplicate) {
      addLog('security', 'Aviso de Duplicidade Webhook', `Webhook duplicado detectado e bloqueado para TxID ${txid}`);
      triggerPushNotification('Webhook Recusado', 'Esta transação já foi processada anteriormente!', 'warn');
      return;
    }

    // Log the incoming raw webhook request
    const webhookLog: PaymentWebhook = {
      id: 'wh_' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      provedor: providerId,
      payload: JSON.stringify({ txid, valor: amount, status: 'approved', timestamp: new Date().toISOString() }),
      processado: true,
      resultado: 'Sucesso - Venda baixada e saldo atualizado'
    };
    onSaveWebhooks([webhookLog, ...paymentWebhooks]);

    // Find the corresponding PIX Charge
    const chargeIndex = pixCharges.findIndex(c => c.txid === txid);
    if (chargeIndex >= 0) {
      const charge = pixCharges[chargeIndex];
      if (charge.status === 'Pago') {
        triggerPushNotification('Aviso', 'Esta cobrança Pix já consta como paga.', 'info');
        return;
      }

      // Update Pix Charge Status
      const updatedCharges = [...pixCharges];
      updatedCharges[chargeIndex] = {
        ...charge,
        status: 'Pago' as const
      };
      onSaveCharges(updatedCharges);

      // Find Venda a Prazo
      const venda = transactions.find(t => t.id === charge.vendaId);
      if (venda) {
        // Update transaction status to "concluido"
        const updatedVenda: Transaction = {
          ...venda,
          status: 'concluido' as const
        };
        onSaveTransactions(updatedVenda);

        // Update Client Balance (decrease debt / add positive credit)
        onUpdateClientBalance(venda.clientId || '', venda.total);

        // Automatically create reconciliation record
        const newReconciliation: BankReconciliation = {
          id: 'rec_' + Math.random().toString(36).substring(2, 9),
          vendaId: venda.id,
          clienteNome: charge.clienteNome,
          valorEsperado: charge.valor,
          valorRecebido: amount,
          diferenca: charge.valor - amount,
          instituicao: charge.instituicao,
          data: new Date().toISOString().split('T')[0],
          hora: new Date().toTimeString().split(' ')[0].substring(0, 5),
          status: charge.valor === amount ? 'Conciliado' : 'Necessita análise',
          metodo: 'Automático'
        };
        onSaveReconciliations([newReconciliation, ...reconciliations]);

        // Cancel automatic Smart Cobrança collections
        addLog('operation', 'Automação Cobrança IA', `Pagamento detectado. Cancelando agendamentos de lembretes para ${charge.clienteNome}`);

        addLog('operation', 'Recebimento Confirmado Webhook', `Cobrança PIX paga via webhook. ID Venda: ${venda.id}, Valor: R$ ${amount.toFixed(2)}`);
        triggerPushNotification('Pagamento Recebido!', `R$ ${amount.toFixed(2)} recebido de ${charge.clienteNome}`, 'success');
      }
    } else {
      // Direct unexpected deposit/avulso deposit simulation
      const newReconciliation: BankReconciliation = {
        id: 'rec_' + Math.random().toString(36).substring(2, 9),
        vendaId: 'Depósito Avulso',
        clienteNome: 'Depositante Não Identificado',
        valorEsperado: 0,
        valorRecebido: amount,
        diferenca: -amount,
        instituicao: providerId.toUpperCase(),
        data: new Date().toISOString().split('T')[0],
        hora: new Date().toTimeString().split(' ')[0].substring(0, 5),
        status: 'Pendente',
        metodo: 'Automático'
      };
      onSaveReconciliations([newReconciliation, ...reconciliations]);
      addLog('info', 'Depósito Avulso Detectado', `PIX recebido sem TxID associado. Valor: R$ ${amount.toFixed(2)}`);
      triggerPushNotification('Pix Avulso Recebido', `R$ ${amount.toFixed(2)} recebido no banco. Requer conciliação manual.`, 'info');
    }
    
    setShowWebhookSimulator(false);
  };

  // Perform Manual Conciliation
  const handleManualReconciliation = (rec: BankReconciliation, matchingVendaId: string) => {
    const updatedReconciliations = reconciliations.map(r => {
      if (r.id === rec.id) {
        return {
          ...r,
          status: 'Conciliado' as const,
          vendaId: matchingVendaId,
          metodo: 'Manual' as const,
          diferenca: 0
        };
      }
      return r;
    });
    onSaveReconciliations(updatedReconciliations);

    // If associated to a real venda, update it and adjust balance
    const venda = transactions.find(t => t.id === matchingVendaId);
    if (venda) {
      const updatedVenda: Transaction = {
        ...venda,
        status: 'concluido' as const
      };
      onSaveTransactions(updatedVenda);
      onUpdateClientBalance(venda.clientId || '', rec.valorRecebido);
      addLog('operation', 'Conciliação Manual Realizada', `Associação manual aprovada. Venda: ${matchingVendaId}, Valor: R$ ${rec.valorRecebido.toFixed(2)}`);
    } else {
      addLog('operation', 'Conciliação Manual Realizada', `Ajuste manual de saldo/conciliação de R$ ${rec.valorRecebido.toFixed(2)}`);
    }

    triggerPushNotification('Transação Conciliada', 'Conciliação manual aprovada com sucesso!', 'success');
  };

  // Refund Charge (Estorno)
  const handleRefundPix = async (charge: PixCharge) => {
    try {
      const updatedCharges = pixCharges.map(c => {
        if (c.id === charge.id) {
          return { ...c, status: 'Estornado' as const };
        }
        return c;
      });
      onSaveCharges(updatedCharges);

      // Refund client balance
      onUpdateClientBalance(charge.clienteId, -charge.valor);

      addLog('security', 'Estorno de Pagamento PIX', `PIX estornado para ${charge.clienteNome} no valor de R$ ${charge.valor.toFixed(2)}`);
      triggerPushNotification('Estornado com Sucesso', `R$ ${charge.valor.toFixed(2)} devolvido ao pagador`, 'success');
    } catch (err) {
      triggerPushNotification('Erro ao Estornar', 'Falha no comando de devolução do PIX', 'warn');
    }
  };

  // Run AI Audit & Analysis
  const runAIFinancialAudit = async () => {
    setIsAIAnalyzing(true);
    try {
      const result = await FinancialAIService.analyzeFinancials(pixCharges, transactions, reconciliations);
      setAiAnalysisResult(result);
      addLog('operation', 'Auditoria IA Executada', 'Varredura completa de pagamentos, fraudes e conciliações via Gemini IA concluída.');
      triggerPushNotification('Auditoria Concluída', 'O relatório inteligente de finanças e anomalias está pronto', 'success');
    } catch (e) {
      triggerPushNotification('Erro na Auditoria', 'Não foi possível completar a análise de IA', 'warn');
    } finally {
      setIsAIAnalyzing(false);
    }
  };

  // Calculations for Financial Widgets
  const totalRecebidoPix = useMemo(() => {
    return reconciliations
      .filter(r => r.status === 'Conciliado')
      .reduce((sum, r) => sum + r.valorRecebido, 0);
  }, [reconciliations]);

  const totalAguardando = useMemo(() => {
    return pixCharges
      .filter(c => c.status === 'Aguardando pagamento')
      .reduce((sum, c) => sum + c.valor, 0);
  }, [pixCharges]);

  const taxaConciliacao = useMemo(() => {
    if (reconciliations.length === 0) return 100;
    const conciliados = reconciliations.filter(r => r.status === 'Conciliado').length;
    return Math.round((conciliados / reconciliations.length) * 100);
  }, [reconciliations]);

  // Outstanding credit sales list (Vendas a prazo que podem receber PIX)
  const outstandingSales = useMemo(() => {
    return transactions.filter(t => t.paymentMethod === 'prazo' && t.status === 'pendente');
  }, [transactions]);

  const handleSelectClient = (client: Client) => {
    setSelectedCobrancaClient(client);
    setShowCobrancaChoiceModal(false);
    setTempCobrancaOption('copia_e_cola');
    setCobrancaFinalized(false);
    setCobrancaMethodUsed('copia_e_cola');
  };

  const handleStartCobranca = () => {
    if (!selectedCobrancaClient) return;
    const valorPendente = (selectedCobrancaClient as any).valorPendente || 0;
    if (valorPendente <= 0) {
      triggerPushNotification('Cobrança Não Permitida', 'Este cliente não possui valores pendentes.', 'warn');
      return;
    }
    setTempCobrancaOption('copia_e_cola');
    setShowCobrancaChoiceModal(true);
  };

  const handleConfirmCobrancaMethod = () => {
    if (!selectedCobrancaClient) return;
    if (tempCobrancaOption === 'copia_e_cola' && isPreparingPix) {
      triggerPushNotification('Aguarde', 'Ainda gerando o PIX Copia e Cola. Por favor, aguarde um segundo...', 'info');
      return;
    }

    const valorPendente = (selectedCobrancaClient as any).valorPendente || 0;
    const formattedBalance = valorPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    // Filter only unpaid (status === 'pendente') "prazo" transactions for outstanding debt items
    const clientTransactions = transactions.filter(
      t => t.clientId === selectedCobrancaClient.id && t.paymentMethod === 'prazo' && t.status === 'pendente'
    );

    const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      if (dateStr.includes('T')) {
        const parts = dateStr.split('T')[0].split('-');
        if (parts.length === 3) {
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }
      try {
        const date = new Date(dateStr);
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${day}/${month}/${year}`;
      } catch (e) {
        return dateStr;
      }
    };

    const listagemCompras = clientTransactions.length > 0
      ? clientTransactions.map(tx => {
          const dateFormatted = formatDate(tx.timestamp);
          const itemsDesc = tx.items && tx.items.length > 0
            ? tx.items.map(it => it.productName).join(' + ')
            : 'Consumo Geral';
          const valueFormatted = tx.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
          return `${dateFormatted}\n${itemsDesc}\nR$ ${valueFormatted}`;
        }).join('\n\n')
      : 'Consumo Geral pendente';

    const pixCode = preparedPixCharge?.copiaECola || 'pix@udvcantina.com';
    const keyToUse = pixKey || 'pix@udvcantina.com';

    const pixOptionText = tempCobrancaOption === 'copia_e_cola'
      ? `• PIX Copia e Cola\n${pixCode}`
      : `• Chave PIX\nChave PIX: ${keyToUse}`;

    // Build default message using selected PIX option and the same date-based formatting
    const text = `Olá, ${selectedCobrancaClient.name}! 😊\n\nEsperamos que esteja tudo bem com você.\n\nIdentificamos que existem pagamentos pendentes em sua conta na Cantina Smart.\n\nResumo das compras em aberto:\n\n${listagemCompras}\n\nTotal pendente:\n\nR$ ${formattedBalance}\n\nVocê pode realizar o pagamento utilizando:\n\n${pixOptionText}\n\nAssim que o pagamento for identificado, sua conta será atualizada automaticamente.\n\nCaso este pagamento já tenha sido realizado, por favor, desconsidere esta mensagem.\n\nAgradecemos pela confiança e preferência!`;

    setCustomMessageText(text);
    setCobrancaMethodUsed(tempCobrancaOption);
    setCobrancaFinalized(true);
    setShowCobrancaChoiceModal(false);
  };

  // Sync / Auto Initialize list if empty
  useEffect(() => {
    if (paymentProviders.length === 0) {
      onSaveProviders(INITIAL_PROVIDERS_CONFIG);
    }
  }, [paymentProviders]);

  // Prepare Pix and custom message when client is selected
  useEffect(() => {
    if (!selectedCobrancaClient) {
      setPreparedPixCharge(null);
      setCustomMessageText('');
      return;
    }

    const prepareCobranca = async () => {
      setIsPreparingPix(true);
      const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        if (dateStr.includes('T')) {
          const parts = dateStr.split('T')[0].split('-');
          if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
        }
        try {
          const date = new Date(dateStr);
          const day = String(date.getUTCDate()).padStart(2, '0');
          const month = String(date.getUTCMonth() + 1).padStart(2, '0');
          const year = date.getUTCFullYear();
          return `${day}/${month}/${year}`;
        } catch (e) {
          return dateStr;
        }
      };

      try {
        const pendingTransactions = transactions.filter(
          t => t.clientId === selectedCobrancaClient.id && t.paymentMethod === 'prazo' && t.status === 'pendente'
        );
        const valorPendente = pendingTransactions.reduce((sum, t) => sum + t.total, 0);

        if (valorPendente <= 0) {
          setPreparedPixCharge(null);
          setCustomMessageText('');
          setIsPreparingPix(false);
          return;
        }

        // Use active provider to generate PIX
        const activeConf = providersList.find(p => p.status === 'Ativo') || providersList[0];
        const provider = createProviderInstance(activeConf);
        const txid = 'cob_mc_' + Math.random().toString(36).substring(2, 9);
        
        const charge = await provider.createPixCharge(
          txid,
          selectedCobrancaClient.id,
          selectedCobrancaClient.name,
          valorPendente
        );

        setPreparedPixCharge(charge);

        // Build customized template
        const listagemCompras = pendingTransactions.map(tx => {
          const dateFormatted = formatDate(tx.timestamp);
          const itemsDesc = tx.items && tx.items.length > 0
            ? tx.items.map(it => it.productName).join(' + ')
            : 'Consumo Geral';
          const valueFormatted = tx.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
          return `${dateFormatted}\n${itemsDesc}\nR$ ${valueFormatted}`;
        }).join('\n\n');

        const formattedBalance = valorPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const pixCode = charge?.copiaECola || 'pix@udvcantina.com';

        // Build default message using PIX Copia e Cola
        const text = `Olá, ${selectedCobrancaClient.name}! 😊\n\nEsperamos que esteja tudo bem com você.\n\nIdentificamos que existem pagamentos pendentes em sua conta na Cantina Smart.\n\nResumo das compras em aberto:\n\n${listagemCompras}\n\nTotal pendente:\n\nR$ ${formattedBalance}\n\nVocê pode realizar o pagamento utilizando:\n\n• PIX Copia e Cola\n${pixCode}\n\nAssim que o pagamento for identificado, sua conta será atualizada automaticamente.\n\nCaso este pagamento já tenha sido realizado, por favor, desconsidere esta mensagem.\n\nAgradecemos pela confiança e preferência!`;

        setCustomMessageText(text);
      } catch (err) {
        console.error('Erro ao gerar cobrança automática:', err);
        // Fallback static charge
        const activeConf = providersList.find(p => p.status === 'Ativo') || providersList[0];
        const pendingTransactions = transactions.filter(
          t => t.clientId === selectedCobrancaClient.id && t.paymentMethod === 'prazo' && t.status === 'pendente'
        );
        const valorPendente = pendingTransactions.reduce((sum, t) => sum + t.total, 0);

        const listagemCompras = pendingTransactions.map(tx => {
          const dateFormatted = formatDate(tx.timestamp);
          const itemsDesc = tx.items && tx.items.length > 0
            ? tx.items.map(it => it.productName).join(' + ')
            : 'Consumo Geral';
          const valueFormatted = tx.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
          return `${dateFormatted}\n${itemsDesc}\nR$ ${valueFormatted}`;
        }).join('\n\n');

        const formattedBalance = valorPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const text = `Olá, ${selectedCobrancaClient.name}! 😊\n\nEsperamos que esteja tudo bem com você.\n\nIdentificamos que existem pagamentos pendentes em sua conta na Cantina Smart.\n\nResumo das compras em aberto:\n\n${listagemCompras}\n\nTotal pendente:\n\nR$ ${formattedBalance}\n\nVocê pode realizar o pagamento utilizando:\n\n• PIX Copia e Cola\npix@udvcantina.com\n\nAssim que o pagamento for identificado, sua conta será atualizada automaticamente.\n\nCaso este pagamento já tenha sido realizado, por favor, desconsidere esta mensagem.\n\nAgradecemos pela confiança e preferência!`;
        
        setCustomMessageText(text);
        setPreparedPixCharge({
          id: 'fb_' + Math.random().toString(36).substring(2, 9),
          txid: 'PIX_KEY_FALLBACK',
          clienteId: selectedCobrancaClient.id,
          clienteNome: selectedCobrancaClient.name,
          valor: valorPendente,
          status: 'Aguardando pagamento',
          vencimento: new Date(Date.now() + 86400000).toISOString(),
          copiaECola: 'pix@udvcantina.com', // fallback key
          qrcode: 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' + encodeURIComponent('pix@udvcantina.com'),
          instituicao: activeConf.name,
          criadoEm: new Date().toISOString()
        });
      } finally {
        setIsPreparingPix(false);
      }
    };

    prepareCobranca();
  }, [selectedCobrancaClient, providersList, smartCobrancaSettings.modeloPadrao, transactions]);

  return (
    <div id="smart-financeiro-container" className="w-full bg-slate-950/40 backdrop-blur-md rounded-2xl border border-emerald-500/10 p-5 font-sans text-slate-200">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-500/10 pb-5 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <TrendingUp size={22} className="animate-pulse" />
            </span>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 via-emerald-200 to-amber-300 bg-clip-text text-transparent">
              Smart Financeiro PIX
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Plataforma agnóstica de liquidação PIX, conciliação e auditoria preventiva inteligente de fraude.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="btn-trigger-ai"
            onClick={runAIFinancialAudit}
            disabled={isAIAnalyzing}
            className="flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 transition-all shadow-lg shadow-amber-500/10 disabled:opacity-50"
          >
            {isAIAnalyzing ? (
              <RotateCw size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} className="text-slate-950" />
            )}
            Auditar com Gemini IA
          </button>

          <button
            id="btn-webhook-simulator"
            onClick={() => setShowWebhookSimulator(true)}
            className="flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-all border border-slate-700"
          >
            <Activity size={14} className="text-emerald-400" />
            Simulador Webhook Bancário
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800/80 flex items-center gap-3">
          <span className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400">
            <DollarSign size={20} />
          </span>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Liquidação Total</span>
            <span className="text-base md:text-lg font-bold text-slate-100">R$ {totalRecebidoPix.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800/80 flex items-center gap-3">
          <span className="p-3 rounded-lg bg-amber-500/10 text-amber-400">
            <CreditCard size={20} />
          </span>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Aguardando PIX</span>
            <span className="text-base md:text-lg font-bold text-slate-100">R$ {totalAguardando.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800/80 flex items-center gap-3">
          <span className="p-3 rounded-lg bg-blue-500/10 text-blue-400">
            <CheckSquare size={20} />
          </span>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Taxa Conciliação</span>
            <span className="text-base md:text-lg font-bold text-slate-100">{taxaConciliacao}%</span>
          </div>
        </div>

        <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800/80 flex items-center gap-3">
          <span className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400">
            <ShieldCheck size={20} />
          </span>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Provedor Ativo</span>
            <span className="text-xs md:text-sm font-bold text-emerald-300 uppercase">
              {providersList.find(p => p.status === 'Ativo')?.name || 'Nenhum'}
            </span>
          </div>
        </div>
      </div>

      {/* Internal Navigation Menu */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-6 border-b border-slate-800/80 scrollbar-none">
        <button
          id="subtab-recebimentos"
          onClick={() => setActiveSubTab('recebimentos')}
          className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeSubTab === 'recebimentos' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <DollarSign size={13} /> Recebimentos PIX
        </button>

        <button
          id="subtab-cobrancas"
          onClick={() => setActiveSubTab('cobrancas')}
          className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeSubTab === 'cobrancas' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CreditCard size={13} /> Cobranças PIX ({pixCharges.length})
        </button>

        <button
          id="subtab-instituicoes"
          onClick={() => setActiveSubTab('instituicoes')}
          className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeSubTab === 'instituicoes' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers size={13} /> Instituições Financeiras
        </button>

        <button
          id="subtab-conciliacao"
          onClick={() => setActiveSubTab('conciliacao')}
          className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeSubTab === 'conciliacao' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckSquare size={13} /> Conciliação Bancária
        </button>

        <button
          id="subtab-historico"
          onClick={() => setActiveSubTab('historico')}
          className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeSubTab === 'historico' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History size={13} /> Histórico & Auditoria
        </button>

        <button
          id="subtab-ia"
          onClick={() => setActiveSubTab('ia')}
          className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeSubTab === 'ia' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles size={13} /> Análise IA Gemini
        </button>

        <button
          id="subtab-config"
          onClick={() => setActiveSubTab('config')}
          className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeSubTab === 'config' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Settings size={13} /> Configurações Financeiras
        </button>

        <button
          id="subtab-admin-center"
          onClick={() => setActiveSubTab('admin-center')}
          className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
            activeSubTab === 'admin-center' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-400 hover:text-amber-300'
          }`}
        >
          <Lock size={13} className="text-amber-400 animate-pulse" /> Smart Admin Center
        </button>

        {smartCobrancaSettings.ativarModulo && (
          <button
            id="subtab-smart-cobranca"
            onClick={() => setActiveSubTab('smart-cobranca')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeSubTab === 'smart-cobranca' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-slate-400 hover:text-purple-200'
            }`}
          >
            <Send size={13} className="text-purple-400" /> Smart Cobrança
          </button>
        )}
      </div>

      {/* SUBTAB CONTENT: Recebimentos PIX */}
      {activeSubTab === 'recebimentos' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <DollarSign size={16} className="text-emerald-400" /> Fluxo de Caixa PIX Recente
            </h2>
            
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Search size={14} />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrar por cliente..."
                className="w-full md:w-64 pl-9 pr-4 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs focus:outline-none focus:border-emerald-500 text-slate-100"
              />
            </div>
          </div>

          <div className="bg-slate-900/40 rounded-xl border border-slate-800/80 overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-slate-400 border-b border-slate-800">
                  <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Cliente</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Data/Hora</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Venda / ID</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Instituição</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Valor Recebido</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Status Conciliação</th>
                </tr>
              </thead>
              <tbody>
                {reconciliations
                  .filter(r => r.status === 'Conciliado')
                  .filter(r => r.clienteNome.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((rec) => (
                    <tr key={rec.id} className="border-b border-slate-800/60 hover:bg-slate-800/20">
                      <td className="p-3.5 font-bold text-slate-200">{rec.clienteNome}</td>
                      <td className="p-3.5 text-slate-400">
                        {rec.data} às {rec.hora}
                      </td>
                      <td className="p-3.5 font-mono text-slate-400">{rec.vendaId}</td>
                      <td className="p-3.5 text-slate-300">{rec.instituicao}</td>
                      <td className="p-3.5 font-bold text-emerald-400">R$ {rec.valorRecebido.toFixed(2)}</td>
                      <td className="p-3.5">
                        <span className="py-0.5 px-2 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 flex items-center gap-1 w-max">
                          <CheckCircle2 size={10} /> Conciliado
                        </span>
                      </td>
                    </tr>
                  ))}
                {reconciliations.filter(r => r.status === 'Conciliado').length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center p-8 text-slate-500">
                      Nenhum recebimento PIX conciliado registrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* SUBTAB CONTENT: Cobranças PIX */}
      {activeSubTab === 'cobrancas' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-200">Emitir ou Controlar Cobranças PIX</h2>
              <p className="text-[11px] text-slate-500">Gere cobranças para vendas a prazo em andamento.</p>
            </div>
            
            <div className="flex items-center gap-2">
              <select
                value={chargeFilter}
                onChange={(e) => setChargeFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-xs text-slate-300 rounded-lg py-1.5 px-2.5 focus:outline-none focus:border-emerald-500"
              >
                <option value="todos">Todos os status</option>
                <option value="Aguardando pagamento">Aguardando Pagamento</option>
                <option value="Pago">Pago</option>
                <option value="Estornado">Estornado</option>
              </select>

              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <Search size={14} />
                </span>
                <input
                  type="text"
                  value={chargeSearch}
                  onChange={(e) => setChargeSearch(e.target.value)}
                  placeholder="Pesquisar por cliente..."
                  className="w-full md:w-60 pl-9 pr-4 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs focus:outline-none focus:border-emerald-500 text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Quick Generate Panel for outstanding sales */}
          {outstandingSales.length > 0 && (
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-1.5">
                <AlertCircle size={13} /> Vendas a Prazo Pendentes para Gerar PIX
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {outstandingSales.slice(0, 6).map(sale => {
                  // Check if charge already exists
                  const hasCharge = pixCharges.some(c => c.vendaId === sale.id);
                  return (
                    <div key={sale.id} className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-bold text-slate-200 block truncate">{sale.clientName}</span>
                          <span className="text-[10px] text-slate-500 font-mono">#{sale.id.substring(0, 6)}</span>
                        </div>
                        <span className="text-sm font-bold text-emerald-400 block">R$ {sale.total.toFixed(2)}</span>
                      </div>
                      <button
                        onClick={() => handleGeneratePixForVenda(sale)}
                        disabled={hasCharge}
                        className={`w-full text-center py-1.5 mt-3 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                          hasCharge 
                            ? 'bg-slate-850 text-slate-500 cursor-not-allowed' 
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20'
                        }`}
                      >
                        <Plus size={11} /> {hasCharge ? 'PIX Já Gerado' : 'Gerar Cobrança PIX'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Charges List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pixCharges
              .filter(c => chargeFilter === 'todos' || c.status === chargeFilter)
              .filter(c => c.clienteNome.toLowerCase().includes(chargeSearch.toLowerCase()))
              .map((charge) => (
                <div key={charge.id} className="bg-slate-900/40 border border-slate-800/80 p-4 rounded-xl space-y-4 relative overflow-hidden">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-slate-100">{charge.clienteNome}</span>
                      <span className="text-[10px] text-slate-500 block font-mono mt-0.5">TxID: {charge.txid}</span>
                      <span className="text-[10px] text-slate-400 block mt-1">Vencimento: {new Date(charge.vencimento).toLocaleString('pt-BR')}</span>
                    </div>

                    <span className={`py-0.5 px-2.5 rounded-full text-[10px] font-bold border ${
                      charge.status === 'Pago' 
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                        : charge.status === 'Aguardando pagamento' 
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/20 animate-pulse'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {charge.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 bg-slate-950 p-3 rounded-lg border border-slate-800/50">
                    <img src={charge.qrcode} alt="QR Code PIX" className="w-16 h-16 rounded border border-slate-800" referrerPolicy="no-referrer" />
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <span className="text-[10px] font-bold text-slate-500 block">PIX COPIA E COLA</span>
                      <input
                        readOnly
                        value={charge.copiaECola}
                        className="w-full bg-slate-900 text-[10px] text-slate-400 font-mono rounded px-2 py-1 border border-slate-850 focus:outline-none truncate"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(charge.copiaECola);
                          triggerPushNotification('Copiado', 'Código PIX Copia e Cola copiado para área de transferência', 'success');
                        }}
                        className="text-[9px] font-bold text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        <Plus size={10} /> Copiar Código
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <div className="text-[10px] text-slate-500 font-bold">
                      Canal: <span className="text-slate-300">{charge.instituicao}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {charge.status === 'Pago' && (
                        <button
                          onClick={() => handleRefundPix(charge)}
                          className="py-1 px-2.5 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 text-[10px] font-bold transition-all"
                        >
                          Devolver / Estornar PIX
                        </button>
                      )}
                      
                      {charge.status === 'Aguardando pagamento' && (
                        <button
                          onClick={() => {
                            setSimulatedTxid(charge.txid);
                            setSimulatedValor(charge.valor);
                            setSelectedSimulatedProvider(charge.instituicao.toLowerCase());
                            setShowWebhookSimulator(true);
                          }}
                          className="py-1 px-2.5 rounded bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-[10px] font-bold transition-all"
                        >
                          Simular Liquidação
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            {pixCharges.length === 0 && (
              <div className="col-span-2 text-center p-8 text-slate-500 bg-slate-900/20 rounded-xl border border-dashed border-slate-800">
                Nenhuma cobrança PIX emitida no momento.
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* SUBTAB CONTENT: Instituições Financeiras */}
      {activeSubTab === 'instituicoes' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-200">Provedores de Liquidação PIX</h2>
              <p className="text-[11px] text-slate-500">Cadastre e alterne credenciais sem necessidade de alterar o código-fonte.</p>
            </div>

            <button
              id="btn-add-provider"
              onClick={() => {
                setEditingProvider({
                  id: 'custom_' + Math.random().toString(36).substring(2, 6),
                  name: '',
                  status: 'Inativo',
                  ambiente: 'Homologação'
                });
                setShowProviderModal(true);
              }}
              className="py-1.5 px-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Plus size={14} /> Novo Provedor
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {providersList.map((provider) => {
              const isActive = settings.instituicaoAtiva === provider.id;
              return (
                <div key={provider.id} className={`bg-slate-900/50 rounded-xl p-4 border relative space-y-3 ${
                  isActive ? 'border-emerald-500/40 bg-emerald-950/5' : 'border-slate-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-100">{provider.name}</span>
                      <span className={`ml-2 py-0.5 px-1.5 rounded-full text-[9px] font-bold ${
                        provider.ambiente === 'Produção' ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300'
                      }`}>
                        {provider.ambiente}
                      </span>
                    </div>

                    <button
                      onClick={() => handleSetActiveProvider(provider.id)}
                      className={`text-[10px] py-1 px-2.5 rounded font-bold transition-all border ${
                        isActive 
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400' 
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      {isActive ? 'Provedor Ativo' : 'Ativar Provedor'}
                    </button>
                  </div>

                  <p className="text-[10px] text-slate-500 min-h-6">
                    {provider.observacoes || 'Nenhuma observação ou descrição configurada.'}
                  </p>

                  <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400 font-bold">
                      Ambiente: <span className="text-slate-300 uppercase">{provider.ambiente}</span>
                    </span>

                    <button
                      onClick={() => {
                        // Decrypt keys for editing purposes
                        setEditingProvider({
                          ...provider,
                          apiKey: provider.apiKey ? decryptKey(provider.apiKey) : '',
                          secretKey: provider.secretKey ? decryptKey(provider.secretKey) : '',
                          clientId: provider.clientId ? decryptKey(provider.clientId) : '',
                          clientSecret: provider.clientSecret ? decryptKey(provider.clientSecret) : '',
                        });
                        setShowProviderModal(true);
                      }}
                      className="text-[10px] font-bold text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      <Lock size={11} /> Credenciais / Chaves
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* SUBTAB CONTENT: Conciliação Bancária */}
      {activeSubTab === 'conciliacao' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-200">Conciliação Bancária PIX</h2>
              <p className="text-[11px] text-slate-500">Gerencie depósitos recebidos de forma automática ou avulsa e associe-os às vendas correspondentes.</p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={reconcileFilter}
                onChange={(e) => setReconcileFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-xs text-slate-300 rounded-lg py-1.5 px-2.5 focus:outline-none focus:border-emerald-500"
              >
                <option value="todos">Todas conciliações</option>
                <option value="Pendente">Pendentes</option>
                <option value="Conciliado">Conciliadas</option>
                <option value="Necessita análise">Divergentes / Necessita análise</option>
              </select>
            </div>
          </div>

          <div className="bg-slate-900/40 rounded-xl border border-slate-800/80 overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-slate-400 border-b border-slate-800">
                  <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Origem / Banco</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Cliente Declarado</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Venda / ID</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Esperado</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Recebido</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Divergência</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Data/Hora</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Status</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-[10px] text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {reconciliations
                  .filter(r => reconcileFilter === 'todos' || r.status === reconcileFilter)
                  .map((rec) => (
                    <tr key={rec.id} className="border-b border-slate-800/60 hover:bg-slate-800/20">
                      <td className="p-3.5 text-slate-300 font-bold">{rec.instituicao}</td>
                      <td className="p-3.5 text-slate-200">{rec.clienteNome}</td>
                      <td className="p-3.5 font-mono text-slate-400 text-[11px]">{rec.vendaId}</td>
                      <td className="p-3.5 text-slate-400">R$ {rec.valorEsperado.toFixed(2)}</td>
                      <td className="p-3.5 text-emerald-400 font-bold">R$ {rec.valorRecebido.toFixed(2)}</td>
                      <td className={`p-3.5 font-bold ${rec.diferenca === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        R$ {rec.diferenca.toFixed(2)}
                      </td>
                      <td className="p-3.5 text-slate-400">{rec.data} às {rec.hora}</td>
                      <td className="p-3.5">
                        <span className={`py-0.5 px-2 rounded-full text-[9px] font-bold border flex items-center gap-1 w-max ${
                          rec.status === 'Conciliado' 
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                            : rec.status === 'Pendente' 
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' 
                            : 'bg-red-500/10 text-red-300 border-red-500/20'
                        }`}>
                          {rec.status === 'Conciliado' && <CheckCircle2 size={10} />}
                          {rec.status === 'Pendente' && <AlertTriangle size={10} />}
                          {rec.status === 'Necessita análise' && <AlertCircle size={10} />}
                          {rec.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        {rec.status !== 'Conciliado' ? (
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Suggesting manual associations to open sales */}
                            <select
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleManualReconciliation(rec, e.target.value);
                                }
                              }}
                              className="bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-[9px] text-slate-300 focus:outline-none"
                            >
                              <option value="">Associar à venda...</option>
                              {transactions
                                .filter(t => t.paymentMethod === 'prazo' && t.status === 'pendente')
                                .map(t => (
                                  <option key={t.id} value={t.id}>
                                    {t.clientName} (R$ {t.total.toFixed(2)}) - #{t.id.substring(0, 5)}
                                  </option>
                                ))}
                            </select>

                            <button
                              onClick={() => {
                                handleManualReconciliation(rec, 'Ajuste Manual Direto');
                              }}
                              className="py-1 px-2 rounded bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-[10px] font-bold"
                            >
                              Forçar Baixa
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                {reconciliations.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center p-8 text-slate-500">
                      Nenhuma transação bancária para conciliar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* SUBTAB CONTENT: Histórico & Auditoria */}
      {activeSubTab === 'historico' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <History size={16} className="text-emerald-400" /> Log de Transações & Auditoria Financeira
            </h2>

            <button
              onClick={() => {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(paymentLogs, null, 2));
                const downloadAnchor = document.createElement('a');
                downloadAnchor.setAttribute("href", dataStr);
                downloadAnchor.setAttribute("download", "financeiro_pix_audit_logs.json");
                document.body.appendChild(downloadAnchor);
                downloadAnchor.click();
                downloadAnchor.remove();
                triggerPushNotification('Relatório Exportado', 'Auditoria salva no seu computador', 'success');
              }}
              className="py-1 px-3 border border-slate-800 hover:bg-slate-800 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Download size={13} /> Exportar Logs JSON
            </button>
          </div>

          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 max-h-96 overflow-y-auto space-y-3">
            {paymentLogs.map(log => (
              <div key={log.id} className="p-3 bg-slate-950/40 rounded-lg border border-slate-800/50 flex flex-col md:flex-row justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`py-0.5 px-1.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${
                      log.type === 'error' ? 'bg-red-500/20 text-red-300' :
                      log.type === 'security' ? 'bg-amber-500/20 text-amber-300 animate-pulse' :
                      log.type === 'operation' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {log.type}
                    </span>
                    <span className="text-[11px] font-bold text-slate-200">{log.action}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">{log.details}</p>
                </div>

                <div className="text-[10px] text-slate-500 font-mono self-end md:self-center">
                  {new Date(log.timestamp).toLocaleString('pt-BR')}
                </div>
              </div>
            ))}
            {paymentLogs.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                Nenhum log de auditoria disponível no momento.
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* SUBTAB CONTENT: Configurações Financeiras */}
      {activeSubTab === 'config' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 max-w-2xl">
          <h2 className="text-base font-bold text-slate-200">Definições e Políticas de Processamento</h2>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            onSaveSettings({
              ...settings,
              atualizadoEm: new Date().toISOString()
            });
            addLog('operation', 'Ajuste de Configurações Financeiras', 'Políticas e limites de PIX atualizados.');
            triggerPushNotification('Salvo', 'Políticas de processamento de pagamento atualizadas', 'success');
          }} className="space-y-4 bg-slate-900/40 p-5 rounded-xl border border-slate-800">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">Instituição Financeira Padrão</label>
                <select
                  value={settings.instituicaoPadrao}
                  onChange={(e) => onSaveSettings({ ...settings, instituicaoPadrao: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  {providersList.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">Instituição Ativa</label>
                <select
                  value={settings.instituicaoAtiva}
                  onChange={(e) => handleSetActiveProvider(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-bold text-emerald-300"
                >
                  {providersList.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">API Timeout de Conexão (Segundos)</label>
                <input
                  type="number"
                  value={settings.timeout}
                  onChange={(e) => onSaveSettings({ ...settings, timeout: parseInt(e.target.value) || 30 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">Tentativas Máximas de Conexão</label>
                <input
                  type="number"
                  value={settings.tentativas}
                  onChange={(e) => onSaveSettings({ ...settings, tentativas: parseInt(e.target.value) || 3 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-800/80">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.ativarLogs}
                  onChange={(e) => onSaveSettings({ ...settings, ativarLogs: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-emerald-500 w-4 h-4"
                />
                <div>
                  <span className="text-xs font-bold text-slate-200 block">Registrar Logs Detalhados</span>
                  <span className="text-[10px] text-slate-500 block">Salvar todas as solicitações brutas das APIs bancárias para auditoria.</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.ativarAuditoria}
                  onChange={(e) => onSaveSettings({ ...settings, ativarAuditoria: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-emerald-500 w-4 h-4"
                />
                <div>
                  <span className="text-xs font-bold text-slate-200 block">Auditoria Preventiva Ativada</span>
                  <span className="text-[10px] text-slate-500 block">Bloqueia automaticamente solicitações duplicadas no mesmo segundo para evitar dupla cobrança.</span>
                </div>
              </label>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="py-2 px-5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-bold transition-all"
              >
                Salvar Definições
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* SUBTAB CONTENT: Smart Admin Center Area */}
      {activeSubTab === 'admin-center' && !isAdminAuthorized && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto py-12 space-y-6">
          <div className="bg-slate-900/80 rounded-2xl border border-red-500/20 p-6 shadow-xl space-y-6 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
              <Lock size={24} className="animate-pulse" />
            </div>
            
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-100 tracking-tight text-center">SMART ADMIN CENTER</h2>
              <p className="text-xs text-red-400 font-medium uppercase tracking-widest text-center">Área Protegida</p>
            </div>

            {adminSecurity?.blockedUntil && new Date(adminSecurity.blockedUntil) > new Date() ? (
              <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/20 text-xs text-red-300 space-y-1">
                <p className="font-bold">Acesso Temporariamente Bloqueado</p>
                <p>Múltiplas tentativas incorretas detectadas.</p>
                <p className="font-mono text-red-400 mt-2">
                  Bloqueado até: {new Date(adminSecurity.blockedUntil).toLocaleTimeString('pt-BR')}
                </p>
              </div>
            ) : (
              <form onSubmit={handleAdminPasswordSubmit} className="space-y-4 text-left">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Digite a senha administrativa:
                  </label>
                  <input
                    type="password"
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 font-mono focus:outline-none focus:border-red-500 tracking-widest text-center"
                    autoFocus
                  />
                  {adminPasswordError && (
                    <p className="text-[10px] text-red-400 font-bold mt-2 flex items-center gap-1">
                      <AlertCircle size={10} /> {adminPasswordError}
                    </p>
                  )}
                  {adminSecurity && adminSecurity.failedAttempts > 0 && (
                    <p className="text-[9px] text-slate-500 mt-1 text-center">
                      Tentativas incorretas: {adminSecurity.failedAttempts} de 5
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-red-500 to-amber-600 hover:from-red-600 hover:to-amber-700 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-red-500/10"
                >
                  Entrar
                </button>
              </form>
            )}
          </div>
        </motion.div>
      )}

      {activeSubTab === 'admin-center' && isAdminAuthorized && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          
          {/* Top Banner and lock session button */}
          <div className="flex items-center justify-between bg-red-950/10 border border-red-500/20 p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-red-500/10 text-red-400">
                <ShieldCheck size={20} />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-100">Smart Admin Center Ativo</h2>
                <p className="text-[10px] text-slate-400">Sessão protegida iniciada pelo administrador autenticado.</p>
              </div>
            </div>
            
            <button
              onClick={() => {
                setIsAdminAuthorized(false);
                triggerPushNotification('Sessão Encerrada', 'Sessão administrativa fechada por segurança.', 'info');
              }}
              className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 transition-all border border-slate-700"
            >
              Bloquear Painel
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            
            {/* COLUMN 1: SECURITY & CHANGE PASSWORD */}
            <div className="space-y-6">
              
              {/* Security Card: Change Password */}
              <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-2 border-b border-slate-800 pb-3">
                  <KeyRound size={14} /> 🔐 Segurança: Alterar Senha
                </h3>

                <form onSubmit={handleChangeAdminPassword} className="space-y-3.5 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">Nova Senha Administrativa</label>
                      <input
                        type="password"
                        value={newPasswordInput}
                        onChange={(e) => setNewPasswordInput(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-100 font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-bold mb-1">Confirmar Nova Senha</label>
                      <input
                        type="password"
                        value={confirmNewPasswordInput}
                        onChange={(e) => setConfirmNewPasswordInput(e.target.value)}
                        placeholder="Confirmar nova senha"
                        className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-100 font-mono"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all"
                  >
                    Alterar Senha Administrativa
                  </button>
                </form>
              </div>

              {/* Smart Cobrança Manual Configuration Card */}
              <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Send size={14} /> 📱 Configurações: Smart Cobrança Manual
                </h3>

                <div className="space-y-4 text-xs">
                  {/* Ativar módulo */}
                  <div className="flex items-center justify-between p-3 bg-slate-950/40 rounded-xl border border-slate-850">
                    <div>
                      <h4 className="font-bold text-slate-200">Ativar módulo de cobrança</h4>
                      <p className="text-[10px] text-slate-500">Habilita ou desabilita a aba "Smart Cobrança"</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={smartCobrancaSettings.ativarModulo}
                        onChange={(e) => {
                          const updated = { ...smartCobrancaSettings, ativarModulo: e.target.checked };
                          onSaveSmartCobrancaSettings(updated);
                          triggerPushNotification('Configuração Atualizada', `Módulo de cobrança ${e.target.checked ? 'ativado' : 'desativado'}.`, 'success');
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  {/* Mostrar botão WhatsApp */}
                  <div className="flex items-center justify-between p-3 bg-slate-950/40 rounded-xl border border-slate-850">
                    <div>
                      <h4 className="font-bold text-slate-200">Mostrar botão WhatsApp</h4>
                      <p className="text-[10px] text-slate-500">Exibe botão "Abrir WhatsApp" nas cobranças</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={smartCobrancaSettings.mostrarBotaoWhatsapp}
                        onChange={(e) => {
                          const updated = { ...smartCobrancaSettings, mostrarBotaoWhatsapp: e.target.checked };
                          onSaveSmartCobrancaSettings(updated);
                          triggerPushNotification('Configuração Atualizada', `Exibição do botão WhatsApp ${e.target.checked ? 'ativada' : 'desativada'}.`, 'success');
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  {/* Mostrar botão Copiar */}
                  <div className="flex items-center justify-between p-3 bg-slate-950/40 rounded-xl border border-slate-850">
                    <div>
                      <h4 className="font-bold text-slate-200">Mostrar botão Copiar</h4>
                      <p className="text-[10px] text-slate-500">Exibe os botões "Copiar Mensagem" e "Copiar PIX"</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={smartCobrancaSettings.mostrarBotaoCopiar}
                        onChange={(e) => {
                          const updated = { ...smartCobrancaSettings, mostrarBotaoCopiar: e.target.checked };
                          onSaveSmartCobrancaSettings(updated);
                          triggerPushNotification('Configuração Atualizada', `Exibição dos botões Copiar ${e.target.checked ? 'ativada' : 'desativada'}.`, 'success');
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  {/* Permitir cobrança apenas para vencidos */}
                  <div className="flex items-center justify-between p-3 bg-slate-950/40 rounded-xl border border-slate-850">
                    <div>
                      <h4 className="font-bold text-slate-200">Permitir apenas clientes vencidos</h4>
                      <p className="text-[10px] text-slate-500">Filtra para que cobranças só possam ser geradas para vencidos</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={smartCobrancaSettings.permitirApenasVencidos}
                        onChange={(e) => {
                          const updated = { ...smartCobrancaSettings, permitirApenasVencidos: e.target.checked };
                          onSaveSmartCobrancaSettings(updated);
                          triggerPushNotification('Configuração Atualizada', `Filtro de apenas vencidos ${e.target.checked ? 'ativado' : 'desativado'}.`, 'success');
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Logs Card */}
              <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Clock size={14} /> 📋 Histórico de Acessos & Ações
                </h3>

                <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-none pr-1">
                  {adminSecurityLogs.map((log) => (
                    <div key={log.id} className="p-2.5 bg-slate-950/60 rounded border border-slate-850 flex items-start justify-between gap-3 text-[10px]">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${log.success ? 'bg-emerald-400' : 'bg-red-500'}`} />
                          <span className="font-bold text-slate-200">{log.user}</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-400 font-mono">{log.action}</span>
                        </div>
                        <p className="text-slate-400">{log.details}</p>
                      </div>
                      <span className="text-slate-500 shrink-0 font-mono">
                        {new Date(log.date).toLocaleTimeString('pt-BR')} {new Date(log.date).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  ))}
                  {adminSecurityLogs.length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-4">Nenhum log de acesso disponível.</p>
                  )}
                </div>
              </div>

            </div>

            {/* COLUMN 2: PIX MANAGEMENT & REGISTERED PROVIDERS */}
            <div className="space-y-6">

              {/* Active Provider & Switcher */}
              <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2 border-b border-slate-800 pb-3">
                  <CreditCard size={14} /> 💳 Gerenciamento PIX
                </h3>

                <div className="flex items-center justify-between p-3.5 bg-slate-950/60 rounded-xl border border-slate-850">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Provedor Ativo Atual</span>
                    <h4 className="text-lg font-black text-emerald-400 uppercase tracking-tight">
                      {providersList.find(p => p.status === 'Ativo')?.name || 'Nenhum'}
                    </h4>
                  </div>
                  <span className="px-2.5 py-1 text-[9px] font-black uppercase rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                    Processando PIX
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <label className="block text-slate-400 font-bold">Troca de Provedor Bancário</label>
                  <div className="flex gap-2">
                    <select
                      value={selectedProviderToSwitch}
                      onChange={(e) => setSelectedProviderToSwitch(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-300 font-bold"
                    >
                      <option value="">-- Selecione o Novo Provedor --</option>
                      {providersList.map(p => (
                        <option key={p.id} value={p.id} disabled={p.status === 'Ativo'}>
                          {p.name} {p.status === 'Ativo' ? '(Ativo)' : ''}
                        </option>
                      ))}
                    </select>
                    
                    <button
                      type="button"
                      disabled={!selectedProviderToSwitch}
                      onClick={() => setShowProviderSwitchConfirmModal(true)}
                      className="py-2 px-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:hover:bg-emerald-500 text-slate-950 rounded-lg text-xs font-bold transition-all"
                    >
                      Trocar Provedor
                    </button>
                  </div>
                </div>
              </div>

              {/* Registered Providers list with masked keys */}
              <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Layers size={14} /> 🏦 Provedores e Credenciais Cadastradas
                </h3>

                <div className="space-y-3">
                  {providersList.map((p) => (
                    <div key={p.id} className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-850 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-100 text-xs uppercase tracking-tight">{p.name}</span>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                          p.status === 'Ativo' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500'
                        }`}>
                          {p.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
                        <div>
                          <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold block">Client ID</span>
                          <span className="text-slate-300">
                            {p.clientId ? decryptKey(p.clientId).substring(0, 6) + '••••' : '••••••••'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold block">Client Secret / Secret Key</span>
                          <span className="text-slate-300">••••••••</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                        <span className="text-[9px] text-slate-500 font-bold uppercase">Ambiente: {p.ambiente}</span>
                        <button
                          onClick={() => {
                            setEditingProvider(p);
                            setShowProviderModal(true);
                          }}
                          className="text-[9px] font-black text-amber-400 hover:text-amber-300 transition-all uppercase"
                        >
                          [ Atualizar Credenciais ]
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Auditoria Change log history */}
              <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2 border-b border-slate-800 pb-3">
                  <ShieldAlert size={14} /> 📋 Auditoria: Histórico de Alterações de Provedor
                </h3>

                <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-none pr-1">
                  {providerChangeLogs.map((log) => (
                    <div key={log.id} className="p-2.5 bg-slate-950/60 rounded border border-slate-850 text-[10px] flex justify-between items-center">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 font-bold text-slate-200">
                          <span className="text-red-400 uppercase">{log.oldProvider}</span>
                          <span>→</span>
                          <span className="text-emerald-400 uppercase">{log.newProvider}</span>
                        </div>
                        <p className="text-slate-400">Alterado por <span className="text-slate-200 font-bold">{log.user}</span></p>
                      </div>
                      <div className="text-right font-mono space-y-0.5 text-slate-500">
                        <div>{new Date(log.date).toLocaleDateString('pt-BR')}</div>
                        <div className="text-[9px]">{new Date(log.date).toLocaleTimeString('pt-BR')}</div>
                      </div>
                    </div>
                  ))}
                  {providerChangeLogs.length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-4">Nenhuma alteração de provedor registrada.</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        </motion.div>
      )}

      {/* SUBTAB CONTENT: Smart Cobrança Manual Assistida */}
      {activeSubTab === 'smart-cobranca' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          
          {/* Header row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-purple-500/10 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
                <Send size={18} className="text-purple-400" />
                Smart Cobrança Manual Assistida
              </h2>
              <p className="text-[11px] text-slate-400">
                Selecione os clientes em atraso ou com saldo pendente para preparar as mensagens personalizadas e PIX. O envio é realizado pelo WhatsApp Web do operador.
              </p>
            </div>
            {smartCobrancaSettings.permitirApenasVencidos && (
              <span className="py-1 px-2.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-bold flex items-center gap-1.5">
                <Lock size={12} /> Apenas Vencidos Permitidos
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LEFT COLUMN: LIST OF CLIENTS (lg:col-span-5) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  {/* Search */}
                  <div className="relative flex-1 w-full">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                      <Search size={14} />
                    </span>
                    <input
                      type="text"
                      value={cobrancaSearchTerm}
                      onChange={(e) => setCobrancaSearchTerm(e.target.value)}
                      placeholder="Pesquisar cliente ou telefone..."
                      className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-slate-950 border border-slate-850 text-xs focus:outline-none focus:border-purple-500 text-slate-100"
                    />
                  </div>

                  {/* Filter dropdown */}
                  <select
                    value={selectedCobrancaFilter}
                    onChange={(e) => setSelectedCobrancaFilter(e.target.value as any)}
                    className="w-full sm:w-auto bg-slate-950 border border-slate-850 text-xs text-slate-300 rounded-lg py-1.5 px-2 focus:outline-none focus:border-purple-500"
                  >
                    <option value="todos">Todos com débito</option>
                    <option value="a-vencer">A vencer</option>
                    <option value="vencidos">Vencidos</option>
                    <option value="mais-7-dias">Atraso +7 dias</option>
                    <option value="mais-30-dias">Atraso +30 dias</option>
                  </select>
                </div>

                {/* Client items container */}
                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1 scrollbar-none">
                  {eligibleCobrancaClients.map((client) => {
                    const isSelected = selectedCobrancaClient?.id === client.id;
                    return (
                      <div
                        key={client.id}
                        onClick={() => handleSelectClient(client)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-purple-950/20 border-purple-500/40'
                            : 'bg-slate-950/40 border-slate-850 hover:bg-slate-900/40 hover:border-slate-800'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-200 truncate">{client.name}</span>
                            <span className="text-[9px] text-slate-500 shrink-0">({client.classOrDept})</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400">
                            <span className="font-mono">{client.phone}</span>
                            <span>•</span>
                            <span>{client.quantidadeTitulos} tít.</span>
                            {client.daysInArrears > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-amber-400 font-bold">{client.daysInArrears} dias atraso</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-bold text-xs text-purple-400 block">
                            R$ {client.valorPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                          <span className={`inline-block py-0.5 px-1.5 rounded text-[8px] font-bold uppercase tracking-wider mt-1 ${
                            client.daysInArrears > 30
                              ? 'bg-red-500/10 text-red-300 border border-red-500/20'
                              : client.daysInArrears > 0
                              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                              : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                          }`}>
                            {client.daysInArrears > 0 ? 'Vencido' : 'A Vencer'}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {eligibleCobrancaClients.length === 0 && (
                    <div className="text-center py-12 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                      Nenhum cliente elegível encontrado para esta seleção.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: PREPARATION ENGINE (lg:col-span-7) */}
            <div className="lg:col-span-7 space-y-4">
              {!selectedCobrancaClient ? (
                <div className="bg-slate-900/20 rounded-2xl border border-dashed border-slate-800 p-12 text-center flex flex-col items-center justify-center h-full min-h-[300px]">
                  <Send size={32} className="text-slate-600 mb-3 animate-pulse" />
                  <h3 className="font-bold text-slate-400 text-sm">Nenhum Cliente Selecionado</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Selecione um cliente com saldo pendente na lista à esquerda para carregar a central de preparação de cobrança.
                  </p>
                </div>
              ) : (
                <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 space-y-5">
                  {/* Selected Client Info Header */}
                  <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <span className="text-[9px] font-bold text-purple-400 uppercase tracking-wider">PREPARANDO COBRANÇA PARA</span>
                      <h3 className="font-bold text-base text-slate-200 mt-0.5">{selectedCobrancaClient.name}</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">{selectedCobrancaClient.classOrDept} • {selectedCobrancaClient.email || 'Sem e-mail'}</p>
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] text-slate-500 font-bold uppercase block">TOTAL PENDENTE</span>
                      <span className="text-lg font-black text-purple-400 block">
                        R$ {(selectedCobrancaClient as any).valorPendente?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Warning if apenas vencidos is active and client is a-vencer */}
                  {smartCobrancaSettings.permitirApenasVencidos && (selectedCobrancaClient as any).daysInArrears === 0 ? (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 space-y-2">
                      <div className="flex items-center gap-2 font-bold">
                        <AlertTriangle size={15} />
                        Apenas clientes vencidos permitidos para cobrança
                      </div>
                      <p className="text-[10px] text-slate-400">
                        O sistema está configurado administrativamente para proibir cobranças de títulos a vencer. Por favor, selecione outro cliente ou altere esta restrição no Smart Admin Center.
                      </p>
                    </div>
                  ) : (
                    <>
                      {!cobrancaFinalized ? (
                        <div className="py-12 text-center flex flex-col items-center justify-center space-y-4">
                          <Send size={40} className="text-purple-400 animate-bounce" />
                          <div>
                            <h3 className="font-bold text-slate-300 text-sm">Cobrança Assistida Pronta</h3>
                            <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
                              Clique no botão abaixo para preparar e selecionar o formato de recebimento PIX ideal para este cliente.
                            </p>
                          </div>

                          <button
                            id="btn-enviar-cobranca"
                            onClick={handleStartCobranca}
                            className="py-2.5 px-6 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-lg shadow-purple-600/15"
                          >
                            Enviar Cobrança
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Pix QR and Copy Panel */}
                          {cobrancaMethodUsed === 'copia_e_cola' && preparedPixCharge && (
                            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col sm:flex-row items-center gap-4">
                              <img
                                src={preparedPixCharge.qrcode}
                                alt="QR Code"
                                className="w-24 h-24 rounded border border-slate-800 bg-white p-1 shrink-0"
                                referrerPolicy="no-referrer"
                              />
                              <div className="flex-1 w-full space-y-2 min-w-0">
                                <div>
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Copia e Cola gerado via {preparedPixCharge.instituicao}</span>
                                  <input
                                    readOnly
                                    value={preparedPixCharge.copiaECola}
                                    className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-[10px] font-mono text-slate-300 mt-1 focus:outline-none truncate"
                                  />
                                </div>
                                
                                {smartCobrancaSettings.mostrarBotaoCopiar && (
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(preparedPixCharge.copiaECola);
                                      triggerPushNotification('Copiado', 'PIX Copia e Cola copiado com sucesso!', 'success');
                                      
                                      // Log the interaction
                                      const newLog: PaymentMessageLog = {
                                        id: 'msg_log_' + Math.random().toString(36).substring(2, 9),
                                        cliente: selectedCobrancaClient.name,
                                        telefone: selectedCobrancaClient.phone,
                                        valor: (selectedCobrancaClient as any).valorPendente,
                                        usuario: currentUser?.name || currentUser?.username || 'Operador',
                                        data: new Date().toISOString().split('T')[0],
                                        hora: new Date().toTimeString().split(' ')[0].substring(0, 5),
                                        status: 'PIX Copiado'
                                      };
                                      onSavePaymentMessageLog(newLog);
                                    }}
                                    className="py-1 px-3 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded text-[10px] font-bold transition-all flex items-center gap-1.5"
                                  >
                                    <Check size={12} /> Copiar PIX Copia e Cola
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {cobrancaMethodUsed === 'chave_pix' && (
                            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col sm:flex-row items-center gap-4">
                              <span className="p-3 rounded-xl bg-purple-500/10 text-purple-400 shrink-0">
                                <CreditCard size={24} />
                              </span>
                              <div className="flex-1 w-full space-y-2 min-w-0">
                                <div>
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Chave PIX Registrada para Recebimento</span>
                                  <input
                                    readOnly
                                    value={pixKey}
                                    className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-[10px] font-mono text-slate-300 mt-1 focus:outline-none truncate"
                                  />
                                </div>
                                
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(pixKey);
                                    triggerPushNotification('Copiado', 'Chave PIX copiada com sucesso!', 'success');
                                    
                                    // Log the interaction
                                    const newLog: PaymentMessageLog = {
                                      id: 'msg_log_' + Math.random().toString(36).substring(2, 9),
                                      cliente: selectedCobrancaClient.name,
                                      telefone: selectedCobrancaClient.phone,
                                      valor: (selectedCobrancaClient as any).valorPendente,
                                      usuario: currentUser?.name || currentUser?.username || 'Operador',
                                      data: new Date().toISOString().split('T')[0],
                                      hora: new Date().toTimeString().split(' ')[0].substring(0, 5),
                                      status: 'Chave PIX Copiada'
                                    };
                                    onSavePaymentMessageLog(newLog);
                                  }}
                                  className="py-1 px-3 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded text-[10px] font-bold transition-all flex items-center gap-1.5"
                                >
                                  <Check size={12} /> Copiar Chave PIX
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Message Editor */}
                          <div className="space-y-1.5">
                            <label className="block text-slate-400 text-xs font-bold">Mensagem de Cobrança (Editável)</label>
                            <textarea
                              value={customMessageText}
                              onChange={(e) => setCustomMessageText(e.target.value)}
                              rows={10}
                              className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-purple-500 font-sans leading-relaxed"
                              placeholder="Digite a mensagem de cobrança..."
                            />
                            <div className="text-[10px] text-slate-400 flex items-center justify-between">
                              <span>Sinta-se livre para refinar a mensagem antes de realizar o disparo.</span>
                              <button
                                onClick={() => {
                                  setCobrancaFinalized(false);
                                  setShowCobrancaChoiceModal(true);
                                }}
                                className="text-purple-400 hover:underline font-bold text-[9px]"
                              >
                                Alterar método de PIX
                              </button>
                            </div>
                          </div>

                          {/* Action Footers */}
                          <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-4">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(customMessageText);
                                triggerPushNotification('Copiado', 'Mensagem de cobrança copiada!', 'success');

                                // Log interaction
                                const newLog: PaymentMessageLog = {
                                  id: 'msg_log_' + Math.random().toString(36).substring(2, 9),
                                  cliente: selectedCobrancaClient.name,
                                  telefone: selectedCobrancaClient.phone,
                                  valor: (selectedCobrancaClient as any).valorPendente,
                                  usuario: currentUser?.name || currentUser?.username || 'Operador',
                                  data: new Date().toISOString().split('T')[0],
                                  hora: new Date().toTimeString().split(' ')[0].substring(0, 5),
                                  status: 'Mensagem Copiada'
                                };
                                onSavePaymentMessageLog(newLog);
                              }}
                              className="py-2 px-4 rounded-xl bg-slate-850 hover:bg-slate-755 text-slate-200 text-xs font-bold transition-all flex items-center gap-2 border border-slate-700"
                            >
                              <FileText size={14} /> Copiar Mensagem
                            </button>

                            <button
                              onClick={() => {
                                const codeToCopy = cobrancaMethodUsed === 'copia_e_cola' 
                                  ? (preparedPixCharge?.copiaECola || 'pix@udvcantina.com')
                                  : pixKey;
                                navigator.clipboard.writeText(codeToCopy);
                                triggerPushNotification('Copiado', cobrancaMethodUsed === 'copia_e_cola' ? 'PIX Copia e Cola copiado!' : 'Chave PIX copiada!', 'success');

                                // Log interaction
                                const newLog: PaymentMessageLog = {
                                  id: 'msg_log_' + Math.random().toString(36).substring(2, 9),
                                  cliente: selectedCobrancaClient.name,
                                  telefone: selectedCobrancaClient.phone,
                                  valor: (selectedCobrancaClient as any).valorPendente,
                                  usuario: currentUser?.name || currentUser?.username || 'Operador',
                                  data: new Date().toISOString().split('T')[0],
                                  hora: new Date().toTimeString().split(' ')[0].substring(0, 5),
                                  status: cobrancaMethodUsed === 'copia_e_cola' ? 'PIX Copiado' : 'Chave PIX Copiada'
                                };
                                onSavePaymentMessageLog(newLog);
                              }}
                              className="py-2 px-4 rounded-xl bg-slate-850 hover:bg-slate-755 text-slate-200 text-xs font-bold transition-all flex items-center gap-2 border border-slate-700"
                            >
                              <CreditCard size={14} /> Copiar PIX
                            </button>

                            {smartCobrancaSettings.mostrarBotaoWhatsapp && (
                              <button
                                onClick={() => {
                                  const cleanPhone = selectedCobrancaClient.phone.replace(/[^0-9]/g, '');
                                  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(customMessageText)}`;
                                  
                                  // Log interaction
                                  const newLog: PaymentMessageLog = {
                                    id: 'msg_log_' + Math.random().toString(36).substring(2, 9),
                                    cliente: selectedCobrancaClient.name,
                                    telefone: selectedCobrancaClient.phone,
                                    valor: (selectedCobrancaClient as any).valorPendente,
                                    usuario: currentUser?.name || currentUser?.username || 'Operador',
                                    data: new Date().toISOString().split('T')[0],
                                    hora: new Date().toTimeString().split(' ')[0].substring(0, 5),
                                    status: 'Disparado (wa.me)'
                                  };
                                  onSavePaymentMessageLog(newLog);

                                  // Open WhatsApp Web
                                  window.open(url, '_blank');
                                  triggerPushNotification('Abrindo WhatsApp', 'Redirecionando para o WhatsApp Web...', 'success');
                                }}
                                className="py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-purple-600/15"
                              >
                                <Send size={14} /> Abrir WhatsApp
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* HISTÓRICO DE DISPAROS TABLE (payment_message_log) */}
          <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 space-y-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                <Clock size={14} /> 📋 Histórico de Disparos e Cobranças Manuais
              </h3>
              <p className="text-[10px] text-slate-500 mt-1">
                Logs de todas as mensagens e códigos PIX preparados ou copiados pelos operadores na central assistida.
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-850">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-850">
                    <th className="p-3 font-bold uppercase tracking-wider text-[10px]">Cliente</th>
                    <th className="p-3 font-bold uppercase tracking-wider text-[10px]">Telefone</th>
                    <th className="p-3 font-bold uppercase tracking-wider text-[10px]">Valor</th>
                    <th className="p-3 font-bold uppercase tracking-wider text-[10px]">Data/Hora</th>
                    <th className="p-3 font-bold uppercase tracking-wider text-[10px]">Status do Log</th>
                    <th className="p-3 font-bold uppercase tracking-wider text-[10px]">Operador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 bg-slate-950/20">
                  {paymentMessageLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-900/20 transition-all text-[11px]">
                      <td className="p-3 font-bold text-slate-200">{log.cliente}</td>
                      <td className="p-3 font-mono text-slate-400">{log.telefone}</td>
                      <td className="p-3 font-bold text-purple-400">R$ {log.valor.toFixed(2)}</td>
                      <td className="p-3 text-slate-400">
                        {log.data.split('-').reverse().join('/')} às {log.hora}
                      </td>
                      <td className="p-3">
                        <span className={`inline-block py-0.5 px-2 rounded-full text-[9px] font-bold ${
                          log.status === 'Disparado (wa.me)'
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                            : 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300 font-bold">{log.usuario}</td>
                    </tr>
                  ))}
                  {paymentMessageLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center p-8 text-slate-500 text-xs font-mono">
                        Nenhum disparo ou preparação de cobrança registrado no banco de dados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* CONFIRMATION MODAL FOR MANUAL PROVIDER SWITCH */}
      {showProviderSwitchConfirmModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-slate-900 rounded-2xl max-w-md w-full border border-red-500/20 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-2.5 text-red-400 border-b border-slate-800 pb-3">
              <ShieldAlert size={20} className="animate-bounce" />
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-100">Confirmação de Segurança</h3>
            </div>

            <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed">
              <p className="font-bold text-red-400 uppercase tracking-wide">
                ATENÇÃO: Você está alterando o provedor responsável pelos recebimentos PIX do SmartPOS.
              </p>
              
              <div className="grid grid-cols-2 gap-4 p-3.5 bg-slate-950 rounded-xl border border-slate-850 text-center">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block mb-0.5">Provedor Atual</span>
                  <span className="text-red-400 font-bold uppercase tracking-wider text-sm">
                    {providersList.find(p => p.status === 'Ativo')?.name || settings.instituicaoAtiva}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block mb-0.5">Novo Provedor</span>
                  <span className="text-emerald-400 font-bold uppercase tracking-wider text-sm">
                    {providersList.find(p => p.id === selectedProviderToSwitch)?.name || selectedProviderToSwitch}
                  </span>
                </div>
              </div>

              <p className="text-slate-400">
                A próxima cobrança PIX criada utilizará o novo provedor. Isso não afetará cobranças antigas ou históricos de vendas já existentes. Deseja realmente continuar?
              </p>
            </div>

            <div className="flex gap-2.5 justify-end pt-2">
              <button
                onClick={() => {
                  setShowProviderSwitchConfirmModal(false);
                  setSelectedProviderToSwitch('');
                }}
                className="py-1.5 px-3.5 rounded bg-slate-800 text-slate-400 font-bold text-xs"
              >
                CANCELAR
              </button>
              <button
                onClick={handleConfirmProviderSwitch}
                className="py-1.5 px-4 rounded bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs uppercase"
              >
                CONFIRMAR ALTERAÇÃO
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* SUBTAB CONTENT: IA Gemini Assistant Panel */}
      {activeSubTab === 'ia' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-amber-500/20 text-amber-400">
              <Sparkles size={16} />
            </span>
            <h2 className="text-base font-bold text-slate-200">Painel de Inteligência Financeira</h2>
          </div>

          {!aiAnalysisResult && !isAIAnalyzing && (
            <div className="bg-slate-900/40 rounded-xl p-8 border border-slate-800 text-center space-y-4">
              <span className="inline-block p-4 rounded-full bg-amber-500/10 text-amber-400">
                <Sparkles size={36} className="animate-pulse" />
              </span>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-sm font-bold text-slate-200">Precisa Auditar suas Finanças?</h3>
                <p className="text-xs text-slate-500">
                  Nosso motor de Inteligência Artificial Gemini vasculha seu histórico de cobranças PIX, as movimentações bancárias reais e as vendas registradas para detectar furos, fraudes ou incoerências.
                </p>
              </div>
              <button
                onClick={runAIFinancialAudit}
                className="py-2 px-6 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-all"
              >
                Executar Auditoria Inteligente
              </button>
            </div>
          )}

          {isAIAnalyzing && (
            <div className="bg-slate-900/40 rounded-xl p-12 border border-slate-800 text-center space-y-3">
              <RotateCw size={36} className="animate-spin text-amber-400 mx-auto" />
              <p className="text-xs text-slate-300 font-bold">O Gemini está cruzando e auditando as tabelas financeiras...</p>
              <p className="text-[10px] text-slate-500">Verificando transações duplicadas, pagamentos parciais e riscos de fraude.</p>
            </div>
          )}

          {aiAnalysisResult && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Report Summary Card */}
              <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 lg:col-span-2 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <FileText size={13} /> Relatório Inteligente Emitido
                </h3>
                
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-850 text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-line">
                  {aiAnalysisResult.relatorioTexto}
                </div>
              </div>

              {/* Alerts & Insights Sidebar */}
              <div className="space-y-4">
                {/* Duplicities Section */}
                <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 space-y-3">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                    <AlertCircle size={13} /> Alertas de Duplicidade ({aiAnalysisResult.duplicidades.length})
                  </h4>
                  {aiAnalysisResult.duplicidades.map((dup, i) => (
                    <div key={i} className="p-2.5 bg-red-950/10 rounded border border-red-500/20 text-[11px]">
                      <div className="flex justify-between font-bold text-red-300">
                        <span>{dup.clienteNome}</span>
                        <span>R$ {dup.valor.toFixed(2)}</span>
                      </div>
                      <p className="text-slate-400 text-[10px] mt-1">{dup.motivo}</p>
                    </div>
                  ))}
                  {aiAnalysisResult.duplicidades.length === 0 && (
                    <p className="text-[11px] text-slate-500">Nenhum pagamento duplicado detectado.</p>
                  )}
                </div>

                {/* Frauds/Anomalies Section */}
                <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 space-y-3">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                    <AlertTriangle size={13} /> Anomalias Detectadas ({aiAnalysisResult.fraudes.length})
                  </h4>
                  {aiAnalysisResult.fraudes.map((f, i) => (
                    <div key={i} className="p-2.5 bg-orange-950/10 rounded border border-orange-500/20 text-[11px]">
                      <span className="font-bold text-orange-300 block">{f.titulo}</span>
                      <p className="text-slate-400 text-[10px] mt-1">{f.descricao}</p>
                      <span className={`text-[9px] font-bold block mt-1.5 uppercase ${
                        f.severidade === 'alta' ? 'text-red-400' : 'text-amber-400'
                      }`}>
                        Risco: {f.severidade}
                      </span>
                    </div>
                  ))}
                  {aiAnalysisResult.fraudes.length === 0 && (
                    <p className="text-[11px] text-slate-500">Nenhuma anomalia grave encontrada.</p>
                  )}
                </div>

                {/* Suggestions Section */}
                <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 space-y-3">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 size={13} /> Sugestões de Conciliação ({aiAnalysisResult.sugestoesConciliacao.length})
                  </h4>
                  {aiAnalysisResult.sugestoesConciliacao.map((sug, i) => (
                    <div key={i} className="p-2.5 bg-emerald-950/10 rounded border border-emerald-500/20 text-[11px] space-y-2">
                      <div>
                        <div className="flex justify-between font-bold text-emerald-300">
                          <span>{sug.clienteNome}</span>
                          <span>Confiança: {sug.confianca}%</span>
                        </div>
                        <p className="text-slate-400 text-[10px] mt-1">{sug.motivo}</p>
                      </div>
                      
                      <button
                        onClick={() => {
                          const rec = reconciliations.find(r => r.id === sug.reconciliationId);
                          if (rec) {
                            handleManualReconciliation(rec, sug.vendaId);
                          }
                        }}
                        className="w-full text-center py-1 bg-emerald-500 text-slate-950 rounded text-[10px] font-bold transition-all"
                      >
                        Aprovar Associação
                      </button>
                    </div>
                  ))}
                  {aiAnalysisResult.sugestoesConciliacao.length === 0 && (
                    <p className="text-[11px] text-slate-500">Sem sugestões pendentes no momento.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* WEBHOOK SIMULATOR MODAL */}
      {showWebhookSimulator && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fade-in">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-slate-900 rounded-2xl max-w-md w-full border border-slate-800 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <Activity size={15} className="text-emerald-400" /> Simulador de Webhook Bancário
              </h3>
              <button onClick={() => setShowWebhookSimulator(false)} className="text-slate-500 hover:text-slate-300">
                <X size={16} />
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              Simule a resposta instantânea em segundo plano de uma liquidação PIX enviada pela Stone ou qualquer outro banco ativo.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Escolher Provedor que Notifica</label>
                <select
                  value={selectedSimulatedProvider}
                  onChange={(e) => setSelectedSimulatedProvider(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-300"
                >
                  {providersList.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">TxID do Pagamento (ID Interno Pix)</label>
                <input
                  type="text"
                  value={simulatedTxid}
                  onChange={(e) => setSimulatedTxid(e.target.value)}
                  placeholder="Ex: stone_abc123"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-300 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Valor do Pagamento Recebido (R$)</label>
                <input
                  type="number"
                  value={simulatedValor}
                  onChange={(e) => setSimulatedValor(parseFloat(e.target.value) || 0)}
                  placeholder="Ex: 15.00"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-300"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2.5">
              <button
                onClick={() => setShowWebhookSimulator(false)}
                className="py-1.5 px-3.5 rounded bg-slate-800 text-slate-400 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleSimulateWebhook(simulatedTxid, simulatedValor, selectedSimulatedProvider)}
                className="py-1.5 px-4 rounded bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold transition-all"
              >
                Disparar Webhook de Confirmação
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* CREDENTIALS / ADD PROVIDER MODAL */}
      {showProviderModal && editingProvider && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fade-in">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-800 p-5 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <Lock size={15} className="text-emerald-400" /> Configurar Credenciais - {editingProvider.name || 'Provedor'}
              </h3>
              <button onClick={() => setShowProviderModal(false)} className="text-slate-500 hover:text-slate-300">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveProviderCredentials} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Nome do Banco / Provedor</label>
                  <input
                    type="text"
                    required
                    value={editingProvider.name || ''}
                    onChange={(e) => setEditingProvider({ ...editingProvider, name: e.target.value })}
                    placeholder="Ex: Stone S.A."
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Identificador Provedor</label>
                  <input
                    type="text"
                    required
                    disabled={providersList.some(p => p.id === editingProvider.id)}
                    value={editingProvider.id || ''}
                    onChange={(e) => setEditingProvider({ ...editingProvider, id: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                    placeholder="Ex: stone_custom"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-300 font-mono disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Ambiente Ativo</label>
                  <select
                    value={editingProvider.ambiente}
                    onChange={(e) => setEditingProvider({ ...editingProvider, ambiente: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-300"
                  >
                    <option value="Homologação">Homologação (Sandbox)</option>
                    <option value="Produção">Produção (Live)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">URL de Callback / Webhook</label>
                  <input
                    type="url"
                    value={editingProvider.webhookUrl || ''}
                    onChange={(e) => setEditingProvider({ ...editingProvider, webhookUrl: e.target.value })}
                    placeholder="https://api.meusite.com/webhook/pix"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-300 font-mono text-[10px]"
                  />
                </div>
              </div>

              <div className="border-t border-slate-800/80 pt-3 space-y-3">
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 block">Chaves Sensíveis & Credenciais Criptografadas</span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">API Key / Token de Acesso</label>
                    <div className="relative">
                      <input
                        type={showSensitiveKeys['apiKey'] ? 'text' : 'password'}
                        value={editingProvider.apiKey || ''}
                        onChange={(e) => setEditingProvider({ ...editingProvider, apiKey: e.target.value })}
                        placeholder="Insira a API Key"
                        className="w-full bg-slate-950 border border-slate-800 rounded pl-2.5 pr-8 py-2 text-slate-300 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSensitiveKeys({ ...showSensitiveKeys, apiKey: !showSensitiveKeys['apiKey'] })}
                        className="absolute inset-y-0 right-2 flex items-center text-slate-500 hover:text-slate-300"
                      >
                        {showSensitiveKeys['apiKey'] ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Secret Key / Chave Secreta</label>
                    <div className="relative">
                      <input
                        type={showSensitiveKeys['secretKey'] ? 'text' : 'password'}
                        value={editingProvider.secretKey || ''}
                        onChange={(e) => setEditingProvider({ ...editingProvider, secretKey: e.target.value })}
                        placeholder="Insira a Secret Key"
                        className="w-full bg-slate-950 border border-slate-800 rounded pl-2.5 pr-8 py-2 text-slate-300 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSensitiveKeys({ ...showSensitiveKeys, secretKey: !showSensitiveKeys['secretKey'] })}
                        className="absolute inset-y-0 right-2 flex items-center text-slate-500 hover:text-slate-300"
                      >
                        {showSensitiveKeys['secretKey'] ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Client ID</label>
                    <div className="relative">
                      <input
                        type={showSensitiveKeys['clientId'] ? 'text' : 'password'}
                        value={editingProvider.clientId || ''}
                        onChange={(e) => setEditingProvider({ ...editingProvider, clientId: e.target.value })}
                        placeholder="Insira o Client ID"
                        className="w-full bg-slate-950 border border-slate-800 rounded pl-2.5 pr-8 py-2 text-slate-300 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSensitiveKeys({ ...showSensitiveKeys, clientId: !showSensitiveKeys['clientId'] })}
                        className="absolute inset-y-0 right-2 flex items-center text-slate-500 hover:text-slate-300"
                      >
                        {showSensitiveKeys['clientId'] ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Client Secret</label>
                    <div className="relative">
                      <input
                        type={showSensitiveKeys['clientSecret'] ? 'text' : 'password'}
                        value={editingProvider.clientSecret || ''}
                        onChange={(e) => setEditingProvider({ ...editingProvider, clientSecret: e.target.value })}
                        placeholder="Insira o Client Secret"
                        className="w-full bg-slate-950 border border-slate-800 rounded pl-2.5 pr-8 py-2 text-slate-300 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSensitiveKeys({ ...showSensitiveKeys, clientSecret: !showSensitiveKeys['clientSecret'] })}
                        className="absolute inset-y-0 right-2 flex items-center text-slate-500 hover:text-slate-300"
                      >
                        {showSensitiveKeys['clientSecret'] ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Observações Internas</label>
                <textarea
                  value={editingProvider.observacoes || ''}
                  onChange={(e) => setEditingProvider({ ...editingProvider, observacoes: e.target.value })}
                  rows={2}
                  placeholder="Ex: Conta jurídica para liquidação imediata..."
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-300"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowProviderModal(false)}
                  className="py-1.5 px-3.5 rounded bg-slate-800 text-slate-400 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-1.5 px-4 rounded bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold transition-all"
                >
                  Salvar Credenciais
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* COBRANÇA FORMAT CHOICE MODAL */}
      {showCobrancaChoiceModal && selectedCobrancaClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Send size={16} className="text-purple-400" /> Preparar Cobrança Manual
              </h3>
              <button
                onClick={() => setShowCobrancaChoiceModal(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-300 font-medium">Como deseja enviar o PIX?</p>
              
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 bg-slate-950/50 rounded-xl border border-slate-800 cursor-pointer hover:border-purple-500/50 transition-colors">
                  <input
                    type="radio"
                    name="cobranca_method"
                    value="copia_e_cola"
                    checked={tempCobrancaOption === 'copia_e_cola'}
                    onChange={() => setTempCobrancaOption('copia_e_cola')}
                    className="mt-0.5 accent-purple-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">PIX Copia e Cola (recomendado)</span>
                    <span className="text-[10px] text-slate-400">Gera um código PIX copia e cola correspondente exatamente ao valor pendente do cliente.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 bg-slate-950/50 rounded-xl border border-slate-800 cursor-pointer hover:border-purple-500/50 transition-colors">
                  <input
                    type="radio"
                    name="cobranca_method"
                    value="chave_pix"
                    checked={tempCobrancaOption === 'chave_pix'}
                    onChange={() => setTempCobrancaOption('chave_pix')}
                    className="mt-0.5 accent-purple-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">Chave PIX cadastrada</span>
                    <span className="text-[10px] text-slate-400">Envia apenas a chave PIX registrada. O cliente informará o valor manualmente em seu aplicativo bancário.</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => setShowCobrancaChoiceModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmCobrancaMethod}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
