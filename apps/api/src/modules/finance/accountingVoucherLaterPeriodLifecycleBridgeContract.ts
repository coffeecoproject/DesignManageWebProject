import { createStableSnapshotHash } from './periodCloseContract.js';
import type {
  AccountingVoucherLaterPeriodAdjustmentCandidate,
  AccountingVoucherLaterPeriodAdjustmentFact
} from './accountingVoucherLaterPeriodAdjustmentContract.js';
import type {
  AccountingVoucherLifecycleLine,
  AccountingVoucherLifecycleRecord,
  AccountingVoucherSourceSnapshot
} from './accountingVoucherLifecycleContract.js';
import type { AccountingPeriodVoucherCountSourceRow } from './periodCloseVoucherSummaryContract.js';

export type AccountingVoucherLaterPeriodLifecycleInput = {
  lines: AccountingVoucherLifecycleLine[];
  sourceSnapshot: AccountingVoucherSourceSnapshot;
};

export type LaterPeriodAdjustmentSubjectResolver = (subjectCode: string) => string | undefined;

export function createLaterPeriodAdjustmentLifecycleInput({
  candidate,
  resolveSubjectName
}: {
  candidate: AccountingVoucherLaterPeriodAdjustmentCandidate;
  resolveSubjectName: LaterPeriodAdjustmentSubjectResolver;
}): AccountingVoucherLaterPeriodLifecycleInput {
  const sourceSnapshotBase = {
    accountingPeriod: candidate.accountingPeriod,
    amount: candidate.amount,
    businessType: candidate.businessType,
    sourceId: candidate.id,
    sourceModule: '会计凭证',
    sourceNo: candidate.sourceNo,
    sourceTitle: candidate.sourceTitle,
    sourceVersion: 1,
    voucherDate: candidate.voucherDate
  };

  return {
    lines: candidate.lines.map((line) => ({
      ...line,
      subjectName: resolveSubjectName(line.subjectCode) ?? `未配置科目 ${line.subjectCode}`
    })),
    sourceSnapshot: {
      ...sourceSnapshotBase,
      sourceHash: createStableSnapshotHash({
        ...sourceSnapshotBase,
        lines: candidate.lines,
        sourceRefs: candidate.sourceRefs,
        sourceType: candidate.sourceType,
        summary: candidate.summary
      })
    }
  };
}

export function upsertPeriodCloseVoucherRowFromLifecycle({
  rows,
  voucher
}: {
  rows: readonly AccountingPeriodVoucherCountSourceRow[];
  voucher: AccountingVoucherLifecycleRecord;
}): AccountingPeriodVoucherCountSourceRow[] {
  const sourceCandidateId = voucher.sourceSnapshot.sourceId;
  const nextRow: AccountingPeriodVoucherCountSourceRow = {
    accountingPeriod: voucher.accountingPeriod,
    id: voucher.id,
    sourceModule: '会计凭证',
    sourceNo: voucher.voucherNo,
    status: voucher.status
  };

  return [
    nextRow,
    ...rows.filter((row) => row.id !== voucher.id && row.id !== sourceCandidateId)
  ].map((row) => ({ ...row }));
}

export function updateLaterPeriodAdjustmentFactsFromLifecycle({
  facts,
  voucher
}: {
  facts: readonly AccountingVoucherLaterPeriodAdjustmentFact[];
  voucher: AccountingVoucherLifecycleRecord;
}): AccountingVoucherLaterPeriodAdjustmentFact[] {
  const sourceCandidateId = voucher.sourceSnapshot.sourceId;
  const sourceFactId = sourceCandidateId.startsWith('candidate-later-adjustment-')
    ? sourceCandidateId.slice('candidate-later-adjustment-'.length)
    : sourceCandidateId;

  return facts.map((fact) => {
    const matchesLifecycleSource =
      fact.id === sourceFactId ||
      (
        fact.adjustmentNo === voucher.sourceSnapshot.sourceNo &&
        fact.adjustmentPeriod === voucher.accountingPeriod &&
        fact.amount === voucher.sourceSnapshot.amount
      );

    if (!matchesLifecycleSource) {
      return {
        ...fact,
        actorSnapshot: { ...fact.actorSnapshot }
      };
    }

    return {
      ...fact,
      status: '已制单'
    };
  });
}
