import type { PeriodClosePostgresRuntimeAdmissionEvidence } from './periodClosePostgresDependencyAdmissionContract.js';
import type { PeriodCloseMigrationOperationalGateContract } from './periodCloseMigrationOperationalGateContract.js';
import {
  validatePeriodClosePostgresPoolRuntimeConfig,
  type PeriodClosePostgresPoolRuntimeConfig,
  type PeriodClosePostgresRuntimeEnvironment
} from './periodClosePostgresPoolFactoryContract.js';
import type { PeriodClosePostgresSecretSource } from './periodClosePostgresSecretResolverContract.js';

export type PeriodClosePostgresRuntimeReadinessStatus = 'blocked' | 'ready';
export type PeriodClosePostgresRuntimeReadinessGateStatus = 'blocked' | 'satisfied';
export type PeriodClosePostgresRuntimeReadinessGateId =
  | 'backup_restore_evidence'
  | 'formal_migration_apply'
  | 'pool_runtime_config'
  | 'production_apply_approval'
  | 'release_rollback_owner'
  | 'secret_manager_runtime'
  | 'target_database_selection';

export type PeriodClosePostgresRuntimeReadinessGate = {
  evidence: string;
  gate: PeriodClosePostgresRuntimeReadinessGateId;
  status: PeriodClosePostgresRuntimeReadinessGateStatus;
};

export type PeriodClosePostgresRuntimeTargetDatabase = {
  database?: string;
  environment?: PeriodClosePostgresRuntimeEnvironment;
  evidenceId?: string;
  host?: string;
  port?: number;
  selectedEnvironment?: 'local_drill_only' | 'production' | 'shared_staging';
  status: 'not_selected' | 'selected';
  user?: string;
};

export type PeriodClosePostgresRuntimeSecretEvidence = {
  accessPolicyEvidenceId?: string;
  reference?: string;
  rotationEvidenceId?: string;
  source?: PeriodClosePostgresSecretSource;
  status: 'not_ready' | 'ready';
  targetDatabaseEvidenceId?: string;
};

export type PeriodClosePostgresRuntimeBackupRestoreEvidence = {
  backupEvidenceId?: string;
  restoreDrillEvidenceId?: string;
  status: 'approved' | 'not_started';
};

export type PeriodClosePostgresRuntimeOwnershipEvidence = {
  releaseOwner?: string;
  rollbackOwner?: string;
  status: 'assigned' | 'not_started';
};

export type PeriodClosePostgresRuntimeProductionApplyApproval = {
  approvalEvidenceId?: string;
  approvedBy?: string;
  status: 'approved' | 'not_started';
};

export type PeriodClosePostgresRuntimeFormalMigrationApply = {
  appliedAt?: string;
  applyEvidenceId?: string;
  artifactFilePath?: string;
  status: 'applied' | 'not_applied';
};

export type PeriodClosePostgresRuntimePoolPolicy = {
  applicationName: string;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
  maxConnections: number;
  statementTimeoutMs: number;
};

export type PeriodClosePostgresRuntimeReadinessPackage = {
  backupRestore: PeriodClosePostgresRuntimeBackupRestoreEvidence;
  formalMigrationApply: PeriodClosePostgresRuntimeFormalMigrationApply;
  ownership: PeriodClosePostgresRuntimeOwnershipEvidence;
  poolPolicy: PeriodClosePostgresRuntimePoolPolicy;
  productionApplyApproval: PeriodClosePostgresRuntimeProductionApplyApproval;
  reviewedAt: string;
  reviewer: string;
  scope: 'period_close_persistent_lock';
  secret: PeriodClosePostgresRuntimeSecretEvidence;
  targetDatabase: PeriodClosePostgresRuntimeTargetDatabase;
};

