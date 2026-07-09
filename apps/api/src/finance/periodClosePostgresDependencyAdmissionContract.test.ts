import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  evaluatePeriodClosePostgresDependencyAdmission,
  runtimeEvidenceFromPeriodCloseOperationalGate,
  validatePeriodClosePostgresDependencyAdmission,
  type PeriodClosePostgresDependencyAdmissionResult,
  type PeriodClosePostgresPackageManifest,
  type PeriodClosePostgresRuntimeAdmissionEvidence
} from './periodClosePostgresDependencyAdmissionContract.js';
import { buildPeriodCloseMigrationOperationalGateContract } from './periodCloseMigrationOperationalGateContract.js';

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

function assertValid(result: PeriodClosePostgresDependencyAdmissionResult) {
  const errors = validatePeriodClosePostgresDependencyAdmission(result);

  assertEqual(errors.length, 0, `dependency admission should validate: ${errors.join('; ')}`);
}

const apiPackageManifestPath = 'apps/api/package.json';
const lockfilePath = 'pnpm-lock.yaml';
const baseManifest: PeriodClosePostgresPackageManifest = {
  name: '@startupmanage/api',
  dependencies: {},
  devDependencies: {
    typescript: '^6.0.3'
  }
};
const emptyLockfile = `
lockfileVersion: '11.0'
importers:
  apps/api:
    devDependencies:
      typescript:
        specifier: ^6.0.3
        version: 6.0.3
`;
const pgLockfile = `
lockfileVersion: '11.0'
importers:
  apps/api:
    dependencies:
      pg:
        specifier: ^8.13.1
        version: 8.13.1
packages:
  pg@8.13.1:
    resolution:
      integrity: sha512-local-fixture
`;
const readyRuntimeEvidence: PeriodClosePostgresRuntimeAdmissionEvidence = {
  backupRestoreEvidenceReady: true,
  formalMigrationApplyReady: true,
  productionApplyApproved: true,
  releaseRollbackOwnerReady: true,
  secretManagerRuntimeReady: true,
  targetDatabaseSelected: true
};
const blockedRuntimeEvidence: PeriodClosePostgresRuntimeAdmissionEvidence = {
  backupRestoreEvidenceReady: false,
  formalMigrationApplyReady: false,
  productionApplyApproved: false,
  releaseRollbackOwnerReady: false,
  secretManagerRuntimeReady: false,
  targetDatabaseSelected: false
};

