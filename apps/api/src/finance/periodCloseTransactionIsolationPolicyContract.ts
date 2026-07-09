import { periodCloseSqlMigrationContract } from './periodCloseSqlRepositoryContract.js';
import type { PeriodCloseDatabaseTableName } from './periodCloseDatabaseContract.js';

export type PeriodCloseIsolationLevel = 'read_committed' | 'repeatable_read' | 'serializable';

export type PeriodCloseTransactionPolicyOperation =
  | 'close_or_reopen_accounting_period'
  | 'closed_period_source_mutation_guard'
  | 'financial_statement_snapshot_after_close';

export type PeriodCloseTransactionPolicyStepKind =
  | 'begin'
  | 'set_isolation'
  | 'lock_period_row'
  | 'check_idempotency'
  | 'check_expected_version'
  | 'check_source_period'
  | 'validate_source_hash'
  | 'append_rows'
  | 'validate_row_contract'
  | 'commit_or_rollback';

export type PeriodCloseTransactionPolicyStep = {
  kind: PeriodCloseTransactionPolicyStepKind;
  lockMode?: 'select_for_update' | 'unique_constraint';
  table?: PeriodCloseDatabaseTableName;
};

export type PeriodCloseTransactionIsolationPolicy = {
  automaticRetryInsideTransaction: false;
  boundaryName: string;
  isolationLevel: PeriodCloseIsolationLevel;
  notes: string[];
  operation: PeriodCloseTransactionPolicyOperation;
  retryableFailureCodes: string[];
  steps: PeriodCloseTransactionPolicyStep[];
};

export type PeriodCloseTransactionIsolationPolicyInput = Omit<
  PeriodCloseTransactionIsolationPolicy,
  'automaticRetryInsideTransaction'
> & {
  automaticRetryInsideTransaction: boolean;
};

export const periodCloseTransactionIsolationPolicies: PeriodCloseTransactionIsolationPolicy[] = [
  {
    automaticRetryInsideTransaction: false,
    boundaryName: 'close_or_reopen_accounting_period',
    isolationLevel: 'read_committed',
    notes: [
      'Use READ COMMITTED plus accounting_periods SELECT FOR UPDATE as the explicit period-level serialization boundary.',
      'The idempotency unique key prevents duplicate close/reopen effects across retries or service restarts.',
      'Lock timeout and serialization failures are returned to the service layer as retryable request errors; the transaction body must not silently retry.'
    ],
    operation: 'close_or_reopen_accounting_period',
    retryableFailureCodes: ['lock_timeout', 'deadlock_detected', 'serialization_failure'],
    steps: [
      { kind: 'begin' },
      { kind: 'set_isolation' },
      { kind: 'lock_period_row', lockMode: 'select_for_update', table: 'accounting_periods' },
      { kind: 'check_idempotency', lockMode: 'unique_constraint', table: 'accounting_period_idempotency_records' },
      { kind: 'check_expected_version', table: 'accounting_periods' },
      { kind: 'append_rows', table: 'accounting_period_close_checks' },
      { kind: 'append_rows', table: 'accounting_period_events' },
      { kind: 'append_rows', table: 'accounting_period_idempotency_records' },
      { kind: 'validate_row_contract' },
      { kind: 'commit_or_rollback' }
    ]
  },
  {
    automaticRetryInsideTransaction: false,
    boundaryName: 'closed_period_source_mutation_guard',
    isolationLevel: 'read_committed',
    notes: [
      'Source mutations must resolve every affected accounting period and lock each period row before source-row writes.',
      'Closed-period rejection audit rows are appended in the same transaction that decides the guard outcome.',
      'A source mutation with unresolved accounting period is rejected before writing incomplete guard audit rows.'
    ],
    operation: 'closed_period_source_mutation_guard',
    retryableFailureCodes: ['lock_timeout', 'deadlock_detected', 'serialization_failure'],
    steps: [
      { kind: 'begin' },
      { kind: 'set_isolation' },
      { kind: 'lock_period_row', lockMode: 'select_for_update', table: 'accounting_periods' },
      { kind: 'check_source_period', table: 'accounting_periods' },
      { kind: 'append_rows', table: 'accounting_period_source_mutation_events' },
      { kind: 'validate_row_contract' },
      { kind: 'commit_or_rollback' }
    ]
  },
  {
    automaticRetryInsideTransaction: false,
    boundaryName: 'financial_statement_snapshot_after_close',
    isolationLevel: 'read_committed',
    notes: [
      'Formal statement snapshots can be written only after locking and verifying the closed accounting-period row.',
      'The snapshot stores source-ledger and mapping hashes so historical readback never recomputes from drifted current rows.',
      'Snapshot replay is idempotent by persisted snapshot rows, not by recomputing the current statement model.'
    ],
    operation: 'financial_statement_snapshot_after_close',
    retryableFailureCodes: ['lock_timeout', 'deadlock_detected', 'serialization_failure'],
    steps: [
      { kind: 'begin' },
      { kind: 'set_isolation' },
      { kind: 'lock_period_row', lockMode: 'select_for_update', table: 'accounting_periods' },
      { kind: 'validate_source_hash', table: 'financial_statement_snapshots' },
      { kind: 'append_rows', table: 'financial_statement_snapshots' },
      { kind: 'append_rows', table: 'financial_statement_snapshot_lines' },
      { kind: 'append_rows', table: 'financial_statement_general_ledger_lines' },
      { kind: 'validate_row_contract' },
      { kind: 'commit_or_rollback' }
    ]
  }
];

