/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Client, Transaction, BackupHistory, SupportTicket } from './types';

export const INITIAL_PRODUCTS: Product[] = [
  { id: 'p1', name: 'Coxinha de Frango c/ Catupiry', price: 6.50, category: 'Salgados', stock: 24, minStock: 10 },
  { id: 'p2', name: 'Pastel de Forno de Carne', price: 7.00, category: 'Salgados', stock: 15, minStock: 8 },
  { id: 'p3', name: 'Pão de Queijo Grande', price: 4.50, category: 'Salgados', stock: 35, minStock: 15 },
  { id: 'p4', name: 'Enroladinho de Presunto e Queijo', price: 6.00, category: 'Salgados', stock: 18, minStock: 10 },
  { id: 'p5', name: 'Refrigerante Lata 350ml', price: 5.50, category: 'Bebidas', stock: 48, minStock: 20 },
  { id: 'p6', name: 'Suco de Laranja Natural 400ml', price: 8.00, category: 'Bebidas', stock: 12, minStock: 5 },
  { id: 'p7', name: 'Água Mineral sem Gás 500ml', price: 3.50, category: 'Bebidas', stock: 60, minStock: 15 },
  { id: 'p8', name: 'Suco Del Valle Uva Lata', price: 5.00, category: 'Bebidas', stock: 22, minStock: 10 },
  { id: 'p9', name: 'Brigadeiro Gourmet 50g', price: 3.50, category: 'Doces', stock: 40, minStock: 12 },
  { id: 'p10', name: 'Sonho de Creme Baunilha', price: 6.00, category: 'Doces', stock: 10, minStock: 5 },
  { id: 'p11', name: 'Cookie de Gotas de Chocolate', price: 4.50, category: 'Doces', stock: 25, minStock: 10 },
  { id: 'p12', name: 'Prato Feito Executivo (Almoço)', price: 18.90, category: 'Almoço', stock: 30, minStock: 8 },
  { id: 'p13', name: 'Lasanha Quatro Queijos', price: 21.00, category: 'Almoço', stock: 14, minStock: 5 },
  { id: 'p14', name: 'Salada de Frango Grelhado', price: 16.50, category: 'Almoço', stock: 8, minStock: 4 },
  { id: 'p15', name: 'Salgadinho Ruffles Churrasco', price: 6.00, category: 'Outros', stock: 28, minStock: 10 },
  { id: 'p16', name: 'Chiclete Trident Menta', price: 2.50, category: 'Outros', stock: 50, minStock: 15 },
  { id: 'p17', name: 'Pizza Margherita', price: 45.90, category: 'Almoço', stock: 12, minStock: 3 },
  { id: 'p18', name: 'Hambúrguer', price: 32.50, category: 'Salgados', stock: 20, minStock: 5 },
  { id: 'p19', name: 'Pasta Carbonara', price: 38.90, category: 'Almoço', stock: 10, minStock: 3 },
  { id: 'p20', name: 'Combo Sushi', price: 68.00, category: 'Almoço', stock: 8, minStock: 2 },
  { id: 'p_bolo', name: 'Bolo', price: 5.00, category: 'Doces', stock: 50, minStock: 10 },
  { id: 'p_bolo_pote', name: 'Bolo de Pote', price: 12.00, category: 'Doces', stock: 50, minStock: 10 },
  { id: 'p_pizza', name: 'Pizza', price: 10.00, category: 'Salgados', stock: 50, minStock: 10 },
  { id: 'p_salgado', name: 'Salgado', price: 7.00, category: 'Salgados', stock: 50, minStock: 10 },
  { id: 'p_refrigerantes', name: 'Refrigerantes', price: 4.00, category: 'Bebidas', stock: 50, minStock: 10 },
  { id: 'p_agua_gas', name: 'Água com Gás', price: 4.00, category: 'Bebidas', stock: 50, minStock: 10 },
  { id: 'p_sanduiche', name: 'Sanduíche', price: 8.00, category: 'Salgados', stock: 50, minStock: 10 },
  { id: 'p_tapioca', name: 'Tapioca', price: 11.00, category: 'Salgados', stock: 50, minStock: 10 },
  { id: 'p_acai', name: 'Açaí', price: 10.00, category: 'Doces', stock: 50, minStock: 10 },
  { id: 'p_acai_adic', name: 'Açaí (Adicional)', price: 1.00, category: 'Doces', stock: 100, minStock: 10 },
  { id: 'p_dindin', name: 'Dindin', price: 6.00, category: 'Doces', stock: 50, minStock: 10 },
  { id: 'p_batata_frita', name: 'Batata Frita', price: 5.00, category: 'Outros', stock: 50, minStock: 10 },
  { id: 'p_marujinho', name: 'Marujinho', price: 2.00, category: 'Doces', stock: 50, minStock: 10 }
];

