/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Client } from '../types';
import { Camera, Fingerprint, ShieldAlert, CheckCircle, RefreshCw, X, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BiometricsScannerProps {
  clients: Client[];
  onMatchClient: (client: Client) => void;
  onClose: () => void;
}

export default function BiometricsScanner({ clients, onMatchClient, onClose }: BiometricsScannerProps) {
  const [scanMode, setScanMode] = useState<'facial' | 'digital'>('facial');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [matchedClient, setMatchedClient] = useState<Client | null>(null);
  const [scanStatusMessage, setScanStatusMessage] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressTimerRef = useRef<number | null>(null);

  // Filter clients with biometric registers to simulate lookup matches
  const biometricClients = clients.filter(c => c.biometricRegistered);

  // Stop camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      if (progressTimerRef.current) {
        window.clearInterval(progressTimerRef.current);
      }
    };
  }, [cameraStream]);

  // Handle switching to facial scan and starting camera
  useEffect(() => {
    if (scanMode === 'facial' && !cameraStream && isScanning) {
      startCamera();
    } else if (scanMode === 'digital' && cameraStream) {
      // stop camera if we switch to digital
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  }, [scanMode, isScanning]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 400, height: 300, facingMode: 'user' } 
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Camera access denied or unavailable', err);
      setCameraError('Câmera indisponível ou permissão negada. O sistema usará o simulador gráfico de biometria facial.');
    }
  };

  const handleStartScan = (targetClient?: Client) => {
    if (isScanning) return;
    
    setIsScanning(true);
    setScanProgress(0);
    setMatchedClient(null);
    setScanStatusMessage('Iniciando sensores biométricos...');

    // Select a client to match
    // If we passed a target client (e.g. from the quick-demo list), match that one.
    // Otherwise, pick a random registered client.
    const selectedTarget = targetClient || 
      biometricClients[Math.floor(Math.random() * biometricClients.length)] || 
      clients[0];

    let currentProgress = 0;
    
    if (scanMode === 'facial' && !cameraStream && !cameraError) {
      startCamera();
    }

    progressTimerRef.current = window.setInterval(() => {
      currentProgress += 4;
      setScanProgress(Math.min(currentProgress, 100));

      if (currentProgress < 25) {
        setScanStatusMessage(scanMode === 'facial' ? 'Mapeando pontos fiduciais da face...' : 'Escaneando relevos papilares...');
      } else if (currentProgress < 50) {
        setScanStatusMessage(scanMode === 'facial' ? 'Analisando profundidade tridimensional...' : 'Verificando condutividade térmica...');
      } else if (currentProgress < 75) {
        setScanStatusMessage('Cruzando vetor biométrico com banco de dados...');
      } else if (currentProgress < 100) {
        setScanStatusMessage('Validando assinatura digital e saldo devedor...');
      } else {
        // Scan completed successfully
        if (progressTimerRef.current) {
          window.clearInterval(progressTimerRef.current);
        }
        setIsScanning(false);
        setMatchedClient(selectedTarget);
        setScanStatusMessage('Biometria reconhecida com sucesso!');
        
        // play simulated beep
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, audioCtx.currentTime); // high pitched beep
          gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.15);
        } catch (e) {
          // ignore if audio context is blocked
        }
      }
    }, 120);
  };

  const handleConfirmMatch = () => {
    if (matchedClient) {
      // Stop camera before closing
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      onMatchClient(matchedClient);
    }
  };

  return (
    <div id="biometrics-scanner-modal" className="fixed inset-0 bg-gray-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <Fingerprint size={22} className="animate-pulse" />
            </div>
            <div>
              <h3 className="font-sans font-semibold text-gray-900">Leitor Biométrico de Balcão</h3>
              <p className="text-xs text-gray-500 font-mono">Agilidade de atendimento (Sem Cartão)</p>
            </div>
          </div>
          <button 
            id="close-biometrics-btn"
            onClick={() => {
              if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
              }
              onClose();
            }} 
            className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Toggle Mode */}
        <div className="px-5 pt-4 flex gap-2">
          <button
            id="tab-facial-scan"
            onClick={() => { if (!isScanning) setScanMode('facial'); }}
            className={`flex-1 py-2.5 px-3 rounded-xl font-sans text-xs font-medium flex items-center justify-center gap-2 transition-all ${
              scanMode === 'facial' 
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } ${isScanning ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Camera size={16} />
            Reconhecimento Facial (Webcam)
          </button>
          <button
            id="tab-digital-scan"
            onClick={() => { if (!isScanning) setScanMode('digital'); }}
            className={`flex-1 py-2.5 px-3 rounded-xl font-sans text-xs font-medium flex items-center justify-center gap-2 transition-all ${
              scanMode === 'digital' 
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } ${isScanning ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Fingerprint size={16} />
            Leitor de Digital (USB)
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 flex-1 overflow-y-auto flex flex-col items-center justify-center min-h-[300px]">
          
          <AnimatePresence mode="wait">
            {!matchedClient ? (
              <motion.div 
                key="scanning-state"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full flex flex-col items-center"
              >
                {/* Main Scanning Window */}
                <div className="relative w-64 h-64 rounded-2xl bg-gray-900 overflow-hidden border-2 border-dashed border-gray-700 flex flex-col items-center justify-center shadow-inner">
                  
                  {/* Facial Scanner Window */}
                  {scanMode === 'facial' && (
                    <>
                      {cameraStream ? (
                        <video 
                          ref={videoRef} 
                          autoPlay 
                          playsInline 
                          muted 
                          className="w-full h-full object-cover scale-x-[-1]"
                        />
                      ) : (
                        <div className="text-center p-4">
                          <Camera size={36} className="text-gray-600 mx-auto mb-2 animate-bounce" />
                          <p className="text-xs text-gray-400">Simulador de Reconhecimento Facial</p>
                        </div>
                      )}
                      
                      {/* Laser scanning overlay line */}
                      {isScanning && (
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/20 to-transparent flex flex-col justify-between">
                          <div className="w-full h-[3px] bg-emerald-500 shadow-[0_0_10px_#10b981] animate-[bounce_2.5s_infinite]" />
                        </div>
                      )}

                      {/* Tech HUD overlay */}
                      <div className="absolute inset-4 border border-emerald-500/20 pointer-events-none rounded-lg flex flex-col justify-between p-2">
                        <div className="flex justify-between">
                          <div className="w-3 h-3 border-t-2 border-l-2 border-emerald-500" />
                          <div className="w-3 h-3 border-t-2 border-r-2 border-emerald-500" />
                        </div>
                        {isScanning && (
                          <div className="text-[9px] font-mono text-emerald-400 bg-black/50 px-1.5 py-0.5 rounded self-center text-center animate-pulse">
                            SCANNING_FACE_ID_RAW
                          </div>
                        )}
                        <div className="flex justify-between">
                          <div className="w-3 h-3 border-b-2 border-l-2 border-emerald-500" />
                          <div className="w-3 h-3 border-b-2 border-r-2 border-emerald-500" />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Fingerprint Scanner Window */}
                  {scanMode === 'digital' && (
                    <button
                      id="fingerprint-scan-trigger-btn"
                      onClick={() => handleStartScan()}
                      disabled={isScanning}
                      className={`relative p-8 rounded-full transition-all group ${
                        isScanning 
                          ? 'bg-emerald-950/40 text-emerald-400 scale-95' 
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:scale-105 active:scale-95'
                      }`}
                    >
                      {/* Ripples when scanning */}
                      {isScanning && (
                        <>
                          <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-[ping_1.5s_infinite]" />
                          <div className="absolute inset-2 rounded-full bg-emerald-500/20 animate-[ping_2s_infinite]" />
                        </>
                      )}
                      <Fingerprint size={64} className={`${isScanning ? 'animate-pulse' : ''}`} />
                    </button>
                  )}

                  {/* Circular/Linear progress overlay */}
                  {isScanning && (
                    <div className="absolute bottom-3 left-3 right-3 bg-black/75 px-3 py-1.5 rounded-lg border border-gray-800 flex items-center justify-between">
                      <span className="text-[10px] text-gray-400 font-mono">Progresso:</span>
                      <span className="text-xs text-emerald-400 font-mono font-bold">{scanProgress}%</span>
                    </div>
                  )}
                </div>

                {/* Status Message */}
                <div className="mt-5 text-center px-4">
                  <p className="font-sans text-sm font-medium text-gray-800">
                    {isScanning ? (
                      <span className="flex items-center gap-1.5 justify-center">
                        <RefreshCw size={14} className="animate-spin text-emerald-600" />
                        {scanStatusMessage}
                      </span>
                    ) : (
                      <span>
                        {scanMode === 'facial' 
                          ? 'Clique abaixo para iniciar o escaneamento facial' 
                          : 'Mantenha o botão de digital pressionado ou use um atalho abaixo'}
                      </span>
                    )}
                  </p>
                  
                  {cameraError && scanMode === 'facial' && (
                    <p className="mt-2 text-xs text-amber-600 flex items-center gap-1 justify-center bg-amber-50 p-2 rounded-lg leading-relaxed">
                      <ShieldAlert size={14} className="shrink-0" />
                      {cameraError}
                    </p>
                  )}
                </div>

                {/* Scan Action triggers */}
                {!isScanning && (
                  <button
                    id="start-biometric-scan-btn"
                    onClick={() => handleStartScan()}
                    className="mt-5 py-2 px-8 bg-emerald-600 text-white rounded-xl font-sans text-sm font-medium hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-emerald-200"
                  >
                    {scanMode === 'facial' ? <Camera size={16} /> : <Fingerprint size={16} />}
                    Iniciar Leitura Biométrica
                  </button>
                )}

                {/* Quick Simulation Shortcuts */}
                {!isScanning && (
                  <div className="mt-6 w-full pt-4 border-t border-gray-100">
                    <p className="text-[11px] font-sans font-medium text-gray-400 text-center uppercase tracking-wider mb-2.5">
                      Simular Atendimento Rápido (Atalhos)
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {biometricClients.slice(0, 4).map(client => (
                        <button
                          key={client.id}
                          id={`simulate-biometric-${client.id}`}
                          onClick={() => handleStartScan(client)}
                          className="py-1.5 px-2 bg-gray-50 border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50 rounded-lg text-left text-xs text-gray-700 hover:text-emerald-700 font-sans transition-all flex items-center gap-1.5"
                        >
                          <UserCheck size={12} className="text-gray-400 group-hover:text-emerald-500" />
                          <span className="truncate">{client.name.split(' ')[0]} ({client.type})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="matched-state"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-center p-4 flex flex-col items-center"
              >
                {/* Success Indicator */}
                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mb-4 animate-[bounce_1s_ease-out_1]">
                  <CheckCircle size={54} />
                </div>

                <p className="text-xs text-emerald-600 font-mono font-bold tracking-widest uppercase mb-1">
                  Correspondência de 99.4%
                </p>
                <h4 className="font-sans font-bold text-gray-900 text-lg">
                  {matchedClient.name}
                </h4>
                <p className="text-xs text-gray-500 font-mono mt-0.5 mb-4">
                  {matchedClient.classOrDept} • {matchedClient.type === 'aluno' ? 'Aluno' : 'Colaborador'}
                </p>

                {/* Financial and Limit summary */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 w-full grid grid-cols-2 gap-4 mb-6 text-left">
                  <div>
                    <span className="text-[10px] text-gray-400 font-mono block uppercase">Saldo Atual</span>
                    <span className={`text-sm font-bold font-mono block ${
                      matchedClient.balance < 0 ? 'text-red-600' : matchedClient.balance > 0 ? 'text-emerald-600' : 'text-gray-600'
                    }`}>
                      R$ {matchedClient.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-mono block uppercase">Limite Disponível</span>
                    <span className="text-sm font-bold font-mono block text-gray-700">
                      R$ {(matchedClient.creditLimit + (matchedClient.balance < 0 ? matchedClient.balance : 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Confirm match buttons */}
                <div className="flex gap-3 w-full">
                  <button
                    id="biometric-retry-btn"
                    onClick={() => setMatchedClient(null)}
                    className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-sans text-sm font-medium hover:bg-gray-200 active:scale-95 transition-all"
                  >
                    Tentar Novamente
                  </button>
                  <button
                    id="biometric-confirm-match-btn"
                    onClick={handleConfirmMatch}
                    className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-sans text-sm font-medium hover:bg-emerald-700 active:scale-95 transition-all shadow-lg shadow-emerald-200"
                  >
                    Vincular ao Caixa
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
