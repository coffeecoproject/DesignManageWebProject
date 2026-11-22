// Period-close PostgreSQL drills against a real database. `scripts/testpace/files.sh` starts a throwaway napbox
// Postgres for `*.postgres.test.ts` files and passes the psql command (without a database) in
// STARTUPMANAGE_TEST_PSQL. The drills write to the default schema and do not clean up, so each one runs in its
// own empty database, created here and dropped afterwards.
import { spawn } from 'node:child_process';
import { expect, it } from 'vitest';
import { buildPeriodClosePostgresApplyDrillScript } from './periodClosePostgresApplyDrillContract.js';
import { buildPeriodClosePostgresConcurrencyDrillScriptSet } from './periodClosePostgresConcurrencyDrillContract.js';
import { buildPeriodClosePostgresDryRunScript } from './periodClosePostgresDryRunContract.js';
import { buildPeriodClosePostgresReplayDrillScript } from './periodClosePostgresReplayDrillContract.js';

type PsqlResult = { code: number; output: string };

// The database the Postgres service creates; used only to create and drop the per-drill databases.
const adminDatabase = 'startupmanage_local';

function psqlCommand() {
  const command = process.env.STARTUPMANAGE_TEST_PSQL;

  if (!command) {
    throw new Error(
      'STARTUPMANAGE_TEST_PSQL is not set: run Postgres tests through `testpace files`, which starts a napbox temp database'
    );
  }

  return command;
}

function runPsql(database: string, sql: string, extraArgs = ''): Promise<PsqlResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-c', `${psqlCommand()} -d ${database} -v ON_ERROR_STOP=1 ${extraArgs}`], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
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

async function runPsqlOk(database: string, sql: string) {
  const result = await runPsql(database, sql);

  expect(result.code, result.output).toBe(0);

  return result.output;
}

let databaseSequence = 0;

/** Runs a drill in its own empty database and drops the database afterwards. */
async function withDrillDatabase(kind: string, drill: (database: string) => Promise<void>) {
  databaseSequence += 1;
  const database = `period_close_${kind}_${process.pid}_${databaseSequence}`;

  await runPsqlOk(adminDatabase, `CREATE DATABASE ${database};`);

  try {
    await drill(database);
  } finally {
    await runPsql(adminDatabase, `DROP DATABASE IF EXISTS ${database} WITH (FORCE);`);
  }
}

async function waitForHolderLock(database: string, applicationName: string) {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    const result = await runPsql(
      database,
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
  await withDrillDatabase('dry_run', async (database) => {
    const output = await runPsqlOk(database, buildPeriodClosePostgresDryRunScript().sql);

    expect(output).toContain('period_close_postgres_migration_dry_run_passed');
  });
});

it('applies the period-close migration and fixture writes', async () => {
  await withDrillDatabase('apply', async (database) => {
    const output = await runPsqlOk(database, buildPeriodClosePostgresApplyDrillScript().sql);

    expect(output).toContain('period_close_postgres_apply_drill_passed');
  });
});

it('replays persisted period-close records idempotently', async () => {
  await withDrillDatabase('replay', async (database) => {
    const output = await runPsqlOk(database, buildPeriodClosePostgresReplayDrillScript().sql);

    expect(output).toContain('period_close_postgres_replay_drill_passed');
  });
});

it('makes a second session time out on the period row lock held by the first', async () => {
  await withDrillDatabase('concurrency', async (database) => {
    const { scripts } = buildPeriodClosePostgresConcurrencyDrillScriptSet();
    const holderName = `${database}_holder`;

    await runPsqlOk(database, scripts.setup);

    const holder = runPsql(database, `SET application_name = '${holderName}';\n${scripts['hold-lock']}`);
    await waitForHolderLock(database, holderName);

    const contender = await runPsql(database, scripts['contend-lock']);
    expect(contender.code, contender.output).not.toBe(0);
    expect(contender.output).toMatch(/lock timeout/);

    const held = await holder;
    expect(held.code, held.output).toBe(0);
    expect(held.output).toContain('period_close_postgres_concurrency_holder_released');

    expect(await runPsqlOk(database, scripts.verify)).toContain('period_close_postgres_concurrency_drill_passed');
  });
});
