import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { frontendBusinessToday } from '../../app/frontendBusinessClock';
import {
  validateDefaultMasterDataStatusChange,
  type MasterDataMutationResult
} from './masterDataLifecycleModel';
import {
  getLatestWorkCalendarVersion,
  resolveWorkCalendarRule,
  validateEffectiveTimeline
} from './workCalendarRules';
import {
  type AnnualExceptionConfigFormValue,
  type AnnualExceptionConfigRow,
  type AnnualExceptionStatus,
  type WorkCalendarFormValue,
  type WorkCalendarRow,
  type WorkCalendarRuleVersion,
  type WorkCalendarStatus,
} from './workCalendarTypes';
import { applyAnnualExceptionRevisionChange, applyAnnualExceptionStatusChange } from './annualExceptionModel';
import {
  companyDefaultWorkCalendarValue,
  seedAnnualExceptionRows,
  seedWorkCalendarRows
} from './workCalendarSeedData';

export * from './workCalendarTypes';
export {
  companyDefaultWorkCalendarValue,
  defaultBigSmallAlternateWorkdays,
  defaultBigSmallFixedWorkdays,
  defaultDoubleWeekendWorkdays,
  defaultSingleWeekendWorkdays,
  defaultWorkCalendarId,
  statutoryHolidayItems2026,
  workCalendarBaselineEffectiveFrom
} from './workCalendarSeedData';

type WorkCalendarStateValue = {
  annualExceptionRows: AnnualExceptionConfigRow[];
  createAnnualExceptionConfig: (nextValue: AnnualExceptionConfigFormValue) => AnnualExceptionConfigRow;
  createWorkCalendar: (nextValue: WorkCalendarFormValue) => void;
  setDefaultWorkCalendar: (id: string, effectiveFrom: string) => MasterDataMutationResult;
  updateAnnualExceptionConfig: (id: string, nextValue: AnnualExceptionConfigFormValue) => MasterDataMutationResult;
  updateAnnualExceptionStatus: (id: string, status: AnnualExceptionStatus) => void;
  updateWorkCalendar: (id: string, nextValue: WorkCalendarFormValue) => MasterDataMutationResult;
  updateWorkCalendarStatus: (id: string, status: WorkCalendarStatus, activeMemberCount?: number) => MasterDataMutationResult;
  workCalendarRows: WorkCalendarRow[];
};

const prototypeToday = frontendBusinessToday;

export function isCompanyDefaultWorkCalendarValue(value?: string) {
  return !value || value === companyDefaultWorkCalendarValue;
}

function getNextWorkCalendarSequence(rows: WorkCalendarRow[]) {
  return (
    rows.reduce((maxSequence, row) => {
      const sequence = Number.parseInt(row.code.replace(/^CAL-\d{4}-/, ''), 10);
      return Number.isFinite(sequence) ? Math.max(maxSequence, sequence) : maxSequence;
    }, 0) + 1
  );
}

function getWorkCalendarDefaultPeriods(row: WorkCalendarRow) {
  if (row.defaultPeriods?.length) {
    return row.defaultPeriods;
  }

  return row.isDefault ? [{ effectiveFrom: row.effectiveFrom ?? '0001-01-01' }] : [];
}

export function hasCurrentOrFutureDefaultPeriod(row: WorkCalendarRow, currentDate = prototypeToday) {
  return getWorkCalendarDefaultPeriods(row).some(
    (period) => !period.effectiveTo || period.effectiveTo >= currentDate
  );
}

function isCalendarActiveOnDate(row: WorkCalendarRow, dateText: string) {
  if (!row.statusPeriods?.length) {
    return row.status === '启用';
  }

  return row.statusPeriods.some(
    (period) => period.status === '启用' && period.effectiveFrom <= dateText && (!period.effectiveTo || period.effectiveTo >= dateText)
  );
}

