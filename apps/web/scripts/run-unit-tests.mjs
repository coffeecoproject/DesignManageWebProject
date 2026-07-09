import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import react from '@vitejs/plugin-react';
import { build } from 'vite';

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
const bundledTaskFeedbackModelTestFile = join(outDir, 'taskFeedbackModel.test.mjs');
const bundledPersonTaskViewModelTestFile = join(outDir, 'personTaskViewModel.test.mjs');
const bundledSalaryDomainTestFile = join(outDir, 'salaryDomain.test.mjs');
const bundledFinanceSocialInsuranceModelTestFile = join(outDir, 'financeSocialInsuranceModel.test.mjs');
const bundledFinanceTaxMatterModelTestFile = join(outDir, 'financeTaxMatterModel.test.mjs');
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
const bundledFinanceInvoiceImportModelTestFile = join(outDir, 'financeInvoiceImportModel.test.mjs');
const bundledFinanceInvoiceMatchingModelTestFile = join(outDir, 'financeInvoiceMatchingModel.test.mjs');
const bundledFinanceReviewModelTestFile = join(outDir, 'financeReviewModel.test.mjs');
const bundledFinanceBankImportContractTestFile = join(outDir, 'financeBankImportContract.test.mjs');
const bundledFinanceBankReconciliationModelTestFile = join(outDir, 'financeBankReconciliationModel.test.mjs');
const bundledFinanceTransactionAdjustmentModelTestFile = join(outDir, 'financeTransactionAdjustmentModel.test.mjs');
const bundledMyWorkModelTestFile = join(outDir, 'myWorkModel.test.mjs');
const bundledMyWorkExpenseCollectionModelTestFile = join(outDir, 'myWorkExpenseCollectionModel.test.mjs');
const bundledMyWorkExpenseReviewModelTestFile = join(outDir, 'myWorkExpenseReviewModel.test.mjs');
const bundledPerformanceDashboardModelTestFile = join(outDir, 'performanceDashboardModel.test.mjs');
const bundledPerformanceMonthlyModelTestFile = join(outDir, 'performanceMonthlyModel.test.mjs');
const bundledPerformanceRuleModelTestFile = join(outDir, 'performanceRuleModel.test.mjs');
const bundledPerformanceSignatureModelTestFile = join(outDir, 'performanceSignatureModel.test.mjs');

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
    bundledFile: bundledFinanceInvoiceImportModelTestFile,
    entry: 'src/features/finance/financeInvoiceImportModel.test.ts',
    runExport: 'runFinanceInvoiceImportModelTests'
  },
  {
    bundledFile: bundledFinanceInvoiceMatchingModelTestFile,
    entry: 'src/features/finance/financeInvoiceMatchingModel.test.ts',
    runExport: 'runFinanceInvoiceMatchingModelTests'
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
}

if (allFailures.length > 0) {
  console.error(`Unit tests failed: ${passed}/${total} passed`);
  for (const failure of allFailures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Unit tests passed: ${passed}/${total}`);
}