export type PeriodClosePostgresRuntimeReadinessResult = {
  gates: PeriodClosePostgresRuntimeReadinessGate[];
  poolConfig?: PeriodClosePostgresPoolRuntimeConfig;
  reviewedAt: string;
  reviewer: string;
  runtimeEvidence: PeriodClosePostgresRuntimeAdmissionEvidence;
  status: PeriodClosePostgresRuntimeReadinessStatus;
  traceErrors: string[];
};

const defaultPoolPolicy: PeriodClosePostgresRuntimePoolPolicy = {
  applicationName: 'startupmanage-period-close-runtime-readiness',
  connectionTimeoutMs: 1_000,
  idleTimeoutMs: 10_000,
  maxConnections: 4,
  statementTimeoutMs: 5_000
};

function gate(
  gateId: PeriodClosePostgresRuntimeReadinessGateId,
  status: PeriodClosePostgresRuntimeReadinessGateStatus,
  evidence: string
): PeriodClosePostgresRuntimeReadinessGate {
  return {
    evidence,
    gate: gateId,
    status
  };
}

function isProductionTarget(targetDatabase: PeriodClosePostgresRuntimeTargetDatabase) {
  return targetDatabase.environment === 'production' || targetDatabase.selectedEnvironment === 'production';
}

function targetDatabaseReady(targetDatabase: PeriodClosePostgresRuntimeTargetDatabase) {
  return (
    targetDatabase.status === 'selected' &&
    Boolean(targetDatabase.database) &&
    Boolean(targetDatabase.environment) &&
    Boolean(targetDatabase.evidenceId) &&
    Boolean(targetDatabase.host) &&
    Boolean(targetDatabase.port) &&
    Boolean(targetDatabase.user)
  );
}

function secretReady({
  secret,
  targetDatabase
}: {
  secret: PeriodClosePostgresRuntimeSecretEvidence;
  targetDatabase: PeriodClosePostgresRuntimeTargetDatabase;
}) {
  if (secret.status !== 'ready' || !secret.reference?.startsWith('secret://')) {
    return false;
  }

  if (isProductionTarget(targetDatabase)) {
    return (
      secret.source === 'managed_secret_store' &&
      Boolean(secret.accessPolicyEvidenceId) &&
      Boolean(secret.rotationEvidenceId) &&
      Boolean(secret.targetDatabaseEvidenceId) &&
      secret.targetDatabaseEvidenceId === targetDatabase.evidenceId
    );
  }

  return Boolean(secret.targetDatabaseEvidenceId) && secret.targetDatabaseEvidenceId === targetDatabase.evidenceId;
}

function backupRestoreReady(backupRestore: PeriodClosePostgresRuntimeBackupRestoreEvidence) {
  return (
    backupRestore.status === 'approved' &&
    Boolean(backupRestore.backupEvidenceId) &&
    Boolean(backupRestore.restoreDrillEvidenceId)
  );
}

function ownershipReady(ownership: PeriodClosePostgresRuntimeOwnershipEvidence) {
  return ownership.status === 'assigned' && Boolean(ownership.releaseOwner) && Boolean(ownership.rollbackOwner);
}

function approvalReady(approval: PeriodClosePostgresRuntimeProductionApplyApproval) {
  return approval.status === 'approved' && Boolean(approval.approvedBy) && Boolean(approval.approvalEvidenceId);
}

function formalMigrationReady(formalMigrationApply: PeriodClosePostgresRuntimeFormalMigrationApply) {
  return (
    formalMigrationApply.status === 'applied' &&
    Boolean(formalMigrationApply.appliedAt) &&
    Boolean(formalMigrationApply.applyEvidenceId) &&
    Boolean(formalMigrationApply.artifactFilePath)
  );
}

