import {
  buildPeriodClosePostgresMigrationPlan,
  validatePeriodClosePostgresMigrationPlan
} from './periodClosePostgresMigrationContract.js';
import { periodCloseSqlMigrationContract } from './periodCloseSqlRepositoryContract.js';

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
    name: 'builds a non-destructive PostgreSQL 16 migration plan from the SQL repository contract',
    run: () => {
      const plan = buildPeriodClosePostgresMigrationPlan();
      const errors = validatePeriodClosePostgresMigrationPlan(plan);

      assertEqual(errors.length, 0, `Postgres migration plan should validate: ${errors.join('; ')}`);
      assertEqual(plan.destructive, false, 'migration plan should be non-destructive');
      assertEqual(plan.dialect, 'postgresql', 'migration dialect should be PostgreSQL');
      assertEqual(plan.minimumVersion, '16', 'migration should target local PostgreSQL major version');
      assertEqual(plan.sourceContractId, periodCloseSqlMigrationContract.id, 'plan should retain source contract identity');
      assert(
        !plan.statements.some((statement) => /\b(DROP|TRUNCATE|DELETE)\b/i.test(statement.sql)),
        'migration statements should not include destructive SQL'
      );
    }
  },
  {
    name: 'renders enum and table statements for every period-close controlled row set',
    run: () => {
      const plan = buildPeriodClosePostgresMigrationPlan();
      const statementById = new Map(plan.statements.map((statement) => [statement.id, statement]));

      for (const table of periodCloseSqlMigrationContract.tables) {
        const statement = statementById.get(`create_table_${table.name}`);

        assert(statement !== undefined, `${table.name} should have a CREATE TABLE statement`);
        assert(statement.sql.includes(`CREATE TABLE IF NOT EXISTS "${table.name}"`), `${table.name} should use safe table DDL`);
        assert(!statement.sql.includes('REFERENCES'), `${table.name} should defer foreign keys until all tables exist`);

        for (const column of table.columns) {
          assert(statement.sql.includes(`"${column.name}"`), `${table.name}.${column.name} should be rendered`);
        }
      }

      assert(
        statementById.get('create_type_accounting_period_status')?.sql.includes("'开放', '已结账', '已反结账'") === true,
        'accounting_period_status enum should preserve the business status values'
      );
      assert(
        statementById.get('create_type_accounting_period_close_check_group')?.sql.includes("'voucher_preparation'") === true,
        'close-check group enum should include canonical check codes'
      );
    }
  },
  {
    name: 'renders deferred foreign-key constraints after tables are created',
    run: () => {
      const plan = buildPeriodClosePostgresMigrationPlan();
      const statementById = new Map(plan.statements.map((statement) => [statement.id, statement]));
      const constraint = statementById.get('create_constraint_fk_accounting_periods_close_check_snapshot_id');

      assert(constraint !== undefined, 'cyclic close-check reference should be rendered as a deferred constraint statement');
      assertEqual(constraint.phase, 'constraints', 'foreign keys should be in the constraints phase');
      assert(
        constraint.sql.includes('ALTER TABLE "accounting_periods"'),
        'constraint statement should alter the existing accounting_periods table'
      );
      assert(
        constraint.sql.includes('REFERENCES "accounting_period_close_checks" ("id")'),
        'constraint statement should preserve the target table and column'
      );
    }
  },
  {
    name: 'renders required lock and idempotency indexes',
    run: () => {
      const plan = buildPeriodClosePostgresMigrationPlan();
      const sql = plan.statements.map((statement) => statement.sql).join('\n');

      assert(
        sql.includes(
          'CREATE INDEX IF NOT EXISTS "idx_accounting_periods_period_version_for_close_lock" ON "accounting_periods" ("period", "version");'
        ),
        'period/version lock lookup index should be rendered'
      );
      assert(
        sql.includes(
          'CREATE UNIQUE INDEX IF NOT EXISTS "uk_accounting_period_idempotency_period_operation_key" ON "accounting_period_idempotency_records" ("period", "operation", "idempotency_key");'
        ),
        'period-operation-idempotency unique index should be rendered'
      );
      assert(
        sql.includes(
          'CREATE INDEX IF NOT EXISTS "idx_accounting_period_source_mutation_events_source_created_at" ON "accounting_period_source_mutation_events" ("source_area", "source_id", "created_at");'
        ),
        'source mutation event lookup index should be rendered'
      );
    }
  },
  {
    name: 'documents PostgreSQL transaction recipes for period locks and source guards',
    run: () => {
      const plan = buildPeriodClosePostgresMigrationPlan();
      const closeRecipe = plan.transactionRecipes.find((recipe) => recipe.id === 'close_accounting_period');
      const sourceRecipe = plan.transactionRecipes.find((recipe) => recipe.id === 'guard_source_mutation');
      const snapshotRecipe = plan.transactionRecipes.find((recipe) => recipe.id === 'write_financial_statement_snapshot');

      assert(closeRecipe !== undefined, 'close transaction recipe should exist');
      assert(sourceRecipe !== undefined, 'source mutation transaction recipe should exist');
      assert(snapshotRecipe !== undefined, 'financial statement snapshot transaction recipe should exist');

      assert(closeRecipe.sql.includes('WHERE "period" = $1\nFOR UPDATE;'), 'close transaction should lock one period row');
      assert(
        closeRecipe.sql.includes('ON CONFLICT ("period", "operation", "idempotency_key") DO NOTHING;'),
        'close transaction should rely on the idempotency unique key'
      );
      assert(
        sourceRecipe.sql.includes('WHERE "period" = ANY($1::text[])\nFOR UPDATE;'),
        'source guard transaction should lock every affected period row'
      );
      assert(
        snapshotRecipe.sql.includes('INSERT INTO "financial_statement_general_ledger_lines"'),
        'snapshot transaction should write subject-level ledger snapshot rows'
      );
    }
  },
  {
    name: 'fails validation when a required transaction lock fragment is missing',
    run: () => {
      const plan = buildPeriodClosePostgresMigrationPlan();
      const brokenPlan = {
        ...plan,
        transactionRecipes: plan.transactionRecipes.map((recipe) =>
          recipe.id === 'close_accounting_period'
            ? {
                ...recipe,
                sql: recipe.sql.replace('FOR UPDATE;', '-- lock removed;')
              }
            : recipe
        )
      };
      const errors = validatePeriodClosePostgresMigrationPlan(brokenPlan);

      assert(
        errors.some((error) => error.includes('close_accounting_period transaction recipe is missing FOR UPDATE')),
        'validator should fail when close transaction no longer locks accounting_periods'
      );
    }
  }
];

for (const test of tests) {
  test.run();
}
