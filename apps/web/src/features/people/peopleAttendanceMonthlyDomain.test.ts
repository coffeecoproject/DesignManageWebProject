import type { AnnualExceptionConfigRow, WorkCalendarRow } from '../system/WorkCalendarState';
import type { PeopleAttendanceRecord } from './peopleDomain';
import {
  buildAttendanceMonthlyReports,
  getAdjustmentDirectionFromType,
  getAttendanceMonthRange,
  getMonthlyAdjustmentSignedDays,
  getMonthlyAdjustmentSignedHours,
  getPayrollAttendanceDaysFromHours,
  toPayrollAttendanceMonthlyContract,
  type AttendanceMonthlyAdjustmentRecord,
  type AttendanceMonthlyConfirmationRecord,
  type AttendanceMonthlySalarySettlementRecord
} from './peopleAttendanceMonthlyDomain';
import type { PeopleMember } from './peopleTypes';

type UnitTest = {
  name: string;
  run: () => void;
};

type UnitTestResult = {
  failures: string[];
  passed: number;
  total: number;
};

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    fail(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (!Object.is(actual, expected)) {
    fail(`${message}. Expected ${String(expected)}, received ${String(actual)}`);
  }
}

const weekdayCalendar: WorkCalendarRow = {
  alternateWorkdays: [],
  anchorDate: '2026-06-01',
  code: 'CAL-TEST-001',
  fixedWorkdays: ['周一', '周二', '周三', '周四', '周五'],
  id: 'calendar-test-weekday',
  isDefault: true,
  name: '测试双休',
  note: '',
  status: '启用',
  type: '双休',
  updatedAt: '2026-06-17'
};

const disabledCalendar: WorkCalendarRow = {
  ...weekdayCalendar,
  id: 'calendar-disabled',
  isDefault: false,
  name: '停用日历',
  status: '停用'
};

const restDayExceptionRows: AnnualExceptionConfigRow[] = [
  {
    code: 'YEAR-2026',
    id: 'annual-2026-rest',
    items: [
      {
        date: '2026-06-17',
        groupId: 'new-year',
        groupName: '测试节假日',
        id: 'annual-rest',
        name: '测试休息日',
        note: '',
        type: '休息日'
      }
    ],
    source: '测试',
    status: '已启用',
    updatedAt: '2026-06-17',
    updatedBy: '测试人',
    year: 2026
  }
];

const specialWorkdayExceptionRows: AnnualExceptionConfigRow[] = [
  {
    ...restDayExceptionRows[0],
    id: 'annual-2026-workday',
    items: [
      {
        date: '2026-06-21',
        groupId: 'new-year',
        groupName: '测试节假日',
        id: 'annual-workday',
        name: '测试特殊工作日',
        note: '',
        type: '特殊工作日'
      }
    ]
  }
];

function createMember(overrides: Partial<PeopleMember> = {}): PeopleMember {
  return {
    address: '武汉市洪山区',
    archiveFiles: [],
    archiveStatus: '资料完整',
    archiveUpdatedAt: '2026-06-01',
    auditRecords: [],
    birthDate: '1992-01-01',
    city: '武汉',
    contractNo: 'HT-TEST-001',
    contractStartAt: '2026-01-01',
    contractStatus: '正式合同',
    contractType: '劳动合同',
    education: '本科',
    educationMajor: '设计',
    email: 'test@example.com',
    emergencyContact: '测试联系人',
    emergencyContactPhone: '13800000000',
    emergencyContactRelation: '家属',
    gender: '女',
    graduatedAt: '2014-06',
    graduationSchool: '武汉大学',
    hukouAddress: '湖北武汉',
    id: 'member-001',
    idDocumentType: '身份证',
    idValidUntil: '2036-01-01',
    identityNo: '420000199201010000',
    joinedAt: '2026-01-01',
    mobile: '13800000001',
    name: '测试人员',
    nationality: '中国',
    paymentProfile: {
      accountName: '测试人员',
      bankAccount: '6222000000000000000',
      bankName: '招商银行',
      mode: '工资发放',
      payCycle: '每月'
    },
    personnelType: '全职',
    position: '设计师',
    salaryProfile: {
      effectiveAt: '2026-01-01',
      note: '',
      payCycle: '每月',
      regularSalary: '10000',
      status: '已配置',
      structure: '固定月薪'
    },
    source: '社招',
    status: '在职',
    taskAccessStatus: '可参与任务',
    taskCapabilityIds: [],
    taskRecords: [],
    wechat: 'test-wechat',
    workCalendarId: weekdayCalendar.id,
    workEvaluationRecords: [],
    workEvaluationSummary: {
      acceptedTasks: 0,
      level: 'A',
      month: '2026-06',
      reworkTasks: 0,
      score: 90
    },
    ...overrides
  };
}