export function applyDefaultWorkCalendarChange(
  rows: WorkCalendarRow[],
  id: string,
  effectiveFrom: string,
  currentDate = prototypeToday
): { result: MasterDataMutationResult; rows: WorkCalendarRow[] } {
  const target = rows.find((row) => row.id === id);

  if (!target) {
    return { result: { message: '工作日历不存在', success: false }, rows };
  }
  if (effectiveFrom < currentDate) {
    return { result: { message: '默认日历生效日期不能早于当前日期', success: false }, rows };
  }
  if (!isCalendarActiveOnDate(target, effectiveFrom)) {
    return { result: { message: '停用期间的工作日历不能设为公司默认', success: false }, rows };
  }

  const currentDefault = rows.find((row) => getWorkCalendarDefaultPeriods(row).some(
    (period) => period.effectiveFrom <= effectiveFrom && (!period.effectiveTo || period.effectiveTo >= effectiveFrom)
  ));
  if (currentDefault?.id === id) {
    return { result: { message: '该工作日历在所选日期已经是公司默认', success: false }, rows };
  }

  const previousDate = getPreviousDate(effectiveFrom);
  const nextRows = rows.map((row) => {
    const retainedPeriods = getWorkCalendarDefaultPeriods(row)
      .filter((period) => period.effectiveFrom < effectiveFrom)
      .map((period) => (
        !period.effectiveTo || period.effectiveTo >= effectiveFrom
          ? { ...period, effectiveTo: previousDate }
          : period
      ));
    const defaultPeriods = row.id === id
      ? [...retainedPeriods, { effectiveFrom }]
      : retainedPeriods;
    const isDefault = defaultPeriods.some(
      (period) => period.effectiveFrom <= currentDate && (!period.effectiveTo || period.effectiveTo >= currentDate)
    );

    return {
      ...row,
      defaultPeriods,
      isDefault,
      updatedAt: row.id === id || row.id === currentDefault?.id ? currentDate : row.updatedAt
    };
  });

  const timelineValidation = nextRows.reduce<MasterDataMutationResult>(
    (result, row) => {
      if (!result.success) {
        return result;
      }
      return validateEffectiveTimeline(getWorkCalendarDefaultPeriods(row));
    },
    { success: true }
  );
  if (!timelineValidation.success) {
    return { result: timelineValidation, rows };
  }

  return {
    result: { message: `${target.name}将于 ${effectiveFrom} 成为公司默认日历`, success: true },
    rows: nextRows
  };
}

function appendWorkCalendarStatusPeriod(
  row: WorkCalendarRow,
  status: WorkCalendarStatus,
  effectiveFrom: string
) {
  const initialEffectiveFrom = row.effectiveFrom ?? row.versions?.[0]?.effectiveFrom ?? '0001-01-01';
  const sourcePeriods = row.statusPeriods?.length
    ? row.statusPeriods
    : [{ effectiveFrom: initialEffectiveFrom, status: row.status }];
  const previousDate = getPreviousDate(effectiveFrom);
  const closedPeriods = sourcePeriods
    .filter((period) => period.effectiveFrom !== effectiveFrom)
    .map((period) => (
      period.effectiveFrom < effectiveFrom && (!period.effectiveTo || period.effectiveTo >= effectiveFrom)
        ? { ...period, effectiveTo: previousDate }
        : period
    ));

  return [...closedPeriods, { effectiveFrom, status }].sort((left, right) =>
    left.effectiveFrom.localeCompare(right.effectiveFrom)
  );
}

function normalizeWorkCalendarValue(nextValue: WorkCalendarFormValue): WorkCalendarFormValue {
  return {
    alternateWorkdays: Array.from(new Set(nextValue.alternateWorkdays)),
    anchorDate: nextValue.type === '大小周' ? nextValue.anchorDate : undefined,
    effectiveFrom: nextValue.effectiveFrom,
    fixedWorkdays: Array.from(new Set(nextValue.fixedWorkdays)),
    name: nextValue.name.trim(),
    note: nextValue.note.trim(),
    startMode: nextValue.type === '大小周' ? nextValue.startMode ?? '单休周开始' : undefined,
    type: nextValue.type
  };
}

function getPreviousDate(dateText: string) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function createWorkCalendarVersion(
  rowId: string,
  value: WorkCalendarFormValue,
  version: number
): WorkCalendarRuleVersion {
  return {
    alternateWorkdays: value.alternateWorkdays,
    anchorDate: value.anchorDate,
    createdAt: prototypeToday,
    effectiveFrom: value.effectiveFrom,
    fixedWorkdays: value.fixedWorkdays,
    id: `${rowId}-v${version}`,
    note: value.note,
    startMode: value.startMode,
    type: value.type,
    version
  };
}

