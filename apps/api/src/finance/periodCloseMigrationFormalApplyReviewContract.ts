import {
  buildPeriodCloseProjectMigrationArtifact,
  validatePeriodCloseProjectMigrationArtifact,
  type PeriodCloseProjectMigrationArtifact
} from './periodCloseProjectMigrationArtifactContract.js';
import { periodCloseNotAppliedMigrationArtifactPath } from './periodCloseMigrationArtifactFileContract.js';

export type PeriodCloseMigrationReviewItemStatus = 'passed' | 'blocked';
export type PeriodCloseMigrationChecklistItemStatus = 'local_passed' | 'required' | 'not_started';
export type PeriodCloseMigrationFormalApplyReadiness = 'blocked_by_manual_gates';

export type PeriodCloseMigrationRollbackForwardFixReviewItem = {
  evidence: string;
  id: string;
  requirement: string;
  status: PeriodCloseMigrationReviewItemStatus;
};

export type PeriodCloseMigrationFormalApplyChecklistItem = {
  blockingEffect: 'blocks_formal_apply';
  evidence: string;
  id: string;
  owner: 'engineering' | 'finance' | 'operations' | 'manual_approval';
  status: PeriodCloseMigrationChecklistItemStatus;
};

export type PeriodCloseMigrationFormalApplyReview = {
  artifact: PeriodCloseProjectMigrationArtifact;
  artifactFilePath: string;
  checklist: PeriodCloseMigrationFormalApplyChecklistItem[];
  formalApplyReadiness: PeriodCloseMigrationFormalApplyReadiness;
  prohibitedBeforeApproval: string[];
  reviewedAt: string;
  reviewer: string;
  rollbackForwardFixReview: PeriodCloseMigrationRollbackForwardFixReviewItem[];
  scope: 'period_close_persistent_lock';
};

const defaultReviewedAt = '2026-07-05T00:00:00.000Z';
const requiredRollbackForwardFixReviewIds = [
  'no_destructive_rollback_after_formal_apply',
  'forward_fix_only_after_formal_apply',
  'isolated_rollback_only_before_formal_apply',
  'closed_period_source_rows_not_mutated',
  'artifact_remains_not_applied'
];
const requiredFormalApplyChecklistIds = [
  'not_applied_artifact_file_locked',
  'local_rollback_dry_run_passed',
  'isolated_apply_drill_passed',
  'persisted_replay_drill_passed',
  'row_lock_concurrency_drill_passed',
  'rollback_forward_fix_review_passed',
  'manual_schema_review_required',
  'target_database_selection_required',
  'backup_restore_plan_required',
  'release_owner_required',
  'rollback_owner_required',
  'production_apply_approval_required'
];

function buildRollbackForwardFixReview({
  artifact,
  artifactFilePath
}: {
  artifact: PeriodCloseProjectMigrationArtifact;
  artifactFilePath: string;
}): PeriodCloseMigrationRollbackForwardFixReviewItem[] {
  return [
    {
      evidence: artifact.rollbackStrategy,
      id: 'no_destructive_rollback_after_formal_apply',
      requirement: '正式 apply 后不得通过 destructive rollback 删除期间锁、源单守卫、结账快照或报表快照数据。',
      status: artifact.rollbackStrategy.includes('forward-fix') ? 'passed' : 'blocked'
    },
    {
      evidence: artifact.forwardFixStrategy,
      id: 'forward_fix_only_after_formal_apply',
      requirement: '正式 apply 后的修复只能走 additive forward-fix migration。',
      status: artifact.forwardFixStrategy.includes('additive') ? 'passed' : 'blocked'
    },
    {
      evidence: 'scripts/local/period-close-postgres-dry-run.sh',
      id: 'isolated_rollback_only_before_formal_apply',
      requirement: '正式 apply 前的回滚证明只来自 rollback-only dry-run 或隔离 schema 演练。',
      status: 'passed'
    },
    {
      evidence: 'apps/api/src/finance/periodCloseSourceMutationGuard.ts',
      id: 'closed_period_source_rows_not_mutated',
      requirement: '闭期源单守卫只能拒绝或审计，不得直接改写闭期源单业务行。',
      status: 'passed'
    },
    {
      evidence: artifactFilePath,
      id: 'artifact_remains_not_applied',
      requirement: '仓库内 SQL artifact 仍处于 not_applied，不得作为已执行 migration 记录。',
      status: artifact.formalApplyStatus === 'not_applied' ? 'passed' : 'blocked'
    }
  ];
}

