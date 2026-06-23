import {
  getPeopleHousingFundStatus,
  isFulltimePeopleMember,
  isPeopleHousingFundContributionApplicable,
  isPeopleRelationshipActive
} from '../people/peopleDomain';
import type { PeopleMember } from '../people/peopleTypes';
import type {
  SocialInsuranceEmployeeRecord,
  SocialInsuranceHandlingStatus,
  SocialInsurancePayrollDeductionRecord
} from './financeSocialInsuranceData';

export type SocialInsuranceRecordEligibility =
  | '适用'
  | '人员不存在'
  | '非全职'
  | '人员已结束'
  | '公积金暂不缴存'
  | '公积金未到生效月份';

export type SocialInsurancePayrollSourceState = '待处理' | '计入扣款' | '本月不扣';

export function getSocialInsuranceRecordEligibility(
  record: SocialInsuranceEmployeeRecord,
  member?: PeopleMember
): SocialInsuranceRecordEligibility {
  if (!member) {
    return '人员不存在';
  }

  if (!isFulltimePeopleMember(member)) {
    return '非全职';
  }

  if (!isPeopleRelationshipActive(member)) {
    return '人员已结束';
  }

  if (record.category === '社保') {
    return '适用';
  }

  const housingFundStatus = getPeopleHousingFundStatus(member);

  if (housingFundStatus !== '缴存') {
    return '公积金暂不缴存';
  }

  if (!isPeopleHousingFundContributionApplicable(member, record.period)) {
    return '公积金未到生效月份';
  }

  return '适用';
}

export function isSocialInsuranceRecordApplicable(record: SocialInsuranceEmployeeRecord, member?: PeopleMember) {
  return getSocialInsuranceRecordEligibility(record, member) === '适用';
}

export function getVisibleSocialInsuranceRecords(records: SocialInsuranceEmployeeRecord[], peopleRows: PeopleMember[]) {
  const peopleByNo = new Map(peopleRows.map((member) => [member.id, member]));

  return records.filter((record) => isSocialInsuranceRecordApplicable(record, peopleByNo.get(record.employeeNo)));
}

export function getNextSocialInsurancePeriod(period: string) {
  const [yearText, monthText] = period.split('-');
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return period;
  }

  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

function getSocialInsuranceCarryoverKey(record: Pick<SocialInsuranceEmployeeRecord, 'category' | 'employeeNo' | 'makeupPeriod' | 'period'>) {
  return `${record.employeeNo}/${record.category}/${record.period}/${record.makeupPeriod ?? '-'}`;
}

export function buildSocialInsuranceCarryoverRecord(record: SocialInsuranceEmployeeRecord): SocialInsuranceEmployeeRecord {
  const sourceMonth = record.makeupPeriod ?? record.period;
  const nextPeriod = getNextSocialInsurancePeriod(record.period);

  return {
    ...record,
    handlingStatus: '待确认',
    id: `carryover-${record.employeeNo}-${record.category}-${nextPeriod}-${sourceMonth}`,
    makeupPeriod: sourceMonth,
    operationRecords: [
      {
        action: '转入补缴',
        actor: '系统',
        id: `op-carryover-${record.employeeNo}-${record.category}-${nextPeriod}-${sourceMonth}`,
        object: `${record.employeeName} / ${record.category}`,
        summary: `补缴 ${sourceMonth} 转入 ${nextPeriod} 处理`,
        time: `${nextPeriod}-01 09:00`
      },
      ...record.operationRecords
    ],
    period: nextPeriod,
    reason: record.reason ?? `补缴 ${sourceMonth}`,
    updatedAt: `${nextPeriod}-01`
  };
}

export function buildSocialInsuranceRecordsWithCarryovers(records: SocialInsuranceEmployeeRecord[]) {
  const nextRecords = [...records];
  const existingKeys = new Set(nextRecords.map(getSocialInsuranceCarryoverKey));

  for (const record of records) {
    if (record.handlingStatus !== '延期补缴') {
      continue;
    }

    const carryoverRecord = buildSocialInsuranceCarryoverRecord(record);
    const carryoverKey = getSocialInsuranceCarryoverKey(carryoverRecord);

    if (existingKeys.has(carryoverKey)) {
      continue;
    }

    nextRecords.push(carryoverRecord);
    existingKeys.add(carryoverKey);
  }

  return nextRecords.sort(
    (left, right) =>
      left.period.localeCompare(right.period) ||
      left.category.localeCompare(right.category) ||
      left.employeeNo.localeCompare(right.employeeNo) ||
      left.id.localeCompare(right.id)
  );
}

export function getSocialInsurancePayrollSourceState(
  record: SocialInsuranceEmployeeRecord | undefined
): SocialInsurancePayrollSourceState {
  if (!record || record.handlingStatus === '待确认') {
    return '待处理';
  }

  if (record.handlingStatus === '已确认') {
    return '计入扣款';
  }

  return '本月不扣';
}

export function isSocialInsurancePayrollDeductible(
  record: SocialInsuranceEmployeeRecord | undefined
): record is SocialInsuranceEmployeeRecord & {
  handlingStatus: Extract<SocialInsuranceHandlingStatus, '已确认'>;
} {
  return getSocialInsurancePayrollSourceState(record) === '计入扣款';
}

export function isSocialInsurancePayrollHandled(record: SocialInsuranceEmployeeRecord | undefined) {
  return getSocialInsurancePayrollSourceState(record) !== '待处理';
}

export function buildSocialInsurancePayrollDeductions(
  records: SocialInsuranceEmployeeRecord[],
  payrollMonth: string
): SocialInsurancePayrollDeductionRecord[] {
  return records
    .filter(
      (
        record
      ): record is SocialInsuranceEmployeeRecord & {
        handlingStatus: Extract<SocialInsuranceHandlingStatus, '已确认'>;
      } => record.period === payrollMonth && isSocialInsurancePayrollDeductible(record)
    )
    .map((record) => ({
      accrualPeriod: record.period,
      category: record.category,
      companyAmount: record.companyAmount,
      contributionBase: record.contributionBase,
      employeeName: record.employeeName,
      employeeNo: record.employeeNo,
      handlingStatus: record.handlingStatus,
      id: record.id,
      payrollMonth: record.period,
      personalAmount: record.personalAmount,
      reason: record.reason,
      sourceMonth: record.makeupPeriod ?? record.period
    }))
    .sort(
      (left, right) =>
        left.employeeNo.localeCompare(right.employeeNo) ||
        left.category.localeCompare(right.category) ||
        left.sourceMonth.localeCompare(right.sourceMonth)
    );
}
