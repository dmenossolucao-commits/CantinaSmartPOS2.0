/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PixCharge, BankReconciliation, Transaction } from '../types';

export interface AIAnalysisResult {
  duplicidades: {
    txid: string;
    vendaId: string;
    clienteNome: string;
    valor: number;
    motivo: string;
  }[];
  fraudes: {
    titulo: string;
    descricao: string;
    severidade: 'alta' | 'media' | 'baixa';
    itemAfetado?: string;
  }[];
  parciais: {
    txid: string;
    clienteNome: string;
    valorEsperado: number;
    valorRecebido: number;
    diferenca: number;
  }[];
  sugestoesConciliacao: {
    reconciliationId: string;
    vendaId: string;
    clienteNome: string;
    valor: number;
    confianca: number; // 0 to 100
    motivo: string;
  }[];
  relatorioTexto: string;
}

export class FinancialAIService {
  /**
   * Performs financial analysis on PIX charges, bank statement/reconciliation items, and sales transactions.
   */
  static async analyzeFinancials(
    pixCharges: PixCharge[],
    transactions: Transaction[],
    reconciliations: BankReconciliation[]
  ): Promise<AIAnalysisResult> {
    try {
      const response = await fetch('/api/financial-ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pixCharges, transactions, reconciliations }),
      });

      if (!response.ok) {
        throw new Error('Erro na requisição para a API de Inteligência Financeira.');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      console.warn('[FinancialAIService] Erro na chamada do backend. Usando motor heurístico local:', err);
      return this.heuristicAnalysis(pixCharges, transactions, reconciliations);
    }
  }

  /**
   * Local heuristic engine as a highly reliable fallback if Gemini is offline or unconfigured.
   */
  private static heuristicAnalysis(
    pixCharges: PixCharge[],
    transactions: Transaction[],
    reconciliations: BankReconciliation[]
  ): AIAnalysisResult {
    const duplicidades: AIAnalysisResult['duplicidades'] = [];
    const fraudes: AIAnalysisResult['fraudes'] = [];
    const parciais: AIAnalysisResult['parciais'] = [];
    const sugestoesConciliacao: AIAnalysisResult['sugestoesConciliacao'] = [];

    // 1. Detect Duplicated txids or payments
    const txidMap = new Map<string, PixCharge[]>();
    pixCharges.forEach((c) => {
      if (!txidMap.has(c.txid)) txidMap.set(c.txid, []);
      txidMap.get(c.txid)!.push(c);
    });

    txidMap.forEach((list, txid) => {
      const paid = list.filter((c) => c.status === 'Pago');
      if (paid.length > 1) {
        duplicidades.push({
          txid,
          vendaId: paid[0].vendaId,
          clienteNome: paid[0].clienteNome,
          valor: paid[0].valor,
          motivo: `Múltiplas cobranças registradas como pagas para o mesmo TxID (${txid}).`,
        });
      }
    });

    // 2. Identify Partial Payments
    reconciliations.forEach((rec) => {
      if (rec.status === 'Necessita análise' || rec.diferenca !== 0) {
        if (rec.valorRecebido < rec.valorEsperado && rec.valorRecebido > 0) {
          parciais.push({
            txid: rec.vendaId,
            clienteNome: rec.clienteNome,
            valorEsperado: rec.valorEsperado,
            valorRecebido: rec.valorRecebido,
            diferenca: rec.diferenca,
          });
        }
      }
    });

    // 3. Detect Anomalies & Fraud Candidates
    reconciliations.forEach((rec) => {
      // High expected value but very small paid amount
      if (rec.valorEsperado > 100 && rec.valorRecebido > 0 && rec.valorRecebido < 5) {
        fraudes.push({
          titulo: 'Pagamento de valor irrisório',
          descricao: `Cliente ${rec.clienteNome} pagou apenas R$ ${rec.valorRecebido.toFixed(2)} para uma cobrança esperada de R$ ${rec.valorEsperado.toFixed(2)}.`,
          severidade: 'alta',
          itemAfetado: rec.id,
        });
      }

      // Check for extremely late-night or weird timestamps
      if (rec.hora) {
        const hour = parseInt(rec.hora.split(':')[0]);
        if (hour >= 23 || hour <= 4) {
          fraudes.push({
            titulo: 'Transação em horário suspeito',
            descricao: `Conciliação recebida às ${rec.hora} da madrugada. Recomendado auditar registro de transação.`,
            severidade: 'baixa',
            itemAfetado: rec.id,
          });
        }
      }
    });

    // 4. Suggest Auto-Reconciliation Matches
    reconciliations.forEach((rec) => {
      if (rec.status === 'Pendente') {
        // Look for any outstanding transactions/charges matching expected amount and client
        const chargeMatch = pixCharges.find(
          (c) => c.status === 'Aguardando pagamento' && c.valor === rec.valorRecebido
        );
        if (chargeMatch) {
          sugestoesConciliacao.push({
            reconciliationId: rec.id,
            vendaId: chargeMatch.vendaId,
            clienteNome: rec.clienteNome,
            valor: rec.valorRecebido,
            confianca: 90,
            motivo: `Encontrada cobrança pendente de igual valor (R$ ${rec.valorRecebido.toFixed(2)}) gerada anteriormente.`,
          });
        }
      }
    });

    // Report generation
    const totalPendente = reconciliations.filter((r) => r.status === 'Pendente').length;
    const totalConciliado = reconciliations.filter((r) => r.status === 'Conciliado').length;
    const relatorioTexto = `**Relatório de IA Financeira (Heurístico Local)**

Análise financeira de ${reconciliations.length} registros de conciliação e ${pixCharges.length} cobranças PIX executada com sucesso.

- **Conciliados**: ${totalConciliado} transações confirmadas sem divergências.
- **Pendentes de Conciliação**: ${totalPendente} itens aguardando aprovação ou link bancário.
- **Duplicidades Detectadas**: ${duplicidades.length} potenciais txids repetidos.
- **Pagamentos Parciais**: ${parciais.length} clientes pagaram valores menores.
- **Alertas de Risco**: ${fraudes.length} anomalias encontradas.

*Dica da IA:* Verifique as sugestões de conciliação para associar automaticamente depósitos avulsos às suas respectivas vendas a prazo.`;

    return {
      duplicidades,
      fraudes,
      parciais,
      sugestoesConciliacao,
      relatorioTexto,
    };
  }
}