function buildFormalApplyChecklist({
  artifactFilePath
}: {
  artifactFilePath: string;
}): PeriodCloseMigrationFormalApplyChecklistItem[] {
  return [
    {
      blockingEffect: 'blocks_formal_apply',
      evidence: artifactFilePath,
      id: 'not_applied_artifact_file_locked',
      owner: 'engineering',
      status: 'local_passed'
    },
    {
      blockingEffect: 'blocks_formal_apply',
      evidence: 'scripts/local/period-close-postgres-dry-run.sh',
      id: 'local_rollback_dry_run_passed',
      owner: 'engineering',
      status: 'local_passed'
    },
    {
      blockingEffect: 'blocks_formal_apply',
      evidence: 'scripts/local/period-close-postgres-apply-drill.sh',
      id: 'isolated_apply_drill_passed',
      owner: 'engineering',
      status: 'local_passed'
    },
    {
      blockingEffect: 'blocks_formal_apply',
      evidence: 'scripts/local/period-close-postgres-replay-drill.sh',
      id: 'persisted_replay_drill_passed',
      owner: 'engineering',
      status: 'local_passed'
    },
    {
      blockingEffect: 'blocks_formal_apply',
      evidence: 'scripts/local/period-close-postgres-concurrency-drill.sh',
      id: 'row_lock_concurrency_drill_passed',
      owner: 'engineering',
      status: 'local_passed'
    },
    {
      blockingEffect: 'blocks_formal_apply',
      evidence: 'apps/api/src/finance/periodCloseMigrationFormalApplyReviewContract.ts',
      id: 'rollback_forward_fix_review_passed',
      owner: 'engineering',
      status: 'local_passed'
    },
    {
      blockingEffect: 'blocks_formal_apply',
      evidence: 'manual schema review record before formal apply',
      id: 'manual_schema_review_required',
      owner: 'manual_approval',
      status: 'required'
    },
    {
      blockingEffect: 'blocks_formal_apply',
      evidence: 'target database/environment must be selected before formal apply',
      id: 'target_database_selection_required',
      owner: 'operations',
      status: 'not_started'
    },
    {
      blockingEffect: 'blocks_formal_apply',
      evidence: 'backup and restore plan must be approved before formal apply',
      id: 'backup_restore_plan_required',
      owner: 'operations',
      status: 'not_started'
    },
    {
      blockingEffect: 'blocks_formal_apply',
      evidence: 'release owner must be recorded before formal apply',
      id: 'release_owner_required',
      owner: 'operations',
      status: 'not_started'
    },
    {
      blockingEffect: 'blocks_formal_apply',
      evidence: 'rollback/forward-fix owner must be recorded before formal apply',
      id: 'rollback_owner_required',
      owner: 'operations',
      status: 'not_started'
    },
    {
      blockingEffect: 'blocks_formal_apply',
      evidence: 'explicit manual approval is required before applying to any shared or production database',
      id: 'production_apply_approval_required',
      owner: 'manual_approval',
      status: 'not_started'
    }
  ];
}

export function buildPeriodCloseMigrationFormalApplyReview({
  artifact = buildPeriodCloseProjectMigrationArtifact(),
  artifactFilePath = periodCloseNotAppliedMigrationArtifactPath,
  reviewedAt = defaultReviewedAt,
  reviewer = 'local-contract-review'
}: {
  artifact?: PeriodCloseProjectMigrationArtifact;
  artifactFilePath?: string;
  reviewedAt?: string;
  reviewer?: string;
} = {}): PeriodCloseMigrationFormalApplyReview {
  return {
    artifact,
    artifactFilePath,
    checklist: buildFormalApplyChecklist({ artifactFilePath }),
    formalApplyReadiness: 'blocked_by_manual_gates',
    prohibitedBeforeApproval: [
      'formal_schema_apply',
      'shared_database_connection',
      'production_database_connection',
      'auto_apply',
      'destructive_rollback'
    ],
    reviewedAt,
    reviewer,
    rollbackForwardFixReview: buildRollbackForwardFixReview({ artifact, artifactFilePath }),
    scope: 'period_close_persistent_lock'
  };
}

function hasId<T extends { id: string }>(items: readonly T[], id: string) {
  return items.some((item) => item.id === id);
}

export function validatePeriodCloseMigrationFormalApplyReview(
  review: PeriodCloseMigrationFormalApplyReview = buildPeriodCloseMigrationFormalApplyReview()
): string[] {
  const errors: string[] = [];
  const artifactErrors = validatePeriodCloseProjectMigrationArtifact(review.artifact);
  const checklistById = new Map(review.checklist.map((item) => [item.id, item]));

  errors.push(...artifactErrors);

  if (review.scope !== 'period_close_persistent_lock') {
    errors.push('period-close migration formal apply review must keep the period-close persistent-lock scope');
  }

  if (!review.artifactFilePath.endsWith(`/not-applied/${review.artifact.filename}`)) {
    errors.push('formal apply review must reference the not-applied artifact file');
  }

  if (review.artifact.formalApplyStatus !== 'not_applied') {
    errors.push('formal apply review must not claim an already-applied artifact');
  }

  if (review.formalApplyReadiness !== 'blocked_by_manual_gates') {
    errors.push('formal apply review must remain blocked until manual gates and target database evidence exist');
  }

  if (!review.prohibitedBeforeApproval.includes('formal_schema_apply')) {
    errors.push('formal apply review must prohibit schema apply before explicit approval');
  }

  if (!review.prohibitedBeforeApproval.includes('destructive_rollback')) {
    errors.push('formal apply review must prohibit destructive rollback');
  }

  for (const id of requiredRollbackForwardFixReviewIds) {
    if (!hasId(review.rollbackForwardFixReview, id)) {
      errors.push(`formal apply review is missing rollback/forward-fix review item ${id}`);
    }
  }

  for (const item of review.rollbackForwardFixReview) {
    if (item.status !== 'passed') {
      errors.push(`rollback/forward-fix review item ${item.id} must pass before formal apply review can be used`);
    }
  }

  for (const id of requiredFormalApplyChecklistIds) {
    if (!checklistById.has(id)) {
      errors.push(`formal apply checklist is missing item ${id}`);
    }
  }

  const reviewChecklistItem = checklistById.get('rollback_forward_fix_review_passed');
  if (reviewChecklistItem?.status !== 'local_passed') {
    errors.push('formal apply checklist must mark rollback/forward-fix review as locally passed');
  }

  const productionApprovalItem = checklistById.get('production_apply_approval_required');
  if (productionApprovalItem?.status !== 'not_started') {
    errors.push('formal apply checklist must keep production apply approval not_started in local evidence');
  }

  const manualOrOperationalBlockers = review.checklist.filter(
    (item) => item.status !== 'local_passed' && item.blockingEffect === 'blocks_formal_apply'
  );
  if (manualOrOperationalBlockers.length === 0) {
    errors.push('formal apply checklist must retain manual or operational blockers before real DB apply');
  }

  return errors;
}
