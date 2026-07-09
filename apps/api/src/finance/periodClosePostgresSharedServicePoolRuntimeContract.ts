import type { CloseAccountingPeriodRequest } from './periodCloseContract.js';
import {
  validatePeriodClosePostgresDependencyAdmission,
  evaluatePeriodClosePostgresDependencyAdmission,
  type PeriodClosePostgresDependencyAdmissionInput,
  type PeriodClosePostgresDependencyAdmissionResult
} from './periodClosePostgresDependencyAdmissionContract.js';
import type { PeriodClosePostgresPoolPort } from './periodClosePostgresClientPortContract.js';
import {
  createPeriodCloseNativePostgresPoolAdapterContract,
  type PeriodCloseNativePostgresPoolAdapterEvent,
  type PeriodCloseNativePostgresPoolLike
} from './periodCloseNativePostgresPoolAdapterContract.js';
import type { PeriodClosePostgresRuntimeModuleLoader } from './periodClosePostgresRuntimeImportContract.js';
import {
  toPeriodClosePostgresPoolConstructorOptions,
  validatePeriodClosePostgresPoolRuntimeConfig,
  type PeriodClosePostgresPoolConstructorLike,
  type PeriodClosePostgresPoolRuntimeConfig
} from './periodClosePostgresPoolFactoryContract.js';
import {
  derivePeriodClosePostgresRuntimeReadiness,
  type PeriodClosePostgresRuntimeReadinessPackage,
  type PeriodClosePostgresRuntimeReadinessResult
} from './periodClosePostgresRuntimeReadinessPackageContract.js';
import type {
  PeriodClosePostgresResolvedSecretEvidence,
  PeriodClosePostgresSecretResolverContract
} from './periodClosePostgresSecretResolverContract.js';
import {
  type PeriodCloseServiceAtomicCommitBoundaryContract,
  type PeriodCloseServiceAtomicCommitBoundaryResult,
  type PeriodCloseServiceAtomicCommitStatus
} from './periodCloseServiceAtomicCommitBoundaryContract.js';
import type {
  PeriodClosePersistenceContext,
  PersistentCloseAccountingPeriodResult,
  PersistentSourceMutationRequest,
  PersistentSourceMutationResult
} from './periodClosePersistenceContract.js';

export type PeriodClosePostgresSharedServicePoolRuntimeStatus =
  | 'admission_invalid'
  | 'config_invalid'
  | 'constructor_failed'
  | 'loader_failed'
  | 'module_invalid'
  | 'readiness_blocked'
  | 'secret_invalid'
  | PeriodCloseServiceAtomicCommitStatus;

export type PeriodClosePostgresSharedServicePoolRuntimeEventName =
  | 'construct_shared_pool'
  | 'create_service_boundary'
  | 'delegate_service_atomic_boundary'
  | 'derive_runtime_readiness'
  | 'evaluate_dependency_admission'
  | 'import_pg_module'
  | 'receive_request'
  | 'resolve_password_secret'
  | 'return_response'
  | 'validate_dependency_admission'
  | 'validate_pg_module'
  | 'validate_runtime_config'
  | 'validate_runtime_readiness'
  | 'validate_service_atomic_trace';

export type PeriodClosePostgresSharedServicePoolRuntimeEvent = {
  event: PeriodClosePostgresSharedServicePoolRuntimeEventName;
  operation: 'close_accounting_period' | 'guard_source_mutation';
  period?: string;
  requestId: string;
  sequence: number;
  transactionId: string;
};

export type PeriodClosePostgresSharedServicePoolRuntimeAdmissionInput = Omit<
  PeriodClosePostgresDependencyAdmissionInput,
  'runtimeEvidence'
> & {
  readinessPackage: PeriodClosePostgresRuntimeReadinessPackage;
};

export type PeriodClosePostgresSharedServicePoolRuntimeResult<
  T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult
> = {
  adapterEvents: PeriodCloseNativePostgresPoolAdapterEvent[];
  admissionErrors: string[];
  configErrors: string[];
  constructorErrors: string[];
  dependencyAdmission: PeriodClosePostgresDependencyAdmissionResult;
  events: PeriodClosePostgresSharedServicePoolRuntimeEvent[];
  importErrors: string[];
  operation: 'close_accounting_period' | 'guard_source_mutation';
  period?: string;
  readiness: PeriodClosePostgresRuntimeReadinessResult;
  requestId: string;
  resolvedSecretEvidence?: PeriodClosePostgresResolvedSecretEvidence;
  secretErrors: string[];
  serviceResult?: PeriodCloseServiceAtomicCommitBoundaryResult<T>;
  status: PeriodClosePostgresSharedServicePoolRuntimeStatus;
  traceErrors: string[];
  transactionId: string;
};

