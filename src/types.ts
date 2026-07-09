/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string;
  name: string;
  price: number;
  category: 'Salgados' | 'Bebidas' | 'Doces' | 'Almoço' | 'Outros';
  stock: number;
  minStock: number;
  imageUrl?: string;
}

export type PaymentMethod = 'dinheiro' | 'crédito' | 'débito' | 'pix' | 'prazo';

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string; // WhatsApp billing
  type: 'aluno' | 'colaborador';
  classOrDept: string; // e.g., "3º Ano B" or "Recursos Humanos"
  balance: number; // Positive is pre-paid credit, negative is debt (saldo devedor)
  creditLimit: number; // Maximum debt allowed (e.g., R$ 150.00)
  biometricRegistered: boolean;
  biometricDataUrl?: string; // Mock biometric hash or face image representation
}

export interface Transaction {
  id: string;
  clientId?: string;
  clientName?: string;
  items: {
    productId: string;
    productName: string;
    price: number;
    quantity: number;
  }[];
  total: number;
  paymentMethod: PaymentMethod;
  timestamp: string; // ISO String
  status: 'concluido' | 'pendente' | 'cancelado';
  dueDate?: string; // payment deadline for 'prazo'
}

export interface NotificationLog {
  id: string;
  clientId: string;
  clientName: string;
  type: 'fatura' | 'lembrete' | 'saldo_atualizado';
  channel: 'whatsapp' | 'email' | 'push';
  message: string;
  timestamp: string;
  status: 'enviado' | 'pendente' | 'falha';
}

export interface BackupHistory {
  id: string;
  timestamp: string;
  filename: string;
  status: 'sucesso' | 'falha';
  size: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: 'aberto' | 'em_atendimento' | 'resolvido';
  category: 'sistema' | 'pagamentos' | 'biometria' | 'outros';
  timestamp: string;
  priority: 'baixa' | 'media' | 'alta';
}

export interface AppUser {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'operator';
  passwordHash: string; // Plain password or passcode for simplicity
  createdAt: string;
}