export function applyWorkCalendarRuleChange(
  rows: WorkCalendarRow[],
  id: string,
  nextValue: WorkCalendarFormValue,
  currentDate = prototypeToday
): { result: MasterDataMutationResult; rows: WorkCalendarRow[] } {
  const target = rows.find((row) => row.id === id);
  if (!target) {
    return { result: { message: '工作日历不存在', success: false }, rows };
  }

  const normalizedValue = normalizeWorkCalendarValue(nextValue);
  const latestVersion = getLatestWorkCalendarVersion(target);
  if (latestVersion && normalizedValue.effectiveFrom <= latestVersion.effectiveFrom) {
    return {
      result: {
        message: `生效日期需晚于最新版本 ${latestVersion.effectiveFrom}`,
        success: false
      },
      rows
    };
  }

  const version = createWorkCalendarVersion(target.id, normalizedValue, (target.versions?.length ?? 0) + 1);
  const versions = [...(target.versions ?? [])].map((item) => (
    !item.effectiveTo && item.effectiveFrom < version.effectiveFrom
      ? { ...item, effectiveTo: getPreviousDate(version.effectiveFrom) }
      : item
  ));
  const nextVersions = [...versions, version];
  const timelineValidation = validateEffectiveTimeline(nextVersions);
  if (!timelineValidation.success) {
    return { result: timelineValidation, rows };
  }

  return {
    result: { message: `${target.name}已新增生效版本`, success: true },
    rows: rows.map((row) => {
      if (row.id !== id) {
        return row;
      }

      const currentRule = resolveWorkCalendarRule({ ...row, versions: nextVersions }, new Date(`${currentDate}T00:00:00`));
      return {
        ...row,
        ...(currentRule ? {
          alternateWorkdays: [...currentRule.alternateWorkdays],
          anchorDate: currentRule.anchorDate,
          currentVersionId: currentRule.id,
          effectiveFrom: currentRule.effectiveFrom,
          fixedWorkdays: [...currentRule.fixedWorkdays],
          note: currentRule.note,
          startMode: currentRule.startMode,
          type: currentRule.type
        } : {}),
        name: normalizedValue.name,
        updatedAt: currentDate,
        versions: nextVersions
      };
    })
  };
}

function normalizeAnnualExceptionValue(nextValue: AnnualExceptionConfigFormValue): AnnualExceptionConfigFormValue {
  const items = nextValue.items
    .map((item) => ({
      ...item,
      date: item.date.trim(),
      groupName: item.groupName.trim(),
      name: item.name.trim(),
      note: item.note.trim()
    }))
    .filter((item) => item.date && item.groupId && item.groupName && item.name);

  return {
    effectiveFrom: nextValue.effectiveFrom,
    items,
    source: nextValue.source.trim(),
    year: nextValue.year
  };
}

function getNextAnnualExceptionSequence(rows: AnnualExceptionConfigRow[], year: number) {
  return (
    rows.reduce((maxSequence, row) => {
      if (row.year !== year) {
        return maxSequence;
      }

      const sequence = Number.parseInt(row.code.replace(/^EXC-\d{4}-/, ''), 10);
      return Number.isFinite(sequence) ? Math.max(maxSequence, sequence) : maxSequence;
    }, 0) + 1
  );
}

const WorkCalendarStateContext = createContext<WorkCalendarStateValue | undefined>(undefined);

