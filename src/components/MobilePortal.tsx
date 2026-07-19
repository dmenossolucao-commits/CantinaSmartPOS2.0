/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Client, Transaction } from '../types';
import { 
  Smartphone, User, Landmark, History, QrCode, ShieldCheck, 
  SmartphoneIcon, Key, ArrowRight, ArrowLeft, CheckCircle2, QrCodeIcon, BellRing 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generatePixPayload, getPixQRCodeUrl } from '../utils/pix';
import { TENANT_CONFIG } from '../config/tenant';

interface MobilePortalProps {
  clients: Client[];
  transactions: Transaction[];
  onAddCredit: (clientId: string, amount: number) => void;
  triggerPushNotification: (title: string, body: string) => void;
  pixKey: string;
}

export default function MobilePortal({ 
  clients, 
  transactions, 
  onAddCredit,
  triggerPushNotification,
  pixKey
}: MobilePortalProps) {
  const [selectedUser, setSelectedUser] = useState<Client | null>(null);
  const [pinCode, setPinCode] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mobileTab, setMobileTab] = useState<'home' | 'statement' | 'pay_pix'>('home');

  // Pix payment states
  const [pixAmount, setPixAmount] = useState('');
  const [showPixResult, setShowPixResult] = useState(false);
  const [isProcessingPix, setIsProcessingPix] = useState(false);

  // User statements
  const userStatements = useMemo(() => {
    if (!selectedUser) return [];
    return transactions
      .filter(t => t.clientId === selectedUser.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [selectedUser, transactions]);

  // Handle PIN login simulation
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinCode.length === 4) {
      setIsAuthenticated(true);
      setMobileTab('home');
    } else {
      alert('Por favor, digite o PIN de 4 dígitos (Ex: 1234 para homologação).');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setSelectedUser(null);
    setPinCode('');
    setShowPixResult(false);
    setMobileTab('home');
  };

  // Settle or top-up balance via PIX
  const handlePixPaymentComplete = () => {
    if (!selectedUser) return;
    const amt = parseFloat(pixAmount.replace(',', '.'));
    if (isNaN(amt) || amt <= 0) {
      alert('Digite um valor Pix válido.');
      return;
    }

    setIsProcessingPix(true);
    setTimeout(() => {
      onAddCredit(selectedUser.id, amt);
      
      // Update local state instance to reflect in UI immediately
      setSelectedUser(prev => prev ? { ...prev, balance: prev.balance + amt } : null);
      
      setIsProcessingPix(false);
      setShowPixResult(true);

      // Trigger standard browser push alert simulation
      triggerPushNotification(
        'Pagamento Pix Confirmado',
        `Sua recarga de R$ ${amt.toFixed(2)} foi processada com sucesso no seu extrato!`
      );
    }, 1500);
  };

  return (
    <div id="mobile-portal-root" className="flex flex-col lg:flex-row items-center justify-center gap-10 select-none min-h-[500px] p-2">
      
      {/* Explanation Column */}
      <div className="lg:w-1/2 space-y-4 max-w-md">
        <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg inline-block">
          <Smartphone size={24} />
        </div>
        <h3 className="font-sans font-black text-gray-900 text-lg leading-tight">
          Portal do Usuário (Extrato Mobile)
        </h3>
        <p className="text-xs text-gray-600 leading-relaxed font-sans">
          Simulador de acesso mobile para alunos e colaboradores. Através desta interface, os usuários podem acompanhar seus consumos na cantina em tempo real, verificar limites e faturas pendentes de pagamento, e recarregar ou liquidar saldos devedores instantaneamente de forma segura usando Pix.
        </p>
        
        <div className="border-t border-gray-100 pt-3 space-y-2 text-xs text-gray-500 font-sans">
          <p className="font-bold text-gray-700 flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-600" /> Segurança Integrada
          </p>
          <p>
            • Autenticação simplificada por biometria ou PIN de 4 dígitos.<br/>
            • Notificações push imediatas para atualizações de saldo e faturas.<br/>
            • Redução de inadimplência permitindo pagamento remoto pelo próprio smartphone dos responsáveis.
          </p>
        </div>
      </div>

      {/* iPhone/Smartphone Container mockup */}
      <div className="relative w-[310px] h-[610px] rounded-[40px] border-[10px] border-gray-900 bg-gray-950 shadow-2xl overflow-hidden shrink-0 flex flex-col justify-between">
        
        {/* Dynamic camera notch */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-28 h-6 bg-gray-900 rounded-b-xl z-30 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-gray-800" />
        </div>

        {/* Status bar */}
        <div className="h-8 pt-2.5 px-6 flex justify-between items-center text-white/80 text-[10px] font-mono font-bold z-20">
          <span>09:41</span>
          <div className="flex gap-1 items-center">
            <span>5G</span>
            <div className="w-4 h-2 bg-white rounded-xs" />
          </div>
        </div>

        {/* Interactive App Screen */}
        <div className="flex-1 bg-gray-55 overflow-y-auto px-4.5 pt-2 pb-4 flex flex-col relative text-gray-900">
          
          <AnimatePresence mode="wait">
            {!selectedUser ? (
              // STEP 1: Select User profile
              <motion.div 
                key="select-user"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex-1 flex flex-col justify-between"
              >
                <div className="space-y-4 pt-4">
                  <div className="text-center">
                    <h4 className="text-white font-sans font-extrabold text-sm tracking-wide">{TENANT_CONFIG.SHORT_NAME} Mobile</h4>
                    <p className="text-[10px] text-gray-400 font-sans mt-0.5">Selecione seu perfil para acessar o extrato</p>
                  </div>

                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {clients.map(c => (
                      <button
                        key={c.id}
                        id={`mobile-user-profile-${c.id}`}
                        onClick={() => {
                          setSelectedUser(c);
                          setPinCode('');
                        }}
                        className="w-full text-left p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/5 flex items-center justify-between text-white transition-all group"
                      >
                        <div className="min-w-0 pr-2">
                          <h5 className="font-sans font-bold text-xs truncate leading-none">
                            {c.name.split(' ').slice(0, 2).join(' ')}
                          </h5>
                          <p className="text-[9px] text-gray-400 font-mono mt-1">
                            {c.classOrDept}
                          </p>
                        </div>
                        <ArrowRight size={14} className="text-gray-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-center text-[9px] text-gray-500 font-mono">
                  v2.4.1 • {TENANT_CONFIG.COMPANY_NAME}
                </div>
              </motion.div>
            ) : !isAuthenticated ? (
              // STEP 2: PIN/Authentication entry
              <motion.form 
                key="auth"
                onSubmit={handleLogin}
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col justify-between pt-6"
              >
                <div className="space-y-5 text-center">
                  <button 
                    id="mobile-back-to-profiles"
                    type="button" 
                    onClick={() => setSelectedUser(null)} 
                    className="self-start text-[10px] text-gray-400 hover:text-white flex items-center gap-1"
                  >
                    <ArrowLeft size={12} /> Voltar
                  </button>

                  <div className="w-12 h-12 bg-emerald-600 rounded-2xl mx-auto flex items-center justify-center text-white shadow-lg">
                    <User size={24} />
                  </div>

                  <div>
                    <h5 className="text-white font-sans font-bold text-xs leading-none">
                      {selectedUser.name.split(' ')[0]}
                    </h5>
                    <p className="text-[10px] text-gray-400 font-mono mt-1">{selectedUser.classOrDept}</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] text-gray-400 font-sans uppercase block tracking-wider">
                      Digite seu PIN de Acesso
                    </label>
                    <input
                      id="mobile-pin-input"
                      type="password"
                      maxLength={4}
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      required
                      className="w-32 mx-auto tracking-[0.5em] text-center bg-white/10 border border-white/10 text-white font-mono font-black py-2 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:bg-white/15"
                    />
                    <p className="text-[8px] text-gray-500 font-mono">Qualquer 4 dígitos libera o simulador</p>
                  </div>
                </div>

                <button
                  id="mobile-login-submit"
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-sans text-xs font-bold rounded-xl transition-all shadow shadow-emerald-950 flex items-center justify-center gap-1"
                >
                  Confirmar Acesso <ArrowRight size={14} />
                </button>
              </motion.form>
            ) : (
              // STEP 3: Authenticated Screen
              <motion.div 
                key="portal-home"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col h-full text-white"
              >
                {/* Mobile Header navigation bar */}
                <div className="flex justify-between items-center border-b border-white/5 pb-2.5 mb-3">
                  <div className="min-w-0">
                    <span className="text-[8px] text-gray-400 font-mono block">Olá,</span>
                    <span className="font-sans font-black text-xs block truncate leading-none">
                      {selectedUser.name.split(' ')[0]}
                    </span>
                  </div>
                  <button
                    id="mobile-logout-btn"
                    onClick={handleLogout}
                    className="text-[10px] text-red-400 font-mono hover:underline"
                  >
                    Sair
                  </button>
                </div>

                {mobileTab === 'home' && (
                  <motion.div 
                    key="tab-home" 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className="space-y-4"
                  >
                    {/* Wallet card: Balance and Limits */}
                    <div className="bg-gradient-to-br from-emerald-700 to-teal-800 rounded-2xl p-4 border border-emerald-500/20 shadow-md">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[8px] text-emerald-100 font-mono uppercase tracking-wider">
                          Saldo na Cantina
                        </span>
                        <SmartphoneIcon size={12} className="text-emerald-200" />
                      </div>
                      
                      <div className="font-mono text-lg font-black text-white">
                        R$ {selectedUser.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>

                      {selectedUser.balance < 0 && (
                        <p className="text-[8px] text-red-200 font-sans mt-1">
                          ⚠️ Há faturas em aberto no valor de R$ {Math.abs(selectedUser.balance).toFixed(2)}.
                        </p>
                      )}

                      <div className="mt-3.5 pt-2.5 border-t border-white/10 grid grid-cols-2 gap-2 text-left">
                        <div>
                          <span className="text-[8px] text-emerald-200 font-mono block">LIMITE TOTAL</span>
                          <span className="text-[10px] font-mono font-bold">R$ {selectedUser.creditLimit.toFixed(0)}</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-emerald-200 font-mono block">DISPONÍVEL</span>
                          <span className="text-[10px] font-mono font-bold">R$ {(selectedUser.creditLimit + (selectedUser.balance < 0 ? selectedUser.balance : 0)).toFixed(0)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Navigation inside app */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        id="mobile-nav-statement"
                        onClick={() => setMobileTab('statement')}
                        className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-center space-y-1 transition-colors"
                      >
                        <History size={16} className="text-emerald-400 mx-auto" />
                        <span className="text-[10px] font-sans font-medium block">Ver Extrato</span>
                      </button>
                      <button
                        id="mobile-nav-paypix"
                        onClick={() => {
                          setMobileTab('pay_pix');
                          setPixAmount(selectedUser.balance < 0 ? Math.abs(selectedUser.balance).toString() : '20');
                          setShowPixResult(false);
                        }}
                        className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-center space-y-1 transition-colors"
                      >
                        <QrCode size={16} className="text-teal-400 mx-auto" />
                        <span className="text-[10px] font-sans font-medium block">Pagar via Pix</span>
                      </button>
                    </div>

                    {/* Quick Mini statement on home */}
                    <div className="space-y-1.5">
                      <h6 className="text-[9px] text-gray-400 font-mono uppercase tracking-wider">Últimos Consumos</h6>
                      {userStatements.length === 0 ? (
                        <p className="text-[10px] text-gray-500 font-sans">Nenhuma compra feita ainda.</p>
                      ) : (
                        <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                          {userStatements.slice(0, 3).map(tx => (
                            <div key={tx.id} className="p-2 bg-white/5 border border-white/5 rounded-lg flex justify-between text-[10px]">
                              <div className="min-w-0 pr-2">
                                <span className="block text-gray-400 text-[8px] font-mono">
                                  {new Date(tx.timestamp).toLocaleDateString('pt-BR')}
                                </span>
                                <span className="block truncate text-white">
                                  {tx.items[0]?.productName} {tx.items.length > 1 ? `+${tx.items.length - 1}` : ''}
                                </span>
                              </div>
                              <span className="font-mono font-bold shrink-0 self-center">
                                R$ {tx.total.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {mobileTab === 'statement' && (
                  <motion.div 
                    key="tab-statement" 
                    initial={{ opacity: 0, x: -10 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    className="space-y-3"
                  >
                    <button 
                      id="mobile-statement-back-home"
                      onClick={() => setMobileTab('home')} 
                      className="text-[9px] text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      <ArrowLeft size={10} /> Voltar para o início
                    </button>

                    <h6 className="text-[10px] text-gray-400 font-mono uppercase tracking-wider border-b border-white/5 pb-1">Extrato de Lançamentos</h6>
                    
                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                      {userStatements.length === 0 ? (
                        <div className="text-center py-12 text-xs text-gray-500 font-sans">
                          Sem transações registradas.
                        </div>
                      ) : (
                        userStatements.map(tx => (
                          <div key={tx.id} className="p-2.5 bg-white/5 border border-white/5 rounded-xl space-y-1">
                            <div className="flex justify-between text-[9px] font-mono text-gray-400">
                              <span>{new Date(tx.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                              <span className="uppercase text-emerald-400">{tx.paymentMethod}</span>
                            </div>
                            
                            <div className="space-y-0.5">
                              {tx.items.map((it, i) => (
                                <p key={i} className="text-[10px] text-white">
                                  {it.quantity}x {it.productName}
                                </p>
                              ))}
                            </div>

                            <div className="text-right text-[10px] font-mono font-bold">
                              R$ {tx.total.toFixed(2)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}

                {mobileTab === 'pay_pix' && (
                  <motion.div 
                    key="tab-pix" 
                    initial={{ opacity: 0, x: 10 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    className="space-y-3"
                  >
                    <button 
                      id="mobile-pix-back-home"
                      onClick={() => setMobileTab('home')} 
                      className="text-[9px] text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      <ArrowLeft size={10} /> Voltar para o início
                    </button>

                    <h6 className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Recarregar / Quitar Débito por Pix</h6>
                    
                    {!showPixResult ? (() => {
                      const amountVal = parseFloat(pixAmount.replace(',', '.')) || 0;
                      const payload = amountVal > 0 ? generatePixPayload(pixKey, amountVal) : '';
                      const qrUrl = payload ? getPixQRCodeUrl(payload) : '';
                      return (
                        <div className="space-y-3 pt-2">
                          <div>
                            <label className="text-[8px] text-gray-400 block mb-1">VALOR PIX (R$)</label>
                            <input
                              id="mobile-pix-amount-input"
                              type="text"
                              value={pixAmount}
                              onChange={(e) => setPixAmount(e.target.value)}
                              className="w-full bg-white/10 border border-white/10 text-white font-mono font-bold px-3 py-1.5 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          {amountVal > 0 && qrUrl && (
                            <div className="bg-white p-2.5 rounded-xl flex flex-col items-center space-y-2 shadow-md">
                              <img src={qrUrl} alt="QR Code" className="w-20 h-20 object-contain" referrerPolicy="no-referrer" />
                              <div className="w-full space-y-1.5 text-left">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[8px] text-gray-400 font-bold uppercase">Chave Pix:</span>
                                  <span className="text-[8px] font-mono text-gray-700 select-all font-bold truncate max-w-[120px]">{pixKey}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(pixKey);
                                      triggerPushNotification('Copiado!', 'Chave Pix copiada para a área de transferência.');
                                    }}
                                    className="p-1 hover:bg-gray-100 rounded text-teal-600 transition-colors"
                                    title="Copiar Chave"
                                  >
                                    <span className="text-[8px] font-bold">Copiar</span>
                                  </button>
                                </div>
                                <div className="flex items-center justify-between gap-1 border-t border-gray-100 pt-1">
                                  <span className="text-[8px] text-gray-400 font-bold uppercase">Copia e Cola:</span>
                                  <span className="text-[8px] font-mono text-gray-700 select-all font-bold truncate max-w-[120px]">{payload}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(payload);
                                      triggerPushNotification('Copiado!', 'Código Copia e Cola copiado.');
                                    }}
                                    className="p-1 hover:bg-gray-100 rounded text-teal-600 transition-colors"
                                    title="Copiar Código"
                                  >
                                    <span className="text-[8px] font-bold">Copiar</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          <button
                            id="mobile-pix-trigger-payment"
                            onClick={handlePixPaymentComplete}
                            disabled={isProcessingPix}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 text-white font-sans text-xs font-bold rounded-xl shadow transition-colors flex items-center justify-center gap-1.5"
                          >
                            <QrCodeIcon size={14} />
                            {isProcessingPix ? 'Processando Pix...' : 'Confirmar Pagamento Simulado'}
                          </button>
                        </div>
                      );
                    })() : (
                      <div className="text-center py-4 space-y-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                          <CheckCircle2 size={24} />
                        </div>
                        <div>
                          <h6 className="text-xs font-bold font-sans">Crédito Adicionado!</h6>
                          <p className="text-[10px] text-gray-400 font-sans mt-0.5">O saldo foi compensado imediatamente na cantina.</p>
                        </div>
                        <button
                          id="mobile-pix-complete-close-btn"
                          onClick={() => setMobileTab('home')}
                          className="w-full py-1.5 bg-white/10 hover:bg-white/15 border border-white/10 text-white text-[10px] font-sans font-bold rounded-lg transition-colors"
                        >
                          OK, Voltar para Carteira
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}

              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* Home navigation bar indicator */}
        <div className="h-6 pb-2.5 flex justify-center items-center z-20">
          <div className="w-24 h-1 bg-white/40 rounded-full" />
        </div>

      </div>
    </div>
  );
}
