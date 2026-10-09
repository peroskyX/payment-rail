import { getCurrencyMetadata, type SupportedCurrency } from './currency.js';
import { InvalidDomainValueError } from '../shared/domain-error.js';

export class Money {
  readonly minorAmount: number;
  readonly currency: SupportedCurrency;

  private constructor(minorAmount: number, currency: SupportedCurrency) {
    this.minorAmount = minorAmount;
    this.currency = currency;
    Object.freeze(this);
  }

  static fromMinor(minorAmount: number, currency: string): Money {
    if (!Number.isSafeInteger(minorAmount)) {
      throw new InvalidDomainValueError('minorAmount', 'must be a safe integer');
    }

    const metadata = getCurrencyMetadata(currency);
    return new Money(minorAmount, metadata.code as SupportedCurrency);
  }

  equals(other: Money): boolean {
    return this.minorAmount === other.minorAmount && this.currency === other.currency;
  }

  isPositive(): boolean {
    return this.minorAmount > 0;
  }
}
