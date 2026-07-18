import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const legacyPerformanceTokens = [
  'PeopleWorkEvaluationRecord',
  'workEvaluationRecords',
  'workEvaluationSummary'
];

const removedPerformanceFiles = [
  'src/features/performance/PerformanceMonthlyState.tsx',
  'src/features/performance/performanceExecutionContract.ts',
  'src/features/performance/performanceQuarterlyReviewModel.ts'
];

const sharedDrawerConsumers = [
  'src/features/my-work/MyPerformancePage.tsx',
  'src/features/performance/PerformanceMonthlyPage.tsx'
];

async function listSourceFiles(rootPath) {
  const entries = await readdir(rootPath, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(rootPath, entry.name);

      if (entry.isDirectory()) {
        return listSourceFiles(entryPath);
      }

      return /\.(?:ts|tsx)$/.test(entry.name) ? [entryPath] : [];
    })
  );

  return nestedFiles.flat();
}

export async function assertPerformancePhase7ResidualHardcut(webRoot) {
  const sourceRoot = join(webRoot, 'src');
  const sourceFiles = await listSourceFiles(sourceRoot);
  const sourceContents = await Promise.all(
    sourceFiles.map(async (filePath) => ({
      content: await readFile(filePath, 'utf8'),
      relativePath: relative(webRoot, filePath)
    }))
  );

  for (const { content, relativePath } of sourceContents) {
    const forbiddenToken = legacyPerformanceTokens.find((token) => content.includes(token));

    if (forbiddenToken) {
      throw new Error(`${relativePath} still contains legacy performance contract ${forbiddenToken}`);
    }
  }

  const existingSourcePaths = new Set(sourceContents.map(({ relativePath }) => relativePath));
  const restoredLegacyFile = removedPerformanceFiles.find((relativePath) => existingSourcePaths.has(relativePath));

  if (restoredLegacyFile) {
    throw new Error(`${restoredLegacyFile} must remain removed after the performance hardcut`);
  }

  const drawerPath = 'src/features/performance/PerformanceResultDrawer.tsx';
  const drawer = sourceContents.find(({ relativePath }) => relativePath === drawerPath)?.content;

  if (!drawer) {
    throw new Error(`${drawerPath} is missing`);
  }

  const tabsStart = drawer.indexOf('testId="performance-result-drawer-tabs"');
  const tabsEnd = drawer.indexOf('onChange={setActiveTab}', tabsStart);
  const tabsBlock = tabsStart >= 0 && tabsEnd > tabsStart ? drawer.slice(tabsStart, tabsEnd) : '';
  const tabKeys = [...tabsBlock.matchAll(/key: '([^']+)'/g)].map((match) => match[1]);
  const expectedTabKeys = ['overview', 'source', 'records'];

  if (tabKeys.join(',') !== expectedTabKeys.join(',')) {
    throw new Error(`shared performance result drawer tabs must be ${expectedTabKeys.join(',')}`);
  }

  for (const relativePath of sharedDrawerConsumers) {
    const content = sourceContents.find((source) => source.relativePath === relativePath)?.content;

    if (!content?.includes("import { PerformanceResultDrawer } from './PerformanceResultDrawer'")
      && !content?.includes("import { PerformanceResultDrawer } from '../performance/PerformanceResultDrawer'")) {
      throw new Error(`${relativePath} does not reuse PerformanceResultDrawer`);
    }
  }

  return {
    checkedSourceFiles: sourceFiles.length,
    sharedDrawerConsumers: sharedDrawerConsumers.length,
    tabCount: tabKeys.length
  };
}
