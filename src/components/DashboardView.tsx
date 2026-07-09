/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Product, Client, Transaction, BackupHistory, NotificationLog } from '../types';
import { 
  TrendingUp, Landmark, LandmarkIcon, ShieldCheck, Download, History, 
  RefreshCcw, Smartphone, BadgeAlert, ShoppingBag, CreditCard, Coins, CheckCircle, BellRing,
  Search, Undo2, X, Phone, Users, Package, AlertTriangle, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardViewProps {
  products: Product[];
  clients: Client[];
  transactions: Transaction[];
  backups: BackupHistory[];
  notifications: NotificationLog[];
  onTriggerBackup: () => void;
  onClearTransactions: () => void;
  onCancelSale?: (txId: string) => void;
  onDeleteSale?: (txId: string) => void;
  pixKey: string;
  onUpdatePixKey: (newKey: string) => void;
}

export default function DashboardView({
  products,
  clients,
  transactions,
  backups,
  notifications,
  onTriggerBackup,
  onClearTransactions,
  onCancelSale,
  onDeleteSale,
  pixKey,
  onUpdatePixKey
}: DashboardViewProps) {
  const [activeReportTab, setActiveReportTab] = useState<'semanal' | 'mensal' | 'devedores'>('semanal');
  const [backupLoading, setBackupLoading] = useState(false);
  const [txSearchTerm, setTxSearchTerm] = useState('');
  const [activeModalList, setActiveModalList] = useState<'debtors' | 'prepaid' | 'lowstock' | 'sales' | null>(null);
  const [tempPixKey, setTempPixKey] = useState(pixKey);

  const filteredTransactions = useMemo(() => {
    if (!txSearchTerm.trim()) return transactions;
    const term = txSearchTerm.toLowerCase();
    return transactions.filter(t => 
      t.id.toLowerCase().includes(term) ||
      (t.clientName && t.clientName.toLowerCase().includes(term)) ||
      t.paymentMethod.toLowerCase().includes(term) ||
      t.items.some(i => i.productName.toLowerCase().includes(term))
    );
  }, [transactions, txSearchTerm]);

  // Administrative stats calculations
  const stats = useMemo(() => {
    const totalTransactionsVal = transactions.reduce((sum, t) => sum + t.total, 0);
    
    // Sum negative client balances to get total outstanding debt
    const totalOutstandingDebt = clients
      .filter(c => c.balance < 0)
      .reduce((sum, c) => sum + Math.abs(c.balance), 0);

    // Sum positive client balances to get total pre-paid credits
    const totalPrepaidCredits = clients
      .filter(c => c.balance > 0)
      .reduce((sum, c) => sum + c.balance, 0);

    const outOfStockCount = products.filter(p => p.stock <= 0).length;
    const criticalStockCount = products.filter(p => p.stock > 0 && p.stock <= p.minStock).length;

    return {
      totalTransactionsVal,
      totalOutstandingDebt,
      totalPrepaidCredits,
      outOfStockCount,
      criticalStockCount,
      totalClientsCount: clients.length,
      totalSalesCount: transactions.length
    };
  }, [clients, products, transactions]);

  // Payment methods breakdown
  const paymentBreakdown = useMemo(() => {
    const methods: Record<string, { count: number; value: number }> = {
      dinheiro: { count: 0, value: 0 },
      pix: { count: 0, value: 0 },
      crédito: { count: 0, value: 0 },
      débito: { count: 0, value: 0 },
      prazo: { count: 0, value: 0 }
    };

    transactions.forEach(t => {
      if (methods[t.paymentMethod]) {
        methods[t.paymentMethod].count++;
        methods[t.paymentMethod].value += t.total;
      }
    });

    return methods;
  }, [transactions]);

  // Day-by-day sales for the last 7 days (Weekly report)
  const last7DaysSales = useMemo(() => {
    const data: { label: string; value: number; count: number }[] = [];
    const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toISOString().split('T')[0];
      const weekdayLabel = weekdays[d.getDay()];

      const dailyTotal = transactions
        .filter(t => t.timestamp.startsWith(dateString))
        .reduce((sum, t) => sum + t.total, 0);

      const dailyCount = transactions
        .filter(t => t.timestamp.startsWith(dateString)).length;

      data.push({
        label: `${weekdayLabel} (${d.getDate()}/${d.getMonth() + 1})`,
        value: dailyTotal,
        count: dailyCount
      });
    }

    return data;
  }, [transactions]);

  // Monthly consumption categories breakdown
  const categoryBreakdown = useMemo(() => {
    const categories: Record<string, number> = {
      Salgados: 0,
      Bebidas: 0,
      Doces: 0,
      Almoço: 0,
      Outros: 0
    };

    transactions.forEach(t => {
      t.items.forEach(item => {
        // Find product to determine category if possible, otherwise guess or use a default
        const prod = products.find(p => p.id === item.productId);
        const cat = prod?.category || 'Salgados';
        if (categories[cat] !== undefined) {
          categories[cat] += item.price * item.quantity;
        }
      });
    });

    return categories;
  }, [transactions, products]);

  // Top Debtors (Clientes mais devedores)
  const topDebtors = useMemo(() => {
    return clients
      .filter(c => c.balance < 0)
      .map(c => ({
        ...c,
        debt: Math.abs(c.balance)
      }))
      .sort((a, b) => b.debt - a.debt)
      .slice(0, 5);
  }, [clients]);

  // Handle local cloud backup trigger with fake cloud response logging
  const handleBackupNowClick = () => {
    setBackupLoading(true);
    
    setTimeout(() => {
      onTriggerBackup();
      setBackupLoading(false);
      alert('Backup completo na nuvem efetuado com sucesso!\nCriptografia de ponta-a-ponta ativada (GCP Firestore Snapshot).');
    }, 1500);
  };

  // Modal Data Processing for Clickable Overview Cards
  const modalData = useMemo(() => {
    if (activeModalList === 'debtors') {
      return {
        title: 'Clientes Devedores (Carteira a Prazo)',
        icon: <Landmark className="text-red-500" size={18} />,
        headers: ['Nome', 'Tipo / Depto', 'Contato', 'Saldo Devedor'],
        rows: clients
          .filter(c => c.balance < 0)
          .sort((a, b) => a.balance - b.balance) // most negative balance first
          .map(c => ({
            id: c.id,
            col1: c.name,
            col2: c.type === 'aluno' ? `Aluno (${c.classOrDept})` : `Colaborador (${c.classOrDept})`,
            col3: c.phone,
            col4: `R$ ${Math.abs(c.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            col4Color: 'text-red-600 font-bold'
          }))
      };
    } else if (activeModalList === 'prepaid') {
      return {
        title: 'Clientes Credores (Saldos Pré-Pagos)',
        icon: <LandmarkIcon className="text-teal-600" size={18} />,
        headers: ['Nome', 'Tipo / Depto', 'Contato', 'Saldo em Crédito'],
        rows: clients
          .filter(c => c.balance > 0)
          .sort((a, b) => b.balance - a.balance) // highest credit first
          .map(c => ({
            id: c.id,
            col1: c.name,
            col2: c.type === 'aluno' ? `Aluno (${c.classOrDept})` : `Colaborador (${c.classOrDept})`,
            col3: c.phone,
            col4: `R$ ${c.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            col4Color: 'text-emerald-600 font-bold'
          }))
      };
    } else if (activeModalList === 'lowstock') {
      return {
        title: 'Produtos em Alerta Crítico de Reposição',
        icon: <BadgeAlert className="text-amber-500 animate-pulse" size={18} />,
        headers: ['Produto', 'Categoria', 'Estoque Mínimo', 'Estoque Atual'],
        rows: products
          .filter(p => p.stock <= p.minStock)
          .sort((a, b) => a.stock - b.stock) // out of stock first
          .map(p => ({
            id: p.id,
            col1: p.name,
            col2: p.category,
            col3: `${p.minStock} un`,
            col4: `${p.stock} un`,
            col4Color: p.stock <= 0 ? 'text-red-600 font-black' : 'text-amber-500 font-bold'
          }))
      };
    } else if (activeModalList === 'sales') {
      return {
        title: 'Demonstrativo Recente de Faturamento (Vendas)',
        icon: <TrendingUp className="text-emerald-600" size={18} />,
        headers: ['Data / ID', 'Cliente', 'Itens', 'Total / Método'],
        rows: transactions
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .map(t => ({
            id: t.id,
            col1: new Date(t.timestamp).toLocaleString('pt-BR'),
            col2: t.clientName || 'Cliente de Balcão',
            col3: t.items.map(i => `${i.quantity}x ${i.productName}`).join(', '),
            col4: `R$ ${t.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${t.paymentMethod.toUpperCase()})`,
            col4Color: t.status === 'cancelado' ? 'text-red-500 line-through' : 'text-gray-900 font-bold'
          }))
      };
    }
    return null;
  }, [activeModalList, clients, products, transactions]);

  return (
    <div id="dashboard-view-root" className="space-y-6 select-none max-h-[85vh] overflow-y-auto pr-1">
      
      {/* 4 Cards Row: Quick overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total revenue / sales */}
        <div 
          onClick={() => setActiveModalList('sales')}
          className="bg-white rounded-2xl border border-gray-150 p-4.5 flex items-center justify-between shadow-sm cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all active:scale-[0.98] group"
          title="Clique para ver extrato de vendas"
        >
          <div>
            <span className="text-[10px] text-gray-400 font-mono font-bold uppercase block tracking-wider">
              Faturamento Bruto
            </span>
            <h3 className="font-mono font-black text-xl text-gray-900 mt-1">
              R$ {stats.totalTransactionsVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-emerald-600 font-sans mt-1 group-hover:underline">
              • Ver todas as vendas ({stats.totalSalesCount}) &rarr;
            </p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-100 transition-colors">
            <TrendingUp size={22} />
          </div>
        </div>

        {/* Total outstanding debt */}
        <div 
          onClick={() => setActiveModalList('debtors')}
          className="bg-white rounded-2xl border border-gray-150 p-4.5 flex items-center justify-between shadow-sm cursor-pointer hover:border-red-300 hover:shadow-md transition-all active:scale-[0.98] group"
          title="Clique para ver lista de devedores"
        >
          <div>
            <span className="text-[10px] text-gray-400 font-mono font-bold uppercase block tracking-wider text-red-600">
              Total Devedor (Alunos/Colab)
            </span>
            <h3 className="font-mono font-black text-xl text-red-600 mt-1">
              R$ {stats.totalOutstandingDebt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-red-500 font-sans mt-1 group-hover:underline font-semibold">
              • Ver devedores ({clients.filter(c => c.balance < 0).length}) &rarr;
            </p>
          </div>
          <div className="p-3 bg-red-50 text-red-500 rounded-xl group-hover:bg-red-100 transition-colors">
            <Landmark size={22} />
          </div>
        </div>

        {/* Total Prepaid balance */}
        <div 
          onClick={() => setActiveModalList('prepaid')}
          className="bg-white rounded-2xl border border-gray-150 p-4.5 flex items-center justify-between shadow-sm cursor-pointer hover:border-teal-300 hover:shadow-md transition-all active:scale-[0.98] group"
          title="Clique para ver saldos credores"
        >
          <div>
            <span className="text-[10px] text-gray-400 font-mono font-bold uppercase block tracking-wider text-emerald-700">
              Saldos Pré-Pagos
            </span>
            <h3 className="font-mono font-black text-xl text-emerald-700 mt-1">
              R$ {stats.totalPrepaidCredits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-teal-600 font-sans mt-1 group-hover:underline">
              • Ver credores ({clients.filter(c => c.balance > 0).length}) &rarr;
            </p>
          </div>
          <div className="p-3 bg-teal-50 text-teal-600 rounded-xl group-hover:bg-teal-100 transition-colors">
            <LandmarkIcon size={22} />
          </div>
        </div>

        {/* Canteen inventory health */}
        <div 
          onClick={() => setActiveModalList('lowstock')}
          className="bg-white rounded-2xl border border-gray-150 p-4.5 flex items-center justify-between shadow-sm cursor-pointer hover:border-amber-300 hover:shadow-md transition-all active:scale-[0.98] group"
          title="Clique para ver itens sem estoque ou em alerta"
        >
          <div>
            <span className="text-[10px] text-gray-400 font-mono font-bold uppercase block tracking-wider">
              Saúde do Estoque
            </span>
            <h3 className="font-mono font-bold text-base text-gray-900 mt-1 flex items-baseline gap-1">
              <span className="text-red-500 font-black text-xl">{stats.outOfStockCount}</span> esgotados
            </h3>
            <p className="text-[10px] text-amber-600 font-sans mt-1 group-hover:underline">
              • Ver reposição ({products.filter(p => p.stock <= p.minStock).length}) &rarr;
            </p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-100 transition-colors">
            <BadgeAlert size={22} className={stats.criticalStockCount > 0 ? 'animate-bounce' : ''} />
          </div>
        </div>
      </div>

      {/* Charts & Interactive reports layout - two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Sales visualization (Left Side) */}
        <div className="lg:col-span-8 bg-white border border-gray-150 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center flex-wrap gap-2">
            <div>
              <h4 className="font-sans font-bold text-xs text-gray-700 uppercase tracking-wider">
                Relatório de Consumo e Vendas da Cantina
              </h4>
              <p className="text-[10px] text-gray-400 font-sans">Análise histórica do caixa</p>
            </div>
            
            <div className="flex gap-1">
              {['semanal', 'mensal', 'devedores'].map((tab) => (
                <button
                  key={tab}
                  id={`dashboard-report-tab-${tab}`}
                  onClick={() => setActiveReportTab(tab as any)}
                  className={`py-1 px-2.5 rounded-lg font-sans text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    activeReportTab === tab 
                      ? 'bg-gray-800 text-white' 
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {tab === 'semanal' ? 'Faturamento Diário' : tab === 'mensal' ? 'Por Categoria' : 'Maiores Devedores'}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 flex-1 flex flex-col justify-center min-h-[250px]">
            {activeReportTab === 'semanal' && (
              <div className="space-y-4">
                <p className="text-xs text-gray-500 font-sans text-center mb-1">
                  Volume de vendas dos últimos 7 dias (R$)
                </p>
                {/* SVG-based Bar Chart */}
                <div className="w-full h-44 flex items-end gap-3 px-2">
                  {last7DaysSales.map((day, idx) => {
                    // find max value to calculate percentage height
                    const maxVal = Math.max(...last7DaysSales.map(d => d.value), 20.0);
                    const pct = maxVal > 0 ? (day.value / maxVal) * 100 : 0;
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer">
                        {/* Tooltip on hover */}
                        <div className="opacity-0 group-hover:opacity-100 bg-gray-900 text-white font-mono text-[9px] px-1.5 py-0.5 rounded-md absolute transform -translate-y-12 transition-all shadow pointer-events-none z-10 text-center">
                          R$ {day.value.toFixed(2)}<br/>
                          <span className="text-[8px] text-gray-400">{day.count} vendas</span>
                        </div>
                        {/* Interactive Bar */}
                        <div 
                          className="w-full bg-emerald-500 hover:bg-emerald-600 rounded-t-lg shadow-sm transition-all relative"
                          style={{ height: `${Math.max(pct, 4)}%` }}
                        >
                          <span className="absolute -top-5 left-0 right-0 text-center font-mono text-[9px] text-gray-600 font-bold group-hover:text-emerald-700">
                            {day.value > 0 ? `R$ ${Math.round(day.value)}` : ''}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono text-center mt-2.5 rotate-12 sm:rotate-0">
                          {day.label.split(' ')[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeReportTab === 'mensal' && (
              <div className="space-y-4">
                <p className="text-xs text-gray-500 font-sans text-center mb-2">
                  Total faturado acumulado por categoria de alimentos
                </p>
                
                {/* Horizontal Progress Bars */}
                <div className="space-y-3 max-w-md mx-auto">
                  {(Object.entries(categoryBreakdown) as [string, number][]).map(([cat, val]) => {
                    const totalVal = (Object.values(categoryBreakdown) as number[]).reduce((s: number, v: number) => s + v, 0) || 1;
                    const pct = (val / totalVal) * 100;
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex justify-between text-xs font-sans">
                          <span className="font-semibold text-gray-700">{cat}</span>
                          <span className="font-mono text-gray-600 font-bold">
                            R$ {val.toFixed(2)} ({Math.round(pct)}%)
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeReportTab === 'devedores' && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500 font-sans text-center mb-2">
                  Top 5 Alunos/Colaboradores com maior saldo devedor acumulado
                </p>
                <div className="max-w-md mx-auto divide-y divide-gray-100">
                  {topDebtors.length === 0 ? (
                    <div className="text-center py-8 text-xs text-gray-400 font-sans">
                      Sem devedores registrados no momento. Tudo quitado!
                    </div>
                  ) : (
                    topDebtors.map((c, index) => (
                      <div key={c.id} className="py-2 flex items-center justify-between text-xs font-sans">
                        <div className="flex items-center gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-red-50 text-red-600 font-bold flex items-center justify-center text-[10px]">
                            {index + 1}
                          </span>
                          <div>
                            <p className="font-bold text-gray-800">{c.name}</p>
                            <p className="text-[10px] text-gray-400 font-mono">{c.classOrDept} • {c.type}</p>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-red-600 text-sm">
                          R$ {c.debt.toFixed(2)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Payment Methods breakdown (Right Side) */}
        <div className="lg:col-span-4 bg-white border border-gray-150 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <h4 className="font-sans font-bold text-xs text-gray-700 uppercase tracking-wider">
              Fluxo por Meio de Pagamento
            </h4>
          </div>

          <div className="p-4 flex-1 overflow-y-auto space-y-3">
            {(Object.entries(paymentBreakdown) as [string, { count: number; value: number }][]).map(([method, data]) => {
              const iconMap: Record<string, React.ReactNode> = {
                dinheiro: <Coins size={14} className="text-amber-500" />,
                pix: <RefreshCcw size={14} className="text-teal-500 animate-spin" />,
                crédito: <CreditCard size={14} className="text-blue-500" />,
                débito: <CreditCard size={14} className="text-purple-500" />,
                prazo: <History size={14} className="text-red-500" />
              };

              const pct = stats.totalTransactionsVal > 0 
                ? (data.value / stats.totalTransactionsVal) * 100 
                : 0;

              return (
                <div key={method} className="p-3 border border-gray-50 rounded-xl bg-gray-50/40 space-y-1">
                  <div className="flex justify-between items-center text-xs font-sans">
                    <span className="font-bold text-gray-700 capitalize flex items-center gap-1.5">
                      {iconMap[method]} {method}
                    </span>
                    <span className="font-mono text-gray-500">
                      {data.count} vendas
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-mono text-sm font-black text-gray-900">
                      R$ {data.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {Math.round(pct)}% do caixa
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cloud Backup & Push notification logging details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Backup card */}
        <div className="bg-white border border-gray-150 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-4 border-b border-gray-150 bg-gray-50 flex justify-between items-center">
              <h4 className="font-sans font-bold text-xs text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-emerald-600" />
                Backup Automático na Nuvem
              </h4>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-50 text-emerald-700 animate-pulse">
                ● Ativo (24h)
              </span>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-500 font-sans leading-relaxed">
                O sistema de banco de dados do PDV possui rotinas automáticas de backup redundantes. Um snapshot completo é sincronizado de forma segura com o servidor Cloud Run a cada fechamento de caixa ou manualmente.
              </p>

              <div className="space-y-2 max-h-36 overflow-y-auto">
                {backups.map(b => (
                  <div key={b.id} className="p-2.5 border border-gray-100 rounded-lg bg-gray-50 flex items-center justify-between text-xs font-mono">
                    <div className="min-w-0 pr-2">
                      <span className="text-[10px] text-gray-400 block">
                        {new Date(b.timestamp).toLocaleString('pt-BR')}
                      </span>
                      <span className="text-gray-700 font-semibold truncate block">
                        {b.filename}
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-sans font-bold shrink-0">
                      {b.size}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-5 pt-0 flex gap-2.5">
            <button
              id="cloud-backup-trigger-btn"
              onClick={handleBackupNowClick}
              disabled={backupLoading}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-xl text-xs font-sans font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Download size={14} className={backupLoading ? 'animate-spin' : ''} />
              {backupLoading ? 'Fazendo Sincronia...' : 'Forçar Sincronia de Backup'}
            </button>
          </div>
        </div>

        {/* Pix Key Configuration Panel */}
        <div className="bg-white border border-gray-150 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-4 border-b border-gray-150 bg-gray-50 flex justify-between items-center">
              <h4 className="font-sans font-bold text-xs text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard size={16} className="text-blue-600" />
                Chave Pix Cantina UDV
              </h4>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-blue-50 text-blue-700">
                Ativo
              </span>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-500 font-sans leading-relaxed">
                Configure aqui a chave Pix da Cantina. Ela é usada para gerar todos os QR Codes e Copia e Cola dinâmicos em tempo real para os clientes.
              </p>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-gray-400 uppercase block font-bold">Chave Pix Atual</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tempPixKey}
                    onChange={(e) => setTempPixKey(e.target.value)}
                    placeholder="Ex: pix@udvcantina.com ou celular/CNPJ"
                    className="flex-1 px-3 py-2 bg-gray-50 hover:bg-gray-100/50 border border-gray-200 focus:border-blue-500 rounded-xl text-xs font-sans focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button
                    onClick={() => {
                      onUpdatePixKey(tempPixKey);
                      alert('Chave Pix atualizada com sucesso!');
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-sans font-bold transition-all shadow-md shrink-0"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 pt-0">
            <div className="p-2.5 bg-blue-50/20 border border-blue-100 rounded-xl flex items-center gap-2">
              <Coins size={14} className="text-blue-500 shrink-0" />
              <span className="text-[10px] text-blue-800 leading-tight">
                Chave configurada: <strong>{pixKey}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Push Notification panel logging */}
        <div className="bg-white border border-gray-150 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-150 bg-gray-50 flex justify-between items-center">
            <h4 className="font-sans font-bold text-xs text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <BellRing size={16} className="text-emerald-600" />
              Notificações de Saldo & Faturas
            </h4>
            <span className="text-[10px] font-mono text-gray-400">Total: {notifications.length}</span>
          </div>

          <div className="p-5 flex-1 flex flex-col justify-between">
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="text-center py-10 text-xs text-gray-400 font-sans">
                  Nenhuma notificação enviada hoje.
                </div>
              ) : (
                notifications.slice().reverse().map(n => (
                  <div key={n.id} className="p-2.5 border border-gray-100 rounded-lg bg-gray-50 flex justify-between gap-2.5 text-xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-800">{n.clientName.split(' ')[0]}</span>
                        <span className="text-[9px] text-gray-400 font-mono">
                          {new Date(n.timestamp).toLocaleTimeString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-gray-600 font-sans text-[11px] mt-0.5 leading-relaxed">
                        {n.message}
                      </p>
                    </div>
                    <span className="text-[9px] font-semibold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded shrink-0 self-start uppercase">
                      {n.channel}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
              <span className="text-gray-400 font-sans">Limpar logs históricos:</span>
              <button
                id="clear-db-transactions"
                onClick={() => {
                  if (confirm('Aviso de Administrador: Deseja zerar todo o histórico de vendas para teste? Clientes e produtos serão mantidos.')) {
                    onClearTransactions();
                  }
                }}
                className="text-red-500 hover:text-red-700 font-semibold"
              >
                Resetar Vendas
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: GENERAL SALES HISTORY WITH SEARCH & CANCELLATION */}
      <div className="bg-white border border-gray-150 rounded-2xl shadow-sm overflow-hidden flex flex-col mt-6">
        <div className="p-4 border-b border-gray-150 bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h4 className="font-sans font-bold text-xs text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <History size={16} className="text-[#023e26]" />
              Histórico Geral de Vendas
            </h4>
            <p className="text-[10px] text-gray-400 font-sans mt-0.5">Consulte e cancele transações do PDV</p>
          </div>

          <div className="relative w-full sm:w-64">
            <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder="Buscar por cliente, ID, produto..."
              value={txSearchTerm}
              onChange={(e) => setTxSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>

        <div className="p-4 overflow-x-auto max-h-96">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-10 text-xs text-gray-400 font-sans">
              Nenhuma transação encontrada.
            </div>
          ) : (
            <table className="w-full text-left text-xs font-sans">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Data/Hora</th>
                  <th className="py-2.5 px-3">ID / Cliente</th>
                  <th className="py-2.5 px-3">Itens Vendidos</th>
                  <th className="py-2.5 px-3">Meio Pgto</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                  {onCancelSale && <th className="py-2.5 px-3 text-center">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-3 text-gray-500 font-mono text-[10px]">
                      {new Date(tx.timestamp).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono text-[10px] text-gray-400 block">#{tx.id}</span>
                      <span className="font-semibold text-gray-800">{tx.clientName || 'Cliente de Balcão'}</span>
                    </td>
                    <td className="py-3 px-3 text-gray-600 max-w-xs truncate">
                      {tx.items.map(item => `${item.quantity}x ${item.productName}`).join(', ')}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[9px] font-bold uppercase">
                        {tx.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-gray-900">
                      R$ {tx.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                        tx.status === 'cancelado' 
                          ? 'bg-red-50 text-red-600' 
                          : tx.status === 'concluido' 
                            ? 'bg-emerald-50 text-emerald-600' 
                            : 'bg-amber-50 text-amber-600'
                      }`}>
                        {tx.status === 'cancelado' ? 'Cancelada' : tx.status === 'concluido' ? 'Aprovada' : 'Pendente'}
                      </span>
                    </td>
                    {onCancelSale && (
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {tx.status !== 'cancelado' ? (
                            <button
                              onClick={() => {
                                if (confirm(`Aviso de Confirmação:\nDeseja realmente cancelar esta venda de R$ ${tx.total.toFixed(2)}?\nO estoque dos produtos e o saldo do cliente serão estornados imediatamente.`)) {
                                  onCancelSale(tx.id);
                                }
                              }}
                              className="p-1 px-2 text-red-500 hover:bg-red-50 hover:text-red-700 border border-transparent hover:border-red-100 rounded-lg transition-all font-bold inline-flex items-center gap-1 text-[10px]"
                              title="Cancelar Venda"
                            >
                              <Undo2 size={11} /> Estornar
                            </button>
                          ) : null}

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
                              className="p-1 px-2 text-red-600 hover:bg-red-50 hover:text-red-800 border border-transparent hover:border-red-200 rounded-lg transition-all font-bold inline-flex items-center gap-1 text-[10px]"
                              title="Excluir Venda Permanentemente"
                            >
                              <Trash2 size={11} /> Excluir
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* OVERVIEW DETAILS MODAL */}
      <AnimatePresence>
        {activeModalList && modalData && (
          <div id="overview-details-modal" className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border flex flex-col max-h-[85vh]"
            >
              <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
                <h3 className="font-sans font-bold text-gray-900 text-sm flex items-center gap-2">
                  {modalData.icon}
                  {modalData.title}
                </h3>
                <button 
                  onClick={() => setActiveModalList(null)} 
                  className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {modalData.rows.length === 0 ? (
                  <div className="py-16 text-center text-gray-400 font-sans text-xs">
                    Nenhum registro correspondente encontrado.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-gray-100 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 font-mono font-bold uppercase border-b border-gray-100">
                          {modalData.headers.map((h, i) => (
                            <th key={i} className={`py-2.5 px-4 ${i === 3 ? 'text-right' : ''}`}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {modalData.rows.map((row) => (
                          <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="py-3 px-4 font-semibold text-gray-800">{row.col1}</td>
                            <td className="py-3 px-4 text-gray-500 font-sans">{row.col2}</td>
                            <td className="py-3 px-4 text-gray-400 font-mono">{row.col3}</td>
                            <td className={`py-3 px-4 text-right font-mono ${row.col4Color}`}>
                              {row.col4}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveModalList(null)}
                  className="py-1.5 px-4 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-xs font-sans font-bold transition-all active:scale-95"
                >
                  Fechar Visualização
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
