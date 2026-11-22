import {
  buildPeriodCloseMigrationFormalApplyReview,
  validatePeriodCloseMigrationFormalApplyReview,
  type PeriodCloseMigrationFormalApplyReview
} from './periodCloseMigrationFormalApplyReviewContract.js';

export type PeriodCloseMigrationOperationalGateReadiness = 'blocked_by_operational_gates';
export type PeriodCloseMigrationTargetEnvironment = 'local_drill_only' | 'shared_staging' | 'production';
export type PeriodCloseMigrationOperationalGateStatus = 'not_started';

export type PeriodCloseMigrationTargetDatabaseSelection = {
  allowedTargetEnvironments: PeriodCloseMigrationTargetEnvironment[];
  connectionStringRef: null;
  evidence: string;
  selectedEnvironment: null;
  secretRef: null;
  status: 'not_selected';
  targetDatabaseIdentifier: null;
};

export type PeriodCloseMigrationBackupRestorePlan = {
  approvedBy: null;
  backupEvidenceRef: null;
  backupPlanStatus: PeriodCloseMigrationOperationalGateStatus;
  evidence: string;
  restoreDrillEvidenceRef: null;
  restoreDrillStatus: PeriodCloseMigrationOperationalGateStatus;
  rollbackWindow: 'must_be_defined_before_formal_apply';
  status: PeriodCloseMigrationOperationalGateStatus;
};

export type PeriodCloseMigrationOperationalOwnership = {
  evidence: string;
  releaseOwner: null;
  releaseOwnerStatus: PeriodCloseMigrationOperationalGateStatus;
  rollbackOwner: null;
  rollbackOwnerStatus: PeriodCloseMigrationOperationalGateStatus;
};

export type PeriodCloseMigrationProductionApplyApproval = {
  approvedBy: null;
  approvalEvidenceRef: null;
  evidence: string;
  status: PeriodCloseMigrationOperationalGateStatus;
};

export type PeriodCloseMigrationOperationalGateContract = {
  backupRestorePlan: PeriodCloseMigrationBackupRestorePlan;
  forbiddenBeforeOperationalApproval: string[];
  formalApplyReview: PeriodCloseMigrationFormalApplyReview;
  operationalReadiness: PeriodCloseMigrationOperationalGateReadiness;
  ownership: PeriodCloseMigrationOperationalOwnership;
  productionApplyApproval: PeriodCloseMigrationProductionApplyApproval;
  reviewedAt: string;
  reviewer: string;
  scope: 'period_close_persistent_lock';
  targetDatabaseSelection: PeriodCloseMigrationTargetDatabaseSelection;
};

const defaultReviewedAt = '2026-07-05T01:00:00.000Z';
const operationalChecklistIds = [
  'target_database_selection_required',
  'backup_restore_plan_required',
  'release_owner_required',
  'rollback_owner_required',
  'production_apply_approval_required'
];

export function buildPeriodCloseMigrationOperationalGateContract({
  formalApplyReview = buildPeriodCloseMigrationFormalApplyReview(),
  reviewedAt = defaultReviewedAt,
  reviewer = 'local-operational-gate-review'
}: {
  formalApplyReview?: PeriodCloseMigrationFormalApplyReview;
  reviewedAt?: string;
  reviewer?: string;
} = {}): PeriodCloseMigrationOperationalGateContract {
  return {
    backupRestorePlan: {
      approvedBy: null,
      backupEvidenceRef: null,
      backupPlanStatus: 'not_started',
      evidence: 'backup and restore drill evidence must be approved before formal apply',
      restoreDrillEvidenceRef: null,
      restoreDrillStatus: 'not_started',
      rollbackWindow: 'must_be_defined_before_formal_apply',
      status: 'not_started'
    },
    forbiddenBeforeOperationalApproval: [
      'target_database_connection',
      'shared_database_connection',
      'production_database_connection',
      'secret_injection',
      'formal_schema_apply',
      'backup_restore_claim',
      'release_execution'
    ],
    formalApplyReview,
    operationalReadiness: 'blocked_by_operational_gates',
    ownership: {
      evidence: 'release owner and rollback owner must be recorded before formal apply',
      releaseOwner: null,
      releaseOwnerStatus: 'not_started',
      rollbackOwner: null,
      rollbackOwnerStatus: 'not_started'
    },
    productionApplyApproval: {
      approvedBy: null,
      approvalEvidenceRef: null,
      evidence: 'explicit manual approval is required before applying to any shared or production database',
      status: 'not_started'
    },
    reviewedAt,
    reviewer,
    scope: 'period_close_persistent_lock',
    targetDatabaseSelection: {
      allowedTargetEnvironments: ['local_drill_only', 'shared_staging', 'production'],
      connectionStringRef: null,
      evidence: 'target database/environment must be selected before formal apply',
      selectedEnvironment: null,
      secretRef: null,
      status: 'not_selected',
      targetDatabaseIdentifier: null
    }
  };
}

