/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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

export interface PaymentProvider {
  id: string;
  name: string;
  status: 'Ativo' | 'Inativo';
  apiKey?: string;
  secretKey?: string;
  clientId?: string;
  clientSecret?: string;
  webhookUrl?: string;
  ambiente: 'Produção' | 'Homologação';
  observacoes?: string;

  connect(): Promise<boolean>;
  disconnect(): Promise<boolean>;
  createPixCharge(vendaId: string, clienteId: string, clienteNome: string, valor: number): Promise<PixCharge>;
  cancelCharge(txid: string): Promise<boolean>;
  checkPayment(txid: string): Promise<'Aguardando pagamento' | 'Pago' | 'Cancelado' | 'Expirado' | 'Estornado' | 'Parcial'>;
  receiveWebhook(payload: any): Promise<{ success: boolean; txid: string; valorPago: number; status: string }>;
  refund(txid: string, valor?: number): Promise<boolean>;
  generateQRCode(copiaECola: string): Promise<string>;
  generatePixCopyPaste(txid: string, valor: number): Promise<string>;
  healthCheck(): Promise<boolean>;
}
