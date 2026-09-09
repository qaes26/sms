'use client';

import React, { useState } from 'react';
import { Phone, ShieldCheck, ArrowRight, ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { validatePhoneNumber } from '@/lib/validation/phone';
import { Language, translations } from '@/lib/i18n';

interface PhoneFormProps {
  onSubmit: (phoneNumber: string) => Promise<void>;
  isLoading: boolean;
  lang?: Language;
}

export const PhoneForm: React.FC<PhoneFormProps> = ({ onSubmit, isLoading, lang = 'de' }) => {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const t = translations[lang];
  const isRtl = t.dir === 'rtl';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = validatePhoneNumber(phone);
    if (!validation.isValid) {
      setError(t.invalidPhone);
      return;
    }

    try {
      await onSubmit(validation.e164 || phone);
    } catch (err: any) {
      setError(err.message || (lang === 'ar' ? 'حدث خطأ ما.' : 'Ein Fehler ist aufgetreten.'));
    }
  };

  return (
    <div
      dir={t.dir}
      className="w-full max-w-md mx-auto p-6 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-xl border border-zinc-200/80 dark:border-zinc-800 transition-all"
    >
      {/* Icon Badge */}
      <div className="w-12 h-12 mb-5 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
        <Phone className="w-6 h-6" />
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
        {t.welcome}
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
        {t.enterPhone}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
        <div>
          <label
            htmlFor="phone-input"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
          >
            {t.phoneLabel}
          </label>
          <div className="relative">
            <input
              id="phone-input"
              type="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (error) setError(null);
              }}
              placeholder={t.phonePlaceholder}
              disabled={isLoading}
              className={`w-full px-4 py-3 rounded-xl border text-base font-normal tracking-wide transition-all outline-none bg-zinc-50 dark:bg-zinc-800/60 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:ring-2 ${
                error
                  ? 'border-red-500 focus:ring-red-400/20 focus:border-red-500'
                  : 'border-zinc-200 dark:border-zinc-700 focus:border-blue-500 focus:ring-blue-400/20'
              }`}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 mt-2 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Notice of consent */}
        <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/80">
          <div className="flex gap-2.5 items-start">
            <ShieldCheck className="w-4 h-4 text-zinc-500 dark:text-zinc-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-normal">
              {t.consentNotice}
            </p>
          </div>
        </div>

        {/* Submit button */}
        <button
          id="submit-phone-button"
          type="submit"
          disabled={isLoading || !phone.trim()}
          className="w-full py-3.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t.processing}</span>
            </>
          ) : (
            <>
              <span>{t.continue}</span>
              {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </>
          )}
        </button>
      </form>
    </div>
  );
};
