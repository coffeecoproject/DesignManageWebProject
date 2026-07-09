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

export type PeriodCloseSqlDriverStatementName =
  | 'begin'
  | 'set_transaction_isolation'
  | 'lock_accounting_period_for_update'
  | 'select_idempotency_record'
  | 'insert_close_check_snapshot'
  | 'insert_close_event'
  | 'insert_idempotency_record'
  | 'update_accounting_period'
  | 'insert_source_mutation_guard_event'
  | 'commit'
  | 'rollback';

export type PeriodCloseSqlDriverStatement = {
  name: PeriodCloseSqlDriverStatementName;
  parameters: readonly unknown[];
  period?: string;
  sql: string;
  transactionId: string;
};

export type PeriodCloseSqlDriverExecution = PeriodCloseSqlDriverStatement & {
  sequence: number;
};

export type PeriodCloseSqlDriverFailure = {
  code: 'SQL_DRIVER_EXECUTION_FAILED';
  message: string;
  statementName: PeriodCloseSqlDriverStatementName;
  transactionId: string;
};

export type PeriodCloseSqlDriverExecutor = {
  execute: (statement: PeriodCloseSqlDriverStatement) => void;
  readExecutions: () => PeriodCloseSqlDriverExecution[];
};

export type PeriodCloseSqlDriverRepositoryCallResult<
  T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult
> =
  | {
      driverOk: true;
      executions: PeriodCloseSqlDriverExecution[];
      result: PeriodCloseSqlTransactionResult<T>;
    }
  | {
      driverOk: false;
      error: PeriodCloseSqlDriverFailure;
      executions: PeriodCloseSqlDriverExecution[];
    };

export type PeriodCloseSqlDriverRepositoryAdapterContract = {
  closeAccountingPeriod: (input: {
    period: string;
    request: CloseAccountingPeriodRequest;
    transactionId: string;
  }) => PeriodCloseSqlDriverRepositoryCallResult<PersistentCloseAccountingPeriodResult>;
  guardSourceMutation: (input: {
    context: PeriodClosePersistenceContext;
    mutation: PersistentSourceMutationRequest;
    transactionId: string;
  }) => PeriodCloseSqlDriverRepositoryCallResult<PersistentSourceMutationResult>;
  readExecutions: () => PeriodCloseSqlDriverExecution[];
};

const driverControlStatements = new Set<PeriodCloseSqlDriverStatementName>([
  'begin',
  'commit',
  'rollback',
  'set_transaction_isolation'
]);

const destructiveSqlPattern = /\b(drop|truncate|delete|alter\s+table\s+.*\s+drop)\b/i;

function validateDriverStatement(statement: PeriodCloseSqlDriverStatement): string[] {
  const errors: string[] = [];

  if (destructiveSqlPattern.test(statement.sql)) {
    errors.push(`${statement.name} must not execute destructive SQL`);
  }

  if (!driverControlStatements.has(statement.name) && !statement.sql.includes('$1')) {
    errors.push(`${statement.name} must use parameterized SQL placeholders`);
  }

  if (!driverControlStatements.has(statement.name) && statement.parameters.length === 0) {
    errors.push(`${statement.name} must pass parameters separately from SQL text`);
  }

  if (statement.name === 'lock_accounting_period_for_update' && !statement.sql.includes('FOR UPDATE')) {
    errors.push('period lock statement must use FOR UPDATE');
  }

  if (statement.name === 'set_transaction_isolation' && !statement.sql.includes('READ COMMITTED')) {
    errors.push('driver transaction must declare READ COMMITTED isolation');
  }

  return errors;
}

export function createInMemoryPeriodCloseSqlDriverExecutor({
  failOnStatement
}: {
  failOnStatement?: PeriodCloseSqlDriverStatementName;
} = {}): PeriodCloseSqlDriverExecutor {
  const executions: PeriodCloseSqlDriverExecution[] = [];

  return {
    execute: (statement) => {
      const errors = validateDriverStatement(statement);

      if (errors.length > 0) {
        throw new Error(errors.join('; '));
      }

      if (statement.name === failOnStatement) {
        throw new Error(`Simulated SQL driver failure at ${statement.name}`);
      }

      executions.push({
        ...statement,
        parameters: [...statement.parameters],
        sequence: executions.length + 1
      });
    },
    readExecutions: () =>
      executions.map((execution) => ({
        ...execution,
        parameters: [...execution.parameters]
      }))
  };
}