function operationalChecklistStatusById(review: PeriodCloseMigrationFormalApplyReview) {
  return new Map(review.checklist.map((item) => [item.id, item.status]));
}

export function validatePeriodCloseMigrationOperationalGateContract(
  contract: PeriodCloseMigrationOperationalGateContract = buildPeriodCloseMigrationOperationalGateContract()
): string[] {
  const errors: string[] = [];
  const formalApplyReviewErrors = validatePeriodCloseMigrationFormalApplyReview(contract.formalApplyReview);
  const checklistStatusById = operationalChecklistStatusById(contract.formalApplyReview);

  errors.push(...formalApplyReviewErrors);

  if (contract.scope !== 'period_close_persistent_lock') {
    errors.push('period-close migration operational gates must keep the period-close persistent-lock scope');
  }

  if (contract.operationalReadiness !== 'blocked_by_operational_gates') {
    errors.push('period-close migration operational gates must remain blocked until target DB, backup, owner, and approval evidence exist');
  }

  for (const id of operationalChecklistIds) {
    if (!checklistStatusById.has(id)) {
      errors.push(`period-close migration operational gates require formal apply checklist item ${id}`);
    }

    if (checklistStatusById.get(id) !== 'not_started') {
      errors.push(`formal apply checklist item ${id} must stay not_started in local operational gate evidence`);
    }
  }

  if (contract.targetDatabaseSelection.status !== 'not_selected') {
    errors.push('target database selection must remain not_selected before explicit operational approval');
  }

  if (
    contract.targetDatabaseSelection.selectedEnvironment !== null ||
    contract.targetDatabaseSelection.targetDatabaseIdentifier !== null
  ) {
    errors.push('target database selection must not name a concrete database before operational approval');
  }

  if (contract.targetDatabaseSelection.connectionStringRef !== null || contract.targetDatabaseSelection.secretRef !== null) {
    errors.push('target database selection must not contain connection string or secret references');
  }

  if (
    contract.backupRestorePlan.status !== 'not_started' ||
    contract.backupRestorePlan.backupPlanStatus !== 'not_started' ||
    contract.backupRestorePlan.restoreDrillStatus !== 'not_started'
  ) {
    errors.push('backup and restore gates must remain not_started until real backup and restore evidence exists');
  }

  if (
    contract.backupRestorePlan.approvedBy !== null ||
    contract.backupRestorePlan.backupEvidenceRef !== null ||
    contract.backupRestorePlan.restoreDrillEvidenceRef !== null
  ) {
    errors.push('backup and restore gates must not claim approval or evidence before formal operations review');
  }

  if (contract.ownership.releaseOwnerStatus !== 'not_started' || contract.ownership.rollbackOwnerStatus !== 'not_started') {
    errors.push('release and rollback owner gates must remain not_started before explicit assignment evidence exists');
  }

  if (contract.ownership.releaseOwner !== null || contract.ownership.rollbackOwner !== null) {
    errors.push('release and rollback owner gates must not name owners before formal assignment evidence exists');
  }

  if (contract.productionApplyApproval.status !== 'not_started') {
    errors.push('production apply approval must remain not_started in local operational gate evidence');
  }

  if (contract.productionApplyApproval.approvedBy !== null || contract.productionApplyApproval.approvalEvidenceRef !== null) {
    errors.push('production apply approval must not claim approver or approval evidence before explicit approval');
  }

  for (const prohibitedOperation of [
    'target_database_connection',
    'production_database_connection',
    'formal_schema_apply',
    'backup_restore_claim'
  ]) {
    if (!contract.forbiddenBeforeOperationalApproval.includes(prohibitedOperation)) {
      errors.push(`period-close migration operational gates must prohibit ${prohibitedOperation} before approval`);
    }
  }

  return errors;
}
