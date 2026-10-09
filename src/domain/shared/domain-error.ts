export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidDomainValueError extends DomainError {
  constructor(field: string, reason: string) {
    super('INVALID_DOMAIN_VALUE', `${field} ${reason}`);
  }
}

export class IllegalStateTransitionError extends DomainError {
  constructor(entity: string, from: string, to: string) {
    super('ILLEGAL_STATE_TRANSITION', `${entity} cannot transition from ${from} to ${to}`);
  }
}

export class TransitionEvidenceError extends DomainError {
  constructor(message: string) {
    super('INVALID_TRANSITION_EVIDENCE', message);
  }
}

export class PaymentInvariantError extends DomainError {
  constructor(message: string) {
    super('PAYMENT_INVARIANT_VIOLATION', message);
  }
}
