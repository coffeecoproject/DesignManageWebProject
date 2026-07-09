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
  PeriodClosePostgresRuntimeImplementationBundleDescriptor
} from './periodClosePostgresRuntimeImplementationBundleContract.js';
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

export type PeriodCloseManagedNativePostgresPoolLike = PeriodCloseNativePostgresPoolLike & {
  end?: () => Promise<void> | void;
};

export type PeriodClosePostgresManagedServicePoolRuntimeStatus =
  | 'admission_invalid'
  | 'config_invalid'
  | 'constructor_failed'
  | 'loader_failed'
  | 'module_invalid'
  | 'pool_closed'
  | 'readiness_blocked'
  | 'runtime_bundle_invalid'
  | 'secret_invalid'
  | PeriodCloseServiceAtomicCommitStatus;

export type PeriodClosePostgresManagedServicePoolShutdownStatus =
  | 'closed'
  | 'not_initialized'
  | 'shutdown_failed'
  | 'trace_invalid';

export type PeriodClosePostgresManagedServicePoolLifecycleState =
  | 'active'
  | 'closed'
  | 'not_initialized';

export type PeriodClosePostgresManagedServicePoolRuntimeEventName =
  | 'construct_managed_pool'
  | 'create_service_boundary'
  | 'delegate_service_atomic_boundary'
  | 'derive_runtime_readiness'
  | 'evaluate_dependency_admission'
  | 'import_pg_module'
  | 'receive_request'
  | 'resolve_password_secret'
  | 'return_response'
  | 'reuse_managed_pool'
  | 'shutdown_managed_pool'
  | 'validate_dependency_admission'
  | 'validate_runtime_implementation_bundle'
  | 'validate_pg_module'
  | 'validate_runtime_config'
  | 'validate_runtime_readiness'
  | 'validate_service_atomic_trace';

export type PeriodClosePostgresManagedServicePoolRuntimeOperation =
  | 'close_accounting_period'
  | 'guard_source_mutation'
  | 'shutdown_runtime_pool';

export type PeriodClosePostgresManagedServicePoolRuntimeEvent = {
  event: PeriodClosePostgresManagedServicePoolRuntimeEventName;
  operation: PeriodClosePostgresManagedServicePoolRuntimeOperation;
  period?: string;
  requestId: string;
  sequence: number;
  transactionId: string;
};

export type PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput = Omit<
  PeriodClosePostgresDependencyAdmissionInput,
  'runtimeEvidence'
> & {
  readinessPackage: PeriodClosePostgresRuntimeReadinessPackage;
  runtimeImplementationBundle: PeriodClosePostgresRuntimeImplementationBundleDescriptor;
};

export type PeriodClosePostgresManagedServicePoolRuntimeResult<
  T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult
> = {
  adapterEvents: PeriodCloseNativePostgresPoolAdapterEvent[];
  admissionErrors: string[];
  configErrors: string[];
  constructorErrors: string[];
  dependencyAdmission: PeriodClosePostgresDependencyAdmissionResult;
  events: PeriodClosePostgresManagedServicePoolRuntimeEvent[];
  importErrors: string[];
  operation: Exclude<PeriodClosePostgresManagedServicePoolRuntimeOperation, 'shutdown_runtime_pool'>;
  period?: string;
  poolLifecycleState: PeriodClosePostgresManagedServicePoolLifecycleState;
  readiness: PeriodClosePostgresRuntimeReadinessResult;
  requestId: string;
  resolvedSecretEvidence?: PeriodClosePostgresResolvedSecretEvidence;
  runtimeBundleErrors: string[];
  runtimeImplementationBundle: PeriodClosePostgresRuntimeImplementationBundleDescriptor;
  secretErrors: string[];
  serviceResult?: PeriodCloseServiceAtomicCommitBoundaryResult<T>;
  status: PeriodClosePostgresManagedServicePoolRuntimeStatus;
  traceErrors: string[];
  transactionId: string;
};

export type PeriodClosePostgresManagedServicePoolShutdownResult = {
  events: PeriodClosePostgresManagedServicePoolRuntimeEvent[];
  poolLifecycleState: PeriodClosePostgresManagedServicePoolLifecycleState;
  requestId: string;
  shutdownErrors: string[];
  status: PeriodClosePostgresManagedServicePoolShutdownStatus;
  traceErrors: string[];
  transactionId: string;
};

