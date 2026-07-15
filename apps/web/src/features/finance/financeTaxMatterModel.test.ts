import { financeTransactionRecords, getFinanceSeedPublicAccountRef, type FinanceTransactionRecord } from './financeData';
import { financeInvoiceBusinessAllocations, financeInvoiceRecords, type FinanceInvoiceRecord } from './financeInvoiceData';
import { financeReceivablePayableRecords } from './financeReceivablesPayablesData';
import type { SocialInsuranceEmployeeRecord } from './financeSocialInsuranceData';
import { financeTaxMatterRecords, type FinanceTaxMatterRecord } from './financeTaxFilingData';
import type { SalaryMonthlyReport, SalaryPaymentRecord } from '../salary/salaryDomain';
import type { PeopleMember } from '../people/peopleTypes';
import type { AccountingPeriodLockRecord, AccountingVoucherRecord } from './financeAccountingVoucherModel';
import {
  applyDeclarationPreparationSourceState,
  buildCorporateIncomeTaxSourceRows,
  ensurePayrollIitDeclarationPreparationRecords,
  financeDeclarationPreparationRecords,
  finalizeDeclarationPreparationAfterFiling,
  getDeclarationPreparationProgress,
  getDeclarationPreparationUnbilledIncomeCandidates,
  isDeclarationPreparationReady,
  recalculateCorporateIncomeTaxSummary
} from './financeDeclarationPreparationData';
import { getAccountingPeriodFromBusinessPeriod } from './financeUtils';
import {
  getActiveFinanceTaxPolicyProfile,
  getFinanceTaxPolicyProfileForPeriod,
  getFinanceVatDeclarationOutcome,
  getFinanceVatExemptionThreshold,
  getFinanceVatSurchargeSummary,
  resolveFinanceVatInvoiceTreatment
} from './financeTaxPolicyModel';
import {
  applyDeclarationPreparationToTaxMatter,
  applySocialInsuranceSummaryToTaxMatter,
  attachTaxMatterPaymentTransaction,
  attachTaxMatterRefundTransaction,
  buildSocialInsuranceTaxMatterSummary,
  buildTaxMatterPaymentTransaction,
  buildTaxMatterRefundTransaction,
  deriveTaxMatterProcessStatus,
  getTaxMatterAccountingAmount,
  getTaxMatterAccountingDelta,
  getTaxMatterDeclarationRevisionValidationError,
  getMissingTaxMatterReceiptTypes,
  getTaxMatterOutstandingAmount,
  getTaxMatterRefundOutstandingAmount,
  getTaxMatterLinkedRefundAmount,
  getTaxMatterLinkedPaymentAmount,
  getTaxMatterDeclarationPreparationSnapshot,
  getTaxMatterDeclarationResultValidationError,
  getTaxMatterRequiredReceiptTypes,
  hasTaxMatterRequiredReceiptFiles,
  ensurePayrollIitTaxMatterRecords,
  recordTaxMatterDeclarationResult,
  recordTaxMatterOffsetResult,
  recordTaxMatterPaymentResult,
  recordTaxMatterRefundApplication,
  recordTaxMatterRefundResult,
  startTaxMatterDeclarationRevision,
  supplementTaxMatterDeclarationReceipt
} from './financeTaxMatterModel';
import {
  buildPayrollIitDeclarationEmployeeRows,
  buildPayrollIitDeclarationSummary
} from './financePayrollIitDeclarationModel';
import { buildCorporateIncomeTaxAccountingSource } from './financeCorporateIncomeTaxModel';
import {
  getCorporateIncomeTaxSourceCheckResult,
  getPreparationItemCheckResult
} from './declarationCheckResultModel';

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

function createSocialRecord(overrides: Partial<SocialInsuranceEmployeeRecord> = {}): SocialInsuranceEmployeeRecord {
  return {
    category: '社保',
    companyAmount: 2214,
    contributionBase: 8200,
    department: '财务部',
    employeeName: '测试员工',
    employeeNo: 'EMP-001',
    handlingStatus: '已确认',
    id: 'social-record-001',
    operationRecords: [],
    period: '2026-06',
    personalAmount: 861,
    position: '财务专员',
    salaryBase: 8200,
    updatedAt: '2026-06-15',
    ...overrides
  };
}

function createTaxMatter(overrides: Partial<FinanceTaxMatterRecord> = {}): FinanceTaxMatterRecord {
  return {
    dataStatus: '待复核',
    declarationDueDate: '2026-07-20',
    declarationHistory: [],
    declarationStatus: '待申报',
    declarationVersion: 1,
    files: [],
    id: 'tax-matter-social',
    linkedTransactionNos: [],
    matterNo: 'TAX-202606-SOCIAL',
    matterType: '社保缴纳',
    operationRecords: [],
    owner: '李明',
    paidAmount: 0,
    participantSummary: '待确认',
    payableAmount: 0,
    preparedPayableAmount: 0,
    paymentDueDate: '2026-07-20',
    paymentStatus: '未开始',
    period: '2026-06',
    periodType: '月度',
    processStatus: '数据待确认',
    sourceItems: [],
    title: '2026-06 社保缴纳',
    updatedAt: '2026-06-15',
    ...overrides
  };
}

function createFinanceRow(overrides: Partial<FinanceTransactionRecord> = {}): FinanceTransactionRecord {
  return {
    accountingPeriod: '2026-07',
    amount: 1000,
    category: '税费缴纳',
      categorySnapshot: {
        accountingSubject: {
          balanceDirection: '贷方',
          code: '2221',
          name: '应交税费',
          type: '负债类'
        },
        accountingSubjectMappings: {
          cashCredit: '1002',
          cashDebit: '2221.99'
        },
        includeInReport: false,
        mappingStatus: '已配置',
        primaryCode: 'FC1-EXP-TAX',
        primaryName: '税费处理',
        reportAggregation: '其他',
      secondaryCode: 'FC2-EXP-TAX-PAYMENT',
      secondaryName: '税费缴纳'
    },
    counterparty: '社保经办机构',
    counterpartyType: '内部',
    currency: 'CNY',
    direction: '支出',
    files: [],
    id: 'fin-row-001',
    note: '测试税费缴纳',
    occurredAt: '2026-07-15',
    operationRecords: [],
    paymentMethod: '对公账户付款',
    ...getFinanceSeedPublicAccountRef('public-account-ccb-payment-reserve'),
    reconciliationStatus: '未对账',
    registeredBy: '李明',
    sourceNo: 'TAX-202606-SOCIAL',
    sourceTitle: '2026-06 社保缴纳',
    sourceType: '税费事项',
    status: '待复核',
    transactionNo: 'FIN-202607-0001',
    updatedAt: '2026-07-15',
    voucherStatus: '待补充',
    ...overrides
  };
}

function createSalaryReport(overrides: Partial<SalaryMonthlyReport> = {}): SalaryMonthlyReport {
  const personalIncomeTaxAmount = overrides.personalIncomeTaxAmount ?? 315;
  const taxableIncomeAmount = overrides.personalIncomeTaxRecords?.[0]?.currentIncomeAmount ?? 12100;
  const settlementSnapshot = overrides.settlementSnapshot ?? {
    businessDeductionAmount: 0,
    employeeGrossPayableAmount: taxableIncomeAmount,
    employeeHousingFundAmount: 0,
    employeeNetPayableAmount: taxableIncomeAmount - personalIncomeTaxAmount,
    employeeSocialInsuranceAmount: 0,
    employerContributionAmount: 0,
    employerHousingFundAmount: 0,
    employerSocialInsuranceAmount: 0,
    grossEarningsAmount: taxableIncomeAmount,
    payrollMonth: '2026-06',
    payrollNo: `PAY-202606-${overrides.member?.id ?? 'EMP-001'}`,
    taxableIncomeAmount,
    totalEmploymentCostAmount: taxableIncomeAmount,
    withheldPersonalIncomeTaxAmount: personalIncomeTaxAmount
  };

  return {
    month: '2026-06',
    member: { id: 'EMP-001', name: '测试员工', position: '财务专员' } as SalaryMonthlyReport['member'],
    personalIncomeTaxAmount,
    settlementSnapshot,
    personalIncomeTaxRecords: [
      {
        amount: 315,
        basicDeductionAmount: 5000,
        cumulativeAdditionalDeductionAmount: 0,
        cumulativeBasicDeductionAmount: 30000,
        cumulativeIncomeAmount: 72600,
        cumulativeOtherDeductionAmount: 0,
        cumulativeSpecialDeductionAmount: 4800,
        cumulativeTaxAmount: 1260,
        cumulativeTaxableIncomeAmount: 37800,
        currentAdditionalDeductionAmount: 0,
        currentIncomeAmount: 12100,
        currentOtherDeductionAmount: 0,
        currentSpecialDeductionAmount: 800,
        currentTaxableIncomeAmount: 6300,
        employeeName: '测试员工',
        employeeNo: 'EMP-001',
        id: 'personal-tax-EMP-001-2026-06',
        payrollMonth: '2026-06',
        priorCumulativePeriod: '2026-05',
        priorWithheldTaxAmount: 945,
        quickDeductionAmount: 2520,
        reason: '薪酬明细累计预扣',
        sourceModule: '薪酬明细',
        sourceMonth: '2026-06',
        taxRate: 0.1
      }
    ],
    status: '已确认',
    ...overrides
  } as SalaryMonthlyReport;
}

function createSalaryPaymentRecordForTest(
  report: SalaryMonthlyReport,
  overrides: Partial<SalaryPaymentRecord> = {}
): SalaryPaymentRecord {
  return {
    employeeName: report.member.name,
    employeeNo: report.member.id,
    id: `salary-payment-${report.month}-${report.member.id}`,
    identityNo: report.member.identityNo ?? '420102199001011234',
    paymentAccountName: '测试付款账户',
    paymentEvidenceStatus: '已核验',
    financeTransactionNo: `FIN-TEST-${report.member.id}`,
    paidAt: '2026-06-15 10:30',
    paidBy: '测试出纳',
    payrollMonth: '2026-05',
    payrollNo: `PAY-202605-${report.member.id}`,
    personalIncomeTaxRecord: report.personalIncomeTaxRecords[0],
    position: report.member.position,
    settlementSnapshot: report.settlementSnapshot,
    taxPeriod: '2026-06',
    ...overrides
  };
}

function createBookedCorporateIncomeTaxSourceVoucher(): AccountingVoucherRecord {
  return {
    accountingPeriod: '2026-06',
    amount: 150000,
    bookedAt: '2026-06-30 17:10',
    bookedBy: '李明',
    businessType: '权责凭证',
    counterparty: '测试业务汇总',
    id: 'voucher-cit-source-2026q2',
    invoiceRefs: [],
    issueReasons: [],
    kind: '转账凭证',
    lines: [
      { amount: 100000, auxiliary: '测试客户', id: 'cit-line-1', side: '借方', subjectCode: '1122', summary: '确认设计服务收入' },
      { amount: 100000, auxiliary: '测试客户', id: 'cit-line-2', side: '贷方', subjectCode: '5001', summary: '确认设计服务收入' },
      { amount: 30000, auxiliary: '测试供应商', id: 'cit-line-3', side: '借方', subjectCode: '5401', summary: '确认项目成本' },
      { amount: 30000, auxiliary: '测试供应商', id: 'cit-line-4', side: '贷方', subjectCode: '2202', summary: '确认项目成本' },
      { amount: 20000, auxiliary: '测试员工', id: 'cit-line-5', side: '借方', subjectCode: '5602.01', summary: '确认职工薪酬' },
      { amount: 20000, auxiliary: '测试员工', id: 'cit-line-6', side: '贷方', subjectCode: '2211.01', summary: '确认职工薪酬' }
    ],
    sourceModule: '应收应付',
    sourceNo: 'CIT-SOURCE-2026Q2',
    sourceRefs: [],
    sourceTitle: '企业所得税账务来源测试',
    sourceType: '业务确认',
    status: '已记账',
    summary: '企业所得税账务来源测试',
    voucherDate: '2026-06-30',
    voucherNo: '记-202606-099'
  };
}

const corporateIncomeTaxPeopleRows = [
  {
    id: 'EMP-CIT-001',
    joinedAt: '2025-01-01',
    personnelType: '全职',
    status: '在职'
  },
  {
    id: 'EMP-CIT-002',
    joinedAt: '2026-04-01',
    personnelType: '全职',
    status: '在职'
  }
] as PeopleMember[];

const q2ClosedPeriodLocks: AccountingPeriodLockRecord[] = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'].map((accountingPeriod) => ({
  accountingPeriod,
  status: '已结账'
}));

function getCorporateIncomeTaxPreparationRows(records = financeDeclarationPreparationRecords) {
  const voucherRows = [createBookedCorporateIncomeTaxSourceVoucher()];
  const accountingSource = buildCorporateIncomeTaxAccountingSource({
    periodLocks: q2ClosedPeriodLocks,
    peopleRows: corporateIncomeTaxPeopleRows,
    period: '2026-Q2',
    voucherRows
  });
  const annualAccountingSource = buildCorporateIncomeTaxAccountingSource({
    peopleRows: corporateIncomeTaxPeopleRows,
    period: '2026',
    voucherRows
  });

  return applyDeclarationPreparationSourceState(
    records,
    [],
    [],
    [],
    [],
    financeTaxMatterRecords,
    [],
    {
      ...(accountingSource ? { '2026-Q2': accountingSource } : {}),
      ...(annualAccountingSource ? { '2026': annualAccountingSource } : {})
    },
    q2ClosedPeriodLocks
  );
}

