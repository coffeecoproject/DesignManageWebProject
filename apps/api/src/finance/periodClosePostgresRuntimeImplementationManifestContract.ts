import {
  derivePeriodClosePostgresRuntimeReadiness,
  type PeriodClosePostgresRuntimeReadinessPackage,
  type PeriodClosePostgresRuntimeReadinessResult,
} from './periodClosePostgresRuntimeReadinessPackageContract.js';

export type PeriodClosePostgresRuntimeImplementationStatus = 'blocked' | 'ready';
export type PeriodClosePostgresRuntimeImplementationGateStatus = 'blocked' | 'satisfied';

export type PeriodClosePostgresRuntimeImplementationGateId =
  | 'audit_and_observability'
  | 'managed_pool_runtime'
  | 'migration_apply_evidence'
  | 'postgres_module_loader'
  | 'runtime_readiness_package'
  | 'secret_provider_adapter'
  | 'service_process_entry'
  | 'sql_repository_runtime';

export type PeriodClosePostgresRuntimeImplementationEnvironment =
  | 'local_contract'
  | 'production'
  | 'shared_staging';

export type PeriodClosePostgresRuntimeImplementationGate = {
  evidence: string;
  gate: PeriodClosePostgresRuntimeImplementationGateId;
  status: PeriodClosePostgresRuntimeImplementationGateStatus;
};

export type PeriodClosePostgresRuntimeImplementationServiceProcess = {
  entrypoint:
    | 'local_contract_service_runtime'
    | 'production_process_manager'
    | 'project_service_runtime_admission';
  evidenceId?: string;
  healthReadinessEvidenceId?: string;
  productionTrafficBound: boolean;
};

export type PeriodClosePostgresRuntimeImplementationSecretProvider = {
  accessPolicyEvidenceId?: string;
  adapter: 'local_contract_resolver' | 'managed_secret_store_adapter' | 'none';
  evidenceId?: string;
  forbidsRawRuntimeSecretEnv: boolean;
  rotationEvidenceId?: string;
};

export type PeriodClosePostgresRuntimeImplementationPgRuntime = {
  dependencyAdmissionEvidenceId?: string;
  loader: 'fake_pg_module' | 'lazy_pg_runtime_import' | 'none';
  managedPoolEvidenceId?: string;
  nativePoolAdapter: 'local_contract_adapter' | 'native_pg_pool_adapter' | 'none';
};

export type PeriodClosePostgresRuntimeImplementationRepositories = {
  periodLockRepository: 'in_memory' | 'row_backed_contract' | 'sql_repository_runtime';
  sourceMutationRepository: 'in_memory' | 'row_backed_contract' | 'sql_repository_runtime';
  voucherLedgerRepository: 'in_memory' | 'row_backed_contract' | 'sql_repository_runtime';
};

export type PeriodClosePostgresRuntimeImplementationMigration = {
  applyEvidenceId?: string;
  artifactPath?: string;
  rollbackEvidenceId?: string;
  status: 'applied' | 'not_applied';
};

export type PeriodClosePostgresRuntimeImplementationOperations = {
  auditArchive: 'durable_archive' | 'local_contract_events' | 'none';
  metricsEvidenceId?: string;
  runbookEvidenceId?: string;
};

export type PeriodClosePostgresRuntimeImplementationManifest = {
  environment: PeriodClosePostgresRuntimeImplementationEnvironment;
  migration: PeriodClosePostgresRuntimeImplementationMigration;
  operations: PeriodClosePostgresRuntimeImplementationOperations;
  pgRuntime: PeriodClosePostgresRuntimeImplementationPgRuntime;
  readinessPackage: PeriodClosePostgresRuntimeReadinessPackage;
  repositories: PeriodClosePostgresRuntimeImplementationRepositories;
  reviewedAt: string;
  reviewer: string;
  scope: 'period_close_persistent_lock';
  secretProvider: PeriodClosePostgresRuntimeImplementationSecretProvider;
  serviceProcess: PeriodClosePostgresRuntimeImplementationServiceProcess;
};

