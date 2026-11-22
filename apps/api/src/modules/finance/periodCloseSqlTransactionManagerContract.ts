import {
  applyFinanceSourceMutationWithSqlRepositoryTransaction,
  closeAccountingPeriodWithSqlRepositoryTransaction,
  type PeriodCloseSqlRepository,
  type PeriodCloseSqlTransactionResult
} from './periodCloseSqlRepositoryContract.js';
import type { CloseAccountingPeriodRequest } from './periodCloseContract.js';
import type {
  PeriodClosePersistenceContext,
  PersistentCloseAccountingPeriodResult,
  PersistentSourceMutationRequest,
  PersistentSourceMutationResult
} from './periodClosePersistenceContract.js';

export type PeriodCloseSqlIsolationLevel = 'read_committed';

export type PeriodCloseSqlTransactionTraceStage =
  | 'begin'
  | 'set_transaction_isolation'
  | 'lock_accounting_period_for_update'
  | 'check_period_idempotency'
  | 'validate_expected_period_version'
  | 'guard_source_mutation_before_source_write'
  | 'execute_domain_handler'
  | 'validate_row_contract'
  | 'commit'
  | 'rollback';

export type PeriodCloseSqlTransactionTraceEvent = {
  period?: string;
  sqlFragment: string;
  stage: PeriodCloseSqlTransactionTraceStage;
  transactionId: string;
};

export type PeriodCloseManagedSqlTransactionResult<T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult> = {
  result: PeriodCloseSqlTransactionResult<T>;
  trace: PeriodCloseSqlTransactionTraceEvent[];
};

export type PeriodCloseSqlTransactionManagerContract = {
  closeAccountingPeriod: (input: {
    period: string;
    request: CloseAccountingPeriodRequest;
    transactionId: string;
  }) => PeriodCloseManagedSqlTransactionResult<PersistentCloseAccountingPeriodResult>;
  guardSourceMutation: (input: {
    context: PeriodClosePersistenceContext;
    mutation: PersistentSourceMutationRequest;
    transactionId: string;
  }) => PeriodCloseManagedSqlTransactionResult<PersistentSourceMutationResult>;
  isolationLevel: PeriodCloseSqlIsolationLevel;
  readTrace: () => PeriodCloseSqlTransactionTraceEvent[];
};

function createTraceEvent({
  period,
  sqlFragment,
  stage,
  transactionId
}: PeriodCloseSqlTransactionTraceEvent): PeriodCloseSqlTransactionTraceEvent {
  return {
    ...(period ? { period } : {}),
    sqlFragment,
    stage,
    transactionId
  };
}

function resolveMutationPeriod({
  mutation,
  repository
}: {
  mutation: PersistentSourceMutationRequest;
  repository: PeriodCloseSqlRepository;
}) {
  const sourceRecord = repository
    .readDatabaseSnapshot()
    .sourceRecords.find((record) => record.id === mutation.sourceId && record.sourceArea === mutation.sourceArea);

  return mutation.targetAccountingPeriod ?? sourceRecord?.accountingPeriod;
}

