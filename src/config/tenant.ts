/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Tenant / Client configuration template for SmartPOS.
 * Edit this file to completely brand and configure the system for a new client.
 */
export const TENANT_CONFIG = {
  // Brand Names & Identifiers
  COMPANY_NAME: 'UDV Cantina Segura',
  SHORT_NAME: 'Cantina UDV',
  COGNITIVE_NAME: 'UDV',
  SYSTEM_TITLE: 'UDV Cantina Segura',
  SYSTEM_SUBTITLE: 'Sistema de Ponto de Venda e Gestão de Contas',
  
  // Pix / Gateway Configurations
  PIX_MERCHANT_NAME: 'CANTINA UDV',
  PIX_MERCHANT_CITY: 'PORTO VELHO',
  
  // Footer & Version details
  VERSION: 'v2.4.2',
  FOOTER_TEXT: 'PDV UDV Cantina Segura • Sistema Integrado com Backup Automático na Nuvem • 2026',
  RECEIPT_FOOTER_VERSION: 'CANTINA SEGURA UDV v1.0',
  
  // Contact & Fiscal metadata
  CNPJ: '00.000.000/0001-00',
  ADDRESS: 'Porto Velho, RO',
  EMAIL: 'udvcantina@gmail.com',
  
  // Theme Color Configurations (Hex colors matching tailwind themes where needed)
  THEME_COLORS: {
    primary: '#012518',      // UDV Dark Green
    primaryHover: '#033f2a',
    primaryLight: '#f0f5f2',
    accent: '#ffd200',       // Golden Yellow
    accentHover: '#e6bd00',
    danger: '#b42828',       // Debt red
    dangerLight: '#fdf2f2',
  }
};
