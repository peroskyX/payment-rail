import { InvalidDomainValueError } from '../shared/domain-error.js';

export interface CurrencyMetadata {
  readonly code: string;
  readonly minorUnit: number;
}

export const CURRENCY_METADATA = Object.freeze({
  EUR: Object.freeze({ code: 'EUR', minorUnit: 2 }),
  GBP: Object.freeze({ code: 'GBP', minorUnit: 2 }),
  GHS: Object.freeze({ code: 'GHS', minorUnit: 2 }),
  JPY: Object.freeze({ code: 'JPY', minorUnit: 0 }),
  KES: Object.freeze({ code: 'KES', minorUnit: 2 }),
  KWD: Object.freeze({ code: 'KWD', minorUnit: 3 }),
  NGN: Object.freeze({ code: 'NGN', minorUnit: 2 }),
  USD: Object.freeze({ code: 'USD', minorUnit: 2 }),
} as const satisfies Record<string, CurrencyMetadata>);

export type SupportedCurrency = keyof typeof CURRENCY_METADATA;

export function getCurrencyMetadata(code: string): CurrencyMetadata {
  if (!Object.hasOwn(CURRENCY_METADATA, code)) {
    throw new InvalidDomainValueError('currency', `${code} is not supported`);
  }

  return CURRENCY_METADATA[code as SupportedCurrency];
}