export type PeriodClosePostgresSharedServicePoolRuntimeContract = {
  closeAccountingPeriod: (input: {
    admission: PeriodClosePostgresSharedServicePoolRuntimeAdmissionInput;
    period: string;
    request: CloseAccountingPeriodRequest;
  }) => Promise<PeriodClosePostgresSharedServicePoolRuntimeResult<PersistentCloseAccountingPeriodResult>>;
  guardSourceMutation: (input: {
    admission: PeriodClosePostgresSharedServicePoolRuntimeAdmissionInput;
    context: PeriodClosePersistenceContext;
    mutation: PersistentSourceMutationRequest;
  }) => Promise<PeriodClosePostgresSharedServicePoolRuntimeResult<PersistentSourceMutationResult>>;
  readEvents: () => PeriodClosePostgresSharedServicePoolRuntimeEvent[];
};

export type PeriodClosePostgresSharedServiceBoundaryFactory = (input: {
  pool: PeriodClosePostgresPoolPort;
}) => PeriodCloseServiceAtomicCommitBoundaryContract;

function buildTransactionId({
  operation,
  requestId
}: {
  operation: 'close_accounting_period' | 'guard_source_mutation';
  requestId: string;
}) {
  return `${requestId}:${operation}:postgres-shared-service-pool-runtime`;
}

function statusFromEarlyFailure({
  admissionErrors,
  configErrors,
  constructorErrors,
  importErrors,
  readiness,
  secretErrors
}: {
  admissionErrors: readonly string[];
  configErrors: readonly string[];
  constructorErrors: readonly string[];
  importErrors: readonly string[];
  readiness: PeriodClosePostgresRuntimeReadinessResult;
  secretErrors: readonly string[];
}): PeriodClosePostgresSharedServicePoolRuntimeStatus | undefined {
  if (readiness.status !== 'ready' || !readiness.poolConfig) {
    return 'readiness_blocked';
  }

  if (admissionErrors.length > 0) {
    return 'admission_invalid';
  }

  if (configErrors.length > 0) {
    return 'config_invalid';
  }

  if (importErrors.length > 0) {
    return importErrors.some((error) => error.includes('Pool constructor')) ? 'module_invalid' : 'loader_failed';
  }

  if (secretErrors.length > 0) {
    return 'secret_invalid';
  }

  if (constructorErrors.length > 0) {
    return 'constructor_failed';
  }

  return undefined;
}

function eventNames(events: readonly PeriodClosePostgresSharedServicePoolRuntimeEvent[]) {
  return events
    .slice()
    .sort((left, right) => left.sequence - right.sequence)
    .map((event) => event.event);
}

function isPoolConstructor(value: unknown): value is PeriodClosePostgresPoolConstructorLike {
  return typeof value === 'function';
}

function resolvePoolConstructor(moduleLike: { default?: unknown; Pool?: unknown }) {
  const defaultExport = moduleLike.default;
  const defaultPool =
    typeof defaultExport === 'object' && defaultExport !== null
      ? (defaultExport as { Pool?: unknown }).Pool
      : undefined;
  const PoolConstructor = moduleLike.Pool ?? defaultPool;

  if (!isPoolConstructor(PoolConstructor)) {
    return {
      importErrors: ['period-close shared service pool runtime must load a pg module with a Pool constructor']
    };
  }

  return {
    importErrors: [],
    PoolConstructor
  };
}

export function validatePeriodClosePostgresSharedServicePoolRuntimeTrace<
  T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult
