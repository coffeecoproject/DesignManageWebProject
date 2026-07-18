import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import react from '@vitejs/plugin-react';
import { build } from 'vite';
import { assertCorporateIncomeTaxAcceptanceEvidence } from './corporate-income-tax-acceptance.mjs';
import { assertNaturalPersonPaymentAcceptanceEvidence } from './natural-person-payment-acceptance.mjs';
import { assertPerformancePhase6ConsumerHardcut } from './performance-phase6-consumer-hardcut.mjs';
import { assertPerformancePhase7ResidualHardcut } from './performance-phase7-residual-hardcut.mjs';
import { assertStampDutyAcceptanceEvidence } from './stamp-duty-acceptance.mjs';
import { assertTaxHandlingSettlementAcceptanceEvidence } from './tax-handling-settlement-acceptance.mjs';

const webRoot = fileURLToPath(new URL('..', import.meta.url));
const outDir = join(webRoot, 'node_modules/.cache/startupmanage-web-unit-tests');
const bundledTestFile = join(outDir, 'peopleDomain.test.mjs');
const bundledAttendanceMonthlyTestFile = join(outDir, 'peopleAttendanceMonthlyDomain.test.mjs');
const bundledPeopleMovementRecordModelTestFile = join(outDir, 'peopleMovementRecordModel.test.mjs');
const bundledPeopleExpiryModelTestFile = join(outDir, 'peopleExpiryModel.test.mjs');
const bundledTaskAssignmentCandidateTestFile = join(outDir, 'taskAssignmentCandidates.test.mjs');
const bundledRegionSearchSelectTestFile = join(outDir, 'RegionSearchSelect.test.mjs');
const bundledPublicAccountConfigStateTestFile = join(outDir, 'PublicAccountConfigState.test.mjs');
const bundledTaskDomainModelTestFile = join(outDir, 'taskDomainModel.test.mjs');
const bundledTaskCustomerBillingModelTestFile = join(outDir, 'taskCustomerBillingModel.test.mjs');
const bundledBrandTaskPricingModelTestFile = join(outDir, 'brandTaskPricingModel.test.mjs');
const bundledTaskFeedbackModelTestFile = join(outDir, 'taskFeedbackModel.test.mjs');
const bundledPersonTaskViewModelTestFile = join(outDir, 'personTaskViewModel.test.mjs');
const bundledSalaryDomainTestFile = join(outDir, 'salaryDomain.test.mjs');
const bundledSalaryPerformanceConsumptionModelTestFile = join(outDir, 'salaryPerformanceConsumptionModel.test.mjs');
const bundledFinanceSocialInsuranceModelTestFile = join(outDir, 'financeSocialInsuranceModel.test.mjs');
const bundledFinanceTaxMatterModelTestFile = join(outDir, 'financeTaxMatterModel.test.mjs');
const bundledFinanceStampDutyModelTestFile = join(outDir, 'financeStampDutyModel.test.mjs');
const bundledFinanceStampDutyLedgerBridgeTestFile = join(outDir, 'financeStampDutyLedgerBridge.test.mjs');
const bundledFinanceBusinessOverviewModelTestFile = join(outDir, 'financeBusinessOverviewModel.test.mjs');
const bundledFinanceAccountingSubjectDataTestFile = join(outDir, 'financeAccountingSubjectData.test.mjs');
const bundledFinanceLedgerInitializationModelTestFile = join(outDir, 'financeLedgerInitializationModel.test.mjs');
const bundledFinanceAccountingVoucherModelTestFile = join(outDir, 'financeAccountingVoucherModel.test.mjs');
const bundledFinanceGeneralLedgerModelTestFile = join(outDir, 'financeGeneralLedgerModel.test.mjs');
const bundledFinanceFinancialStatementsModelTestFile = join(outDir, 'financeFinancialStatementsModel.test.mjs');
const bundledFinancePeriodCloseModelTestFile = join(outDir, 'financePeriodCloseModel.test.mjs');
const bundledFinancePeriodCloseAcceptanceMatrixTestFile = join(outDir, 'financePeriodCloseAcceptanceMatrix.test.mjs');
const bundledFinancePeriodCloseStageAuditMatrixTestFile = join(outDir, 'financePeriodCloseStageAuditMatrix.test.mjs');
const bundledFinancePeriodCloseSourceMutationMatrixTestFile = join(outDir, 'financePeriodCloseSourceMutationMatrix.test.mjs');
const bundledFinanceCategoryAccountingMappingTestFile = join(outDir, 'financeCategoryAccountingMapping.test.mjs');
const bundledFinanceReceivablesPayablesModelTestFile = join(outDir, 'financeReceivablesPayablesModel.test.mjs');
const bundledFinanceCustomerTaskSettlementModelTestFile = join(outDir, 'financeCustomerTaskSettlementModel.test.mjs');
const bundledTaskCustomerReceivableFrontendWorkflowTestFile = join(outDir, 'taskCustomerReceivableFrontendWorkflow.test.mjs');
const bundledFinanceNaturalPersonPaymentModelTestFile = join(outDir, 'financeNaturalPersonPaymentModel.test.mjs');
const bundledPartTimeLaborFrontendWorkflowTestFile = join(outDir, 'partTimeLaborFrontendWorkflow.test.mjs');
const bundledNaturalPersonPaymentFrontendWorkflowTestFile = join(outDir, 'naturalPersonPaymentFrontendWorkflow.test.mjs');
const bundledSalaryFinanceFrontendWorkflowTestFile = join(outDir, 'salaryFinanceFrontendWorkflow.test.mjs');
const bundledFinanceExpenseApprovalCommitModelTestFile = join(outDir, 'financeExpenseApprovalCommitModel.test.mjs');
const bundledFinanceInvoiceImportModelTestFile = join(outDir, 'financeInvoiceImportModel.test.mjs');
const bundledFinanceInvoiceAssociationModelTestFile = join(outDir, 'financeInvoiceAssociationModel.test.mjs');
const bundledFinanceReviewModelTestFile = join(outDir, 'financeReviewModel.test.mjs');
const bundledFinanceBankImportContractTestFile = join(outDir, 'financeBankImportContract.test.mjs');
const bundledFinanceBankReconciliationModelTestFile = join(outDir, 'financeBankReconciliationModel.test.mjs');
const bundledFinanceTransactionAdjustmentModelTestFile = join(outDir, 'financeTransactionAdjustmentModel.test.mjs');
const bundledTaxAccountingFrontendWorkflowTestFile = join(outDir, 'taxAccountingFrontendWorkflow.test.mjs');
const bundledMyWorkModelTestFile = join(outDir, 'myWorkModel.test.mjs');
const bundledMyWorkExpenseCollectionModelTestFile = join(outDir, 'myWorkExpenseCollectionModel.test.mjs');
const bundledMyWorkExpenseReviewModelTestFile = join(outDir, 'myWorkExpenseReviewModel.test.mjs');
const bundledPerformanceDashboardModelTestFile = join(outDir, 'performanceDashboardModel.test.mjs');
const bundledPerformanceMonthlyModelTestFile = join(outDir, 'performanceMonthlyModel.test.mjs');
const bundledPerformanceRuleModelTestFile = join(outDir, 'performanceRuleModel.test.mjs');
const bundledPerformanceSignatureModelTestFile = join(outDir, 'performanceSignatureModel.test.mjs');
const bundledPerformanceResultDeadlineModelTestFile = join(outDir, 'performanceResultDeadlineModel.test.mjs');
const bundledPerformanceResultModelTestFile = join(outDir, 'performanceResultModel.test.mjs');
const bundledPerformanceResultWorkflowTestFile = join(outDir, 'performanceResultWorkflow.test.mjs');
const bundledPerformanceQuarterlyResultModelTestFile = join(outDir, 'performanceQuarterlyResultModel.test.mjs');
const bundledPerformanceRuleApplicabilityModelTestFile = join(outDir, 'performanceRuleApplicabilityModel.test.mjs');
const bundledTaskPerformanceMonthlySourceModelTestFile = join(outDir, 'taskPerformanceMonthlySourceModel.test.mjs');

