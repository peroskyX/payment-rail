export class PersistenceError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class PersistenceEntityNotFoundError extends PersistenceError {
  constructor(entity: string, id: string) {
    super('PERSISTENCE_ENTITY_NOT_FOUND', `${entity} ${id} was not found`);
  }
}

export class OptimisticConcurrencyError extends PersistenceError {
  constructor(entity: string, id: string, expectedVersion: number) {
    super(
      'OPTIMISTIC_CONCURRENCY_CONFLICT',
      `${entity} ${id} no longer has expected version ${expectedVersion}`,
    );
  }
}

export class PersistenceInvariantError extends PersistenceError {
  constructor(message: string) {
    super('PERSISTENCE_INVARIANT_VIOLATION', message);
  }
}

export class PersistenceConflictError extends PersistenceError {
  constructor(
    message: string,
    readonly constraint?: string,
  ) {
    super('PERSISTENCE_CONFLICT', message);
  }
}

export class PersistenceRelationshipError extends PersistenceError {
  constructor(
    message: string,
    readonly constraint?: string,
  ) {
    super('PERSISTENCE_RELATIONSHIP_VIOLATION', message);
  }
}
