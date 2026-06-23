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
const bundledTaskDomainModelTestFile = join(outDir, 'taskDomainModel.test.mjs');
const bundledTaskFeedbackModelTestFile = join(outDir, 'taskFeedbackModel.test.mjs');
const bundledPersonTaskViewModelTestFile = join(outDir, 'personTaskViewModel.test.mjs');
const bundledSalaryDomainTestFile = join(outDir, 'salaryDomain.test.mjs');
const bundledFinanceSocialInsuranceModelTestFile = join(outDir, 'financeSocialInsuranceModel.test.mjs');
const bundledFinanceTaxMatterModelTestFile = join(outDir, 'financeTaxMatterModel.test.mjs');
const bundledFinanceBusinessOverviewModelTestFile = join(outDir, 'financeBusinessOverviewModel.test.mjs');
const bundledMyWorkModelTestFile = join(outDir, 'myWorkModel.test.mjs');
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
    bundledFile: bundledMyWorkModelTestFile,
    entry: 'src/features/my-work/myWorkModel.test.ts',
    runExport: 'runMyWorkModelTests'
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