function statement(input: PeriodCloseSqlDriverStatement): PeriodCloseSqlDriverStatement {
  return input;
}

function executeTerminal({
  driver,
  period,
  terminal,
  transactionId
}: {
  driver: PeriodCloseSqlDriverExecutor;
  period?: string;
  terminal: 'commit' | 'rollback';
  transactionId: string;
}) {
  driver.execute(
    statement({
      name: terminal,
      parameters: [],
      ...(period ? { period } : {}),
      sql: terminal === 'commit' ? 'COMMIT;' : 'ROLLBACK;',
      transactionId
    })
  );
}

function executeTransactionStart({
  driver,
  period,
  transactionId
}: {
  driver: PeriodCloseSqlDriverExecutor;
  period: string;
  transactionId: string;
}) {
  driver.execute(
    statement({
      name: 'begin',
      parameters: [],
      period,
      sql: 'BEGIN;',
      transactionId
    })
  );
  driver.execute(
    statement({
      name: 'set_transaction_isolation',
      parameters: [],
      period,
      sql: 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED;',
      transactionId
    })
  );
  driver.execute(
    statement({
      name: 'lock_accounting_period_for_update',
      parameters: [period],
      period,
      sql: 'SELECT "period", "status", "version" FROM "accounting_periods" WHERE "period" = $1 FOR UPDATE;',
      transactionId
    })
  );
}

function readTransactionExecutions({
  driver,
  transactionId
}: {
  driver: PeriodCloseSqlDriverExecutor;
  transactionId: string;
}) {
  return driver.readExecutions().filter((execution) => execution.transactionId === transactionId);
}

