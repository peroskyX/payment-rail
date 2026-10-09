import { describe, expect, it } from 'vitest';

import { getCurrencyMetadata } from '../src/domain/money/currency.js';
import { Money } from '../src/domain/money/money.js';
import { InvalidDomainValueError } from '../src/domain/shared/domain-error.js';

describe('Money', () => {
  it('represents money as integer minor units', () => {
    const amount = Money.fromMinor(12_345, 'NGN');

    expect(amount.minorAmount).toBe(12_345);
    expect(amount.currency).toBe('NGN');
  });

  it('supports currencies with zero, two, and three decimal places', () => {
    expect(getCurrencyMetadata('JPY').minorUnit).toBe(0);
    expect(getCurrencyMetadata('USD').minorUnit).toBe(2);
    expect(getCurrencyMetadata('KWD').minorUnit).toBe(3);
  });

  it.each([12.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rejects non-safe-integer minor amount %s',
    (minorAmount) => {
      expect(() => Money.fromMinor(minorAmount, 'USD')).toThrow(InvalidDomainValueError);
    },
  );

  it('rejects unsupported or incorrectly cased currencies', () => {
    expect(() => Money.fromMinor(100, 'BTC')).toThrow('currency BTC is not supported');
    expect(() => Money.fromMinor(100, 'usd')).toThrow('currency usd is not supported');
  });

  it('compares both minor units and currency', () => {
    const dollars = Money.fromMinor(100, 'USD');

    expect(dollars.equals(Money.fromMinor(100, 'USD'))).toBe(true);
    expect(dollars.equals(Money.fromMinor(101, 'USD'))).toBe(false);
    expect(dollars.equals(Money.fromMinor(100, 'NGN'))).toBe(false);
  });
});
