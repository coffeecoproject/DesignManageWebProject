import type {
  AnnualExceptionConfigFormValue,
  AnnualExceptionConfigRow,
  AnnualExceptionRevision,
  AnnualExceptionStatus
} from './workCalendarTypes';

export type AnnualExceptionMutationResult = {
  message: string;
  success: boolean;
};

function getPreviousDate(dateText: string) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function isValidCalendarDate(dateText: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    return false;
  }
  const date = new Date(`${dateText}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dateText;
}

export function getLatestAnnualExceptionRevision(row: AnnualExceptionConfigRow | undefined) {
  return row?.revisions.length
    ? [...row.revisions].sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0]
    : undefined;
}

export function resolveAnnualExceptionRevision(
  row: AnnualExceptionConfigRow | undefined,
  date: Date
) {
  if (!row) {
    return undefined;
  }

  const dateKey = date.toISOString().slice(0, 10);
  const statusCandidates = row.statusPeriods?.filter(
    (period) => period.effectiveFrom <= dateKey && (!period.effectiveTo || period.effectiveTo >= dateKey)
  );
  const effectiveStatus = row.statusPeriods?.length
    ? (statusCandidates?.length === 1 ? statusCandidates[0]?.status : undefined)
    : row.status;
  if (effectiveStatus !== '已启用') {
    return undefined;
  }
  const candidates = row.revisions.filter(
    (revision) => revision.effectiveFrom <= dateKey && (!revision.effectiveTo || revision.effectiveTo >= dateKey)
  );

  return candidates.length === 1 ? candidates[0] : undefined;
}

export function applyAnnualExceptionStatusChange(
  row: AnnualExceptionConfigRow,
  status: AnnualExceptionStatus,
  effectiveFrom: string
): AnnualExceptionConfigRow {
  const sourcePeriods = row.statusPeriods?.length
    ? row.statusPeriods
    : [{ effectiveFrom: row.revisions[0]?.effectiveFrom ?? `${row.year}-01-01`, status: row.status }];
  const previousDate = getPreviousDate(effectiveFrom);
  const statusPeriods = sourcePeriods
    .filter((period) => period.effectiveFrom !== effectiveFrom)
    .map((period) => (
      period.effectiveFrom < effectiveFrom && (!period.effectiveTo || period.effectiveTo >= effectiveFrom)
        ? { ...period, effectiveTo: previousDate }
        : period
    ));

  return {
    ...row,
    status,
    statusPeriods: [...statusPeriods, { effectiveFrom, status }].sort((left, right) =>
      left.effectiveFrom.localeCompare(right.effectiveFrom)
    ),
    updatedAt: effectiveFrom
  };
}

export function validateAnnualExceptionRevisionTimeline(revisions: AnnualExceptionRevision[]) {
  const sortedRevisions = [...revisions].sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom));

  for (let index = 0; index < sortedRevisions.length; index += 1) {
    const revision = sortedRevisions[index];
    const previousRevision = sortedRevisions[index - 1];
    const effectiveYear = Number.parseInt(revision.effectiveFrom.slice(0, 4), 10);

    if (!isValidCalendarDate(revision.effectiveFrom) || Number.isNaN(effectiveYear)) {
      return { message: '节假日修订包含无效生效日期', success: false };
    }
    if (revision.effectiveTo && revision.effectiveFrom > revision.effectiveTo) {
      return { message: '节假日修订结束日期不能早于生效日期', success: false };
    }
    if (previousRevision && (!previousRevision.effectiveTo || previousRevision.effectiveTo >= revision.effectiveFrom)) {
      return { message: '节假日修订生效区间存在重叠', success: false };
    }
  }

  return { message: '', success: true };
}

export function applyAnnualExceptionRevisionChange(
  row: AnnualExceptionConfigRow,
  value: AnnualExceptionConfigFormValue,
  options: { actor: string; currentDate: string }
): { result: AnnualExceptionMutationResult; row: AnnualExceptionConfigRow } {
  const latestRevision = getLatestAnnualExceptionRevision(row);
  if (value.year !== row.year || !value.effectiveFrom.startsWith(`${row.year}-`)) {
    return {
      result: { message: '修订生效日期必须属于当前配置年度', success: false },
      row
    };
  }
  if (latestRevision && value.effectiveFrom <= latestRevision.effectiveFrom) {
    return {
      result: { message: `生效日期需晚于最新修订 ${latestRevision.effectiveFrom}`, success: false },
      row
    };
  }
  if (value.effectiveFrom < options.currentDate) {
    return {
      result: { message: '修订生效日期不能早于当前日期', success: false },
      row
    };
  }

  const revisionNumber = row.revisions.length + 1;
  const revision: AnnualExceptionRevision = {
    createdAt: options.currentDate,
    createdBy: options.actor,
    effectiveFrom: value.effectiveFrom,
    id: `${row.id}-r${revisionNumber}`,
    items: value.items.map((item) => ({ ...item })),
    revision: revisionNumber,
    source: value.source
  };
  const revisions = row.revisions.map((item) => (
    !item.effectiveTo && item.effectiveFrom < revision.effectiveFrom
      ? { ...item, effectiveTo: getPreviousDate(revision.effectiveFrom) }
      : item
  ));
  const nextRevisions = [...revisions, revision];
  const validation = validateAnnualExceptionRevisionTimeline(nextRevisions);
  if (!validation.success) {
    return { result: validation, row };
  }

  const currentRevision = resolveAnnualExceptionRevision(
    { ...row, revisions: nextRevisions },
    new Date(`${options.currentDate}T00:00:00Z`)
  );
  return {
    result: { message: `${row.year} 年法定节假日已新增修订`, success: true },
    row: {
      ...row,
      currentRevisionId: currentRevision?.id ?? row.currentRevisionId,
      revisions: nextRevisions,
      updatedAt: options.currentDate,
      updatedBy: options.actor
    }
  };
}
