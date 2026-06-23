import type { PeopleMember } from '../people/peopleTypes';
import type { SocialInsuranceEmployeeRecord } from './financeSocialInsuranceData';
import {
  buildSocialInsurancePayrollDeductions,
  buildSocialInsuranceRecordsWithCarryovers,
  getNextSocialInsurancePeriod,
  getSocialInsurancePayrollSourceState,
  getSocialInsuranceRecordEligibility,
  getVisibleSocialInsuranceRecords,
  isSocialInsuranceRecordApplicable
} from './financeSocialInsuranceModel';

type UnitTest = {
  name: string;
  run: () => void;
};

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertDeepEqual<T>(actual: T, expected: T, message: string) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);

  if (actualJson !== expectedJson) {
    throw new Error(`${message}. Expected ${expectedJson}, got ${actualJson}`);
  }
}

function createMember(overrides: Partial<PeopleMember> = {}): PeopleMember {
  return {
    archiveFiles: [],
    archiveStatus: '资料完整',
    archiveUpdatedAt: '2026-06-01',
    auditRecords: [],
    address: '武汉市洪山区测试路 1 号',
    birthDate: '1990-01-01',
    city: '武汉',
    contractNo: 'HT-001',
    contractStartAt: '2026-01-01',
    contractStatus: '劳动合同有效',
    contractType: '劳动合同',
    education: '本科',
    educationMajor: '管理',
    email: 'demo@example.com',
    emergencyContact: '联系人',
    emergencyContactPhone: '13900000000',
    emergencyContactRelation: '家属',
    gender: '女',
    graduatedAt: '2012-06-30',
    graduationSchool: '武汉大学',
    housingFundEffectiveMonth: '2026-01',
    housingFundStatus: '缴存',
    hukouAddress: '武汉',
    id: 'EMP-001',
    idDocumentType: '居民身份证',
    idValidUntil: '2036-01-01',
    identityNo: '420100199001010000',
    joinedAt: '2026-01-01',
    mobile: '13800000000',
    name: '测试员工',
    nationality: '中国',
    paymentProfile: {
      accountName: '测试员工',
      bankAccount: '6222000000000000',
      bankName: '招商银行',
      mode: '工资发放',
      payCycle: '月度'
    },
    personnelType: '全职',
    position: '财务专员',
    salaryProfile: {
      effectiveAt: '2026-01-01',
      note: '',
      payCycle: '月度',
      regularSalary: '10000 元/月',
      status: '已配置',
      structure: '月薪制'
    },
    source: '社会招聘',
    status: '在职',
    taskAccessStatus: '可参与任务',
    taskCapabilityIds: [],
    taskRecords: [],
    wechat: 'wx_demo',
    workEvaluationRecords: [],
    workEvaluationSummary: {
      acceptedTasks: 0,
      level: '-',
      month: '2026-06',
      reworkTasks: 0,
      score: 0
    },
    ...overrides
  };
}

function createRecord(overrides: Partial<SocialInsuranceEmployeeRecord> = {}): SocialInsuranceEmployeeRecord {
  return {
    category: '社保',
    companyAmount: 2700,
    contributionBase: 10000,
    department: '财务部',
    employeeName: '测试员工',
    employeeNo: 'EMP-001',
    handlingStatus: '待确认',
    id: 'record-001',
    operationRecords: [],
    period: '2026-06',
    personalAmount: 1050,
    position: '财务专员',
    salaryBase: 10000,
    updatedAt: '2026-06-18',
    ...overrides
  };
}

