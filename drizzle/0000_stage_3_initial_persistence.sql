CREATE TYPE "public"."evidence_kind" AS ENUM('PROVIDER', 'SYSTEM', 'ERROR');--> statement-breakpoint
CREATE TYPE "public"."fulfillment_state" AS ENUM('NOT_STARTED', 'CREDIT_PENDING', 'CREDITED', 'CREDIT_FAILED');--> statement-breakpoint
CREATE TYPE "public"."payment_state" AS ENUM('CREATED', 'SUBMITTING', 'REQUIRES_ACTION', 'PROCESSING', 'UNKNOWN', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."provider_environment" AS ENUM('SANDBOX', 'PRODUCTION');--> statement-breakpoint
CREATE TYPE "public"."transition_entity_type" AS ENUM('PAYMENT', 'PAYMENT_ATTEMPT', 'FULFILLMENT');--> statement-breakpoint
CREATE TYPE "public"."transition_source" AS ENUM('CLIENT_REQUEST', 'SYSTEM', 'IMMEDIATE_RESPONSE', 'WEBHOOK', 'POLL', 'RECONCILIATION', 'MANUAL', 'FULFILLMENT_WORKER', 'RECOVERY_WORKER');--> statement-breakpoint
CREATE TABLE "legal_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(160) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"payment_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"state" "payment_state" DEFAULT 'CREATED' NOT NULL,
	"provider_reference" varchar(160),
	"reported_amount_minor" bigint,
	"reported_currency" varchar(3),
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "payment_attempts_sequence_positive_ck" CHECK ("payment_attempts"."sequence" > 0),
	CONSTRAINT "payment_attempts_reported_money_complete_ck" CHECK (("payment_attempts"."reported_amount_minor" IS NULL AND "payment_attempts"."reported_currency" IS NULL) OR ("payment_attempts"."reported_amount_minor" IS NOT NULL AND "payment_attempts"."reported_currency" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_state_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"attempt_id" uuid,
	"provider_id" uuid,
	"entity_type" "transition_entity_type" NOT NULL,
	"from_state" varchar(32) NOT NULL,
	"to_state" varchar(32) NOT NULL,
	"source" "transition_source" NOT NULL,
	"reason" text NOT NULL,
	"evidence_kind" "evidence_kind" NOT NULL,
	"provider_reference" varchar(160),
	"provider_event_id" varchar(160),
	"provider_raw_status" varchar(160),
	"system_evidence_code" varchar(96),
	"error_category" varchar(32),
	"error_code" varchar(96),
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_state_history_state_change_ck" CHECK ("payment_state_history"."from_state" <> "payment_state_history"."to_state")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"legal_entity_id" uuid NOT NULL,
	"payment_method_id" uuid NOT NULL,
	"merchant_reference" varchar(128) NOT NULL,
	"customer_id" varchar(128) NOT NULL,
	"requested_amount_minor" bigint NOT NULL,
	"requested_currency" varchar(3) NOT NULL,
	"confirmed_amount_minor" bigint,
	"confirmed_currency" varchar(3),
	"state" "payment_state" DEFAULT 'CREATED' NOT NULL,
	"fulfillment_state" "fulfillment_state" DEFAULT 'NOT_STARTED' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "payments_requested_amount_safe_positive_ck" CHECK ("payments"."requested_amount_minor" > 0 AND "payments"."requested_amount_minor" <= 9007199254740991),
	CONSTRAINT "payments_version_non_negative_ck" CHECK ("payments"."version" >= 0),
	CONSTRAINT "payments_confirmed_money_complete_ck" CHECK (("payments"."confirmed_amount_minor" IS NULL AND "payments"."confirmed_currency" IS NULL) OR ("payments"."confirmed_amount_minor" IS NOT NULL AND "payments"."confirmed_currency" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"environment" "provider_environment" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "payment_state_history" ADD CONSTRAINT "payment_state_history_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "payment_state_history" ADD CONSTRAINT "payment_state_history_attempt_id_payment_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."payment_attempts"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "payment_state_history" ADD CONSTRAINT "payment_state_history_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_legal_entity_id_legal_entities_id_fk" FOREIGN KEY ("legal_entity_id") REFERENCES "public"."legal_entities"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE UNIQUE INDEX "legal_entities_code_uq" ON "legal_entities" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_payment_sequence_uq" ON "payment_attempts" USING btree ("payment_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_provider_reference_uq" ON "payment_attempts" USING btree ("provider_id","provider_reference");--> statement-breakpoint
CREATE INDEX "payment_attempts_payment_created_at_idx" ON "payment_attempts" USING btree ("payment_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_attempts_provider_state_updated_at_idx" ON "payment_attempts" USING btree ("provider_id","state","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_methods_code_uq" ON "payment_methods" USING btree ("code");--> statement-breakpoint
CREATE INDEX "payment_state_history_payment_processed_at_idx" ON "payment_state_history" USING btree ("payment_id","processed_at");--> statement-breakpoint
CREATE INDEX "payment_state_history_attempt_processed_at_idx" ON "payment_state_history" USING btree ("attempt_id","processed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_entity_merchant_reference_uq" ON "payments" USING btree ("legal_entity_id","merchant_reference");--> statement-breakpoint
CREATE INDEX "payments_customer_requested_at_idx" ON "payments" USING btree ("customer_id","requested_at");--> statement-breakpoint
CREATE INDEX "payments_entity_state_requested_at_idx" ON "payments" USING btree ("legal_entity_id","state","requested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "providers_code_environment_uq" ON "providers" USING btree ("code","environment");