export type PeriodClosePostgresManagedServicePoolRuntimeContract = {
  closeAccountingPeriod: (input: {
    admission: PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput;
    period: string;
    request: CloseAccountingPeriodRequest;
  }) => Promise<PeriodClosePostgresManagedServicePoolRuntimeResult<PersistentCloseAccountingPeriodResult>>;
  guardSourceMutation: (input: {
    admission: PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput;
    context: PeriodClosePersistenceContext;
    mutation: PersistentSourceMutationRequest;
  }) => Promise<PeriodClosePostgresManagedServicePoolRuntimeResult<PersistentSourceMutationResult>>;
  readEvents: () => PeriodClosePostgresManagedServicePoolRuntimeEvent[];
  shutdown: (input: { requestId: string }) => Promise<PeriodClosePostgresManagedServicePoolShutdownResult>;
};

export type PeriodClosePostgresManagedServiceBoundaryFactory = (input: {
  pool: PeriodClosePostgresPoolPort;
}) => PeriodCloseServiceAtomicCommitBoundaryContract;

type ManagedPoolState = {
  adapter?: ReturnType<typeof createPeriodCloseNativePostgresPoolAdapterContract>;
  configFingerprint?: string;
  lifecycleState: PeriodClosePostgresManagedServicePoolLifecycleState;
  nativePool?: PeriodCloseManagedNativePostgresPoolLike;
};

function buildTransactionId({
  operation,
  requestId
}: {
  operation: PeriodClosePostgresManagedServicePoolRuntimeOperation;
  requestId: string;
}) {
  return `${requestId}:${operation}:postgres-managed-service-pool-runtime`;
}

function runtimeConfigFingerprint(config: PeriodClosePostgresPoolRuntimeConfig) {
  return JSON.stringify(
    Object.keys(config)
      .sort()
      .reduce<Record<string, unknown>>((fingerprint, key) => {
        fingerprint[key] = config[key as keyof PeriodClosePostgresPoolRuntimeConfig];
        return fingerprint;
      }, {})
  );
}

function statusFromEarlyFailure({
  admissionErrors,
  configErrors,
  constructorErrors,
  importErrors,
  lifecycleState,
  readiness,
  runtimeBundleErrors,
  secretErrors
}: {
  admissionErrors: readonly string[];
  configErrors: readonly string[];
  constructorErrors: readonly string[];
  importErrors: readonly string[];
  lifecycleState: PeriodClosePostgresManagedServicePoolLifecycleState;
  readiness: PeriodClosePostgresRuntimeReadinessResult;
  runtimeBundleErrors: readonly string[];
  secretErrors: readonly string[];
}): PeriodClosePostgresManagedServicePoolRuntimeStatus | undefined {
  if (lifecycleState === 'closed') {
    return 'pool_closed';
  }

  if (readiness.status !== 'ready' || !readiness.poolConfig) {
    return 'readiness_blocked';
  }

  if (admissionErrors.length > 0) {
    return 'admission_invalid';
  }

  if (runtimeBundleErrors.length > 0) {
    return 'runtime_bundle_invalid';
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

function eventNames(events: readonly PeriodClosePostgresManagedServicePoolRuntimeEvent[]) {
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
      importErrors: ['period-close managed service pool runtime must load a pg module with a Pool constructor']
    };
  }

  return {
    importErrors: [],
    PoolConstructor
  };
}

export function validatePeriodClosePostgresManagedServicePoolRuntimeTrace<
  T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult
