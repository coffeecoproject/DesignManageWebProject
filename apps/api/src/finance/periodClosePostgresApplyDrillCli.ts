import { buildPeriodClosePostgresApplyDrillScript } from './periodClosePostgresApplyDrillContract.js';

declare const process: {
  stdout: {
    write: (content: string) => void;
  };
};

const script = buildPeriodClosePostgresApplyDrillScript();

process.stdout.write(`${script.sql}\n`);
