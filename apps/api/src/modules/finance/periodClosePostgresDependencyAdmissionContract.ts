import type { PeriodCloseMigrationOperationalGateContract } from './periodCloseMigrationOperationalGateContract.js';

export type PeriodClosePostgresDependencyAdmissionStatus =
  | 'admitted'
  | 'blocked_by_operational_gates'
  | 'lockfile_missing'
  | 'manifest_lock_mismatch'
  | 'runtime_dependency_misclassified'
  | 'runtime_dependency_not_declared';

export type PeriodClosePostgresDependencyGateId =
  | 'backup_restore_evidence'
  | 'formal_migration_apply'
  | 'pg_lockfile_entry'
  | 'pg_runtime_dependency'
  | 'production_apply_approval'
  | 'release_rollback_owner'
  | 'runtime_import_allowed'
  | 'secret_manager_runtime'
  | 'target_database_selection';

export type PeriodClosePostgresDependencyGateStatus = 'blocked' | 'satisfied';

export type PeriodClosePostgresDependencyGate = {
  evidence: string;
  gate: PeriodClosePostgresDependencyGateId;
  status: PeriodClosePostgresDependencyGateStatus;
};

export type PeriodClosePostgresPackageManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  name?: string;
  optionalDependencies?: Record<string, string>;
};

export type PeriodClosePostgresRuntimeAdmissionEvidence = {
  backupRestoreEvidenceReady: boolean;
  formalMigrationApplyReady: boolean;
  productionApplyApproved: boolean;
  releaseRollbackOwnerReady: boolean;
  secretManagerRuntimeReady: boolean;
  targetDatabaseSelected: boolean;
};

export type PeriodClosePostgresDependencyAdmissionInput = {
  apiPackageManifest: PeriodClosePostgresPackageManifest;
  apiPackageManifestPath: string;
  lockfilePath: string;
  lockfileText: string;
  runtimeEvidence: PeriodClosePostgresRuntimeAdmissionEvidence;
};

export type PeriodClosePostgresDependencyAdmissionResult = {
  apiPackageManifestPath: string;
  gates: PeriodClosePostgresDependencyGate[];
  lockfilePath: string;
  pgLockfileEvidence: string;
  pgManifestEvidence: string;
  runtimeImportAllowed: boolean;
  status: PeriodClosePostgresDependencyAdmissionStatus;
  traceErrors: string[];
};

const expectedApiPackageName = '@startupmanage/api';

function hasRuntimePgDependency(manifest: PeriodClosePostgresPackageManifest) {
  return Boolean(manifest.dependencies?.pg);
}

function hasMisclassifiedPgDependency(manifest: PeriodClosePostgresPackageManifest) {
  return Boolean(manifest.devDependencies?.pg || manifest.optionalDependencies?.pg);
}

function hasPgLockfileEntry(lockfileText: string) {
  const hasImporterEntry = /^\s+pg:\s*$/m.test(lockfileText);
  const hasPackageEntry = /^\s{2,}pg@\d|\bpg@\d|\/pg@\d/.test(lockfileText);

  return hasImporterEntry && hasPackageEntry;
}

function gate(
  gateId: PeriodClosePostgresDependencyGateId,
  status: PeriodClosePostgresDependencyGateStatus,
  evidence: string
): PeriodClosePostgresDependencyGate {
  return {
    evidence,
    gate: gateId,
    status
  };
}

