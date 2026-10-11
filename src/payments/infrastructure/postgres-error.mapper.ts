import {
  PersistenceConflictError,
  PersistenceError,
  PersistenceInvariantError,
  PersistenceRelationshipError,
} from '../application/persistence-errors.js';

interface PostgresErrorDescriptor {
  readonly code: string;
  readonly constraint?: string;
}

export function mapPostgresError(error: unknown, operation: string): Error {
  if (error instanceof PersistenceError) return error;

  const descriptor = findPostgresError(error);
  switch (descriptor?.code) {
    case '23505':
      return new PersistenceConflictError(
        `${operation} conflicts with an existing record`,
        descriptor.constraint,
      );
    case '23001':
    case '23503':
      return new PersistenceRelationshipError(
        `${operation} violates a protected relationship`,
        descriptor.constraint,
      );
    case '23514':
      return new PersistenceInvariantError(`${operation} violates a database check constraint`);
    default:
      return error instanceof Error ? error : new Error(`${operation} failed`);
  }
}

function findPostgresError(error: unknown): PostgresErrorDescriptor | undefined {
  if (typeof error !== 'object' || error === null) return undefined;

  if ('code' in error && typeof error.code === 'string') {
    return {
      code: error.code,
      ...('constraint' in error && typeof error.constraint === 'string'
        ? { constraint: error.constraint }
        : {}),
    };
  }

  return 'cause' in error ? findPostgresError(error.cause) : undefined;
}