export const INITIAL_CLIENTS: Client[] = [
  {
    id: 'c1',
    name: 'Arthur Silva Rodrigues',
    email: 'arthur.silva@escola.com',
    phone: '+5511988880001',
    type: 'aluno',
    classOrDept: '3º Ano A - Ensino Médio',
    balance: -47.90, // owes 47.90 (t1 + t10 + t14)
    creditLimit: 150.00,
    biometricRegistered: true,
  },
  {
    id: 'c2',
    name: 'Beatriz Costa Mendonça',
    email: 'beatriz.costa@escola.com',
    phone: '+5511988880002',
    type: 'aluno',
    classOrDept: '2º Ano B - Ensino Médio',
    balance: 35.00, // has 35.00 pre-paid credits
    creditLimit: 100.00,
    biometricRegistered: false,
  },
  {
    id: 'c3',
    name: 'Prof. Carlos Eduardo Siqueira',
    email: 'carlos.siqueira@escola.com',
    phone: '+5511988880003',
    type: 'colaborador',
    classOrDept: 'Docentes - Ensino Fundamental II',
    balance: -80.30, // owes 80.30 (t4 + t8 + t13)
    creditLimit: 300.00,
    biometricRegistered: true,
  },
  {
    id: 'c4',
    name: 'Daniela Souza Oliveira (Secretaria)',
    email: 'daniela.oliveira@escola.com',
    phone: '+5511988880004',
    type: 'colaborador',
    classOrDept: 'Administrativo',
    balance: 0.00,
    creditLimit: 200.00,
    biometricRegistered: true,
  },
  {
    id: 'c5',
    name: 'Felipe Santos Almeida',
    email: 'felipe.santos@escola.com',
    phone: '+5511988880005',
    type: 'aluno',
    classOrDept: '1º Ano C - Ensino Médio',
    balance: -11.00, // owes 11.00 (t7)
    creditLimit: 80.00,
    biometricRegistered: false,
  },
  {
    id: 'c6',
    name: 'Gustavo Henrique Borges',
    email: 'gustavo.borges@escola.com',
    phone: '+5511988880006',
    type: 'aluno',
    classOrDept: '3º Ano B - Ensino Médio',
    balance: -77.90, // owes 77.90 (t5 + t11 + t15)
    creditLimit: 150.00,
    biometricRegistered: true,
  },
  {
    id: 'c7',
    name: 'Mariana Azevedo Melo',
    email: 'mariana.melo@escola.com',
    phone: '+5511988880007',
    type: 'aluno',
    classOrDept: '9º Ano A - Ensino Fundamental',
    balance: 15.00, // pre-paid
    creditLimit: 50.00,
    biometricRegistered: false,
  },
  {
    id: 'c_allan',
    name: 'ALLAN',
    email: 'allan@escola.com',
    phone: '+5511999990001',
    type: 'aluno',
    classOrDept: 'Geral',
    balance: -12.00,
    creditLimit: 150.00,
    biometricRegistered: false,
  },
  {
    id: 'c_cristiane_gildo',
    name: 'CRISTIANE GILDO',
    email: 'cristiane.gildo@escola.com',
    phone: '+5511999990002',
    type: 'aluno',
    classOrDept: 'Geral',
    balance: -15.00,
    creditLimit: 150.00,
    biometricRegistered: false,
  },
  {
    id: 'c_daymar',
    name: 'DAYMAR',
    email: 'daymar@escola.com',
    phone: '+5511999990003',
    type: 'aluno',
    classOrDept: 'Geral',
    balance: -25.00,
    creditLimit: 150.00,
    biometricRegistered: false,
  },
  {
    id: 'c_joao_flor',
    name: 'JOÃO FLOR',
    email: 'joao.flor@escola.com',
    phone: '+5511999990004',
    type: 'aluno',
    classOrDept: 'Geral',
    balance: -19.00,
    creditLimit: 150.00,
    biometricRegistered: false,
  },
  {
    id: 'c_leticia',
    name: 'LETÍCIA',
    email: 'leticia@escola.com',
    phone: '+5511999990005',
    type: 'aluno',
    classOrDept: 'Geral',
    balance: -10.00,
    creditLimit: 150.00,
    biometricRegistered: false,
  },
  {
    id: 'c_marcos_marques',
    name: 'MARCOS MARQUES',
    email: 'marcos.marques@escola.com',
    phone: '+5511999990006',
    type: 'aluno',
    classOrDept: 'Geral',
    balance: -19.00,
    creditLimit: 150.00,
    biometricRegistered: false,
  },
  {
    id: 'c_naty_campos',
    name: 'NATY CAMPOS',
    email: 'naty.campos@escola.com',
    phone: '+5511999990007',
    type: 'aluno',
    classOrDept: 'Geral',
    balance: -14.00,
    creditLimit: 150.00,
    biometricRegistered: false,
  },
  {
    id: 'c_neyce',
    name: 'NEYCE',
    email: 'neyce@escola.com',
    phone: '+5511999990008',
    type: 'aluno',
    classOrDept: 'Geral',
    balance: -55.00,
    creditLimit: 150.00,
    biometricRegistered: false,
  },
  {
    id: 'c_patricia',
    name: 'PATRÍCIA',
    email: 'patricia@escola.com',
    phone: '+5511999990009',
    type: 'aluno',
    classOrDept: 'Geral',
    balance: -7.00,
    creditLimit: 150.00,
    biometricRegistered: false,
  },
  {
    id: 'c_thigo',
    name: 'THIGO',
    email: 'thigo@escola.com',
    phone: '+5511999990010',
    type: 'aluno',
    classOrDept: 'Geral',
    balance: -11.00,
    creditLimit: 150.00,
    biometricRegistered: false,
  },
  {
    id: 'c_vanda',
    name: 'VANDA',
    email: 'vanda@escola.com',
    phone: '+5511999990011',
    type: 'aluno',
    classOrDept: 'Geral',
    balance: -53.00,
    creditLimit: 150.00,
    biometricRegistered: false,
  }
];

