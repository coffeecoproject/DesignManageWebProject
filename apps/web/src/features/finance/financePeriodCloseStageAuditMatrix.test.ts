import {
  financePeriodCloseCurrentExecutionTrack,
  financePeriodCloseStageAuditMatrix,
  type FinancePeriodCloseStageId
} from './financePeriodCloseStageAuditMatrix';

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

const requiredStageIds: FinancePeriodCloseStageId[] = [
  'phase_0_decision_contract',
  'phase_1_backend_close_checks',
  'phase_2_persistent_period_lock',
  'phase_3_source_mutation_lock',
  'phase_4_accounting_voucher_lifecycle',
  'phase_5_source_readiness_checks',
  'phase_6_reopen_and_later_adjustment',
  'phase_7_financial_statement_carryover',
  'phase_8_release_recovery_governance'
];

const tests: UnitTest[] = [
  {
    name: 'covers every industrial period-close execution phase in order',
    run: () => {
      assertEqual(financePeriodCloseStageAuditMatrix.length, 9, 'stage audit should cover phases 0 through 8');
      assertSetEqual(
        financePeriodCloseStageAuditMatrix.map((entry) => entry.id),
        requiredStageIds,
        'stage audit should cover every documented phase id'
      );

      financePeriodCloseStageAuditMatrix.forEach((entry, index) => {
        assertEqual(entry.order, index, `${entry.id} should keep its phase order`);
        assert(entry.stage.includes(`阶段 ${index}`), `${entry.id} should keep the visible phase label`);
      });
    }
  },
  {
    name: 'does not claim formal completion before backend database and release evidence exist',
    run: () => {
      assert(
        financePeriodCloseStageAuditMatrix.every((entry) => entry.formalCompletion === 'not_formally_complete'),
        'every stage should remain formally incomplete until backend/database/release evidence is present'
      );
      assert(
        financePeriodCloseStageAuditMatrix.every((entry) => entry.blockers.length > 0),
        'every stage should keep explicit blockers visible'
      );
      assert(
        financePeriodCloseStageAuditMatrix.every((entry) =>
          entry.blockers.some((blocker) =>
            blocker.includes('缺') || blocker.includes('未') || blocker.includes('仍需')
          )
        ),
        'every stage should include a missing-evidence blocker'
      );
    }
  },
  {
    name: 'keeps backend dependent phases behind evidence gates',
    run: () => {
      const backendDependentPhaseIds: FinancePeriodCloseStageId[] = [
        'phase_1_backend_close_checks',
        'phase_2_persistent_period_lock',
        'phase_3_source_mutation_lock',
        'phase_4_accounting_voucher_lifecycle',
        'phase_6_reopen_and_later_adjustment',
        'phase_7_financial_statement_carryover',
        'phase_8_release_recovery_governance'
      ];

      backendDependentPhaseIds.forEach((phaseId) => {
        const entry = financePeriodCloseStageAuditMatrix.find((item) => item.id === phaseId);

        if (!entry) {
          throw new Error(`missing ${phaseId}`);
        }

        assert(entry.gateClasses.includes('evidence_gate'), `${phaseId} should be blocked by evidence gate`);
        assert(
          entry.blockers.some((blocker) => blocker.includes('真实') || blocker.includes('数据库') || blocker.includes('生产') || blocker.includes('后端')),
          `${phaseId} should name a backend/database/production evidence gap`
        );
      });
    }
  },
  {
    name: 'keeps phase statuses within current frontend local-contract boundary',
    run: () => {
      const statuses = new Set(financePeriodCloseStageAuditMatrix.map((entry) => entry.status));

      assert(statuses.has('frontend_governance_satisfied'), 'phase 0 should be governance-satisfied only');
      assert(statuses.has('frontend_prototype_partial'), 'frontend prototype phases should remain partial');
      assert(statuses.has('local_contract_partial'), 'local contract phases should remain partial');
      assert(statuses.has('documented_gap'), 'release/recovery phase should stay a documented gap');
      assert(
        ![...statuses].some((status) => status.includes('complete') || status.includes('ready')),
        'stage statuses should not use complete or ready wording'
      );
    }
  },
  {
    name: 'keeps the current execution track on local backend contracts and defers production implementation',
    run: () => {
      assertEqual(
        financePeriodCloseCurrentExecutionTrack.id,
        'local_backend_contract_hardening',
        'current execution track should stay on local backend contract hardening'
      );
      assert(
        financePeriodCloseCurrentExecutionTrack.activeScope.every((scope) => scope.includes('本地') || scope.includes('row-backed')),
        'active execution scope should describe local backend contract work only'
      );
      assert(
        financePeriodCloseCurrentExecutionTrack.deferredScope.some((scope) => scope.includes('生产')),
        'production HTTP/API concerns should stay deferred in the current round'
      );
      assert(
        financePeriodCloseCurrentExecutionTrack.deferredScope.some((scope) => scope.includes('数据库')),
        'real database period locks should stay deferred in the current round'
      );
      assert(
        financePeriodCloseCurrentExecutionTrack.activeScope.some((scope) => scope.includes('service runtime admission')),
        'current local contract track should include project service runtime admission coverage'
      );
      assert(
        financePeriodCloseStageAuditMatrix
          .filter((entry) =>
            entry.id === 'phase_1_backend_close_checks' ||
            entry.id === 'phase_2_persistent_period_lock' ||
            entry.id === 'phase_3_source_mutation_lock'
          )
          .every((entry) =>
            entry.nextAction.includes('生产') ||
            entry.nextAction.includes('真实') ||
            entry.nextAction.includes('DB') ||
            entry.nextAction.includes('migration') ||
            entry.nextAction.includes('数据库') ||
            entry.nextAction.includes('事务') ||
            entry.nextAction.includes('集成')
          ),
        'backend-dependent phases should keep production, database, or real-integration gaps visible'
      );
    }
  },
  {
    name: 'keeps project service runtime admission evidence attached to phases 1 through 3',
    run: () => {
      const admissionEvidencePath =
        'apps/api/src/finance/financeHttpPostgresManagedProjectServiceRuntimeAdmissionContract.ts';
      const secretProviderEvidencePath =
        'apps/api/src/finance/periodCloseManagedSecretProviderReadinessContract.ts';
      const implementationManifestEvidencePath =
        'apps/api/src/finance/periodClosePostgresRuntimeImplementationManifestContract.ts';
      const implementationBundleEvidencePath =
        'apps/api/src/finance/periodClosePostgresRuntimeImplementationBundleContract.ts';

      ([
        'phase_1_backend_close_checks',
        'phase_2_persistent_period_lock',
        'phase_3_source_mutation_lock'
      ] satisfies FinancePeriodCloseStageId[]).forEach((phaseId) => {
        const entry = financePeriodCloseStageAuditMatrix.find((item) => item.id === phaseId);

        if (!entry) {
          throw new Error(`missing ${phaseId}`);
        }

        assert(
          entry.currentEvidence.includes(admissionEvidencePath),
          `${phaseId} should include project service runtime admission evidence`
        );
        assert(
          entry.currentEvidence.includes(secretProviderEvidencePath),
          `${phaseId} should include managed secret provider readiness evidence`
        );
        assert(
          entry.currentEvidence.includes(implementationManifestEvidencePath),
          `${phaseId} should include runtime implementation manifest evidence`
        );
        assert(
          entry.currentEvidence.includes(implementationBundleEvidencePath),
          `${phaseId} should include runtime implementation bundle evidence`
        );
      });
    }
  },
  {
    name: 'keeps each phase tied to current evidence and next action',
    run: () => {
      financePeriodCloseStageAuditMatrix.forEach((entry) => {
        assert(entry.currentEvidence.length > 0, `${entry.id} should list current evidence`);
        assert(
          entry.currentEvidence.every(
            (path) => path.startsWith('apps/') || path.startsWith('docs/') || path.startsWith('scripts/')
          ),
          `${entry.id} evidence should point to workspace files`
        );
        assert(entry.nextAction.length > 0, `${entry.id} should declare a next action`);
      });
    }
  }
];

export function runFinancePeriodCloseStageAuditMatrixTests() {
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