export type PeriodClosePostgresRuntimeImplementationResult = {
  environment: PeriodClosePostgresRuntimeImplementationEnvironment;
  gates: PeriodClosePostgresRuntimeImplementationGate[];
  readiness: PeriodClosePostgresRuntimeReadinessResult;
  reviewedAt: string;
  reviewer: string;
  status: PeriodClosePostgresRuntimeImplementationStatus;
  traceErrors: string[];
};

function gate(
  gateId: PeriodClosePostgresRuntimeImplementationGateId,
  status: PeriodClosePostgresRuntimeImplementationGateStatus,
  evidence: string,
): PeriodClosePostgresRuntimeImplementationGate {
  return {
    evidence,
    gate: gateId,
    status,
  };
}

function serviceProcessReady(manifest: PeriodClosePostgresRuntimeImplementationManifest) {
  const { serviceProcess } = manifest;

  if (manifest.environment === 'local_contract') {
    return (
      serviceProcess.entrypoint === 'project_service_runtime_admission' &&
      !serviceProcess.productionTrafficBound &&
      Boolean(serviceProcess.evidenceId) &&
      Boolean(serviceProcess.healthReadinessEvidenceId)
    );
  }

  return (
    serviceProcess.entrypoint === 'production_process_manager' &&
    serviceProcess.productionTrafficBound &&
    Boolean(serviceProcess.evidenceId) &&
    Boolean(serviceProcess.healthReadinessEvidenceId)
  );
}

function secretProviderReady(secretProvider: PeriodClosePostgresRuntimeImplementationSecretProvider) {
  return (
    secretProvider.adapter === 'managed_secret_store_adapter' &&
    secretProvider.forbidsRawRuntimeSecretEnv &&
    Boolean(secretProvider.evidenceId) &&
    Boolean(secretProvider.accessPolicyEvidenceId) &&
    Boolean(secretProvider.rotationEvidenceId)
  );
}

function postgresModuleLoaderReady(pgRuntime: PeriodClosePostgresRuntimeImplementationPgRuntime) {
  return (
    pgRuntime.loader === 'lazy_pg_runtime_import' &&
    pgRuntime.nativePoolAdapter === 'native_pg_pool_adapter' &&
    Boolean(pgRuntime.dependencyAdmissionEvidenceId)
  );
}

function managedPoolReady(pgRuntime: PeriodClosePostgresRuntimeImplementationPgRuntime) {
  return (
    pgRuntime.loader === 'lazy_pg_runtime_import' &&
    pgRuntime.nativePoolAdapter === 'native_pg_pool_adapter' &&
    Boolean(pgRuntime.managedPoolEvidenceId)
  );
}

function sqlRepositoriesReady(repositories: PeriodClosePostgresRuntimeImplementationRepositories) {
  return (
    repositories.periodLockRepository === 'sql_repository_runtime' &&
    repositories.sourceMutationRepository === 'sql_repository_runtime' &&
    repositories.voucherLedgerRepository === 'sql_repository_runtime'
  );
}

function migrationReady(migration: PeriodClosePostgresRuntimeImplementationMigration) {
  return (
    migration.status === 'applied' &&
    Boolean(migration.applyEvidenceId) &&
    Boolean(migration.artifactPath) &&
    Boolean(migration.rollbackEvidenceId)
  );
}

function operationsReady(operations: PeriodClosePostgresRuntimeImplementationOperations) {
  return (
    operations.auditArchive === 'durable_archive' &&
    Boolean(operations.metricsEvidenceId) &&
    Boolean(operations.runbookEvidenceId)
  );
}