const testModules = [
  {
    bundledFile: bundledTestFile,
    entry: 'src/features/people/peopleDomain.test.ts',
    runExport: 'runPeopleDomainTests'
  },
  {
    bundledFile: bundledAttendanceMonthlyTestFile,
    entry: 'src/features/people/peopleAttendanceMonthlyDomain.test.ts',
    runExport: 'runPeopleAttendanceMonthlyDomainTests'
  },
  {
    bundledFile: bundledPeopleMovementRecordModelTestFile,
    entry: 'src/features/people/peopleMovementRecordModel.test.ts',
    runExport: 'runPeopleMovementRecordModelTests'
  },
  {
    bundledFile: bundledPeopleExpiryModelTestFile,
    entry: 'src/features/people/peopleExpiryModel.test.ts',
    runExport: 'runPeopleExpiryModelTests'
  },
  {
    bundledFile: bundledTaskAssignmentCandidateTestFile,
    entry: 'src/features/tasks/taskAssignmentCandidates.test.ts',
    runExport: 'runTaskAssignmentCandidateTests'
  },
  {
    bundledFile: bundledRegionSearchSelectTestFile,
    entry: 'src/components/RegionSearchSelect.test.ts',
    runExport: 'runRegionSearchSelectTests'
  },
  {
    bundledFile: bundledPublicAccountConfigStateTestFile,
    entry: 'src/features/system/PublicAccountConfigState.test.ts',
    runExport: 'runPublicAccountConfigStateTests'
  },
  {
    bundledFile: bundledBrandTaskPricingModelTestFile,
    entry: 'src/features/customers/brandTaskPricingModel.test.ts',
    runExport: 'runBrandTaskPricingModelTests'
  },
  {
    bundledFile: bundledTaskCustomerBillingModelTestFile,
    entry: 'src/features/tasks/taskCustomerBillingModel.test.ts',
    runExport: 'runTaskCustomerBillingModelTests'
  },
  {
    bundledFile: bundledTaskDomainModelTestFile,
    entry: 'src/features/tasks/taskDomainModel.test.ts',
    runExport: 'runTaskDomainModelTests'
  },
  {
    bundledFile: bundledTaskFeedbackModelTestFile,
    entry: 'src/features/tasks/taskFeedbackModel.test.ts',
    runExport: 'runTaskFeedbackModelTests'
  },
  {
    bundledFile: bundledPersonTaskViewModelTestFile,
    entry: 'src/features/tasks/personTaskViewModel.test.ts',
    runExport: 'runPersonTaskViewModelTests'
  },
  {
    bundledFile: bundledSalaryDomainTestFile,
    entry: 'src/features/salary/salaryDomain.test.ts',
    runExport: 'runSalaryDomainTests'
  },
  {
    bundledFile: bundledSalaryPerformanceConsumptionModelTestFile,
    entry: 'src/features/salary/salaryPerformanceConsumptionModel.test.ts',
    runExport: 'runSalaryPerformanceConsumptionModelTests'
  },
  {
    bundledFile: bundledFinanceSocialInsuranceModelTestFile,
    entry: 'src/features/finance/financeSocialInsuranceModel.test.ts',
    runExport: 'runFinanceSocialInsuranceModelTests'
  },
  {
    bundledFile: bundledFinanceTaxMatterModelTestFile,
    entry: 'src/features/finance/financeTaxMatterModel.test.ts',
    runExport: 'runFinanceTaxMatterModelTests'
  },
  {
    bundledFile: bundledFinanceStampDutyModelTestFile,
    entry: 'src/features/finance/financeStampDutyModel.test.ts',
    runExport: 'runFinanceStampDutyModelTests'
  },
  {
    bundledFile: bundledFinanceStampDutyLedgerBridgeTestFile,
    entry: 'src/features/finance/financeStampDutyLedgerBridge.test.ts',
    runExport: 'runFinanceStampDutyLedgerBridgeTests'
  },
  {
    bundledFile: bundledFinanceBusinessOverviewModelTestFile,
    entry: 'src/features/finance/financeBusinessOverviewModel.test.ts',
    runExport: 'runFinanceBusinessOverviewModelTests'
  },
  {
    bundledFile: bundledFinanceAccountingSubjectDataTestFile,
    entry: 'src/features/finance/financeAccountingSubjectData.test.ts',
    runExport: 'runFinanceAccountingSubjectDataTests'
  },
  {
    bundledFile: bundledFinanceLedgerInitializationModelTestFile,
    entry: 'src/features/finance/financeLedgerInitializationModel.test.ts',
    runExport: 'runFinanceLedgerInitializationModelTests'
  },
  {
    bundledFile: bundledFinanceAccountingVoucherModelTestFile,
    entry: 'src/features/finance/financeAccountingVoucherModel.test.ts',
    runExport: 'runFinanceAccountingVoucherModelTests'
  },
  {
    bundledFile: bundledFinanceGeneralLedgerModelTestFile,
    entry: 'src/features/finance/financeGeneralLedgerModel.test.ts',
    runExport: 'runFinanceGeneralLedgerModelTests'
  },
  {
    bundledFile: bundledFinanceFinancialStatementsModelTestFile,
    entry: 'src/features/finance/financeFinancialStatementsModel.test.ts',
    runExport: 'runFinanceFinancialStatementsModelTests'
  },
  {
    bundledFile: bundledFinancePeriodCloseModelTestFile,
    entry: 'src/features/finance/financePeriodCloseModel.test.ts',
    runExport: 'runFinancePeriodCloseModelTests'
  },
  {
    bundledFile: bundledFinancePeriodCloseAcceptanceMatrixTestFile,
    entry: 'src/features/finance/financePeriodCloseAcceptanceMatrix.test.ts',
    runExport: 'runFinancePeriodCloseAcceptanceMatrixTests'
  },
  {
    bundledFile: bundledFinancePeriodCloseStageAuditMatrixTestFile,
    entry: 'src/features/finance/financePeriodCloseStageAuditMatrix.test.ts',
    runExport: 'runFinancePeriodCloseStageAuditMatrixTests'
  },
  {
    bundledFile: bundledFinancePeriodCloseSourceMutationMatrixTestFile,
    entry: 'src/features/finance/financePeriodCloseSourceMutationMatrix.test.ts',
    runExport: 'runFinancePeriodCloseSourceMutationMatrixTests'
  },
  {
    bundledFile: bundledFinanceCategoryAccountingMappingTestFile,
    entry: 'src/features/finance/financeCategoryAccountingMapping.test.ts',
    runExport: 'runFinanceCategoryAccountingMappingTests'
  },
  {
    bundledFile: bundledFinanceReceivablesPayablesModelTestFile,
    entry: 'src/features/finance/financeReceivablesPayablesModel.test.ts',
    runExport: 'runFinanceReceivablesPayablesModelTests'
  },
  {
    bundledFile: bundledFinanceCustomerTaskSettlementModelTestFile,
    entry: 'src/features/finance/financeCustomerTaskSettlementModel.test.ts',
    runExport: 'runFinanceCustomerTaskSettlementModelTests'
  },
  {
    bundledFile: bundledTaskCustomerReceivableFrontendWorkflowTestFile,
    entry: 'src/features/finance/taskCustomerReceivableFrontendWorkflow.test.ts',
    runExport: 'runTaskCustomerReceivableFrontendWorkflowTests'
  },
  {
    bundledFile: bundledFinanceNaturalPersonPaymentModelTestFile,
    entry: 'src/features/finance/financeNaturalPersonPaymentModel.test.ts',
    runExport: 'runFinanceNaturalPersonPaymentModelTests'
  },
  {
    bundledFile: bundledPartTimeLaborFrontendWorkflowTestFile,
    entry: 'src/features/finance/partTimeLaborFrontendWorkflow.test.ts',
    runExport: 'runPartTimeLaborFrontendWorkflowTests'
  },
  {
    bundledFile: bundledNaturalPersonPaymentFrontendWorkflowTestFile,
    entry: 'src/features/finance/naturalPersonPaymentFrontendWorkflow.test.ts',
    runExport: 'runNaturalPersonPaymentFrontendWorkflowTests'
  },
  {
    bundledFile: bundledSalaryFinanceFrontendWorkflowTestFile,
    entry: 'src/features/finance/salaryFinanceFrontendWorkflow.test.ts',
    runExport: 'runSalaryFinanceFrontendWorkflowTests'
  },
  {
    bundledFile: bundledFinanceExpenseApprovalCommitModelTestFile,
    entry: 'src/features/finance/financeExpenseApprovalCommitModel.test.ts',
    runExport: 'runFinanceExpenseApprovalCommitModelTests'
  },
  {
    bundledFile: bundledFinanceInvoiceImportModelTestFile,
    entry: 'src/features/finance/financeInvoiceImportModel.test.ts',
    runExport: 'runFinanceInvoiceImportModelTests'
  },
  {
    bundledFile: bundledFinanceInvoiceAssociationModelTestFile,
    entry: 'src/features/finance/financeInvoiceAssociationModel.test.ts',
    runExport: 'runFinanceInvoiceAssociationModelTests'
  },
  {
    bundledFile: bundledFinanceReviewModelTestFile,
    entry: 'src/features/finance/financeReviewModel.test.ts',
    runExport: 'runFinanceReviewModelTests'
  },
  {
    bundledFile: bundledFinanceBankImportContractTestFile,
    entry: 'src/features/finance/financeBankImportContract.test.ts',
    runExport: 'runFinanceBankImportContractTests'
  },
  {
    bundledFile: bundledFinanceBankReconciliationModelTestFile,
    entry: 'src/features/finance/financeBankReconciliationModel.test.ts',
    runExport: 'runFinanceBankReconciliationModelTests'
  },
  {
    bundledFile: bundledFinanceTransactionAdjustmentModelTestFile,
    entry: 'src/features/finance/financeTransactionAdjustmentModel.test.ts',
    runExport: 'runFinanceTransactionAdjustmentModelTests'
  },
  {
    bundledFile: bundledTaxAccountingFrontendWorkflowTestFile,
    entry: 'src/features/finance/taxAccountingFrontendWorkflow.test.ts',
    runExport: 'runTaxAccountingFrontendWorkflowTests'
  },
  {
    bundledFile: bundledMyWorkModelTestFile,
    entry: 'src/features/my-work/myWorkModel.test.ts',
    runExport: 'runMyWorkModelTests'
  },
  {
    bundledFile: bundledMyWorkExpenseCollectionModelTestFile,
    entry: 'src/features/my-work/myWorkExpenseCollectionModel.test.ts',
    runExport: 'runMyWorkExpenseCollectionModelTests'
  },
  {
    bundledFile: bundledMyWorkExpenseReviewModelTestFile,
    entry: 'src/features/my-work/myWorkExpenseReviewModel.test.ts',
    runExport: 'runMyWorkExpenseReviewModelTests'
  },
  {
    bundledFile: bundledPerformanceDashboardModelTestFile,
    entry: 'src/features/performance/performanceDashboardModel.test.ts',
    runExport: 'runPerformanceDashboardModelTests'
  },
  {
    bundledFile: bundledPerformanceMonthlyModelTestFile,
    entry: 'src/features/performance/performanceMonthlyModel.test.ts',
    runExport: 'runPerformanceMonthlyModelTests'
  },
  {
    bundledFile: bundledPerformanceRuleModelTestFile,
    entry: 'src/features/performance/performanceRuleModel.test.ts',
    runExport: 'runPerformanceRuleModelTests'
  },
  {
    bundledFile: bundledPerformanceSignatureModelTestFile,
    entry: 'src/features/performance/performanceSignatureModel.test.ts',
    runExport: 'runPerformanceSignatureModelTests'
  },
  {
    bundledFile: bundledPerformanceResultDeadlineModelTestFile,
    entry: 'src/features/performance/performanceResultDeadlineModel.test.ts',
    runExport: 'runPerformanceResultDeadlineModelTests'
  },
  {
    bundledFile: bundledPerformanceResultModelTestFile,
    entry: 'src/features/performance/performanceResultModel.test.ts',
    runExport: 'runPerformanceResultModelTests'
  },
  {
    bundledFile: bundledPerformanceResultWorkflowTestFile,
    entry: 'src/features/performance/performanceResultWorkflow.test.ts',
    runExport: 'runPerformanceResultWorkflowTests'
  },
  {
    bundledFile: bundledPerformanceQuarterlyResultModelTestFile,
    entry: 'src/features/performance/performanceQuarterlyResultModel.test.ts',
    runExport: 'runPerformanceQuarterlyResultModelTests'
  },
  {
    bundledFile: bundledPerformanceRuleApplicabilityModelTestFile,
    entry: 'src/features/performance/performanceRuleApplicabilityModel.test.ts',
    runExport: 'runPerformanceRuleApplicabilityModelTests'
  },
  {
    bundledFile: bundledTaskPerformanceMonthlySourceModelTestFile,
    entry: 'src/features/performance/taskPerformanceMonthlySourceModel.test.ts',
    runExport: 'runTaskPerformanceMonthlySourceModelTests'
  }
];