export function createPeriodCloseSqlTransactionManagerContract({
  repository
}: {
  repository: PeriodCloseSqlRepository;
}): PeriodCloseSqlTransactionManagerContract {
  const trace: PeriodCloseSqlTransactionTraceEvent[] = [];
  const isolationLevel: PeriodCloseSqlIsolationLevel = 'read_committed';

  function record(event: PeriodCloseSqlTransactionTraceEvent) {
    trace.push(event);
  }

  function recordTransactionStart({
    period,
    transactionId
  }: {
    period?: string;
    transactionId: string;
  }) {
    record(
      createTraceEvent({
        period,
        sqlFragment: 'BEGIN;',
        stage: 'begin',
        transactionId
      })
    );
    record(
      createTraceEvent({
        period,
        sqlFragment: 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED;',
        stage: 'set_transaction_isolation',
        transactionId
      })
    );

    if (period) {
      record(
        createTraceEvent({
          period,
          sqlFragment: 'SELECT "period", "status", "version" FROM "accounting_periods" WHERE "period" = $1 FOR UPDATE;',
          stage: 'lock_accounting_period_for_update',
          transactionId
        })
      );
    }
  }

  function recordClosePreconditions({
    period,
    transactionId
  }: {
    period: string;
    transactionId: string;
  }) {
    record(
      createTraceEvent({
        period,
        sqlFragment:
          'SELECT "period", "operation", "idempotency_key" FROM "accounting_period_idempotency_records" WHERE "period" = $1 AND "operation" = $2 AND "idempotency_key" = $3;',
        stage: 'check_period_idempotency',
        transactionId
      })
    );
    record(
      createTraceEvent({
        period,
        sqlFragment: 'Validate expected accounting_periods.version after the row lock is held.',
        stage: 'validate_expected_period_version',
        transactionId
      })
    );
  }

  function recordDomainAndRowValidation({
    period,
    transactionId
  }: {
    period?: string;
    transactionId: string;
  }) {
    record(
      createTraceEvent({
        period,
        sqlFragment: 'Execute period-close domain mutation inside the open SQL transaction.',
        stage: 'execute_domain_handler',
        transactionId
      })
    );
    record(
      createTraceEvent({
        period,
        sqlFragment: 'Validate period-close row contract before committing the SQL transaction.',
        stage: 'validate_row_contract',
        transactionId
      })
    );
  }

  function recordTerminal({
    ok,
    period,
    transactionId
  }: {
    ok: boolean;
    period?: string;
    transactionId: string;
  }) {
    record(
      createTraceEvent({
        period,
        sqlFragment: ok ? 'COMMIT;' : 'ROLLBACK;',
        stage: ok ? 'commit' : 'rollback',
        transactionId
      })
    );
  }

  return {
    closeAccountingPeriod: ({ period, request, transactionId }) => {
      recordTransactionStart({ period, transactionId });
      recordClosePreconditions({ period, transactionId });
      recordDomainAndRowValidation({ period, transactionId });

      try {
        const result = closeAccountingPeriodWithSqlRepositoryTransaction({
          period,
          repository,
          request,
          transactionId
        });

        recordTerminal({ ok: result.ok, period, transactionId });

        return {
          result,
          trace: trace.filter((event) => event.transactionId === transactionId)
        };
      } catch (error) {
        recordTerminal({ ok: false, period, transactionId });
        throw error;
      }
    },
    guardSourceMutation: ({ context, mutation, transactionId }) => {
      const period = resolveMutationPeriod({ mutation, repository });

      recordTransactionStart({ period, transactionId });

      if (period) {
        record(
          createTraceEvent({
            period,
            sqlFragment:
              'Reject closed accounting periods and append accounting_period_source_mutation_events before source row mutation.',
            stage: 'guard_source_mutation_before_source_write',
            transactionId
          })
        );
      }

      recordDomainAndRowValidation({ period, transactionId });

      try {
        const result = applyFinanceSourceMutationWithSqlRepositoryTransaction({
          context,
          mutation,
          repository,
          transactionId
        });

        recordTerminal({ ok: result.ok, period, transactionId });

        return {
          result,
          trace: trace.filter((event) => event.transactionId === transactionId)
        };
      } catch (error) {
        recordTerminal({ ok: false, period, transactionId });
        throw error;
      }
    },
    isolationLevel,
    readTrace: () => trace.map((event) => ({ ...event }))
  };
}

export function validatePeriodCloseSqlTransactionTrace(
  trace: readonly PeriodCloseSqlTransactionTraceEvent[]
): string[] {
  const errors: string[] = [];
  const transactionIds = [...new Set(trace.map((event) => event.transactionId))];

  for (const transactionId of transactionIds) {
    const events = trace.filter((event) => event.transactionId === transactionId);
    const stages = events.map((event) => event.stage);
    const beginIndex = stages.indexOf('begin');
    const isolationIndex = stages.indexOf('set_transaction_isolation');
    const lockIndex = stages.indexOf('lock_accounting_period_for_update');
    const executeIndex = stages.indexOf('execute_domain_handler');
    const validateIndex = stages.indexOf('validate_row_contract');
    const commitCount = stages.filter((stage) => stage === 'commit').length;
    const rollbackCount = stages.filter((stage) => stage === 'rollback').length;
    const terminalIndex = Math.max(stages.lastIndexOf('commit'), stages.lastIndexOf('rollback'));

    if (beginIndex !== 0) {
      errors.push(`${transactionId} must begin with BEGIN`);
    }

    if (isolationIndex <= beginIndex) {
      errors.push(`${transactionId} must set isolation after BEGIN`);
    }

    if (lockIndex !== -1 && lockIndex <= isolationIndex) {
      errors.push(`${transactionId} must lock accounting_periods after isolation is set`);
    }

    if (executeIndex === -1) {
      errors.push(`${transactionId} must execute the domain handler inside the transaction`);
    }

    if (validateIndex <= executeIndex) {
      errors.push(`${transactionId} must validate rows after the domain handler`);
    }

    if (commitCount + rollbackCount !== 1) {
      errors.push(`${transactionId} must end with exactly one COMMIT or ROLLBACK`);
    }

    if (terminalIndex !== events.length - 1) {
      errors.push(`${transactionId} must not emit SQL work after COMMIT or ROLLBACK`);
    }

    if (!events.some((event) => event.sqlFragment.includes('SET TRANSACTION ISOLATION LEVEL READ COMMITTED'))) {
      errors.push(`${transactionId} must declare READ COMMITTED isolation explicitly`);
    }

    if (events.some((event) => event.stage === 'lock_accounting_period_for_update')) {
      const lockEvent = events.find((event) => event.stage === 'lock_accounting_period_for_update');

      if (!lockEvent?.sqlFragment.includes('FOR UPDATE')) {
        errors.push(`${transactionId} period lock must use SELECT ... FOR UPDATE`);
      }
    }

    if (stages.includes('guard_source_mutation_before_source_write')) {
      const guardIndex = stages.indexOf('guard_source_mutation_before_source_write');

      if (lockIndex === -1 || guardIndex <= lockIndex || executeIndex <= guardIndex) {
        errors.push(`${transactionId} source mutation guard must run after period lock and before source write`);
      }
    }
  }

  return errors;
}
