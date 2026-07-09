import type {
  FinanceHttpPostgresManagedProjectServiceProcessBootstrapContract,
  FinanceHttpPostgresManagedProjectServiceProcessBootstrapInput,
  FinanceHttpPostgresManagedProjectServiceProcessHandle,
  FinanceHttpPostgresManagedProjectServiceProcessShutdownResult,
} from './financeHttpPostgresManagedProjectServiceProcessBootstrapContract.js';
import {
  createFinanceHttpPostgresManagedProjectServiceProcessRuntimeContract,
  type FinanceHttpPostgresManagedProjectServiceProcessRuntimeEventName,
  type FinanceHttpPostgresManagedProjectServiceProcessRuntimeManifest,
} from './financeHttpPostgresManagedProjectServiceProcessRuntimeContract.js';
import type {
  PeriodClosePostgresRuntimeImplementationBundleDescriptor,
} from './periodClosePostgresRuntimeImplementationBundleContract.js';

type UnitTest = {
  name: string;
  run: () => Promise<void> | void;
};

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertDeepEqual<T>(actual: T, expected: T, message: string) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);

  if (actualJson !== expectedJson) {
    throw new Error(`${message}. Expected ${expectedJson}, got ${actualJson}`);
  }
}

function assertIncludes(actual: string, expected: string, message: string) {
  if (!actual.includes(expected)) {
    throw new Error(`${message}. Expected ${expected} in ${actual}`);
  }
}

async function assertRejectsIncludes(input: {
  expected: string;
  message: string;
  run: () => Promise<unknown>;
}) {
  try {
    await input.run();
  } catch (error) {
    assertIncludes(error instanceof Error ? error.message : String(error), input.expected, input.message);

    return;
  }

  throw new Error(`${input.message}. Expected rejection containing ${input.expected}.`);
}

const baseManifest: FinanceHttpPostgresManagedProjectServiceProcessRuntimeManifest = {
  appName: 'startupmanage-finance-api',
  exposesProductionTraffic: false,
  healthPath: '/healthz',
  mode: 'local_contract',
  processName: 'finance-period-close-api-service-process',
  readinessPath: '/readyz',
  shutdownTimeoutMs: 5000,
  signals: {
    SIGINT: 'graceful',
    SIGTERM: 'graceful',
  },
  supervisor: 'local_contract',
};

function createRuntimeImplementationBundle(): PeriodClosePostgresRuntimeImplementationBundleDescriptor {
  return {
    managedServicePoolRuntimeModulePath: 'apps/api/src/finance/periodClosePostgresManagedServicePoolRuntimeContract.ts',
    poolConfig: {
      applicationName: 'startupmanage-period-close-local',
      connectionTimeoutMs: 1000,
      databaseUrl: 'postgres://localhost:5432/startupmanage_local',
      environment: 'local',
      idleTimeoutMs: 10000,
      maxConnections: 4,
      passwordSecretRef: 'secret://finance/period-close/postgres-password',
      sslMode: 'disable',
      statementTimeoutMs: 5000,
    },
    repositoryBindings: {
      periodLockRepository: {
        evidenceId: 'local-sql-runtime-repository-evidence-20260705',
        implementation: 'sql_repository_runtime',
        migrationArtifactPath: 'migrations/20260705_period_close_persistent_lock.sql',
        modulePath: 'apps/api/src/finance/periodCloseSqlRepositoryContract.ts',
        transactionBoundary: 'managed_postgres_transaction',
      },
      sourceMutationRepository: {
        evidenceId: 'local-sql-runtime-repository-evidence-20260705',
        implementation: 'sql_repository_runtime',
        migrationArtifactPath: 'migrations/20260705_period_close_persistent_lock.sql',
        modulePath: 'apps/api/src/finance/periodCloseSourceTableSqlRepositoryContract.ts',
        transactionBoundary: 'managed_postgres_transaction',
      },
      voucherLedgerRepository: {
        evidenceId: 'local-sql-runtime-repository-evidence-20260705',
        implementation: 'sql_repository_runtime',
        migrationArtifactPath: 'migrations/20260705_period_close_persistent_lock.sql',
        modulePath: 'apps/api/src/finance/accountingVoucherLedgerRepositoryContract.ts',
        transactionBoundary: 'managed_postgres_transaction',
      },
    },
    runtimeImportModulePath: 'apps/api/src/finance/periodClosePostgresRuntimeImportContract.ts',
    serviceRuntimeAdmissionEvidenceId: 'local-project-service-runtime-admission-evidence-20260705',
    sourceMutationBridgeModulePath: 'apps/api/src/finance/financeHttpPostgresManagedSourceMutationBridgeContract.ts',
  };
}

