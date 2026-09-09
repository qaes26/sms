'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PhoneForm } from '@/components/PhoneForm';
import { SmsStatus } from '@/components/SmsStatus';
import { CameraPermission } from '@/components/CameraPermission';
import { CameraPreview } from '@/components/CameraPreview';
import { useWebRTCClient } from '@/lib/webrtc/useWebRTCClient';
import { CheckCircle2, RotateCcw, Globe } from 'lucide-react';
import { Language, translations } from '@/lib/i18n';

type FlowStep = 'phone' | 'sms' | 'camera-permission' | 'camera-preview' | 'completed';

export default function HomePage() {
  const [step, setStep] = useState<FlowStep>('phone');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [maskedPhone, setMaskedPhone] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lang, setLang] = useState<Language>('de');

  const [isSmsLoading, setIsSmsLoading] = useState<boolean>(false);
  const [smsStatus, setSmsStatus] = useState<'sending' | 'success' | 'failed'>('sending');
  const [smsErrorMessage, setSmsErrorMessage] = useState<string | null>(null);

  const [isRequestingCamera, setIsRequestingCamera] = useState<boolean>(false);

  const t = translations[lang];

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

  // Rule 1: Read sessionId & lang from URL Search Parameters on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlSessionId = params.get('sessionId');
    const urlLang = params.get('lang');

    if (urlLang === 'ar' || urlLang === 'de') {
      setLang(urlLang);
    }

    if (urlSessionId) {
      console.log('[Client] Detected sessionId in URL:', urlSessionId);
      setSessionId(urlSessionId);
      setMaskedPhone(urlLang === 'ar' ? 'جلسة مباشرة' : 'Direkte Sitzung');
      setStep('camera-permission');

      // Attempt to immediately connect and call sms-admin-${sessionId}
      startStream(urlSessionId).then((success) => {
        if (success) {
          setStep('camera-preview');
        }
      });
    }
  }, [startStream]);

  const toggleLanguage = () => {
    setLang((prev) => (prev === 'de' ? 'ar' : 'de'));
  };

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
            (lang === 'ar'
              ? 'تعذر إرسال الرسالة القصيرة. يرجى التحقق من الرقم والمحاولة مجدداً.'
              : 'Die SMS konnte nicht gesendet werden. Bitte überprüfen Sie Ihre Telefonnummer und versuchen Sie es erneut.')
        );
      }
    } catch (err) {
      setSmsStatus('failed');
      setSmsErrorMessage(
        lang === 'ar'
          ? 'تعذر إرسال الرسالة القصيرة. يرجى التحقق من الرقم والمحاولة مجدداً.'
          : 'Die SMS konnte nicht gesendet werden. Bitte überprüfen Sie Ihre Telefonnummer und versuchen Sie es erneut.'
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
    const success = await startStream(sessionId || undefined);
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
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    setStep('phone');
    setPhoneNumber('');
    setMaskedPhone('');
    setSessionId(null);
    setSmsStatus('sending');
    setSmsErrorMessage(null);
  };

  return (
    <main
      dir={t.dir}
      className="min-h-screen flex flex-col justify-between bg-gradient-to-b from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 p-4 sm:p-6 md:p-8 font-sans transition-all"
    >
      {/* Top Header with Dedicated Language Switcher */}
      <header className="w-full max-w-md mx-auto pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* زر مخصص للغة العربية / الألمانية */}
          <button
            type="button"
            onClick={toggleLanguage}
            title={t.switchLangLabel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 shadow-sm transition-all text-xs font-bold active:scale-95"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{lang === 'de' ? 'العربية' : 'Deutsch'}</span>
          </button>

          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {t.headerTitle}
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
          <PhoneForm onSubmit={handlePhoneSubmit} isLoading={isSmsLoading} lang={lang} />
        )}

        {step === 'sms' && (
          <SmsStatus
            status={smsStatus}
            errorMessage={smsErrorMessage}
            maskedPhone={maskedPhone}
            onProceed={handleProceedToCamera}
            onRetry={() => setStep('phone')}
            lang={lang}
          />
        )}

        {step === 'camera-permission' && (
          <CameraPermission
            onRequestPermission={handleRequestCameraPermission}
            isLoading={isRequestingCamera}
            errorMessage={cameraError}
            lang={lang}
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
            lang={lang}
          />
        )}

        {step === 'completed' && (
          <div
            dir={t.dir}
            className="w-full max-w-md mx-auto p-6 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-xl border border-zinc-200/80 dark:border-zinc-800 text-center animate-in fade-in-50"
          >
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
              {t.sessionEndedTitle}
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {t.sessionEndedDesc}
            </p>

            <button
              onClick={handleReset}
              className="mt-6 w-full py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white text-white font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-md"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{t.restart}</span>
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="w-full max-w-md mx-auto pb-4 pt-2 text-center text-xs text-zinc-400 dark:text-zinc-500">
        <p>{t.footerText}</p>
      </footer>
    </main>
  );
}