function evaluate({
  lockfileText = emptyLockfile,
  manifest = baseManifest,
  runtimeEvidence = blockedRuntimeEvidence
}: {
  lockfileText?: string;
  manifest?: PeriodClosePostgresPackageManifest;
  runtimeEvidence?: PeriodClosePostgresRuntimeAdmissionEvidence;
} = {}) {
  return evaluatePeriodClosePostgresDependencyAdmission({
    apiPackageManifest: manifest,
    apiPackageManifestPath,
    lockfilePath,
    lockfileText,
    runtimeEvidence
  });
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function readCurrentWorkspaceAdmissionInput() {
  const maybeApiPackagePath = join(process.cwd(), 'package.json');
  const maybeApiPackage = readJsonFile<PeriodClosePostgresPackageManifest>(maybeApiPackagePath);
  const workspaceRoot = maybeApiPackage.name === '@startupmanage/api' ? join(process.cwd(), '..', '..') : process.cwd();
  const actualApiPackagePath =
    maybeApiPackage.name === '@startupmanage/api' ? maybeApiPackagePath : join(workspaceRoot, apiPackageManifestPath);
  const actualLockfilePath = join(workspaceRoot, lockfilePath);

  return {
    lockfileText: readFileSync(actualLockfilePath, 'utf8'),
    manifest: readJsonFile<PeriodClosePostgresPackageManifest>(actualApiPackagePath)
  };
}

const tests: UnitTest[] = [
  {
    name: 'keeps current package and lockfile admitted only up to operational blockers',
    run: () => {
      const current = readCurrentWorkspaceAdmissionInput();
      const operationalGate = buildPeriodCloseMigrationOperationalGateContract();
      const result = evaluate({
        lockfileText: current.lockfileText,
        manifest: current.manifest,
        runtimeEvidence: runtimeEvidenceFromPeriodCloseOperationalGate(operationalGate)
      });

      assertEqual(
        result.status,
        'blocked_by_operational_gates',
        'current package and lockfile should pass pg dependency gates but remain blocked operationally'
      );
      assert(
        result.gates.some((item) => item.gate === 'pg_runtime_dependency' && item.status === 'satisfied'),
        'current package should declare pg as runtime dependency'
      );
      assert(
        result.gates.some((item) => item.gate === 'pg_lockfile_entry' && item.status === 'satisfied'),
        'current lockfile should contain pg importer and package entries'
      );
      assertEqual(result.runtimeImportAllowed, false, 'runtime import must stay blocked before operational gates pass');
      assertValid(result);
    }
  },
  {
    name: 'blocks a fixture without pg runtime dependency declaration',
    run: () => {
      const result = evaluate();

      assertEqual(result.status, 'runtime_dependency_not_declared', 'missing pg dependency should block admission');
      assertEqual(result.runtimeImportAllowed, false, 'runtime import must stay blocked when pg is missing');
      assert(
        result.gates.some((item) => item.gate === 'pg_runtime_dependency' && item.status === 'blocked'),
        'pg runtime dependency gate should be blocked for missing dependency fixture'
      );
      assertValid(result);
    }
  },
  {
    name: 'rejects pg when it is only declared as a dev dependency',
    run: () => {
      const result = evaluate({
        manifest: {
          name: '@startupmanage/api',
          devDependencies: {
            pg: '^8.13.1',
            typescript: '^6.0.3'
          }
        },
        runtimeEvidence: readyRuntimeEvidence
      });

      assertEqual(
        result.status,
        'runtime_dependency_misclassified',
        'pg must be declared as an API runtime dependency'
      );
      assert(
        result.traceErrors.some((error) => error.includes('runtime dependency')),
        'misclassified dependency should explain runtime dependency requirement'
      );
    }
  },
  {
    name: 'blocks when pg is in manifest but not in the lockfile',
    run: () => {
      const result = evaluate({
        manifest: {
          name: '@startupmanage/api',
          dependencies: {
            pg: '^8.13.1'
          }
        },
        runtimeEvidence: readyRuntimeEvidence
      });

      assertEqual(result.status, 'lockfile_missing', 'manifest-only pg declaration should require lockfile evidence');
      assertEqual(result.runtimeImportAllowed, false, 'runtime import must stay blocked without lockfile evidence');
      assertValid(result);
    }
  },
  {
    name: 'blocks lockfile-only drift without package manifest declaration',
    run: () => {
      const result = evaluate({
        lockfileText: pgLockfile,
        runtimeEvidence: readyRuntimeEvidence
      });

      assertEqual(result.status, 'manifest_lock_mismatch', 'lockfile-only pg drift should be rejected');
      assert(
        result.traceErrors.some((error) => error.includes('without @startupmanage/api runtime dependency')),
        'lockfile-only drift should be visible in trace errors'
      );
      assertEqual(result.runtimeImportAllowed, false, 'runtime import must stay blocked for manifest/lock mismatch');
    }
  },
  {
    name: 'keeps pg dependency blocked until operational evidence gates pass',
    run: () => {
      const result = evaluate({
        lockfileText: pgLockfile,
        manifest: {
          name: '@startupmanage/api',
          dependencies: {
            pg: '^8.13.1'
          }
        }
      });

      assertEqual(
        result.status,
        'blocked_by_operational_gates',
        'dependency and lockfile are not enough for real runtime admission'
      );
      assert(
        result.gates.some((item) => item.gate === 'target_database_selection' && item.status === 'blocked'),
        'target database selection should still block admission'
      );
      assertEqual(result.runtimeImportAllowed, false, 'runtime import must stay blocked before operational gates pass');
      assertValid(result);
    }
  },
  {
    name: 'admits pg runtime only when dependency, lockfile, and operational gates pass',
    run: () => {
      const result = evaluate({
        lockfileText: pgLockfile,
        manifest: {
          name: '@startupmanage/api',
          dependencies: {
            pg: '^8.13.1'
          }
        },
        runtimeEvidence: readyRuntimeEvidence
      });

      assertEqual(result.status, 'admitted', 'complete evidence should admit real postgres runtime');
      assertEqual(result.runtimeImportAllowed, true, 'runtime import should be allowed only for admitted state');
      assertValid(result);
    }
  },
  {
    name: 'derives current operational gate as blocked and without secret/runtime readiness',
    run: () => {
      const operationalGate = buildPeriodCloseMigrationOperationalGateContract();
      const evidence = runtimeEvidenceFromPeriodCloseOperationalGate(operationalGate);
      const result = evaluate({
        lockfileText: pgLockfile,
        manifest: {
          name: '@startupmanage/api',
          dependencies: {
            pg: '^8.13.1'
          }
        },
        runtimeEvidence: evidence
      });

      assertEqual(
        result.status,
        'blocked_by_operational_gates',
        'current migration operational gate should keep real postgres runtime blocked'
      );
      assertEqual(evidence.secretManagerRuntimeReady, false, 'current gate should not claim secret manager runtime');
      assertEqual(evidence.formalMigrationApplyReady, false, 'current gate should not claim formal migration apply');
      assertEqual(result.runtimeImportAllowed, false, 'runtime import must stay blocked from current operational gate');
      assertValid(result);
    }
  }
];

for (const test of tests) {
  test.run();
}
