import { PaymentProvider, PixCharge } from './PaymentProvider';

export class CustomProvider implements PaymentProvider {
  id: string;
  name: string;
  status: 'Ativo' | 'Inativo' = 'Inativo';
  apiKey?: string;
  secretKey?: string;
  clientId?: string;
  clientSecret?: string;
  webhookUrl?: string;
  ambiente: 'Produção' | 'Homologação' = 'Homologação';
  observacoes?: string;

  constructor(id: string, name: string, data?: Partial<PaymentProvider>) {
    this.id = id;
    this.name = name;
    Object.assign(this, data);
  }

  async connect(): Promise<boolean> {
    console.log(`[CustomProvider - ${this.name}] Conectando...`);
    return true;
  }

  async disconnect(): Promise<boolean> {
    console.log(`[CustomProvider - ${this.name}] Desconectando...`);
    return true;
  }

  async createPixCharge(vendaId: string, clienteId: string, clienteNome: string, valor: number): Promise<PixCharge> {
    const txid = `${this.id}_` + Math.random().toString(36).substring(2, 12).toUpperCase();
    const copiaECola = `00020101021226720014br.gov.bcb.pix2550pix.${this.id}.com.br/v2/${txid}5204000053039865405${valor.toFixed(2)}5802BR5915CantinaSmartPOS6009Sao Paulo62070503***6304A1B2`;
    const vencimento = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    return {
      id: Math.random().toString(36).substring(2, 9),
      vendaId,
      clienteId,
      clienteNome,
      valor,
      data: new Date().toISOString(),
      status: 'Aguardando pagamento',
      txid,
      qrcode: await this.generateQRCode(copiaECola),
      copiaECola,
      vencimento,
      instituicao: this.name,
    };
  }

  async cancelCharge(txid: string): Promise<boolean> {
    console.log(`[CustomProvider - ${this.name}] Cancelando cobrança ${txid}`);
    return true;
  }

  async checkPayment(txid: string): Promise<'Aguardando pagamento' | 'Pago' | 'Cancelado' | 'Expirado' | 'Estornado' | 'Parcial'> {
    console.log(`[CustomProvider - ${this.name}] Verificando pagamento ${txid}`);
    return 'Aguardando pagamento';
  }

  async receiveWebhook(payload: any): Promise<{ success: boolean; txid: string; valorPago: number; status: string }> {
    console.log(`[CustomProvider - ${this.name}] Webhook recebido`, payload);
    const txid = payload.txid || '';
    const valorPago = parseFloat(payload.valor) || 0;
    return {
      success: true,
      txid,
      valorPago,
      status: 'Pago',
    };
  }

  async refund(txid: string, valor?: number): Promise<boolean> {
    console.log(`[CustomProvider - ${this.name}] Estornando ${valor || 'total'} para txid ${txid}`);
    return true;
  }

  async generateQRCode(copiaECola: string): Promise<string> {
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(copiaECola)}`;
  }

  async generatePixCopyPaste(txid: string, valor: number): Promise<string> {
    return `00020101021226720014br.gov.bcb.pix2550pix.${this.id}.com.br/v2/${txid}5204000053039865405${valor.toFixed(2)}5802BR5915CantinaSmartPOS6009Sao Paulo62070503***6304A1B2`;
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
