import {
  periodCloseTransactionIsolationPolicies,
  validatePeriodCloseTransactionIsolationPolicies,
  type PeriodCloseTransactionIsolationPolicyInput
} from './periodCloseTransactionIsolationPolicyContract.js';

type UnitTest = {
  name: string;
  run: () => void;
};

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function clonePolicies(): PeriodCloseTransactionIsolationPolicyInput[] {
  return periodCloseTransactionIsolationPolicies.map((policy) => ({
    ...policy,
    notes: [...policy.notes],
    retryableFailureCodes: [...policy.retryableFailureCodes],
    steps: policy.steps.map((step) => ({ ...step }))
  }));
}

const tests: UnitTest[] = [
  {
    name: 'declares read-committed period-row lock policy for all period-close write transactions',
    run: () => {
      const errors = validatePeriodCloseTransactionIsolationPolicies();

      assertEqual(errors.length, 0, `default period-close isolation policies should be valid: ${errors.join('; ')}`);
      assertEqual(periodCloseTransactionIsolationPolicies.length, 3, 'three period-close transaction policies are required');

      for (const policy of periodCloseTransactionIsolationPolicies) {
        assertEqual(policy.isolationLevel, 'read_committed', `${policy.operation} should use READ COMMITTED`);
        assertEqual(
          policy.automaticRetryInsideTransaction,
          false,
          `${policy.operation} should not retry inside an open transaction`
        );
        assert(
          policy.steps.some(
            (step) =>
              step.kind === 'lock_period_row' &&
              step.table === 'accounting_periods' &&
              step.lockMode === 'select_for_update'
          ),
          `${policy.operation} should lock the accounting period row`
        );
      }
    }
  },
  {
    name: 'rejects policies that append rows before acquiring the period lock',
    run: () => {
      const policies = clonePolicies();
      const closePolicy = policies.find((policy) => policy.operation === 'close_or_reopen_accounting_period');

      if (!closePolicy) {
        throw new Error('close policy missing in fixture');
      }

      closePolicy.steps = [
        { kind: 'begin' },
        { kind: 'set_isolation' },
        { kind: 'append_rows', table: 'accounting_period_close_checks' },
        { kind: 'lock_period_row', lockMode: 'select_for_update', table: 'accounting_periods' },
        { kind: 'validate_row_contract' },
        { kind: 'commit_or_rollback' }
      ];

      const errors = validatePeriodCloseTransactionIsolationPolicies(policies);

      assert(
        errors.some((error) => error.includes('must lock the period row before appending rows')),
        'validator should reject writes before the period row lock'
      );
    }
  },
  {
    name: 'rejects close policies without idempotency unique-constraint checks',
    run: () => {
      const policies = clonePolicies();
      const closePolicy = policies.find((policy) => policy.operation === 'close_or_reopen_accounting_period');

      if (!closePolicy) {
        throw new Error('close policy missing in fixture');
      }

      closePolicy.steps = closePolicy.steps.filter((step) => step.kind !== 'check_idempotency');

      const errors = validatePeriodCloseTransactionIsolationPolicies(policies);

      assert(
        errors.some((error) => error.includes('must check the idempotency unique constraint')),
        'validator should require close idempotency unique-constraint policy'
      );
    }
  },
  {
    name: 'rejects implicit in-transaction retry and unsupported isolation levels',
    run: () => {
      const policies = clonePolicies();
      const sourceGuardPolicy = policies.find((policy) => policy.operation === 'closed_period_source_mutation_guard');

      if (!sourceGuardPolicy) {
        throw new Error('source guard policy missing in fixture');
      }

      sourceGuardPolicy.isolationLevel = 'serializable';
      sourceGuardPolicy.automaticRetryInsideTransaction = true;
      sourceGuardPolicy.retryableFailureCodes = sourceGuardPolicy.retryableFailureCodes.filter(
        (code) => code !== 'lock_timeout'
      );

      const errors = validatePeriodCloseTransactionIsolationPolicies(policies);

      assert(
        errors.some((error) => error.includes('must use read_committed')),
        'validator should keep the explicit read-committed plus row-lock strategy'
      );
      assert(
        errors.some((error) => error.includes('must not retry inside an open database transaction')),
        'validator should reject implicit retries inside one database transaction'
      );
      assert(
        errors.some((error) => error.includes('lock_timeout')),
        'validator should classify lock timeout as retryable outside the transaction'
      );
    }
  },
  {
    name: 'rejects statement snapshot policies that do not verify source hashes before writes',
    run: () => {
      const policies = clonePolicies();
      const statementPolicy = policies.find(
        (policy) => policy.operation === 'financial_statement_snapshot_after_close'
      );

      if (!statementPolicy) {
        throw new Error('statement snapshot policy missing in fixture');
      }

      statementPolicy.steps = statementPolicy.steps.filter((step) => step.kind !== 'validate_source_hash');

      const errors = validatePeriodCloseTransactionIsolationPolicies(policies);

      assert(
        errors.some((error) => error.includes('must validate source hashes')),
        'validator should require statement source-hash validation before snapshot writes'
      );
    }
  }
];

for (const test of tests) {
  test.run();
}
