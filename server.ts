/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK with telemetry header
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", mode: process.env.NODE_ENV });
});

// Endpoint: Generate Contextual Polite Collection Message
app.post('/api/smart-cobranca/gerar-mensagem', async (req, res) => {
  if (!apiKey) {
    return res.status(500).json({ error: "Chave de API do Gemini não configurada." });
  }
  const { name, balance, daysOverdue, previousCount, tone, customTemplate, pixKey, copiaECola, items } = req.body;
  const absBal = Math.abs(balance || 0);

  let itemsText = '';
  if (items && items.length > 0) {
    if (items[0].date) {
      // Group items by date
      const groups: { [date: string]: any[] } = {};
      items.forEach((it: any) => {
        if (!groups[it.date]) {
          groups[it.date] = [];
        }
        groups[it.date].push(it);
      });

      const fillDots = (left: string, right: string, targetLength: number = 38) => {
        const currentLength = left.length + right.length;
        if (currentLength >= targetLength) {
          return `${left} ${right}`;
        }
        const dotsCount = targetLength - currentLength;
        const dots = '.'.repeat(dotsCount);
        return `${left} ${dots} ${right}`;
      };

      const groupStrings = Object.keys(groups).map(dateKey => {
        const groupItems = groups[dateKey];
        let groupStr = `Compra ${dateKey}\n`;
        let subtotal = 0;
        groupItems.forEach((it: any) => {
          const unitPriceFormatted = it.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
          const subtotalVal = it.price * it.quantity;
          const subtotalFormatted = subtotalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
          const leftStr = `${it.quantity} × ${it.productName} (un: R$ ${unitPriceFormatted})`;
          const rightStr = `R$ ${subtotalFormatted}`;
          groupStr += `${fillDots(leftStr, rightStr)}\n`;
          subtotal += subtotalVal;
        });
        const leftSub = 'Subtotal desta compra';
        const rightSub = `R$ ${subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        groupStr += `${fillDots(leftSub, rightSub)}`;
        return groupStr;
      });

      itemsText = groupStrings.join('\n\n');
    } else {
      // Legacy format
      itemsText = items.map((it: any) => `• ${it.quantity}x ${it.productName} (un: R$ ${it.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`).join('\n');
    }
  } else {
    itemsText = 'Compras gerais pendentes';
  }

  const systemInstruction = `Você é o assistente virtual inteligente da cantina escolar/corporativa. Seu objetivo é gerar mensagens de cobrança extremamente educadas, gentis e contextuais para os clientes da cantina com compras a prazo (fiado) pendentes.
 
A mensagem de cobrança gerada para o cliente DEVE seguir estritamente a seguinte estrutura geral (ajustada de acordo com o tom '${tone}' selecionado):
 
Olá, {Nome do Cliente}! 😊
 
Esperamos que esteja tudo bem com você.
 
Identificamos que existem pagamentos pendentes em sua conta na Cantina Smart.
 
Seguem os produtos que permanecem em aberto:
 
{LISTA_DAS_COMPRAS_PENDENTES}
 
--------------------------------
TOTAL DO SALDO DEVEDOR: R$ {TOTAL}
 
Você pode realizar o pagamento utilizando:
 
• PIX Copia e Cola
Código Copia e Cola: ${copiaECola || 'Não gerado'}
 
ou
 
• Chave PIX
Chave PIX: ${pixKey || 'Não fornecida'}
 
Assim que o pagamento for identificado, sua conta será atualizada automaticamente.
 
Caso este pagamento já tenha sido realizado, por favor, desconsidere esta mensagem.
 
Agradecemos pela confiança e preferência!
 
REGRAS CRÍTICAS:
1. Nunca use termos rudes, ameaçadores ou ofensivos. Seja empático, humano e acolhedor.
2. Adote estritamente o tom configurado: '${tone}'.
   - amigável: Tom extremamente caloroso, simpático, com emojis simpáticos e leves.
   - educado: Profissional, polido, muito solícito.
   - formal: Linguagem polida, de negócios, respeitosa, sem gírias nem intimidade excessiva.
   - firme: Direto ao ponto, destaca o valor e o atraso de forma respeitosa, enfatiza a importância de manter a conta em dia.
   - muito firme: Enfatiza os ${daysOverdue} dias de atraso e pede contato urgente de forma educada, séria e profissional.
3. Se houver um modelo personalizado de mensagem ('${customTemplate || ''}'), use-o como inspiração de estrutura, mas adapte de forma inteligente para não soar robótico.
4. Nunca envie a exata mesma mensagem se houver cobranças anteriores (${previousCount} cobranças anteriores). Use outras saudações e explicações.
5. Você DEVE incluir obrigatoriamente as DUAS opções de chaves Pix de forma clara e visualmente organizada conforme a estrutura acima.
6. Apresente no local de {LISTA_DAS_COMPRAS_PENDENTES} a listagem das compras pendentes EXATAMENTE como fornecida no prompt, mantendo as compras individuais agrupadas por data com seus respectivos itens, quantidades, valores unitários, subtotais por compra e a formatação com pontos. Não altere os valores nem resuma as compras.
7. Nunca mostre o histórico completo de movimentações já pagas, liquidadas ou encerradas. Apenas as compras em aberto recebidas.
8. Gere somente o texto final pronto para ser enviado via WhatsApp, sem cabeçalhos adicionais de IA, sem aspas, e sem explicações pré-texto ou pós-texto.`;

  const prompt = `Gere uma mensagem de cobrança de WhatsApp com as seguintes informações:
- Cliente: ${name}
- Valor em atraso: R$ ${absBal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Tempo de atraso: ${daysOverdue} dias
- Quantidade de cobranças já enviadas: ${previousCount}
- Detalhes de itens em aberto (saldo devedor):
${itemsText}
- Opção 1: PIX Copia e Cola: ${copiaECola || 'Não gerado'}
- Opção 2: Chave PIX Cadastrada: ${pixKey || 'Não fornecida'}
- Tom selecionado pelo lojista: ${tone}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    res.json({ mensagem: response.text || "" });
  } catch (error: any) {
    console.error("Erro na API Gemini ao gerar-mensagem:", error);
    res.status(500).json({ error: error.message || "Erro desconhecido ao gerar mensagem." });
  }
});

// Endpoint: AI-powered client profile analyzer
app.post('/api/smart-cobranca/analisar-cliente', async (req, res) => {
  if (!apiKey) {
    return res.status(500).json({ error: "Chave de API do Gemini não configurada." });
  }

  const { name, balance, daysOverdue, totalSalesCount, previousCount } = req.body;
  const absBal = Math.abs(balance || 0);

  const systemInstruction = `Você é um Analista de Risco e Crédito Inteligente da cantina. Sua tarefa é analisar as informações do devedor e fornecer um parecer.
Você deve categorizar o cliente em uma de três classificações:
1. 'bom_pagador': Clientes fiéis, com histórico de compra alto, atrasos de pouquíssimos dias ou sem histórico de inadimplência severa.
2. 'inadimplente': Clientes com atrasos superiores a 25 dias ou que já receberam mais de 3 cobranças sem responder.
3. 'recorrente': Clientes frequentes que usam o limite de crédito ativamente e pagam regularmente, mas acumulam contas pendentes de menor duração.

Também sugira o melhor tom recomendado para cobrança ('amigável', 'educado', 'formal', 'firme', 'muito firme') e dê uma pequena análise explicativa de 2 frases.
Retorne EXCLUSIVAMENTE um objeto JSON válido correspondente a este esquema:
{
  "analysis": "Explicação curta da análise em português",
  "category": "bom_pagador" | "inadimplente" | "recorrente",
  "suggestedTone": "amigável" | "educado" | "formal" | "firme" | "muito firme"
}`;

  const prompt = `Analise o cliente:
- Nome: ${name}
- Débito Atual: R$ ${absBal.toFixed(2)}
- Dias de Atraso do Débito: ${daysOverdue} dias
- Compras a Prazo Totais no Histórico: ${totalSalesCount}
- Cobranças já Realizadas: ${previousCount}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.4,
      },
    });

    let data = {
      analysis: "Análise padrão indisponível",
      category: "bom_pagador" as const,
      suggestedTone: "amigável" as const
    };

    try {
      if (response.text) {
        data = JSON.parse(response.text);
      }
    } catch (parseError) {
      console.error("Erro ao fazer parse do JSON do Gemini:", parseError, response.text);
    }

    res.json(data);
  } catch (error: any) {
    console.error("Erro na API Gemini ao analisar-cliente:", error);
    res.status(500).json({ error: error.message || "Erro de servidor ao analisar cliente." });
  }
});

// Endpoint: AI-powered Dashboard summarizer / briefing generator
app.post('/api/smart-cobranca/gerar-resumo', async (req, res) => {
  if (!apiKey) {
    return res.status(500).json({ error: "Chave de API do Gemini não configurada." });
  }

  const { clientDebts } = req.body;

  const systemInstruction = `Você é o Diretor Financeiro Inteligente da cantina. Sua tarefa é analisar a lista consolidada de clientes inadimplentes ou devedores e redigir um briefing ou boletim executivo sucinto (máximo de 3 parágrafos).
Destaque:
1. O montante total em aberto e número de devedores.
2. Identifique tendências de atrasos severos ou maiores devedores que merecem atenção urgente.
3. Forneça 2 recomendações estratégicas práticas para otimizar as cobranças neste mês.
Escreva em português, com tom profissional, encorajador e focado em resultados. Use emojis de forma moderada e profissional.`;

  const prompt = `Lista consolidada de devedores atuais da cantina:
${JSON.stringify(clientDebts || [])}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.5,
      },
    });

    res.json({ resumo: response.text || "Sem dados para o resumo." });
  } catch (error: any) {
    console.error("Erro na API Gemini ao gerar-resumo:", error);
    res.status(500).json({ error: error.message || "Erro ao gerar resumo financeiro." });
  }
});

// Endpoint: Smart Financial PIX Analyzer
app.post('/api/financial-ai/analyze', async (req, res) => {
  if (!apiKey) {
    return res.status(500).json({ error: "Chave de API do Gemini não configurada." });
  }

  const { pixCharges, transactions, reconciliations } = req.body;

  const systemInstruction = `Você é o Auditor e Analista Financeiro com Inteligência Artificial para a Cantina Smart. Sua tarefa é auditar e cruzar dados de:
1. Cobranças PIX emitidas (pixCharges)
2. Vendas/Transações efetuadas (transactions)
3. Extrato/Conciliação bancária (reconciliations)

Você deve auditar as transações para identificar:
- Duplicidades de pagamentos para o mesmo TxID ou venda (onde múltiplos registros constam como pagos).
- Possíveis fraudes ou anomalias (como divergência severa de valores pagos, horários suspeitos na madrugada como de 23:00 às 04:00, nomes de clientes incorretos).
- Pagamentos parciais (onde o valor recebido na conciliação é menor que o esperado).
- Sugestões de conciliação automática (cruzar um item de conciliação pendente com uma venda/cobrança que tenha mesmo valor e nome de cliente parecido, indicando confiança de 0 a 100).
- Redigir um relatório financeiro inteligente, sucinto, em português, incentivando boas práticas.

Retorne EXCLUSIVAMENTE um objeto JSON válido seguindo este esquema exato:
{
  "duplicidades": [
    { "txid": "string", "vendaId": "string", "clienteNome": "string", "valor": 12.34, "motivo": "string" }
  ],
  "fraudes": [
    { "titulo": "string", "descricao": "string", "severidade": "alta" | "media" | "baixa", "itemAfetado": "string opcional" }
  ],
  "parciais": [
    { "txid": "string", "clienteNome": "string", "valorEsperado": 12.34, "valorRecebido": 10.00, "diferenca": 2.34 }
  ],
  "sugestoesConciliacao": [
    { "reconciliationId": "string", "vendaId": "string", "clienteNome": "string", "valor": 12.34, "confianca": 95, "motivo": "string" }
  ],
  "relatorioTexto": "Relatório explicativo detalhado e profissional com resumo das finanças"
}`;

  const prompt = `Analise os seguintes dados do sistema financeiro:
--- COBRANÇAS PIX ---
${JSON.stringify(pixCharges || [])}

--- VENDAS / TRANSAÇÕES ---
${JSON.stringify(transactions || [])}

--- CONCILIAÇÃO BANCÁRIA ---
${JSON.stringify(reconciliations || [])}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    });

    let data = {
      duplicidades: [],
      fraudes: [],
      parciais: [],
      sugestoesConciliacao: [],
      relatorioTexto: "Análise indisponível."
    };

    try {
      if (response.text) {
        data = JSON.parse(response.text);
      }
    } catch (parseError) {
      console.error("Erro ao fazer parse do JSON do Gemini Financeiro:", parseError, response.text);
    }

    res.json(data);
  } catch (error: any) {
    console.error("Erro na API Gemini ao analisar-financeiro:", error);
    res.status(500).json({ error: error.message || "Erro de servidor ao analisar dados financeiros." });
  }
});

// Vite Setup (Development vs. Production)
async function startViteMiddleware() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on host 0.0.0.0 and port ${PORT}`);
  });
}

startViteMiddleware().catch((err) => {
  console.error("Falha ao iniciar o middleware do Vite no Express:", err);
});
