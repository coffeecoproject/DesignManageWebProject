import {
  applyLedgerOpeningBalanceImportPreview,
  buildLedgerInitializationControlledActions,
  buildLedgerInitializationSteps,
  buildLedgerInitializationOpeningBalancesForGeneralLedger,
  buildLedgerInitializationSummary,
  buildLedgerInitializationSubjectSnapshot,
  buildLedgerOpeningBalanceImportPreviewRows,
  buildLedgerOpeningBalanceWorkspace,
  defaultLedgerInitializationFilters,
  ledgerInitializationDraftProfile,
  ledgerInitializationProfile,
  ledgerOpeningBalanceDraftImportBatch,
  ledgerOpeningBalanceRows,
  matchesLedgerInitializationFilters,
  validateLedgerOpeningBalances
} from './financeLedgerInitializationModel';
import {
  accountingSubjectSeedRows,
  type AccountingSubjectRecord
} from './financeAccountingSubjectData';
import { publicAccountSeeds } from '../system/PublicAccountConfigState';
import { buildPublicAccountOpeningBalances } from './financePublicAccountBalanceModel';

type UnitTest = {
  name: string;
  run: () => void;
};

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertThrows(run: () => void, message: string) {
  let thrown = false;

  try {
    run();
  } catch {
    thrown = true;
  }

  if (!thrown) {
    throw new Error(message);
  }
}