function runtimeEvidenceGates(
  evidence: PeriodClosePostgresRuntimeAdmissionEvidence
): PeriodClosePostgresDependencyGate[] {
  return [
    gate(
      'secret_manager_runtime',
      evidence.secretManagerRuntimeReady ? 'satisfied' : 'blocked',
      evidence.secretManagerRuntimeReady
        ? 'real secret manager runtime has approved evidence'
        : 'real secret manager runtime evidence is missing'
    ),
    gate(
      'target_database_selection',
      evidence.targetDatabaseSelected ? 'satisfied' : 'blocked',
      evidence.targetDatabaseSelected
        ? 'target database has been selected'
        : 'target database selection evidence is missing'
    ),
    gate(
      'backup_restore_evidence',
      evidence.backupRestoreEvidenceReady ? 'satisfied' : 'blocked',
      evidence.backupRestoreEvidenceReady
        ? 'backup and restore drill evidence is approved'
        : 'backup and restore drill evidence is missing'
    ),
    gate(
      'release_rollback_owner',
      evidence.releaseRollbackOwnerReady ? 'satisfied' : 'blocked',
      evidence.releaseRollbackOwnerReady
        ? 'release and rollback owners are assigned'
        : 'release and rollback owner evidence is missing'
    ),
    gate(
      'production_apply_approval',
      evidence.productionApplyApproved ? 'satisfied' : 'blocked',
      evidence.productionApplyApproved
        ? 'production or shared-database apply approval exists'
        : 'production or shared-database apply approval is missing'
    ),
    gate(
      'formal_migration_apply',
      evidence.formalMigrationApplyReady ? 'satisfied' : 'blocked',
      evidence.formalMigrationApplyReady
        ? 'formal project schema migration apply evidence exists'
        : 'formal project schema migration apply evidence is missing'
    )
  ];
}

function firstBlockedOperationalGate(gates: readonly PeriodClosePostgresDependencyGate[]) {
  return gates.find((item) => item.status === 'blocked');
}

export function runtimeEvidenceFromPeriodCloseOperationalGate(
  contract: PeriodCloseMigrationOperationalGateContract
): PeriodClosePostgresRuntimeAdmissionEvidence {
  return {
    backupRestoreEvidenceReady:
      contract.backupRestorePlan.status !== 'not_started' &&
      Boolean(contract.backupRestorePlan.backupEvidenceRef) &&
      Boolean(contract.backupRestorePlan.restoreDrillEvidenceRef),
    formalMigrationApplyReady: false,
    productionApplyApproved:
      contract.productionApplyApproval.status !== 'not_started' &&
      Boolean(contract.productionApplyApproval.approvalEvidenceRef),
    releaseRollbackOwnerReady:
      contract.ownership.releaseOwnerStatus !== 'not_started' &&
      contract.ownership.rollbackOwnerStatus !== 'not_started' &&
      Boolean(contract.ownership.releaseOwner) &&
      Boolean(contract.ownership.rollbackOwner),
    secretManagerRuntimeReady: Boolean(contract.targetDatabaseSelection.secretRef),
    targetDatabaseSelected:
      contract.targetDatabaseSelection.status !== 'not_selected' &&
      Boolean(contract.targetDatabaseSelection.targetDatabaseIdentifier)
  };
}