function createBootstrapShutdownResult(requestId: string): FinanceHttpPostgresManagedProjectServiceProcessShutdownResult {
  return {
    nodeServerShutdown: {
      httpServerClosed: true,
      processShutdown: {
        lifecycleState: 'closed',
        processTrace: [],
        runtimeShutdown: {
          events: [],
          poolLifecycleState: 'closed',
          requestId,
          shutdownErrors: [],
          status: 'closed',
          traceErrors: [],
          transactionId: `${requestId}-tx`,
        },
      },
    },
    processTrace: [],
    serviceProcessClosed: true,
  };
}

function createFakeBootstrap({
  runtimeBundleEvidenceId = 'local-project-service-runtime-admission-evidence-20260705',
}: {
  runtimeBundleEvidenceId?: string;
} = {}) {
  const bootstrapInputs: FinanceHttpPostgresManagedProjectServiceProcessBootstrapInput[] = [];
  const shutdownRequests: string[] = [];
  const bootstrap: FinanceHttpPostgresManagedProjectServiceProcessBootstrapContract = {
    bootstrap: async (input) => {
      bootstrapInputs.push(input);

      const handle: FinanceHttpPostgresManagedProjectServiceProcessHandle = {
        origin: 'http://127.0.0.1:53221',
        readProcessEvents: () => [],
        shutdown: async ({ requestId = 'fake-bootstrap-shutdown' } = {}) => {
          shutdownRequests.push(requestId);

          return createBootstrapShutdownResult(requestId);
        },
        summary: {
          host: input.host ?? '127.0.0.1',
          mode: input.mode,
          origin: 'http://127.0.0.1:53221',
          port: 53221,
          processName: input.processName ?? 'finance-period-close-api-service-process',
          productionServiceBound: false,
          runtimeBundleEvidenceId,
          runtimeNodeServerLifecycleState: 'active',
        },
      };

      return handle;
    },
  };

  return {
    bootstrap,
    bootstrapInputs,
    shutdownRequests,
  };
}

function eventNames(events: Array<{ event: FinanceHttpPostgresManagedProjectServiceProcessRuntimeEventName }>) {
  return events.map((event) => event.event);
}

