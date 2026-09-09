'use client';

import React, { useState, useCallback } from 'react';
import { PhoneForm } from '@/components/PhoneForm';
import { SmsStatus } from '@/components/SmsStatus';
import { CameraPermission } from '@/components/CameraPermission';
import { CameraPreview } from '@/components/CameraPreview';
import { useWebRTCClient } from '@/lib/webrtc/useWebRTCClient';
import { CheckCircle2, RotateCcw } from 'lucide-react';

type FlowStep = 'phone' | 'sms' | 'camera-permission' | 'camera-preview' | 'completed';

export default function HomePage() {
  const [step, setStep] = useState<FlowStep>('phone');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [maskedPhone, setMaskedPhone] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [isSmsLoading, setIsSmsLoading] = useState<boolean>(false);
  const [smsStatus, setSmsStatus] = useState<'sending' | 'success' | 'failed'>('sending');
  const [smsErrorMessage, setSmsErrorMessage] = useState<string | null>(null);

  const [isRequestingCamera, setIsRequestingCamera] = useState<boolean>(false);

  const handleSessionEnded = useCallback(() => {
    setStep('completed');
  }, []);

  const {
    localStream,
    connectionState,
    errorMessage: cameraError,
    isAudioMuted,
    isVideoMuted,
    facingMode,
    startStream,
    stopStream,
    toggleAudioMute,
    toggleVideoMute,
    flipCamera,
  } = useWebRTCClient({
    sessionId,
    onSessionEnded: handleSessionEnded,
  });

  // Step 1: Submit Phone Number and dispatch SMS
  const handlePhoneSubmit = async (inputPhone: string) => {
    setIsSmsLoading(true);
    setPhoneNumber(inputPhone);
    setStep('sms');
    setSmsStatus('sending');
    setSmsErrorMessage(null);

    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: inputPhone }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSessionId(data.sessionId);
        setMaskedPhone(data.maskedPhoneNumber || inputPhone);
        setSmsStatus('success');
      } else {
        setSmsStatus('failed');
        setSmsErrorMessage(
          data.error ||
            'Die SMS konnte nicht gesendet werden. Bitte überprüfen Sie Ihre Telefonnummer und versuchen Sie es erneut.'
        );
      }
    } catch (err) {
      setSmsStatus('failed');
      setSmsErrorMessage(
        'Die SMS konnte nicht gesendet werden. Bitte überprüfen Sie Ihre Telefonnummer und versuchen Sie es erneut.'
      );
    } finally {
      setIsSmsLoading(false);
    }
  };

  // Step 2: Proceed from SMS success to Camera Permission screen
  const handleProceedToCamera = () => {
    setStep('camera-permission');
  };

  // Step 3: Explicitly request camera permission
  const handleRequestCameraPermission = async () => {
    setIsRequestingCamera(true);
    const success = await startStream();
    setIsRequestingCamera(false);

    if (success) {
      setStep('camera-preview');
    }
  };

  // Step 4: Stop camera and end session
  const handleStopCamera = async () => {
    await stopStream();
    setStep('completed');
  };

  // Reset entire flow
  const handleReset = () => {
    setStep('phone');
    setPhoneNumber('');
    setMaskedPhone('');
    setSessionId(null);
    setSmsStatus('sending');
    setSmsErrorMessage(null);
  };

  return (
    <main className="min-h-screen flex flex-col justify-between bg-gradient-to-b from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 p-4 sm:p-6 md:p-8">
      {/* Top Header / Brand */}
      <header className="w-full max-w-md mx-auto pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
            DE
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Sichere Übertragung
          </span>
        </div>

        {/* Step Indicator */}
        {step !== 'completed' && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span
              className={`w-2 h-2 rounded-full transition-all ${
                step === 'phone' ? 'bg-blue-600 w-4' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            />
            <span
              className={`w-2 h-2 rounded-full transition-all ${
                step === 'sms' ? 'bg-blue-600 w-4' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            />
            <span
              className={`w-2 h-2 rounded-full transition-all ${
                step === 'camera-permission' ? 'bg-blue-600 w-4' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            />
            <span
              className={`w-2 h-2 rounded-full transition-all ${
                step === 'camera-preview' ? 'bg-blue-600 w-4' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            />
          </div>
        )}
      </header>

      {/* Main Card Content */}
      <div className="my-auto py-4">
        {step === 'phone' && (
          <PhoneForm onSubmit={handlePhoneSubmit} isLoading={isSmsLoading} />
        )}

        {step === 'sms' && (
          <SmsStatus
            status={smsStatus}
            errorMessage={smsErrorMessage}
            maskedPhone={maskedPhone}
            onProceed={handleProceedToCamera}
            onRetry={() => setStep('phone')}
          />
        )}

        {step === 'camera-permission' && (
          <CameraPermission
            onRequestPermission={handleRequestCameraPermission}
            isLoading={isRequestingCamera}
            errorMessage={cameraError}
          />
        )}

        {step === 'camera-preview' && (
          <CameraPreview
            stream={localStream}
            connectionState={connectionState}
            onStop={handleStopCamera}
            isAudioMuted={isAudioMuted}
            isVideoMuted={isVideoMuted}
            onToggleAudioMute={toggleAudioMute}
            onToggleVideoMute={toggleVideoMute}
            onFlipCamera={flipCamera}
            facingMode={facingMode}
          />
        )}

        {step === 'completed' && (
          <div className="w-full max-w-md mx-auto p-6 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-xl border border-zinc-200/80 dark:border-zinc-800 text-center animate-in fade-in-50">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
              Sitzung beendet
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Die Kameraübertragung wurde erfolgreich gestoppt und alle Verbindungen wurden geschlossen.
            </p>

            <button
              onClick={handleReset}
              className="mt-6 w-full py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white text-white font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-md"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Neu starten</span>
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="w-full max-w-md mx-auto pb-4 pt-2 text-center text-xs text-zinc-400 dark:text-zinc-500">
        <p>Ende-zu-Ende verschlüsselte Live-Verbindung</p>
      </footer>
    </main>
  );
}
