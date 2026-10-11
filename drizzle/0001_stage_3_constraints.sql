ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_reported_currency_supported_ck" CHECK ("payment_attempts"."reported_currency" IS NULL OR "payment_attempts"."reported_currency" IN ('EUR', 'GBP', 'GHS', 'JPY', 'KES', 'KWD', 'NGN', 'USD'));--> statement-breakpoint
ALTER TABLE "payment_state_history" ADD CONSTRAINT "payment_state_history_entity_state_ck" CHECK (("payment_state_history"."entity_type" = 'FULFILLMENT' AND "payment_state_history"."from_state" IN ('NOT_STARTED', 'CREDIT_PENDING', 'CREDITED', 'CREDIT_FAILED') AND "payment_state_history"."to_state" IN ('NOT_STARTED', 'CREDIT_PENDING', 'CREDITED', 'CREDIT_FAILED')) OR ("payment_state_history"."entity_type" IN ('PAYMENT', 'PAYMENT_ATTEMPT') AND "payment_state_history"."from_state" IN ('CREATED', 'SUBMITTING', 'REQUIRES_ACTION', 'PROCESSING', 'UNKNOWN', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED') AND "payment_state_history"."to_state" IN ('CREATED', 'SUBMITTING', 'REQUIRES_ACTION', 'PROCESSING', 'UNKNOWN', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED')));--> statement-breakpoint
ALTER TABLE "payment_state_history" ADD CONSTRAINT "payment_state_history_evidence_shape_ck" CHECK (("payment_state_history"."evidence_kind" = 'PROVIDER' AND "payment_state_history"."attempt_id" IS NOT NULL AND "payment_state_history"."provider_id" IS NOT NULL AND "payment_state_history"."provider_raw_status" IS NOT NULL) OR ("payment_state_history"."evidence_kind" = 'SYSTEM' AND "payment_state_history"."system_evidence_code" IS NOT NULL) OR ("payment_state_history"."evidence_kind" = 'ERROR' AND "payment_state_history"."error_category" IS NOT NULL AND "payment_state_history"."error_code" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_requested_currency_supported_ck" CHECK ("payments"."requested_currency" IN ('EUR', 'GBP', 'GHS', 'JPY', 'KES', 'KWD', 'NGN', 'USD'));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_confirmed_currency_supported_ck" CHECK ("payments"."confirmed_currency" IS NULL OR "payments"."confirmed_currency" IN ('EUR', 'GBP', 'GHS', 'JPY', 'KES', 'KWD', 'NGN', 'USD'));
--> statement-breakpoint
CREATE FUNCTION prevent_payment_state_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION 'payment_state_history is immutable';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER payment_state_history_immutable_trg
BEFORE UPDATE OR DELETE ON payment_state_history
FOR EACH ROW
EXECUTE FUNCTION prevent_payment_state_history_mutation();
