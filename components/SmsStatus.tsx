'use client';

import React from 'react';
import { CheckCircle2, XCircle, Loader2, ArrowRight, RotateCcw } from 'lucide-react';

interface SmsStatusProps {
  status: 'sending' | 'success' | 'failed';
  errorMessage?: string | null;
  maskedPhone?: string;
  onProceed: () => void;
  onRetry: () => void;
}

export const SmsStatus: React.FC<SmsStatusProps> = ({
  status,
  errorMessage,
  maskedPhone,
  onProceed,
  onRetry,
}) => {
  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-xl border border-zinc-200/80 dark:border-zinc-800 transition-all">
      {status === 'sending' && (
        <div className="text-center py-6">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
            SMS wird gesendet...
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Bitte haben Sie einen Moment Geduld.
          </p>
        </div>
      )}

      {status === 'success' && (
        <div className="text-center py-4">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 animate-in zoom-in-75">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
            Die SMS wurde erfolgreich gesendet.
          </h2>
          {maskedPhone && (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Empfänger: <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">{maskedPhone}</span>
            </p>
          )}

          <div className="mt-6 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 text-left text-xs text-zinc-600 dark:text-zinc-300 space-y-1">
            <p className="font-semibold text-zinc-700 dark:text-zinc-200">Gesendete Nachricht:</p>
            <p className="italic text-zinc-500 dark:text-zinc-400">„Unser geschätzter Kunde, Ihre Anfrage wird gerade gesendet.“</p>
          </div>

          <button
            id="proceed-to-camera-button"
            onClick={onProceed}
            className="mt-6 w-full py-3.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/20"
          >
            <span>Weiter zur Kamerafreigabe</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {status === 'failed' && (
        <div className="text-center py-4">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-50 dark:bg-red-950/50 flex items-center justify-center text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900">
            <XCircle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
            Die SMS konnte nicht gesendet werden.
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {errorMessage ||
              'Die SMS konnte nicht gesendet werden. Bitte überprüfen Sie Ihre Telefonnummer und versuchen Sie es erneut.'}
          </p>

          <button
            id="retry-sms-button"
            onClick={onRetry}
            className="mt-6 w-full py-3.5 px-5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white text-white font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-md"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Erneut versuchen</span>
          </button>
        </div>
      )}
    </div>
  );
};