export function evaluatePeriodClosePostgresRuntimeImplementationManifest(
  manifest: PeriodClosePostgresRuntimeImplementationManifest,
): PeriodClosePostgresRuntimeImplementationResult {
  const readiness = derivePeriodClosePostgresRuntimeReadiness(manifest.readinessPackage);
  const traceErrors: string[] = [...readiness.traceErrors];

  if (manifest.scope !== 'period_close_persistent_lock') {
    traceErrors.push('period-close postgres runtime implementation manifest must keep persistent-lock scope');
  }

  const readinessEnvironment = manifest.readinessPackage.targetDatabase.environment;
  const environmentMatches =
    manifest.environment === readinessEnvironment ||
    (manifest.environment === 'local_contract' && (readinessEnvironment === 'local' || readinessEnvironment === 'test')) ||
    (manifest.environment === 'shared_staging' && readinessEnvironment === 'staging');

  if (!environmentMatches) {
    traceErrors.push('runtime implementation environment must match readiness package target database environment');
  }

  if (manifest.environment === 'production' && manifest.serviceProcess.entrypoint !== 'production_process_manager') {
    traceErrors.push('production runtime implementation must use a production process manager entrypoint');
  }

  if (manifest.secretProvider.adapter !== 'managed_secret_store_adapter' && manifest.readinessPackage.secret.status === 'ready') {
    traceErrors.push('ready runtime secret evidence must be backed by a managed secret store adapter');
  }

  if (
    manifest.migration.status === 'applied' &&
    manifest.migration.applyEvidenceId !== manifest.readinessPackage.formalMigrationApply.applyEvidenceId
  ) {
    traceErrors.push('runtime implementation migration evidence must match readiness package migration apply evidence');
  }

  const serviceReady = serviceProcessReady(manifest);
  const secretReady = secretProviderReady(manifest.secretProvider);
  const pgLoaderReady = postgresModuleLoaderReady(manifest.pgRuntime);
  const poolReady = managedPoolReady(manifest.pgRuntime);
  const repositoryReady = sqlRepositoriesReady(manifest.repositories);
  const migrationIsReady = migrationReady(manifest.migration);
  const operationsAreReady = operationsReady(manifest.operations);
  const readinessReady = readiness.status === 'ready';

  const gates = [
    gate(
      'runtime_readiness_package',
      readinessReady ? 'satisfied' : 'blocked',
      readinessReady
        ? 'runtime readiness package is complete and derives pool config'
        : 'runtime readiness package is blocked',
    ),
    gate(
      'service_process_entry',
      serviceReady ? 'satisfied' : 'blocked',
      serviceReady
        ? `${manifest.serviceProcess.entrypoint} evidence is present`
        : 'service process entrypoint evidence is incomplete or not aligned with environment',
    ),
    gate(
      'secret_provider_adapter',
      secretReady ? 'satisfied' : 'blocked',
      secretReady
        ? 'managed secret store adapter evidence is present and raw runtime secret env is forbidden'
        : 'managed secret store adapter evidence is missing or raw runtime secret env is not forbidden',
    ),
    gate(
      'postgres_module_loader',
      pgLoaderReady ? 'satisfied' : 'blocked',
      pgLoaderReady
        ? 'lazy pg runtime import and native pool adapter evidence are present'
        : 'pg runtime import or native pool adapter evidence is missing',
    ),
    gate(
      'managed_pool_runtime',
      poolReady ? 'satisfied' : 'blocked',
      poolReady
        ? 'managed pool lifecycle evidence is present'
        : 'managed pool lifecycle evidence is missing',
    ),
    gate(
      'sql_repository_runtime',
      repositoryReady ? 'satisfied' : 'blocked',
      repositoryReady
        ? 'period lock, source mutation, and voucher ledger repositories use SQL runtime'
        : 'one or more repositories still use in-memory or row-backed contract runtime',
    ),
    gate(
      'migration_apply_evidence',
      migrationIsReady ? 'satisfied' : 'blocked',
      migrationIsReady
        ? 'formal migration apply and rollback evidence are present'
        : 'formal migration apply or rollback evidence is missing',
    ),
    gate(
      'audit_and_observability',
      operationsAreReady ? 'satisfied' : 'blocked',
      operationsAreReady
        ? 'durable audit archive, metrics, and runbook evidence are present'
        : 'durable audit archive, metrics, or runbook evidence is missing',
    ),
  ];
  const status =
    traceErrors.length === 0 && gates.every((implementationGate) => implementationGate.status === 'satisfied')
      ? 'ready'
      : 'blocked';

  return {
    environment: manifest.environment,
    gates,
    readiness,
    reviewedAt: manifest.reviewedAt,
    reviewer: manifest.reviewer,
    status,
    traceErrors,
  };
}
