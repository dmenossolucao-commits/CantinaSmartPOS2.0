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
    subtotal?: number;
  }[];
  total: number;
  paymentMethod: PaymentMethod;
  timestamp: string; // ISO String
  status: 'concluido' | 'pendente' | 'cancelado';
  dueDate?: string; // payment deadline for 'prazo'
  saldo_restante?: number; // remaining outstanding balance for credit sales
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

export interface SmartCobrancaSettings {
  ativarModulo: boolean;
  modoEnvio: 'manual' | 'automatico';
  providerId: 'whatsapp_manual' | 'whatsapp_official' | 'evolution_api' | 'twilio';
  maximoCobrancas: number;
  intervaloPadrao: 'diario' | 'semanal' | 'quinzenal' | 'mensal';
  modeloPadrao: string;
  horarioInicio: string; // e.g. "08:00"
  horarioFim: string; // e.g. "18:00"
  naoSabado: boolean;
  naoDomingo: boolean;
  naoFeriados: boolean;
  pararAoPagar: boolean;
  pararAposMaximo: boolean;
  tomCobranca: 'amigável' | 'educado' | 'formal' | 'firme' | 'muito firme';
  mostrarBotaoWhatsapp: boolean;
  mostrarBotaoCopiar: boolean;
  permitirApenasVencidos: boolean;
}

export interface SmartCollection {
  id: string;
  clienteId: string;
  clienteNome: string;
  valor: number;
  saldo: number;
  tipo: 'manual' | 'automatica';
  manual: boolean;
  automatica: boolean;
  mensagem: string;
  dataEnvio?: string;
  proximoEnvio?: string;
  ultimaCobranca?: string;
  quantidadeEnviada: number;
  maximoCobrancas: number;
  intervalo: 'diario' | 'semanal' | 'quinzenal' | 'mensal';
  status: 'Agendada' | 'Enviada' | 'Cancelada' | 'Pagamento recebido' | 'Falhou';
  criadoEm: string;
  atualizadoEm: string;
}

// Smart Financeiro PIX Interfaces
export interface PixCharge {
  id: string;
  vendaId: string;
  clienteId: string;
  clienteNome: string;
  valor: number;
  data: string;
  status: 'Aguardando pagamento' | 'Pago' | 'Cancelado' | 'Expirado' | 'Estornado' | 'Parcial';
  txid: string;
  qrcode: string;
  copiaECola: string;
  vencimento: string;
  instituicao: string;
}

export interface BankReconciliation {
  id: string;
  vendaId: string;
  clienteNome: string;
  valorEsperado: number;
  valorRecebido: number;
  diferenca: number;
  instituicao: string;
  data: string;
  hora: string;
  status: 'Conciliado' | 'Pendente' | 'Necessita análise';
  metodo: 'Automático' | 'Manual';
}

export interface PaymentLog {
  id: string;
  timestamp: string;
  type: 'info' | 'error' | 'security' | 'operation';
  action: string;
  details: string;
  user?: string;
}

export interface FinancialSettings {
  instituicaoPadrao: string;
  instituicaoAtiva: string;
  timeout: number; // in seconds
  tentativas: number;
  ativarLogs: boolean;
  ativarAuditoria: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface PaymentWebhook {
  id: string;
  timestamp: string;
  provedor: string;
  payload: string;
  processado: boolean;
  resultado?: string;
}

export interface AdminSecuritySettings {
  passwordHash: string;
  failedAttempts: number;
  blockedUntil?: string | null;
  updatedAt: string;
}

export interface AdminSecurityLog {
  id: string;
  user: string;
  action: string;
  date: string;
  success: boolean;
  details?: string;
}

export interface ProviderChangeLog {
  id: string;
  oldProvider: string;
  newProvider: string;
  user: string;
  date: string;
  status: 'success' | 'failed';
}

export interface PaymentMessageLog {
  id: string;
  cliente: string;
  telefone: string;
  valor: number;
  usuario: string;
  data: string;
  hora: string;
  status: string;
}