>(result: PeriodClosePostgresManagedServicePoolRuntimeResult<T>): string[] {
  const errors = [...result.traceErrors];
  const events = result.events.slice().sort((left, right) => left.sequence - right.sequence);
  const names = eventNames(events);
  const receiveIndex = names.indexOf('receive_request');
  const deriveIndex = names.indexOf('derive_runtime_readiness');
  const readinessIndex = names.indexOf('validate_runtime_readiness');
  const dependencyIndex = names.indexOf('evaluate_dependency_admission');
  const admissionIndex = names.indexOf('validate_dependency_admission');
  const bundleIndex = names.indexOf('validate_runtime_implementation_bundle');
  const configIndex = names.indexOf('validate_runtime_config');
  const importIndex = names.indexOf('import_pg_module');
  const moduleIndex = names.indexOf('validate_pg_module');
  const secretIndex = names.indexOf('resolve_password_secret');
  const constructIndex = names.indexOf('construct_managed_pool');
  const reuseIndex = names.indexOf('reuse_managed_pool');
  const factoryIndex = names.indexOf('create_service_boundary');
  const serviceIndex = names.indexOf('delegate_service_atomic_boundary');
  const serviceValidateIndex = names.indexOf('validate_service_atomic_trace');
  const returnIndex = names.indexOf('return_response');
  const poolReadyIndex = constructIndex === -1 ? reuseIndex : constructIndex;

  if (receiveIndex !== 0) {
    errors.push(`${result.transactionId} managed service pool runtime must receive request first`);
  }

  if (deriveIndex <= receiveIndex || readinessIndex <= deriveIndex) {
    errors.push(`${result.transactionId} managed service pool runtime must derive and validate readiness before admission`);
  }

  if (dependencyIndex <= readinessIndex || admissionIndex <= dependencyIndex) {
    errors.push(`${result.transactionId} managed service pool runtime must evaluate and validate dependency admission`);
  }

  if (bundleIndex <= admissionIndex) {
    errors.push(`${result.transactionId} managed service pool runtime must validate runtime implementation bundle after dependency admission`);
  }

  if (
    result.poolLifecycleState === 'closed' ||
    result.readiness.status !== 'ready' ||
    result.admissionErrors.length > 0 ||
    result.runtimeBundleErrors.length > 0 ||
    result.configErrors.length > 0 ||
    result.importErrors.length > 0 ||
    result.secretErrors.length > 0 ||
    result.constructorErrors.length > 0
  ) {
    if (
      (result.constructorErrors.length === 0 && constructIndex !== -1) ||
      reuseIndex !== -1 ||
      factoryIndex !== -1 ||
      serviceIndex !== -1 ||
      serviceValidateIndex !== -1 ||
      result.serviceResult
    ) {
      errors.push(`${result.transactionId} blocked managed service pool runtime must not construct, reuse, or enter service work`);
    }
  } else {
    if (configIndex <= bundleIndex) {
      errors.push(`${result.transactionId} managed service pool runtime must validate config after runtime implementation bundle`);
    }

    if (constructIndex === -1 && reuseIndex === -1) {
      errors.push(`${result.transactionId} managed service pool runtime must construct or reuse a managed pool before service work`);
    }

    if (constructIndex !== -1) {
      if (importIndex <= configIndex || moduleIndex <= importIndex) {
        errors.push(`${result.transactionId} managed service pool runtime must import and validate pg before first pool construction`);
      }

      if (secretIndex !== -1 && secretIndex <= moduleIndex) {
        errors.push(`${result.transactionId} managed service pool runtime must resolve secrets after pg module validation`);
      }

      const constructionGateIndex = secretIndex === -1 ? moduleIndex : secretIndex;

      if (constructIndex <= constructionGateIndex) {
        errors.push(`${result.transactionId} managed service pool runtime must construct managed pool after runtime gates`);
      }
    }

    if (reuseIndex !== -1 && reuseIndex <= configIndex) {
      errors.push(`${result.transactionId} managed service pool runtime must validate config before reusing a managed pool`);
    }

    if (poolReadyIndex === -1 || factoryIndex <= poolReadyIndex || serviceIndex <= factoryIndex || serviceValidateIndex <= serviceIndex) {
      errors.push(`${result.transactionId} managed service pool runtime must hand the managed pool to service before validation`);
    }

    if (!result.serviceResult) {
      errors.push(`${result.transactionId} managed service pool runtime must keep service result after delegation`);
    }
  }

  if (returnIndex !== events.length - 1) {
    errors.push(`${result.transactionId} managed service pool runtime must return response last`);
  }

  if (events.some((event) => event.operation !== result.operation)) {
    errors.push(`${result.transactionId} managed service pool runtime events must keep one operation`);
  }

  if (events.some((event) => event.requestId !== result.requestId)) {
    errors.push(`${result.transactionId} managed service pool runtime events must keep one request id`);
  }

  if (events.some((event) => event.transactionId !== result.transactionId)) {
    errors.push(`${result.transactionId} managed service pool runtime events must keep one transaction id`);
  }

  if (result.resolvedSecretEvidence && Object.values(result.resolvedSecretEvidence).some((value) => String(value).includes('resolved-production-secret'))) {
    errors.push(`${result.transactionId} managed service pool runtime must not expose raw secret values`);
  }

  errors.push(...validatePeriodClosePostgresDependencyAdmission(result.dependencyAdmission));

  if (result.runtimeBundleErrors.length === 0 && result.readiness.poolConfig) {
    const readinessFingerprint = runtimeConfigFingerprint(result.readiness.poolConfig);
    const bundleFingerprint = runtimeConfigFingerprint(result.runtimeImplementationBundle.poolConfig);

    if (readinessFingerprint !== bundleFingerprint) {
      errors.push(`${result.transactionId} managed service pool runtime bundle pool config must match derived readiness pool config`);
    }
  }

  if (result.serviceResult) {
    errors.push(...result.serviceResult.traceErrors);

    if (result.status !== result.serviceResult.status) {
      errors.push(`${result.transactionId} managed service pool runtime status must mirror service status`);
    }
  }

  return errors;
}

