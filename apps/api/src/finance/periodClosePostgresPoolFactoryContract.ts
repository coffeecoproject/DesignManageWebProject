import {
  createPeriodClosePostgresRuntimeBindingContract,
  validatePeriodClosePostgresRuntimeBindingTrace,
  type PeriodClosePostgresRuntimeBindingResult,
  type PeriodClosePostgresRuntimeBindingStatus
} from './periodClosePostgresRuntimeBindingContract.js';
import type { PeriodCloseNativePostgresPoolLike } from './periodCloseNativePostgresPoolAdapterContract.js';
import type { PeriodClosePostgresClientPortRunInput } from './periodClosePostgresClientPortContract.js';
import type {
  PeriodClosePostgresResolvedSecretEvidence,
  PeriodClosePostgresSecretResolverContract
} from './periodClosePostgresSecretResolverContract.js';

export type PeriodClosePostgresRuntimeEnvironment = 'local' | 'production' | 'staging' | 'test';

export type PeriodClosePostgresPoolRuntimeConfig = {
  applicationName: string;
  backupRestoreEvidenceId?: string;
  connectionTimeoutMs: number;
  database?: string;
  databaseUrl?: string;
  environment: PeriodClosePostgresRuntimeEnvironment;
  host?: string;
  idleTimeoutMs: number;
  maxConnections: number;
  passwordSecretRef?: string;
  port?: number;
  productionApplyApprovalId?: string;
  releaseOwner?: string;
  rollbackOwner?: string;
  sslMode: 'disable' | 'require';
  statementTimeoutMs: number;
  targetDatabaseEvidenceId?: string;
  user?: string;
};

export type PeriodClosePostgresPoolFactoryOptions = {
  application_name: string;
  connectionString?: string;
  connectionTimeoutMillis: number;
  database?: string;
  host?: string;
  idleTimeoutMillis: number;
  max: number;
  port?: number;
  ssl: false | { rejectUnauthorized: true };
  statement_timeout: number;
  user?: string;
};

export type PeriodClosePostgresPoolConstructorOptions = PeriodClosePostgresPoolFactoryOptions & {
  password?: string;
};

export type PeriodClosePostgresPoolConstructorLike = new (
  options: PeriodClosePostgresPoolConstructorOptions
) => PeriodCloseNativePostgresPoolLike;

export type PeriodClosePostgresPoolFactoryStatus =
  | 'config_invalid'
  | 'constructor_failed'
  | 'secret_invalid'
  | PeriodClosePostgresRuntimeBindingStatus;

export type PeriodClosePostgresPoolFactoryEventName =
  | 'construct_pool'
  | 'delegate_runtime_binding'
  | 'receive_config'
  | 'return_response'
  | 'resolve_password_secret'
  | 'validate_config'
  | 'validate_runtime_trace';

export type PeriodClosePostgresPoolFactoryEvent = {
  event: PeriodClosePostgresPoolFactoryEventName;
  environment: PeriodClosePostgresRuntimeEnvironment;
  period: string;
  requestId: string;
  sequence: number;
  transactionId: string;
};

export type PeriodClosePostgresPoolFactoryRunInput = PeriodClosePostgresClientPortRunInput & {
  config: PeriodClosePostgresPoolRuntimeConfig;
};

export type PeriodClosePostgresPoolFactoryResult = {
  configErrors: string[];
  environment: PeriodClosePostgresRuntimeEnvironment;
  factoryEvents: PeriodClosePostgresPoolFactoryEvent[];
  period: string;
  poolOptions?: PeriodClosePostgresPoolFactoryOptions;
  requestId: string;
  requiresPasswordSecret: boolean;
  resolvedSecretEvidence?: PeriodClosePostgresResolvedSecretEvidence;
  runtimeResult?: PeriodClosePostgresRuntimeBindingResult;
  secretErrors: string[];
  status: PeriodClosePostgresPoolFactoryStatus;
  traceErrors: string[];
  transactionId: string;
};

export type PeriodClosePostgresPoolFactoryContract = {
  readFactoryEvents: () => PeriodClosePostgresPoolFactoryEvent[];
  run: (input: PeriodClosePostgresPoolFactoryRunInput) => Promise<PeriodClosePostgresPoolFactoryResult>;
};

function isLocalHost(host: string) {
  return ['127.0.0.1', '::1', 'localhost'].includes(host);
}