function createAttendanceRecord(overrides: Partial<PeopleAttendanceRecord> = {}): PeopleAttendanceRecord {
  return {
    durationHours: 8,
    effect: '不可用',
    endAt: '2026-06-10 18:00',
    id: 'attendance-001',
    memberId: 'member-001',
    mode: '日常记录',
    reason: '测试',
    recordedAt: '2026-06-10',
    recorder: '测试人',
    startAt: '2026-06-10 09:00',
    status: '已结束',
    type: '请假',
    updatedAt: '2026-06-10',
    ...overrides
  };
}

function buildReports({
  adjustments = [],
  annualExceptionRows = [],
  attendanceRecords = [],
  confirmations = [],
  peopleRows = [createMember()],
  salarySettlements = [],
  workCalendarRows = [weekdayCalendar]
}: {
  adjustments?: AttendanceMonthlyAdjustmentRecord[];
  annualExceptionRows?: AnnualExceptionConfigRow[];
  attendanceRecords?: PeopleAttendanceRecord[];
  confirmations?: AttendanceMonthlyConfirmationRecord[];
  peopleRows?: PeopleMember[];
  salarySettlements?: AttendanceMonthlySalarySettlementRecord[];
  workCalendarRows?: WorkCalendarRow[];
} = {}) {
  return buildAttendanceMonthlyReports({
    adjustments,
    annualExceptionRows,
    attendanceRecords,
    confirmations,
    month: '2026-06',
    peopleRows,
    salarySettlements,
    workCalendarRows
  });
}

