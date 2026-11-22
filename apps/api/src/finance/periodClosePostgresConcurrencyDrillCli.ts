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

const section = process.argv[2] as PeriodClosePostgresConcurrencyDrillSection | undefined;

if (!section) {
  process.stderr.write('Usage: periodClosePostgresConcurrencyDrillCli <setup|hold-lock|contend-lock|verify>\n');
  process.exit(1);
}

const scriptSet = buildPeriodClosePostgresConcurrencyDrillScriptSet();
const script = scriptSet.scripts[section];

if (!script) {
  process.stderr.write(`Unknown period-close concurrency drill section ${section}\n`);
  process.exit(1);
}

process.stdout.write(`${script}\n`);
