import {
  buildPeriodClosePostgresConcurrencyDrillScriptSet,
  type PeriodClosePostgresConcurrencyDrillSection
} from './periodClosePostgresConcurrencyDrillContract.js';

declare const process: {
  argv: string[];
  exit: (code?: number) => never;
  stderr: {
    write: (content: string) => void;
  };
  stdout: {
    write: (content: string) => void;
  };
};

const schemaName = process.argv[2];
const section = process.argv[3] as PeriodClosePostgresConcurrencyDrillSection | undefined;

if (!schemaName || !section) {
  process.stderr.write(
    'Usage: periodClosePostgresConcurrencyDrillCli <period_close_drill_schema> <setup|hold-lock|contend-lock|verify|cleanup>\n'
  );
  process.exit(1);
}

const scriptSet = buildPeriodClosePostgresConcurrencyDrillScriptSet({ schemaName });
const script = scriptSet.scripts[section];

if (!script) {
  process.stderr.write(`Unknown period-close concurrency drill section ${section}\n`);
  process.exit(1);
}

process.stdout.write(`${script}\n`);
