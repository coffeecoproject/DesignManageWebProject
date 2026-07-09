import {
  buildPeriodCloseMigrationOperationalGateContract,
  validatePeriodCloseMigrationOperationalGateContract,
  type PeriodCloseMigrationOperationalGateContract
} from './periodCloseMigrationOperationalGateContract.js';

type UnitTest = {
  name: string;
  run: () => void;
};

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function cloneContract(
  contract: PeriodCloseMigrationOperationalGateContract
): PeriodCloseMigrationOperationalGateContract {
  return JSON.parse(JSON.stringify(contract)) as PeriodCloseMigrationOperationalGateContract;
}

const tests: UnitTest[] = [
  {
    name: 'builds operational gates that keep formal migration apply blocked',
    run: () => {
      const contract = buildPeriodCloseMigrationOperationalGateContract();
      const errors = validatePeriodCloseMigrationOperationalGateContract(contract);

      assertEqual(errors.length, 0, `operational gate contract should validate: ${errors.join('; ')}`);
      assertEqual(
        contract.operationalReadiness,
        'blocked_by_operational_gates',
        'operational gates must not claim formal apply readiness'
      );
      assertEqual(
        contract.targetDatabaseSelection.status,
        'not_selected',
        'target database must remain unselected in local evidence'
      );
      assertEqual(
        contract.backupRestorePlan.status,
        'not_started',
        'backup and restore plan must remain not started'
      );
      assertEqual(
        contract.ownership.releaseOwnerStatus,
        'not_started',
        'release owner must remain not started'
      );
      assertEqual(
        contract.productionApplyApproval.status,
        'not_started',
        'production apply approval must remain not started'
      );
      assert(
        contract.forbiddenBeforeOperationalApproval.includes('formal_schema_apply'),
        'formal schema apply should be forbidden before operational approval'
      );
    }
  },
  {
    name: 'rejects selecting a concrete target database in local evidence',
    run: () => {
      const contract = cloneContract(buildPeriodCloseMigrationOperationalGateContract());
      const unsafeContract = {
        ...contract,
        targetDatabaseSelection: {
          ...contract.targetDatabaseSelection,
          connectionStringRef: 'DATABASE_URL',
          selectedEnvironment: 'production',
          status: 'selected',
          targetDatabaseIdentifier: 'startupmanage-prod'
        }
      } as unknown as PeriodCloseMigrationOperationalGateContract;
      const errors = validatePeriodCloseMigrationOperationalGateContract(unsafeContract);

      assert(
        errors.some((error) => error.includes('target database selection must remain not_selected')),
        'validator should reject selected target database status'
      );
      assert(
        errors.some((error) => error.includes('must not name a concrete database')),
        'validator should reject target database identifiers'
      );
      assert(
        errors.some((error) => error.includes('connection string or secret references')),
        'validator should reject connection string references'
      );
    }
  },
  {
    name: 'rejects claiming backup or restore approval without real evidence',
    run: () => {
      const contract = cloneContract(buildPeriodCloseMigrationOperationalGateContract());
      const unsafeContract = {
        ...contract,
        backupRestorePlan: {
          ...contract.backupRestorePlan,
          approvedBy: 'operations-lead',
          backupEvidenceRef: 'backup://2026-07-05',
          backupPlanStatus: 'local_passed',
          restoreDrillEvidenceRef: 'restore-drill://2026-07-05',
          restoreDrillStatus: 'local_passed',
          status: 'local_passed'
        }
      } as unknown as PeriodCloseMigrationOperationalGateContract;
      const errors = validatePeriodCloseMigrationOperationalGateContract(unsafeContract);

      assert(
        errors.some((error) => error.includes('backup and restore gates must remain not_started')),
        'validator should reject backup/restore status claims'
      );
      assert(
        errors.some((error) => error.includes('must not claim approval or evidence')),
        'validator should reject backup/restore evidence claims'
      );
    }
  },
  {
    name: 'rejects claiming release or rollback owner assignment without evidence',
    run: () => {
      const contract = cloneContract(buildPeriodCloseMigrationOperationalGateContract());
      const unsafeContract = {
        ...contract,
        ownership: {
          ...contract.ownership,
          releaseOwner: 'engineering-lead',
          releaseOwnerStatus: 'local_passed',
          rollbackOwner: 'operations-lead',
          rollbackOwnerStatus: 'local_passed'
        }
      } as unknown as PeriodCloseMigrationOperationalGateContract;
      const errors = validatePeriodCloseMigrationOperationalGateContract(unsafeContract);

      assert(
        errors.some((error) => error.includes('release and rollback owner gates must remain not_started')),
        'validator should reject owner status claims'
      );
      assert(
        errors.some((error) => error.includes('must not name owners')),
        'validator should reject owner names without formal assignment evidence'
      );
    }
  },
  {
    name: 'rejects production approval and formal apply readiness drift',
    run: () => {
      const contract = cloneContract(buildPeriodCloseMigrationOperationalGateContract());
      const unsafeContract = {
        ...contract,
        formalApplyReview: {
          ...contract.formalApplyReview,
          formalApplyReadiness: 'ready_for_apply',
          checklist: contract.formalApplyReview.checklist.map((item) =>
            item.id === 'production_apply_approval_required'
              ? {
                  ...item,
                  status: 'local_passed'
                }
              : item
          )
        },
        operationalReadiness: 'ready_for_apply',
        productionApplyApproval: {
          ...contract.productionApplyApproval,
          approvedBy: 'finance-controller',
          approvalEvidenceRef: 'approval://period-close-production-apply',
          status: 'local_passed'
        }
      } as unknown as PeriodCloseMigrationOperationalGateContract;
      const errors = validatePeriodCloseMigrationOperationalGateContract(unsafeContract);

      assert(
        errors.some((error) => error.includes('must remain blocked')),
        'validator should reject formal apply readiness drift'
      );
      assert(
        errors.some((error) => error.includes('production_apply_approval_required')),
        'validator should reject production checklist approval drift'
      );
      assert(
        errors.some((error) => error.includes('production apply approval must remain not_started')),
        'validator should reject production approval status claims'
      );
      assert(
        errors.some((error) => error.includes('must not claim approver or approval evidence')),
        'validator should reject production approval evidence claims'
      );
    }
  }
];

for (const test of tests) {
  test.run();
}