>(result: PeriodClosePostgresSharedServicePoolRuntimeResult<T>): string[] {
  const errors = [...result.traceErrors];
  const events = result.events.slice().sort((left, right) => left.sequence - right.sequence);
  const names = eventNames(events);
  const receiveIndex = names.indexOf('receive_request');
  const deriveIndex = names.indexOf('derive_runtime_readiness');
  const readinessIndex = names.indexOf('validate_runtime_readiness');
  const dependencyIndex = names.indexOf('evaluate_dependency_admission');
  const admissionIndex = names.indexOf('validate_dependency_admission');
  const configIndex = names.indexOf('validate_runtime_config');
  const importIndex = names.indexOf('import_pg_module');
  const moduleIndex = names.indexOf('validate_pg_module');
  const secretIndex = names.indexOf('resolve_password_secret');
  const constructIndex = names.indexOf('construct_shared_pool');
  const factoryIndex = names.indexOf('create_service_boundary');
  const serviceIndex = names.indexOf('delegate_service_atomic_boundary');
  const serviceValidateIndex = names.indexOf('validate_service_atomic_trace');
  const returnIndex = names.indexOf('return_response');

  if (receiveIndex !== 0) {
    errors.push(`${result.transactionId} shared service pool runtime must receive request first`);
  }

  if (deriveIndex <= receiveIndex || readinessIndex <= deriveIndex) {
    errors.push(`${result.transactionId} shared service pool runtime must derive and validate readiness before admission`);
  }

  if (dependencyIndex <= readinessIndex || admissionIndex <= dependencyIndex) {
    errors.push(`${result.transactionId} shared service pool runtime must evaluate and validate dependency admission`);
  }

  if (
    result.readiness.status !== 'ready' ||
    result.admissionErrors.length > 0 ||
    result.configErrors.length > 0 ||
    result.importErrors.length > 0 ||
    result.secretErrors.length > 0 ||
    result.constructorErrors.length > 0
  ) {
    if (
      (result.constructorErrors.length === 0 && constructIndex !== -1) ||
      factoryIndex !== -1 ||
      serviceIndex !== -1 ||
      serviceValidateIndex !== -1 ||
      result.serviceResult
    ) {
      errors.push(`${result.transactionId} blocked shared service pool runtime must not construct a pool or enter service work`);
    }
  } else {
    if (configIndex <= admissionIndex) {
      errors.push(`${result.transactionId} shared service pool runtime must validate config after dependency admission`);
    }

    if (importIndex <= configIndex || moduleIndex <= importIndex) {
      errors.push(`${result.transactionId} shared service pool runtime must import and validate pg before pool construction`);
    }

    if (secretIndex !== -1 && secretIndex <= moduleIndex) {
      errors.push(`${result.transactionId} shared service pool runtime must resolve secrets after pg module validation`);
    }

    const constructionGateIndex = secretIndex === -1 ? moduleIndex : secretIndex;

    if (constructIndex <= constructionGateIndex) {
      errors.push(`${result.transactionId} shared service pool runtime must construct shared pool after runtime gates`);
    }

    if (factoryIndex <= constructIndex || serviceIndex <= factoryIndex || serviceValidateIndex <= serviceIndex) {
      errors.push(`${result.transactionId} shared service pool runtime must hand the shared pool to service before validation`);
    }

    if (!result.serviceResult) {
      errors.push(`${result.transactionId} shared service pool runtime must keep service result after delegation`);
    }
  }

  if (returnIndex !== events.length - 1) {
    errors.push(`${result.transactionId} shared service pool runtime must return response last`);
  }

  if (events.some((event) => event.operation !== result.operation)) {
    errors.push(`${result.transactionId} shared service pool runtime events must keep one operation`);
  }

  if (events.some((event) => event.requestId !== result.requestId)) {
    errors.push(`${result.transactionId} shared service pool runtime events must keep one request id`);
  }

  if (events.some((event) => event.transactionId !== result.transactionId)) {
    errors.push(`${result.transactionId} shared service pool runtime events must keep one transaction id`);
  }

  if (result.resolvedSecretEvidence && Object.values(result.resolvedSecretEvidence).some((value) => String(value).includes('resolved-production-secret'))) {
    errors.push(`${result.transactionId} shared service pool runtime must not expose raw secret values`);
  }

  errors.push(...validatePeriodClosePostgresDependencyAdmission(result.dependencyAdmission));

  if (result.serviceResult) {
    errors.push(...result.serviceResult.traceErrors);

    if (result.status !== result.serviceResult.status) {
      errors.push(`${result.transactionId} shared service pool runtime status must mirror service status`);
    }
  }

  return errors;
}