function toPoolConfig(
  readinessPackage: PeriodClosePostgresRuntimeReadinessPackage
): PeriodClosePostgresPoolRuntimeConfig | undefined {
  const { targetDatabase } = readinessPackage;

  if (!targetDatabaseReady(targetDatabase) || !targetDatabase.environment) {
    return undefined;
  }

  return {
    applicationName: readinessPackage.poolPolicy.applicationName,
    backupRestoreEvidenceId: readinessPackage.backupRestore.backupEvidenceId,
    connectionTimeoutMs: readinessPackage.poolPolicy.connectionTimeoutMs,
    database: targetDatabase.database,
    environment: targetDatabase.environment,
    host: targetDatabase.host,
    idleTimeoutMs: readinessPackage.poolPolicy.idleTimeoutMs,
    maxConnections: readinessPackage.poolPolicy.maxConnections,
    passwordSecretRef: readinessPackage.secret.reference,
    port: targetDatabase.port,
    productionApplyApprovalId: readinessPackage.productionApplyApproval.approvalEvidenceId,
    releaseOwner: readinessPackage.ownership.releaseOwner,
    rollbackOwner: readinessPackage.ownership.rollbackOwner,
    sslMode: isProductionTarget(targetDatabase) ? 'require' : 'disable',
    statementTimeoutMs: readinessPackage.poolPolicy.statementTimeoutMs,
    targetDatabaseEvidenceId: targetDatabase.evidenceId,
    user: targetDatabase.user
  };
}

export function buildBlockedPeriodClosePostgresRuntimeReadinessPackageFromOperationalGate({
  operationalGate,
  reviewedAt = '2026-07-05T02:00:00.000Z',
  reviewer = 'local-runtime-readiness-review'
}: {
  operationalGate: PeriodCloseMigrationOperationalGateContract;
  reviewedAt?: string;
  reviewer?: string;
}): PeriodClosePostgresRuntimeReadinessPackage {
  return {
    backupRestore: {
      status: operationalGate.backupRestorePlan.status === 'not_started' ? 'not_started' : 'approved'
    },
    formalMigrationApply: {
      artifactFilePath: operationalGate.formalApplyReview.artifactFilePath,
      status: 'not_applied'
    },
    ownership: {
      status:
        operationalGate.ownership.releaseOwnerStatus === 'not_started' ||
        operationalGate.ownership.rollbackOwnerStatus === 'not_started'
          ? 'not_started'
          : 'assigned'
    },
    poolPolicy: defaultPoolPolicy,
    productionApplyApproval: {
      status: operationalGate.productionApplyApproval.status === 'not_started' ? 'not_started' : 'approved'
    },
    reviewedAt,
    reviewer,
    scope: 'period_close_persistent_lock',
    secret: {
      reference: operationalGate.targetDatabaseSelection.secretRef ?? undefined,
      status: operationalGate.targetDatabaseSelection.secretRef ? 'ready' : 'not_ready'
    },
    targetDatabase: {
      selectedEnvironment: operationalGate.targetDatabaseSelection.selectedEnvironment ?? undefined,
      status: operationalGate.targetDatabaseSelection.status === 'not_selected' ? 'not_selected' : 'selected'
    }
  };
}

