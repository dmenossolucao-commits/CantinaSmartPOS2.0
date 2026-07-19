/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TENANT_CONFIG } from '../config/tenant';

/**
 * Generates a real standards-compliant Brazilian PIX Static EMV payload (Copia e Cola).
 * 
 * @param key The destination PIX key (Email, CPF, CNPJ, Phone, or Random Key)
 * @param amount The transaction value
 * @param merchantName Name of the merchant (max 25 characters)
 * @param merchantCity City of the merchant (max 15 characters)
 */
export function generatePixPayload(
  key: string,
  amount: number,
  merchantName = TENANT_CONFIG.PIX_MERCHANT_NAME,
  merchantCity = TENANT_CONFIG.PIX_MERCHANT_CITY
): string {
  const cleanKey = key.trim();
  const formattedAmount = amount.toFixed(2);
  
  // EMV format helper: ID + Length + Value
  const f = (id: string, value: string): string => {
    const len = value.length.toString().padStart(2, '0');
    return id + len + value;
  };
  
  // Format merchant key information GUI (Globally Unique Identifier) for Pix
  const gui = f('00', 'br.gov.bcb.pix') + f('01', cleanKey);
  
  const payloadMap = [
    f('00', '01'),             // Payload Format Indicator
    f('26', gui),              // Merchant Account Information (Pix Key)
    f('52', '0000'),           // Merchant Category Code
    f('53', '986'),            // Transaction Currency (BRL = 986)
    f('54', formattedAmount),   // Transaction Amount
    f('58', 'BR'),             // Country Code
    f('59', merchantName.substring(0, 25).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()), // Merchant Name
    f('60', merchantCity.substring(0, 15).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()), // Merchant City
    f('62', f('05', '***')),   // Reference Label
  ].join('');
  
  // Append CRC ID (63) and length (04) before calculating CRC
  const partForCrc = payloadMap + '6304';
  
  // CRC-16 CCITT (false) calculation
  let crc = 0xFFFF;
  for (let i = 0; i < partForCrc.length; i++) {
    const byte = partForCrc.charCodeAt(i);
    crc ^= (byte << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  
  const crcString = crc.toString(16).toUpperCase().padStart(4, '0');
  return partForCrc + crcString;
}

/**
 * Returns a Google QR Code / QR Server API URL to render the Pix QR code.
 */
export function getPixQRCodeUrl(payload: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payload)}`;
}
