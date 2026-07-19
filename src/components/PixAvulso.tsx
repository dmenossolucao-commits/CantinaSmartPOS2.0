/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  QrCode, Copy, Share2, Send, DollarSign, Check, ExternalLink, RefreshCw 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generatePixPayload, getPixQRCodeUrl } from '../utils/pix';

interface PixAvulsoProps {
  pixKey: string;
  triggerPushNotification: (title: string, body: string, type?: 'info' | 'success' | 'warn') => void;
}

export default function PixAvulso({ pixKey, triggerPushNotification }: PixAvulsoProps) {
  const [inputValue, setInputValue] = useState<string>('');
  const [generatedAmount, setGeneratedAmount] = useState<number | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Validate and parse amount
  const parsedAmount = useMemo(() => {
    if (!inputValue) return 0;
    const clean = inputValue.replace(',', '.');
    const num = parseFloat(clean);
    return isNaN(num) || num <= 0 ? 0 : num;
  }, [inputValue]);

  // Generate PIX payload and QR Code
  const pixData = useMemo(() => {
    if (!generatedAmount) return null;
    try {
      const payload = generatePixPayload(pixKey, generatedAmount);
      const qrUrl = getPixQRCodeUrl(payload);
      return { payload, qrUrl };
    } catch (err) {
      console.error('Error generating PIX payload:', err);
      return null;
    }
  }, [pixKey, generatedAmount]);

  const handleGenerate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (parsedAmount <= 0) {
      triggerPushNotification('Valor Inválido', 'Por favor, insira um valor maior que R$ 0,00 para gerar o PIX.', 'warn');
      return;
    }
    setGeneratedAmount(parsedAmount);
    setCopiedCode(false);
    triggerPushNotification('PIX Gerado', `Cobrança de R$ ${parsedAmount.toFixed(2)} gerada com sucesso!`, 'success');
  };

  const handlePresetClick = (val: number) => {
    setInputValue(val.toFixed(2).replace('.', ','));
    setGeneratedAmount(val);
    setCopiedCode(false);
    triggerPushNotification('PIX Gerado', `Cobrança de R$ ${val.toFixed(2)} gerada com sucesso!`, 'success');
  };

  const handleCopyCode = () => {
    if (!pixData) return;
    navigator.clipboard.writeText(pixData.payload);
    setCopiedCode(true);
    triggerPushNotification('Copiado!', 'Código PIX Copia e Cola copiado para a área de transferência!', 'success');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleShare = async () => {
    if (!pixData || !generatedAmount) return;
    const shareText = `Olá! Segue a cobrança PIX no valor de R$ ${generatedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}:\n\n${pixData.payload}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Cobrança PIX Avulsa',
          text: shareText,
        });
        triggerPushNotification('Compartilhado!', 'Cobrança enviada com sucesso!', 'success');
      } catch (err) {
        // User cancelled or share failed
        console.log('Share cancelled or failed:', err);
      }
    } else {
      navigator.clipboard.writeText(shareText);
      triggerPushNotification('Copiado para Compartilhar', 'Texto de cobrança copiado! Cole onde desejar.', 'success');
    }
  };

  const handleSendWhatsApp = () => {
    if (!pixData || !generatedAmount) return;
    const shareText = `Olá! Segue a cobrança PIX no valor de R$ ${generatedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}:\n\n*Código Copia e Cola:*\n\`${pixData.payload}\``;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  };

  const handleClear = () => {
    setInputValue('');
    setGeneratedAmount(null);
    setCopiedCode(false);
  };

  return (
    <div id="pix-avulso-root" className="h-full max-h-[85vh] overflow-y-auto pr-1">
      <div className="bg-gradient-to-r from-[#023e26] to-[#045e3c] text-white p-6 rounded-3xl shadow-md mb-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-4 opacity-10 pointer-events-none">
          <QrCode size={180} />
        </div>
        <div className="relative z-10 max-w-2xl">
          <span className="text-[10px] text-amber-300 font-mono font-bold uppercase tracking-wider bg-white/10 px-2.5 py-1 rounded-full">
            Cobrança Rápida
          </span>
          <h1 className="text-2xl font-sans font-black mt-2">Módulo PIX Avulso</h1>
          <p className="text-xs text-emerald-100/80 mt-1 max-w-xl font-sans leading-relaxed">
            Gere cobranças avulsas rapidamente sem afetar o estoque, registrar vendas no PDV ou alterar saldos de clientes. Ideal para pagamentos diretos, doações ou eventos pontuais.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* INPUT PANEL CARD */}
        <div className="bg-white border border-gray-150 rounded-3xl shadow-sm p-5 md:p-6 md:col-span-5 space-y-6">
          <h2 className="font-sans font-bold text-gray-800 text-sm uppercase tracking-wider flex items-center gap-2">
            <DollarSign size={18} className="text-[#023e26]" />
            Definir Valor
          </h2>

          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="pix-avulso-amount" className="block text-xs font-bold text-gray-500 uppercase tracking-wide">
                Valor da Cobrança (R$)
              </label>
              <div className="relative rounded-2xl shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <span className="text-gray-400 font-sans font-bold text-sm">R$</span>
                </div>
                <input
                  id="pix-avulso-amount"
                  type="text"
                  placeholder="0,00"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="block w-full rounded-2xl border border-gray-200 py-3.5 pl-11 pr-4 font-mono text-lg font-bold text-gray-800 placeholder-gray-300 focus:border-[#023e26] focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide">Atalhos de Valores</span>
              <div className="grid grid-cols-5 gap-1.5">
                {[5, 10, 15, 20, 50].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handlePresetClick(val)}
                    className="py-2 px-1 text-center bg-gray-50 border border-gray-150 hover:bg-[#023e26] hover:text-white hover:border-[#023e26] text-gray-700 font-mono text-xs font-bold rounded-xl transition-all active:scale-95"
                  >
                    R$ {val}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="submit"
                disabled={parsedAmount <= 0}
                className={`flex-1 py-3 px-4 rounded-2xl font-sans text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-98 ${
                  parsedAmount > 0
                    ? 'bg-[#023e26] hover:bg-[#035433] text-white'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none border border-gray-150'
                }`}
              >
                <QrCode size={16} />
                Gerar PIX
              </button>

              {(inputValue || generatedAmount) && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-3 bg-gray-50 border border-gray-150 hover:bg-gray-100 text-gray-500 rounded-2xl transition-all shrink-0 active:scale-95"
                  title="Limpar Tudo"
                >
                  <RefreshCw size={16} />
                </button>
              )}
            </div>
          </form>

          {/* Info note */}
          <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 text-emerald-800 text-xs font-sans space-y-1.5 leading-relaxed">
            <span className="font-bold block text-emerald-900">Como funciona:</span>
            <p>1. Digite o valor ou selecione um dos botões rápidos.</p>
            <p>2. Clique em <strong>Gerar PIX</strong> para criar o QR Code.</p>
            <p>3. Use os botões de ação para compartilhar ou copiar a chave.</p>
          </div>
        </div>

        {/* OUTPUT COBRANÇA DISPLAY PANEL */}
        <div className="md:col-span-7">
          <AnimatePresence mode="wait">
            {pixData && generatedAmount ? (
              <motion.div
                key="pix-result"
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -10 }}
                transition={{ duration: 0.2 }}
                className="bg-white border border-gray-150 rounded-3xl shadow-sm p-6 flex flex-col items-center text-center space-y-6"
              >
                {/* Header detail */}
                <div className="space-y-1">
                  <span className="text-[10px] text-teal-700 bg-teal-50 px-3 py-1 rounded-full uppercase tracking-wider inline-block font-bold">
                    QR Code Gerado
                  </span>
                  <p className="text-xs text-gray-400 font-sans">Apresente para leitura ou envie os dados de cobrança abaixo.</p>
                </div>

                {/* QR Code Container */}
                <div className="relative p-4 bg-white border-2 border-dashed border-teal-200 rounded-3xl shadow-inner max-w-[200px] mx-auto">
                  <img
                    src={pixData.qrUrl}
                    alt="Pix QR Code"
                    className="w-44 h-44 object-contain mx-auto"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* Display Value details */}
                <div className="space-y-1 bg-gray-50 border border-gray-150 px-6 py-3 rounded-2xl w-full">
                  <span className="text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider block">Valor da Cobrança</span>
                  <span className="text-2xl font-mono font-black text-gray-800 block">
                    R$ {generatedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Copia e Cola and Pix Key input boxes */}
                <div className="w-full space-y-3.5 text-left bg-gray-50/50 p-4 rounded-2xl border border-gray-150">
                  <div className="space-y-1">
                    <span className="text-[9px] text-gray-400 block font-bold uppercase tracking-wide">Código PIX Copia e Cola</span>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        readOnly 
                        value={pixData.payload} 
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono text-gray-800 select-all focus:outline-none focus:border-emerald-600"
                      />
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className="p-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-emerald-800 rounded-xl shrink-0 flex items-center justify-center transition-all active:scale-90"
                        title="Copiar Código"
                      >
                        {copiedCode ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9px] text-gray-400 block font-bold uppercase tracking-wide">Chave PIX Recebedora</span>
                    <input 
                      type="text" 
                      readOnly 
                      value={pixKey} 
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono text-gray-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Share Actions Grid */}
                <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="py-3 px-4 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 text-[#023e26] text-xs font-bold rounded-2xl flex items-center justify-center gap-1.5 transition-all active:scale-98"
                  >
                    <Copy size={14} />
                    {copiedCode ? 'Copiado!' : 'Copiar Código'}
                  </button>

                  <button
                    type="button"
                    onClick={handleShare}
                    className="py-3 px-4 bg-blue-50 border border-blue-100 hover:bg-blue-100 text-blue-800 text-xs font-bold rounded-2xl flex items-center justify-center gap-1.5 transition-all active:scale-98"
                  >
                    <Share2 size={14} />
                    Compartilhar
                  </button>

                  <button
                    type="button"
                    onClick={handleSendWhatsApp}
                    className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-1.5 transition-all active:scale-98"
                  >
                    <Send size={14} />
                    Enviar WhatsApp
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="pix-empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-gray-50 border border-dashed border-gray-200 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-4 h-[380px]"
              >
                <div className="p-4 bg-gray-100 rounded-full text-gray-300">
                  <QrCode size={48} className="stroke-[1.5]" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-sans font-bold text-gray-500 text-sm">Aguardando Valor</h3>
                  <p className="text-xs text-gray-400 font-sans max-w-xs mx-auto">Insira o valor da cobrança e clique em Gerar PIX para exibir o QR Code e as opções de compartilhamento.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
