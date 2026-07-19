/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TENANT_CONFIG } from '../config/tenant';

export interface ReceiptItem {
  name: string;
  qty: number;
  price: number;
}

export function generateReceiptCanvas(
  title: string,
  subtitle: string,
  dateStr: string,
  items: ReceiptItem[],
  total: number,
  paymentMethod: string,
  extraDetails: string[] = []
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Configuration
  const width = 360;
  const itemHeight = 22;
  const headerHeight = 110;
  const extraHeight = extraDetails.length * 18;
  const barcodeHeight = 70;
  const footerHeight = 50;
  
  const itemsSectionHeight = (items.length || 1) * itemHeight;
  const height = headerHeight + 20 + itemsSectionHeight + 40 + extraHeight + barcodeHeight + footerHeight;

  canvas.width = width;
  canvas.height = height;

  // Background - pristine thermal paper look
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Outer border with tiny inner margin to simulate paper sheet edge
  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = 1;
  ctx.strokeRect(4, 4, width - 8, height - 8);

  // Set default receipt font
  ctx.fillStyle = '#111827'; // Near black for high contrast
  
  // Title (Centered)
  ctx.textAlign = 'center';
  ctx.font = 'bold 16px "Courier New", Courier, monospace';
  ctx.fillText(title.toUpperCase(), width / 2, 35);

  // Subtitle / Type of receipt
  ctx.font = 'bold 11px "Courier New", Courier, monospace';
  ctx.fillStyle = '#4B5563';
  ctx.fillText(subtitle.toUpperCase(), width / 2, 53);

  // Date and Time
  ctx.font = '10px "Courier New", Courier, monospace';
  ctx.fillText(`EMISSÃO: ${dateStr}`, width / 2, 68);
  ctx.fillText(TENANT_CONFIG.RECEIPT_FOOTER_VERSION, width / 2, 82);

  // Helper for dashed lines
  const drawDashedLine = (y: number) => {
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(15, y);
    ctx.lineTo(width - 15, y);
    ctx.stroke();
    ctx.setLineDash([]); // Reset
  };

  let currentY = 100;
  drawDashedLine(currentY);

  // Table Headers
  currentY += 15;
  ctx.textAlign = 'left';
  ctx.font = 'bold 10px "Courier New", Courier, monospace';
  ctx.fillStyle = '#1F2937';
  ctx.fillText('PRODUTO', 15, currentY);
  ctx.textAlign = 'center';
  ctx.fillText('QTD', width - 90, currentY);
  ctx.textAlign = 'right';
  ctx.fillText('TOTAL (R$)', width - 15, currentY);

  currentY += 10;
  drawDashedLine(currentY);

  // Items
  currentY += 18;
  ctx.font = '11px "Courier New", Courier, monospace';
  ctx.fillStyle = '#111827';

  if (items.length === 0) {
    ctx.textAlign = 'left';
    ctx.fillText('(Nenhum produto cadastrado)', 15, currentY);
    currentY += itemHeight;
  } else {
    items.forEach((item) => {
      ctx.textAlign = 'left';
      // Truncate name if too long
      let displayName = item.name;
      if (displayName.length > 22) {
        displayName = displayName.substring(0, 20) + '..';
      }
      ctx.fillText(displayName.toUpperCase(), 15, currentY);

      ctx.textAlign = 'center';
      ctx.fillText(item.qty.toString(), width - 90, currentY);

      ctx.textAlign = 'right';
      const itemTotal = (item.price * item.qty).toFixed(2);
      ctx.fillText(itemTotal, width - 15, currentY);

      currentY += itemHeight;
    });
  }

  drawDashedLine(currentY - 5);

  // Total Section
  currentY += 20;
  ctx.textAlign = 'left';
  ctx.font = 'bold 14px "Courier New", Courier, monospace';
  ctx.fillText('VALOR TOTAL:', 15, currentY);
  ctx.textAlign = 'right';
  ctx.font = 'bold 15px "Courier New", Courier, monospace';
  ctx.fillText(`R$ ${total.toFixed(2)}`, width - 15, currentY);

  // Payment Method
  currentY += 18;
  ctx.textAlign = 'left';
  ctx.font = '10px "Courier New", Courier, monospace';
  ctx.fillText(`FORMA DE PAGAMENTO: ${paymentMethod.toUpperCase()}`, 15, currentY);

  currentY += 12;
  drawDashedLine(currentY);

  // Extra details (e.g. Client info, pre-paid or debt state)
  if (extraDetails.length > 0) {
    currentY += 15;
    ctx.textAlign = 'left';
    ctx.font = 'bold 10px "Courier New", Courier, monospace';
    ctx.fillStyle = '#374151';
    
    extraDetails.forEach((detail) => {
      ctx.fillText(detail.toUpperCase(), 15, currentY);
      currentY += 15;
    });
    
    drawDashedLine(currentY - 5);
  }

  // Draw simulated thermal receipt barcode for high-fidelity look
  currentY += 20;
  const barcodeStartX = 50;
  const barcodeWidth = width - 100;
  const barcodeY = currentY;
  const barHeight = 35;

  ctx.fillStyle = '#111827';
  
  // Seed-based pseudo-random generator to make barcode look uniform
  let seed = 12345;
  const random = () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  let barX = barcodeStartX;
  while (barX < barcodeStartX + barcodeWidth) {
    const r = random();
    const barLineWidth = r < 0.3 ? 1 : r < 0.6 ? 2 : r < 0.83 ? 3 : 4;
    const spacing = Math.floor(random() * 3) + 1;
    
    ctx.fillRect(barX, barcodeY, barLineWidth, barHeight);
    barX += barLineWidth + spacing;
  }

  // Barcode number text
  currentY += barHeight + 12;
  ctx.textAlign = 'center';
  ctx.font = '9px "Courier New", Courier, monospace';
  ctx.fillStyle = '#6B7280';
  ctx.fillText('081239 912830 0019283 552199', width / 2, currentY);

  // Zigzag paper tear decoration at the bottom
  currentY += 15;
  ctx.fillStyle = '#E5E7EB';
  const zigzagY = height - 6;
  const toothWidth = 8;
  ctx.beginPath();
  ctx.moveTo(0, height);
  for (let x = 0; x <= width; x += toothWidth) {
    ctx.lineTo(x, zigzagY);
    ctx.lineTo(x + toothWidth / 2, height);
  }
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();

  return canvas;
}

export function downloadReceiptAsPNG(
  title: string,
  subtitle: string,
  dateStr: string,
  items: ReceiptItem[],
  total: number,
  paymentMethod: string,
  extraDetails: string[] = [],
  filename: string = 'recibo_cantina.png'
) {
  const canvas = generateReceiptCanvas(title, subtitle, dateStr, items, total, paymentMethod, extraDetails);
  
  try {
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Falha ao baixar recibo como imagem:', err);
  }
}