export function createPeriodClosePostgresSharedServicePoolRuntimeContract({
  createServiceBoundary,
  loadPgModule,
  secretResolver
}: {
  createServiceBoundary: PeriodClosePostgresSharedServiceBoundaryFactory;
  loadPgModule: PeriodClosePostgresRuntimeModuleLoader;
  secretResolver?: PeriodClosePostgresSecretResolverContract;
}): PeriodClosePostgresSharedServicePoolRuntimeContract {
  const events: PeriodClosePostgresSharedServicePoolRuntimeEvent[] = [];

  function record({
    event,
    operation,
    period,
    requestId,
    transactionId
  }: Omit<PeriodClosePostgresSharedServicePoolRuntimeEvent, 'sequence'>) {
    events.push({
      event,
      operation,
      ...(period ? { period } : {}),
      requestId,
      sequence: events.length + 1,
      transactionId
    });
  }

  function readEvents(transactionId: string) {
    return events
      .filter((event) => event.transactionId === transactionId)
      .map((event) => ({ ...event }));
  }

  async function resolveSecret({
    config,
    period,
    requestId,
    transactionId
  }: {
    config: PeriodClosePostgresPoolRuntimeConfig;
    period: string;
    requestId: string;
    transactionId: string;
  }) {
    if (!config.passwordSecretRef) {
      return {
        secretErrors: []
      };
    }

    if (!secretResolver) {
      return {
        secretErrors: ['period-close shared service pool runtime requires a secret resolver for passwordSecretRef']
      };
    }

    const result = await secretResolver.resolve({
      environment: config.environment,
      period,
      purpose: 'postgres_password',
      reference: config.passwordSecretRef,
      requestId,
      targetDatabaseEvidenceId: config.targetDatabaseEvidenceId,
      transactionId
    });

    if (result.status !== 'resolved') {
      return {
        secretErrors: [...result.traceErrors]
      };
    }

    return {
      resolvedPassword: result.resolvedValue,
      resolvedSecretEvidence: result.redactedSecretEvidence,
      secretErrors: [...result.traceErrors]
    };
  }

  async function run<T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult>({
    admission,
    operation,
    period,
    requestId,
    runService,
    transactionId
  }: {
    admission: PeriodClosePostgresSharedServicePoolRuntimeAdmissionInput;
    operation: 'close_accounting_period' | 'guard_source_mutation';
    period: string;
    requestId: string;
    runService: (serviceBoundary: PeriodCloseServiceAtomicCommitBoundaryContract) => Promise<PeriodCloseServiceAtomicCommitBoundaryResult<T>>;
    transactionId: string;
  }): Promise<PeriodClosePostgresSharedServicePoolRuntimeResult<T>> {
    record({ event: 'receive_request', operation, period, requestId, transactionId });
    record({ event: 'derive_runtime_readiness', operation, period, requestId, transactionId });

    const readiness = derivePeriodClosePostgresRuntimeReadiness(admission.readinessPackage);

    record({ event: 'validate_runtime_readiness', operation, period, requestId, transactionId });
    record({ event: 'evaluate_dependency_admission', operation, period, requestId, transactionId });

    const dependencyAdmission = evaluatePeriodClosePostgresDependencyAdmission({
      apiPackageManifest: admission.apiPackageManifest,
      apiPackageManifestPath: admission.apiPackageManifestPath,
      lockfilePath: admission.lockfilePath,
      lockfileText: admission.lockfileText,
      runtimeEvidence: readiness.runtimeEvidence
    });

    record({ event: 'validate_dependency_admission', operation, period, requestId, transactionId });

    const admissionErrors = validatePeriodClosePostgresDependencyAdmission(dependencyAdmission);
    let configErrors: string[] = [];
    let constructorErrors: string[] = [];
    let importErrors: string[] = [];
    let secretErrors: string[] = [];
    let resolvedPassword: string | undefined;
    let resolvedSecretEvidence: PeriodClosePostgresResolvedSecretEvidence | undefined;
    let adapterEvents: PeriodCloseNativePostgresPoolAdapterEvent[] = [];
    let serviceResult: PeriodCloseServiceAtomicCommitBoundaryResult<T> | undefined;

    if (readiness.status === 'ready' && readiness.poolConfig && admissionErrors.length === 0) {
      record({ event: 'validate_runtime_config', operation, period, requestId, transactionId });
      configErrors = validatePeriodClosePostgresPoolRuntimeConfig(readiness.poolConfig);
    }

    if (readiness.status === 'ready' && readiness.poolConfig && admissionErrors.length === 0 && configErrors.length === 0) {
      record({ event: 'import_pg_module', operation, period, requestId, transactionId });

      let pgModule: Awaited<ReturnType<PeriodClosePostgresRuntimeModuleLoader>> | undefined;

      try {
        pgModule = await loadPgModule();
      } catch (error) {
        importErrors = [error instanceof Error ? error.message : 'period-close shared service pool runtime module import failed'];
      }

      if (pgModule) {
        record({ event: 'validate_pg_module', operation, period, requestId, transactionId });
        const resolvedConstructor = resolvePoolConstructor(pgModule);

        importErrors = resolvedConstructor.importErrors;

        if (resolvedConstructor.PoolConstructor && importErrors.length === 0) {
          if (readiness.poolConfig.passwordSecretRef) {
            record({ event: 'resolve_password_secret', operation, period, requestId, transactionId });
          }

          const secretResult = await resolveSecret({
            config: readiness.poolConfig,
            period,
            requestId,
            transactionId
          });

          resolvedPassword = secretResult.resolvedPassword;
          resolvedSecretEvidence = secretResult.resolvedSecretEvidence;
          secretErrors = secretResult.secretErrors;

          if (secretErrors.length === 0) {
            try {
              record({ event: 'construct_shared_pool', operation, period, requestId, transactionId });

              const nativePool: PeriodCloseNativePostgresPoolLike = new resolvedConstructor.PoolConstructor(
                toPeriodClosePostgresPoolConstructorOptions({
                  config: readiness.poolConfig,
                  password: resolvedPassword
                })
              );
              const sharedPoolAdapter = createPeriodCloseNativePostgresPoolAdapterContract({ nativePool });

              record({ event: 'create_service_boundary', operation, period, requestId, transactionId });

              const serviceBoundary = createServiceBoundary({ pool: sharedPoolAdapter });

              record({ event: 'delegate_service_atomic_boundary', operation, period, requestId, transactionId });
              serviceResult = await runService(serviceBoundary);
              adapterEvents = sharedPoolAdapter.readAdapterEvents();
              record({
                event: 'validate_service_atomic_trace',
                operation,
                period: serviceResult.period ?? period,
                requestId,
                transactionId
              });
            } catch (error) {
              constructorErrors = [
                error instanceof Error ? error.message : 'period-close shared service pool runtime failed to construct pool'
              ];
            }
          }
        }
      }
    }

    record({
      event: 'return_response',
      operation,
      period: serviceResult?.period ?? period,
      requestId,
      transactionId
    });

    const earlyStatus = statusFromEarlyFailure({
      admissionErrors,
      configErrors,
      constructorErrors,
      importErrors,
      readiness,
      secretErrors
    });
    const draftResult: PeriodClosePostgresSharedServicePoolRuntimeResult<T> = {
      adapterEvents,
      admissionErrors,
      configErrors,
      constructorErrors,
      dependencyAdmission,
      events: readEvents(transactionId),
      importErrors,
      operation,
      period: serviceResult?.period ?? period,
      readiness,
      requestId,
      ...(resolvedSecretEvidence ? { resolvedSecretEvidence } : {}),
      secretErrors,
      ...(serviceResult ? { serviceResult } : {}),
      status: serviceResult?.status ?? earlyStatus ?? 'trace_invalid',
      traceErrors: [],
      transactionId
    };
    const traceErrors = validatePeriodClosePostgresSharedServicePoolRuntimeTrace(draftResult);

    return {
      ...draftResult,
      status: traceErrors.length > 0 ? 'trace_invalid' : draftResult.status,
      traceErrors
    };
  }

  return {
    closeAccountingPeriod: ({ admission, period, request }) => {
      const operation = 'close_accounting_period';
      const transactionId = buildTransactionId({ operation, requestId: request.requestId });

      return run({
        admission,
        operation,
        period,
        requestId: request.requestId,
        runService: (serviceBoundary) => serviceBoundary.closeAccountingPeriod({ period, request }),
        transactionId
      });
    },
    guardSourceMutation: ({ admission, context, mutation }) => {
      const operation = 'guard_source_mutation';
      const period = mutation.targetAccountingPeriod ?? 'unresolved';
      const transactionId = buildTransactionId({ operation, requestId: context.requestId });

      return run({
        admission,
        operation,
        period,
        requestId: context.requestId,
        runService: (serviceBoundary) => serviceBoundary.guardSourceMutation({ context, mutation }),
        transactionId
      });
    },
    readEvents: () => events.map((event) => ({ ...event }))
  };
}