export function WorkCalendarProvider({ children }: { children: ReactNode }) {
  const [workCalendarRows, setWorkCalendarRows] = useState<WorkCalendarRow[]>(() => seedWorkCalendarRows);
  const [annualExceptionRows, setAnnualExceptionRows] = useState<AnnualExceptionConfigRow[]>(() => seedAnnualExceptionRows);

  const value = useMemo<WorkCalendarStateValue>(
    () => ({
      annualExceptionRows,
      createAnnualExceptionConfig(nextValue) {
        const normalizedValue = normalizeAnnualExceptionValue(nextValue);
        const sequence = getNextAnnualExceptionSequence(annualExceptionRows, normalizedValue.year);
        const paddedSequence = String(sequence).padStart(3, '0');
        const nextRow: AnnualExceptionConfigRow = {
          code: `EXC-${normalizedValue.year}-${paddedSequence}`,
          currentRevisionId: `annual-exception-${normalizedValue.year}-${paddedSequence}-r1`,
          id: `annual-exception-${normalizedValue.year}-${paddedSequence}`,
          revisions: [
            {
              createdAt: prototypeToday,
              createdBy: '李明',
              effectiveFrom: normalizedValue.effectiveFrom,
              id: `annual-exception-${normalizedValue.year}-${paddedSequence}-r1`,
              items: normalizedValue.items,
              revision: 1,
              source: normalizedValue.source
            }
          ],
          status: '草稿',
          statusPeriods: [{ effectiveFrom: normalizedValue.effectiveFrom, status: '草稿' }],
          updatedAt: prototypeToday,
          updatedBy: '李明',
          year: normalizedValue.year
        };

        setAnnualExceptionRows((currentRows) => [...currentRows, nextRow]);
        return nextRow;
      },
      createWorkCalendar(nextValue) {
        setWorkCalendarRows((currentRows) => {
          const sequence = getNextWorkCalendarSequence(currentRows);
          const paddedSequence = String(sequence).padStart(3, '0');
          const normalizedValue = normalizeWorkCalendarValue(nextValue);
          const id = `calendar-custom-${paddedSequence}`;
          const version = createWorkCalendarVersion(id, normalizedValue, 1);
          const nextRow: WorkCalendarRow = {
            ...normalizedValue,
            code: `CAL-2026-${paddedSequence}`,
            currentVersionId: version.id,
            id,
            isDefault: false,
            status: '启用',
            statusPeriods: [{ effectiveFrom: normalizedValue.effectiveFrom, status: '启用' }],
            updatedAt: prototypeToday,
            versions: [version]
          };

          return [...currentRows, nextRow];
        });
      },
      setDefaultWorkCalendar(id, effectiveFrom) {
        const change = applyDefaultWorkCalendarChange(workCalendarRows, id, effectiveFrom);
        if (change.result.success) {
          setWorkCalendarRows(change.rows);
        }
        return change.result;
      },
      updateAnnualExceptionConfig(id, nextValue) {
        const target = annualExceptionRows.find((row) => row.id === id);
        if (!target) {
          return { message: '法定节假日配置不存在', success: false };
        }
        const normalizedValue = normalizeAnnualExceptionValue(nextValue);
        const change = applyAnnualExceptionRevisionChange(target, normalizedValue, {
          actor: '李明',
          currentDate: prototypeToday
        });
        if (change.result.success) {
          setAnnualExceptionRows((currentRows) => currentRows.map((row) => row.id === id ? change.row : row));
        }
        return change.result;
      },
      updateAnnualExceptionStatus(id, status) {
        setAnnualExceptionRows((currentRows) =>
          currentRows.map((row) =>
            row.id === id
              ? { ...applyAnnualExceptionStatusChange(row, status, prototypeToday), updatedBy: '李明' }
              : row
          )
        );
      },
      updateWorkCalendar(id, nextValue) {
        const change = applyWorkCalendarRuleChange(workCalendarRows, id, nextValue);
        if (change.result.success) {
          setWorkCalendarRows(change.rows);
        }
        return change.result;
      },
      updateWorkCalendarStatus(id, status, activeMemberCount = 0) {
        const target = workCalendarRows.find((row) => row.id === id);
        const protectsDefaultSchedule = target ? hasCurrentOrFutureDefaultPeriod(target) : false;
        const validation = validateDefaultMasterDataStatusChange(
          status,
          protectsDefaultSchedule,
          '当前或已排期的默认工作日历不可停用'
        );
        if (!validation.success) {
          return validation;
        }
        if (status === '停用' && activeMemberCount > 0) {
          return {
            message: `仍有 ${activeMemberCount} 名在职人员使用该工作日历`,
            success: false
          };
        }

        setWorkCalendarRows((currentRows) =>
          currentRows.map((row) =>
            row.id === id
              ? {
                  ...row,
                  status,
                  statusPeriods: appendWorkCalendarStatusPeriod(row, status, prototypeToday),
                  updatedAt: prototypeToday
                }
              : row
          )
        );
        return validation;
      },
      workCalendarRows
    }),
    [annualExceptionRows, workCalendarRows]
  );

  return <WorkCalendarStateContext.Provider value={value}>{children}</WorkCalendarStateContext.Provider>;
}

export function useWorkCalendarState() {
  const value = useContext(WorkCalendarStateContext);

  if (!value) {
    throw new Error('useWorkCalendarState must be used within WorkCalendarProvider');
  }

  return value;
}
