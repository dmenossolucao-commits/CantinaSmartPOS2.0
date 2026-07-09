/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppUser } from '../types';
import { Key, User, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginViewProps {
  users: AppUser[];
  onLogin: (u: AppUser) => void;
}

export default function LoginView({ users, onLogin }: LoginViewProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isTypingUsername, setIsTypingUsername] = useState(false);

  // Fallback admin in case Firebase loading is delayed or empty
  const defaultAdmin: AppUser = {
    id: 'u_admin',
    username: 'admin',
    name: 'Administrador',
    role: 'admin',
    passwordHash: '8848',
    createdAt: ''
  };

  const allUsers = [...users];
  if (!allUsers.some(u => u.username.toLowerCase() === 'admin')) {
    allUsers.unshift(defaultAdmin);
  }

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    let foundUser: AppUser | undefined;

    if (isTypingUsername) {
      const normalized = usernameInput.trim().toLowerCase();
      foundUser = allUsers.find(u => u.username.toLowerCase() === normalized);
    } else {
      foundUser = allUsers.find(u => u.id === selectedUserId);
    }

    if (!foundUser) {
      setErrorMsg('Usuário não encontrado. Selecione ou digite um usuário válido.');
      return;
    }

    if (foundUser.passwordHash === password.trim()) {
      onLogin(foundUser);
    } else {
      setErrorMsg('Senha incorreta. Verifique e tente novamente.');
    }
  };

  return (
    <div id="login-view-root" className="min-h-screen bg-[#f5f8f6] bg-grid-pattern flex flex-col items-center justify-center p-4 md:p-6 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="w-full max-w-md bg-white border border-gray-200/80 rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Top Branding Section */}
        <div className="p-8 text-center text-white bg-gradient-to-r from-[#012518] via-[#023e26] to-[#012518] border-b border-[#045233]/40 relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.1),transparent)] pointer-events-none" />
          
          <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-amber-400 via-amber-500 to-emerald-500 text-white flex items-center justify-center font-display font-black text-xl tracking-tight shadow-xl shadow-emerald-950/40 border border-emerald-400/25">
            UDV
          </div>
          
          <h2 className="mt-4 font-display font-black text-lg md:text-xl tracking-tight text-white">
            UDV Cantina Segura
          </h2>
          <p className="text-[11px] text-emerald-300 font-mono mt-1 uppercase tracking-widest font-semibold">
            Painel de Autenticação • SmartPOS
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleLoginSubmit} className="p-8 space-y-5">
          {errorMsg && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-sans"
            >
              {errorMsg}
            </motion.div>
          )}

          {/* Toggle Username Mode */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setIsTypingUsername(!isTypingUsername);
                setErrorMsg('');
                setSelectedUserId('');
                setUsernameInput('');
              }}
              className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 font-mono uppercase"
            >
              {isTypingUsername ? 'Selecionar da Lista' : 'Digitar Nome de Usuário'}
            </button>
          </div>

          {/* User selection or Username Input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-gray-400 uppercase block font-bold">
              Operador / Administrador
            </label>
            
            {isTypingUsername ? (
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                  <User size={14} />
                </span>
                <input
                  type="text"
                  required
                  placeholder="Nome de usuário (Ex: admin)"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 hover:bg-gray-100/50 border border-gray-200 focus:border-emerald-500 rounded-xl text-xs font-sans focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            ) : (
              <div className="relative">
                <select
                  required
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 hover:bg-gray-100/50 border border-gray-200 focus:border-emerald-500 rounded-xl text-xs font-sans focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none cursor-pointer"
                >
                  <option value="">Selecione o seu usuário...</option>
                  {allUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role === 'admin' ? 'Admin' : 'Operador'})
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-500">
                  ▼
                </div>
              </div>
            )}
          </div>

          {/* Password / Access Pin */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-gray-400 uppercase block font-bold">
              Senha / Código de Acesso
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                <Key size={14} />
              </span>
              <input
                type="password"
                required
                placeholder="Digite a senha de acesso"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 hover:bg-gray-100/50 border border-gray-200 focus:border-emerald-500 rounded-xl text-xs font-sans focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          {/* Login Button */}
          <div className="pt-3">
            <button
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-sans font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
            >
              <ShieldCheck size={16} />
              Entrar no Sistema
            </button>
          </div>
        </form>

        {/* Footer info */}
        <div className="p-4 bg-gray-50 text-center border-t border-gray-150">
          <p className="text-[10px] text-gray-400 font-mono">
            Acesso Restrito • Backup em tempo real ativado
          </p>
        </div>
      </motion.div>
    </div>
  );
}