export function evaluatePeriodClosePostgresDependencyAdmission(
  input: PeriodClosePostgresDependencyAdmissionInput
): PeriodClosePostgresDependencyAdmissionResult {
  const pgInRuntimeDeps = hasRuntimePgDependency(input.apiPackageManifest);
  const pgMisclassified = hasMisclassifiedPgDependency(input.apiPackageManifest);
  const pgInLockfile = hasPgLockfileEntry(input.lockfileText);
  const gates: PeriodClosePostgresDependencyGate[] = [];
  const traceErrors: string[] = [];

  if (input.apiPackageManifest.name !== expectedApiPackageName) {
    traceErrors.push('period-close postgres dependency admission must evaluate @startupmanage/api package manifest');
  }

  gates.push(
    gate(
      'pg_runtime_dependency',
      pgInRuntimeDeps ? 'satisfied' : 'blocked',
      pgInRuntimeDeps
        ? `${input.apiPackageManifestPath} declares pg under dependencies`
        : `${input.apiPackageManifestPath} does not declare pg under dependencies`
    )
  );

  gates.push(
    gate(
      'pg_lockfile_entry',
      pgInLockfile ? 'satisfied' : 'blocked',
      pgInLockfile
        ? `${input.lockfilePath} contains importer and package lock entries for pg`
        : `${input.lockfilePath} does not contain importer and package lock entries for pg`
    )
  );

  if (!pgInRuntimeDeps && pgMisclassified) {
    traceErrors.push('pg must be a runtime dependency of @startupmanage/api, not devDependencies or optionalDependencies');
  }

  if (pgInLockfile && !pgInRuntimeDeps) {
    traceErrors.push('pg lockfile entries must not exist without @startupmanage/api runtime dependency declaration');
  }

  gates.push(...runtimeEvidenceGates(input.runtimeEvidence));

  const firstOperationalBlocker = firstBlockedOperationalGate(gates.slice(2));
  const runtimeImportAllowed = pgInRuntimeDeps && pgInLockfile && !firstOperationalBlocker && traceErrors.length === 0;

  gates.push(
    gate(
      'runtime_import_allowed',
      runtimeImportAllowed ? 'satisfied' : 'blocked',
      runtimeImportAllowed
        ? 'period-close code may import pg for the real runtime binding'
        : 'period-close code must not import pg for runtime binding before dependency and operational gates pass'
    )
  );

  let status: PeriodClosePostgresDependencyAdmissionStatus;

  if (pgMisclassified && !pgInRuntimeDeps) {
    status = 'runtime_dependency_misclassified';
  } else if (!pgInRuntimeDeps && pgInLockfile) {
    status = 'manifest_lock_mismatch';
  } else if (!pgInRuntimeDeps) {
    status = 'runtime_dependency_not_declared';
  } else if (!pgInLockfile) {
    status = 'lockfile_missing';
  } else if (firstOperationalBlocker) {
    status = 'blocked_by_operational_gates';
  } else {
    status = 'admitted';
  }

  return {
    apiPackageManifestPath: input.apiPackageManifestPath,
    gates,
    lockfilePath: input.lockfilePath,
    pgLockfileEvidence: pgInLockfile ? 'pg lockfile entry present' : 'pg lockfile entry missing',
    pgManifestEvidence: pgInRuntimeDeps
      ? `pg@${input.apiPackageManifest.dependencies?.pg} runtime dependency present`
      : 'pg runtime dependency missing',
    runtimeImportAllowed,
    status,
    traceErrors
  };
}

export function validatePeriodClosePostgresDependencyAdmission(
  result: PeriodClosePostgresDependencyAdmissionResult
): string[] {
  const errors = [...result.traceErrors];
  const gateById = new Map(result.gates.map((item) => [item.gate, item]));
  const runtimeDependencyGate = gateById.get('pg_runtime_dependency');
  const lockfileGate = gateById.get('pg_lockfile_entry');
  const importGate = gateById.get('runtime_import_allowed');
  const blockedGates = result.gates.filter((item) => item.status === 'blocked');

  for (const gateId of [
    'pg_runtime_dependency',
    'pg_lockfile_entry',
    'secret_manager_runtime',
    'target_database_selection',
    'backup_restore_evidence',
    'release_rollback_owner',
    'production_apply_approval',
    'formal_migration_apply',
    'runtime_import_allowed'
  ] satisfies PeriodClosePostgresDependencyGateId[]) {
    if (!gateById.has(gateId)) {
      errors.push(`period-close postgres dependency admission must include ${gateId} gate`);
    }
  }

  if (result.status === 'admitted') {
    if (!result.runtimeImportAllowed || blockedGates.length > 0) {
      errors.push('admitted postgres runtime dependency must have no blocked gates and must allow runtime import');
    }
  } else if (result.runtimeImportAllowed || importGate?.status === 'satisfied') {
    errors.push('non-admitted postgres runtime dependency must not allow runtime import');
  }

  if (result.status === 'runtime_dependency_not_declared' && runtimeDependencyGate?.status !== 'blocked') {
    errors.push('runtime_dependency_not_declared status must block pg runtime dependency gate');
  }

  if (result.status === 'lockfile_missing' && lockfileGate?.status !== 'blocked') {
    errors.push('lockfile_missing status must block pg lockfile gate');
  }

  if (result.status === 'blocked_by_operational_gates' && blockedGates.length === 0) {
    errors.push('blocked_by_operational_gates status must include at least one blocked operational gate');
  }

  if (result.pgManifestEvidence.includes('password') || result.pgLockfileEvidence.includes('password')) {
    errors.push('dependency admission evidence must not expose secret values');
  }

  return errors;
}
