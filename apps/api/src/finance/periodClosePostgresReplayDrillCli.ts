import { buildPeriodClosePostgresReplayDrillScript } from './periodClosePostgresReplayDrillContract.js';

declare const process: {
  stdout: {
    write: (content: string) => void;
  };
};

const script = buildPeriodClosePostgresReplayDrillScript();

process.stdout.write(`${script.sql}\n`);