const tests: UnitTest[] = [
  {
    name: 'derives every public account opening balance from account-set auxiliary rows',
    run: () => {
      const balances = buildPublicAccountOpeningBalances(
        publicAccountSeeds,
        ledgerOpeningBalanceRows,
        ledgerInitializationProfile.effectivePeriod
      );
      const byAccount = new Map(balances.map((balance) => [balance.publicAccountId, balance.openingBalance]));

      assertEqual(byAccount.get('public-account-cmb-basic'), 122_669.48, 'basic account should use its own opening auxiliary row');
      assertEqual(byAccount.get('public-account-icbc-payment-reserve'), 80_000, 'ICBC account should use its own opening auxiliary row');
      assertEqual(byAccount.get('public-account-ccb-payment-reserve'), 50_000, 'CCB account should use its own opening auxiliary row');
      assertEqual(
        Number(balances.reduce((sum, balance) => sum + balance.openingBalance, 0).toFixed(2)),
        252_669.48,
        'public-account opening balances should reconcile to subject 1002'
      );
    }
  },
  {
    name: 'builds balanced opening trial balance for ledger initialization',
    run: () => {
      const summary = buildLedgerInitializationSummary();

      assertEqual(summary.accountingPeriod, '2026-06', 'ledger initialization should expose the enabled accounting period');
      assertEqual(summary.debitTotal, 275_669.48, 'opening debit total should match seeded trial balance');
      assertEqual(summary.creditTotal, 275_669.48, 'opening credit total should match seeded trial balance');
      assertEqual(summary.difference, 0, 'opening trial balance should be balanced');
      assertEqual(summary.status, '已启用', 'balanced enabled profile should stay enabled');
      assertEqual(summary.trialBalanceStatus, '平衡', 'balanced opening rows should expose balanced trial status');
      assertEqual(summary.isLocked, true, 'enabled account set should lock initialization settings');
      assertEqual(summary.completedStepCount, 5, 'enabled account set should complete all initialization steps');
      assertEqual(summary.requiredStepCount, 5, 'initialization workflow should expose five required steps');
      assertEqual(summary.openingBalanceCount, 12, 'opening balance count should match account-auxiliary opening rows');
    }
  },
  {
    name: 'builds initialization workflow steps for enabled and unbalanced states',
    run: () => {
      const enabledSteps = buildLedgerInitializationSteps('已启用');
      const pendingTrialSteps = buildLedgerInitializationSteps('期初已录入');
      const failedTrialSteps = buildLedgerInitializationSteps('试算不平');

      assertEqual(
        enabledSteps.every((step) => step.status === 'finish'),
        true,
        'enabled account set should mark every workflow step finished'
      );
      assertEqual(
        pendingTrialSteps.find((step) => step.key === 'trial-balance')?.status,
        'process',
        'opening rows should wait for an explicit trial-balance run before showing trial failure'
      );
      assertEqual(
        failedTrialSteps.find((step) => step.key === 'trial-balance')?.status,
        'error',
        'failed trial-balance result should mark trial-balance step as error'
      );
      assertEqual(
        failedTrialSteps.find((step) => step.key === 'enable')?.status,
        'wait',
        'failed trial-balance result should keep enable step waiting'
      );
    }
  },
  {
    name: 'requires explicit trial balance after opening-balance changes',
    run: () => {
      const pendingProfile = {
        ...ledgerInitializationDraftProfile,
        status: '期初已录入' as const,
        trialBalancedAt: '',
        trialBalancedBy: ''
      };
      const pendingSummary = buildLedgerInitializationSummary({ profile: pendingProfile });

      assertEqual(pendingSummary.status, '期初已录入', 'opening-balance changes should stay in recorded state before trial balance');
      assertEqual(pendingSummary.trialBalanceStatus, '待试算', 'opening-balance changes should require a new trial balance');
      assertEqual(pendingSummary.canEnable, false, 'pending trial balance should block account-set enablement');
    }
  },
  {
    name: 'blocks enablement when trial balance is not balanced',
    run: () => {
      const unbalancedSummary = buildLedgerInitializationSummary({
        openingBalanceRows: [
          {
            ...ledgerOpeningBalanceRows[0],
            debitAmount: ledgerOpeningBalanceRows[0].debitAmount + 1
          },
          ...ledgerOpeningBalanceRows.slice(1)
        ]
      });

      assertEqual(unbalancedSummary.status, '试算不平', 'unbalanced rows should override profile status');
      assertEqual(unbalancedSummary.trialBalanceStatus, '不平衡', 'unbalanced rows should expose unbalanced trial status');
      assertEqual(unbalancedSummary.canEnable, false, 'unbalanced rows should not be enableable');
      assertEqual(unbalancedSummary.isLocked, false, 'unbalanced initialization should not be locked as enabled');
    }
  },
  {
    name: 'blocks enablement when year-to-date trial balance is not balanced',
    run: () => {
      const unbalancedRows = [
        {
          ...ledgerOpeningBalanceRows[0],
          yearToDateDebitAmount: ledgerOpeningBalanceRows[0].yearToDateDebitAmount + 1
        },
        ...ledgerOpeningBalanceRows.slice(1)
      ];
      const summary = buildLedgerInitializationSummary({
        openingBalanceRows: unbalancedRows,
        profile: ledgerInitializationDraftProfile
      });
      const validation = validateLedgerOpeningBalances({ openingBalanceRows: unbalancedRows });

      assertEqual(summary.yearToDateDifference, 1, 'summary should expose year-to-date debit-credit difference');
      assertEqual(summary.status, '试算不平', 'year-to-date difference should mark initialization as unbalanced');
      assertEqual(summary.trialBalanceStatus, '不平衡', 'year-to-date difference should fail trial balance');
      assertEqual(summary.canEnable, false, 'year-to-date difference should block account-set enablement');
      assertEqual(
        validation.items.some((item) => item.id === 'year-to-date-trial-balance-difference' && item.blocking),
        true,
        'validation should expose a blocking year-to-date trial-balance issue'
      );
    }
  },
  {
    name: 'exposes general-ledger opening balances using signed normal-balance amounts',
    run: () => {
      const openingBalances = buildLedgerInitializationOpeningBalancesForGeneralLedger();
      const bankOpening = openingBalances.find((row) => row.subjectCode === '1002');
      const capitalOpening = openingBalances.find((row) => row.subjectCode === '3001');

      if (!bankOpening || !capitalOpening) {
        throw new Error('expected bank and capital opening balances');
      }

      assertEqual(
        openingBalances
          .filter((row) => row.subjectCode === '1002')
          .reduce((sum, row) => sum + row.amount, 0)
          .toFixed(2),
        '252669.48',
        'bank opening auxiliaries should reconcile to the subject balance'
      );
      assertEqual(capitalOpening.amount, 200_000, 'credit-nature capital opening should keep credit amount positive');
      assertEqual(bankOpening.source, '账套初始化', 'general ledger opening balance should expose ledger initialization source');
    }
  },
  {
    name: 'keeps draft initialization editable and out of general ledger',
    run: () => {
      const draftSummary = buildLedgerInitializationSummary({ profile: ledgerInitializationDraftProfile });
      const draftWorkspace = buildLedgerOpeningBalanceWorkspace({ profile: ledgerInitializationDraftProfile });
      const draftOpeningBalances = buildLedgerInitializationOpeningBalancesForGeneralLedger(
        ledgerOpeningBalanceRows,
        ledgerInitializationDraftProfile
      );

      assertEqual(draftSummary.status, '试算平衡', 'draft account set should expose trial-balanced state');
      assertEqual(draftSummary.isLocked, false, 'draft account set should stay editable before enablement');
      assertEqual(draftSummary.canEnable, true, 'trial-balanced draft should be enableable');
      assertEqual(draftWorkspace.canEditOpeningBalances, true, 'draft account set should allow opening-balance edits');
      assertEqual(draftWorkspace.canImportOpeningBalances, true, 'draft account set should allow opening-balance import');
      assertEqual(draftOpeningBalances.length, 0, 'general ledger should not consume non-enabled opening balances');
    }
  },
  {
    name: 'builds opening-balance import and validation workspace',
    run: () => {
      const workspace = buildLedgerOpeningBalanceWorkspace();

      assertEqual(workspace.entryStatus, '已锁定', 'enabled account set should lock opening-balance entry');
      assertEqual(workspace.importStatus, '已锁定', 'enabled account set should lock import actions');
      assertEqual(workspace.canEditOpeningBalances, false, 'locked account set should not allow manual opening-balance edits');
      assertEqual(workspace.canImportOpeningBalances, false, 'locked account set should not allow import');
      assertEqual(workspace.validation.status, '通过', 'seeded opening balances should pass validation');
      assertEqual(workspace.validation.blockingIssueCount, 0, 'seeded opening balances should have no blocking validation issue');
      assertEqual(workspace.importPreviewRows.length, 8, 'import preview should include rows originally applied from import');
    }
  },
  {
    name: 'keeps import application separate from final trial-balance validation',
    run: () => {
      const unbalancedRows = [
        {
          ...ledgerOpeningBalanceRows[0],
          debitAmount: ledgerOpeningBalanceRows[0].debitAmount + 100
        },
        ...ledgerOpeningBalanceRows.slice(1)
      ];
      const workspace = buildLedgerOpeningBalanceWorkspace({
        importBatch: ledgerOpeningBalanceDraftImportBatch,
        openingBalanceRows: unbalancedRows,
        profile: ledgerInitializationDraftProfile
      });
      const appliedRows = applyLedgerOpeningBalanceImportPreview({
        currentRows: unbalancedRows,
        importPreviewRows: workspace.importPreviewRows,
        profile: ledgerInitializationDraftProfile
      });

      assertEqual(workspace.validation.status, '需处理', 'unbalanced rows should still require trial-balance handling');
      assertEqual(workspace.importStatus, '待应用', 'trial-balance difference should not mark import preview as failed');
      assertEqual(workspace.canApplyImport, true, 'valid preview rows should remain applicable before final trial balance');
      assertEqual(appliedRows.length, unbalancedRows.length, 'import application should not depend on final trial balance');
    }
  },
  {
    name: 'allows year-to-date imbalance into draft but keeps enablement blocked',
    run: () => {
      const unbalancedRows = ledgerOpeningBalanceRows.map((row) =>
        row.entrySource === '系统承接' && row.subjectCode === '2211.01'
          ? { ...row, yearToDateDebitAmount: row.yearToDateDebitAmount + 100 }
          : row
      );
      const workspace = buildLedgerOpeningBalanceWorkspace({
        importBatch: ledgerOpeningBalanceDraftImportBatch,
        openingBalanceRows: unbalancedRows,
        profile: ledgerInitializationDraftProfile
      });
      const appliedRows = applyLedgerOpeningBalanceImportPreview({
        currentRows: unbalancedRows,
        importPreviewRows: workspace.importPreviewRows,
        profile: ledgerInitializationDraftProfile
      });
      const appliedSummary = buildLedgerInitializationSummary({
        openingBalanceRows: appliedRows,
        profile: ledgerInitializationDraftProfile
      });

      assertEqual(workspace.importStatus, '待应用', 'year-to-date difference should not invalidate an import preview');
      assertEqual(workspace.canApplyImport, true, 'structurally valid year-to-date rows should remain applicable');
      assertEqual(appliedSummary.canEnable, false, 'applied year-to-date imbalance should still block enablement');
    }
  },
  {
    name: 'builds an immutable subject snapshot for the enabled account set',
    run: () => {
      const source: AccountingSubjectRecord[] = accountingSubjectSeedRows.slice(0, 1).map((subject) => ({
        ...subject,
        auxiliaryScopes: [...subject.auxiliaryScopes],
        operationRecords: subject.operationRecords.map((record) => ({ ...record })),
        sourceLinks: [...subject.sourceLinks]
      }));
      const snapshot = buildLedgerInitializationSubjectSnapshot(source, '2026-06-30 10:00');

      source[0].auxiliaryScopes.push('项目');
      source[0].operationRecords[0].summary = '来源已修改';
      source[0].sourceLinks.push('后续来源');

      assertEqual(snapshot[0].snapshotAt, '2026-06-30 10:00', 'subject snapshot should preserve its confirmation time');
      assertEqual(snapshot[0].auxiliaryScopes.length, 1, 'subject snapshot should isolate auxiliary scopes');
      assertEqual(
        snapshot[0].operationRecords[0].summary,
        accountingSubjectSeedRows[0].operationRecords[0].summary,
        'subject snapshot should isolate operation records'
      );
      assertEqual(
        snapshot[0].sourceLinks.length,
        accountingSubjectSeedRows[0].sourceLinks.length,
        'subject snapshot should isolate source links'
      );
    }
  },
  {
    name: 'keeps import preview independent from manual opening-balance overrides',
    run: () => {
      const manualBankOverride = {
        ...ledgerOpeningBalanceRows[1],
        debitAmount: 100,
        entrySource: '手工录入' as const,
        id: 'ledger-opening-manual-bank'
      };
      const rowsWithManualBank = [ledgerOpeningBalanceRows[0], manualBankOverride, ...ledgerOpeningBalanceRows.slice(2)];
      const workspace = buildLedgerOpeningBalanceWorkspace({
        importBatch: ledgerOpeningBalanceDraftImportBatch,
        openingBalanceRows: rowsWithManualBank,
        profile: ledgerInitializationDraftProfile
      });
      const bankPreview = workspace.importPreviewRows.find((row) => row.subjectCode === '1002');

      if (!bankPreview) {
        throw new Error('expected bank import preview row after manual override');
      }

      assertEqual(bankPreview.importImpact, '覆盖', 'manual row with same subject and auxiliary should be marked as overwrite');
      assertEqual(bankPreview.previewStatus, '可应用', 'manual override should not remove import preview applicability');
    }
  },
  {
    name: 'allows multiple auxiliary balances for one subject and blocks only duplicate auxiliary identities',
    run: () => {
      const baseReceivable = ledgerOpeningBalanceRows.find((row) => row.subjectCode === '1122');

      if (!baseReceivable) {
        throw new Error('expected receivable opening balance');
      }

      const secondCustomer = {
        ...baseReceivable,
        auxiliaryId: 'customer-starry',
        auxiliaryLabel: '星河餐饮集团',
        id: 'ledger-opening-1122-customer-starry'
      };
      const valid = validateLedgerOpeningBalances({ openingBalanceRows: [...ledgerOpeningBalanceRows, secondCustomer] });
      const duplicate = validateLedgerOpeningBalances({
        openingBalanceRows: [...ledgerOpeningBalanceRows, { ...baseReceivable, id: 'ledger-opening-1122-duplicate' }]
      });

      assertEqual(
        valid.items.some((item) => item.id.startsWith('duplicate-opening-')),
        false,
        'different customer identities should coexist under receivables'
      );
      assertEqual(
        duplicate.items.some((item) => item.id.startsWith('duplicate-opening-')),
        true,
        'the same subject and auxiliary identity should be blocked as duplicate'
      );
    }
  },
  {
    name: 'builds controlled post-enablement action links',
    run: () => {
      const enabledActions = buildLedgerInitializationControlledActions();
      const unusedEnabledActions = buildLedgerInitializationControlledActions({
        context: {
          periodLocked: false,
          postedVoucherCount: 0
        }
      });
      const adjustedEnabledActions = buildLedgerInitializationControlledActions({
        context: {
          periodLocked: false,
          postedVoucherCount: 1
        }
      });
      const lockedEnabledActions = buildLedgerInitializationControlledActions({
        context: {
          periodLocked: true,
          postedVoucherCount: 0
        }
      });
      const draftActions = buildLedgerInitializationControlledActions({ profile: ledgerInitializationDraftProfile });
      const adjustmentAction = enabledActions.find((action) => action.key === 'opening-adjustment');
      const withdrawAction = enabledActions.find((action) => action.key === 'withdraw-enable');
      const unusedWithdrawAction = unusedEnabledActions.find((action) => action.key === 'withdraw-enable');
      const adjustedWithdrawAction = adjustedEnabledActions.find((action) => action.key === 'withdraw-enable');
      const lockedWithdrawAction = lockedEnabledActions.find((action) => action.key === 'withdraw-enable');
      const lockedAdjustmentAction = lockedEnabledActions.find((action) => action.key === 'opening-adjustment');

      if (!adjustmentAction || !withdrawAction || !unusedWithdrawAction || !adjustedWithdrawAction || !lockedWithdrawAction || !lockedAdjustmentAction) {
        throw new Error('expected controlled actions for ledger initialization');
      }

      assertEqual(withdrawAction.status, '受限', 'withdraw enablement should be restricted after booked vouchers exist');
      assertEqual(unusedWithdrawAction.status, '可发起', 'unused enabled account set should allow enablement withdrawal');
      assertEqual(adjustedWithdrawAction.status, '受限', 'opening adjustment voucher should restrict enablement withdrawal');
      assertEqual(adjustmentAction.status, '可发起', 'opening adjustment should be available after enablement');
      assertEqual(lockedWithdrawAction.status, '受限', 'closed enablement period should restrict enablement withdrawal');
      assertEqual(lockedAdjustmentAction.status, '可发起', 'a closed original period should still allow adjustment in a later open period');
      assertEqual(
        draftActions.every((action) => action.status === '未启用'),
        true,
        'draft account set should not expose post-enablement actions as executable'
      );
    }
  },
  {
    name: 'validates blocking opening-balance issues before enablement',
    run: () => {
      const invalidRows = [
        {
          ...ledgerOpeningBalanceRows[0],
          creditAmount: 1
        },
        {
          ...ledgerOpeningBalanceRows[1],
          subjectCode: '9999',
          subjectName: '不存在科目'
        },
        ...ledgerOpeningBalanceRows.slice(2)
      ];
      const validation = validateLedgerOpeningBalances({ openingBalanceRows: invalidRows });

      assertEqual(validation.status, '需处理', 'invalid opening balances should require handling');
      assertEqual(validation.blockingIssueCount > 0, true, 'invalid opening balances should produce blocking issues');
    }
  },
  {
    name: 'applies import preview only before account set is enabled',
    run: () => {
      const importPreviewRows = buildLedgerOpeningBalanceImportPreviewRows();
      const unlockedProfile = {
        ...ledgerInitializationProfile,
        enabledAt: '',
        enabledBy: '',
        status: '期初已录入' as const
      };
      const appliedRows = applyLedgerOpeningBalanceImportPreview({
        importPreviewRows,
        profile: unlockedProfile
      });

      assertEqual(appliedRows.length, ledgerOpeningBalanceRows.length, 'import preview should apply into full opening-balance draft');
      assertEqual(
        importPreviewRows.every((previewRow) =>
          appliedRows.some(
            (row) =>
              row.subjectCode === previewRow.subjectCode &&
              row.auxiliaryLabel === previewRow.auxiliaryLabel &&
              row.entrySource === '导入应用'
          )
        ),
        true,
        'applied import preview rows should preserve import entry source'
      );
      assertThrows(
        () => applyLedgerOpeningBalanceImportPreview({ importPreviewRows, profile: ledgerInitializationProfile }),
        'enabled account set should reject import application'
      );
    }
  },
  {
    name: 'filters ledger initialization opening rows by subject type and keyword',
    run: () => {
      const bankRow = ledgerOpeningBalanceRows.find((row) => row.subjectCode === '1002');
      const equityRows = ledgerOpeningBalanceRows.filter((row) =>
        matchesLedgerInitializationFilters(row, { ...defaultLedgerInitializationFilters, subjectType: '所有者权益类' })
      );
      const keywordRows = ledgerOpeningBalanceRows.filter((row) =>
        matchesLedgerInitializationFilters(row, { ...defaultLedgerInitializationFilters, keyword: '员工' })
      );

      if (!bankRow) {
        throw new Error('expected bank opening row');
      }

      assertEqual(ledgerInitializationProfile.accountingStandard, '小企业会计准则', 'profile should use small enterprise standard');
      assertEqual(
        matchesLedgerInitializationFilters(bankRow, { ...defaultLedgerInitializationFilters, keyword: '银行存款' }),
        true,
        'keyword should match subject name'
      );
      assertEqual(
        matchesLedgerInitializationFilters(bankRow, { ...defaultLedgerInitializationFilters, keyword: '导入应用' }),
        true,
        'keyword should match raw opening-balance entry source'
      );
      assertEqual(
        matchesLedgerInitializationFilters(bankRow, { ...defaultLedgerInitializationFilters, keyword: '导入录入' }),
        true,
        'keyword should match visible opening-balance entry source label'
      );
      assertEqual(equityRows.length, 2, 'subject type filter should keep equity opening rows');
      assertEqual(keywordRows.length, 2, 'keyword should match employee auxiliary opening rows');
    }
  }
];

export function runFinanceLedgerInitializationModelTests() {
  const failures: string[] = [];

  tests.forEach((test) => {
    try {
      test.run();
    } catch (error) {
      failures.push(`${test.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  return {
    failures,
    passed: tests.length - failures.length,
    total: tests.length
  };
}