function validateRuntimeImplementationBundleForManagedPool({
  bundle,
  readiness
}: {
  bundle: PeriodClosePostgresRuntimeImplementationBundleDescriptor;
  readiness: PeriodClosePostgresRuntimeReadinessResult;
}) {
  const errors: string[] = [];

  if (!bundle.managedServicePoolRuntimeModulePath.trim()) {
    errors.push('managed service pool runtime bundle must include managed service pool module path');
  }

  if (!bundle.runtimeImportModulePath.trim()) {
    errors.push('managed service pool runtime bundle must include runtime import module path');
  }

  if (!bundle.sourceMutationBridgeModulePath.trim()) {
    errors.push('managed service pool runtime bundle must include source mutation bridge module path');
  }

  if (!bundle.serviceRuntimeAdmissionEvidenceId.trim()) {
    errors.push('managed service pool runtime bundle must include service runtime admission evidence');
  }

  if (readiness.status === 'ready' && readiness.poolConfig) {
    const readinessFingerprint = runtimeConfigFingerprint(readiness.poolConfig);
    const bundleFingerprint = runtimeConfigFingerprint(bundle.poolConfig);

    if (readinessFingerprint !== bundleFingerprint) {
      errors.push('managed service pool runtime bundle pool config must match derived readiness pool config');
    }
  }

  return errors;
}

export function validatePeriodClosePostgresManagedServicePoolShutdownTrace(
  result: PeriodClosePostgresManagedServicePoolShutdownResult
): string[] {
  const errors = [...result.traceErrors];
  const events = result.events.slice().sort((left, right) => left.sequence - right.sequence);
  const names = eventNames(events);
  const receiveIndex = names.indexOf('receive_request');
  const shutdownIndex = names.indexOf('shutdown_managed_pool');
  const returnIndex = names.indexOf('return_response');

  if (receiveIndex !== 0) {
    errors.push(`${result.transactionId} managed service pool shutdown must receive request first`);
  }

  if (result.status === 'closed') {
    if (shutdownIndex <= receiveIndex) {
      errors.push(`${result.transactionId} managed service pool shutdown must close the pool after receiving request`);
    }

    if (result.poolLifecycleState !== 'closed') {
      errors.push(`${result.transactionId} managed service pool shutdown must report closed lifecycle after success`);
    }
  } else if (shutdownIndex !== -1 && result.status === 'not_initialized') {
    errors.push(`${result.transactionId} uninitialized managed service pool shutdown must not call native end`);
  }

  if (returnIndex !== events.length - 1) {
    errors.push(`${result.transactionId} managed service pool shutdown must return response last`);
  }

  if (events.some((event) => event.operation !== 'shutdown_runtime_pool')) {
    errors.push(`${result.transactionId} managed service pool shutdown events must keep shutdown operation`);
  }

  if (events.some((event) => event.requestId !== result.requestId)) {
    errors.push(`${result.transactionId} managed service pool shutdown events must keep one request id`);
  }

  if (events.some((event) => event.transactionId !== result.transactionId)) {
    errors.push(`${result.transactionId} managed service pool shutdown events must keep one transaction id`);
  }

  return errors;
}

