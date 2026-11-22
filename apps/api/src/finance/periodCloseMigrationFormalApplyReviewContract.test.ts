import {
  buildPeriodCloseMigrationFormalApplyReview,
  validatePeriodCloseMigrationFormalApplyReview,
  type PeriodCloseMigrationFormalApplyReview
} from './periodCloseMigrationFormalApplyReviewContract.js';
import { buildPeriodCloseProjectMigrationArtifact } from './periodCloseProjectMigrationArtifactContract.js';
import { it } from 'vitest';
import { assert, assertEqual } from '../__tests__/assertions.js';

function cloneReview(review: PeriodCloseMigrationFormalApplyReview): PeriodCloseMigrationFormalApplyReview {
  return JSON.parse(JSON.stringify(review)) as PeriodCloseMigrationFormalApplyReview;
}

it('builds a rollback-forward-fix review that keeps formal apply blocked by manual gates', () => {
  const review = buildPeriodCloseMigrationFormalApplyReview();
  const errors = validatePeriodCloseMigrationFormalApplyReview(review);
  const productionApproval = review.checklist.find((item) => item.id === 'production_apply_approval_required');
  const rollbackForwardFixChecklist = review.checklist.find(
    (item) => item.id === 'rollback_forward_fix_review_passed'
  );

  assertEqual(errors.length, 0, `formal apply review should validate: ${errors.join('; ')}`);
  assertEqual(
    review.formalApplyReadiness,
    'blocked_by_manual_gates',
    'local review should not make the migration formally applyable'
  );
  assertEqual(
    rollbackForwardFixChecklist?.status,
    'local_passed',
    'rollback/forward-fix review should be locally passed'
  );
  assertEqual(
    productionApproval?.status,
    'not_started',
    'production apply approval must remain not started'
  );
  assert(
    review.rollbackForwardFixReview.every((item) => item.status === 'passed'),
    'every rollback/forward-fix review item should pass'
  );
  assert(
    review.prohibitedBeforeApproval.includes('formal_schema_apply'),
    'formal schema apply should be prohibited before approval'
  );
  assert(
    review.prohibitedBeforeApproval.includes('destructive_rollback'),
    'destructive rollback should be prohibited'
  );
});

it('rejects a review that claims formal apply readiness', () => {
  const review = cloneReview(buildPeriodCloseMigrationFormalApplyReview());
  const unsafeReview = {
    ...review,
    formalApplyReadiness: 'ready_for_apply'
  } as unknown as PeriodCloseMigrationFormalApplyReview;
  const errors = validatePeriodCloseMigrationFormalApplyReview(unsafeReview);

  assert(
    errors.some((error) => error.includes('must remain blocked')),
    'validator should reject readiness claims without manual gates'
  );
});

it('rejects destructive rollback strategy drift', () => {
  const artifact = buildPeriodCloseProjectMigrationArtifact();
  const review = buildPeriodCloseMigrationFormalApplyReview({
    artifact: {
      ...artifact,
      rollbackStrategy: 'Rollback by dropping period-close tables after formal apply.'
    }
  });
  const errors = validatePeriodCloseMigrationFormalApplyReview(review);

  assert(
    errors.some((error) => error.includes('rollback strategy must preserve forward-fix guidance')),
    'validator should reject artifact rollback guidance without forward-fix'
  );
  assert(
    errors.some((error) => error.includes('rollback/forward-fix review item')),
    'validator should reject failed rollback review items'
  );
});

it('rejects removing the production approval blocker', () => {
  const review = cloneReview(buildPeriodCloseMigrationFormalApplyReview());
  review.checklist = review.checklist.map((item) =>
    item.id === 'production_apply_approval_required'
      ? {
          ...item,
          status: 'local_passed'
        }
      : item
  );
  const errors = validatePeriodCloseMigrationFormalApplyReview(review);

  assert(
    errors.some((error) => error.includes('production apply approval not_started')),
    'validator should keep production approval as not started in local evidence'
  );
});

it('rejects missing rollback-forward-fix review coverage', () => {
  const review = cloneReview(buildPeriodCloseMigrationFormalApplyReview());
  review.rollbackForwardFixReview = review.rollbackForwardFixReview.filter(
    (item) => item.id !== 'closed_period_source_rows_not_mutated'
  );
  const errors = validatePeriodCloseMigrationFormalApplyReview(review);

  assert(
    errors.some((error) => error.includes('closed_period_source_rows_not_mutated')),
    'validator should require closed-period source-row safety coverage'
  );
});