export function derivePeriodClosePostgresRuntimeReadiness(
  readinessPackage: PeriodClosePostgresRuntimeReadinessPackage
): PeriodClosePostgresRuntimeReadinessResult {
  const traceErrors: string[] = [];

  if (readinessPackage.scope !== 'period_close_persistent_lock') {
    traceErrors.push('period-close postgres runtime readiness package must keep persistent-lock scope');
  }

  if (!readinessPackage.poolPolicy.applicationName.startsWith('startupmanage-period-close')) {
    traceErrors.push('period-close postgres runtime readiness package must use period-close application name');
  }

  const targetReady = targetDatabaseReady(readinessPackage.targetDatabase);
  const secretIsReady = secretReady({
    secret: readinessPackage.secret,
    targetDatabase: readinessPackage.targetDatabase
  });
  const backupReady = backupRestoreReady(readinessPackage.backupRestore);
  const ownersReady = ownershipReady(readinessPackage.ownership);
  const approvalIsReady = approvalReady(readinessPackage.productionApplyApproval);
  const migrationReady = formalMigrationReady(readinessPackage.formalMigrationApply);
  const poolConfig = toPoolConfig(readinessPackage);
  const poolConfigErrors = poolConfig ? validatePeriodClosePostgresPoolRuntimeConfig(poolConfig) : [];

  if (readinessPackage.targetDatabase.status === 'selected' && !targetReady) {
    traceErrors.push('selected target database must include environment, evidence id, host, port, database, and user');
  }

  if (readinessPackage.secret.status === 'ready' && !secretIsReady) {
    traceErrors.push('ready postgres secret must be secret://, scoped to target database evidence, and production-managed when needed');
  }

  if (readinessPackage.backupRestore.status === 'approved' && !backupReady) {
    traceErrors.push('approved backup/restore evidence must include backup and restore-drill evidence ids');
  }

  if (readinessPackage.ownership.status === 'assigned' && !ownersReady) {
    traceErrors.push('assigned ownership must include release and rollback owners');
  }

  if (readinessPackage.productionApplyApproval.status === 'approved' && !approvalIsReady) {
    traceErrors.push('approved production apply must include approver and approval evidence id');
  }

  if (readinessPackage.formalMigrationApply.status === 'applied' && !migrationReady) {
    traceErrors.push('formal migration apply must include applied time, apply evidence id, and artifact path');
  }

  traceErrors.push(...poolConfigErrors);

  const gates = [
    gate(
      'target_database_selection',
      targetReady ? 'satisfied' : 'blocked',
      targetReady
        ? `target database ${readinessPackage.targetDatabase.evidenceId} selected`
        : 'target database selection evidence is missing'
    ),
    gate(
      'secret_manager_runtime',
      secretIsReady ? 'satisfied' : 'blocked',
      secretIsReady
        ? `secret ${readinessPackage.secret.reference} is scoped to target database evidence`
        : 'secret manager runtime evidence is missing or inconsistent with target database'
    ),
    gate(
      'backup_restore_evidence',
      backupReady ? 'satisfied' : 'blocked',
      backupReady ? 'backup and restore drill evidence is approved' : 'backup and restore drill evidence is missing'
    ),
    gate(
      'release_rollback_owner',
      ownersReady ? 'satisfied' : 'blocked',
      ownersReady ? 'release and rollback owners are assigned' : 'release and rollback owner evidence is missing'
    ),
    gate(
      'production_apply_approval',
      approvalIsReady ? 'satisfied' : 'blocked',
      approvalIsReady ? 'production or shared-database apply approval exists' : 'production apply approval is missing'
    ),
    gate(
      'formal_migration_apply',
      migrationReady ? 'satisfied' : 'blocked',
      migrationReady ? 'formal project schema migration apply evidence exists' : 'formal migration apply evidence is missing'
    ),
    gate(
      'pool_runtime_config',
      poolConfig && poolConfigErrors.length === 0 ? 'satisfied' : 'blocked',
      poolConfig && poolConfigErrors.length === 0
        ? 'period-close postgres pool runtime config can be derived'
        : 'period-close postgres pool runtime config cannot be derived'
    )
  ];
  const runtimeEvidence: PeriodClosePostgresRuntimeAdmissionEvidence = {
    backupRestoreEvidenceReady: backupReady,
    formalMigrationApplyReady: migrationReady,
    productionApplyApproved: approvalIsReady,
    releaseRollbackOwnerReady: ownersReady,
    secretManagerRuntimeReady: secretIsReady,
    targetDatabaseSelected: targetReady
  };
  const status =
    traceErrors.length === 0 && gates.every((readinessGate) => readinessGate.status === 'satisfied')
      ? 'ready'
      : 'blocked';

  return {
    gates,
    ...(status === 'ready' && poolConfig ? { poolConfig } : {}),
    reviewedAt: readinessPackage.reviewedAt,
    reviewer: readinessPackage.reviewer,
    runtimeEvidence,
    status,
    traceErrors
  };
}