const tests: UnitTest[] = [
  {
    name: 'starts local service runtime, exposes probes, and shuts down in graceful order',
    run: async () => {
      const fakeBootstrap = createFakeBootstrap();
      const runtime = createFinanceHttpPostgresManagedProjectServiceProcessRuntimeContract({
        bootstrap: fakeBootstrap.bootstrap,
      });

      const handle = await runtime.start({
        bootstrapInput: {
          envSnapshot: {
            FINANCE_DATABASE_PASSWORD: 'secret://finance/local/period-close/password',
          },
          host: '127.0.0.1',
          port: 53221,
        },
        manifest: baseManifest,
        requestId: 'runtime-start-001',
        runtimeImplementationBundle: createRuntimeImplementationBundle(),
      });

      assertEqual(fakeBootstrap.bootstrapInputs.length, 1, 'Runtime should call bootstrap once');
      assertEqual(
        fakeBootstrap.bootstrapInputs[0]?.processName,
        baseManifest.processName,
        'Runtime should pass manifest processName to bootstrap',
      );
      assertEqual(fakeBootstrap.bootstrapInputs[0]?.mode, 'local_contract', 'Runtime should pass manifest mode to bootstrap');
      assertEqual(handle.origin, 'http://127.0.0.1:53221', 'Runtime should expose bootstrap origin');
      assertEqual(
        handle.summary.runtimeImplementationBundle.serviceRuntimeAdmissionEvidenceId,
        'local-project-service-runtime-admission-evidence-20260705',
        'Runtime summary should carry service runtime admission bundle evidence',
      );
      assertEqual(
        handle.summary.runtimeBundleEvidenceId,
        'local-project-service-runtime-admission-evidence-20260705',
        'Runtime summary should preserve bootstrap runtime bundle evidence id',
      );

      const health = handle.health({ requestId: 'health-001' });
      const readiness = handle.readiness({ requestId: 'ready-001' });

      assertEqual(health.status, 'healthy', 'Ready runtime health probe should be healthy');
      assertEqual(readiness.status, 'ready', 'Ready runtime readiness probe should be ready');
      assertEqual(readiness.productionReady, false, 'Local runtime readiness must not claim production readiness');
      assertEqual(
        readiness.runtimeImplementationBundle?.runtimeImportModulePath,
        'apps/api/src/finance/periodClosePostgresRuntimeImportContract.ts',
        'Readiness probe should carry runtime import bundle evidence',
      );

      const shutdown = await handle.shutdown({ requestId: 'runtime-shutdown-001' });

      assertEqual(fakeBootstrap.shutdownRequests.length, 1, 'Runtime shutdown should call bootstrap shutdown once');
      assertEqual(
        fakeBootstrap.shutdownRequests[0],
        'runtime-shutdown-001',
        'Runtime shutdown should forward request id',
      );
      assertEqual(shutdown.lifecycleState, 'closed', 'Runtime shutdown should close lifecycle');
      assertEqual(handle.readiness({ requestId: 'ready-after-close-001' }).status, 'not_ready', 'Closed runtime should not be ready');
      assertDeepEqual(
        eventNames(handle.readRuntimeEvents()),
        [
          'validate_runtime_manifest',
          'start_bootstrap',
          'validate_runtime_bundle_continuity',
          'runtime_ready',
          'read_health',
          'read_readiness',
          'mark_draining',
          'delegate_bootstrap_shutdown',
          'runtime_closed',
          'read_readiness',
        ],
        'Runtime trace should record probe and graceful shutdown order',
      );
    },
  },
  {
    name: 'rejects runtime startup when bootstrap node server bundle evidence drifts',
    run: async () => {
      const fakeBootstrap = createFakeBootstrap({
        runtimeBundleEvidenceId: 'drifted-runtime-bundle-evidence',
      });
      const runtime = createFinanceHttpPostgresManagedProjectServiceProcessRuntimeContract({
        bootstrap: fakeBootstrap.bootstrap,
      });

      await assertRejectsIncludes({
        expected: 'Finance project service process runtime bundle continuity rejected',
        message: 'Runtime should reject bootstrap/runtime bundle evidence drift before ready',
        run: () =>
          runtime.start({
            manifest: baseManifest,
            requestId: 'runtime-bundle-drift-001',
            runtimeImplementationBundle: createRuntimeImplementationBundle(),
          }),
      });

      assertEqual(fakeBootstrap.bootstrapInputs.length, 1, 'Bundle drift check should happen after bootstrap summary exists');
      assertEqual(
        fakeBootstrap.shutdownRequests.length,
        0,
        'Bundle drift startup rejection should not pretend to run graceful shutdown',
      );
    },
  },
  {
    name: 'rejects production runtime manifest before bootstrap',
    run: async () => {
      const fakeBootstrap = createFakeBootstrap();
      const runtime = createFinanceHttpPostgresManagedProjectServiceProcessRuntimeContract({
        bootstrap: fakeBootstrap.bootstrap,
      });

      await assertRejectsIncludes({
        expected: 'production_runtime_requires_separate_manual_approval',
        message: 'Production runtime manifest should be rejected by local contract',
        run: () =>
          runtime.start({
            manifest: {
              ...baseManifest,
              mode: 'production',
              supervisor: 'production_process_manager',
            },
            requestId: 'runtime-production-001',
            runtimeImplementationBundle: createRuntimeImplementationBundle(),
          }),
      });

      assertEqual(fakeBootstrap.bootstrapInputs.length, 0, 'Rejected production runtime must not call bootstrap');
    },
  },
  {
    name: 'rejects runtime manifest that exposes production traffic',
    run: async () => {
      const fakeBootstrap = createFakeBootstrap();
      const runtime = createFinanceHttpPostgresManagedProjectServiceProcessRuntimeContract({
        bootstrap: fakeBootstrap.bootstrap,
      });

      await assertRejectsIncludes({
        expected: 'local_runtime_must_not_expose_production_traffic',
        message: 'Local runtime should reject production traffic exposure',
        run: () =>
          runtime.start({
            manifest: {
              ...baseManifest,
              exposesProductionTraffic: true,
            },
            requestId: 'runtime-production-traffic-001',
            runtimeImplementationBundle: createRuntimeImplementationBundle(),
          }),
      });

      assertEqual(fakeBootstrap.bootstrapInputs.length, 0, 'Rejected production traffic manifest must not call bootstrap');
    },
  },
  {
    name: 'rejects invalid probe and shutdown manifest before bootstrap',
    run: async () => {
      const fakeBootstrap = createFakeBootstrap();
      const runtime = createFinanceHttpPostgresManagedProjectServiceProcessRuntimeContract({
        bootstrap: fakeBootstrap.bootstrap,
      });

      await assertRejectsIncludes({
        expected: 'health_path_must_be_absolute',
        message: 'Runtime manifest should reject invalid probe path before bootstrap',
        run: () =>
          runtime.start({
            manifest: {
              ...baseManifest,
              healthPath: 'healthz',
              readinessPath: 'healthz',
              shutdownTimeoutMs: 100,
            },
            requestId: 'runtime-invalid-probe-001',
            runtimeImplementationBundle: createRuntimeImplementationBundle(),
          }),
      });

      assertEqual(fakeBootstrap.bootstrapInputs.length, 0, 'Invalid probe manifest must not call bootstrap');
    },
  },
];

async function run() {
  for (const test of tests) {
    await test.run();
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