const tests: UnitTest[] = [
  {
    name: 'derives month ranges and hourly payroll day equivalents',
    run: () => {
      const range = getAttendanceMonthRange('2026-06');

      assertEqual(range.startDateText, '2026-06-01', 'month range should start on first day');
      assertEqual(range.endDateText, '2026-06-30', 'month range should end on last day');
      assertEqual(getPayrollAttendanceDaysFromHours(4), 0.5, 'four hours should be half a payroll day');
      assertEqual(getPayrollAttendanceDaysFromHours(9), 1.13, 'nine hours should keep hourly payroll-day equivalent');
      assertEqual(getPayrollAttendanceDaysFromHours(12), 1.5, 'twelve hours should round to one and a half payroll days');
    }
  },
  {
    name: 'builds reports for full-time monthly-scope members only',
    run: () => {
      const reports = buildReports({
        peopleRows: [
          createMember({ id: 'member-001', personnelType: '全职', status: '在职' }),
          createMember({ id: 'member-002', personnelType: '兼职', status: '合作中' }),
          createMember({ contractEndAt: '2026-05-31', id: 'member-003', status: '离职' }),
          createMember({ id: 'member-004', joinedAt: '2026-07-01', status: '试用期' })
        ]
      });

      assertEqual(reports.length, 1, 'only active full-time members in the month should produce reports');
      assertEqual(reports[0].member.id, 'member-001', 'active full-time member should remain in report');
    }
  },
  {
    name: 'uses work-calendar and annual exceptions for expected workdays',
    run: () => {
      const normalReport = buildReports()[0];
      const restDayReport = buildReports({ annualExceptionRows: restDayExceptionRows })[0];
      const specialWorkdayReport = buildReports({ annualExceptionRows: specialWorkdayExceptionRows })[0];
      const disabledCalendarReport = buildReports({
        peopleRows: [createMember({ workCalendarId: disabledCalendar.id })],
        workCalendarRows: [disabledCalendar]
      })[0];

      assertEqual(normalReport.expectedWorkdays, 22, 'June 2026 weekday calendar should have 22 workdays');
      assertEqual(restDayReport.expectedWorkdays, 21, 'enabled rest-day exception should reduce expected workdays');
      assertEqual(specialWorkdayReport.expectedWorkdays, 23, 'enabled special-workday exception should increase expected workdays');
      assertEqual(disabledCalendarReport.expectedWorkdays, 0, 'disabled calendar should not create expected workdays');
    }
  },
  {
    name: 'derives payable attendance from exceptions and adjustments',
    run: () => {
      const reports = buildReports({
        adjustments: [
          {
            actor: '测试人',
            createdAt: '2026-06-12 10:00',
            direction: '增加',
            hours: 4,
            id: 'adjust-plus',
            memberId: 'member-001',
            month: '2026-06',
            reason: '测试增加',
            type: '增加计薪出勤'
          },
          {
            actor: '测试人',
            createdAt: '2026-06-13 10:00',
            direction: '扣减',
            hours: 8,
            id: 'adjust-minus',
            memberId: 'member-001',
            month: '2026-06',
            reason: '测试扣减',
            type: '扣减计薪出勤'
          }
        ],
        attendanceRecords: [
          createAttendanceRecord({ durationHours: 9, id: 'leave', type: '请假' }),
          createAttendanceRecord({
            durationHours: 8,
            effect: '可用',
            endAt: '2026-06-14 18:00',
            id: 'makeup',
            startAt: '2026-06-14 10:00',
            type: '补班'
          }),
          createAttendanceRecord({ durationHours: 8, id: 'rest', type: '调休' }),
          createAttendanceRecord({ durationHours: 8, id: 'cancelled', status: '已取消', type: '请假' })
        ]
      });
      const report = reports[0];

      assertEqual(report.leaveDays, 1, 'leave should be summarized as deduction facts');
      assertEqual(report.leaveHours, 8, 'single-day leave should keep payroll-hour deduction capped to standard day hours');
      assertEqual(report.makeupWorkDays, 1, 'make-up work should be summarized as exception facts');
      assertEqual(report.makeupWorkHours, 8, 'make-up work should retain exception hours');
      assertEqual(report.payrollIncreaseDays, 0, 'make-up work should not automatically create payroll increase days');
      assertEqual(report.payrollIncreaseHours, 0, 'make-up work should not automatically create payroll increase hours');
      assertEqual(report.restDays, 1, 'rest should be summarized as exception facts');
      assertEqual(report.restCoveredHours, 0, 'later make-up work should not cover earlier compensatory rest');
      assertEqual(report.restUncoveredHours, 8, 'compensatory rest without prior credit should be uncovered');
      assertEqual(report.restBalanceHours, 8, 'later make-up work should remain as available balance');
      assertEqual(report.payrollDeductionHours, 16, 'leave and uncovered compensatory rest should both deduct payroll attendance');
      assertEqual(report.payrollDeductionEntries.length, 2, 'leave and uncovered rest should both produce date-scoped deduction entries');
      assertEqual(report.adjustmentDays, -0.5, 'adjustments should use signed days');
      assertEqual(report.adjustmentHours, -4, 'adjustments should expose signed hours for salary calculation');
      assertEqual(report.payableAttendanceDays, 19.5, 'payable days should derive from default attendance, payroll exceptions, and adjustments');
      assertEqual(report.payableAttendanceHours, 156, 'payable hours should drive salary calculation');
      assertEqual(report.relatedExceptions.length, 3, 'cancelled attendance records should be ignored');
    }
  },
  {
    name: 'covers compensatory rest with prior make-up work credit',
    run: () => {
      const report = buildReports({
        attendanceRecords: [
          createAttendanceRecord({
            durationHours: 8,
            effect: '可用',
            endAt: '2026-06-09 18:00',
            id: 'makeup-before-rest',
            startAt: '2026-06-09 10:00',
            type: '补班'
          }),
          createAttendanceRecord({ durationHours: 8, id: 'covered-rest', type: '调休' })
        ]
      })[0];

      assertEqual(report.makeupWorkHours, 8, 'make-up work should create compensatory rest credit');
      assertEqual(report.restHours, 8, 'compensatory rest should keep exception hours');
      assertEqual(report.restCoveredHours, 8, 'prior make-up work should cover rest hours');
      assertEqual(report.restUncoveredHours, 0, 'covered compensatory rest should not create uncovered hours');
      assertEqual(report.restBalanceHours, 0, 'covered rest should consume available credit');
      assertEqual(report.payrollDeductionHours, 0, 'covered compensatory rest should not deduct payroll attendance');
      assertEqual(report.payrollDeductionEntries.length, 0, 'covered compensatory rest should not produce deduction entries');
      assertEqual(report.payableAttendanceHours, 176, 'covered compensatory rest should keep default payable attendance');
    }
  },
  {
    name: 'exports stable payroll-attendance contract for salary',
    run: () => {
      const report = buildReports({
        attendanceRecords: [
          createAttendanceRecord({ durationHours: 8, id: 'leave-for-contract', type: '请假' }),
          createAttendanceRecord({
            durationHours: 8,
            effect: '可用',
            endAt: '2026-06-14 18:00',
            id: 'makeup-after-rest-for-contract',
            startAt: '2026-06-14 10:00',
            type: '补班'
          }),
          createAttendanceRecord({ durationHours: 8, id: 'uncovered-rest-for-contract', type: '调休' })
        ]
      })[0];
      const contract = toPayrollAttendanceMonthlyContract(report);

      assertEqual(contract.contractVersion, 'payroll-attendance-monthly-v1', 'contract version should be explicit');
      assertEqual(contract.sourceModule, '考勤月报', 'contract should keep source module ownership');
      assertEqual(contract.reportId, report.id, 'contract should retain source report id');
      assertEqual(contract.memberId, report.member.id, 'contract should retain member id');
      assertEqual(contract.month, report.month, 'contract should retain payroll month');
      assertEqual(contract.reportStatus, report.status, 'contract should expose report confirmation status');
      assertEqual(contract.salarySettlementStatus, report.salarySettlementStatus, 'contract should expose settlement lock status');
      assertEqual(contract.payrollDeductionHours, 16, 'contract should expose total payroll deduction hours');
      assertEqual(contract.restUncoveredHours, 8, 'contract should expose uncovered compensatory-rest hours');
      assertEqual(contract.restBalanceHours, 8, 'contract should expose remaining compensatory-rest balance');
      assertEqual(contract.payrollDeductionEntries.length, 2, 'contract should expose date-scoped deduction entries');
      assertEqual(contract.payrollDeductionEntries[0].dateText, '2026-06-10', 'leave deduction date should be retained');
      assertEqual(contract.payrollDeductionEntries[0].hours, 8, 'leave deduction hours should be retained');
      assertEqual(contract.payrollDeductionEntries[1].type, '调休超额', 'uncovered rest should be a payroll deduction entry');
      assert(contract.expectedWorkdayDates !== report.expectedWorkdayDates, 'contract should not leak mutable report workday array');
      assert(contract.payrollDeductionEntries !== report.payrollDeductionEntries, 'contract should not leak mutable report deduction array');
    }
  },
  {
    name: 'marks salary-settled reports as locked against adjustments',
    run: () => {
      const report = buildReports({
        salarySettlements: [
          {
            actor: '结算人',
            memberId: 'member-001',
            month: '2026-06',
            note: '工资已结算',
            settledAt: '2026-06-17 11:00',
            settlementNo: 'PAY-TEST-001',
            status: '已结算'
          }
        ]
      })[0];

      assertEqual(report.salarySettlementStatus, '已结算', 'settlement record should mark salary as settled');
      assertEqual(report.canAdjust, false, 'settled salary reports should not be adjustable');
      assert(report.salarySettlement, 'salary settlement metadata should be attached to report');
    }
  },
  {
    name: 'invalidates stale confirmations when later adjustments exist',
    run: () => {
      const staleConfirmationReport = buildReports({
        adjustments: [
          {
            actor: '调整人',
            createdAt: '2026-06-17 12:00',
            direction: '增加',
            hours: 4,
            id: 'adjust-after-confirm',
            memberId: 'member-001',
            month: '2026-06',
            reason: '确认后补充调整',
            type: '增加计薪出勤'
          }
        ],
        confirmations: [
          {
            actor: '确认人',
            confirmedAt: '2026-06-17 10:00',
            memberId: 'member-001',
            month: '2026-06',
            note: '调整前确认'
          }
        ]
      })[0];
      const freshConfirmationReport = buildReports({
        adjustments: [
          {
            actor: '调整人',
            createdAt: '2026-06-17 09:00',
            direction: '增加',
            hours: 4,
            id: 'adjust-before-confirm',
            memberId: 'member-001',
            month: '2026-06',
            reason: '确认前调整',
            type: '增加计薪出勤'
          }
        ],
        confirmations: [
          {
            actor: '确认人',
            confirmedAt: '2026-06-17 10:00',
            memberId: 'member-001',
            month: '2026-06',
            note: '调整后确认'
          }
        ]
      })[0];

      assertEqual(staleConfirmationReport.status, '待确认', 'later adjustment should invalidate old confirmation');
      assertEqual(staleConfirmationReport.confirmation, undefined, 'stale confirmation should not be attached');
      assertEqual(freshConfirmationReport.status, '已确认', 'confirmation after adjustment should remain valid');
      assert(freshConfirmationReport.confirmation, 'fresh confirmation should be attached');
    }
  },
  {
    name: 'uses confirmation state and adjustment direction helpers',
    run: () => {
      const adjustment: AttendanceMonthlyAdjustmentRecord = {
        actor: '测试人',
        createdAt: '2026-06-12 10:00',
        direction: '扣减',
        hours: 8,
        id: 'adjust-minus',
        memberId: 'member-001',
        month: '2026-06',
        reason: '测试扣减',
        type: '扣减计薪出勤'
      };
      const report = buildReports({
        adjustments: [adjustment],
        confirmations: [
          {
            actor: '确认人',
            confirmedAt: '2026-06-17 10:00',
            memberId: 'member-001',
            month: '2026-06',
            note: '已确认'
          }
        ]
      })[0];

      assertEqual(report.status, '已确认', 'confirmation record should lock report status');
      assert(report.confirmation, 'confirmation should be attached to report');
      assertEqual(getMonthlyAdjustmentSignedDays(adjustment), -1, 'deduction adjustment should be negative');
      assertEqual(getMonthlyAdjustmentSignedHours(adjustment), -8, 'deduction adjustment hours should be negative');
      assertEqual(getAdjustmentDirectionFromType('增加计薪出勤'), '增加', 'increase type should map to increase direction');
      assertEqual(getAdjustmentDirectionFromType('扣减计薪出勤'), '扣减', 'deduction type should map to deduction direction');
      assertEqual(getAdjustmentDirectionFromType('备注修正'), '备注', 'remark type should map to remark direction');
    }
  }
];

export function runPeopleAttendanceMonthlyDomainTests(): UnitTestResult {
  const failures: string[] = [];

  for (const test of tests) {
    try {
      test.run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${test.name}: ${message}`);
    }
  }

  return {
    failures,
    passed: tests.length - failures.length,
    total: tests.length
  };
}
