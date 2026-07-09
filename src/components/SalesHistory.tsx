/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Transaction, Product } from '../types';
import { 
  History, Search, Trash2, FileText, X, Check, Filter, 
  ArrowLeft, Download, AlertTriangle, RefreshCw, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { downloadReceiptAsPNG } from '../utils/receipt';

interface SalesHistoryProps {
  transactions: Transaction[];
  onCancelSale: (txId: string) => void;
  onDeleteSale?: (txId: string) => void;
  products: Product[];
}

export default function SalesHistory({
  transactions,
  onCancelSale,
  onDeleteSale,
  products
}: SalesHistoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('Todos');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Filters calculation
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = t.id.toLowerCase().includes(term) ||
                            (t.clientName && t.clientName.toLowerCase().includes(term)) ||
                            t.items.some(i => i.productName.toLowerCase().includes(term));
      
      const matchesPayment = paymentFilter === 'Todos' || t.paymentMethod === paymentFilter.toLowerCase();
      const matchesStatus = statusFilter === 'Todos' || t.status === statusFilter.toLowerCase();

      return matchesSearch && matchesPayment && matchesStatus;
    });
  }, [transactions, searchTerm, paymentFilter, statusFilter]);

  const handleDownloadReceipt = (tx: Transaction) => {
    const receiptItems = tx.items.map(item => ({
      name: item.productName,
      qty: item.quantity,
      price: item.price
    }));

    downloadReceiptAsPNG(
      'CANTINA UDV SEGURA',
      `Recibo Venda #${tx.id.toUpperCase()}`,
      new Date(tx.timestamp).toLocaleString('pt-BR'),
      receiptItems,
      tx.total,
      tx.paymentMethod,
      [`Cliente: ${tx.clientName || 'Consumidor Geral'}`, `Status: ${tx.status.toUpperCase()}`],
      `recibo_venda_${tx.id}.png`
    );
  };

  return (
    <div id="sales-history-root" className="space-y-6">
      
      {/* Search and Filters Card */}
      <div className="bg-white border border-gray-150 rounded-2xl shadow-sm p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-sans font-bold text-gray-800 text-lg flex items-center gap-2">
              <History size={20} className="text-[#023e26]" />
              Histórico de Vendas Realizadas
            </h2>
            <p className="text-xs text-gray-400 font-sans mt-0.5">
              Consulte faturas, visualize comprovantes ou cancele vendas
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <div className="relative w-full sm:w-64">
              <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                <Search size={14} />
              </span>
              <input
                id="search-sales-input"
                type="text"
                placeholder="Buscar por cliente, ID, produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Quick Filters */}
        <div className="flex flex-wrap gap-2.5 mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 text-xs font-sans text-gray-500">
            <Filter size={13} />
            <span>Filtros:</span>
          </div>
          
          {/* Payment Method Filter */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {['Todos', 'Dinheiro', 'Pix', 'Crédito', 'Débito', 'Prazo'].map(m => (
              <button
                key={m}
                onClick={() => setPaymentFilter(m)}
                className={`px-3 py-1 text-[10px] font-sans font-bold rounded-lg transition-colors ${
                  paymentFilter === m 
                    ? 'bg-white text-gray-800 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {['Todos', 'Concluido', 'Cancelado'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 text-[10px] font-sans font-bold rounded-lg transition-colors ${
                  statusFilter === s 
                    ? 'bg-white text-gray-800 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {s === 'Todos' ? 'Todos' : s === 'Concluido' ? 'Concluidas' : 'Canceladas'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sales Grid/Table */}
      <div className="bg-white border border-gray-150 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-16">
              <History size={40} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-sans font-bold">Nenhuma venda encontrada</p>
              <p className="text-xs text-gray-400 font-sans mt-0.5">Tente ajustar seus termos de pesquisa ou filtros</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs font-sans">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-150 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Data/Hora</th>
                  <th className="py-3 px-4">ID Transação</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Produtos Adquiridos</th>
                  <th className="py-3 px-4">Forma de Pagamento</th>
                  <th className="py-3 px-4 text-right">Valor Total</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTransactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-gray-50/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-[10px] text-gray-500">
                      {new Date(tx.timestamp).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[10px] text-gray-400 font-semibold">
                      #{tx.id}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-gray-800">
                      {tx.clientName || 'Cliente de Balcão'}
                    </td>
                    <td className="py-3.5 px-4 text-gray-600 max-w-xs truncate" title={tx.items.map(item => `${item.quantity}x ${item.productName}`).join(', ')}>
                      {tx.items.map(item => `${item.quantity}x ${item.productName}`).join(', ')}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wide border ${
                        tx.paymentMethod === 'prazo'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : tx.paymentMethod === 'pix'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}>
                        {tx.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-900 text-sm">
                      R$ {tx.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide ${
                        tx.status === 'cancelado'
                          ? 'bg-red-50 text-red-600 border border-red-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {tx.status === 'cancelado' ? 'Cancelada' : 'Concluída'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedTx(tx)}
                          className="p-1.5 bg-gray-50 hover:bg-gray-150 border border-gray-200 text-gray-600 hover:text-gray-900 rounded-xl transition-colors"
                          title="Visualizar Recibo Completo"
                        >
                          <Eye size={13} />
                        </button>
                        
                        <button
                          onClick={() => {
                            const isCancelled = tx.status === 'cancelado';
                            const confirmMsg = isCancelled
                              ? `Deseja realmente EXCLUIR permanentEMENTE o registro da venda #${tx.id} de R$ ${tx.total.toFixed(2)} do histórico?\nEsta ação é irreversível.`
                              : `Deseja realmente EXCLUIR DEFINITIVAMENTE a venda #${tx.id} de R$ ${tx.total.toFixed(2)}?\nEsta ação restabelecerá o estoque do produto, estornará qualquer saldo a prazo e removerá o registro do histórico para sempre.`;
                            
                            if (confirm(confirmMsg)) {
                              if (onDeleteSale) {
                                onDeleteSale(tx.id);
                              } else {
                                onCancelSale(tx.id);
                              }
                            }
                          }}
                          className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-xl transition-colors"
                          title="Excluir Venda Permanentemente"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* DETAIL MODAL: RECIBO DA VENDA */}
      <AnimatePresence>
        {selectedTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTx(null)}
              className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-3xl shadow-2xl border border-gray-150 w-full max-w-sm overflow-hidden z-10 p-5 space-y-4"
            >
              <div className="flex justify-between items-center border-b border-gray-100 pb-2.5">
                <h3 className="font-sans font-bold text-sm text-gray-800 flex items-center gap-1.5">
                  <FileText size={15} className="text-emerald-600" />
                  Comprovante de Venda
                </h3>
                <button
                  onClick={() => setSelectedTx(null)}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={15} className="text-gray-400" />
                </button>
              </div>

              {/* Printable Receipt Frame */}
              <div 
                id={`receipt-${selectedTx.id}`}
                className="bg-gray-50 border border-gray-200 rounded-2xl p-4 font-mono text-[11px] text-gray-700 space-y-3 shadow-inner"
              >
                <div className="text-center border-b border-dashed border-gray-300 pb-3">
                  <h4 className="font-black text-xs text-gray-900 uppercase">CANTINA UDV SEGURA</h4>
                  <p className="text-[9px] text-gray-400 mt-0.5">COMPROVANTE FISCAL SIMULADO</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">#{selectedTx.id.toUpperCase()}</p>
                </div>

                <div className="space-y-1 text-[10px]">
                  <p><strong>DATA:</strong> {new Date(selectedTx.timestamp).toLocaleString('pt-BR')}</p>
                  <p><strong>OPERADOR:</strong> Caixa Geral</p>
                  <p><strong>CLIENTE:</strong> {selectedTx.clientName || 'CONSUMIDOR BALCAO'}</p>
                  <p><strong>FORMA PGTO:</strong> {selectedTx.paymentMethod.toUpperCase()}</p>
                  <p><strong>STATUS:</strong> {selectedTx.status.toUpperCase()}</p>
                </div>

                <div className="border-t border-b border-dashed border-gray-300 py-2.5 my-2 space-y-1">
                  {selectedTx.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="truncate pr-2">{item.quantity}x {item.productName}</span>
                      <span className="shrink-0">R$ {(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between text-xs font-black text-gray-900 pt-1">
                  <span>VALOR TOTAL</span>
                  <span>R$ {selectedTx.total.toFixed(2)}</span>
                </div>

                <div className="text-center text-[9px] text-gray-400 pt-3 border-t border-dashed border-gray-300">
                  <p>Obrigado pela preferência!</p>
                  <p>UDV Cantina - Tecnologia Segura</p>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => handleDownloadReceipt(selectedTx)}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-sans font-bold flex items-center justify-center gap-1.5 shadow transition-colors"
                >
                  <Download size={13} />
                  Salvar Comprovante
                </button>
                <button
                  onClick={() => setSelectedTx(null)}
                  className="py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-sans font-bold transition-colors"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
