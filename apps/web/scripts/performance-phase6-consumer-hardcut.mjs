import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const currentPerformanceConsumerFiles = [
  'src/features/my-work/MyWorkPages.tsx',
  'src/features/my-work/MyWorkShared.tsx',
  'src/features/people/PeopleOverviewPage.tsx',
  'src/features/performance/PerformanceDashboardPage.tsx',
  'src/features/salary/salaryReportBuilder.ts',
  'src/features/tasks/personTaskViewModel.ts',
  'src/features/tasks/taskAssignmentCandidates.ts'
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
    ({ relativePath }) => relativePath === 'src/features/salary/salaryReportBuilder.ts'
  )?.content;
  const taskCandidates = contents.find(
    ({ relativePath }) => relativePath === 'src/features/tasks/taskAssignmentCandidates.ts'
  )?.content;
  const myWorkShared = contents.find(
    ({ relativePath }) => relativePath === 'src/features/my-work/MyWorkShared.tsx'
  )?.content;

  if (!salaryBuilder?.includes('buildSalaryPerformanceSourceRecords')) {
    throw new Error('salaryReportBuilder.ts does not consume the formal performance salary adapter');
  }

  if (!taskCandidates?.includes('getLatestPublishedPerformanceSummary')) {
    throw new Error('taskAssignmentCandidates.ts does not consume the published performance summary');
  }

  if (!myWorkShared?.includes('getLatestPublishedPerformanceSummary')) {
    throw new Error('MyWorkShared.tsx does not consume the published performance summary');
  }

  return {
    checkedFiles: currentPerformanceConsumerFiles.length
  };
}
