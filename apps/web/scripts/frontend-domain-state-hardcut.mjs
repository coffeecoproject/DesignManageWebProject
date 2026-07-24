import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

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

async function readRequiredSource(webRoot, relativePath) {
  return readFile(join(webRoot, relativePath), 'utf8');
}

export async function assertFrontendDomainStateHardcut(webRoot) {
  const rootApp = await readRequiredSource(webRoot, 'src/app/RootApp.tsx');
  const ledgerPage = await readRequiredSource(webRoot, 'src/features/finance/FinanceLedgerInitializationPage.tsx');
  const generalLedgerPage = await readRequiredSource(webRoot, 'src/features/finance/FinanceGeneralLedgerPage.tsx');
  const bankPage = await readRequiredSource(webRoot, 'src/features/finance/FinanceBankReconciliationPage.tsx');
  const movementPage = await readRequiredSource(webRoot, 'src/features/people/PeopleMovementPage.tsx');
  const signaturePage = await readRequiredSource(webRoot, 'src/features/performance/PerformanceSignaturesPage.tsx');
  const relatedFileTable = await readRequiredSource(webRoot, 'src/components/RelatedFileTable.tsx');

  const requiredRootProviders = [
    'FinanceLedgerInitializationProvider',
    'FinanceBankStatementProvider',
    'PeopleOrganizationProvider',
    'PerformanceSignatureProvider'
  ];

  for (const provider of requiredRootProviders) {
    if (!rootApp.includes(`<${provider}>`)) {
      throw new Error(`RootApp must mount ${provider}`);
    }
  }

  const contracts = [
    {
      content: ledgerPage,
      forbidden: ['useState<LedgerInitializationProfile>', 'useState<LedgerOpeningBalanceRow[]>'],
      required: ['useFinanceLedgerInitialization()'],
      source: 'FinanceLedgerInitializationPage.tsx'
    },
    {
      content: bankPage,
      forbidden: ['useState<BankStatementRecord[]>', 'useState<BankImportBatch[]>'],
      required: ['useFinanceBankStatementState()'],
      source: 'FinanceBankReconciliationPage.tsx'
    },
    {
      content: movementPage,
      forbidden: ['useState<MovementRow[]>'],
      required: ['saveMovementRecord', 'setMovementRows'],
      source: 'PeopleMovementPage.tsx'
    },
    {
      content: signaturePage,
      forbidden: ['useState<PerformanceEmployeeSignatureArchive[]>'],
      required: ['usePerformanceSignatureState()'],
      source: 'PerformanceSignaturesPage.tsx'
    }
  ];

  for (const contract of contracts) {
    for (const requiredToken of contract.required) {
      if (!contract.content.includes(requiredToken)) {
        throw new Error(`${contract.source} must consume shared domain state through ${requiredToken}`);
      }
    }

    for (const forbiddenToken of contract.forbidden) {
      if (contract.content.includes(forbiddenToken)) {
        throw new Error(`${contract.source} must not restore page-local domain state ${forbiddenToken}`);
      }
    }
  }

  if (
    !generalLedgerPage.includes('enabledProfile') ||
    !generalLedgerPage.includes('buildLedgerInitializationOpeningBalancesForGeneralLedger(enabledOpeningRows, enabledProfile)') ||
    !generalLedgerPage.includes(': []')
  ) {
    throw new Error('FinanceGeneralLedgerPage must consume the enabled ledger-initialization snapshot');
  }

  if (!relatedFileTable.includes('records.some((record) => record.url)') || !relatedFileTable.includes('previewHref')) {
    throw new Error('RelatedFileTable must derive preview/download actions from real file resource URLs');
  }

  const forbiddenPrototypeMessages = [
    '预览仍为前端原型',
    '下载请求已记录',
    '原型预览',
    '原型下载',
    '已准备下载',
    '已开始下载'
  ];
  const sourceFiles = await listSourceFiles(join(webRoot, 'src'));

  for (const sourceFile of sourceFiles) {
    const content = await readFile(sourceFile, 'utf8');
    const forbiddenMessage = forbiddenPrototypeMessages.find((message) => content.includes(message));

    if (forbiddenMessage) {
      throw new Error(`${relative(webRoot, sourceFile)} contains fake file action message ${forbiddenMessage}`);
    }
  }

  return {
    checkedSourceFiles: sourceFiles.length,
    providerCount: requiredRootProviders.length,
    stateContractCount: contracts.length
  };
}