// Helper to generate dates in current or previous weeks
const getDateOffset = (daysAgo: number, timeStr: string = '10:30:00'): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const datePart = d.toISOString().split('T')[0];
  return `${datePart}T${timeStr}`;
};

export const INITIAL_TRANSACTIONS: Transaction[] = [
  // Today's Sales
  {
    id: 't1',
    clientId: 'c1',
    clientName: 'Arthur Silva Rodrigues',
    items: [
      { productId: 'p1', productName: 'Coxinha de Frango c/ Catupiry', price: 6.50, quantity: 1, subtotal: 6.50 },
      { productId: 'p5', productName: 'Refrigerante Lata 350ml', price: 5.50, quantity: 1, subtotal: 5.50 }
    ],
    total: 12.00,
    paymentMethod: 'prazo',
    timestamp: getDateOffset(0, '09:45:00'),
    status: 'pendente',
    saldo_restante: 12.00
  },
  {
    id: 't2',
    items: [
      { productId: 'p3', productName: 'Pão de Queijo Grande', price: 4.50, quantity: 2, subtotal: 9.00 },
      { productId: 'p6', productName: 'Suco de Laranja Natural 400ml', price: 8.00, quantity: 1, subtotal: 8.00 }
    ],
    total: 17.00,
    paymentMethod: 'pix',
    timestamp: getDateOffset(0, '10:15:00'),
    status: 'concluido'
  },
  {
    id: 't3',
    clientId: 'c2',
    clientName: 'Beatriz Costa Mendonça',
    items: [
      { productId: 'p10', productName: 'Sonho de Creme Baunilha', price: 6.00, quantity: 1, subtotal: 6.00 },
      { productId: 'p7', productName: 'Água Mineral sem Gás 500ml', price: 3.50, quantity: 1, subtotal: 3.50 }
    ],
    total: 9.50,
    paymentMethod: 'prazo', // Deducted from prepaid credits (balance was 44.50, now 35.00)
    timestamp: getDateOffset(0, '15:20:00'),
    status: 'concluido'
  },
  {
    id: 't4',
    clientId: 'c3',
    clientName: 'Prof. Carlos Eduardo Siqueira',
    items: [
      { productId: 'p12', productName: 'Prato Feito Executivo (Almoço)', price: 18.90, quantity: 1, subtotal: 18.90 },
      { productId: 'p5', productName: 'Refrigerante Lata 350ml', price: 5.50, quantity: 1, subtotal: 5.50 }
    ],
    total: 24.40,
    paymentMethod: 'prazo',
    timestamp: getDateOffset(0, '12:30:00'),
    status: 'pendente',
    saldo_restante: 24.40
  },

  // Yesterday's Sales
  {
    id: 't5',
    clientId: 'c6',
    clientName: 'Gustavo Henrique Borges',
    items: [
      { productId: 'p12', productName: 'Prato Feito Executivo (Almoço)', price: 18.90, quantity: 1, subtotal: 18.90 },
      { productId: 'p6', productName: 'Suco de Laranja Natural 400ml', price: 8.00, quantity: 1, subtotal: 8.00 },
      { productId: 'p9', productName: 'Brigadeiro Gourmet 50g', price: 3.50, quantity: 2, subtotal: 7.00 }
    ],
    total: 33.90,
    paymentMethod: 'prazo',
    timestamp: getDateOffset(1, '12:45:00'),
    status: 'pendente',
    saldo_restante: 33.90
  },
  {
    id: 't6',
    items: [
      { productId: 'p1', productName: 'Coxinha de Frango c/ Catupiry', price: 6.50, quantity: 3, subtotal: 19.50 },
      { productId: 'p5', productName: 'Refrigerante Lata 350ml', price: 5.50, quantity: 3, subtotal: 16.50 }
    ],
    total: 36.00,
    paymentMethod: 'dinheiro',
    timestamp: getDateOffset(1, '16:10:00'),
    status: 'concluido'
  },
  {
    id: 't7',
    clientId: 'c5',
    clientName: 'Felipe Santos Almeida',
    items: [
      { productId: 'p4', productName: 'Enroladinho de Presunto e Queijo', price: 6.00, quantity: 1, subtotal: 6.00 },
      { productId: 'p8', productName: 'Suco Del Valle Uva Lata', price: 5.00, quantity: 1, subtotal: 5.00 }
    ],
    total: 11.00,
    paymentMethod: 'prazo',
    timestamp: getDateOffset(1, '10:05:00'),
    status: 'pendente',
    saldo_restante: 11.00
  },

  // Previous days of this week (3 to 6 days ago)
  {
    id: 't8',
    clientId: 'c3',
    clientName: 'Prof. Carlos Eduardo Siqueira',
    items: [
      { productId: 'p13', productName: 'Lasanha Quatro Queijos', price: 21.00, quantity: 1, subtotal: 21.00 },
      { productId: 'p5', productName: 'Refrigerante Lata 350ml', price: 5.50, quantity: 1, subtotal: 5.50 },
      { productId: 'p9', productName: 'Brigadeiro Gourmet 50g', price: 3.50, quantity: 2, subtotal: 7.00 }
    ],
    total: 33.50,
    paymentMethod: 'prazo',
    timestamp: getDateOffset(3, '13:00:00'),
    status: 'pendente',
    saldo_restante: 33.50
  },
  {
    id: 't9',
    items: [
      { productId: 'p2', productName: 'Pastel de Forno de Carne', price: 7.00, quantity: 5, subtotal: 35.00 }
    ],
    total: 35.00,
    paymentMethod: 'débito',
    timestamp: getDateOffset(3, '10:15:00'),
    status: 'concluido'
  },
  {
    id: 't10',
    clientId: 'c1',
    clientName: 'Arthur Silva Rodrigues',
    items: [
      { productId: 'p15', productName: 'Salgadinho Ruffles Churrasco', price: 6.00, quantity: 1, subtotal: 6.00 },
      { productId: 'p5', productName: 'Refrigerante Lata 350ml', price: 5.50, quantity: 1, subtotal: 5.50 }
    ],
    total: 11.50,
    paymentMethod: 'prazo',
    timestamp: getDateOffset(4, '09:50:00'),
    status: 'pendente',
    saldo_restante: 11.50
  },
  {
    id: 't11',
    clientId: 'c6',
    clientName: 'Gustavo Henrique Borges',
    items: [
      { productId: 'p4', productName: 'Enroladinho de Presunto e Queijo', price: 6.00, quantity: 2, subtotal: 12.00 },
      { productId: 'p6', productName: 'Suco de Laranja Natural 400ml', price: 8.00, quantity: 1, subtotal: 8.00 }
    ],
    total: 20.00,
    paymentMethod: 'prazo',
    timestamp: getDateOffset(4, '15:30:00'),
    status: 'pendente',
    saldo_restante: 20.00
  },
  {
    id: 't12',
    items: [
      { productId: 'p12', productName: 'Prato Feito Executivo (Almoço)', price: 18.90, quantity: 2, subtotal: 37.80 }
    ],
    total: 37.80,
    paymentMethod: 'crédito',
    timestamp: getDateOffset(5, '12:15:00'),
    status: 'concluido'
  },

  // Last Month Sales (e.g. 15-20 days ago) to build Monthly consumption historical reports
  {
    id: 't13',
    clientId: 'c3',
    clientName: 'Prof. Carlos Eduardo Siqueira',
    items: [
      { productId: 'p12', productName: 'Prato Feito Executivo (Almoço)', price: 18.90, quantity: 1, subtotal: 18.90 },
      { productId: 'p9', productName: 'Brigadeiro Gourmet 50g', price: 3.50, quantity: 1, subtotal: 3.50 }
    ],
    total: 22.40,
    paymentMethod: 'prazo',
    timestamp: getDateOffset(15, '12:40:00'),
    status: 'pendente',
    saldo_restante: 22.40
  },
  {
    id: 't14',
    clientId: 'c1',
    clientName: 'Arthur Silva Rodrigues',
    items: [
      { productId: 'p12', productName: 'Prato Feito Executivo (Almoço)', price: 18.90, quantity: 1, subtotal: 18.90 },
      { productId: 'p5', productName: 'Refrigerante Lata 350ml', price: 5.50, quantity: 1, subtotal: 5.50 }
    ],
    total: 24.40,
    paymentMethod: 'prazo',
    timestamp: getDateOffset(18, '12:10:00'),
    status: 'pendente',
    saldo_restante: 24.40
  },
  {
    id: 't15',
    clientId: 'c6',
    clientName: 'Gustavo Henrique Borges',
    items: [
      { productId: 'p1', productName: 'Coxinha de Frango c/ Catupiry', price: 6.50, quantity: 2, subtotal: 13.00 },
      { productId: 'p5', productName: 'Refrigerante Lata 350ml', price: 5.50, quantity: 2, subtotal: 11.00 }
    ],
    total: 24.00,
    paymentMethod: 'prazo',
    timestamp: getDateOffset(20, '10:00:00'),
    status: 'pendente',
    saldo_restante: 24.00
  },
  {
    id: 't_rep_allan',
    clientId: 'c_allan',
    clientName: 'ALLAN',
    items: [
      { productId: 'p_acai', productName: 'Açaí', price: 10.00, quantity: 1, subtotal: 10.00 },
      { productId: 'p_acai_adic', productName: 'Açaí (Adicional)', price: 1.00, quantity: 2, subtotal: 2.00 }
    ],
    total: 12.00,
    paymentMethod: 'prazo',
    timestamp: '2026-07-14T09:49:09',
    status: 'pendente',
    saldo_restante: 12.00
  },
  {
    id: 't_rep_cristiane_gildo',
    clientId: 'c_cristiane_gildo',
    clientName: 'CRISTIANE GILDO',
    items: [
      { productId: 'p_salgado', productName: 'Salgado', price: 7.00, quantity: 1, subtotal: 7.00 },
      { productId: 'p_refrigerantes', productName: 'Refrigerantes', price: 4.00, quantity: 2, subtotal: 8.00 }
    ],
    total: 15.00,
    paymentMethod: 'prazo',
    timestamp: '2026-07-14T09:49:09',
    status: 'pendente',
    saldo_restante: 15.00
  },
  {
    id: 't_rep_daymar',
    clientId: 'c_daymar',
    clientName: 'DAYMAR',
    items: [
      { productId: 'p_acai', productName: 'Açaí', price: 10.00, quantity: 2, subtotal: 20.00 },
      { productId: 'p_acai_adic', productName: 'Açaí (Adicional)', price: 1.00, quantity: 1, subtotal: 1.00 },
      { productId: 'p_marujinho', productName: 'Marujinho', price: 2.00, quantity: 2, subtotal: 4.00 }
    ],
    total: 25.00,
    paymentMethod: 'prazo',
    timestamp: '2026-07-14T09:49:09',
    status: 'pendente',
    saldo_restante: 25.00
  },
  {
    id: 't_rep_joao_flor',
    clientId: 'c_joao_flor',
    clientName: 'JOÃO FLOR',
    items: [
      { productId: 'p_marujinho', productName: 'Marujinho', price: 2.00, quantity: 1, subtotal: 2.00 },
      { productId: 'p_salgado', productName: 'Salgado', price: 7.00, quantity: 1, subtotal: 7.00 },
      { productId: 'p_acai', productName: 'Açaí', price: 10.00, quantity: 1, subtotal: 10.00 }
    ],
    total: 19.00,
    paymentMethod: 'prazo',
    timestamp: '2026-07-14T09:49:09',
    status: 'pendente',
    saldo_restante: 19.00
  },
  {
    id: 't_rep_leticia',
    clientId: 'c_leticia',
    clientName: 'LETÍCIA',
    items: [
      { productId: 'p_acai', productName: 'Açaí', price: 10.00, quantity: 1, subtotal: 10.00 }
    ],
    total: 10.00,
    paymentMethod: 'prazo',
    timestamp: '2026-07-14T09:49:09',
    status: 'pendente',
    saldo_restante: 10.00
  },
  {
    id: 't_rep_marcos_marques',
    clientId: 'c_marcos_marques',
    clientName: 'MARCOS MARQUES',
    items: [
      { productId: 'p_acai', productName: 'Açaí', price: 10.00, quantity: 1, subtotal: 10.00 },
      { productId: 'p_acai_adic', productName: 'Açaí (Adicional)', price: 1.00, quantity: 1, subtotal: 1.00 },
      { productId: 'p_refrigerantes', productName: 'Refrigerantes', price: 4.00, quantity: 2, subtotal: 8.00 }
    ],
    total: 19.00,
    paymentMethod: 'prazo',
    timestamp: '2026-07-14T09:49:09',
    status: 'pendente',
    saldo_restante: 19.00
  },
  {
    id: 't_rep_naty_campos',
    clientId: 'c_naty_campos',
    clientName: 'NATY CAMPOS',
    items: [
      { productId: 'p_salgado', productName: 'Salgado', price: 7.00, quantity: 2, subtotal: 14.00 }
    ],
    total: 14.00,
    paymentMethod: 'prazo',
    timestamp: '2026-07-14T09:49:09',
    status: 'pendente',
    saldo_restante: 14.00
  },
  {
    id: 't_rep_neyce',
    clientId: 'c_neyce',
    clientName: 'NEYCE',
    items: [
      { productId: 'p_acai', productName: 'Açaí', price: 10.00, quantity: 5, subtotal: 50.00 },
      { productId: 'p_acai_adic', productName: 'Açaí (Adicional)', price: 1.00, quantity: 5, subtotal: 5.00 }
    ],
    total: 55.00,
    paymentMethod: 'prazo',
    timestamp: '2026-07-14T09:49:09',
    status: 'pendente',
    saldo_restante: 55.00
  },
  {
    id: 't_rep_patricia',
    clientId: 'c_patricia',
    clientName: 'PATRÍCIA',
    items: [
      { productId: 'p_bolo', productName: 'Bolo', price: 5.00, quantity: 1, subtotal: 5.00 },
      { productId: 'p_marujinho', productName: 'Marujinho', price: 2.00, quantity: 1, subtotal: 2.00 }
    ],
    total: 7.00,
    paymentMethod: 'prazo',
    timestamp: '2026-07-14T09:49:09',
    status: 'pendente',
    saldo_restante: 7.00
  },
  {
    id: 't_rep_thigo',
    clientId: 'c_thigo',
    clientName: 'THIGO',
    items: [
      { productId: 'p_acai', productName: 'Açaí', price: 10.00, quantity: 1, subtotal: 10.00 },
      { productId: 'p_acai_adic', productName: 'Açaí (Adicional)', price: 1.00, quantity: 1, subtotal: 1.00 }
    ],
    total: 11.00,
    paymentMethod: 'prazo',
    timestamp: '2026-07-14T09:49:09',
    status: 'pendente',
    saldo_restante: 11.00
  },
  {
    id: 't_rep_vanda',
    clientId: 'c_vanda',
    clientName: 'VANDA',
    items: [
      { productId: 'p_salgado', productName: 'Salgado', price: 7.00, quantity: 3, subtotal: 21.00 },
      { productId: 'p_agua_gas', productName: 'Água com Gás', price: 4.00, quantity: 1, subtotal: 4.00 },
      { productId: 'p_refrigerantes', productName: 'Refrigerantes', price: 4.00, quantity: 1, subtotal: 4.00 },
      { productId: 'p_acai', productName: 'Açaí', price: 10.00, quantity: 2, subtotal: 20.00 },
      { productId: 'p_acai_adic', productName: 'Açaí (Adicional)', price: 1.00, quantity: 4, subtotal: 4.00 }
    ],
    total: 53.00,
    paymentMethod: 'prazo',
    timestamp: '2026-07-14T09:49:09',
    status: 'pendente',
    saldo_restante: 53.00
  }
];

