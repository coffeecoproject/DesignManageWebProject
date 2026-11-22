import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const currentPerformanceConsumerFiles = [
  'src/app/moduleLinks.ts',
  'src/modules/my-work/MyWorkPages.tsx',
  'src/modules/my-work/MyWorkShared.tsx',
  'src/modules/people-overview/PeopleOverviewPage.tsx',
  'src/modules/performance/PerformanceDashboardPage.tsx',
  'src/modules/salary/salaryReportBuilder.ts',
  'src/modules/tasks/personTaskViewModel.ts',
  'src/modules/tasks/taskAssignmentCandidates.ts'
];

const forbiddenCurrentFactTokens = [
  'workEvaluationRecords',
  'workEvaluationSummary'
];

export async function assertPerformancePhase6ConsumerHardcut(webRoot) {
  const contents = await Promise.all(
    currentPerformanceConsumerFiles.map(async (relativePath) => ({
      content: await readFile(join(webRoot, relativePath), 'utf8'),
      relativePath
    }))
  );

  for (const { content, relativePath } of contents) {
    const forbiddenToken = forbiddenCurrentFactTokens.find((token) => content.includes(token));

    if (forbiddenToken) {
      throw new Error(`${relativePath} still consumes legacy performance fact ${forbiddenToken}`);
    }
  }

  const salaryBuilder = contents.find(
    ({ relativePath }) => relativePath === 'src/modules/salary/salaryReportBuilder.ts'
  )?.content;
  const taskCandidates = contents.find(
    ({ relativePath }) => relativePath === 'src/modules/tasks/taskAssignmentCandidates.ts'
  )?.content;
  const moduleLinks = contents.find(
    ({ relativePath }) => relativePath === 'src/app/moduleLinks.ts'
  )?.content;
  const myWorkShared = contents.find(
    ({ relativePath }) => relativePath === 'src/modules/my-work/MyWorkShared.tsx'
  )?.content;

  if (!salaryBuilder?.includes('buildSalaryPerformanceSourceRecords')) {
    throw new Error('salaryReportBuilder.ts does not consume the formal performance salary adapter');
  }

  // Task assignment reads the published summary through the lookup the app wires in from performance results.
  if (
    !taskCandidates?.includes('getPerformanceSummary(')
    || !/function useTaskPerformanceSummaryLookup\(\)[\s\S]*?getLatestPublishedPerformanceSummary\(/.test(moduleLinks ?? '')
  ) {
    throw new Error('taskAssignmentCandidates.ts does not consume the published performance summary');
  }

  if (!myWorkShared?.includes('getLatestPublishedPerformanceSummary')) {
    throw new Error('MyWorkShared.tsx does not consume the published performance summary');
  }

  return {
    checkedFiles: currentPerformanceConsumerFiles.length
  };
}