await rm(outDir, { force: true, recursive: true });

for (const testModule of testModules) {
  await build({
    build: {
      emptyOutDir: false,
      minify: false,
      outDir,
      rollupOptions: {
        output: {
          entryFileNames: testModule.bundledFile.split('/').at(-1),
          format: 'esm'
        }
      },
      ssr: testModule.entry
    },
    configFile: false,
    logLevel: 'error',
    plugins: [react()],
    root: webRoot
  });
}

const allFailures = [];
const testExecutionEvidence = [];
let total = 0;
let passed = 0;

for (const testModule of testModules) {
  const loadedModule = await import(`${pathToFileURL(testModule.bundledFile).href}?t=${Date.now()}`);
  const runTests = loadedModule[testModule.runExport];

  if (typeof runTests !== 'function') {
    allFailures.push(`${testModule.entry}: missing ${testModule.runExport} export`);
    continue;
  }

  const result = runTests();
  total += result.total;
  passed += result.passed;
  allFailures.push(...result.failures.map((failure) => `${testModule.entry}: ${failure}`));
  testExecutionEvidence.push({
    entry: testModule.entry,
    executedTestNames: result.executedTestNames ?? [],
    passedTestNames: result.passedTestNames ?? []
  });
}

let naturalPersonAcceptanceResult;
let corporateIncomeTaxAcceptanceResult;
let stampDutyAcceptanceResult;
let taxHandlingSettlementAcceptanceResult;
let performancePhase6ConsumerHardcutResult;
let performancePhase7ResidualHardcutResult;

