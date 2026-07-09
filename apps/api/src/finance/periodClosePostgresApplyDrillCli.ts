import { buildPeriodClosePostgresApplyDrillScript } from './periodClosePostgresApplyDrillContract.js';

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

if (!schemaName) {
  process.stderr.write('Usage: periodClosePostgresApplyDrillCli <period_close_drill_schema>\n');
  process.exit(1);
}

const script = buildPeriodClosePostgresApplyDrillScript({ schemaName });

process.stdout.write(`${script.sql}\n`);