function stepIndex(
  policy: PeriodCloseTransactionIsolationPolicyInput,
  predicate: (step: PeriodCloseTransactionPolicyStep) => boolean
) {
  return policy.steps.findIndex(predicate);
}

function hasMigrationBoundary(policy: PeriodCloseTransactionIsolationPolicyInput) {
  return periodCloseSqlMigrationContract.transactionBoundaries.some(
    (boundary) => boundary.name === policy.boundaryName
  );
}

function hasAppendAfterPeriodLock(policy: PeriodCloseTransactionIsolationPolicyInput) {
  const lockIndex = stepIndex(policy, (step) => step.kind === 'lock_period_row');
  const firstAppendIndex = stepIndex(policy, (step) => step.kind === 'append_rows');

  return lockIndex !== -1 && firstAppendIndex !== -1 && lockIndex < firstAppendIndex;
}

export function validatePeriodCloseTransactionIsolationPolicies(
  policies: readonly PeriodCloseTransactionIsolationPolicyInput[] = periodCloseTransactionIsolationPolicies
): string[] {
  const errors: string[] = [];
  const operationNames = new Set<PeriodCloseTransactionPolicyOperation>();

  for (const policy of policies) {
    if (operationNames.has(policy.operation)) {
      errors.push(`${policy.operation} isolation policy must be unique`);
    }

    operationNames.add(policy.operation);

    if (!hasMigrationBoundary(policy)) {
      errors.push(`${policy.operation} must reference a SQL migration transaction boundary`);
    }

    if (policy.isolationLevel !== 'read_committed') {
      errors.push(`${policy.operation} must use read_committed plus explicit period row locks`);
    }

    if (policy.automaticRetryInsideTransaction !== false) {
      errors.push(`${policy.operation} must not retry inside an open database transaction`);
    }

    if (stepIndex(policy, (step) => step.kind === 'begin') !== 0) {
      errors.push(`${policy.operation} must begin before any transactional work`);
    }

    if (
      stepIndex(policy, (step) => step.kind === 'set_isolation') <=
      stepIndex(policy, (step) => step.kind === 'begin')
    ) {
      errors.push(`${policy.operation} must set isolation immediately after begin`);
    }

    const periodLockIndex = stepIndex(
      policy,
      (step) =>
        step.kind === 'lock_period_row' &&
        step.table === 'accounting_periods' &&
        step.lockMode === 'select_for_update'
    );

    if (periodLockIndex === -1) {
      errors.push(`${policy.operation} must lock accounting_periods with SELECT FOR UPDATE`);
    }

    if (!hasAppendAfterPeriodLock(policy)) {
      errors.push(`${policy.operation} must lock the period row before appending rows`);
    }

    if (
      stepIndex(policy, (step) => step.kind === 'validate_row_contract') === -1 ||
      stepIndex(policy, (step) => step.kind === 'commit_or_rollback') !== policy.steps.length - 1
    ) {
      errors.push(`${policy.operation} must validate rows before the final commit or rollback`);
    }

    for (const code of ['lock_timeout', 'deadlock_detected', 'serialization_failure']) {
      if (!policy.retryableFailureCodes.includes(code)) {
        errors.push(`${policy.operation} must classify ${code} as retryable outside the transaction`);
      }
    }

    if (
      policy.operation === 'close_or_reopen_accounting_period' &&
      !policy.steps.some(
        (step) =>
          step.kind === 'check_idempotency' &&
          step.table === 'accounting_period_idempotency_records' &&
          step.lockMode === 'unique_constraint'
      )
    ) {
      errors.push('close_or_reopen_accounting_period must check the idempotency unique constraint');
    }

    if (
      policy.operation === 'financial_statement_snapshot_after_close' &&
      !policy.steps.some((step) => step.kind === 'validate_source_hash')
    ) {
      errors.push('financial_statement_snapshot_after_close must validate source hashes before snapshot writes');
    }
  }

  for (const requiredOperation of [
    'close_or_reopen_accounting_period',
    'closed_period_source_mutation_guard',
    'financial_statement_snapshot_after_close'
  ] satisfies PeriodCloseTransactionPolicyOperation[]) {
    if (!operationNames.has(requiredOperation)) {
      errors.push(`${requiredOperation} isolation policy is required`);
    }
  }

  return errors;
}