try {
  corporateIncomeTaxAcceptanceResult = assertCorporateIncomeTaxAcceptanceEvidence(
    testModules.map((testModule) => testModule.entry),
    testExecutionEvidence
  );
} catch (error) {
  allFailures.push(`corporate-income-tax acceptance: ${error instanceof Error ? error.message : String(error)}`);
}

try {
  naturalPersonAcceptanceResult = assertNaturalPersonPaymentAcceptanceEvidence(
    testModules.map((testModule) => testModule.entry),
    testExecutionEvidence
  );
} catch (error) {
  allFailures.push(`natural-person acceptance: ${error instanceof Error ? error.message : String(error)}`);
}

try {
  stampDutyAcceptanceResult = assertStampDutyAcceptanceEvidence(
    testModules.map((testModule) => testModule.entry),
    testExecutionEvidence
  );
} catch (error) {
  allFailures.push(`stamp-duty acceptance: ${error instanceof Error ? error.message : String(error)}`);
}

try {
  taxHandlingSettlementAcceptanceResult = assertTaxHandlingSettlementAcceptanceEvidence(
    testModules.map((testModule) => testModule.entry),
    testExecutionEvidence
  );
} catch (error) {
  allFailures.push(`tax-handling settlement acceptance: ${error instanceof Error ? error.message : String(error)}`);
}

