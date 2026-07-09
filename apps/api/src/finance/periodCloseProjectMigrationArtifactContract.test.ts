import {
  buildPeriodCloseProjectMigrationArtifact,
  computePeriodCloseProjectMigrationArtifactChecksum,
  renderPeriodCloseProjectMigrationArtifactSql,
  validatePeriodCloseProjectMigrationArtifact,
  type PeriodCloseProjectMigrationArtifact
} from './periodCloseProjectMigrationArtifactContract.js';
import { buildPeriodClosePostgresMigrationPlan } from './periodClosePostgresMigrationContract.js';

type UnitTest = {
  name: string;
  run: () => void;
};

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const tests: UnitTest[] = [
  {
    name: 'builds a review-only project migration artifact from the Postgres migration plan',
    run: () => {
      const artifact = buildPeriodCloseProjectMigrationArtifact();
      const errors = validatePeriodCloseProjectMigrationArtifact(artifact);

      assertEqual(errors.length, 0, `project migration artifact should validate: ${errors.join('; ')}`);
      assertEqual(artifact.artifactId, 'period-close-persistent-lock-postgres-v1', 'artifact identity should be stable');
      assertEqual(
        artifact.filename,
        '20260704_000001_period_close_persistent_lock.sql',
        'artifact filename should be stable and reviewable'
      );
      assertEqual(artifact.formalApplyStatus, 'not_applied', 'artifact should not claim formal project apply evidence');
      assertEqual(artifact.applyMode, 'manual_review_required', 'artifact should require manual review');
      assertEqual(artifact.requiresManualApproval, true, 'artifact should require manual approval');
      assertEqual(artifact.autoApply, false, 'artifact should not allow auto apply');
      assert(artifact.checksum.startsWith('fnv1a64:'), 'artifact should include a deterministic checksum');
      assert(artifact.statements.length > 0, 'artifact should carry executable DDL statements');
      assert(artifact.transactionRecipes.length > 0, 'artifact should carry transaction recipe provenance');
    }
  },
  {
    name: 'renders SQL with provenance header and without formal apply claims',
    run: () => {
      const artifact = buildPeriodCloseProjectMigrationArtifact();
      const sql = renderPeriodCloseProjectMigrationArtifactSql(artifact);

      assert(sql.includes('-- StartupManageSystem period-close project migration artifact.'), 'SQL should include a provenance header');
      assert(sql.includes('-- Formal apply status: not_applied'), 'SQL should retain not-applied status');
      assert(sql.includes('-- Apply mode: manual_review_required'), 'SQL should retain manual review status');
      assert(
        sql.includes('CREATE TABLE IF NOT EXISTS "accounting_periods"'),
        'SQL should include period lock table DDL'
      );
      assert(sql.includes('-- Transaction recipe: close_accounting_period'), 'SQL should retain transaction recipe summary');
      assert(!/\bCOMMIT\b/i.test(sql), 'project migration artifact should not include an implicit commit');
      assert(!sql.includes('production-ready'), 'project migration artifact should not claim production readiness');
    }
  },
  {
    name: 'rejects destructive migration statements even when metadata is otherwise valid',
    run: () => {
      const artifact = buildPeriodCloseProjectMigrationArtifact();
      const destructiveArtifact = {
        ...artifact,
        checksum: 'fnv1a64:0000000000000000',
        statements: [
          ...artifact.statements,
          {
            id: 'drop_period_close_table',
            phase: 'tables' as const,
            sql: 'DROP TABLE "accounting_periods";'
          }
        ]
      };
      const errors = validatePeriodCloseProjectMigrationArtifact(destructiveArtifact);

      assert(
        errors.some((error) => error.includes('destructive DDL/DML')),
        'validator should reject destructive SQL'
      );
    }
  },
  {
    name: 'rejects artifacts that bypass manual approval or claim formal apply',
    run: () => {
      const artifact = buildPeriodCloseProjectMigrationArtifact();
      const unsafeArtifact = {
        ...artifact,
        autoApply: true,
        requiresManualApproval: false
      } as unknown as PeriodCloseProjectMigrationArtifact;
      const errors = validatePeriodCloseProjectMigrationArtifact(unsafeArtifact);

      assert(
        errors.some((error) => error.includes('must require manual approval')),
        'validator should reject automatic apply or missing approval'
      );
    }
  },
  {
    name: 'requires every formal migration evidence gate before project apply',
    run: () => {
      const artifact = buildPeriodCloseProjectMigrationArtifact();
      const incompleteArtifact = {
        ...artifact,
        evidenceGates: artifact.evidenceGates.filter((gate) => gate.name !== 'production_apply_approval')
      };
      const errors = validatePeriodCloseProjectMigrationArtifact(incompleteArtifact);

      assert(
        errors.some((error) => error.includes('missing evidence gate production_apply_approval')),
        'validator should require explicit production apply approval evidence gate'
      );
    }
  },
  {
    name: 'changes checksum when migration statements change',
    run: () => {
      const plan = buildPeriodClosePostgresMigrationPlan();
      const originalChecksum = computePeriodCloseProjectMigrationArtifactChecksum(plan);
      const changedPlan = {
        ...plan,
        statements: plan.statements.map((statement, index) =>
          index === 0
            ? {
                ...statement,
                sql: `${statement.sql}\n-- harmless provenance change`
              }
            : statement
        )
      };
      const changedChecksum = computePeriodCloseProjectMigrationArtifactChecksum(changedPlan);

      assert(originalChecksum !== changedChecksum, 'checksum should change when the migration payload changes');
    }
  }
];

for (const test of tests) {
  test.run();
}