export function createPeriodClosePostgresManagedServicePoolRuntimeContract({
  createServiceBoundary,
  loadPgModule,
  secretResolver
}: {
  createServiceBoundary: PeriodClosePostgresManagedServiceBoundaryFactory;
  loadPgModule: PeriodClosePostgresRuntimeModuleLoader;
  secretResolver?: PeriodClosePostgresSecretResolverContract;
}): PeriodClosePostgresManagedServicePoolRuntimeContract {
  const events: PeriodClosePostgresManagedServicePoolRuntimeEvent[] = [];
  const managedPool: ManagedPoolState = {
    lifecycleState: 'not_initialized'
  };

  function record({
    event,
    operation,
    period,
    requestId,
    transactionId
  }: Omit<PeriodClosePostgresManagedServicePoolRuntimeEvent, 'sequence'>) {
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
        secretErrors: ['period-close managed service pool runtime requires a secret resolver for passwordSecretRef']
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

  async function ensureManagedPool({
    operation,
    period,
    requestId,
    runtimeConfig,
    transactionId
  }: {
    operation: Exclude<PeriodClosePostgresManagedServicePoolRuntimeOperation, 'shutdown_runtime_pool'>;
    period: string;
    requestId: string;
    runtimeConfig: PeriodClosePostgresPoolRuntimeConfig;
    transactionId: string;
  }) {
    const fingerprint = runtimeConfigFingerprint(runtimeConfig);

    if (managedPool.lifecycleState === 'active' && managedPool.adapter) {
      if (managedPool.configFingerprint !== fingerprint) {
        return {
          configErrors: ['period-close managed service pool runtime config changed after pool initialization']
        };
      }

      record({ event: 'reuse_managed_pool', operation, period, requestId, transactionId });

      return {
        adapter: managedPool.adapter,
        configErrors: []
      };
    }

    record({ event: 'import_pg_module', operation, period, requestId, transactionId });

    let pgModule: Awaited<ReturnType<PeriodClosePostgresRuntimeModuleLoader>> | undefined;

    try {
      pgModule = await loadPgModule();
    } catch (error) {
      return {
        configErrors: [],
        importErrors: [error instanceof Error ? error.message : 'period-close managed service pool runtime module import failed']
      };
    }

    record({ event: 'validate_pg_module', operation, period, requestId, transactionId });
    const resolvedConstructor = resolvePoolConstructor(pgModule);

    if (!resolvedConstructor.PoolConstructor || resolvedConstructor.importErrors.length > 0) {
      return {
        configErrors: [],
        importErrors: resolvedConstructor.importErrors
      };
    }

    if (runtimeConfig.passwordSecretRef) {
      record({ event: 'resolve_password_secret', operation, period, requestId, transactionId });
    }

    const secretResult = await resolveSecret({
      config: runtimeConfig,
      period,
      requestId,
      transactionId
    });

    if (secretResult.secretErrors.length > 0) {
      return {
        configErrors: [],
        resolvedSecretEvidence: secretResult.resolvedSecretEvidence,
        secretErrors: secretResult.secretErrors
      };
    }

    try {
      record({ event: 'construct_managed_pool', operation, period, requestId, transactionId });

      const nativePool = new resolvedConstructor.PoolConstructor(
        toPeriodClosePostgresPoolConstructorOptions({
          config: runtimeConfig,
          password: secretResult.resolvedPassword
        })
      ) as PeriodCloseManagedNativePostgresPoolLike;
      const adapter = createPeriodCloseNativePostgresPoolAdapterContract({ nativePool });

      managedPool.adapter = adapter;
      managedPool.configFingerprint = fingerprint;
      managedPool.lifecycleState = 'active';
      managedPool.nativePool = nativePool;

      return {
        adapter,
        configErrors: [],
        resolvedSecretEvidence: secretResult.resolvedSecretEvidence
      };
    } catch (error) {
      return {
        configErrors: [],
        constructorErrors: [
          error instanceof Error ? error.message : 'period-close managed service pool runtime failed to construct pool'
        ],
        resolvedSecretEvidence: secretResult.resolvedSecretEvidence
      };
    }
  }

  async function run<T extends PersistentCloseAccountingPeriodResult | PersistentSourceMutationResult>({
    admission,
    operation,
    period,
    requestId,
    runService,
    transactionId
  }: {
    admission: PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput;
    operation: Exclude<PeriodClosePostgresManagedServicePoolRuntimeOperation, 'shutdown_runtime_pool'>;
    period: string;
    requestId: string;
    runService: (serviceBoundary: PeriodCloseServiceAtomicCommitBoundaryContract) => Promise<PeriodCloseServiceAtomicCommitBoundaryResult<T>>;
    transactionId: string;
  }): Promise<PeriodClosePostgresManagedServicePoolRuntimeResult<T>> {
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
    record({ event: 'validate_runtime_implementation_bundle', operation, period, requestId, transactionId });
    const runtimeBundleErrors = validateRuntimeImplementationBundleForManagedPool({
      bundle: admission.runtimeImplementationBundle,
      readiness
    });
    let configErrors: string[] = [];
    let constructorErrors: string[] = [];
    let importErrors: string[] = [];
    let secretErrors: string[] = [];
    let resolvedSecretEvidence: PeriodClosePostgresResolvedSecretEvidence | undefined;
    let serviceResult: PeriodCloseServiceAtomicCommitBoundaryResult<T> | undefined;

    if (
      managedPool.lifecycleState !== 'closed' &&
      readiness.status === 'ready' &&
      readiness.poolConfig &&
      admissionErrors.length === 0 &&
      runtimeBundleErrors.length === 0
    ) {
      record({ event: 'validate_runtime_config', operation, period, requestId, transactionId });
      configErrors = validatePeriodClosePostgresPoolRuntimeConfig(admission.runtimeImplementationBundle.poolConfig);

      if (configErrors.length === 0) {
        const poolResult = await ensureManagedPool({
          operation,
          period,
          requestId,
          runtimeConfig: admission.runtimeImplementationBundle.poolConfig,
          transactionId
        });

        configErrors = poolResult.configErrors ?? [];
        constructorErrors = poolResult.constructorErrors ?? [];
        importErrors = poolResult.importErrors ?? [];
        secretErrors = poolResult.secretErrors ?? [];
        resolvedSecretEvidence = poolResult.resolvedSecretEvidence;

        if (poolResult.adapter && configErrors.length === 0 && constructorErrors.length === 0 && importErrors.length === 0 && secretErrors.length === 0) {
          record({ event: 'create_service_boundary', operation, period, requestId, transactionId });

          const serviceBoundary = createServiceBoundary({ pool: poolResult.adapter });

          record({ event: 'delegate_service_atomic_boundary', operation, period, requestId, transactionId });
          serviceResult = await runService(serviceBoundary);
          record({
            event: 'validate_service_atomic_trace',
            operation,
            period: serviceResult.period ?? period,
            requestId,
            transactionId
          });
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
      lifecycleState: managedPool.lifecycleState,
      readiness,
      runtimeBundleErrors,
      secretErrors
    });
    const draftResult: PeriodClosePostgresManagedServicePoolRuntimeResult<T> = {
      adapterEvents: managedPool.adapter?.readAdapterEvents() ?? [],
      admissionErrors,
      configErrors,
      constructorErrors,
      dependencyAdmission,
      events: readEvents(transactionId),
      importErrors,
      operation,
      period: serviceResult?.period ?? period,
      poolLifecycleState: managedPool.lifecycleState,
      readiness,
      requestId,
      ...(resolvedSecretEvidence ? { resolvedSecretEvidence } : {}),
      runtimeBundleErrors,
      runtimeImplementationBundle: admission.runtimeImplementationBundle,
      secretErrors,
      ...(serviceResult ? { serviceResult } : {}),
      status: serviceResult?.status ?? earlyStatus ?? 'trace_invalid',
      traceErrors: [],
      transactionId
    };
    const traceErrors = validatePeriodClosePostgresManagedServicePoolRuntimeTrace(draftResult);

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
    readEvents: () => events.map((event) => ({ ...event })),
    shutdown: async ({ requestId }) => {
      const operation = 'shutdown_runtime_pool';
      const transactionId = buildTransactionId({ operation, requestId });

      record({ event: 'receive_request', operation, requestId, transactionId });

      const shutdownErrors: string[] = [];
      let status: PeriodClosePostgresManagedServicePoolShutdownStatus = 'not_initialized';

      if (managedPool.lifecycleState === 'active' && managedPool.nativePool) {
        try {
          record({ event: 'shutdown_managed_pool', operation, requestId, transactionId });

          if (typeof managedPool.nativePool.end !== 'function') {
            throw new Error('period-close managed service pool runtime requires native pool end() during shutdown');
          }

          await managedPool.nativePool.end();
          managedPool.lifecycleState = 'closed';
          managedPool.adapter = undefined;
          managedPool.nativePool = undefined;
          status = 'closed';
        } catch (error) {
          shutdownErrors.push(
            error instanceof Error ? error.message : 'period-close managed service pool runtime failed to shutdown native pool'
          );
          status = 'shutdown_failed';
        }
      }

      record({ event: 'return_response', operation, requestId, transactionId });

      const draftResult: PeriodClosePostgresManagedServicePoolShutdownResult = {
        events: readEvents(transactionId),
        poolLifecycleState: managedPool.lifecycleState,
        requestId,
        shutdownErrors,
        status,
        traceErrors: [],
        transactionId
      };
      const traceErrors = validatePeriodClosePostgresManagedServicePoolShutdownTrace(draftResult);

      return {
        ...draftResult,
        status: traceErrors.length > 0 ? 'trace_invalid' : draftResult.status,
        traceErrors
      };
    }
  };
}