try {
  performancePhase6ConsumerHardcutResult = await assertPerformancePhase6ConsumerHardcut(webRoot);
} catch (error) {
  allFailures.push(`performance phase 6 consumer hardcut: ${error instanceof Error ? error.message : String(error)}`);
}

try {
  performancePhase7ResidualHardcutResult = await assertPerformancePhase7ResidualHardcut(webRoot);
} catch (error) {
  allFailures.push(`performance phase 7 residual hardcut: ${error instanceof Error ? error.message : String(error)}`);
}

if (allFailures.length > 0) {
  console.error(`Unit tests failed: ${passed}/${total} passed`);
  for (const failure of allFailures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Unit tests passed: ${passed}/${total}`);
  console.log(
    `Corporate-income-tax acceptance: ${corporateIncomeTaxAcceptanceResult.passed}/${corporateIncomeTaxAcceptanceResult.total}`
  );
  console.log(
    `Natural-person acceptance ID coverage passed: ${naturalPersonAcceptanceResult.executableEvidenceCount}/${naturalPersonAcceptanceResult.total}`
  );
  console.log(`Stamp-duty acceptance: ${stampDutyAcceptanceResult.passed}/${stampDutyAcceptanceResult.total}`);
  console.log(
    `Tax-handling settlement acceptance: ${taxHandlingSettlementAcceptanceResult.passed}/${taxHandlingSettlementAcceptanceResult.total}`
  );
  console.log(`Natural-person named scenarios executed and passed: ${naturalPersonAcceptanceResult.executedScenarioCount}`);
  console.log(
    `Natural-person frontend-chain closure: ${naturalPersonAcceptanceResult.chainClosedIds.length}/${naturalPersonAcceptanceResult.total}`
  );
  console.log(
    `Performance Phase 6 consumer hardcut: ${performancePhase6ConsumerHardcutResult.checkedFiles}/${performancePhase6ConsumerHardcutResult.checkedFiles}`
  );
  console.log(
    `Performance Phase 7 residual hardcut: ${performancePhase7ResidualHardcutResult.checkedSourceFiles} source files, ${performancePhase7ResidualHardcutResult.sharedDrawerConsumers} shared consumers, ${performancePhase7ResidualHardcutResult.tabCount} tabs`
  );
}