export const INITIAL_BACKUPS: BackupHistory[] = [
  { id: 'b1', timestamp: getDateOffset(3, '04:00:00'), filename: 'backup_diario_2026-07-05_040000.json', status: 'sucesso', size: '14.2 KB' },
  { id: 'b2', timestamp: getDateOffset(2, '04:00:00'), filename: 'backup_diario_2026-07-06_040000.json', status: 'sucesso', size: '14.6 KB' },
  { id: 'b3', timestamp: getDateOffset(1, '04:00:00'), filename: 'backup_diario_2026-07-07_040000.json', status: 'sucesso', size: '14.9 KB' }
];

export const INITIAL_SUPPORT: SupportTicket[] = [
  {
    id: 's1',
    subject: 'Impressora térmica não imprime cupom Pix',
    message: 'Após confirmar o Pix, a impressora de bobina acoplada no balcão não dispara a via automaticamente.',
    status: 'resolvido',
    category: 'sistema',
    timestamp: getDateOffset(5, '09:12:00'),
    priority: 'alta'
  },
  {
    id: 's2',
    subject: 'Dúvida sobre cadastro de digital para biometria',
    message: 'Como faço para re-registrar o dedo indicador de um aluno que está dando falha no sensor de balcão?',
    status: 'resolvido',
    category: 'biometria',
    timestamp: getDateOffset(2, '14:35:00'),
    priority: 'media'
  }
];
