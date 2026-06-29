import { getFinanceSeedPublicAccountRef, type FinanceTransactionRecord } from './financeData';
import type { SocialInsuranceEmployeeRecord } from './financeSocialInsuranceData';
import type { FinanceTaxMatterRecord } from './financeTaxFilingData';
import type { SalaryMonthlyReport } from '../salary/salaryDomain';
import {
  applyDeclarationPreparationSourceState,
  buildCorporateIncomeTaxSourceRows,
  financeDeclarationPreparationRecords,
  getDeclarationPreparationProgress
} from './financeDeclarationPreparationData';
import { getActiveFinanceTaxPolicyProfile } from './financeTaxPolicyModel';
import {
  applyPayrollIitSummaryToTaxMatter,
  applySocialInsuranceSummaryToTaxMatter,
  attachTaxMatterPaymentTransaction,
  buildPayrollIitTaxMatterEmployeeRows,
  buildPayrollIitTaxMatterSummary,
  buildSocialInsuranceTaxMatterSummary,
  buildTaxMatterPaymentTransaction,
  getMissingTaxMatterReceiptTypes,
  getTaxMatterLinkedPaymentAmount,
  getTaxMatterRequiredReceiptTypes,
  hasTaxMatterRequiredReceiptFiles
} from './financeTaxMatterModel';

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
    declarationStatus: '待申报',
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
  return {
    month: '2026-06',
    member: { id: 'EMP-001', name: '测试员工', position: '财务专员' } as SalaryMonthlyReport['member'],
    personalIncomeTaxAmount: 315,
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

const tests: UnitTest[] = [
  {
    name: 'keeps corporate income tax preparation on small low-profit prepayment basis',
    run: () => {
      const taxPolicy = getActiveFinanceTaxPolicyProfile().corporateIncomeTax;
      const preparationRows = applyDeclarationPreparationSourceState(financeDeclarationPreparationRecords, [], []);
      const q2CitPreparation = preparationRows.find((record) => record.preparationNo === 'PREP-2026Q2-CIT');
      const q1CitPreparation = preparationRows.find((record) => record.preparationNo === 'PREP-2026Q1-CIT');

      if (!q2CitPreparation || !q1CitPreparation) {
        throw new Error('missing corporate income tax preparation fixtures');
      }

      const q2Progress = getDeclarationPreparationProgress(q2CitPreparation);
      const q1Progress = getDeclarationPreparationProgress(q1CitPreparation);
      const q2SourceRows = buildCorporateIncomeTaxSourceRows(q2CitPreparation);
      const q2ProfitSourceItem = q2CitPreparation.items.find((item) => item.type === '利润数据确认');

      assertEqual(q2CitPreparation.citSummary?.smallLowProfitEligible, true, 'Q2 CIT should be treated as small low-profit candidate');
      assertEqual(q2CitPreparation.citSummary?.effectiveTaxRate, taxPolicy.smallLowProfitEffectiveTaxRate, 'Q2 CIT should use configured effective prepayment estimate');
      assertEqual(q2CitPreparation.citSummary?.smallLowProfitTaxableIncomeLimit, taxPolicy.smallLowProfitTaxableIncomeLimit, 'Q2 CIT should use configured taxable income limit');
      assertEqual(q2CitPreparation.citSummary?.estimatedCorporateIncomeTaxAmount, 815, 'Q2 CIT estimate should use taxable income times effective rate');
      assertEqual(q2ProfitSourceItem?.status, '无需确认', 'Q2 CIT synced profit source should be read-only');
      assertDeepEqual(
        q2SourceRows.map((row) => [row.name, row.sourceModule, row.status]),
        [
          ['经营收入', '经营数据', '已同步'],
          ['成本费用', '经营数据', '已同步'],
          ['薪酬社保', '薪酬社保', '已同步'],
          ['纳税调整', '申报准备', '待确认'],
          ['弥补亏损', '历史亏损台账', '待确认'],
          ['小型微利资格', '税务口径', '待确认']
        ],
        'Q2 CIT source rows should separate finance, payroll, adjustment, loss, and policy sources'
      );
      assertEqual(q2Progress.processedCount, 0, 'Q2 CIT should not count synced profit source as a manual confirmation');
      assertEqual(q2Progress.pendingCount, 3, 'Q2 CIT should still require adjustment, eligibility, and prepayment-basis confirmation');
      assertEqual(q1CitPreparation.citSummary?.estimatedCorporateIncomeTaxAmount, 500, 'Q1 completed CIT fixture should align with small low-profit estimate');
      assertEqual(q1Progress.pendingCount, 0, 'Q1 completed CIT fixture should not expose pending preparation items');
    }
  },
  {
    name: 'uses shared VAT policy in declaration preparation measurement',
    run: () => {
      const vatPolicy = getActiveFinanceTaxPolicyProfile().vatDeclaration;
      const preparationRows = applyDeclarationPreparationSourceState(financeDeclarationPreparationRecords, [], []);
      const q2VatPreparation = preparationRows.find((record) => record.preparationNo === 'PREP-2026Q2-VAT');

      if (!q2VatPreparation) {
        throw new Error('missing VAT declaration preparation fixture');
      }

      assertEqual(q2VatPreparation.vatSummary.quarterlyExemptionThreshold, vatPolicy.quarterlyExemptionThreshold, 'VAT preparation should use configured quarterly threshold');
      assertEqual(q2VatPreparation.vatSummary.isBelowQuarterlyExemptionThreshold, true, 'empty Q2 VAT fixture should be below configured threshold');
      assertEqual(q2VatPreparation.items.some((item) => item.sourceModule === '税务口径'), false, 'VAT items should not duplicate tax policy as a manual source row');
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
      assertEqual(readyMatter.processStatus, '可申报', 'fully confirmed employee rows should move tax matter to handling');
      assertEqual(readyMatter.dataStatus, '已确认', 'fully confirmed employee rows should mark source data confirmed');
      assertEqual(completedMatter.payableAmount, 888, 'completed tax matters should not be silently recalculated');
    }
  },
  {
    name: 'applies confirmed monthly salary results to personal income tax matters',
    run: () => {
      const pendingMatter = createTaxMatter({
        matterNo: 'TAX-202606-IIT',
        matterType: '个人所得税',
        sourceItems: [],
        title: '2026-06 个人所得税'
      });
      const summary = buildPayrollIitTaxMatterSummary(
        [
          createSalaryReport(),
          createSalaryReport({
            personalIncomeTaxAmount: 72,
            personalIncomeTaxRecords: [
              {
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
                sourceModule: '薪酬明细',
                sourceMonth: '2026-06',
                taxRate: 0.03
              }
            ],
            status: '待确认'
          })
        ],
        '2026-06'
      );
      const waitingMatter = applyPayrollIitSummaryToTaxMatter(pendingMatter, [
        createSalaryReport(),
        createSalaryReport({ id: 'salary-report-002', status: '待确认' } as Partial<SalaryMonthlyReport>)
      ]);
      const readyMatter = applyPayrollIitSummaryToTaxMatter(pendingMatter, [
        createSalaryReport(),
        createSalaryReport({
          personalIncomeTaxAmount: 72,
          personalIncomeTaxRecords: [
            {
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
              sourceModule: '薪酬明细',
              sourceMonth: '2026-06',
              taxRate: 0.03
            }
          ],
          status: '已结算'
        })
      ]);
      const currentCompletedMatter = applyPayrollIitSummaryToTaxMatter(
        createTaxMatter({
          matterNo: 'TAX-202606-IIT',
          matterType: '个人所得税',
          paidAmount: 387,
          payableAmount: 387,
          paymentStatus: '已缴纳',
          processStatus: '已完成',
          sourceItems: [],
          title: '2026-06 个人所得税'
        }),
        [
          createSalaryReport(),
          createSalaryReport({ id: 'salary-report-002', status: '待确认' } as Partial<SalaryMonthlyReport>)
        ]
      );
      const historicalCompletedMatter = applyPayrollIitSummaryToTaxMatter(
        createTaxMatter({
          matterNo: 'TAX-202605-IIT',
          matterType: '个人所得税',
          paidAmount: 288,
          payableAmount: 288,
          period: '2026-05',
          processStatus: '已完成',
          title: '2026-05 个人所得税'
        }),
        []
      );
      const employeeRows = buildPayrollIitTaxMatterEmployeeRows(
        [
          createSalaryReport(),
          createSalaryReport({
            id: 'salary-report-002',
            member: { id: 'EMP-002', name: '测试员工二', position: '空间设计师' } as SalaryMonthlyReport['member'],
            personalIncomeTaxAmount: 72,
            status: '待确认'
          } as Partial<SalaryMonthlyReport>)
        ],
        '2026-06'
      );

      assertEqual(summary.sourceStatus, '待复核', 'pending salary reports should keep IIT source under review');
      assertEqual(summary.participantSummary, '1/2 人', 'IIT participant summary should expose confirmed salary progress');
      assertEqual(summary.payableAmount, 0, 'IIT payable amount should not expose partial salary confirmation result');
      assertEqual(waitingMatter.processStatus, '数据待确认', 'unconfirmed salary should keep IIT matter pending confirmation');
      assertEqual(waitingMatter.payableAmount, 0, 'pending IIT matter should not carry a partial payable amount');
      assertEqual(readyMatter.payableAmount, 387, 'IIT matter should sum derived tax from confirmed monthly salary reports');
      assertEqual(readyMatter.processStatus, '可申报', 'confirmed salary reports should move IIT matter to handling');
      assertEqual(currentCompletedMatter.processStatus, '数据待确认', 'current completed IIT matter should reopen when salary source becomes unconfirmed');
      assertEqual(currentCompletedMatter.paidAmount, 0, 'current reopened IIT matter should clear paid amount before handling');
      assertEqual(historicalCompletedMatter.processStatus, '已完成', 'historical completed IIT matter should remain archived');
      assertDeepEqual(
        employeeRows.map((row) => [row.employeeNo, row.salaryStatus, row.includedInFiling, row.personalIncomeTaxAmount]),
        [
          ['EMP-001', '已确认', true, 315],
          ['EMP-002', '待确认', false, 0]
        ],
        'IIT employee rows should mark only confirmed salary reports as filing sources'
      );
      assertDeepEqual(
        readyMatter.sourceItems.map((item) => [item.name, item.sourceModule, item.status]),
        [
          ['薪酬明细', '薪酬明细', '已确认'],
          ['工资薪金个税表', '自然人电子税务局', '待准备']
        ],
        'IIT source items should point to monthly salary and natural person tax filing'
      );
    }
  },
  {
    name: 'requires receipt files by tax matter type and payable amount',
    run: () => {
      const payableCit = createTaxMatter({ matterType: '企业所得税', payableAmount: 815 });
      const zeroVat = createTaxMatter({ matterType: '增值税及附加', payableAmount: 0 });
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
        paymentStatus: '已缴纳',
        processStatus: '待上传回执'
      });
      const transaction = buildTaxMatterPaymentTransaction({
        financeRows: [existingRow],
        publicAccountRef: getFinanceSeedPublicAccountRef('public-account-ccb-payment-reserve'),
        record: matter
      });
      const attachedMatter = attachTaxMatterPaymentTransaction(matter, transaction);

      assertEqual(getTaxMatterLinkedPaymentAmount(matter, [existingRow]), 1000, 'linked amount should come from active finance rows');
      assertEqual(transaction?.amount, 2075, 'generated payment flow should only register unpaid delta');
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
    name: 'does not build tax payment transaction before payment voucher exists',
    run: () => {
      const matter = createTaxMatter({
        declarationDate: '2026-07-15',
        files: [{ id: 'tax-file-declaration', name: '企业所得税申报回执.pdf', status: '已上传', type: '申报回执', updatedAt: '2026-07-15' }],
        paidAmount: 815,
        payableAmount: 815,
        paymentStatus: '已缴纳',
        processStatus: '待上传回执'
      });
      const transaction = buildTaxMatterPaymentTransaction({
        financeRows: [],
        publicAccountRef: getFinanceSeedPublicAccountRef('public-account-ccb-payment-reserve'),
        record: matter
      });

      assertEqual(transaction, undefined, 'tax payment flow should wait until payment voucher is available');
    }
  }
];

export function runFinanceTaxMatterModelTests() {
  const failures: string[] = [];
  let passed = 0;

  for (const test of tests) {
    try {
      test.run();
      passed += 1;
    } catch (error) {
      failures.push(`${test.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    failures,
    passed,
    total: tests.length
  };
}