function toDriverFailure({
  error,
  statementName,
  transactionId
}: {
  error: unknown;
  statementName: PeriodCloseSqlDriverStatementName;
  transactionId: string;
}): PeriodCloseSqlDriverFailure {
  return {
    code: 'SQL_DRIVER_EXECUTION_FAILED',
    message: error instanceof Error ? error.message : String(error),
    statementName,
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

export function createPeriodCloseSqlDriverRepositoryAdapterContract({
  driver,
  repository
}: {
  driver: PeriodCloseSqlDriverExecutor;
  repository: PeriodCloseSqlRepository;
}): PeriodCloseSqlDriverRepositoryAdapterContract {
  return {
    closeAccountingPeriod: ({ period, request, transactionId }) => {
      try {
        executeTransactionStart({ driver, period, transactionId });
        driver.execute(
          statement({
            name: 'select_idempotency_record',
            parameters: [period, 'close', request.idempotencyKey],
            period,
            sql:
              'SELECT "period", "operation", "idempotency_key" FROM "accounting_period_idempotency_records" WHERE "period" = $1 AND "operation" = $2 AND "idempotency_key" = $3;',
            transactionId
          })
        );

        const result = closeAccountingPeriodWithSqlRepositoryTransaction({
          period,
          repository,
          request,
          transactionId
        });

        if (result.ok) {
          driver.execute(
            statement({
              name: 'insert_close_check_snapshot',
              parameters: [period, request.requestId],
              period,
              sql: 'INSERT INTO "accounting_period_close_checks" ("period", "request_id") VALUES ($1, $2);',
              transactionId
            })
          );
          driver.execute(
            statement({
              name: 'insert_close_event',
              parameters: [period, request.requestId],
              period,
              sql: 'INSERT INTO "accounting_period_events" ("period", "request_id") VALUES ($1, $2);',
              transactionId
            })
          );
          driver.execute(
            statement({
              name: 'insert_idempotency_record',
              parameters: [period, 'close', request.idempotencyKey],
              period,
              sql:
                'INSERT INTO "accounting_period_idempotency_records" ("period", "operation", "idempotency_key") VALUES ($1, $2, $3) ON CONFLICT ("period", "operation", "idempotency_key") DO NOTHING;',
              transactionId
            })
          );
          driver.execute(
            statement({
              name: 'update_accounting_period',
              parameters: [period, request.version],
              period,
              sql: 'UPDATE "accounting_periods" SET "version" = "version" + 1 WHERE "period" = $1 AND "version" = $2;',
              transactionId
            })
          );
          executeTerminal({ driver, period, terminal: 'commit', transactionId });
        } else {
          executeTerminal({ driver, period, terminal: 'rollback', transactionId });
        }

        return {
          driverOk: true,
          executions: readTransactionExecutions({ driver, transactionId }),
          result
        };
      } catch (error) {
        const failedStatement = driver.readExecutions().some((execution) => execution.transactionId === transactionId)
          ? 'rollback'
          : 'begin';

        try {
          executeTerminal({ driver, period, terminal: 'rollback', transactionId });
        } catch {
          // The original driver failure is the actionable failure for this contract.
        }

        return {
          driverOk: false,
          error: toDriverFailure({
            error,
            statementName: failedStatement,
            transactionId
          }),
          executions: readTransactionExecutions({ driver, transactionId })
        };
      }
    },
    guardSourceMutation: ({ context, mutation, transactionId }) => {
      const period = resolveMutationPeriod({ mutation, repository });

      if (!period) {
        const result = applyFinanceSourceMutationWithSqlRepositoryTransaction({
          context,
          mutation,
          repository,
          transactionId
        });

        return {
          driverOk: true,
          executions: readTransactionExecutions({ driver, transactionId }),
          result
        };
      }

      try {
        executeTransactionStart({ driver, period, transactionId });
        driver.execute(
          statement({
            name: 'insert_source_mutation_guard_event',
            parameters: [period, mutation.sourceArea, mutation.sourceId, context.requestId],
            period,
            sql:
              'INSERT INTO "accounting_period_source_mutation_events" ("period", "source_area", "source_id", "request_id") VALUES ($1, $2, $3, $4);',
            transactionId
          })
        );

        const result = applyFinanceSourceMutationWithSqlRepositoryTransaction({
          context,
          mutation,
          repository,
          transactionId
        });

        executeTerminal({ driver, period, terminal: result.ok ? 'commit' : 'rollback', transactionId });

        return {
          driverOk: true,
          executions: readTransactionExecutions({ driver, transactionId }),
          result
        };
      } catch (error) {
        try {
          executeTerminal({ driver, period, terminal: 'rollback', transactionId });
        } catch {
          // The original driver failure is the actionable failure for this contract.
        }

        return {
          driverOk: false,
          error: toDriverFailure({
            error,
            statementName: 'rollback',
            transactionId
          }),
          executions: readTransactionExecutions({ driver, transactionId })
        };
      }
    },
    readExecutions: () => driver.readExecutions()
  };
}

export function validatePeriodCloseSqlDriverExecutions(
  executions: readonly PeriodCloseSqlDriverExecution[]
): string[] {
  const errors: string[] = [];
  const transactionIds = [...new Set(executions.map((execution) => execution.transactionId))];

  for (const transactionId of transactionIds) {
    const transactionExecutions = executions
      .filter((execution) => execution.transactionId === transactionId)
      .sort((left, right) => left.sequence - right.sequence);
    const statementNames = transactionExecutions.map((execution) => execution.name);
    const beginIndex = statementNames.indexOf('begin');
    const isolationIndex = statementNames.indexOf('set_transaction_isolation');
    const lockIndex = statementNames.indexOf('lock_accounting_period_for_update');
    const commitIndex = statementNames.lastIndexOf('commit');
    const rollbackIndex = statementNames.lastIndexOf('rollback');
    const terminalIndex = Math.max(commitIndex, rollbackIndex);

    if (beginIndex !== 0) {
      errors.push(`${transactionId} must start with BEGIN`);
    }

    if (isolationIndex <= beginIndex) {
      errors.push(`${transactionId} must set isolation after BEGIN`);
    }

    if (lockIndex <= isolationIndex) {
      errors.push(`${transactionId} must lock accounting_periods after isolation is set`);
    }

    if (commitIndex !== -1 && rollbackIndex !== -1) {
      errors.push(`${transactionId} must not both COMMIT and ROLLBACK`);
    }

    if (terminalIndex !== transactionExecutions.length - 1) {
      errors.push(`${transactionId} must not execute SQL after terminal statement`);
    }

    for (const execution of transactionExecutions) {
      errors.push(...validateDriverStatement(execution));
    }

    const sourceGuardIndex = statementNames.indexOf('insert_source_mutation_guard_event');

    if (sourceGuardIndex !== -1 && sourceGuardIndex <= lockIndex) {
      errors.push(`${transactionId} must write source guard audit after period lock`);
    }

    const updatePeriodIndex = statementNames.indexOf('update_accounting_period');

    if (updatePeriodIndex !== -1 && updatePeriodIndex <= lockIndex) {
      errors.push(`${transactionId} must update accounting period after period lock`);
    }
  }

  return errors;
}