function parseUrlHost(databaseUrl: string) {
  const match = /^[a-z]+:\/\/([^/:?#]+)(?::\d+)?(?:[/?#]|$)/i.exec(databaseUrl);

  return match?.[1];
}

function databaseUrlHasRawCredentials(databaseUrl: string) {
  return /^[a-z]+:\/\/[^/@]+@/i.test(databaseUrl);
}

function hasRawPassword(config: PeriodClosePostgresPoolRuntimeConfig) {
  return typeof (config as PeriodClosePostgresPoolRuntimeConfig & { password?: unknown }).password === 'string';
}

export function validatePeriodClosePostgresPoolRuntimeConfig(
  config: PeriodClosePostgresPoolRuntimeConfig
): string[] {
  const errors: string[] = [];
  const hasUrl = Boolean(config.databaseUrl);
  const hasStructuredTarget = Boolean(config.host || config.database || config.user || config.port);
  const localLike = config.environment === 'local' || config.environment === 'test';
  const urlHost = config.databaseUrl ? parseUrlHost(config.databaseUrl) : undefined;
  const targetHost = urlHost ?? config.host;

  if (!config.applicationName.startsWith('startupmanage-period-close')) {
    errors.push('period-close postgres pool applicationName must use startupmanage-period-close prefix');
  }

  if (hasUrl === hasStructuredTarget) {
    errors.push('period-close postgres pool config must use exactly one connection source');
  }

  if (hasRawPassword(config)) {
    errors.push('period-close postgres pool config must not carry raw passwords');
  }

  if (config.databaseUrl && databaseUrlHasRawCredentials(config.databaseUrl)) {
    errors.push('period-close postgres pool databaseUrl must not include raw credentials');
  }

  if (config.passwordSecretRef && !config.passwordSecretRef.startsWith('secret://')) {
    errors.push('period-close postgres pool passwordSecretRef must use secret:// reference');
  }

  if (!Number.isInteger(config.maxConnections) || config.maxConnections < 1 || config.maxConnections > 20) {
    errors.push('period-close postgres pool maxConnections must be an integer between 1 and 20');
  }

  if (config.connectionTimeoutMs < 100 || config.connectionTimeoutMs > 30_000) {
    errors.push('period-close postgres pool connectionTimeoutMs must be between 100 and 30000');
  }

  if (config.idleTimeoutMs < 1_000 || config.idleTimeoutMs > 300_000) {
    errors.push('period-close postgres pool idleTimeoutMs must be between 1000 and 300000');
  }

  if (config.statementTimeoutMs < 500 || config.statementTimeoutMs > 300_000) {
    errors.push('period-close postgres pool statementTimeoutMs must be between 500 and 300000');
  }

  if (localLike && targetHost && !isLocalHost(targetHost)) {
    errors.push('local/test period-close postgres pool config must target localhost only');
  }

  if (config.environment === 'production') {
    if (config.sslMode !== 'require') {
      errors.push('production period-close postgres pool config must require ssl');
    }

    if (!config.passwordSecretRef) {
      errors.push('production period-close postgres pool config requires password secret reference');
    }

    if (!config.targetDatabaseEvidenceId) {
      errors.push('production period-close postgres pool config requires target database evidence');
    }

    if (!config.backupRestoreEvidenceId) {
      errors.push('production period-close postgres pool config requires backup/restore evidence');
    }

    if (!config.releaseOwner || !config.rollbackOwner) {
      errors.push('production period-close postgres pool config requires release and rollback owners');
    }

    if (!config.productionApplyApprovalId) {
      errors.push('production period-close postgres pool config requires production apply approval');
    }
  }

  return errors;
}

export function toPeriodClosePostgresPoolFactoryOptions(
  config: PeriodClosePostgresPoolRuntimeConfig
): PeriodClosePostgresPoolFactoryOptions {
  return {
    ...(config.databaseUrl ? { connectionString: config.databaseUrl } : {}),
    ...(config.database ? { database: config.database } : {}),
    ...(config.host ? { host: config.host } : {}),
    ...(config.port ? { port: config.port } : {}),
    ...(config.user ? { user: config.user } : {}),
    application_name: config.applicationName,
    connectionTimeoutMillis: config.connectionTimeoutMs,
    idleTimeoutMillis: config.idleTimeoutMs,
    max: config.maxConnections,
    ssl: config.sslMode === 'require' ? { rejectUnauthorized: true } : false,
    statement_timeout: config.statementTimeoutMs
  };
}

export function toPeriodClosePostgresPoolConstructorOptions({
  config,
  password
}: {
  config: PeriodClosePostgresPoolRuntimeConfig;
  password?: string;
}): PeriodClosePostgresPoolConstructorOptions {
  return {
    ...toPeriodClosePostgresPoolFactoryOptions(config),
    ...(password ? { password } : {})
  };
}

function eventNames(events: readonly PeriodClosePostgresPoolFactoryEvent[]) {
  return events
    .slice()
    .sort((left, right) => left.sequence - right.sequence)
    .map((event) => event.event);
}

export function validatePeriodClosePostgresPoolFactoryTrace(
  result: PeriodClosePostgresPoolFactoryResult
): string[] {
  const errors = [...result.traceErrors];
  const events = result.factoryEvents.slice().sort((left, right) => left.sequence - right.sequence);
  const names = eventNames(events);
  const receiveIndex = names.indexOf('receive_config');
  const validateIndex = names.indexOf('validate_config');
  const resolveSecretIndex = names.indexOf('resolve_password_secret');
  const constructIndex = names.indexOf('construct_pool');
  const delegateIndex = names.indexOf('delegate_runtime_binding');
  const runtimeValidateIndex = names.indexOf('validate_runtime_trace');
  const returnIndex = names.indexOf('return_response');

  if (receiveIndex !== 0) {
    errors.push(`${result.transactionId} postgres pool factory must receive config first`);
  }

  if (validateIndex <= receiveIndex) {
    errors.push(`${result.transactionId} postgres pool factory must validate config before pool construction`);
  }

  if (result.configErrors.length > 0) {
    if (resolveSecretIndex !== -1 || constructIndex !== -1 || delegateIndex !== -1 || result.runtimeResult) {
      errors.push(
        `${result.transactionId} invalid postgres pool config must not resolve secrets, construct pool, or run runtime binding`
      );
    }
  } else if (result.secretErrors.length > 0) {
    if (constructIndex !== -1 || delegateIndex !== -1 || result.runtimeResult) {
      errors.push(`${result.transactionId} invalid postgres pool secret must not construct pool or run runtime binding`);
    }
  } else {
    if (result.requiresPasswordSecret) {
      if (resolveSecretIndex <= validateIndex) {
        errors.push(`${result.transactionId} postgres pool factory must resolve password secret after config validation`);
      }

      if (!result.resolvedSecretEvidence) {
        errors.push(`${result.transactionId} postgres pool factory must keep redacted secret evidence`);
      }
    } else if (resolveSecretIndex !== -1 || result.resolvedSecretEvidence) {
      errors.push(`${result.transactionId} postgres pool factory must not resolve secrets when no secret ref is configured`);
    }

    if (constructIndex <= validateIndex) {
      errors.push(`${result.transactionId} postgres pool factory must construct pool after config validation`);
    }

    if (result.requiresPasswordSecret && constructIndex <= resolveSecretIndex) {
      errors.push(`${result.transactionId} postgres pool factory must construct pool after password secret resolution`);
    }

    if (delegateIndex <= constructIndex) {
      errors.push(`${result.transactionId} postgres pool factory must delegate to runtime binding after pool construction`);
    }

    if (runtimeValidateIndex <= delegateIndex) {
      errors.push(`${result.transactionId} postgres pool factory must validate runtime binding after delegation`);
    }
  }

  if (returnIndex !== events.length - 1) {
    errors.push(`${result.transactionId} postgres pool factory must return response last`);
  }

  if (events.some((event) => event.environment !== result.environment)) {
    errors.push(`${result.transactionId} postgres pool factory events must keep one runtime environment`);
  }

  if (events.some((event) => event.period !== result.period)) {
    errors.push(`${result.transactionId} postgres pool factory events must keep one accounting period`);
  }

  if (events.some((event) => event.requestId !== result.requestId)) {
    errors.push(`${result.transactionId} postgres pool factory events must keep one request id`);
  }

  if (events.some((event) => event.transactionId !== result.transactionId)) {
    errors.push(`${result.transactionId} postgres pool factory events must keep one transaction id`);
  }

  if (result.poolOptions && Object.hasOwn(result.poolOptions, 'password')) {
    errors.push(`${result.transactionId} postgres pool factory public pool options must not expose password`);
  }

  if (result.runtimeResult) {
    errors.push(...validatePeriodClosePostgresRuntimeBindingTrace(result.runtimeResult));
  }

  return errors;
}

export function createPeriodClosePostgresPoolFactoryContract({
  PoolConstructor,
  secretResolver
}: {
  PoolConstructor: PeriodClosePostgresPoolConstructorLike;
  secretResolver?: PeriodClosePostgresSecretResolverContract;
}): PeriodClosePostgresPoolFactoryContract {
  const factoryEvents: PeriodClosePostgresPoolFactoryEvent[] = [];

  function record({
    event,
    environment,
    period,
    requestId,
    transactionId
  }: Omit<PeriodClosePostgresPoolFactoryEvent, 'sequence'>) {
    factoryEvents.push({
      event,
      environment,
      period,
      requestId,
      sequence: factoryEvents.length + 1,
      transactionId
    });
  }

  function readTransactionEvents(transactionId: string) {
    return factoryEvents
      .filter((event) => event.transactionId === transactionId)
      .map((event) => ({ ...event }));
  }

  return {
    readFactoryEvents: () => factoryEvents.map((event) => ({ ...event })),
    run: async ({ config, operation, period, requestId, statements, transactionId }) => {
      const requiresPasswordSecret = Boolean(config.passwordSecretRef);
      const baseEvent = {
        environment: config.environment,
        period,
        requestId,
        transactionId
      };

      record({ ...baseEvent, event: 'receive_config' });
      record({ ...baseEvent, event: 'validate_config' });

      const configErrors = validatePeriodClosePostgresPoolRuntimeConfig(config);

      if (configErrors.length > 0) {
        record({ ...baseEvent, event: 'return_response' });

        return {
          configErrors,
          environment: config.environment,
          factoryEvents: readTransactionEvents(transactionId),
          period,
          requestId,
          requiresPasswordSecret,
          secretErrors: [],
          status: 'config_invalid',
          traceErrors: [],
          transactionId
        };
      }

      const poolOptions = toPeriodClosePostgresPoolFactoryOptions(config);
      let resolvedPassword: string | undefined;
      let resolvedSecretEvidence: PeriodClosePostgresResolvedSecretEvidence | undefined;
      let secretErrors: string[] = [];

      if (config.passwordSecretRef) {
        record({ ...baseEvent, event: 'resolve_password_secret' });

        if (!secretResolver) {
          secretErrors = ['period-close postgres pool factory requires a secret resolver for passwordSecretRef'];
        } else {
          const secretResult = await secretResolver.resolve({
            environment: config.environment,
            period,
            purpose: 'postgres_password',
            reference: config.passwordSecretRef,
            requestId,
            targetDatabaseEvidenceId: config.targetDatabaseEvidenceId,
            transactionId
          });

          if (secretResult.status === 'resolved') {
            resolvedPassword = secretResult.resolvedValue;
            resolvedSecretEvidence = secretResult.redactedSecretEvidence;
            secretErrors = [...secretResult.traceErrors];
          } else {
            secretErrors = [...secretResult.traceErrors];
          }
        }

        if (secretErrors.length > 0 || !resolvedPassword || !resolvedSecretEvidence) {
          record({ ...baseEvent, event: 'return_response' });

          return {
            configErrors,
            environment: config.environment,
            factoryEvents: readTransactionEvents(transactionId),
            period,
            poolOptions,
            requestId,
            requiresPasswordSecret,
            resolvedSecretEvidence,
            secretErrors,
            status: 'secret_invalid',
            traceErrors: [],
            transactionId
          };
        }
      }

      record({ ...baseEvent, event: 'construct_pool' });

      try {
        const nativePool = new PoolConstructor(
          toPeriodClosePostgresPoolConstructorOptions({ config, password: resolvedPassword })
        );
        const runtimeBinding = createPeriodClosePostgresRuntimeBindingContract({ nativePool });

        record({ ...baseEvent, event: 'delegate_runtime_binding' });

        const runtimeResult = await runtimeBinding.run({ operation, period, requestId, statements, transactionId });

        record({ ...baseEvent, event: 'validate_runtime_trace' });
        record({ ...baseEvent, event: 'return_response' });

        const result: PeriodClosePostgresPoolFactoryResult = {
          configErrors,
          environment: config.environment,
          factoryEvents: readTransactionEvents(transactionId),
          period,
          poolOptions,
          requestId,
          requiresPasswordSecret,
          resolvedSecretEvidence,
          runtimeResult,
          secretErrors,
          status: runtimeResult.status,
          traceErrors: runtimeResult.traceErrors,
          transactionId
        };
        const traceErrors = validatePeriodClosePostgresPoolFactoryTrace(result);

        return {
          ...result,
          status: traceErrors.length > 0 ? 'trace_invalid' : result.status,
          traceErrors
        };
      } catch (error) {
        record({ ...baseEvent, event: 'return_response' });

        return {
          configErrors,
          environment: config.environment,
          factoryEvents: readTransactionEvents(transactionId),
          period,
          poolOptions,
          requestId,
          requiresPasswordSecret,
          resolvedSecretEvidence,
          secretErrors,
          status: 'constructor_failed',
          traceErrors: [error instanceof Error ? error.message : 'postgres pool constructor failed'],
          transactionId
        };
      }
    }
  };
}
