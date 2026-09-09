'use client';

import React from 'react';
import { Camera, Shield, AlertTriangle, Video } from 'lucide-react';
import { Language, translations } from '@/lib/i18n';

interface CameraPermissionProps {
  onRequestPermission: () => Promise<void>;
  isLoading: boolean;
  errorMessage?: string | null;
  lang?: Language;
}

export const CameraPermission: React.FC<CameraPermissionProps> = ({
  onRequestPermission,
  isLoading,
  errorMessage,
  lang = 'de',
}) => {
  const t = translations[lang];

  return (
    <div
      dir={t.dir}
      className="w-full max-w-md mx-auto p-6 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-xl border border-zinc-200/80 dark:border-zinc-800 transition-all"
    >
      {/* Icon */}
      <div className="w-14 h-14 mb-5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/60">
        <Camera className="w-7 h-7" />
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
        {t.cameraTitle}
      </h1>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
        {t.cameraDesc}
      </p>

      {/* Security note */}
      <div className="mt-5 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>{t.privacyTitle}</span>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-normal">
          {t.privacyDesc}
        </p>
      </div>

      {/* Graceful Error Display */}
      {errorMessage && (
        <div className="mt-5 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-left">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-red-700 dark:text-red-300 leading-relaxed font-normal">
              {errorMessage}
            </div>
          </div>
        </div>
      )}

      {/* Permission Button */}
      <button
        id="request-camera-button"
        onClick={onRequestPermission}
        disabled={isLoading}
        className="mt-6 w-full py-3.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-medium text-sm flex items-center justify-center gap-2.5 transition-all shadow-md shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Video className="w-4 h-4" />
        <span>{isLoading ? t.requestingAccess : t.allowCamera}</span>
      </button>
    </div>
  );
};
