/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ProviderType = 'whatsapp_manual' | 'whatsapp_official' | 'evolution_api' | 'twilio';

export interface MessagePayload {
  to: string; // phone number (e.g. "5511999999999")
  message: string;
  clientId?: string;
  clientName?: string;
}

export interface MessagingProviderInterface {
  id: ProviderType;
  name: string;
  description: string;
  sendMessage(payload: MessagePayload): Promise<{ success: boolean; details?: string; type: 'manual' | 'automatic' }>;
}

/**
 * MessagingProvider implementations
 */
export const WhatsAppManualProvider: MessagingProviderInterface = {
  id: 'whatsapp_manual',
  name: 'WhatsApp Manual',
  description: 'Abre o WhatsApp Web/App com a mensagem pronta para envio manual.',
  async sendMessage(payload: MessagePayload) {
    const cleanedPhone = payload.to.replace(/[^0-9]/g, '');
    const url = `https://api.whatsapp.com/send?phone=${cleanedPhone}&text=${encodeURIComponent(payload.message)}`;
    
    // Open in a new tab for manual dispatch
    window.open(url, '_blank');
    
    return { 
      success: true, 
      details: 'WhatsApp aberto em nova janela para envio.',
      type: 'manual' 
    };
  }
};

export const WhatsAppOfficialProvider: MessagingProviderInterface = {
  id: 'whatsapp_official',
  name: 'WhatsApp Business API (Oficial)',
  description: 'Integração direta com o provedor oficial Meta Cloud API.',
  async sendMessage(payload: MessagePayload) {
    console.log('[MOCK PROVIDER - OFFICIAL] Enviando mensagem via WhatsApp API oficial para:', payload.to);
    return { 
      success: true, 
      details: 'Disparado automaticamente via API oficial (Simulação).',
      type: 'automatic' 
    };
  }
};

export const EvolutionAPIProvider: MessagingProviderInterface = {
  id: 'evolution_api',
  name: 'Evolution API',
  description: 'Provedor para instâncias auto-hospedadas do Evolution API.',
  async sendMessage(payload: MessagePayload) {
    console.log('[MOCK PROVIDER - EVOLUTION] Enviando mensagem via Evolution API para:', payload.to);
    return { 
      success: true, 
      details: 'Disparado automaticamente via Evolution API (Simulação).',
      type: 'automatic' 
    };
  }
};

export const TwilioProvider: MessagingProviderInterface = {
  id: 'twilio',
  name: 'Twilio WhatsApp',
  description: 'Disparo de mensagens transacionais via canais oficiais Twilio.',
  async sendMessage(payload: MessagePayload) {
    console.log('[MOCK PROVIDER - TWILIO] Enviando mensagem via Twilio para:', payload.to);
    return { 
      success: true, 
      details: 'Disparado automaticamente via Twilio WhatsApp Gateway (Simulação).',
      type: 'automatic' 
    };
  }
};

export const providersList: MessagingProviderInterface[] = [
  WhatsAppManualProvider,
  WhatsAppOfficialProvider,
  EvolutionAPIProvider,
  TwilioProvider
];

export function getProvider(id: ProviderType): MessagingProviderInterface {
  return providersList.find(p => p.id === id) || WhatsAppManualProvider;
}
