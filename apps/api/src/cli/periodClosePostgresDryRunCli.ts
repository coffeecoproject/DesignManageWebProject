import { buildPeriodClosePostgresDryRunScript } from '../modules/finance/index.js';

declare const process: {
  stdout: {
    write: (content: string) => void;
  };
};

const script = buildPeriodClosePostgresDryRunScript();

process.stdout.write(`${script.sql}\n`);