const tests: UnitTest[] = [
  {
    name: 'uses confirmed declaration snapshots in tax handling details',
    run: () => {
      const preparation = financeDeclarationPreparationRecords.find(
        (record) => record.preparationNo === 'PREP-2026Q1-VAT'
      );

      if (!preparation) {
        throw new Error('missing confirmed VAT declaration preparation fixture');
      }

      const snapshot = getTaxMatterDeclarationPreparationSnapshot({
        ...preparation,
        unbilledIncomeDeclarations: [],
        vatSummary: {
          ...preparation.vatSummary,
          declaredNetSalesAmount: 999999
        }
      });

      assertEqual(
        snapshot.vatSummary.declaredNetSalesAmount,
        preparation.confirmedVatSummary?.declaredNetSalesAmount,
        'tax handling should read the confirmed VAT summary'
      );
      assertDeepEqual(
        snapshot.unbilledIncomeDeclarations,
        preparation.confirmedUnbilledIncomeDeclarations,
        'tax handling should read confirmed unbilled income facts'
      );
    }
  },
  {
    name: 'CIT-01 CIT-10 separates quarterly CIT prepayment from annual settlement',
    run: () => {
      const preparationRows = getCorporateIncomeTaxPreparationRows();
      const quarterly = preparationRows.find((record) => record.preparationNo === 'PREP-2026Q2-CIT');
      const annual = preparationRows.find((record) => record.preparationNo === 'PREP-2026-CIT-ANNUAL');
      const annualMatter = financeTaxMatterRecords.find((record) => record.matterNo === 'TAX-2026-CIT-ANNUAL');

      if (!quarterly || !annual || !annualMatter) {
        throw new Error('missing quarterly or annual corporate income tax fixtures');
      }

      const annualHandling = applyDeclarationPreparationToTaxMatter(annualMatter, preparationRows);

      assertEqual(quarterly.declarationScenario, '季度预缴', 'quarterly CIT should use the prepayment scenario');
      assertEqual(annual.declarationScenario, '年度汇算', 'annual CIT should use the settlement scenario');
      assertEqual(annual.citSummary?.cumulativeOperatingRevenueAmount, 100000, 'annual CIT should consume full-year booked accounting facts');
      assertEqual(annual.citAnnualSettlement?.yearEndClosed, false, 'annual settlement should wait for December close');
      assertEqual(annual.citAnnualSettlement?.q4PrepaymentReady, false, 'annual settlement should wait for Q4 prepayment');
      assertEqual(annual.citAnnualSettlement?.adjustments.length, 0, 'annual settlement must not manufacture tax adjustments without source facts');
      assertEqual(annual.citSummary?.priorLossDeductionAmount, 0, 'annual settlement must not manufacture prior-year loss deductions');
      assertEqual(annual.citAnnualSettlement?.adjustmentSourceReady, false, 'annual settlement should wait for annual adjustment review');
      assertEqual(annual.citAnnualSettlement?.priorLossSourceReady, false, 'annual settlement should wait for prior-loss review');
      assertEqual(
        buildCorporateIncomeTaxSourceRows(annual)[0]?.name,
        '年度账务完整性',
        'annual settlement should use annual accounting-readiness wording'
      );
      assertEqual(
        buildCorporateIncomeTaxSourceRows(annual).some((row) => row.name === '职工薪酬附报'),
        true,
        'annual CIT source details should retain payroll reporting'
      );
      assertEqual(getDeclarationPreparationProgress(annual).pendingCount, 5, 'annual settlement should block on accounting and annual tax source prerequisites');
      assertEqual(annualHandling.processStatus, '数据待确认', 'tax handling should remain blocked before annual settlement is confirmed');
      assertEqual(annualHandling.payableAmount, 0, 'annual tax handling must not consume an unconfirmed settlement amount');
    }
  },
  {
    name: 'CIT-09 uses reviewed annual CIT source facts instead of generated mock adjustments',
    run: () => {
      const sourceRows = financeDeclarationPreparationRecords.map((record) =>
        record.preparationNo === 'PREP-2026-CIT-ANNUAL'
          ? {
              ...record,
              citAnnualSourceReview: {
                adjustments: [
                  {
                    accountingAmount: 1000,
                    adjustmentAmount: 400,
                    deductibleAmount: 600,
                    direction: '调增' as const,
                    id: 'cit-annual-adjustment-reviewed-001',
                    item: '已核对纳税调整',
                    sourceModule: '总账',
                    sourceNo: 'VOUCHER-2026-001',
                    status: '已归集' as const
                  }
                ],
                adjustmentReviewCompleted: true,
                priorLossDeductionAmount: 200,
                priorLossReviewCompleted: true,
                priorLossSourceNo: 'LOSS-2025-001',
                reviewedAt: '2027-04-01 10:00',
                reviewedBy: '李明'
              }
            }
          : record
      );
      const annual = getCorporateIncomeTaxPreparationRows(sourceRows).find(
        (record) => record.preparationNo === 'PREP-2026-CIT-ANNUAL'
      );

      if (!annual) {
        throw new Error('missing reviewed annual corporate income tax fixture');
      }

      assertEqual(annual.citSummary?.taxAdjustmentIncreaseAmount, 400, 'annual CIT should consume reviewed adjustment facts');
      assertEqual(annual.citSummary?.priorLossDeductionAmount, 200, 'annual CIT should consume reviewed prior-loss facts');
      assertEqual(annual.citAnnualSettlement?.adjustmentSourceReady, true, 'reviewed adjustments should clear the adjustment blocker');
      assertEqual(annual.citAnnualSettlement?.priorLossSourceReady, true, 'reviewed prior losses should clear the loss blocker');
      assertEqual(getDeclarationPreparationProgress(annual).pendingCount, 3, 'reviewed tax sources should leave only year-end accounting prerequisites');
    }
  },
  {
    name: 'CIT-02 CIT-03 CIT-04 CIT-05 keeps corporate income tax preparation on small low-profit prepayment basis',
    run: () => {
      const taxPolicy = getActiveFinanceTaxPolicyProfile().corporateIncomeTax;
      const preparationRows = getCorporateIncomeTaxPreparationRows();
      const q2CitPreparation = preparationRows.find((record) => record.preparationNo === 'PREP-2026Q2-CIT');
      const q1CitPreparation = preparationRows.find((record) => record.preparationNo === 'PREP-2026Q1-CIT');

      if (!q2CitPreparation || !q1CitPreparation) {
        throw new Error('missing corporate income tax preparation fixtures');
      }

      const q2Progress = getDeclarationPreparationProgress(q2CitPreparation);
      const q1Progress = getDeclarationPreparationProgress(q1CitPreparation);
      const q2SourceRows = buildCorporateIncomeTaxSourceRows(q2CitPreparation);
      const q2ProfitSourceItem = q2CitPreparation.items.find((item) => item.type === '利润数据同步');
      const q2AdjustmentItem = q2CitPreparation.items.find((item) => item.type === '纳税调整测算');

      assertEqual(q2CitPreparation.citSummary?.smallLowProfitEligible, true, 'Q2 CIT should be treated as small low-profit candidate');
      assertEqual(q2CitPreparation.citSummary?.effectiveTaxRate, taxPolicy.smallLowProfitEffectiveTaxRate, 'Q2 CIT should use configured effective prepayment estimate');
      assertEqual(q2CitPreparation.citSummary?.smallLowProfitTaxableIncomeLimit, taxPolicy.smallLowProfitTaxableIncomeLimit, 'Q2 CIT should use configured taxable income limit');
      assertEqual(q2CitPreparation.citSummary?.cumulativeOperatingRevenueAmount, 100000, 'Q2 CIT should derive revenue from booked ledger entries');
      assertEqual(q2CitPreparation.citSummary?.cumulativeOperatingCostAmount, 30000, 'Q2 CIT should derive operating cost from booked ledger entries');
      assertEqual(q2CitPreparation.citSummary?.cumulativePayrollAndSocialInsuranceAmount, 20000, 'Q2 CIT should derive payroll expense from booked ledger entries');
      assertEqual(q2CitPreparation.citSummary?.cumulativeProfitBeforeTaxAmount, 50000, 'Q2 CIT should derive year-to-date profit before income tax from the ledger');
      assertEqual(q2CitPreparation.citSummary?.averageEmployeeCount, 1.5, 'Q2 CIT should use quarterly average employee counts from personnel dates');
      assertEqual(q2CitPreparation.citSummary?.cumulativeTaxableIncomeAmount, 45500, 'Q2 CIT should calculate cumulative actual profit after adjustments and prior losses');
      assertEqual(q2CitPreparation.citSummary?.cumulativeIncomeTaxPayableAmount, 2275, 'Q2 CIT should calculate cumulative income tax after small-low-profit relief');
      assertEqual(q2CitPreparation.citSummary?.taxPaidYearToDateAmount, 500, 'Q2 CIT should consume paid Q1 tax matters');
      assertEqual(q2CitPreparation.citSummary?.currentPeriodPayableAmount, 1775, 'Q2 CIT should deduct prior paid tax from cumulative payable tax');
      assertEqual(q2ProfitSourceItem?.status, '无需确认', 'Q2 CIT synced profit source should be read-only');
      assertDeepEqual(
        q2SourceRows.map((row) => [row.name, row.sourceModule, row.status]),
        [
          ['季度账务完整性', '期间结账', '已同步'],
          ['以前季度申报', '税务办理', '已同步'],
          ['本年累计营业收入', '利润表', '已同步'],
          ['本年累计营业成本', '利润表', '已同步'],
          ['本年累计利润总额', '利润表', '已同步'],
          ['纳税调整', '季度税务资料', '已同步'],
          ['弥补亏损', '季度税务资料', '已同步'],
          ['抵免所得税额', '季度税务资料', '已同步'],
          ['本年实际已缴税额', '税务办理', '已同步'],
          ['小型微利资格', '税务口径', '已同步']
        ],
        'Q2 CIT source rows should separate finance, payroll, adjustment, loss, and policy sources'
      );
      assertDeepEqual(
        q2SourceRows.slice(0, 2).map((row) => [row.name, row.valueKind, row.unit]),
        [
          ['季度账务完整性', 'count', '张'],
          ['以前季度申报', 'count', '个季度']
        ],
        'CIT readiness rows should preserve count semantics instead of formatting quantities as money'
      );
      assertEqual(q2SourceRows[2]?.valueKind, 'amount', 'CIT accounting amounts should keep money semantics');
      assertEqual(q2SourceRows[0]?.displayValue, '无待记账', 'ready CIT accounting source should avoid a meaningless zero count');
      assertEqual(q2SourceRows[1]?.displayValue, '申报连续', 'ready prior filings should show the business conclusion');
      assertEqual(q2SourceRows.at(-1)?.displayValue, '符合', 'small low-profit source should show its qualification conclusion');
      assertEqual(
        getPreparationItemCheckResult(q2AdjustmentItem!).summary,
        '净调增 500.00 元',
        'CIT adjustment result should lead with its concise conclusion'
      );
      assertEqual(
        getCorporateIncomeTaxSourceCheckResult(q2SourceRows[0]!).summary,
        '账务期间完整',
        'ready CIT source should lead with its business conclusion'
      );
      assertEqual(
        getCorporateIncomeTaxSourceCheckResult(q2SourceRows.at(-1)!).summary,
        '符合小型微利企业条件',
        'qualification source should not lead with a long policy explanation'
      );
      assertEqual(
        q2SourceRows.some((row) => row.name === '职工薪酬附报'),
        false,
        'quarterly CIT source details should not expose annual payroll reporting'
      );
      assertEqual(q2Progress.processedCount, 3, 'Q2 CIT should count reviewed adjustment, loss and tax-credit sources');
      assertEqual(q2Progress.pendingCount, 0, 'Q2 CIT should expose calculations for one final preparation confirmation');
      assertEqual(isDeclarationPreparationReady(q2CitPreparation), true, 'Q2 CIT should be ready for the single final confirmation when source facts are complete');
      assertEqual(q1CitPreparation.citSummary?.currentPeriodPayableAmount, 500, 'Q1 completed CIT fixture should align with small low-profit prepayment');
      assertEqual(q1Progress.pendingCount, 0, 'Q1 completed CIT fixture should not expose pending preparation items');
    }
  },
  {
    name: 'excludes unbooked vouchers from corporate income tax accounting sources',
    run: () => {
      const bookedVoucher = createBookedCorporateIncomeTaxSourceVoucher();
      const source = buildCorporateIncomeTaxAccountingSource({
        peopleRows: corporateIncomeTaxPeopleRows,
        period: '2026-Q2',
        voucherRows: [{ ...bookedVoucher, status: '待记账' }]
      });

      assertEqual(source?.cumulativeOperatingRevenueAmount, 0, 'unbooked revenue must not enter CIT preparation');
      assertEqual(source?.cumulativeProfitBeforeTaxAmount, 0, 'unbooked profit must not enter CIT preparation');
    }
  },
  {
    name: 'CIT-06 blocks quarterly CIT confirmation until the year-to-date books are closed and prior filings are continuous',
    run: () => {
      const voucherRows: AccountingVoucherRecord[] = [];
      const accountingSource = buildCorporateIncomeTaxAccountingSource({
        peopleRows: corporateIncomeTaxPeopleRows,
        period: '2026-Q2',
        voucherRows
      });
      const [preparation] = applyDeclarationPreparationSourceState(
        financeDeclarationPreparationRecords.filter((record) => record.preparationNo === 'PREP-2026Q2-CIT'),
        [],
        [],
        [],
        [],
        financeTaxMatterRecords.filter((record) => record.period !== '2026-Q1'),
        [],
        accountingSource ? { '2026-Q2': accountingSource } : {}
      );

      if (!preparation) {
        throw new Error('missing Q2 CIT preparation fixture');
      }

      assertEqual(preparation.citSummary?.accountingSourceReady, false, 'unclosed quarter must not be treated as a complete accounting source');
      assertDeepEqual(preparation.citSummary?.unclosedAccountingPeriods, ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'], 'all unclosed year-to-date months should remain visible');
      assertDeepEqual(preparation.citSummary?.missingPriorQuarterPeriods, ['2026-Q1'], 'missing prior filing should be explicit');
      assertEqual(getDeclarationPreparationProgress(preparation).pendingCount, 2, 'accounting and filing continuity should both block confirmation');
      assertEqual(isDeclarationPreparationReady(preparation), false, 'an incomplete source that currently calculates to zero must not become a zero filing');
    }
  },
  {
    name: 'CIT-07 blocks quarterly CIT confirmation until adjustment loss and tax-credit facts are reviewed',
    run: () => {
      const sourceRecord = financeDeclarationPreparationRecords.find(
        (record) => record.preparationNo === 'PREP-2026Q2-CIT'
      );

      if (!sourceRecord) {
        throw new Error('missing Q2 CIT preparation fixture');
      }

      const preparation = getCorporateIncomeTaxPreparationRows([
        {
          ...sourceRecord,
          citQuarterSourceReview: undefined
        }
      ])[0];

      if (!preparation) {
        throw new Error('missing unreviewed Q2 CIT preparation');
      }

      assertEqual(preparation.citSummary?.taxAdjustmentIncreaseAmount, 0, 'unreviewed adjustments must not enter the taxable-income calculation');
      assertEqual(preparation.citSummary?.priorLossDeductionAmount, 0, 'unreviewed prior losses must not reduce taxable income');
      assertEqual(preparation.citSummary?.taxCreditAmount, 0, 'unreviewed tax credits must not reduce payable tax');
      assertEqual(getDeclarationPreparationProgress(preparation).pendingCount, 3, 'three quarterly tax-source reviews should block confirmation');
      assertEqual(isDeclarationPreparationReady(preparation), false, 'quarterly CIT must not be confirmed without reviewed tax facts');
    }
  },
  {
    name: 'does not create another CIT payment when prior prepayments cover cumulative tax',
    run: () => {
      const q2Preparation = getCorporateIncomeTaxPreparationRows().find((record) => record.preparationNo === 'PREP-2026Q2-CIT');

      if (!q2Preparation?.citSummary) {
        throw new Error('missing Q2 CIT preparation fixture');
      }

      const recalculated = recalculateCorporateIncomeTaxSummary(q2Preparation.citSummary, 2500);

      assertEqual(recalculated.cumulativeIncomeTaxPayableAmount, 2275, 'cumulative payable tax should remain unchanged');
      assertEqual(recalculated.currentPeriodPayableAmount, 0, 'covered cumulative tax should produce zero current payment');
      assertEqual(recalculated.overpaidTaxAmount, 225, 'excess prior prepayment should remain visible for filing treatment');
    }
  },
  {
    name: 'CIT-08 reopens confirmed CIT preparation when prior paid tax changes',
    run: () => {
      const q2Preparation = getCorporateIncomeTaxPreparationRows().find((record) => record.preparationNo === 'PREP-2026Q2-CIT');

      if (!q2Preparation?.citSummary) {
        throw new Error('missing Q2 CIT preparation fixture');
      }

      const [recalculated] = getCorporateIncomeTaxPreparationRows(
        [
          {
            ...q2Preparation,
            confirmedCitSummary: q2Preparation.citSummary,
            confirmedSourceSnapshotKey: 'confirmed-before-prior-payment-change',
            items: q2Preparation.items.map((item) => ({
              ...item,
              status: item.status === '无需确认' ? '无需确认' : '已确认'
            })),
            status: '可申报'
          }
        ]
      );
      const adjustmentItem = recalculated.items.find((item) => item.type === '纳税调整测算');
      const basisItem = recalculated.items.find((item) => item.type === '预缴测算');

      assertEqual(recalculated.status, '准备中', 'changed cumulative payment evidence should reopen preparation');
      assertEqual(adjustmentItem?.status, '已确认', 'reviewed tax adjustments should retain their reviewed source state');
      assertEqual(basisItem?.status, '无需确认', 'changed source facts should refresh the prepayment calculation without row-level reconfirmation');
    }
  },
  {
    name: 'VAT-01 uses the period-effective VAT policy in declaration preparation',
    run: () => {
      const vatPolicy = getActiveFinanceTaxPolicyProfile().vatDeclaration;
      const preparationRows = applyDeclarationPreparationSourceState(financeDeclarationPreparationRecords, [], [], []);
      const q2VatPreparation = preparationRows.find((record) => record.preparationNo === 'PREP-2026Q2-VAT');

      if (!q2VatPreparation) {
        throw new Error('missing VAT declaration preparation fixture');
      }

      assertEqual(q2VatPreparation.vatSummary.exemptionThreshold, getFinanceVatExemptionThreshold(vatPolicy), 'VAT preparation should use the configured period threshold');
      assertEqual(q2VatPreparation.vatSummary.isBelowExemptionThreshold, true, 'empty Q2 VAT fixture should be below configured threshold');
      assertEqual(q2VatPreparation.items.some((item) => item.sourceModule === '税务口径'), false, 'VAT items should not duplicate tax policy as a manual source row');
      assertEqual(q2VatPreparation.items.find((item) => item.type === '申报测算')?.status, '无需确认', 'VAT measurement should be reviewed through the single final confirmation instead of a row action');
    }
  },
  {
    name: 'VAT-07 offsets prior exempt unbilled income when the later invoice is declared',
    run: () => {
      const preparationRows = applyDeclarationPreparationSourceState(
        financeDeclarationPreparationRecords,
        financeInvoiceRecords,
        financeTransactionRecords,
        financeReceivablePayableRecords,
        financeInvoiceBusinessAllocations
      );
      const q2VatPreparation = preparationRows.find((record) => record.preparationNo === 'PREP-2026Q2-VAT');

      if (!q2VatPreparation) {
        throw new Error('missing VAT declaration preparation fixture');
      }

      assertEqual(q2VatPreparation.vatSummary.taxOutcome, '混合口径', 'a 1% later invoice and exempt ordinary sales should remain separate filing treatments');
      assertEqual(q2VatPreparation.vatSummary.estimatedVatAfterExemption, 9.9, 'the later 1% invoice should retain its output VAT after the prior exempt sales offset');
      assertEqual(q2VatPreparation.vatSummary.estimatedSurcharge > 0, true, 'VAT payable should create the configured surcharge estimate');
      assertEqual(q2VatPreparation.vatSummary.priorUnbilledOffsetNetAmount, 990.1, 'a later invoice linked to the original receivable should offset prior unbilled income');
      assertEqual(
        q2VatPreparation.vatSummary.exemptSalesAmount +
          q2VatPreparation.vatSummary.reducedRateSalesAmount +
          q2VatPreparation.vatSummary.legalRateSalesAmount,
        q2VatPreparation.vatSummary.declaredNetSalesAmount,
        'filing treatment lines should reconcile to declared sales'
      );
    }
  },
  {
    name: 'VAT-02 derives unbilled taxable facts from confirmed receivables instead of cash receipts',
    run: () => {
      const preparation = financeDeclarationPreparationRecords.find((record) => record.preparationNo === 'PREP-2026Q2-VAT');

      if (!preparation) {
        throw new Error('missing Q2 VAT preparation fixture');
      }

      const candidates = getDeclarationPreparationUnbilledIncomeCandidates(
        preparation,
        financeInvoiceRecords,
        financeReceivablePayableRecords,
        financeInvoiceBusinessAllocations
      );
      const unpaidReceivable = candidates.find((candidate) => candidate.businessRecord.id === 'ar-202606-007');
      const unbilledPreparationItem = preparation.items.find((item) => item.type === '未开票收入核对');

      assertEqual(Boolean(unpaidReceivable), true, 'an unpaid but confirmed receivable should still be an unbilled taxable fact');
      assertEqual(unbilledPreparationItem?.sourceModule, '应收应付', 'the UI source label must match the accrual source used by the domain model');
      assertEqual(unpaidReceivable?.businessRecord.settlementStatus, '未结清', 'cash settlement must not control VAT recognition');
      assertEqual(unpaidReceivable?.taxBasisResolved, true, 'the receivable tax basis should be ready for automatic inclusion');
      assertEqual(unpaidReceivable?.selectedForInclusion, true, 'a resolved system candidate should be selected by default');
      assertEqual(unpaidReceivable?.status, '系统纳入', 'the default selection must be presented as a system result');
    }
  },
  {
    name: 'VAT-03 requires evidence when finance excludes a system-selected unbilled income candidate',
    run: () => {
      const source = financeDeclarationPreparationRecords.find((record) => record.preparationNo === 'PREP-2026Q2-VAT');

      if (!source) {
        throw new Error('missing Q2 VAT preparation fixture');
      }

      const pendingReasonRecord = {
        ...source,
        status: '准备中' as const,
        unbilledIncomeExclusions: [{
          businessRecordId: 'ar-202606-007',
          excludedAt: '2026-06-30 15:00',
          excludedBy: '李明'
        }]
      };
      const pendingCandidate = getDeclarationPreparationUnbilledIncomeCandidates(
        pendingReasonRecord,
        financeInvoiceRecords,
        financeReceivablePayableRecords,
        financeInvoiceBusinessAllocations
      ).find((candidate) => candidate.businessRecord.id === 'ar-202606-007');
      const excludedRecord = {
        ...pendingReasonRecord,
        unbilledIncomeExclusions: [{
          ...pendingReasonRecord.unbilledIncomeExclusions[0]!,
          reason: '尚未发生纳税义务' as const
        }]
      };
      const excludedCandidate = getDeclarationPreparationUnbilledIncomeCandidates(
        excludedRecord,
        financeInvoiceRecords,
        financeReceivablePayableRecords,
        financeInvoiceBusinessAllocations
      ).find((candidate) => candidate.businessRecord.id === 'ar-202606-007');
      const prepared = applyDeclarationPreparationSourceState(
        [excludedRecord],
        financeInvoiceRecords,
        financeTransactionRecords,
        financeReceivablePayableRecords,
        financeInvoiceBusinessAllocations
      )[0];

      assertEqual(pendingCandidate?.status, '排除待说明', 'an unchecked candidate without a reason must remain blocked');
      assertEqual(excludedCandidate?.status, '已排除', 'a supported reason should complete the exception review');
      assertEqual(excludedCandidate?.includedInDeclaration, false, 'an explained exception must not enter the VAT calculation');
      assertEqual(
        prepared?.unbilledIncomeDeclarations?.some((fact) => fact.businessRecordId === 'ar-202606-007'),
        false,
        'the declaration snapshot must exclude the explained business record'
      );
    }
  },
  {
    name: 'allows a zero declaration period without requiring a blue invoice',
    run: () => {
      const source = financeDeclarationPreparationRecords.find((record) => record.preparationNo === 'PREP-2026Q2-VAT');

      if (!source) {
        throw new Error('missing Q2 VAT preparation fixture');
      }

      const zeroPreparation = {
        ...source,
        id: 'declaration-prep-zero-vat',
        period: '2026-Q3',
        preparationNo: 'PREP-2026Q3-VAT'
      };
      const prepared = applyDeclarationPreparationSourceState([zeroPreparation], [], [], [])[0];
      const outputItem = prepared?.items.find((item) => item.type === '销项发票核对');

      assertEqual(outputItem?.status, '无需确认', 'a period without blue invoices should be a valid no-invoice state');
      assertEqual(isDeclarationPreparationReady(prepared!), true, 'a zero declaration should be confirmable when no source issue remains');
    }
  },
  {
    name: 'VAT-04 keeps special-invoice sales taxable below the exemption threshold',
    run: () => {
      const policy = getFinanceTaxPolicyProfileForPeriod('2026-06');
      const preparation = financeDeclarationPreparationRecords.find((record) => record.preparationNo === 'PREP-2026Q2-VAT');

      if (!policy || !preparation) {
        throw new Error('missing 2026 policy or VAT preparation fixture');
      }

      const specialInvoice: FinanceInvoiceRecord = {
        accountingPeriod: '2026-06',
        counterparty: '专票客户',
        declarationPeriod: '2026-Q2',
        declarationTreatment: '本期申报',
        direction: '销项',
        id: 'invoice-special-202606',
        importedAt: '2026-06-21 18:00',
        invoiceColor: '蓝票',
        invoiceDate: '2026-06-21',
        invoiceKind: '专用发票',
        invoiceNo: 'SPECIAL-202606-001',
        invoiceStatus: '正常',
        salesCategory: '服务、不动产和无形资产',
        netAmount: 200000,
        sourceFile: '2026-06_销项专票.xlsx',
        taxAmount: 2000,
        taxExcludedAmount: 200000,
        taxIncludedAmount: 202000,
        taxRate: '1%',
        taxableClassification: '普通应税交易',
        totalAmount: 202000,
        vatTreatment: '减按1%'
      };
      const prepared = applyDeclarationPreparationSourceState([preparation], [specialInvoice], [], [])[0];
      const surcharge = getFinanceVatSurchargeSummary({ accountingPeriod: '2026-06', vatPayableAmount: 1000 });

      assertEqual(policy.version, '2026.1', '2026 period should resolve the current effective policy version');
      assertEqual(getFinanceTaxPolicyProfileForPeriod('2028-01'), undefined, 'periods outside the configured policy window must not silently reuse it');
      assertEqual(
        getFinanceVatDeclarationOutcome({
          accountingPeriod: '2026-06',
          taxableClassification: '普通应税交易',
          taxableSalesAmount: 300001
        }),
        '减按1%',
        'a threshold calculation must use the period-specific profile instead of a static page value'
      );
      assertEqual(
        resolveFinanceVatInvoiceTreatment({
          accountingPeriod: '2026-06',
          direction: '销项',
          taxRate: '3%',
          taxableClassification: '普通应税交易'
        }),
        '按法定征收率',
        'a special invoice issued at the legal rate should retain its legal-rate treatment'
      );
      assertEqual(prepared?.vatSummary.isBelowExemptionThreshold, true, 'special-invoice fixture should remain below the quarterly threshold');
      assertEqual(prepared?.vatSummary.specialInvoiceSalesAmount, 200000, 'special invoice sales should be tracked separately');
      assertEqual(prepared?.vatSummary.estimatedVatAfterExemption, 2000, 'ticketed special-invoice tax must not be overwritten to zero by the threshold');
      assertEqual(surcharge.totalBeforeReduction, 120, 'Wuhan surcharge base should remain split at 7% + 3% + 2%');
      assertEqual(surcharge.totalAfterReduction, 60, 'qualified small-scale tax matters should apply the 50% six-tax-and-two-fee reduction');
    }
  },
  {
    name: 'VAT-08 keeps an archived declaration snapshot immutable after local source changes',
    run: () => {
      const archivedPreparation = financeDeclarationPreparationRecords.find(
        (record) => record.preparationNo === 'PREP-2026Q1-VAT'
      );

      if (!archivedPreparation) {
        throw new Error('missing archived VAT declaration preparation fixture');
      }

      const prepared = applyDeclarationPreparationSourceState([archivedPreparation], [], [], [])[0];

      assertEqual(prepared?.status, '已进入税务办理', 'archived declaration preparation must remain historical readback');
      assertEqual(prepared?.vatSummary.appliedTaxRate, '按票面分项', 'archived declaration preparation must preserve its confirmed filing result');
    }
  },
  {
    name: 'maps business periods to accounting close periods',
    run: () => {
      assertEqual(getAccountingPeriodFromBusinessPeriod('2026-06'), '2026-06', 'monthly business period should keep its month');
      assertEqual(getAccountingPeriodFromBusinessPeriod('2026-Q2'), '2026-06', 'Q2 business period should close in quarter-end month');
      assertEqual(getAccountingPeriodFromBusinessPeriod('2026'), '2026-12', 'annual business period should close in December');
      assertEqual(getAccountingPeriodFromBusinessPeriod(undefined), undefined, 'missing business period should remain unresolved');
    }
  },
  {
    name: 'summarizes confirmed social-insurance records for tax matters',
    run: () => {
      const summary = buildSocialInsuranceTaxMatterSummary(
        [
          createSocialRecord(),
          createSocialRecord({
            companyAmount: 3240,
            employeeNo: 'EMP-002',
            handlingStatus: '待确认',
            id: 'pending-social',
            personalAmount: 1260
          }),
          createSocialRecord({
            category: '公积金',
            companyAmount: 820,
            employeeNo: 'EMP-003',
            handlingStatus: '延期补缴',
            id: 'deferred-housing',
            personalAmount: 820
          })
        ],
        '社保',
        '2026-06'
      );

      assertEqual(summary.confirmedCount, 1, 'confirmed people count should only include confirmed social records');
      assertEqual(summary.pendingCount, 1, 'pending source rows should be counted');
      assertEqual(summary.totalAmount, 3075, 'tax payable amount should include company and personal shares');
      assertEqual(summary.participantSummary, '1 人', 'participant summary should follow confirmed records');
      assertEqual(summary.sourceStatus, '待复核', 'pending employee rows should keep tax matter source under review');
    }
  },
  {
    name: 'applies social-insurance confirmation progress to tax matters',
    run: () => {
      const sourceMatter = createTaxMatter({ payableAmount: 999, sourceItems: [] });
      const appliedMatter = applySocialInsuranceSummaryToTaxMatter(sourceMatter, [
        createSocialRecord(),
        createSocialRecord({ employeeNo: 'EMP-002', handlingStatus: '待确认', id: 'pending-social' })
      ]);
      const readyMatter = applySocialInsuranceSummaryToTaxMatter(
        createTaxMatter({ payableAmount: 888, processStatus: '数据待确认' }),
        [createSocialRecord()]
      );
      const completedMatter = applySocialInsuranceSummaryToTaxMatter(
        createTaxMatter({ payableAmount: 888, processStatus: '已完成' }),
        [createSocialRecord()]
      );

      assertEqual(appliedMatter.payableAmount, 3075, 'data-confirmation tax matter should read current social summary');
      assertEqual(appliedMatter.dataStatus, '待复核', 'source state should reflect social confirmation progress');
      assertEqual(appliedMatter.processStatus, '数据待确认', 'pending employee rows should keep tax matter pending confirmation');
      assertDeepEqual(
        appliedMatter.sourceItems.map((item) => [item.name, item.sourceModule, item.status]),
        [
          ['社保缴费明细', '社保公积金 / 缴费明细', '待复核'],
          ['社保缴费核定单', '电子税务局', '待准备']
        ],
        'source items should point to social-insurance confirmation and verification result'
      );
      assertEqual(readyMatter.processStatus, '待申报', 'fully confirmed employee rows should move tax matter to handling');
      assertEqual(readyMatter.dataStatus, '已确认', 'fully confirmed employee rows should mark source data confirmed');
      assertEqual(completedMatter.payableAmount, 888, 'completed tax matters should not be silently recalculated');
    }
  },
  {
    name: 'requires confirmed personal income tax preparation before tax handling',
    run: () => {
      const pendingMatter = createTaxMatter({
        matterNo: 'TAX-202606-IIT',
        matterType: '个人所得税',
        sourceItems: [],
        title: '2026-06 个人所得税'
      });
      const secondTaxRecord = {
        amount: 72,
        basicDeductionAmount: 5000,
        cumulativeAdditionalDeductionAmount: 0,
        cumulativeBasicDeductionAmount: 30000,
        cumulativeIncomeAmount: 48000,
        cumulativeOtherDeductionAmount: 0,
        cumulativeSpecialDeductionAmount: 3600,
        cumulativeTaxAmount: 432,
        cumulativeTaxableIncomeAmount: 14400,
        currentAdditionalDeductionAmount: 0,
        currentIncomeAmount: 8000,
        currentOtherDeductionAmount: 0,
        currentSpecialDeductionAmount: 600,
        currentTaxableIncomeAmount: 2400,
        employeeName: '测试员工二',
        employeeNo: 'EMP-002',
        id: 'personal-tax-EMP-002-2026-06',
        payrollMonth: '2026-06',
        priorCumulativePeriod: '2026-05',
        priorWithheldTaxAmount: 360,
        quickDeductionAmount: 0,
        reason: '薪酬明细累计预扣',
        sourceModule: '薪酬明细' as const,
        sourceMonth: '2026-06',
        taxRate: 0.03
      };
      const salaryReports = [
        createSalaryReport(),
        createSalaryReport({
          id: 'salary-report-002',
          member: { id: 'EMP-002', name: '测试员工二', position: '空间设计师' } as SalaryMonthlyReport['member'],
          personalIncomeTaxAmount: 72,
          personalIncomeTaxRecords: [secondTaxRecord],
          status: '已确认'
        } as Partial<SalaryMonthlyReport>)
      ];
      const readyPayments = salaryReports.map((report) => createSalaryPaymentRecordForTest(report));
      const salaryFinanceRows = readyPayments.map(
        (payment, index): FinanceTransactionRecord => ({
          ...financeTransactionRecords[0],
          amount: payment.settlementSnapshot.employeeNetPayableAmount,
          id: `finance-salary-test-${index + 1}`,
          occurredAt: payment.paidAt.slice(0, 10),
          sourceNo: payment.payrollNo,
          sourceType: '薪酬发放',
          status: '已入账',
          transactionNo: payment.financeTransactionNo ?? `FIN-TEST-${index + 1}`
        })
      );
      const sourceChangedPayments = readyPayments.map((payment) =>
        payment.employeeNo === 'EMP-002'
          ? {
              ...payment,
              settlementSnapshot: {
                ...payment.settlementSnapshot,
                withheldPersonalIncomeTaxAmount:
                  payment.settlementSnapshot.withheldPersonalIncomeTaxAmount + 1
              }
            }
          : payment
      );
      const summary = buildPayrollIitDeclarationSummary(readyPayments, '2026-06', salaryFinanceRows);
      const employeeRows = buildPayrollIitDeclarationEmployeeRows(readyPayments, '2026-06', salaryFinanceRows);
      const seedPreparation = financeDeclarationPreparationRecords.find(
        (record) => record.preparationNo === 'PREP-202606-IIT'
      );

      if (!seedPreparation) {
        throw new Error('missing IIT declaration preparation seed');
      }

      const pendingPreparation = applyDeclarationPreparationSourceState(
        [seedPreparation], [], [], [], [], [], []
      )[0];
      const derivedReadyPreparation = applyDeclarationPreparationSourceState(
        [seedPreparation], [], salaryFinanceRows, [], [], [], readyPayments
      )[0];

      if (!pendingPreparation || !derivedReadyPreparation) {
        throw new Error('missing derived IIT declaration preparation');
      }

      const confirmedPreparation = {
        ...derivedReadyPreparation,
        confirmedIitEmployeeRows: derivedReadyPreparation.iitEmployeeRows,
        confirmedIitSummary: derivedReadyPreparation.iitSummary,
        confirmedSourceSnapshotKey: derivedReadyPreparation.sourceSnapshotKey,
        items: derivedReadyPreparation.items,
        status: '可申报' as const
      };
      const waitingMatter = applyDeclarationPreparationToTaxMatter(pendingMatter, [pendingPreparation]);
      const readyMatter = applyDeclarationPreparationToTaxMatter(pendingMatter, [confirmedPreparation]);
      const sourceChangedPreparation = applyDeclarationPreparationSourceState(
        [confirmedPreparation], [], salaryFinanceRows, [], [], [], sourceChangedPayments
      )[0];
      const identityChangedPreparation = applyDeclarationPreparationSourceState(
        [confirmedPreparation],
        [],
        salaryFinanceRows,
        [],
        [],
        [],
        readyPayments.map((payment) =>
          payment.employeeNo === 'EMP-002'
            ? { ...payment, identityNo: '420102199202022222' }
            : payment
        )
      )[0];
      const sourceChangedMatter = applyDeclarationPreparationToTaxMatter(
        pendingMatter,
        sourceChangedPreparation ? [sourceChangedPreparation] : []
      );

      assertEqual(summary.sourceStatus, '已确认', 'actual salary payments should release IIT preparation');
      assertEqual(summary.participantSummary, '2/2 人', 'IIT preparation should expose paid salary records');
      assertEqual(summary.payableAmount, 387, 'IIT preparation should total frozen withholding from actual payments');
      assertEqual(waitingMatter.processStatus, '数据待确认', 'tax handling should wait for confirmed IIT preparation');
      assertEqual(waitingMatter.payableAmount, 0, 'tax handling must not consume a partial preparation amount');
      assertEqual(readyMatter.payableAmount, 387, 'confirmed IIT preparation should supply the filing amount');
      assertEqual(readyMatter.processStatus, '待申报', 'confirmed IIT preparation should release tax handling');
      assertEqual(sourceChangedPreparation?.status, '准备中', 'salary source changes should reopen IIT preparation');
      assertEqual(identityChangedPreparation?.status, '准备中', 'identity changes should reopen IIT preparation before filing');
      assertEqual(sourceChangedMatter.processStatus, '数据待确认', 'reopened IIT preparation should block tax handling again');
      assertDeepEqual(
        employeeRows.map((row) => [row.employeeNo, row.paymentStatus, row.payrollMonth, row.includedInFiling, row.personalIncomeTaxAmount]),
        [
          ['EMP-001', '已核验', '2026-05', true, 315],
          ['EMP-002', '已核验', '2026-05', true, 72]
        ],
        'IIT preparation employees should consume only frozen actual-payment records'
      );
      assertDeepEqual(
        readyMatter.sourceItems.map((item) => [item.name, item.sourceModule, item.status]),
        [['办理依据', '申报准备', '已确认']],
        'IIT tax handling should consume only the confirmed preparation result'
      );
    }
  },
  {
    name: 'generates monthly IIT preparation and handling records from a new actual payment period',
    run: () => {
      const payment = createSalaryPaymentRecordForTest(createSalaryReport(), {
        paidAt: '2026-07-15 10:30',
        taxPeriod: '2026-07'
      });
      const preparations = ensurePayrollIitDeclarationPreparationRecords([], [payment]);
      const matters = ensurePayrollIitTaxMatterRecords([], preparations);

      assertEqual(preparations.length, 1, 'a new actual payment period should generate one IIT preparation record');
      assertEqual(preparations[0]?.period, '2026-07', 'the generated preparation should use the actual payment month');
      assertEqual(matters.length, 1, 'the generated preparation should create one tax handling matter');
      assertEqual(matters[0]?.declarationDueDate, '2026-08-15', 'the handling matter should use the next-month due date');
      assertEqual(matters[0]?.processStatus, '数据待确认', 'a generated matter should wait for preparation confirmation');
    }
  },
  {
    name: 'NP-14 reopens a confirmed IIT preparation after a posted labor payment reversal',
    run: () => {
      const seedPreparation = financeDeclarationPreparationRecords.find(
        (record) => record.preparationNo === 'PREP-202606-IIT'
      );
      const laborSeed = financeTransactionRecords.find(
        (record) => record.naturalPersonPayment?.incomeType === '劳务报酬'
      );

      if (!seedPreparation || !laborSeed) {
        throw new Error('missing IIT preparation or labor payment seed');
      }

      const postedLabor = {
        ...laborSeed,
        files: [
          {
            id: 'labor-posted-proof',
            name: '劳务付款回单.pdf',
            status: '已上传' as const,
            type: '付款回单',
            updatedAt: '2026-06-18'
          }
        ],
        status: '已入账' as const,
        voucherStatus: '已上传' as const
      };
      const readyPreparation = applyDeclarationPreparationSourceState(
        [seedPreparation], [], [postedLabor]
      )[0];

      if (!readyPreparation) {
        throw new Error('missing derived labor IIT preparation');
      }

      const confirmedPreparation = {
        ...readyPreparation,
        confirmedIitEmployeeRows: readyPreparation.iitEmployeeRows,
        confirmedIitSummary: readyPreparation.iitSummary,
        confirmedSourceSnapshotKey: readyPreparation.sourceSnapshotKey,
        status: '可申报' as const
      };
      const postedReversal: FinanceTransactionRecord = {
        ...postedLabor,
        adjustmentContext: {
          mode: '冲正',
          originTransactionNo: postedLabor.transactionNo,
          reason: '劳务付款冲正'
        },
        id: 'labor-posted-reversal',
        naturalPersonPayment: undefined,
        sourceType: '流水冲正',
        transactionNo: 'FIN-LABOR-REVERSAL-001'
      };
      const reopenedPreparation = applyDeclarationPreparationSourceState(
        [confirmedPreparation], [], [postedLabor, postedReversal]
      )[0];

      assertEqual(readyPreparation.iitSummary?.payableAmount, 480, 'posted labor should enter IIT preparation at withheld amount');
      assertEqual(reopenedPreparation?.status, '准备中', 'posted reversal should invalidate a confirmed IIT snapshot');
      assertEqual(reopenedPreparation?.iitSummary?.reportCount, 0, 'reversed labor should no longer remain in filing participants');
    }
  },
  {
    name: 'NP-15 preserves the filed labor snapshot and opens the existing declaration correction path',
    run: () => {
      const seedPreparation = financeDeclarationPreparationRecords.find(
        (record) => record.preparationNo === 'PREP-202606-IIT'
      );
      const laborSeed = financeTransactionRecords.find(
        (record) => record.naturalPersonPayment?.incomeType === '劳务报酬'
      );

      if (!seedPreparation || !laborSeed) {
        throw new Error('missing IIT preparation or labor payment seed');
      }

      const postedLabor = {
        ...laborSeed,
        status: '已入账' as const,
        voucherStatus: '已上传' as const
      };
      const readyPreparation = applyDeclarationPreparationSourceState(
        [seedPreparation], [], [postedLabor]
      )[0];

      if (!readyPreparation) {
        throw new Error('missing filed labor IIT preparation');
      }

      const filedPreparation = {
        ...readyPreparation,
        confirmedIitEmployeeRows: readyPreparation.iitEmployeeRows,
        confirmedIitSummary: readyPreparation.iitSummary,
        confirmedSourceSnapshotKey: readyPreparation.sourceSnapshotKey,
        status: '已进入税务办理' as const
      };
      const postedReversal: FinanceTransactionRecord = {
        ...postedLabor,
        adjustmentContext: {
          mode: '冲正',
          originTransactionNo: postedLabor.transactionNo,
          reason: '申报后劳务付款冲正'
        },
        id: 'labor-filed-reversal',
        naturalPersonPayment: undefined,
        sourceType: '流水冲正',
        transactionNo: 'FIN-LABOR-FILED-REVERSAL-001'
      };
      const preservedPreparation = applyDeclarationPreparationSourceState(
        [filedPreparation], [], [postedLabor, postedReversal]
      )[0];
      const filedMatter = createTaxMatter({
        dataStatus: '已确认',
        declarationDate: '2026-07-10',
        declarationReceiptNo: 'IIT-202606-001',
        declarationStatus: '申报成功',
        declarationVersion: 1,
        matterType: '个人所得税',
        paidAmount: 480,
        payableAmount: 480,
        paymentStatus: '已缴纳',
        processStatus: '已完成'
      });
      const revision = startTaxMatterDeclarationRevision(filedMatter, '更正', '劳务付款冲正后更正申报');

      assertEqual(preservedPreparation?.status, '已进入税务办理', 'filed preparation must remain immutable after source reversal');
      assertEqual(preservedPreparation?.iitSummary?.payableAmount, 480, 'filed preparation must retain the original declared labor amount');
      assertEqual(revision.declarationVersion, 2, 'post-filing reversal should use the existing correction version path');
      assertEqual(revision.declarationHistory[0]?.filedPayableAmount, 480, 'correction history must retain the original official amount');
    }
  },
  {
    name: 'preserves a finalized historical declaration source snapshot when preparation history is unavailable',
    run: () => {
      const historicalMatter = createTaxMatter({
        dataStatus: '已确认',
        declarationStatus: '零申报',
        matterType: '增值税及附加',
        sourceItems: [
          {
            id: 'historical-preparation-source',
            name: '办理依据',
            sourceModule: '申报准备',
            status: '已确认',
            updatedAt: '2026-01-15'
          }
        ]
      });

      const result = applyDeclarationPreparationToTaxMatter(historicalMatter, []);

      assertEqual(result.sourceItems[0]?.status, '已确认', 'finalized historical declarations must keep their source snapshot');
      assertEqual(result.dataStatus, '已确认', 'missing historical preparation data must not reopen an official declaration');
    }
  },
  {
    name: 'CIT-11 records official declaration results without overwriting the prepared estimate',
    run: () => {
      const source = createTaxMatter({
        dataStatus: '已确认',
        declarationStatus: '待申报',
        matterType: '企业所得税',
        payableAmount: 5462.99,
        preparedPayableAmount: 5462.99,
        paymentStatus: '待缴纳',
        processStatus: '待申报'
      });
      const receipt = {
        id: 'cit-declaration-receipt',
        name: '企业所得税季度预缴申报回执.pdf',
        status: '已上传' as const,
        type: '申报回执',
        updatedAt: '2026-07-12'
      };
      const result = recordTaxMatterDeclarationResult(source, {
        declarationDate: '2026-07-12',
        declarationReceiptFile: receipt,
        declarationReceiptNo: 'CIT-2026Q2-001',
        declarationStatus: '申报成功',
        differenceReason: '电子税务局核定金额与系统测算存在尾差',
        settlementAmount: 5463,
        settlementDirection: '应缴'
      });

      assertEqual(result.preparedPayableAmount, 5462.99, 'prepared estimate should remain as the comparison baseline');
      assertEqual(result.payableAmount, 5463, 'official payable amount should become the payment basis');
      assertEqual(result.declarationReceiptFileId, receipt.id, 'declaration result should reference its receipt');
      assertEqual(result.processStatus, '待缴款', 'declared payable matter should move to payment');
      assertEqual(result.declarationDifferenceReason, '电子税务局核定金额与系统测算存在尾差', 'official difference should remain auditable');
    }
  },
  {
    name: 'supplements declaration evidence without rewriting the official filing result',
    run: () => {
      const declared = recordTaxMatterDeclarationResult(createTaxMatter({
        dataStatus: '已确认',
        declarationStatus: '待申报',
        matterType: '企业所得税',
        preparedPayableAmount: 0,
        processStatus: '待申报'
      }), {
        declarationDate: '2026-07-12',
        declarationStatus: '零申报',
        settlementAmount: 0,
        settlementDirection: '无需补退'
      });
      const result = supplementTaxMatterDeclarationReceipt(declared, {
        declarationReceiptNo: 'CIT-ZERO-2026Q2-001'
      });

      assertEqual(declared.processStatus, '待补回执', 'official filing without evidence should remain pending evidence');
      assertEqual(result.processStatus, '已完成', 'supplemented evidence should complete a zero filing');
      assertEqual(result.declarationStatus, declared.declarationStatus, 'supplementing evidence must not change filing status');
      assertEqual(result.payableAmount, declared.payableAmount, 'supplementing evidence must not change payable amount');
      assertEqual(result.settlementDirection, declared.settlementDirection, 'supplementing evidence must not change settlement direction');
      assertEqual(result.operationRecords[0]?.action, '补充申报回执', 'evidence supplement should be independently auditable');
    }
  },
  {
    name: 'VAT-11 records the official VAT and surcharge breakdown without losing the accounting-source baseline',
    run: () => {
      const source = financeTaxMatterRecords.find(
        (record) => record.matterType === '增值税及附加' && Boolean(record.vatSettlement)
      );

      if (!source?.vatSettlement) {
        throw new Error('missing VAT settlement fixture');
      }

      const result = recordTaxMatterDeclarationResult({
        ...source,
        declarationStatus: '待申报',
        declarationReceiptFileId: undefined,
        declarationReceiptNo: undefined,
        paymentStatus: '待缴纳',
        processStatus: '待申报'
      }, {
        declarationDate: '2026-04-15',
        declarationReceiptNo: 'VAT-Q1-OFFICIAL-001',
        declarationStatus: '申报成功',
        differenceReason: '电子税务局回执尾差',
        settlementAmount: 470,
        settlementDirection: '应缴',
        vatBreakdown: {
          declaredVatAmount: 440.1,
          educationSurchargeAmount: 8.8,
          localEducationSurchargeAmount: 5.9,
          urbanMaintenanceTaxAmount: 15.2
        }
      });

      assertEqual(result.payableAmount, 470, 'the official itemized total should become the payment basis');
      assertEqual(result.vatSettlement?.declaredVatAmount, 440.1, 'the official VAT amount should be retained');
      assertEqual(result.vatSettlement?.sourceRecognizedVatAmount, source.vatSettlement.sourceRecognizedVatAmount, 'the independent accounting baseline must not be overwritten');
      assertEqual(result.vatSettlement?.surcharge.totalAfterReduction, 29.9, 'the official surcharge components should reconcile to their total');
    }
  },
  {
    name: 'VAT-14 derives a correction refund from the difference between official filing versions',
    run: () => {
      const original = financeTaxMatterRecords.find((record) => record.matterNo === 'TAX-2026Q1-VAT');

      if (!original) {
        throw new Error('missing Q1 VAT matter fixture');
      }

      const revision = startTaxMatterDeclarationRevision(original, '更正', '电子税务局更正后调减销项税额');
      const corrected = recordTaxMatterDeclarationResult(revision, {
        declarationDate: '2026-05-10',
        declarationReceiptNo: 'VAT-Q1-REVISION-002',
        declarationStatus: '申报成功',
        settlementAmount: 66.51,
        settlementDirection: '应退',
        vatBreakdown: {
          declaredVatAmount: 376,
          educationSurchargeAmount: 6,
          localEducationSurchargeAmount: 4,
          urbanMaintenanceTaxAmount: 14
        }
      });

      assertEqual(corrected.vatSettlement?.totalPayableAmount, 400, 'corrected official VAT settlement should retain the final total');
      assertEqual(corrected.payableAmount, 0, 'a downward VAT correction must not create another full payment');
      assertEqual(corrected.refundableAmount, 66.51, 'the current version should expose only the refundable difference');
      assertEqual(corrected.processStatus, '待退抵处理', 'the refundable difference should enter overpayment handling');
      assertEqual(getTaxMatterAccountingDelta(corrected), -66.51, 'VAT accounting should use the VAT and surcharge accrual difference');

      const applied = recordTaxMatterRefundApplication(corrected, {
        applicationDate: '2026-05-11',
        method: '退税',
        receiptNo: 'VAT-Q1-REFUND-APPLICATION-001'
      });
      const receiptFile = {
        id: 'vat-q1-refund-receipt',
        name: '2026-Q1_增值税及附加退税回单.pdf',
        status: '已上传' as const,
        type: '退税回单',
        updatedAt: '2026-05-15'
      };
      const refunded = recordTaxMatterRefundResult(applied, {
        amount: 66.51,
        receiptFile,
        refundDate: '2026-05-15'
      });
      const transaction = buildTaxMatterRefundTransaction({
        financeRows: [],
        publicAccountRef: getFinanceSeedPublicAccountRef('public-account-ccb-payment-reserve'),
        record: refunded,
        refundAmount: 66.51,
        refundDate: '2026-05-15',
        refundReceiptFile: receiptFile
      });

      assertDeepEqual(
        transaction?.taxPaymentAllocations,
        [
          { amount: 64.1, subjectCode: '2221.01', taxType: '增值税' },
          { amount: 1.41, subjectCode: '2221.04', taxType: '城市维护建设税' },
          { amount: 0.6, subjectCode: '2221.06', taxType: '教育费附加' },
          { amount: 0.4, subjectCode: '2221.07', taxType: '地方教育附加' }
        ],
        'VAT refund receipt should retain the liability allocations reduced by the correction'
      );
    }
  },
  {
    name: 'keeps zero filing as a declared result rather than inferring it from amount alone',
    run: () => {
      const source = createTaxMatter({
        dataStatus: '已确认',
        declarationStatus: '待申报',
        matterType: '增值税及附加',
        preparedPayableAmount: 0,
        processStatus: '待申报'
      });
      const result = recordTaxMatterDeclarationResult(source, {
        declarationDate: '2026-07-12',
        declarationReceiptFile: {
          id: 'vat-zero-receipt',
          name: '增值税零申报回执.pdf',
          status: '已上传',
          type: '申报回执',
          updatedAt: '2026-07-12'
        },
        declarationStatus: '零申报',
        settlementAmount: 0,
        settlementDirection: '无需补退'
      });

      assertEqual(result.declarationStatus, '零申报', 'zero filing should be an explicit official result');
      assertEqual(result.paymentStatus, '无需缴纳', 'zero filing should not create a payment task');
      assertEqual(result.processStatus, '已完成', 'zero filing with receipt should complete handling');
    }
  },
  {
    name: 'CIT-16 requires a refund application before tracking refund receipts in installments',
    run: () => {
      const declared = recordTaxMatterDeclarationResult(createTaxMatter({
        dataStatus: '已确认',
        declarationStatus: '待申报',
        matterType: '企业所得税',
        preparedRefundableAmount: 500,
        preparedSettlementDirection: '应退',
        processStatus: '待申报'
      }), {
        declarationDate: '2026-07-12',
        declarationReceiptNo: 'CIT-REFUND-001',
        declarationStatus: '申报成功',
        settlementAmount: 500,
        settlementDirection: '应退'
      });
      const blockedRefund = recordTaxMatterRefundResult(declared, {
        amount: 200,
        receiptFile: {
          id: 'cit-refund-receipt-1',
          name: '企业所得税退税回单-1.pdf',
          status: '已上传',
          type: '退税回单',
          updatedAt: '2026-07-12'
        },
        refundDate: '2026-07-12'
      });
      const applied = recordTaxMatterRefundApplication(declared, {
        applicationDate: '2026-07-12',
        method: '退税',
        receiptNo: 'CIT-REFUND-APPLICATION-001'
      });
      const firstRefund = recordTaxMatterRefundResult(applied, {
        amount: 200,
        receiptFile: {
          id: 'cit-refund-receipt-1',
          name: '企业所得税退税回单-1.pdf',
          status: '已上传',
          type: '退税回单',
          updatedAt: '2026-07-12'
        },
        refundDate: '2026-07-12'
      });
      const finalRefund = recordTaxMatterRefundResult(firstRefund, {
        amount: 300,
        receiptFile: {
          id: 'cit-refund-receipt-2',
          name: '企业所得税退税回单-2.pdf',
          status: '已上传',
          type: '退税回单',
          updatedAt: '2026-07-13'
        },
        refundDate: '2026-07-13'
      });

      assertEqual(declared.processStatus, '待退抵处理', 'official refund result should first require overpayment handling');
      assertEqual(blockedRefund, declared, 'refund receipt must not be recorded before the refund application');
      assertEqual(applied.processStatus, '退抵处理中', 'submitted refund application should wait for tax-authority handling and receipt');
      assertEqual(firstRefund.processStatus, '部分退抵', 'partial refund should remain actionable');
      assertEqual(getTaxMatterRefundOutstandingAmount(firstRefund), 300, 'remaining refund should be derived');
      assertEqual(finalRefund.processStatus, '已完成', 'full refund should complete the matter');
    }
  },
  {
    name: 'CIT-21 carries an annual overpayment from declaration preparation into tax handling',
    run: () => {
      const annualPreparation = financeDeclarationPreparationRecords.find(
        (record) => record.taxType === '企业所得税' && record.declarationScenario === '年度汇算'
      );

      if (!annualPreparation?.citSummary) {
        throw new Error('missing annual CIT preparation fixture');
      }

      const readyPreparation = {
        ...annualPreparation,
        citSummary: {
          ...annualPreparation.citSummary,
          currentPeriodPayableAmount: 0,
          overpaidTaxAmount: 500
        },
        items: annualPreparation.items.map((item) => ({
          ...item,
          status: item.status === '无需确认' ? '无需确认' as const : '已确认' as const
        })),
        status: '可申报' as const
      };
      const matter = createTaxMatter({
        dataStatus: '待复核',
        declarationScenario: '年度汇算',
        matterType: '企业所得税',
        period: readyPreparation.period,
        periodType: '年度',
        processStatus: '数据待确认'
      });
      const result = applyDeclarationPreparationToTaxMatter(matter, [readyPreparation]);

      assertEqual(result.preparedSettlementDirection, '应退', 'annual CIT overpayment should carry an expected refund direction');
      assertEqual(result.preparedRefundableAmount, 500, 'annual CIT overpayment should carry the expected refund amount');
      assertEqual(result.preparedPayableAmount, 0, 'annual overpayment must not remain a payable estimate');
    }
  },
  {
    name: 'CROSS-TAX-01 applies an approved overpayment only to a same-tax outstanding matter',
    run: () => {
      const source = createTaxMatter({
        dataStatus: '已确认',
        declarationReceiptNo: 'CIT-Q3-DECLARATION-001',
        declarationStatus: '申报成功',
        matterNo: 'TAX-2025-CIT-ANNUAL',
        matterType: '企业所得税',
        preparedRefundableAmount: 500,
        refundableAmount: 500,
        refundStatus: '待申请',
        settlementDirection: '应退'
      });
      const target = createTaxMatter({
        dataStatus: '已确认',
        declarationReceiptNo: 'CIT-Q3-DECLARATION-001',
        declarationStatus: '申报成功',
        id: 'tax-matter-cit-offset-target',
        matterNo: 'TAX-2026Q3-CIT',
        matterType: '企业所得税',
        payableAmount: 300,
        paymentStatus: '待缴纳',
        processStatus: '待缴款',
        settlementDirection: '应缴'
      });
      const applied = recordTaxMatterRefundApplication(source, {
        applicationDate: '2026-07-15',
        method: '抵缴',
        receiptNo: 'OFFSET-APPLICATION-001',
        targetMatterId: target.id
      });
      const result = recordTaxMatterOffsetResult(applied, target, {
        amount: 300,
        offsetDate: '2026-07-18',
        receiptNo: 'OFFSET-RESULT-001'
      });

      if (!result) {
        throw new Error('expected approved same-tax offset result');
      }

      assertEqual(result.sourceRecord.offsetAmount, 300, 'source overpayment should retain the approved offset amount');
      assertEqual(result.sourceRecord.processStatus, '部分退抵', 'remaining overpayment should remain actionable');
      assertEqual(getTaxMatterRefundOutstandingAmount(result.sourceRecord), 200, 'source overpayment should keep only the unprocessed balance');
      assertEqual(result.targetRecord.offsetReceivedAmount, 300, 'target matter should retain the tax credit used');
      assertEqual(result.targetRecord.paymentStatus, '已缴纳', 'fully offset target matter should be settled');
      assertEqual(result.targetRecord.processStatus, '已完成', 'fully offset target matter should complete without cash flow');
    }
  },
  {
    name: 'CROSS-TAX-02 rejects cross-tax or excessive overpayment offsets',
    run: () => {
      const source = createTaxMatter({
        dataStatus: '已确认',
        declarationStatus: '申报成功',
        matterNo: 'TAX-2025-CIT-ANNUAL',
        matterType: '企业所得税',
        overpaymentMethod: '抵缴',
        refundableAmount: 500,
        refundStatus: '申请中',
        offsetTargetMatterId: 'tax-matter-target',
        settlementDirection: '应退'
      });
      const differentTaxTarget = createTaxMatter({
        dataStatus: '已确认',
        declarationStatus: '申报成功',
        id: 'tax-matter-target',
        matterNo: 'TAX-2026Q3-STAMP',
        matterType: '印花税',
        payableAmount: 300,
        paymentStatus: '待缴纳',
        settlementDirection: '应缴'
      });
      const sameTaxTarget = { ...differentTaxTarget, matterType: '企业所得税' as const };

      assertEqual(
        recordTaxMatterOffsetResult(source, differentTaxTarget, { amount: 300, offsetDate: '2026-07-18', receiptNo: 'OFFSET-RESULT-002' }),
        undefined,
        'different tax types must not be silently offset against each other'
      );
      assertEqual(
        recordTaxMatterOffsetResult(source, sameTaxTarget, { amount: 301, offsetDate: '2026-07-18', receiptNo: 'OFFSET-RESULT-003' }),
        undefined,
        'offset amount must not exceed the target outstanding amount'
      );
    }
  },
  {
    name: 'rejects IIT declaration totals that are detached from confirmed person-level details',
    run: () => {
      const iitMatter = createTaxMatter({
        dataStatus: '已确认',
        matterType: '个人所得税',
        payableAmount: 0,
        preparedPayableAmount: 480,
        processStatus: '待申报'
      });
      const mismatchedInput = {
        declarationDate: '2026-07-10',
        declarationReceiptNo: 'IIT-202606-001',
        declarationStatus: '申报成功' as const,
        settlementAmount: 500,
        settlementDirection: '应缴' as const
      };

      assertEqual(
        getTaxMatterDeclarationResultValidationError(iitMatter, mismatchedInput),
        '个人所得税申报金额与人员明细不一致，请先更正工资或劳务来源',
        'IIT filing must not replace employee-level withholding with an arbitrary official total'
      );
      assertEqual(
        recordTaxMatterDeclarationResult(iitMatter, mismatchedInput),
        iitMatter,
        'invalid IIT declaration result must leave the tax matter unchanged'
      );
      assertEqual(
        getTaxMatterDeclarationResultValidationError(iitMatter, {
          ...mismatchedInput,
          settlementAmount: 480
        }),
        undefined,
        'IIT filing should accept the total derived from confirmed person-level details'
      );
    }
  },
  {
    name: 'supports multiple payment registrations until the official payable amount is fully paid',
    run: () => {
      const declared = createTaxMatter({
        dataStatus: '已确认',
        declarationReceiptFileId: 'cit-declaration-receipt',
        declarationStatus: '申报成功',
        matterType: '企业所得税',
        payableAmount: 1000,
        preparedPayableAmount: 1000,
        paymentStatus: '待缴纳',
        processStatus: '待缴款',
        settlementDirection: '应缴'
      });
      const firstPayment = recordTaxMatterPaymentResult(declared, {
        amount: 400,
        paymentDate: '2026-07-12',
        receiptFile: {
          id: 'cit-payment-receipt-1',
          name: '企业所得税缴款回单-1.pdf',
          status: '已上传',
          type: '缴款回单',
          updatedAt: '2026-07-12'
        }
      });
      const finalPayment = recordTaxMatterPaymentResult(firstPayment, {
        amount: 600,
        paymentDate: '2026-07-13',
        receiptFile: {
          id: 'cit-payment-receipt-2',
          name: '企业所得税缴款回单-2.pdf',
          status: '已上传',
          type: '缴款回单',
          updatedAt: '2026-07-13'
        }
      });

      assertEqual(firstPayment.paidAmount, 400, 'first payment should accumulate paid amount');
      assertEqual(firstPayment.processStatus, '部分缴纳', 'first partial payment should remain actionable');
      assertEqual(getTaxMatterOutstandingAmount(firstPayment), 600, 'outstanding amount should be derived from official payable less paid');
      assertEqual(finalPayment.paidAmount, 1000, 'final payment should accumulate all registrations');
      assertEqual(finalPayment.processStatus, '已完成', 'full payment with declaration evidence should complete handling');
    }
  },
  {
    name: 'CIT-12 preserves the prior declaration version when a correction starts',
    run: () => {
      const declared = createTaxMatter({
        dataStatus: '已确认',
        declarationDate: '2026-07-12',
        declarationReceiptFileId: 'cit-declaration-receipt',
        declarationReceiptNo: 'CIT-2026Q2-001',
        declarationStatus: '申报成功',
        declarationVersion: 1,
        matterType: '企业所得税',
        paidAmount: 1000,
        payableAmount: 1000,
        paymentDate: '2026-07-12',
        preparedPayableAmount: 980,
        paymentStatus: '已缴纳',
        processStatus: '已完成'
      });
      const corrected = startTaxMatterDeclarationRevision(declared, '更正', '发现纳税调整项目遗漏');
      const blockedPreparation = applyDeclarationPreparationToTaxMatter(corrected, []);

      assertEqual(corrected.declarationVersion, 2, 'correction should open a new declaration version');
      assertEqual(corrected.declarationStatus, '待申报', 'new version should wait for an official declaration result');
      assertEqual(corrected.payableAmount, 0, 'new version should not create a payment fact before the corrected filing result');
      assertEqual(corrected.paymentBaselineAmount, 1000, 'new version should freeze the cumulative payment baseline');
      assertEqual(blockedPreparation.paidAmount, 1000, 'preparation changes must not erase historical payment facts');
      assertEqual(corrected.declarationHistory.length, 1, 'previous declaration should remain in history');
      assertEqual(corrected.declarationHistory[0]?.filedPayableAmount, 1000, 'history should retain the prior official amount');
      assertEqual(corrected.declarationHistory[0]?.reason, '发现纳税调整项目遗漏', 'history should retain the correction reason');
    }
  },
  {
    name: 'derives declaration workflow independently from the closed accounting period',
    run: () => {
      const source = createTaxMatter({
        dataStatus: '已确认',
        declarationStatus: '申报成功',
        declarationReceiptFileId: 'receipt',
        matterType: '企业所得税',
        paidAmount: 0,
        payableAmount: 500
      });

      assertEqual(deriveTaxMatterProcessStatus(source), '待缴款', 'tax handling status should depend on filing and payment facts');
    }
  },
  {
    name: 'requires receipt files by tax matter type and payable amount',
    run: () => {
      const payableCit = createTaxMatter({
        declarationStatus: '申报成功',
        matterType: '企业所得税',
        payableAmount: 815,
        paymentStatus: '已缴纳'
      });
      const zeroVat = createTaxMatter({
        declarationStatus: '零申报',
        matterType: '增值税及附加',
        payableAmount: 0,
        paymentStatus: '无需缴纳'
      });
      const socialMatter = createTaxMatter({ matterType: '社保缴纳', payableAmount: 3075 });
      const onlyDeclarationReceipt = [
        {
          id: 'receipt-declare',
          name: '企业所得税预缴申报回执.pdf',
          status: '已上传',
          type: '申报回执',
          updatedAt: '2026-07-15'
        }
      ] satisfies FinanceTaxMatterRecord['files'];
      const completeReceipts = [
        ...onlyDeclarationReceipt,
        {
          id: 'receipt-payment',
          name: '企业所得税预缴缴款回单.pdf',
          status: '已上传',
          type: '缴款回单',
          updatedAt: '2026-07-15'
        }
      ] satisfies FinanceTaxMatterRecord['files'];

      assertDeepEqual(
        getTaxMatterRequiredReceiptTypes(payableCit),
        ['申报回执', '缴款回单'],
        'payable tax matters should require declaration receipt and payment voucher'
      );
      assertDeepEqual(
        getTaxMatterRequiredReceiptTypes(zeroVat),
        ['申报回执'],
        'zero filing or no-payable tax matters should only require declaration receipt'
      );
      assertDeepEqual(
        getTaxMatterRequiredReceiptTypes(socialMatter),
        ['缴款回单'],
        'social-insurance payment matters should only require payment voucher'
      );
      assertDeepEqual(
        getMissingTaxMatterReceiptTypes(onlyDeclarationReceipt, getTaxMatterRequiredReceiptTypes(payableCit)),
        ['缴款回单'],
        'payable tax matters should remain incomplete when payment voucher is missing'
      );
      assertEqual(
        hasTaxMatterRequiredReceiptFiles(completeReceipts, getTaxMatterRequiredReceiptTypes(payableCit)),
        true,
        'payable tax matters should complete only after all required receipt files exist'
      );
    }
  },
  {
    name: 'builds tax payment transactions from paid tax matter delta',
    run: () => {
      const existingRow = createFinanceRow({ amount: 1000, transactionNo: 'FIN-202607-0001' });
      const matter = createTaxMatter({
        declarationDate: '2026-07-15',
        files: [
          { id: 'tax-file-declaration', name: '2026-06_社保申报回执.pdf', status: '已上传', type: '申报回执', updatedAt: '2026-07-15' },
          { id: 'tax-file-payment', name: '2026-06_社保缴款回单.pdf', status: '已上传', type: '缴款回单', updatedAt: '2026-07-15' }
        ],
        linkedTransactionNos: [existingRow.transactionNo],
        paidAmount: 3075,
        payableAmount: 3075,
        paymentDate: '2026-07-16',
        paymentStatus: '已缴纳',
        processStatus: '待补回执'
      });
      const transaction = buildTaxMatterPaymentTransaction({
        financeRows: [existingRow],
        publicAccountRef: getFinanceSeedPublicAccountRef('public-account-ccb-payment-reserve'),
        record: matter
      });
      const attachedMatter = attachTaxMatterPaymentTransaction(matter, transaction);

      assertEqual(getTaxMatterLinkedPaymentAmount(matter, [existingRow]), 1000, 'linked amount should come from active finance rows');
      assertEqual(transaction?.amount, 2075, 'generated payment flow should only register unpaid delta');
      assertEqual(transaction?.occurredAt, '2026-07-16', 'generated payment flow should use the actual payment date');
      assertEqual(transaction?.transactionNo, 'FIN-202607-0002', 'generated transaction number should follow accounting period sequence');
      assertEqual(transaction?.status, '待复核', 'generated payment flow should enter review instead of direct posting');
      assertEqual(transaction?.sourceNo, 'TAX-202606-SOCIAL', 'generated payment flow should keep tax matter source number');
      assertEqual(transaction?.voucherStatus, '已上传', 'generated payment flow should inherit payment voucher status');
      assertDeepEqual(
        transaction?.files.map((file) => [file.name, file.type]),
        [['2026-06_社保缴款回单.pdf', '缴款回单']],
        'generated payment flow should inherit only payment receipt files as review vouchers'
      );
      assertDeepEqual(
        attachedMatter.linkedTransactionNos,
        ['FIN-202607-0001', 'FIN-202607-0002'],
        'tax matter should link generated payment flow'
      );
    }
  },
  {
    name: 'builds each tax refund receipt as a separate pending-review income transaction',
    run: () => {
      const refundReceipt = {
        id: 'tax-refund-receipt-1',
        name: '企业所得税退税回单.pdf',
        status: '已上传' as const,
        type: '退税回单',
        updatedAt: '2026-07-13'
      };
      const declaredMatter = createTaxMatter({
        declarationStatus: '申报成功',
        matterNo: 'TAX-2025-CIT-ANNUAL',
        matterType: '企业所得税',
        payableAmount: 0,
        refundableAmount: 1200,
        refundedAmount: 0,
        refundApplicationDate: '2026-07-12',
        refundStatus: '申请中',
        settlementDirection: '应退',
        title: '2025 年企业所得税年度汇算'
      });
      const refundedMatter = recordTaxMatterRefundResult(declaredMatter, {
        amount: 500,
        receiptFile: refundReceipt,
        refundDate: '2026-07-13'
      });
      const transaction = buildTaxMatterRefundTransaction({
        financeRows: [],
        publicAccountRef: getFinanceSeedPublicAccountRef('public-account-ccb-payment-reserve'),
        record: refundedMatter,
        refundAmount: 500,
        refundDate: '2026-07-13',
        refundReceiptFile: refundReceipt
      });
      const attachedMatter = attachTaxMatterRefundTransaction(refundedMatter, transaction);

      assertEqual(transaction?.direction, '收入', 'tax refund should enter the receipt side of cash flow');
      assertEqual(transaction?.category, '税费退还', 'tax refund should use a dedicated non-operating category');
      assertEqual(transaction?.amount, 500, 'tax refund transaction should use the actual received amount');
      assertEqual(transaction?.status, '待复核', 'tax refund should enter finance review before posting');
      assertEqual(transaction?.sourceType, '税费事项', 'tax refund should retain the tax-matter source contract');
      assertEqual(transaction?.voucherStatus, '已上传', 'tax refund transaction should carry its receipt');
      assertEqual(
        getTaxMatterLinkedRefundAmount(attachedMatter, transaction ? [transaction] : []),
        500,
        'linked refund amount should count receipt transactions only'
      );
      assertEqual(
        getTaxMatterLinkedPaymentAmount(attachedMatter, transaction ? [transaction] : []),
        0,
        'refund receipts must not be counted as tax payments'
      );
      assertDeepEqual(
        attachedMatter.linkedTransactionNos,
        transaction ? [transaction.transactionNo] : [],
        'tax matter should link the generated refund transaction'
      );
    }
  },
  {
    name: 'VAT-13 keeps VAT and surcharge payment allocations aligned with the declaration settlement',
    run: () => {
      const sourceMatter = financeTaxMatterRecords.find((record) => record.matterNo === 'TAX-2026Q1-VAT');

      if (!sourceMatter) {
        throw new Error('expected VAT tax matter seed to exist');
      }

      const transaction = buildTaxMatterPaymentTransaction({
        financeRows: [],
        publicAccountRef: getFinanceSeedPublicAccountRef('public-account-ccb-payment-reserve'),
        record: { ...sourceMatter, linkedTransactionNos: [] }
      });

      assertEqual(transaction?.amount, 466.51, 'VAT payment flow should use the declared combined payable amount');
      assertDeepEqual(
        transaction?.taxPaymentAllocations,
        [
          { amount: 440.1, subjectCode: '2221.01', taxType: '增值税' },
          { amount: 15.41, subjectCode: '2221.04', taxType: '城市维护建设税' },
          { amount: 6.6, subjectCode: '2221.06', taxType: '教育费附加' },
          { amount: 4.4, subjectCode: '2221.07', taxType: '地方教育附加' }
        ],
        'VAT payment flow should retain the four liability-clearing allocations'
      );
    }
  },
  {
    name: 'subtracts prior VAT payment allocations before generating a remaining payment flow',
    run: () => {
      const sourceMatter = financeTaxMatterRecords.find((record) => record.matterNo === 'TAX-2026Q1-VAT');

      if (!sourceMatter) {
        throw new Error('expected VAT tax matter seed to exist');
      }

      const priorPayment = createFinanceRow({
        amount: 200,
        sourceNo: sourceMatter.matterNo,
        sourceTitle: sourceMatter.title,
        sourceType: '税费事项',
        taxPaymentAllocations: [
          { amount: 180, subjectCode: '2221.01', taxType: '增值税' },
          { amount: 10, subjectCode: '2221.04', taxType: '城市维护建设税' },
          { amount: 6, subjectCode: '2221.06', taxType: '教育费附加' },
          { amount: 4, subjectCode: '2221.07', taxType: '地方教育附加' }
        ],
        transactionNo: 'FIN-202604-0998'
      });
      const transaction = buildTaxMatterPaymentTransaction({
        financeRows: [priorPayment],
        publicAccountRef: getFinanceSeedPublicAccountRef('public-account-ccb-payment-reserve'),
        record: { ...sourceMatter, linkedTransactionNos: [priorPayment.transactionNo] }
      });

      assertEqual(transaction?.amount, 266.51, 'remaining VAT payment should exclude the prior linked payment');
      assertDeepEqual(
        transaction?.taxPaymentAllocations,
        [
          { amount: 260.1, subjectCode: '2221.01', taxType: '增值税' },
          { amount: 5.41, subjectCode: '2221.04', taxType: '城市维护建设税' },
          { amount: 0.6, subjectCode: '2221.06', taxType: '教育费附加' },
          { amount: 0.4, subjectCode: '2221.07', taxType: '地方教育附加' }
        ],
        'remaining payment should carry only the unregistered liability allocations'
      );
    }
  },
  {
    name: 'does not build tax payment transaction without actual payment date',
    run: () => {
      const matter = createTaxMatter({
        declarationDate: '2026-07-15',
        files: [{ id: 'tax-file-payment-date', name: '企业所得税缴款回单.pdf', status: '已上传', type: '缴款回单', updatedAt: '2026-07-15' }],
        paidAmount: 815,
        payableAmount: 815,
        paymentStatus: '已缴纳'
      });

      const transaction = buildTaxMatterPaymentTransaction({
        financeRows: [],
        publicAccountRef: getFinanceSeedPublicAccountRef('public-account-ccb-payment-reserve'),
        record: matter
      });

      assertEqual(transaction, undefined, 'tax payment flow should require the actual payment date');
    }
  },
  {
    name: 'does not build tax payment transaction before payment voucher exists',
    run: () => {
      const matter = createTaxMatter({
        declarationDate: '2026-07-15',
        files: [{ id: 'tax-file-declaration', name: '企业所得税申报回执.pdf', status: '已上传', type: '申报回执', updatedAt: '2026-07-15' }],
        paidAmount: 815,
        payableAmount: 815,
        paymentDate: '2026-07-15',
        paymentStatus: '已缴纳',
        processStatus: '待补回执'
      });
      const transaction = buildTaxMatterPaymentTransaction({
        financeRows: [],
        publicAccountRef: getFinanceSeedPublicAccountRef('public-account-ccb-payment-reserve'),
        record: matter
      });

      assertEqual(transaction, undefined, 'tax payment flow should wait until payment voucher is available');
    }
  },
  {
    name: 'VAT-05 excludes a business fact already archived as unbilled income in a prior filing',
    run: () => {
      const sourcePreparation = financeDeclarationPreparationRecords.find((record) => record.preparationNo === 'PREP-2026Q2-VAT');
      const sourceReceivable = financeReceivablePayableRecords.find((record) => record.id === 'ar-202606-007');

      if (!sourcePreparation || !sourceReceivable) {
        throw new Error('missing VAT preparation or receivable fixture');
      }

      const businessRecordId = 'ar-vat-prior-unbilled';
      const priorPreparation = {
        ...sourcePreparation,
        confirmedUnbilledIncomeDeclarations: [{
          businessRecordId,
          netAmount: 4800,
          salesCategory: sourceReceivable.taxBasis.salesCategory,
          vatTreatment: '免税' as const
        }],
        id: 'vat-prior-archived',
        period: '2026-Q2',
        status: '已进入税务办理' as const
      };
      const currentPreparation = {
        ...sourcePreparation,
        id: 'vat-current-q3',
        period: '2026-Q3',
        preparationNo: 'PREP-2026Q3-VAT',
        status: '准备中' as const
      };
      const currentReceivable = {
        ...sourceReceivable,
        accountingPeriod: '2026-07',
        confirmDate: '2026-07-10',
        id: businessRecordId
      };
      const candidates = getDeclarationPreparationUnbilledIncomeCandidates(
        currentPreparation,
        [],
        [currentReceivable],
        [],
        [priorPreparation, currentPreparation]
      );

      assertEqual(candidates.length, 0, 'a prior archived unbilled fact must not enter a later filing again');
    }
  },
  {
    name: 'VAT-09 archives the confirmed preparation after a successful filing result',
    run: () => {
      const source = financeDeclarationPreparationRecords.find((record) => record.preparationNo === 'PREP-2026Q2-VAT');

      if (!source) {
        throw new Error('missing Q2 VAT preparation fixture');
      }

      const archived = finalizeDeclarationPreparationAfterFiling(
        { ...source, status: '可申报' },
        createTaxMatter({
          declarationStatus: '申报成功',
          declarationVersion: 1,
          matterNo: 'TAX-2026Q2-VAT'
        }),
        '李明',
        '2026-07-15 15:10'
      );

      assertEqual(archived.status, '已进入税务办理', 'successful filing should archive the preparation snapshot');
      assertEqual(
        archived.confirmedUnbilledIncomeDeclarations === archived.unbilledIncomeDeclarations,
        true,
        'the archived preparation should retain its confirmed unbilled-income facts'
      );
    }
  },
  {
    name: 'VAT-10 keeps source-recognized VAT independent from the declaration calculation',
    run: () => {
      const preparedRows = applyDeclarationPreparationSourceState(
        financeDeclarationPreparationRecords,
        financeInvoiceRecords,
        financeTransactionRecords,
        financeReceivablePayableRecords,
        financeInvoiceBusinessAllocations
      );
      const q2VatPreparation = preparedRows.find((record) => record.preparationNo === 'PREP-2026Q2-VAT');

      if (!q2VatPreparation) {
        throw new Error('missing Q2 VAT preparation fixture');
      }

      assertEqual(q2VatPreparation.vatSummary.estimatedVatAfterExemption, 9.9, 'the declaration should include the later-invoice VAT');
      assertEqual(q2VatPreparation.vatSummary.sourceRecognizedVatAmount, 0, 'the accounting source should not copy the declaration result');
    }
  },
  {
    name: 'CIT-17 CIT-18 derives only the current correction refund and its accounting difference',
    run: () => {
      const original = createTaxMatter({
        dataStatus: '已确认',
        declarationDate: '2026-04-15',
        declarationReceiptNo: 'CIT-Q1-001',
        declarationStatus: '申报成功',
        matterType: '企业所得税',
        paidAmount: 1000,
        payableAmount: 1000,
        paymentDate: '2026-04-15',
        paymentStatus: '已缴纳',
        processStatus: '已完成',
        sourceItems: [{ id: 'cit-source', name: '申报准备', sourceModule: '申报准备', status: '已确认', updatedAt: '2026-04-15' }]
      });
      const revision = startTaxMatterDeclarationRevision(original, '更正', '年度调整后形成退税');
      const corrected = recordTaxMatterDeclarationResult(revision, {
        declarationDate: '2026-05-10',
        declarationReceiptNo: 'CIT-Q1-REVISION-002',
        declarationStatus: '申报成功',
        settlementAmount: 200,
        settlementDirection: '应退'
      });

      assertEqual(getTaxMatterRefundOutstandingAmount(corrected), 200, 'correction refund must not add the prior-version payment again');
      assertEqual(getTaxMatterAccountingAmount(corrected), 800, 'corrected filing should retain the revised cumulative tax amount');
      assertEqual(getTaxMatterAccountingDelta(corrected), -200, 'correction voucher should contain only the 200 yuan reversal');
      assertEqual(corrected.processStatus, '待退抵处理', 'corrected overpayment should enter the refund-application flow');
    }
  },
  {
    name: 'CIT-19 rejects excess settlement and refund receipt before application',
    run: () => {
      const payable = createTaxMatter({
        dataStatus: '已确认',
        declarationStatus: '申报成功',
        matterType: '企业所得税',
        payableAmount: 100,
        processStatus: '待缴款'
      });
      const invalidPayment = recordTaxMatterPaymentResult(payable, {
        amount: 101,
        paymentDate: '2026-07-15',
        receiptFile: { id: 'cit-overpay', name: '缴款回单.pdf', status: '已上传', type: '缴款回单', updatedAt: '2026-07-15' }
      });
      const refundable = createTaxMatter({
        dataStatus: '已确认',
        declarationStatus: '申报成功',
        matterType: '企业所得税',
        payableAmount: 0,
        refundableAmount: 100,
        refundStatus: '待申请',
        settlementDirection: '应退'
      });
      const invalidRefund = recordTaxMatterRefundResult(refundable, {
        amount: 100,
        refundDate: '2026-07-15',
        receiptFile: { id: 'cit-refund-before-application', name: '退税回单.pdf', status: '已上传', type: '退税回单', updatedAt: '2026-07-15' }
      });

      assertEqual(invalidPayment, payable, 'payment above the current-version outstanding amount must be rejected');
      assertEqual(invalidRefund, refundable, 'refund receipt before application must be rejected');
    }
  },
  {
    name: 'CIT-20 only permits correction of the latest quarterly filing before annual filing',
    run: () => {
      const q1 = createTaxMatter({
        declarationScenario: '季度预缴',
        declarationStatus: '申报成功',
        id: 'cit-q1-revision-guard',
        matterType: '企业所得税',
        period: '2026-Q1'
      });
      const q2 = createTaxMatter({
        declarationScenario: '季度预缴',
        declarationStatus: '申报成功',
        id: 'cit-q2-revision-guard',
        matterType: '企业所得税',
        period: '2026-Q2'
      });
      const annual = createTaxMatter({
        declarationScenario: '年度汇算',
        declarationStatus: '申报成功',
        id: 'cit-annual-revision-guard',
        matterType: '企业所得税',
        period: '2026'
      });

      assertEqual(
        Boolean(getTaxMatterDeclarationRevisionValidationError(q1, '更正', [q1, q2])),
        true,
        'an earlier quarterly filing must be blocked once a later quarter has been filed'
      );
      assertEqual(
        getTaxMatterDeclarationRevisionValidationError(q2, '更正', [q1, q2]),
        undefined,
        'the latest quarterly filing should remain correctable before annual filing'
      );
      assertEqual(
        Boolean(getTaxMatterDeclarationRevisionValidationError(q2, '更正', [q1, q2, annual])),
        true,
        'quarterly filing must be blocked after the annual filing is completed'
      );
    }
  },
  {
    name: 'ST-09 validates stamp-duty declaration against the confirmed preparation snapshot',
    run: () => {
      const record = createTaxMatter({
        dataStatus: '已确认',
        matterType: '印花税',
        preparedPayableAmount: 10,
        sourceItems: [{ id: 'stamp-source', name: '申报准备', sourceModule: '申报准备', status: '已确认', updatedAt: '2026-06-30' }]
      });
      const exactResult = {
        declarationStatus: '申报成功' as const,
        settlementAmount: 10,
        settlementDirection: '应缴' as const
      };
      const unexplainedDifference = {
        ...exactResult,
        settlementAmount: 8
      };

      assertEqual(getTaxMatterDeclarationResultValidationError(record, exactResult), undefined, 'matching declaration should pass');
      assertEqual(
        Boolean(getTaxMatterDeclarationResultValidationError(record, unexplainedDifference)),
        true,
        'unexplained declaration difference must be blocked'
      );
      assertEqual(
        getTaxMatterDeclarationResultValidationError(record, {
          ...unexplainedDifference,
          differenceReason: '电子税务局核定金额与系统测算存在差异'
        }),
        undefined,
        'documented external difference should remain registrable'
      );
    }
  },
  {
    name: 'ST-10 posts stamp-duty declaration result and keeps its cumulative accounting amount',
    run: () => {
      const prepared = createTaxMatter({
        dataStatus: '已确认',
        matterType: '印花税',
        preparedPayableAmount: 10,
        sourceItems: [{ id: 'stamp-source', name: '申报准备', sourceModule: '申报准备', status: '已确认', updatedAt: '2026-06-30' }]
      });
      const filed = recordTaxMatterDeclarationResult(prepared, {
        declarationDate: '2026-07-10',
        declarationReceiptNo: 'STAMP-2026Q2-001',
        declarationStatus: '申报成功',
        settlementAmount: 10,
        settlementDirection: '应缴'
      });

      assertEqual(filed.payableAmount, 10, 'filed stamp duty payable');
      assertEqual(filed.filedAccountingAmount, 10, 'initial accounting amount should be frozen');
      assertEqual(getTaxMatterAccountingDelta(filed), 10, 'initial tax accrual delta');
      assertEqual(filed.processStatus, '待缴款', 'filed tax should enter payment');
    }
  },
  {
    name: 'ST-11 corrects paid stamp duty by the net difference and forbids direct voiding',
    run: () => {
      const original = createTaxMatter({
        dataStatus: '已确认',
        declarationDate: '2026-07-10',
        declarationReceiptNo: 'STAMP-2026Q2-001',
        declarationStatus: '申报成功',
        filedAccountingAmount: 10,
        matterType: '印花税',
        paidAmount: 10,
        payableAmount: 10,
        paymentDate: '2026-07-12',
        paymentStatus: '已缴纳',
        preparedPayableAmount: 10,
        processStatus: '已完成',
        settlementDirection: '应缴',
        sourceItems: [{ id: 'stamp-source', name: '申报准备', sourceModule: '申报准备', status: '已确认', updatedAt: '2026-06-30' }]
      });
      const revision = startTaxMatterDeclarationRevision(original, '更正', '合同补充协议调减计税依据');
      const corrected = recordTaxMatterDeclarationResult(revision, {
        declarationDate: '2026-08-08',
        declarationReceiptNo: 'STAMP-2026Q2-REV-002',
        declarationStatus: '申报成功',
        differenceReason: '合同补充协议调减后形成退税 2 元',
        settlementAmount: 2,
        settlementDirection: '应退'
      });

      assertEqual(Boolean(getTaxMatterDeclarationRevisionValidationError(original, '作废')), true, 'paid filing cannot be voided');
      assertEqual(getTaxMatterAccountingAmount(corrected), 8, 'corrected cumulative stamp duty');
      assertEqual(getTaxMatterAccountingDelta(corrected), -2, 'correction voucher contains only the reduction');
      assertEqual(corrected.processStatus, '待退抵处理', 'correction overpayment enters refund flow');
    }
  },
  {
    name: 'ST-12 creates a receipt-backed stamp-duty payment transaction for finance review',
    run: () => {
      const filed = createTaxMatter({
        dataStatus: '已确认',
        declarationStatus: '申报成功',
        filedAccountingAmount: 10,
        matterType: '印花税',
        payableAmount: 10,
        paymentStatus: '待缴纳',
        preparedPayableAmount: 10,
        processStatus: '待缴款',
        settlementDirection: '应缴',
        sourceItems: [{ id: 'stamp-source', name: '申报准备', sourceModule: '申报准备', status: '已确认', updatedAt: '2026-06-30' }]
      });
      const paid = recordTaxMatterPaymentResult(filed, {
        amount: 10,
        paymentDate: '2026-07-12',
        receiptFile: {
          id: 'stamp-payment-receipt',
          name: '印花税缴款回单.pdf',
          status: '已上传',
          type: '缴款回单',
          updatedAt: '2026-07-12'
        }
      });
      const transaction = buildTaxMatterPaymentTransaction({
        financeRows: financeTransactionRecords,
        publicAccountRef: getFinanceSeedPublicAccountRef(),
        record: paid
      });

      assertEqual(paid.paymentStatus, '已缴纳', 'stamp duty payment status');
      assertEqual(transaction?.status, '待复核', 'payment transaction enters finance review');
      assertEqual(transaction?.sourceNo, paid.matterNo, 'payment transaction keeps tax matter source');
      assertEqual(transaction?.voucherStatus, '已上传', 'payment transaction carries payment receipt');
    }
  }
];

export function runFinanceTaxMatterModelTests() {
  const failures: string[] = [];
  const passedTestNames: string[] = [];
  let passed = 0;

  for (const test of tests) {
    try {
      test.run();
      passed += 1;
      passedTestNames.push(test.name);
    } catch (error) {
      failures.push(`${test.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    executedTestNames: tests.map((test) => test.name),
    failures,
    passed,
    passedTestNames,
    total: tests.length
  };
}
