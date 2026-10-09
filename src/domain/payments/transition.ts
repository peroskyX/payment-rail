import type { TransitionEvidence, TransitionSource } from './evidence.js';

export interface StateTransition<State extends string> {
  readonly entityType: 'PAYMENT' | 'PAYMENT_ATTEMPT' | 'FULFILLMENT';
  readonly entityId: string;
  readonly from: State;
  readonly to: State;
  readonly source: TransitionSource;
  readonly reason: string;
  readonly evidence: TransitionEvidence;
  readonly occurredAt: Date;
  readonly receivedAt: Date;
  readonly processedAt: Date;
}

export interface TransitionCommand<State extends string> {
  readonly to: State;
  readonly source: TransitionSource;
  readonly reason: string;
  readonly evidence: TransitionEvidence;
  readonly processedAt: Date;
}

export type TransitionResult<Entity, State extends string> =
  | {
      readonly kind: 'TRANSITIONED';
      readonly entity: Entity;
      readonly transition: StateTransition<State>;
    }
  | {
      readonly kind: 'NO_OP';
      readonly entity: Entity;
      readonly transition: null;
    };