const tests: UnitTest[] = [
  {
    name: 'keeps only full-time active personnel records',
    run: () => {
      const activeFulltime = createMember({ id: 'EMP-001', personnelType: '全职', status: '在职' });
      const parttime = createMember({ id: 'EMP-002', personnelType: '兼职', status: '合作中' });
      const ended = createMember({ id: 'EMP-003', status: '离职' });
      const records = [
        createRecord({ employeeNo: 'EMP-001', id: 'social-active' }),
        createRecord({ employeeNo: 'EMP-002', id: 'social-parttime' }),
        createRecord({ employeeNo: 'EMP-003', id: 'social-ended' }),
        createRecord({ employeeNo: 'EMP-404', id: 'social-missing' })
      ];

      assertDeepEqual(
        getVisibleSocialInsuranceRecords(records, [activeFulltime, parttime, ended]).map((record) => record.id),
        ['social-active'],
        'social insurance confirmation rows should follow personnel archive scope'
      );
    }
  },
  {
    name: 'uses personnel housing-fund policy before showing housing-fund rows',
    run: () => {
      const contributing = createMember({ id: 'EMP-001', housingFundEffectiveMonth: '2026-05', housingFundStatus: '缴存' });
      const notContributing = createMember({ id: 'EMP-002', housingFundStatus: '暂不缴存' });
      const futureEffective = createMember({ id: 'EMP-003', housingFundEffectiveMonth: '2026-07', housingFundStatus: '缴存' });
      const records = [
        createRecord({ category: '公积金', employeeNo: 'EMP-001', id: 'housing-current' }),
        createRecord({ category: '公积金', employeeNo: 'EMP-002', id: 'housing-not-enabled' }),
        createRecord({ category: '公积金', employeeNo: 'EMP-003', id: 'housing-future' })
      ];

      assertDeepEqual(
        getVisibleSocialInsuranceRecords(records, [contributing, notContributing, futureEffective]).map((record) => record.id),
        ['housing-current'],
        'housing-fund confirmation rows should only appear when archive status is contributing and effective'
      );
      assertEqual(
        getSocialInsuranceRecordEligibility(records[1], notContributing),
        '公积金暂不缴存',
        'non-contributing archive should explain why housing-fund row is excluded'
      );
      assertEqual(
        getSocialInsuranceRecordEligibility(records[2], futureEffective),
        '公积金未到生效月份',
        'future effective month should explain why housing-fund row is excluded'
      );
    }
  },
  {
    name: 'builds payroll deductions only from confirmed current or makeup records',
    run: () => {
      const deductions = buildSocialInsurancePayrollDeductions(
        [
          createRecord({ handlingStatus: '已确认', id: 'social-confirmed', personalAmount: 1050 }),
          createRecord({
            category: '公积金',
            handlingStatus: '已确认',
            id: 'housing-makeup',
            makeupPeriod: '2026-05',
            personalAmount: 900
          }),
          createRecord({ handlingStatus: '待确认', id: 'social-pending', personalAmount: 800 }),
          createRecord({ handlingStatus: '延期补缴', id: 'social-deferred', personalAmount: 700 }),
          createRecord({ handlingStatus: '本月不缴', id: 'social-skipped', personalAmount: 600 }),
          createRecord({ handlingStatus: '已确认', id: 'social-other-month', period: '2026-05', personalAmount: 500 })
        ],
        '2026-06'
      );

      assertDeepEqual(
        deductions.map((record) => [record.id, record.personalAmount, record.sourceMonth]),
        [
          ['housing-makeup', 900, '2026-05'],
          ['social-confirmed', 1050, '2026-06']
        ],
        'payroll deductions should include confirmed current records and confirmed makeup records only'
      );
      assertEqual(getSocialInsurancePayrollSourceState(createRecord({ handlingStatus: '延期补缴' })), '本月不扣', 'deferred records should be handled but not deducted this month');
      assertEqual(getSocialInsurancePayrollSourceState(createRecord({ handlingStatus: '本月不缴' })), '本月不扣', 'skipped records should be handled but not deducted this month');
      assertEqual(getSocialInsurancePayrollSourceState(createRecord({ handlingStatus: '待确认' })), '待处理', 'pending records should still block source readiness');
    }
  },
  {
    name: 'rolls deferred records into the next month as pending makeup items',
    run: () => {
      const records = buildSocialInsuranceRecordsWithCarryovers([
        createRecord({
          category: '公积金',
          handlingStatus: '延期补缴',
          id: 'housing-deferred',
          period: '2026-06',
          reason: '账户信息待核对'
        })
      ]);
      const carryover = records.find((record) => record.id === 'carryover-EMP-001-公积金-2026-07-2026-06');

      assertEqual(getNextSocialInsurancePeriod('2026-12'), '2027-01', 'next period should cross calendar years');
      assertEqual(records.length, 2, 'deferred source should create one carryover record');
      assertEqual(carryover?.handlingStatus, '待确认', 'carryover record should be pending confirmation');
      assertEqual(carryover?.makeupPeriod, '2026-06', 'carryover should keep original makeup month');
      assertEqual(carryover?.period, '2026-07', 'carryover should enter the next period');
    }
  },
  {
    name: 'does not duplicate existing carryover records',
    run: () => {
      const source = createRecord({
        category: '公积金',
        handlingStatus: '延期补缴',
        id: 'housing-deferred',
        period: '2026-06'
      });
      const existingCarryover = createRecord({
        category: '公积金',
        employeeNo: source.employeeNo,
        handlingStatus: '待确认',
        id: 'existing-carryover',
        makeupPeriod: '2026-06',
        period: '2026-07'
      });

      assertEqual(
        buildSocialInsuranceRecordsWithCarryovers([source, existingCarryover]).length,
        2,
        'existing carryover should prevent duplicate generated rows'
      );
    }
  },
  {
    name: 'marks orphan records as inapplicable',
    run: () => {
      const record = createRecord({ employeeNo: 'EMP-404' });

      assertEqual(getSocialInsuranceRecordEligibility(record, undefined), '人员不存在', 'orphan records should not enter confirmation workbench');
      assertEqual(isSocialInsuranceRecordApplicable(record, undefined), false, 'orphan records should be hidden');
    }
  }
];

export function runFinanceSocialInsuranceModelTests() {
  const failures: string[] = [];

  for (const test of tests) {
    try {
      test.run();
    } catch (error) {
      failures.push(`${test.name}: ${(error as Error).message}`);
    }
  }

  return {
    failures,
    passed: tests.length - failures.length,
    total: tests.length
  };
}
