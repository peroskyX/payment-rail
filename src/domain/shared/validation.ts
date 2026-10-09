import { InvalidDomainValueError } from './domain-error.js';

export function requireNonBlank(value: string, field: string): string {
  if (value.trim().length === 0) {
    throw new InvalidDomainValueError(field, 'must not be blank');
  }

  return value;
}

export function requireValidDate(value: Date, field: string): Date {
  if (Number.isNaN(value.getTime())) {
    throw new InvalidDomainValueError(field, 'must be a valid date');
  }

  return new Date(value.getTime());
}
