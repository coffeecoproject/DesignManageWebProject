-- StartupManageSystem period-close project migration artifact.
-- Artifact: period-close-persistent-lock-postgres-v1
-- Filename: 20260704_000001_period_close_persistent_lock.sql
-- Generated at: 2026-07-04T00:00:00.000Z
-- Source contract: 20260704_finance_period_close_sql_repository
-- Checksum: fnv1a64:bb3753b354e8833d
-- Formal apply status: not_applied
-- Apply mode: manual_review_required
-- This artifact is not a production migration record until manual review and formal apply evidence exist.
-- Transaction recipe: close_accounting_period
-- Transaction recipe: guard_source_mutation
-- Transaction recipe: write_financial_statement_snapshot

DO $$
BEGIN
  CREATE TYPE "accounting_period_close_check_group" AS ENUM ('voucher_preparation', 'voucher_booking', 'general_ledger_trial_balance', 'financial_statements', 'cash_review', 'cash_reconciliation', 'tax_handling', 'social_insurance_housing_fund');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "accounting_period_close_check_run_type" AS ENUM ('close_attempt', 'close_snapshot');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "accounting_period_close_check_status" AS ENUM ('未运行', '通过', '阻断');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "accounting_period_event_type" AS ENUM ('close_attempt_failed', 'closed', 'reopen_attempt_failed', 'reopened');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "accounting_period_status" AS ENUM ('开放', '已结账', '已反结账');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "close_check_item_status" AS ENUM ('不适用', '提示', '通过', '阻断');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "financial_statement_snapshot_status" AS ENUM ('已生成');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "financial_statement_type" AS ENUM ('balance_sheet', 'cash_flow', 'profit_statement');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "trial_balance_status" AS ENUM ('平衡', '不平', '未生成');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "accounting_periods" (
  "period" text PRIMARY KEY NOT NULL,
  "status" accounting_period_status NOT NULL,
  "opened_at" timestamptz,
  "closed_at" timestamptz,
  "closed_by" text,
  "closed_by_snapshot" jsonb,
  "close_reason" text,
  "close_check_snapshot_id" text,
  "close_check_snapshot_hash" text,
  "reopened_at" timestamptz,
  "reopened_by" text,
  "reopened_by_snapshot" jsonb,
  "reopen_reason" text,
  "reopen_impact_snapshot" jsonb,
  "reopen_risk_confirmation_snapshot" jsonb,
  "version" integer NOT NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS "accounting_period_close_checks" (
  "id" text PRIMARY KEY NOT NULL,
  "period" text NOT NULL,
  "run_type" accounting_period_close_check_run_type NOT NULL,
  "can_close" boolean NOT NULL,
  "status" accounting_period_close_check_status NOT NULL,
  "computed_at" timestamptz NOT NULL,
  "computed_by" text,
  "source_version_set_hash" text NOT NULL,
  "check_snapshot_hash" text NOT NULL,
  "trial_debit_total" numeric(18,2) NOT NULL,
  "trial_credit_total" numeric(18,2) NOT NULL,
  "trial_balance_difference" numeric(18,2) NOT NULL,
  "trial_balance_status" trial_balance_status NOT NULL,
  "persisted_for_close" boolean NOT NULL,
  "request_id" text
);

CREATE TABLE IF NOT EXISTS "accounting_period_close_check_items" (
  "id" text PRIMARY KEY NOT NULL,
  "close_check_id" text NOT NULL,
  "period" text NOT NULL,
  "group_code" accounting_period_close_check_group NOT NULL,
  "group_label" text NOT NULL,
  "status" close_check_item_status NOT NULL,
  "can_pass" boolean NOT NULL,
  "blocker_count" integer NOT NULL,
  "source_module" text,
  "source_id" text,
  "source_no" text,
  "source_status" text,
  "source_version" integer,
  "reason_code" text,
  "reason" text NOT NULL,
  "next_action" text,
  "snapshot" jsonb
);

CREATE TABLE IF NOT EXISTS "accounting_period_events" (
  "id" text PRIMARY KEY NOT NULL,
  "period" text NOT NULL,
  "event_type" accounting_period_event_type NOT NULL,
  "before_status" accounting_period_status,
  "after_status" accounting_period_status,
  "actor_id" text,
  "actor_snapshot" jsonb,
  "reason" text,
  "reopen_impact_snapshot" jsonb,
  "reopen_risk_confirmation_snapshot" jsonb,
  "close_check_id" text,
  "idempotency_key" text,
  "request_id" text NOT NULL,
  "created_at" timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS "accounting_period_idempotency_records" (
  "id" text PRIMARY KEY NOT NULL,
  "period" text NOT NULL,
  "operation" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "request_signature" text NOT NULL,
  "response_snapshot" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS "accounting_period_source_mutation_events" (
  "id" text PRIMARY KEY NOT NULL,
  "source_area" text NOT NULL,
  "source_id" text NOT NULL,
  "event_type" text NOT NULL,
  "operation" text NOT NULL,
  "affected_accounting_periods" jsonb NOT NULL,
  "actor_id" text NOT NULL,
  "actor_snapshot" jsonb NOT NULL,
  "request_id" text NOT NULL,
  "created_at" timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS "financial_statement_snapshots" (
  "id" text PRIMARY KEY NOT NULL,
  "accounting_period" text NOT NULL,
  "status" financial_statement_snapshot_status NOT NULL,
  "source_ledger_hash" text NOT NULL,
  "cash_flow_mapping_version_hash" text NOT NULL,
  "snapshot_hash" text NOT NULL,
  "generated_at" timestamptz NOT NULL,
  "generated_by" text NOT NULL,
  "generated_by_snapshot" jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "financial_statement_snapshot_lines" (
  "id" text PRIMARY KEY NOT NULL,
  "snapshot_id" text NOT NULL,
  "accounting_period" text NOT NULL,
  "statement_type" financial_statement_type NOT NULL,
  "line_index" integer NOT NULL,
  "section" text NOT NULL,
  "item" text NOT NULL,
  "amount" numeric(18,2) NOT NULL,
  "source_subject_codes" jsonb NOT NULL,
  "voucher_nos" jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "financial_statement_general_ledger_lines" (
  "id" text PRIMARY KEY NOT NULL,
  "snapshot_id" text NOT NULL,
  "accounting_period" text NOT NULL,
  "subject_code" text NOT NULL,
  "debit_amount" numeric(18,2) NOT NULL,
  "credit_amount" numeric(18,2) NOT NULL,
  "entry_count" integer NOT NULL,
  "source_ledger_hash" text NOT NULL,
  "voucher_nos" jsonb NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_accounting_periods_close_check_snapshot_id'
      AND connamespace = current_schema()::regnamespace
  ) THEN
    ALTER TABLE "accounting_periods"
    ADD CONSTRAINT "fk_accounting_periods_close_check_snapshot_id"
    FOREIGN KEY ("close_check_snapshot_id")
    REFERENCES "accounting_period_close_checks" ("id");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_accounting_period_close_checks_period'
      AND connamespace = current_schema()::regnamespace
  ) THEN
    ALTER TABLE "accounting_period_close_checks"
    ADD CONSTRAINT "fk_accounting_period_close_checks_period"
    FOREIGN KEY ("period")
    REFERENCES "accounting_periods" ("period");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_accounting_period_close_check_items_close_check_id'
      AND connamespace = current_schema()::regnamespace
  ) THEN
    ALTER TABLE "accounting_period_close_check_items"
    ADD CONSTRAINT "fk_accounting_period_close_check_items_close_check_id"
    FOREIGN KEY ("close_check_id")
    REFERENCES "accounting_period_close_checks" ("id");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_accounting_period_close_check_items_period'
      AND connamespace = current_schema()::regnamespace
  ) THEN
    ALTER TABLE "accounting_period_close_check_items"
    ADD CONSTRAINT "fk_accounting_period_close_check_items_period"
    FOREIGN KEY ("period")
    REFERENCES "accounting_periods" ("period");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_accounting_period_events_period'
      AND connamespace = current_schema()::regnamespace
  ) THEN
    ALTER TABLE "accounting_period_events"
    ADD CONSTRAINT "fk_accounting_period_events_period"
    FOREIGN KEY ("period")
    REFERENCES "accounting_periods" ("period");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_accounting_period_events_close_check_id'
      AND connamespace = current_schema()::regnamespace
  ) THEN
    ALTER TABLE "accounting_period_events"
    ADD CONSTRAINT "fk_accounting_period_events_close_check_id"
    FOREIGN KEY ("close_check_id")
    REFERENCES "accounting_period_close_checks" ("id");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_accounting_period_idempotency_records_period'
      AND connamespace = current_schema()::regnamespace
  ) THEN
    ALTER TABLE "accounting_period_idempotency_records"
    ADD CONSTRAINT "fk_accounting_period_idempotency_records_period"
    FOREIGN KEY ("period")
    REFERENCES "accounting_periods" ("period");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_financial_statement_snapshots_accounting_period'
      AND connamespace = current_schema()::regnamespace
  ) THEN
    ALTER TABLE "financial_statement_snapshots"
    ADD CONSTRAINT "fk_financial_statement_snapshots_accounting_period"
    FOREIGN KEY ("accounting_period")
    REFERENCES "accounting_periods" ("period");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_financial_statement_snapshot_lines_snapshot_id'
      AND connamespace = current_schema()::regnamespace
  ) THEN
    ALTER TABLE "financial_statement_snapshot_lines"
    ADD CONSTRAINT "fk_financial_statement_snapshot_lines_snapshot_id"
    FOREIGN KEY ("snapshot_id")
    REFERENCES "financial_statement_snapshots" ("id");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_financial_statement_snapshot_lines_accounting_period'
      AND connamespace = current_schema()::regnamespace
  ) THEN
    ALTER TABLE "financial_statement_snapshot_lines"
    ADD CONSTRAINT "fk_financial_statement_snapshot_lines_accounting_period"
    FOREIGN KEY ("accounting_period")
    REFERENCES "accounting_periods" ("period");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_financial_statement_general_ledger_lines_snapshot_id'
      AND connamespace = current_schema()::regnamespace
  ) THEN
    ALTER TABLE "financial_statement_general_ledger_lines"
    ADD CONSTRAINT "fk_financial_statement_general_ledger_lines_snapshot_id"
    FOREIGN KEY ("snapshot_id")
    REFERENCES "financial_statement_snapshots" ("id");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_financial_statement_general_ledger_lines_accounting_period'
      AND connamespace = current_schema()::regnamespace
  ) THEN
    ALTER TABLE "financial_statement_general_ledger_lines"
    ADD CONSTRAINT "fk_financial_statement_general_ledger_lines_accounting_period"
    FOREIGN KEY ("accounting_period")
    REFERENCES "accounting_periods" ("period");
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "idx_accounting_periods_period_version_for_close_lock" ON "accounting_periods" ("period", "version");

CREATE INDEX IF NOT EXISTS "idx_accounting_periods_period_status_for_source_guard" ON "accounting_periods" ("period", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "uk_accounting_period_idempotency_period_operation_key" ON "accounting_period_idempotency_records" ("period", "operation", "idempotency_key");

CREATE INDEX IF NOT EXISTS "idx_accounting_period_close_checks_period_hash_run_type" ON "accounting_period_close_checks" ("period", "check_snapshot_hash", "run_type", "persisted_for_close");

CREATE INDEX IF NOT EXISTS "idx_accounting_period_close_check_items_snapshot_group_source" ON "accounting_period_close_check_items" ("close_check_id", "group_code", "source_id");

CREATE INDEX IF NOT EXISTS "idx_accounting_period_events_period_created_at" ON "accounting_period_events" ("period", "created_at");

CREATE INDEX IF NOT EXISTS "idx_accounting_period_source_mutation_events_source_created_at" ON "accounting_period_source_mutation_events" ("source_area", "source_id", "created_at");
