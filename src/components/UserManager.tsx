/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppUser } from '../types';
import { Users, UserPlus, Trash2, Key, ShieldCheck, User } from 'lucide-react';
import { motion } from 'motion/react';

interface UserManagerProps {
  users: AppUser[];
  currentUser: AppUser;
  onAddUser: (u: AppUser) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
}

export default function UserManager({
  users,
  currentUser,
  onAddUser,
  onDeleteUser
}: UserManagerProps) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'operator'>('operator');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!name.trim() || !username.trim() || !password.trim()) {
      setErrorMsg('Todos os campos são obrigatórios.');
      return;
    }

    const normalizedUsername = username.trim().toLowerCase();

    // Check if username already exists
    if (allUsers.some(u => u.username.toLowerCase() === normalizedUsername)) {
      setErrorMsg('Este nome de usuário já está cadastrado.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newUser: AppUser = {
        id: 'user_' + Math.random().toString(36).substring(2, 9),
        name: name.trim(),
        username: normalizedUsername,
        role,
        passwordHash: password.trim(), // plain text/passcode as requested for simplicity
        createdAt: new Date().toISOString()
      };

      await onAddUser(newUser);
      setSuccessMsg(`Usuário "${name}" cadastrado com sucesso!`);
      setName('');
      setUsername('');
      setPassword('');
      setRole('operator');
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao cadastrar usuário no servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (userId === currentUser.id) {
      alert('Você não pode excluir a si mesmo enquanto estiver logado!');
      return;
    }

    if (userName.toLowerCase() === 'admin') {
      alert('O administrador principal "admin" não pode ser excluído.');
      return;
    }

    if (confirm(`Deseja realmente excluir o usuário "${userName}"?`)) {
      try {
        await onDeleteUser(userId);
      } catch (err) {
        console.error(err);
        alert('Erro ao excluir usuário.');
      }
    }
  };

  return (
    <div id="user-manager-root" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Cadastrar Usuário Card */}
      <div className="lg:col-span-5 bg-white border border-gray-150 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-150 bg-gray-50 flex items-center gap-2">
          <UserPlus size={18} className="text-emerald-600" />
          <h4 className="font-sans font-bold text-xs text-gray-700 uppercase tracking-wider">
            Cadastrar Novo Usuário
          </h4>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-sans">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-600 font-sans">
              {successMsg}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-gray-400 uppercase block font-bold">
              Nome Completo
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Maria Souza"
              className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100/50 border border-gray-200 focus:border-emerald-500 rounded-xl text-xs font-sans focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-gray-400 uppercase block font-bold">
              Usuário (Username)
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ex: maria.souza"
              className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100/50 border border-gray-200 focus:border-emerald-500 rounded-xl text-xs font-sans focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-gray-400 uppercase block font-bold flex items-center gap-1">
              <Key size={10} /> Senha / Código de Acesso
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite a senha de login"
              className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100/50 border border-gray-200 focus:border-emerald-500 rounded-xl text-xs font-sans focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-gray-400 uppercase block font-bold">
              Nível de Acesso (Cargo)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('operator')}
                className={`py-2 px-3 rounded-xl border text-xs font-sans font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  role === 'operator'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                }`}
              >
                <User size={13} /> Operador Caixa
              </button>
              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`py-2 px-3 rounded-xl border text-xs font-sans font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  role === 'admin'
                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                }`}
              >
                <ShieldCheck size={13} /> Administrador
              </button>
            </div>
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-xl text-xs font-sans font-bold transition-all shadow-md active:scale-95"
            >
              {isSubmitting ? 'Cadastrando...' : 'Cadastrar Usuário'}
            </button>
          </div>
        </form>
      </div>

      {/* Lista de Usuários Card */}
      <div className="lg:col-span-7 bg-white border border-gray-150 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-150 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-[#023e26]" />
            <h4 className="font-sans font-bold text-xs text-gray-700 uppercase tracking-wider">
              Usuários Cadastrados ({allUsers.length})
            </h4>
          </div>
        </div>

        <div className="p-4 overflow-y-auto max-h-[400px] flex-1">
          {allUsers.length === 0 ? (
            <div className="text-center py-10 text-xs text-gray-400 font-sans">
              Nenhum outro usuário cadastrado no momento.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {allUsers.map((u) => (
                <div key={u.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-display font-black text-xs ${
                      u.role === 'admin' 
                        ? 'bg-amber-100 text-amber-800' 
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {u.role === 'admin' ? 'ADM' : 'OP'}
                    </div>
                    <div>
                      <h5 className="font-sans font-bold text-xs text-gray-800 flex items-center gap-1.5">
                        {u.name}
                        {u.id === currentUser.id && (
                          <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-mono">Logado</span>
                        )}
                      </h5>
                      <p className="text-[10px] text-gray-400 font-mono">
                        u: {u.username} • Senha: {u.passwordHash}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                      u.role === 'admin' 
                        ? 'bg-amber-50 text-amber-700 border border-amber-200/50' 
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                    }`}>
                      {u.role === 'admin' ? 'Admin' : 'Operador'}
                    </span>

                    {u.username.toLowerCase() !== 'admin' && u.id !== currentUser.id && (
                      <button
                        onClick={() => handleDelete(u.id, u.name)}
                        className="p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-lg transition-all"
                        title="Excluir Usuário"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
