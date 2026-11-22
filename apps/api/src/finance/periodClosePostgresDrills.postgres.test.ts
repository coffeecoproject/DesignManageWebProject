// Period-close PostgreSQL drills against a real database. `scripts/testpace/files.sh` starts a throwaway napbox
// Postgres for `*.postgres.test.ts` files and passes the psql command in STARTUPMANAGE_TEST_PSQL.
import { spawn } from 'node:child_process';
import { expect, it } from 'vitest';
import { buildPeriodClosePostgresApplyDrillScript } from './periodClosePostgresApplyDrillContract.js';
import { buildPeriodClosePostgresConcurrencyDrillScriptSet } from './periodClosePostgresConcurrencyDrillContract.js';
import { buildPeriodClosePostgresDryRunScript } from './periodClosePostgresDryRunContract.js';
import { buildPeriodClosePostgresReplayDrillScript } from './periodClosePostgresReplayDrillContract.js';

type PsqlResult = { code: number; output: string };

function psqlCommand() {
  const command = process.env.STARTUPMANAGE_TEST_PSQL;

  if (!command) {
    throw new Error(
      'STARTUPMANAGE_TEST_PSQL is not set: run Postgres tests through `testpace files`, which starts a napbox temp database'
    );
  }

  return command;
}

function runPsql(sql: string, extraArgs = ''): Promise<PsqlResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-c', `${psqlCommand()} -v ON_ERROR_STOP=1 ${extraArgs}`], { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';

    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
    child.stdin.end(sql);
  });
}

async function runPsqlOk(sql: string) {
  const result = await runPsql(sql);

  expect(result.code, result.output).toBe(0);

  return result.output;
}

let schemaSequence = 0;

function drillSchemaName(kind: string) {
  schemaSequence += 1;

  return `period_close_drill_${kind}_${process.pid}_${Date.now()}_${schemaSequence}`;
}

async function waitForHolderLock(applicationName: string) {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    const result = await runPsql(
      `SELECT count(*) FROM pg_stat_activity WHERE application_name = '${applicationName}' AND wait_event = 'PgSleep';`,
      '-At'
    );

    if (result.code === 0 && result.output.trim() === '1') {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`holder session ${applicationName} did not reach pg_sleep while holding the row lock`);
}

it('runs the period-close migration dry-run inside a rolled-back transaction', async () => {
  const output = await runPsqlOk(buildPeriodClosePostgresDryRunScript().sql);

  expect(output).toContain('period_close_postgres_migration_dry_run_passed');
});

it('applies the period-close migration into an isolated schema and drops it', async () => {
  const schemaName = drillSchemaName('apply');
  const output = await runPsqlOk(buildPeriodClosePostgresApplyDrillScript({ schemaName }).sql);
  expect(output).toContain('period_close_postgres_apply_drill_passed');

  const remaining = await runPsql(`SELECT count(*) FROM pg_namespace WHERE nspname = '${schemaName}';`, '-At');
  expect(remaining.output.trim()).toBe('0');
});

it('replays persisted period-close records in an isolated schema and drops it', async () => {
  const schemaName = drillSchemaName('replay');
  const output = await runPsqlOk(buildPeriodClosePostgresReplayDrillScript({ schemaName }).sql);
  expect(output).toContain('period_close_postgres_replay_drill_passed');

  const remaining = await runPsql(`SELECT count(*) FROM pg_namespace WHERE nspname = '${schemaName}';`, '-At');
  expect(remaining.output.trim()).toBe('0');
});

it('makes a second session time out on the period row lock held by the first', async () => {
  const schemaName = drillSchemaName('concurrency');
  const { scripts } = buildPeriodClosePostgresConcurrencyDrillScriptSet({ schemaName });
  const holderName = `${schemaName}_holder`;

  await runPsqlOk(scripts.setup);

  try {
    const holder = runPsql(`SET application_name = '${holderName}';\n${scripts['hold-lock']}`);
    await waitForHolderLock(holderName);

    const contender = await runPsql(scripts['contend-lock']);
    expect(contender.code, contender.output).not.toBe(0);
    expect(contender.output).toMatch(/lock timeout/);

    const held = await holder;
    expect(held.code, held.output).toBe(0);
    expect(held.output).toContain('period_close_postgres_concurrency_holder_released');

    expect(await runPsqlOk(scripts.verify)).toContain('period_close_postgres_concurrency_drill_passed');
  } finally {
    await runPsql(scripts.cleanup);
  }
});
