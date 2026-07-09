import { buildPeriodClosePostgresDryRunScript } from './periodClosePostgresDryRunContract.js';

declare const process: {
  stdout: {
    write: (content: string) => void;
  };
};

const script = buildPeriodClosePostgresDryRunScript();

process.stdout.write(`${script.sql}\n`);
