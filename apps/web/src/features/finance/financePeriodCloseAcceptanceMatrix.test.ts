import {
  financePeriodCloseAcceptanceFlowSteps,
  financePeriodCloseCheckAcceptanceMatrix,
  financePeriodCloseExceptionAcceptanceMatrix,
  financePeriodCloseFrontendStandards
} from './financePeriodCloseAcceptanceMatrix';
import { financePeriodCloseSourceMutationAreas } from './financePeriodCloseSourceMutationMatrix';

type UnitTest = {
  name: string;
  run: () => void;
};

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertSetEqual(actual: Iterable<string>, expected: Iterable<string>, message: string) {
  const actualItems = [...new Set(actual)].sort();
  const expectedItems = [...new Set(expected)].sort();

  assertEqual(actualItems.join('|'), expectedItems.join('|'), message);
}

const requiredFlowStepIds = [
  'source-receivable-payable',
  'invoice-or-tax-basis',
  'cash-flow-created',
  'cash-flow-reviewed',
  'bank-reconciled',
  'voucher-candidate-generated',
  'voucher-booked',
  'source-prerequisites-complete',
  'general-ledger-balanced',
  'social-insurance-complete',
  'close-checks-passed',
  'prior-period-closed',
  'period-close-confirmed',
  'closed-period-mutation-blocked',
  'closed-period-report-readback'
];

const requiredCheckCodes = [
  'month_end_matters',
  'voucher_preparation',
  'voucher_booking',
  'general_ledger_trial_balance',
  'cash_review',
  'cash_reconciliation',
  'social_insurance_housing_fund'
];

const tests: UnitTest[] = [
  {
    name: 'keeps the industrial period-close acceptance flow ordered and complete',
    run: () => {
      assertEqual(financePeriodCloseAcceptanceFlowSteps.length, 15, 'acceptance flow should keep the 15-step accounting-close workflow');
      assertSetEqual(
        financePeriodCloseAcceptanceFlowSteps.map((step) => step.id),
        requiredFlowStepIds,
        'acceptance flow should cover every documented main-flow step'
      );

      financePeriodCloseAcceptanceFlowSteps.forEach((step, index) => {
        assertEqual(step.order, index + 1, `acceptance flow step ${step.id} should keep a stable order`);
        assert(step.ownerModule.length > 0, `${step.id} should declare an owner module`);
        assert(step.ownerRoute.startsWith('/'), `${step.id} should declare an owner route`);
        assert(step.currentEvidence.length > 0, `${step.id} should declare current evidence`);
        assert(step.formalBackendGap.length > 0, `${step.id} should keep the formal backend gap visible`);
      });
    }
  },
  {
    name: 'keeps frontend close-check coverage aligned with the canonical check groups',
    run: () => {
      assertSetEqual(
        financePeriodCloseCheckAcceptanceMatrix.map((item) => item.code),
        requiredCheckCodes,
        'close-check acceptance matrix should cover every canonical check group'
      );

      const routedChecks = financePeriodCloseCheckAcceptanceMatrix.filter(
        (item) => item.sourceActionPolicy === 'navigate_when_blocked'
      );
      const readOnlyChecks = financePeriodCloseCheckAcceptanceMatrix.filter(
        (item) => item.sourceActionPolicy === 'read_only_no_action'
      );

      assert(
        routedChecks.every((item) => Boolean(item.ownerRoute?.startsWith('/'))),
        'blocked checks with navigation policy should declare a real owner route'
      );
      assertEqual(readOnlyChecks.length, 0, 'canonical close checks should not be permanently read-only when a source route is known');
      assertEqual(
        financePeriodCloseCheckAcceptanceMatrix.some((item) => item.title === '报表准备'),
        false,
        'financial-statement readiness should stay in period-close carryover information rather than the blocking check matrix'
      );
    }
  },
  {
    name: 'covers closed-period source-mutation exceptions for every guarded source area',
    run: () => {
      const coveredAreas = new Set(
        financePeriodCloseExceptionAcceptanceMatrix
          .flatMap((scenario) => (scenario.sourceMutationArea ? [scenario.sourceMutationArea] : []))
      );

      assertSetEqual(
        coveredAreas,
        financePeriodCloseSourceMutationAreas,
        'closed-period exception matrix should cover all guarded source mutation areas'
      );
      assert(
        financePeriodCloseExceptionAcceptanceMatrix.some((scenario) => scenario.id === 'later-period-adjustment-is-default'),
        'exception matrix should keep later-period adjustment as the default correction path'
      );
      assert(
        financePeriodCloseExceptionAcceptanceMatrix.some((scenario) => scenario.id === 'reopen-is-exceptional'),
        'exception matrix should keep reopen/reverse-close as an exceptional path'
      );
      assert(
        financePeriodCloseExceptionAcceptanceMatrix.some((scenario) => scenario.id === 'prior-period-unclosed-blocks-close'),
        'exception matrix should keep prior-period close as a prerequisite for later periods'
      );
    }
  },
  {
    name: 'keeps current evidence scoped below backend readiness',
    run: () => {
      const unsupportedLevels = new Set(['backend_implemented', 'production_ready', 'release_ready']);

      financePeriodCloseAcceptanceFlowSteps.forEach((step) => {
        assert(!unsupportedLevels.has(step.currentEvidenceLevel), `${step.id} should not claim backend or production readiness`);
        assert(
          step.formalBackendGap.includes('缺') || step.formalBackendGap.includes('仍缺'),
          `${step.id} should state the missing formal evidence`
        );
      });
    }
  },
  {
    name: 'keeps frontend standards focused on check and lock presentation',
    run: () => {
      assertEqual(financePeriodCloseFrontendStandards.length, 9, 'frontend standards should track the documented UI acceptance rules');
      assert(
        financePeriodCloseFrontendStandards.some((standard) => standard.id === 'page-is-check-workbench'),
        'frontend standards should keep period close as a check workbench'
      );
      assert(
        financePeriodCloseFrontendStandards.some((standard) => standard.id === 'frontend-disable-is-not-security'),
        'frontend standards should keep the non-security boundary visible'
      );
      assert(
        financePeriodCloseFrontendStandards.some((standard) => standard.id === 'continuous-period-close'),
        'frontend standards should keep continuous period closing visible'
      );
      assert(
        financePeriodCloseFrontendStandards.some((standard) => standard.id === 'sequence-exception-reopen'),
        'frontend standards should keep the sequence-exception reopen path visible'
      );
      assert(
        financePeriodCloseFrontendStandards.every((standard) => standard.currentEvidence.length > 0),
        'frontend standards should point to current evidence'
      );
    }
  }
];

export function runFinancePeriodCloseAcceptanceMatrixTests() {
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
