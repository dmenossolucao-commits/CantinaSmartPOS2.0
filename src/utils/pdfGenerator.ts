/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import { Client, Transaction } from '../types';
import { TENANT_CONFIG } from '../config/tenant';

// Helper to parse hex colors to RGB for jsPDF
function hexToRgb(hex: string): [number, number, number] {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  return [r, g, b];
}

/**
 * Generates a clean, highly professional PDF report for all debtors (saldo devedor < 0).
 * It includes detailed "prazo" (credit) transaction items, quantities, values, dates, and subtotals.
 */
export function generateOutstandingDebtorsPDF(
  clients: Client[],
  transactions: Transaction[]
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const primaryRgb = hexToRgb(TENANT_CONFIG.THEME_COLORS.primary);
  const dangerRgb = hexToRgb(TENANT_CONFIG.THEME_COLORS.danger);
  const primaryLightRgb = hexToRgb(TENANT_CONFIG.THEME_COLORS.primaryLight);

  const pageNumRef = { val: 1 };
  const totalOutstanding = clients.reduce((sum, c) => c.balance < 0 ? sum + Math.abs(c.balance) : sum, 0);
  const totalDebtorsCount = clients.filter(c => c.balance < 0).length;

  // Filter and sort debtors alphabetically
  const debtorsList = clients
    .filter(c => c.balance < 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Helper to draw clean page header
  function drawPageHeader(pdf: jsPDF, pageNum: number) {
    // Top primary color accent line
    pdf.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    pdf.rect(15, 10, 180, 1.5, 'F');
    
    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`${TENANT_CONFIG.COMPANY_NAME.toUpperCase()} • RELATÓRIO DE CONTAS A PRAZO`, 15, 17);
    
    pdf.setFont('Helvetica', 'normal');
    pdf.text(`Página ${pageNum}`, 195, 17, { align: 'right' });
    
    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.2);
    pdf.line(15, 19, 195, 19);
  }

  // Helper to draw first page primary header block
  function drawFirstPageMainHeader(pdf: jsPDF) {
    // Header block
    pdf.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    pdf.rect(15, 15, 180, 22, 'F');
    
    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(255, 255, 255);
    pdf.text(TENANT_CONFIG.COMPANY_NAME.toUpperCase(), 22, 27);
    
    pdf.setFont('Helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(190, 220, 205);
    pdf.text('Relatório Consolidado de Devedores a Prazo', 22, 32);
    
    // Right meta
    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(255, 210, 0); // Golden accent
    pdf.text('EXTRATO DE SALDO DEVEDOR', 190, 27, { align: 'right' });
    
    pdf.setFont('Helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(255, 255, 255);
    const nowStr = new Date().toLocaleString('pt-BR');
    pdf.text(`Gerado em: ${nowStr}`, 190, 32, { align: 'right' });
  }

  // Helper to handle pagination overflow dynamically
  function checkPageOverflow(pdf: jsPDF, currentY: number, lineNeeded: number): number {
    if (currentY + lineNeeded > 275) {
      pdf.addPage();
      pageNumRef.val += 1;
      drawPageHeader(pdf, pageNumRef.val);
      return 26; // Initial Y after header on new pages
    }
    return currentY;
  }

  // 1. Initial Page setup
  drawFirstPageMainHeader(doc);
  let currentY = 44;

  // Overview stats summary card
  doc.setFillColor(245, 247, 246);
  doc.rect(15, currentY, 180, 15, 'F');
  doc.setDrawColor(200, 215, 208);
  doc.setLineWidth(0.3);
  doc.rect(15, currentY, 180, 15, 'D');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(60, 70, 65);
  doc.text('RESUMO DO RELATÓRIO:', 20, currentY + 9);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Total de Clientes em Aberto: `, 70, currentY + 9);
  doc.setFont('Helvetica', 'bold');
  doc.text(`${totalDebtorsCount}`, 115, currentY + 9);

  doc.setFont('Helvetica', 'normal');
  doc.text(`Valor Total Geral de Débito: `, 130, currentY + 9);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(dangerRgb[0], dangerRgb[1], dangerRgb[2]);
  doc.text(`R$ ${totalOutstanding.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 172, currentY + 9);

  currentY += 22;

  if (debtorsList.length === 0) {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(16, 185, 129);
    doc.text('Não há clientes com saldo devedor pendente no momento.', 15, currentY);
  } else {
    // 2. Loop through all outstanding debtors
    debtorsList.forEach(client => {
      const absBal = Math.abs(client.balance);

      // Add a client banner section
      currentY = checkPageOverflow(doc, currentY, 16);
      
      doc.setFillColor(primaryLightRgb[0], primaryLightRgb[1], primaryLightRgb[2]);
      doc.rect(15, currentY, 180, 7, 'F');
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
      doc.text(`CLIENTE: ${client.name.toUpperCase()}`, 18, currentY + 4.8);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 100, 100);
      doc.text(`Grupo/Turma: ${client.classOrDept}`, 105, currentY + 4.8);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(dangerRgb[0], dangerRgb[1], dangerRgb[2]);
      doc.text(`Total Devido: R$ ${absBal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 192, currentY + 4.8, { align: 'right' });

      currentY += 9;

      // Draw table columns header
      currentY = checkPageOverflow(doc, currentY, 8);
      doc.setFillColor(225, 232, 228);
      doc.rect(15, currentY, 180, 4.5, 'F');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(60, 80, 70);
      doc.text('Dia / Data', 18, currentY + 3.2);
      doc.text('Produto / Descrição do Consumo', 38, currentY + 3.2);
      doc.text('Qtd', 115, currentY + 3.2);
      doc.text('Vlr Unitário', 135, currentY + 3.2);
      doc.text('Vlr Total', 165, currentY + 3.2);

      currentY += 4.5;

      // Filter transactions for this client that were processed "a prazo"
      const clientTx = transactions.filter(
        t => t.clientId === client.id && t.paymentMethod === 'prazo' && t.status === 'pendente'
      );

      let listedTxTotal = 0;

      if (clientTx.length > 0) {
        clientTx.forEach(tx => {
          const dateStr = new Date(tx.timestamp).toLocaleDateString('pt-BR');

          tx.items.forEach(item => {
            currentY = checkPageOverflow(doc, currentY, 4.5);

            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(60, 60, 60);

            // Date
            doc.text(dateStr, 18, currentY + 3.2);

            // Truncate product name if too long for layout
            let pName = item.productName;
            if (pName.length > 40) pName = pName.substring(0, 37) + '...';
            doc.text(pName, 38, currentY + 3.2);

            // Quantity
            doc.text(`${item.quantity}x`, 115, currentY + 3.2);

            // Unit Price
            doc.text(`R$ ${item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 135, currentY + 3.2);

            // Total price for this item
            const itemTotal = item.price * item.quantity;
            doc.text(`R$ ${itemTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 165, currentY + 3.2);

            // Draw clean divider line
            doc.setDrawColor(240, 243, 241);
            doc.setLineWidth(0.15);
            doc.line(15, currentY + 4.2, 195, currentY + 4.2);

            listedTxTotal += itemTotal;
            currentY += 4.2;
          });
        });
      }

      // Check if there is an difference/balance adjustment or historic migrated debt
      const discrepancy = absBal - listedTxTotal;
      if (discrepancy > 0.01) {
        currentY = checkPageOverflow(doc, currentY, 4.5);

        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(110, 100, 100);

        doc.text('-', 18, currentY + 3.2);
        doc.text('Saldo Devedor Anterior / Lançamento Manual / Ajustes', 38, currentY + 3.2);
        doc.text('1x', 115, currentY + 3.2);
        doc.text(`R$ ${discrepancy.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 135, currentY + 3.2);
        doc.text(`R$ ${discrepancy.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 165, currentY + 3.2);

        doc.setDrawColor(240, 243, 241);
        doc.setLineWidth(0.15);
        doc.line(15, currentY + 4.2, 195, currentY + 4.2);

        currentY += 4.2;
      }

      // Add small subtotal line for the client
      currentY = checkPageOverflow(doc, currentY, 7);
      doc.setDrawColor(200, 210, 205);
      doc.setLineWidth(0.25);
      doc.line(15, currentY + 1, 195, currentY + 1);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(80, 80, 80);
      doc.text(`Subtotal para ${client.name.split(' ')[0]}:`, 115, currentY + 4.2);
      
      doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
      doc.text(`R$ ${absBal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 192, currentY + 4.2, { align: 'right' });

      currentY += 8;

      // Add elegant divider between clients
      currentY = checkPageOverflow(doc, currentY, 4);
      doc.setDrawColor(220, 225, 222);
      doc.setLineWidth(0.2);
      doc.line(15, currentY, 195, currentY);
      currentY += 5; // spacing before next client card
    });

    // 3. Print grand total box at the absolute end of report
    currentY = checkPageOverflow(doc, currentY, 20);
    
    doc.setFillColor(235, 243, 239); // light green accent background
    doc.rect(15, currentY, 180, 11, 'F');
    doc.setDrawColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.setLineWidth(0.4);
    doc.rect(15, currentY, 180, 11, 'D');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text('VALOR TOTAL DE CONTAS A PRAZO ACUMULADAS', 20, currentY + 7);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(dangerRgb[0], dangerRgb[1], dangerRgb[2]);
    doc.text(`R$ ${totalOutstanding.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 190, currentY + 7, { align: 'right' });
  }

  // Save/Download PDF
  const filename = `relatorio_devedores_prazo_${new Date().toISOString().slice(0,10)}.pdf`;
  doc.save(filename);
}
