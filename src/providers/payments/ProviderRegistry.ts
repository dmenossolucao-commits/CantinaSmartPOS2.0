import { PaymentProvider } from './PaymentProvider';
import { StoneProvider } from './StoneProvider';
import { AsaasProvider } from './AsaasProvider';
import { EfiProvider } from './EfiProvider';
import { MercadoPagoProvider } from './MercadoPagoProvider';
import { PagSeguroProvider } from './PagSeguroProvider';
import { CustomProvider } from './CustomProvider';

export interface ProviderConfig {
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
}

export const INITIAL_PROVIDERS_CONFIG: ProviderConfig[] = [
  { id: 'stone', name: 'Stone', status: 'Ativo', apiKey: 'sk_test_stone_123', secretKey: 'sec_stone_123', ambiente: 'Homologação', webhookUrl: 'https://api.udvcantina.com/v1/webhook/stone' },
  { id: 'asaas', name: 'Asaas', status: 'Inativo', apiKey: 'sk_test_asaas_123', secretKey: '', ambiente: 'Homologação', webhookUrl: 'https://api.udvcantina.com/v1/webhook/asaas' },
  { id: 'efi', name: 'Efí Bank', status: 'Inativo', clientId: 'cli_efi_123', clientSecret: 'sec_efi_123', ambiente: 'Homologação', webhookUrl: 'https://api.udvcantina.com/v1/webhook/efi' },
  { id: 'mercadopago', name: 'Mercado Pago', status: 'Inativo', apiKey: 'sk_test_mp_123', ambiente: 'Homologação', webhookUrl: 'https://api.udvcantina.com/v1/webhook/mp' },
  { id: 'pagseguro', name: 'PagBank', status: 'Inativo', apiKey: 'sk_test_pb_123', ambiente: 'Homologação', webhookUrl: 'https://api.udvcantina.com/v1/webhook/pagbank' },
  { id: 'bb', name: 'Banco do Brasil', status: 'Inativo', clientId: 'cli_bb_123', clientSecret: 'sec_bb_123', ambiente: 'Homologação', webhookUrl: 'https://api.udvcantina.com/v1/webhook/bb' },
  { id: 'sicredi', name: 'Sicredi', status: 'Inativo', clientId: 'cli_sicredi_123', clientSecret: 'sec_sicredi_123', ambiente: 'Homologação', webhookUrl: 'https://api.udvcantina.com/v1/webhook/sicredi' },
  { id: 'sicoob', name: 'Sicoob', status: 'Inativo', clientId: 'cli_sicoob_123', clientSecret: 'sec_sicoob_123', ambiente: 'Homologação', webhookUrl: 'https://api.udvcantina.com/v1/webhook/sicoob' },
  { id: 'personalizado', name: 'Personalizado', status: 'Inativo', apiKey: 'sk_custom_123', secretKey: 'sec_custom_123', ambiente: 'Homologação', webhookUrl: 'https://api.udvcantina.com/v1/webhook/custom' },
];

export function createProviderInstance(config: ProviderConfig): PaymentProvider {
  // Simple encryption/decryption simulator wrapper for keys
  const decryptedConfig = {
    ...config,
    apiKey: config.apiKey ? decryptKey(config.apiKey) : undefined,
    secretKey: config.secretKey ? decryptKey(config.secretKey) : undefined,
    clientId: config.clientId ? decryptKey(config.clientId) : undefined,
    clientSecret: config.clientSecret ? decryptKey(config.clientSecret) : undefined,
  };

  switch (config.id) {
    case 'stone':
      return new StoneProvider(decryptedConfig);
    case 'asaas':
      return new AsaasProvider(decryptedConfig);
    case 'efi':
      return new EfiProvider(decryptedConfig);
    case 'mercadopago':
      return new MercadoPagoProvider(decryptedConfig);
    case 'pagseguro':
      return new PagSeguroProvider(decryptedConfig);
    default:
      // Works for bb, sicoob, sicredi, personalizado
      return new CustomProvider(config.id, config.name, decryptedConfig);
  }
}

// Key Security helper
export function encryptKey(key: string): string {
  if (!key) return '';
  if (key.startsWith('enc_')) return key; // already encrypted
  // Simple Base64 + obfuscation prefix for visual key security
  return 'enc_' + btoa(key);
}

export function decryptKey(encryptedKey: string): string {
  if (!encryptedKey) return '';
  if (!encryptedKey.startsWith('enc_')) return encryptedKey;
  try {
    return atob(encryptedKey.replace('enc_', ''));
  } catch (e) {
    return encryptedKey;
  }
}
