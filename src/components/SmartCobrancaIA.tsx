/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Client, Transaction, SmartCobrancaSettings, SmartCollection } from '../types';
import { 
  MessageSquare, Settings, History, Sparkles, Clock, Calendar, 
  AlertCircle, CheckCircle2, Trash, Plus, Play, Send, RefreshCw, 
  Sliders, ShieldAlert, X, Edit, PhoneCall, Copy, ArrowRight, Check, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { aiCollectionService } from '../lib/aiCollectionService';
import { getProvider, MessagePayload, ProviderType } from '../lib/messagingProvider';
import { saveSmartCobrancaSettingsInCloud, saveSmartCollectionInCloud, deleteSmartCollectionInCloud } from '../lib/firebaseService';
import { INITIAL_PROVIDERS_CONFIG, createProviderInstance } from '../providers/payments/ProviderRegistry';

interface SmartCobrancaIAProps {
  clients: Client[];
  transactions: Transaction[];
  smartCollections: SmartCollection[];
  settings: SmartCobrancaSettings;
  onSaveSettings: (settings: SmartCobrancaSettings) => void;
  onSaveCollection: (collection: SmartCollection) => void;
  onDeleteCollection: (id: string) => void;
  triggerPushNotification: (title: string, body: string, type?: 'info' | 'success' | 'warn') => void;
  pixKey: string;
  paymentProviders?: any[];
}

const DEFAULT_SETTINGS: SmartCobrancaSettings = {
  ativarModulo: true,
  modoEnvio: 'manual',
  providerId: 'whatsapp_manual',
  maximoCobrancas: 3,
  intervaloPadrao: 'semanal',
  modeloPadrao: 'Olá {cliente}! 😊 Passando para lembrar do seu saldo em aberto de {saldo} na cantina. Se precisar negociar, estamos à disposição. Abraços!',
  horarioInicio: '08:00',
  horarioFim: '18:00',
  naoSabado: true,
  naoDomingo: true,
  naoFeriados: true,
  pararAoPagar: true,
  pararAposMaximo: true,
  tomCobranca: 'educado',
  mostrarBotaoWhatsapp: true,
  mostrarBotaoCopiar: true,
  permitirApenasVencidos: false
};

export default function SmartCobrancaIA({
  clients,
  transactions,
  smartCollections,
  settings = DEFAULT_SETTINGS,
  onSaveSettings,
  onSaveCollection,
  onDeleteCollection,
  triggerPushNotification,
  pixKey,
  paymentProviders = []
}: SmartCobrancaIAProps) {
  const [activeSubTab, setActiveSubTab] = useState<'painel' | 'historico' | 'config'>('painel');
  const [searchTerm, setSearchTerm] = useState('');
  
  const providersList = useMemo(() => {
    if (!paymentProviders || paymentProviders.length === 0) {
      return INITIAL_PROVIDERS_CONFIG;
    }
    return paymentProviders;
  }, [paymentProviders]);
  
  // AI States
  const [analyzingClientId, setAnalyzingClientId] = useState<string | null>(null);
  const [clientAnalysis, setClientAnalysis] = useState<{ [clientId: string]: any }>({});
  
  // Custom message modal state
  const [modalClient, setModalClient] = useState<Client | null>(null);
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [customTone, setCustomTone] = useState<'amigável' | 'educado' | 'formal' | 'firme' | 'muito firme'>('educado');
  const [generatingMessage, setGeneratingMessage] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [tempMessageId, setTempMessageId] = useState<string | null>(null); // For logging simulation
  const [currentGeneratedCopiaECola, setCurrentGeneratedCopiaECola] = useState('');

  // Dashboard metric / summary state
  const [dashboardSummary, setDashboardSummary] = useState('');
  const [generatingSummary, setGeneratingSummary] = useState(false);

  // Filters for History Tab
  const [historySearch, setHistorySearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  // Filter clients with outstanding debts (balance < 0)
  const debtors = useMemo(() => {
    return clients
      .filter(c => c.balance < 0)
      .map(c => {
        // Calculate days overdue based on oldest unpaid "prazo" transaction
        const clientTx = transactions.filter(t => t.clientId === c.id && t.paymentMethod === 'prazo' && t.status === 'pendente');
        const timestamps = clientTx.map(t => new Date(t.timestamp).getTime());
        const oldestTimestamp = timestamps.length > 0 ? Math.min(...timestamps) : Date.now();
        const daysOverdue = Math.max(1, Math.ceil((Date.now() - oldestTimestamp) / (1000 * 60 * 60 * 24)));
        
        // Find existing collections for this client
        const history = smartCollections.filter(sc => sc.clienteId === c.id);
        const sentCount = history.filter(h => h.status === 'Enviada').length;
        const pendingSchedule = history.find(h => h.status === 'Agendada');

        return {
          ...c,
          daysOverdue,
          sentCount,
          pendingSchedule,
          history
        };
      })
      .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [clients, transactions, smartCollections, searchTerm]);

  // Total negative balances
  const totalOutstanding = useMemo(() => {
    return clients.reduce((sum, c) => c.balance < 0 ? sum + Math.abs(c.balance) : sum, 0);
  }, [clients]);

  // Synchronize / create scheduled collection records automatically when settings/clients change
  useEffect(() => {
    if (!settings.ativarModulo || settings.modoEnvio !== 'automatico') return;

    // Check all debtors and ensure they have a scheduled "Agendada" collection record if they have negative balance
    debtors.forEach(debtor => {
      const activeSchedule = smartCollections.find(sc => sc.clienteId === debtor.id && sc.status === 'Agendada');
      if (!activeSchedule) {
        // Automatically schedule next collection
        const proximoEnvioDate = new Date();
        // Shift depending on the settings interval
        if (settings.intervaloPadrao === 'diario') proximoEnvioDate.setDate(proximoEnvioDate.getDate() + 1);
        else if (settings.intervaloPadrao === 'semanal') proximoEnvioDate.setDate(proximoEnvioDate.getDate() + 7);
        else if (settings.intervaloPadrao === 'quinzenal') proximoEnvioDate.setDate(proximoEnvioDate.getDate() + 15);
        else proximoEnvioDate.setMonth(proximoEnvioDate.getMonth() + 1);

        // Respect weekend exclusions
        let day = proximoEnvioDate.getDay();
        if (settings.naoSabado && day === 6) proximoEnvioDate.setDate(proximoEnvioDate.getDate() + 2); // skip to Monday
        else if (settings.naoDomingo && day === 0) proximoEnvioDate.setDate(proximoEnvioDate.getDate() + 1); // skip to Monday

        // Setup base message
        const rawMsg = settings.modeloPadrao
          .replace('{cliente}', debtor.name.split(' ')[0])
          .replace('{saldo}', `R$ ${Math.abs(debtor.balance).toFixed(2)}`);

        const newSchedule: SmartCollection = {
          id: 'sc_' + Math.random().toString(36).substring(2, 9),
          clienteId: debtor.id,
          clienteNome: debtor.name,
          valor: Math.abs(debtor.balance),
          saldo: Math.abs(debtor.balance),
          tipo: 'automatica',
          manual: false,
          automatica: true,
          mensagem: rawMsg,
          proximoEnvio: proximoEnvioDate.toLocaleDateString('pt-BR') + ` às ${settings.horarioInicio}`,
          quantidadeEnviada: debtor.sentCount,
          maximoCobrancas: settings.maximoCobrancas,
          intervalo: settings.intervaloPadrao,
          status: 'Agendada',
          criadoEm: new Date().toISOString(),
          atualizadoEm: new Date().toISOString()
        };

        onSaveCollection(newSchedule);
      } else {
        // Rule: "Se a dívida aumentar ou renegociar: Atualizar automaticamente o valor informado ou cronograma."
        const absBal = Math.abs(debtor.balance);
        if (Math.abs(activeSchedule.valor - absBal) > 0.05) {
          const updatedSchedule = {
            ...activeSchedule,
            valor: absBal,
            saldo: absBal,
            mensagem: settings.modeloPadrao
              .replace('{cliente}', debtor.name.split(' ')[0])
              .replace('{saldo}', `R$ ${absBal.toFixed(2)}`),
            atualizadoEm: new Date().toISOString()
          };
          onSaveCollection(updatedSchedule);
        }
      }
    });

    // Rule: "Se o cliente pagar (balance >= 0): Cancelar automaticamente todas as cobranças futuras."
    smartCollections.forEach(sc => {
      if (sc.status === 'Agendada') {
        const client = clients.find(c => c.id === sc.clienteId);
        if (!client || client.balance >= 0) {
          const cancelledSchedule: SmartCollection = {
            ...sc,
            status: 'Cancelada',
            atualizadoEm: new Date().toISOString()
          };
          onSaveCollection(cancelledSchedule);
          triggerPushNotification('Cobrança Cancelada', `A cobrança agendada para ${sc.clienteNome} foi cancelada pois o saldo foi quitado.`, 'info');
        }
      }
    });

  }, [clients, settings, smartCollections]);

  // AI-powered client analyzer
  const handleAnalyzeClient = async (debtor: any) => {
    setAnalyzingClientId(debtor.id);
    try {
      const result = await aiCollectionService.AnalisarCliente({
        name: debtor.name,
        balance: debtor.balance,
        daysOverdue: debtor.daysOverdue,
        totalSalesCount: debtor.history.length || debtor.sentCount + 3, // simulation fallback
        previousCount: debtor.sentCount
      });
      setClientAnalysis(prev => ({ ...prev, [debtor.id]: result }));
      triggerPushNotification('Análise de IA Concluída', `Perfil de cobrança de ${debtor.name} atualizado.`, 'success');
    } catch (error) {
      console.error(error);
      triggerPushNotification('Erro na IA', 'Falha ao analisar comportamento do devedor.', 'warn');
    } finally {
      setAnalyzingClientId(null);
    }
  };

  // Generate Executive Summary
  const handleGenerateSummary = async () => {
    setGeneratingSummary(true);
    try {
      const simplifiedDebts = debtors.map(d => ({
        name: d.name,
        balance: d.balance,
        daysOverdue: d.daysOverdue
      }));
      const res = await aiCollectionService.GerarResumo(simplifiedDebts);
      setDashboardSummary(res);
      triggerPushNotification('Relatório Inteligente', 'Resumo analítico gerado com sucesso por Gemini IA.', 'success');
    } catch (error) {
      console.error(error);
    } finally {
      setGeneratingSummary(false);
    }
  };

  // Prepare custom collection message via AI or template
  const handleOpenBillingMessage = async (debtor: any, isAI = true) => {
    setModalClient(debtor);
    setGeneratingMessage(true);
    setShowMessageModal(true);
    
    // Choose tone based on days overdue if not set
    const recommendedTone = await aiCollectionService.GerarTom(debtor.daysOverdue);
    setCustomTone(recommendedTone);

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

    // Filter only transactions with status PENDENTE
    const pendingTx = transactions
      .filter(t => 
        t.clientId === debtor.id && 
        t.paymentMethod === 'prazo' && 
        t.status === 'pendente'
      )
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()); // oldest first
    
    const valorPendente = pendingTx.reduce((sum, tx) => sum + tx.total, 0);

    // Generate dynamic PIX Copia e Cola charge based exactly on outstanding transactions total
    let copiaEColaCode = 'pix@udvcantina.com';
    try {
      const activeConf = providersList.find(p => p.status === 'Ativo') || providersList[0];
      const paymentProviderInstance = createProviderInstance(activeConf);
      const txid = 'cob_ia_' + Math.random().toString(36).substring(2, 9);
      if (valorPendente > 0) {
        const charge = await paymentProviderInstance.createPixCharge(
          txid,
          debtor.id,
          debtor.name,
          valorPendente
        );
        if (charge && charge.copiaECola) {
          copiaEColaCode = charge.copiaECola;
        }
      }
    } catch (err) {
      console.error('Erro ao gerar PIX para IA:', err);
    }
    setCurrentGeneratedCopiaECola(copiaEColaCode);

    const items: any[] = [];
    pendingTx.forEach(tx => {
      const dateStr = formatDate(tx.timestamp);
      tx.items.forEach(it => {
        items.push({
          date: dateStr,
          productName: it.productName,
          quantity: it.quantity,
          price: it.price,
          total: it.price * it.quantity
        });
      });
    });

    if (isAI) {
      try {
        const message = await aiCollectionService.GerarMensagem({
          name: debtor.name,
          balance: valorPendente, // pass outstanding balance
          daysOverdue: debtor.daysOverdue,
          previousCount: debtor.sentCount,
          tone: recommendedTone,
          pixKey: pixKey,
          copiaECola: copiaEColaCode,
          items: items
        });
        setGeneratedMessage(message);
      } catch (error) {
        console.error(error);
      } finally {
        setGeneratingMessage(false);
      }
    } else {
      // Manual standard template following exact structure requested by user
      const fillDots = (left: string, right: string, targetLength: number = 38) => {
        const currentLength = left.length + right.length;
        if (currentLength >= targetLength) {
          return `${left} ${right}`;
        }
        const dotsCount = targetLength - currentLength;
        const dots = '.'.repeat(dotsCount);
        return `${left} ${dots} ${right}`;
      };

      let listagemString = '';
      pendingTx.forEach(tx => {
        const dateStr = formatDate(tx.timestamp);
        listagemString += `Compra ${dateStr}\n`;
        tx.items.forEach(item => {
          const unitPriceFormatted = item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
          const subtotalFormatted = (item.price * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
          const leftStr = `${item.quantity} × ${item.productName} (un: R$ ${unitPriceFormatted})`;
          const rightStr = `R$ ${subtotalFormatted}`;
          listagemString += `${fillDots(leftStr, rightStr)}\n`;
        });
        const subtotalVal = tx.total;
        const leftSub = 'Subtotal desta compra';
        const rightSub = `R$ ${subtotalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        listagemString += `${fillDots(leftSub, rightSub)}\n\n`;
      });

      const formattedBalance = valorPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

      const standardMsg = `Olá, ${debtor.name}! 😊\n\nEsperamos que esteja tudo bem com você.\n\nIdentificamos que existem pagamentos pendentes em sua conta na Cantina Smart.\n\nSeguem os produtos que permanecem em aberto:\n\n${listagemString}--------------------------------\nTOTAL DO SALDO DEVEDOR: R$ ${formattedBalance}\n\nVocê pode realizar o pagamento utilizando:\n\n• PIX Copia e Cola\n${copiaEColaCode}\n\nou\n\n• Chave PIX\nChave PIX: ${pixKey}\n\nAssim que o pagamento for identificado, sua conta será atualizada automaticamente.\n\nCaso este pagamento já tenha sido realizado, por favor, desconsidere esta mensagem.\n\nAgradecemos pela confiança e preferência!`;
      setGeneratedMessage(standardMsg);
      setGeneratingMessage(false);
    }

    // Schedule ID representation in history if user registers sending
    const scheduleId = debtor.pendingSchedule?.id || 'sc_' + Math.random().toString(36).substring(2, 9);
    setTempMessageId(scheduleId);
  };

  // Dispatch final message via current active Provider
  const handleDispatchMessage = async () => {
    if (!modalClient) return;

    const provider = getProvider(settings.providerId);
    const payload: MessagePayload = {
      to: modalClient.phone,
      message: generatedMessage,
      clientId: modalClient.id,
      clientName: modalClient.name
    };

    try {
      const res = await provider.sendMessage(payload);
      
      // Update or create collection history record in Firestore
      const isAuto = settings.modoEnvio === 'automatico' && res.type === 'automatic';
      const historyRecord: SmartCollection = {
        id: tempMessageId || 'sc_' + Math.random().toString(36).substring(2, 9),
        clienteId: modalClient.id,
        clienteNome: modalClient.name,
        valor: Math.abs(modalClient.balance),
        saldo: Math.abs(modalClient.balance),
        tipo: isAuto ? 'automatica' : 'manual',
        manual: !isAuto,
        automatica: isAuto,
        mensagem: generatedMessage,
        dataEnvio: new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        quantidadeEnviada: (modalClient.sentCount || 0) + 1,
        maximoCobrancas: settings.maximoCobrancas,
        intervalo: settings.intervaloPadrao,
        status: 'Enviada',
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
      };

      onSaveCollection(historyRecord);
      setShowMessageModal(false);
      triggerPushNotification('Mensagem Despachada', `Cobrança via ${provider.name} enviada com sucesso!`, 'success');
    } catch (error) {
      console.error(error);
      triggerPushNotification('Falha de Envio', 'Não foi possível disparar a cobrança.', 'warn');
    }
  };

  // Simulate automatic batch run of scheduled items
  const handleSimulateBatchDispatches = async () => {
    const scheduled = smartCollections.filter(sc => sc.status === 'Agendada');
    if (scheduled.length === 0) {
      triggerPushNotification('Fila Vazia', 'Não há cobranças agendadas na fila hoje.', 'info');
      return;
    }

    triggerPushNotification('Iniciando Simulação', `Disparando ${scheduled.length} cobranças automáticas pela fila...`);
    
    for (const sc of scheduled) {
      // Simulate automatic dispatching
      const updatedRecord: SmartCollection = {
        ...sc,
        status: 'Enviada',
        dataEnvio: new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        quantidadeEnviada: sc.quantidadeEnviada + 1,
        atualizadoEm: new Date().toISOString()
      };
      onSaveCollection(updatedRecord);
    }
    
    triggerPushNotification('Batch Processado', 'Todas as cobranças da fila foram enviadas e documentadas com sucesso!', 'success');
  };

  // Filter history list
  const filteredHistory = useMemo(() => {
    return smartCollections
      .filter(sc => {
        const matchesSearch = sc.clienteNome.toLowerCase().includes(historySearch.toLowerCase());
        const matchesStatus = statusFilter === 'todos' || sc.status.toLowerCase() === statusFilter.toLowerCase();
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => new Date(b.atualizadoEm).getTime() - new Date(a.atualizadoEm).getTime());
  }, [smartCollections, historySearch, statusFilter]);

  return (
    <div className="bg-slate-900/65 backdrop-blur-md rounded-2xl border border-white/10 p-5 h-full flex flex-col shadow-2xl">
      {/* Sub-Tab Headers */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 text-amber-400">
            <Sparkles size={22} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-sans font-bold text-slate-100 flex items-center gap-2">
              Smart Cobrança IA
              <span className="bg-amber-500/10 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-500/20">
                PRO v1.2
              </span>
            </h2>
            <p className="text-xs text-slate-400">Notificações inteligentes e recuperação de saldo a prazo com inteligência artificial.</p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-slate-950/60 p-1.5 rounded-xl border border-white/5 w-fit">
          <button
            onClick={() => setActiveSubTab('painel')}
            className={`py-1.5 px-4 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'painel' ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10' : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare size={13} /> Painel de Faturamento
          </button>
          <button
            onClick={() => setActiveSubTab('historico')}
            className={`py-1.5 px-4 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'historico' ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10' : 'text-slate-400 hover:text-white'
            }`}
          >
            <History size={13} /> Histórico de Cobranças
          </button>
          <button
            onClick={() => setActiveSubTab('config')}
            className={`py-1.5 px-4 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'config' ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Settings size={13} /> Configurações
          </button>
        </div>
      </div>

      {/* ALERT BOX if module deactivated */}
      {!settings.ativarModulo && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-200 rounded-xl p-4 mb-4 flex items-center gap-3">
          <ShieldAlert className="text-red-400 shrink-0" size={18} />
          <div className="text-xs">
            <span className="font-bold">Módulo Desativado:</span> Acesse a aba de <strong>Configurações</strong> para ativar o Smart Cobrança IA e começar a recuperar inadimplências automaticamente.
          </div>
        </div>
      )}

      {/* Main Viewport */}
      <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin">
        {activeSubTab === 'painel' && (
          <div className="space-y-6">
            {/* Top Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-950/40 border border-white/5 p-4 rounded-xl">
                <span className="text-xs text-slate-400 block mb-1">Montante em Aberto</span>
                <span className="text-xl font-bold text-amber-400">R$ {totalOutstanding.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                <span className="text-[10px] text-slate-500 block mt-1">Soma de saldos devedores ativos</span>
              </div>
              <div className="bg-slate-950/40 border border-white/5 p-4 rounded-xl">
                <span className="text-xs text-slate-400 block mb-1">Clientes Devedores</span>
                <span className="text-xl font-bold text-slate-100">{debtors.length} devedores</span>
                <span className="text-[10px] text-slate-500 block mt-1">Com saldo devedor ativo na cantina</span>
              </div>
              <div className="bg-slate-950/40 border border-white/5 p-4 rounded-xl">
                <span className="text-xs text-slate-400 block mb-1">Fila de Autocobrança</span>
                <span className="text-xl font-bold text-emerald-400">
                  {smartCollections.filter(sc => sc.status === 'Agendada').length} agendadas
                </span>
                <span className="text-[10px] text-slate-500 block mt-1">Prontas para envio inteligente</span>
              </div>
              <div className="bg-slate-950/40 border border-white/5 p-4 rounded-xl flex flex-col justify-between">
                <span className="text-xs text-slate-400 block mb-1">Ações de Lote</span>
                <button
                  onClick={handleSimulateBatchDispatches}
                  disabled={!settings.ativarModulo || settings.modoEnvio !== 'automatico'}
                  className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Play size={12} /> Disparar Lote Agendado
                </button>
              </div>
            </div>

            {/* AI Executive Briefing / Dashboard Brief */}
            <div className="bg-gradient-to-r from-amber-500/5 to-teal-500/5 border border-white/10 rounded-2xl p-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Sparkles size={80} className="text-amber-400" />
              </div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-400" /> Executive Briefing IA (Gemini 3.5)
                </h3>
                <button
                  onClick={handleGenerateSummary}
                  disabled={generatingSummary || debtors.length === 0}
                  className="bg-slate-950/80 hover:bg-slate-950 text-slate-200 border border-white/10 py-1 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-40"
                >
                  {generatingSummary ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  Atualizar Parecer IA
                </button>
              </div>
              {dashboardSummary ? (
                <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-line space-y-2">
                  {dashboardSummary}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">
                  Clique em "Atualizar Parecer IA" para gerar um briefing financeiro instantâneo com análises, devedores críticos e recomendações táticas.
                </div>
              )}
            </div>

            {/* Debtor client table */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-slate-200">Painel de Clientes em Débito</h3>
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Buscar devedor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-950/60 border border-white/10 text-xs text-slate-200 rounded-xl px-3.5 py-1.5 pl-8 focus:outline-none focus:border-amber-500/60"
                  />
                  <X size={12} className="absolute left-2.5 top-2.5 text-slate-500" />
                </div>
              </div>

              {debtors.length === 0 ? (
                <div className="bg-slate-950/20 border border-white/5 rounded-xl p-8 text-center text-slate-400 text-xs">
                  Nenhum cliente com débito em aberto encontrado. Excelente! 🎉
                </div>
              ) : (
                <div className="space-y-3.5">
                  {debtors.map(debtor => {
                    const analysis = clientAnalysis[debtor.id];
                    const isAnalyzing = analyzingClientId === debtor.id;

                    return (
                      <div key={debtor.id} className="bg-slate-950/45 border border-white/5 rounded-xl p-4 hover:border-white/10 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Client details */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-100">{debtor.name}</span>
                            <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-md font-medium">
                              {debtor.classOrDept}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span>Wpp: {debtor.phone}</span>
                            <span>•</span>
                            <span className="text-amber-400 font-bold">Atraso: {debtor.daysOverdue} dias</span>
                            <span>•</span>
                            <span>Envios efetuados: {debtor.sentCount}</span>
                          </div>
                          
                          {/* AI analysis badge */}
                          <div className="pt-2 flex items-center gap-2">
                            {analysis ? (
                              <div className="flex flex-col gap-1.5 bg-slate-900/90 border border-white/5 rounded-lg p-2.5 max-w-xl">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                    analysis.category === 'bom_pagador' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                    analysis.category === 'recorrente' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                                    'bg-red-500/10 text-red-400 border border-red-500/20'
                                  }`}>
                                    IA: {analysis.category === 'bom_pagador' ? 'Bom Pagador' :
                                         analysis.category === 'recorrente' ? 'Recorrente' :
                                         'Inadimplente Risco'}
                                  </span>
                                  <span className="text-[10px] text-slate-400">Tom ideal: <strong>{analysis.suggestedTone}</strong></span>
                                </div>
                                <p className="text-[11px] text-slate-300 italic">"{analysis.analysis}"</p>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleAnalyzeClient(debtor)}
                                disabled={isAnalyzing || !settings.ativarModulo}
                                className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/5 py-1 px-2.5 rounded-lg font-bold flex items-center gap-1 transition-all disabled:opacity-30"
                              >
                                {isAnalyzing ? <RefreshCw size={11} className="animate-spin" /> : <Sparkles size={11} className="text-amber-400" />}
                                Analisar Perfil Devedor IA
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Balance and Schedule information */}
                        <div className="flex flex-row sm:items-center justify-between lg:flex-col lg:items-end gap-3 border-t border-white/5 pt-3 lg:border-t-0 lg:pt-0">
                          <div className="text-left lg:text-right">
                            <span className="text-xs text-slate-400 block">Saldo Atual</span>
                            <span className="text-base font-black text-amber-500">
                              R$ {Math.abs(debtor.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                            {debtor.pendingSchedule ? (
                              <span className="text-[9px] text-emerald-400 font-bold block mt-0.5 bg-emerald-500/5 border border-emerald-500/10 px-1.5 py-0.5 rounded">
                                Agendada: {debtor.pendingSchedule.proximoEnvio}
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-500 italic block mt-0.5">Sem agendamentos</span>
                            )}
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenBillingMessage(debtor, false)}
                              disabled={!settings.ativarModulo}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-100 p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border border-white/5 disabled:opacity-30"
                              title="Cobrar via modelo padrão"
                            >
                              <MessageSquare size={13} />
                              <span className="hidden sm:inline">Normal</span>
                            </button>
                            <button
                              onClick={() => handleOpenBillingMessage(debtor, true)}
                              disabled={!settings.ativarModulo}
                              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 p-2 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1 shadow-md shadow-amber-500/5 disabled:opacity-30"
                              title="Gerar Cobrança Personalizada IA"
                            >
                              <Sparkles size={13} />
                              <span className="hidden sm:inline">IA Premium</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeSubTab === 'historico' && (
          <div className="space-y-4">
            {/* Filter bar */}
            <div className="bg-slate-950/40 border border-white/5 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Buscar cliente no histórico..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 text-xs text-slate-200 rounded-xl px-3.5 py-1.5 pl-8 focus:outline-none focus:border-amber-500/60"
                  />
                  <X size={12} className="absolute left-2.5 top-2.5 text-slate-500" />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-900 border border-white/10 text-xs text-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-500"
                >
                  <option value="todos">Todos Status</option>
                  <option value="Agendada">Agendadas</option>
                  <option value="Enviada">Enviadas</option>
                  <option value="Cancelada">Canceladas</option>
                  <option value="Pagamento recebido">Pagas</option>
                  <option value="Falhou">Falhas</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-bold">{filteredHistory.length} registros</span>
              </div>
            </div>

            {/* History logs list */}
            {filteredHistory.length === 0 ? (
              <div className="bg-slate-950/20 border border-white/5 rounded-xl p-12 text-center text-slate-500 text-xs">
                Nenhuma cobrança registrada neste filtro.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredHistory.map(sc => (
                  <div key={sc.id} className="bg-slate-950/35 border border-white/5 rounded-xl p-4 flex flex-col md:flex-row justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="text-sm font-bold text-slate-100">{sc.clienteNome}</span>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          sc.tipo === 'automatica' ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20' : 'bg-orange-500/10 text-orange-300 border border-orange-500/20'
                        }`}>
                          {sc.tipo === 'automatica' ? 'AUTOMÁTICA' : 'MANUAL'}
                        </span>
                        
                        {/* Status badges */}
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          sc.status === 'Agendada' ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' :
                          sc.status === 'Enviada' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' :
                          sc.status === 'Cancelada' ? 'bg-slate-500/10 text-slate-400 border border-white/5' :
                          'bg-red-500/10 text-red-300 border border-red-500/20'
                        }`}>
                          {sc.status === 'Agendada' ? '📅 Agendada' :
                           sc.status === 'Enviada' ? '✅ Enviada' :
                           sc.status === 'Cancelada' ? '🚫 Cancelada' :
                           sc.status === 'Pagamento recebido' ? '💰 Quitada' :
                           '❌ Falhou'}
                        </span>
                      </div>

                      {/* Display message bubble */}
                      <div className="bg-slate-900/60 p-3 rounded-lg border border-white/5 text-xs text-slate-300 whitespace-pre-line font-mono leading-relaxed max-w-4xl">
                        {sc.mensagem}
                      </div>

                      <div className="text-[10px] text-slate-400 flex items-center gap-3">
                        {sc.dataEnvio && <span>Enviado em: <strong>{sc.dataEnvio}</strong></span>}
                        {sc.proximoEnvio && <span>Próximo agendamento: <strong>{sc.proximoEnvio}</strong></span>}
                        <span>Valor cobrado: <strong>R$ {sc.valor.toFixed(2)}</strong></span>
                      </div>
                    </div>

                    {/* Action buttons on log */}
                    <div className="flex items-start gap-1 justify-end md:self-center">
                      <button
                        onClick={() => onDeleteCollection(sc.id)}
                        className="p-1.5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg transition-all"
                        title="Deletar registro histórico"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'config' && (
          <div className="bg-slate-950/35 border border-white/5 p-5 rounded-2xl max-w-4xl space-y-6">
            <h3 className="text-sm font-bold text-slate-200 border-b border-white/5 pb-2">Configurações da Cobrança Inteligente</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Left configurations column */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-900/40 rounded-xl border border-white/5">
                  <div>
                    <label className="text-xs font-bold text-slate-200 block">Ativar Módulo Geral</label>
                    <span className="text-[10px] text-slate-400">Liga ou desliga totalmente o assistente.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.ativarModulo}
                    onChange={(e) => onSaveSettings({ ...settings, ativarModulo: e.target.checked })}
                    className="w-4 h-4 text-amber-500 bg-slate-950 border-white/10 rounded focus:ring-amber-500 focus:ring-2"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-900/40 rounded-xl border border-white/5">
                  <div>
                    <label className="text-xs font-bold text-slate-200 block">Modo de Operação</label>
                    <span className="text-[10px] text-slate-400">Escolha entre disparo manual guiado ou automatico.</span>
                  </div>
                  <select
                    value={settings.modoEnvio}
                    onChange={(e) => onSaveSettings({ ...settings, modoEnvio: e.target.value as 'manual' | 'automatico' })}
                    className="bg-slate-950 border border-white/10 text-xs text-slate-200 rounded-lg p-1.5 focus:outline-none"
                  >
                    <option value="manual">WhatsApp Manual</option>
                    <option value="automatico">WhatsApp Automático</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-900/40 rounded-xl border border-white/5">
                  <div>
                    <label className="text-xs font-bold text-slate-200 block">Provedor Ativo (Gateway)</label>
                    <span className="text-[10px] text-slate-400">Canal usado para despachar as mensagens.</span>
                  </div>
                  <select
                    value={settings.providerId}
                    onChange={(e) => onSaveSettings({ ...settings, providerId: e.target.value as ProviderType })}
                    className="bg-slate-950 border border-white/10 text-xs text-slate-200 rounded-lg p-1.5 focus:outline-none"
                  >
                    <option value="whatsapp_manual">WhatsApp Manual (Browser)</option>
                    <option value="whatsapp_official">WhatsApp Business API (Meta)</option>
                    <option value="evolution_api">Evolution API (Simulado)</option>
                    <option value="twilio">Twilio SMS Gateway (Simulado)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-900/40 rounded-xl border border-white/5 space-y-1">
                    <label className="text-xs font-bold text-slate-200 block">Max de Cobranças</label>
                    <input
                      type="number"
                      value={settings.maximoCobrancas}
                      onChange={(e) => onSaveSettings({ ...settings, maximoCobrancas: parseInt(e.target.value) || 3 })}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg p-1 text-xs text-slate-100"
                    />
                  </div>
                  <div className="p-3 bg-slate-900/40 rounded-xl border border-white/5 space-y-1">
                    <label className="text-xs font-bold text-slate-200 block">Intervalo Fila</label>
                    <select
                      value={settings.intervaloPadrao}
                      onChange={(e) => onSaveSettings({ ...settings, intervaloPadrao: e.target.value as any })}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg p-1 text-xs text-slate-100"
                    >
                      <option value="diario">Diário</option>
                      <option value="semanal">Semanal</option>
                      <option value="quinzenal">Quinzenal</option>
                      <option value="mensal">Mensal</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-900/40 rounded-xl border border-white/5 space-y-1">
                    <label className="text-xs font-bold text-slate-200 block">Horário Início</label>
                    <input
                      type="time"
                      value={settings.horarioInicio}
                      onChange={(e) => onSaveSettings({ ...settings, horarioInicio: e.target.value })}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg p-1 text-xs text-slate-100"
                    />
                  </div>
                  <div className="p-3 bg-slate-900/40 rounded-xl border border-white/5 space-y-1">
                    <label className="text-xs font-bold text-slate-200 block">Horário Limite</label>
                    <input
                      type="time"
                      value={settings.horarioFim}
                      onChange={(e) => onSaveSettings({ ...settings, horarioFim: e.target.value })}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg p-1 text-xs text-slate-100"
                    />
                  </div>
                </div>
              </div>

              {/* Right configurations column */}
              <div className="space-y-4">
                <div className="p-4 bg-slate-900/40 rounded-xl border border-white/5 space-y-2">
                  <label className="text-xs font-bold text-slate-200 block">Restrições de Envio (Calendário)</label>
                  <div className="space-y-2 text-xs text-slate-300">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.naoSabado}
                        onChange={(e) => onSaveSettings({ ...settings, naoSabado: e.target.checked })}
                        className="w-3.5 h-3.5 rounded border-white/10 bg-slate-950 text-amber-500 focus:ring-0"
                      />
                      Não enviar aos sábados
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.naoDomingo}
                        onChange={(e) => onSaveSettings({ ...settings, naoDomingo: e.target.checked })}
                        className="w-3.5 h-3.5 rounded border-white/10 bg-slate-950 text-amber-500 focus:ring-0"
                      />
                      Não enviar aos domingos
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.naoFeriados}
                        onChange={(e) => onSaveSettings({ ...settings, naoFeriados: e.target.checked })}
                        className="w-3.5 h-3.5 rounded border-white/10 bg-slate-950 text-amber-500 focus:ring-0"
                      />
                      Não enviar em feriados (Calendário futuro)
                    </label>
                  </div>
                </div>

                <div className="p-4 bg-slate-900/40 rounded-xl border border-white/5 space-y-2">
                  <label className="text-xs font-bold text-slate-200 block">Gatilhos de Suspensão</label>
                  <div className="space-y-2 text-xs text-slate-300">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.pararAoPagar}
                        onChange={(e) => onSaveSettings({ ...settings, pararAoPagar: e.target.checked })}
                        className="w-3.5 h-3.5 rounded border-white/10 bg-slate-950 text-amber-500 focus:ring-0"
                      />
                      Parar cobranças imediatamente quando cliente pagar (Automático)
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.pararAposMaximo}
                        onChange={(e) => onSaveSettings({ ...settings, pararAposMaximo: e.target.checked })}
                        className="w-3.5 h-3.5 rounded border-white/10 bg-slate-950 text-amber-500 focus:ring-0"
                      />
                      Suspender após atingir quantidade máxima de envios
                    </label>
                  </div>
                </div>

                <div className="p-3 bg-slate-900/40 rounded-xl border border-white/5 space-y-1">
                  <label className="text-xs font-bold text-slate-200">Tom de Cobrança Padrão</label>
                  <select
                    value={settings.tomCobranca}
                    onChange={(e) => onSaveSettings({ ...settings, tomCobranca: e.target.value as any })}
                    className="w-full bg-slate-950 border border-white/10 text-xs text-slate-200 rounded-lg p-1.5 focus:outline-none focus:border-amber-500"
                  >
                    <option value="amigável">Amigável 😊</option>
                    <option value="educado">Educado 🤝</option>
                    <option value="formal">Formal 👔</option>
                    <option value="firme">Firme ⚖️</option>
                    <option value="muito firme">Muito firme 🚨</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Template editor */}
            <div className="p-4 bg-slate-900/40 rounded-xl border border-white/5 space-y-2">
              <label className="text-xs font-bold text-slate-200 block">Modelo Padrão de Mensagem</label>
              <textarea
                value={settings.modeloPadrao}
                onChange={(e) => onSaveSettings({ ...settings, modeloPadrao: e.target.value })}
                rows={3}
                placeholder="Ex: Olá {cliente}, informamos seu débito de {saldo}..."
                className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
              />
              <span className="text-[10px] text-slate-500 block">Variáveis utilizáveis: <code>{`{cliente}`}</code> (nome), <code>{`{saldo}`}</code> (valor devedor).</span>
            </div>
          </div>
        )}
      </div>

      {/* RENDER MODAL FOR IA MESSAGE REVIEW & EDITING */}
      <AnimatePresence>
        {showMessageModal && modalClient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-white/15 rounded-2xl p-5 max-w-lg w-full shadow-2xl relative"
            >
              <button
                onClick={() => setShowMessageModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={18} className="text-amber-400" />
                <h4 className="text-sm font-bold text-slate-100">Revisar Cobrança - {modalClient.name}</h4>
              </div>

              {generatingMessage ? (
                <div className="h-48 flex flex-col items-center justify-center gap-2 text-xs text-slate-400">
                  <RefreshCw className="animate-spin text-amber-400" size={24} />
                  Redigindo mensagem inteligente com Gemini IA...
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Select custom tone dynamic switch inside modal */}
                  <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-white/5">
                    <span className="text-[11px] text-slate-400">Tom da mensagem:</span>
                    <div className="flex items-center gap-1">
                      <select
                        value={customTone}
                        onChange={async (e) => {
                          const val = e.target.value as any;
                          setCustomTone(val);
                          setGeneratingMessage(true);
                          try {
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

                            const debtorTx = transactions.filter(t => t.clientId === modalClient.id && t.paymentMethod === 'prazo' && t.status === 'pendente');
                            const valorPendente = debtorTx.reduce((sum, tx) => sum + tx.total, 0);

                            const items = debtorTx.map(tx => ({
                              date: formatDate(tx.timestamp),
                              productName: tx.items && tx.items.length > 0 ? tx.items.map(it => it.productName).join(' + ') : 'Consumo Geral',
                              quantity: 1,
                              price: tx.total,
                              total: tx.total
                            }));

                            const message = await aiCollectionService.GerarMensagem({
                              name: modalClient.name,
                              balance: valorPendente,
                              daysOverdue: modalClient.daysOverdue,
                              previousCount: modalClient.sentCount,
                              tone: val,
                              pixKey: pixKey,
                              copiaECola: currentGeneratedCopiaECola,
                              items: items
                            });
                            setGeneratedMessage(message);
                          } catch (err) {
                            console.error(err);
                          } finally {
                            setGeneratingMessage(false);
                          }
                        }}
                        className="bg-slate-900 border border-white/10 text-[11px] text-slate-200 rounded px-2 py-1"
                      >
                        <option value="amigável">Amigável</option>
                        <option value="educado">Educado</option>
                        <option value="formal">Formal</option>
                        <option value="firme">Firme</option>
                        <option value="muito firme">Muito firme</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300">Mensagem gerada (Ajustável antes de enviar):</label>
                    <textarea
                      value={generatedMessage}
                      onChange={(e) => setGeneratedMessage(e.target.value)}
                      rows={8}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-sans leading-relaxed"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2.5">
                    <button
                      onClick={() => setShowMessageModal(false)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 px-4 rounded-lg text-xs font-bold transition-all"
                    >
                      Voltar
                    </button>
                    <button
                      onClick={handleDispatchMessage}
                      className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white py-1.5 px-4 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Send size={12} /> Despachar via WhatsApp
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
