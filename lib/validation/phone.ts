import { parsePhoneNumberWithError, isValidPhoneNumber, PhoneNumber } from 'libphonenumber-js';

export interface PhoneValidationResult {
  isValid: boolean;
  e164?: string;
  international?: string;
  masked?: string;
  error?: string;
}

/**
 * Validates and formats a phone number, prioritizing Germany (DE) as default country.
 */
export function validatePhoneNumber(rawNumber: string): PhoneValidationResult {
  if (!rawNumber || typeof rawNumber !== 'string') {
    return {
      isValid: false,
      error: 'Bitte geben Sie eine gültige Telefonnummer ein.',
    };
  }

  const trimmed = rawNumber.trim().replace(/^00/, '+');
  if (trimmed.length < 6) {
    return {
      isValid: false,
      error: 'Bitte geben Sie eine gültige Telefonnummer ein.',
    };
  }

  try {
    // Default country is Jordan (JO), while supporting international numbers (+...)
    const parsed: PhoneNumber = parsePhoneNumberWithError(trimmed, 'JO');

    if (!parsed.isValid()) {
      return {
        isValid: false,
        error: 'Bitte geben Sie eine gültige Telefonnummer ein.',
      };
    }

    const e164 = parsed.format('E.164');
    const international = parsed.formatInternational();
    const masked = maskPhoneNumber(international, e164);

    return {
      isValid: true,
      e164,
      international,
      masked,
    };
  } catch (err: any) {
    return {
      isValid: false,
      error: 'Bitte geben Sie eine gültige Telefonnummer ein.',
    };
  }
}

/**
 * Produces a secure masked phone number like "+962 79 **** 4567" or "+49 151 **** 5678".
 */
export function maskPhoneNumber(formattedNumber: string, fallbackE164: string): string {
  const clean = fallbackE164.replace(/\s+/g, '');

  // Special handling for Jordan (+962)
  if (clean.startsWith('+962') && clean.length >= 12) {
    // e.g. +962791234567 -> prefix: +962 79, tail: 4567
    const prefix = `+962 ${clean.slice(4, 6)}`;
    const tail = clean.slice(-4);
    return `${prefix} **** ${tail}`;
  }

  const parts = formattedNumber.split(' ');
  if (parts.length >= 3) {
    // e.g., ["+49", "151", "12345678"] -> "+49 151 **** " + last 4 digits
    const prefix = parts.slice(0, 2).join(' ');
    const lastPart = parts.slice(2).join('');
    const ending = lastPart.length > 4 ? lastPart.slice(-4) : lastPart;
    return `${prefix} **** ${ending}`;
  }

  // Fallback for compact format
  if (clean.length > 8) {
    const head = clean.slice(0, 7);
    const tail = clean.slice(-4);
    return `${head} **** ${tail}`;
  }

  return '****';
}
