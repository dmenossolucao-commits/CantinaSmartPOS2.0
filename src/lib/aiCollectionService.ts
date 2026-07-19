/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GerarMensagemParams {
  name: string;
  balance: number;
  daysOverdue: number;
  previousCount: number;
  tone: 'amigável' | 'educado' | 'formal' | 'firme' | 'muito firme';
  customTemplate?: string;
  pixKey?: string;
  copiaECola?: string;
  items?: { productName: string; quantity: number; price: number }[];
}

export interface AnalisarClienteParams {
  name: string;
  balance: number;
  daysOverdue: number;
  totalSalesCount: number;
  previousCount: number;
}

export interface ClientAnalysisResult {
  analysis: string;
  category: 'bom_pagador' | 'inadimplente' | 'recorrente';
  suggestedTone: 'amigável' | 'educado' | 'formal' | 'firme' | 'muito firme';
}

/**
 * AI Collection Service (Facade)
 * Acts as an abstraction layer separating the UI from AI execution.
 * Invokes server-side proxy routes to secure the Gemini API key.
 */
export const aiCollectionService = {
  /**
   * Generates a context-aware highly polite collection message using Gemini AI
   */
  async GerarMensagem(params: GerarMensagemParams): Promise<string> {
    try {
      const response = await fetch('/api/smart-cobranca/gerar-mensagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error('Erro ao gerar mensagem na API de IA');
      }

      const data = await response.json();
      return data.mensagem;
    } catch (error) {
      console.error('Erro no aiCollectionService.GerarMensagem:', error);
      // Clean fallback if AI fails
      const absBal = Math.abs(params.balance);
      return `Olá, ${params.name}! 😊 Passando para lembrar do seu saldo em aberto de R$ ${absBal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} na cantina. Se precisar negociar, estamos à disposição. Obrigado!`;
    }
  },

  /**
   * Analyzes client behavior based on debt timeline, payment frequency and return status
   */
  async AnalisarCliente(params: AnalisarClienteParams): Promise<ClientAnalysisResult> {
    try {
      const response = await fetch('/api/smart-cobranca/analisar-cliente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error('Erro ao analisar cliente na API de IA');
      }

      return await response.json();
    } catch (error) {
      console.error('Erro no aiCollectionService.AnalisarCliente:', error);
      // Safe fallback
      const days = params.daysOverdue;
      let category: 'bom_pagador' | 'inadimplente' | 'recorrente' = 'bom_pagador';
      let suggestedTone: 'amigável' | 'educado' | 'formal' | 'firme' | 'muito firme' = 'amigável';

      if (days > 30) {
        category = 'inadimplente';
        suggestedTone = 'firme';
      } else if (params.totalSalesCount > 5) {
        category = 'recorrente';
        suggestedTone = 'educado';
      }

      return {
        analysis: `Análise automática: Cliente possui saldo devedor ativo há ${days} dias.`,
        category,
        suggestedTone,
      };
    }
  },

  /**
   * Automatically calculates recommended collection tone based on debt delay
   */
  async GerarTom(daysOverdue: number): Promise<'amigável' | 'educado' | 'formal' | 'firme' | 'muito firme'> {
    if (daysOverdue <= 7) return 'amigável';
    if (daysOverdue <= 15) return 'educado';
    if (daysOverdue <= 30) return 'formal';
    if (daysOverdue <= 45) return 'firme';
    return 'muito firme';
  },

  /**
   * Generates a high-level briefing/summary of current debts for a dashboard overview
   */
  async GerarResumo(clientDebts: { name: string; balance: number; daysOverdue: number }[]): Promise<string> {
    try {
      const response = await fetch('/api/smart-cobranca/gerar-resumo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientDebts }),
      });

      if (!response.ok) {
        throw new Error('Erro ao gerar resumo na API de IA');
      }

      const data = await response.json();
      return data.resumo;
    } catch (error) {
      console.error('Erro no aiCollectionService.GerarResumo:', error);
      const totalDebt = clientDebts.reduce((sum, c) => sum + Math.abs(c.balance), 0);
      return `Resumo do Caixa: Atualmente temos ${clientDebts.length} clientes em débito, totalizando R$ ${totalDebt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} pendentes.`;
    }
  }
};
