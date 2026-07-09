import {
  createFinanceHttpPostgresManagedProjectServiceProcessBootstrapContract,
  type FinanceHttpPostgresManagedProjectServiceProcessBootstrapEventName,
} from './financeHttpPostgresManagedProjectServiceProcessBootstrapContract.js';
import type {
  FinanceHttpPostgresManagedProjectRuntimeNodeServerContract,
  FinanceHttpPostgresManagedProjectRuntimeNodeServerShutdownResult,
} from './financeHttpPostgresManagedProjectRuntimeNodeServerContract.js';

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

function createRuntimeNodeShutdownResult(requestId: string): FinanceHttpPostgresManagedProjectRuntimeNodeServerShutdownResult {
  return {
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
  };
}

function createFakeRuntimeNodeServer() {
  const closeRequests: string[] = [];
  const listenCalls: Array<{ host?: string; port?: number }> = [];
  const runtimeBundleEvidenceId = 'runtime-bundle-evidence-local-001';
  const contract: FinanceHttpPostgresManagedProjectRuntimeNodeServerContract = {
    listen: async (options = {}) => {
      listenCalls.push(options);
      const host = options.host ?? '127.0.0.1';
      const port = options.port && options.port > 0 ? options.port : 43997;
      const origin = `http://${host}:${port}`;

      return {
        close: async ({ requestId = 'fake-runtime-node-close' } = {}) => {
          closeRequests.push(requestId);

          return createRuntimeNodeShutdownResult(requestId);
        },
        origin,
        summary: {
          host,
          lifecycleState: 'active',
          origin,
          port,
          runtimeBundleEvidenceId,
        },
      };
    },
  };

  return {
    closeRequests,
    contract,
    listenCalls,
    runtimeBundleEvidenceId,
  };
}

function eventNames(events: Array<{ event: FinanceHttpPostgresManagedProjectServiceProcessBootstrapEventName }>) {
  return events.map((event) => event.event);
}

const tests: UnitTest[] = [
  {
    name: 'boots a local service process through the runtime node server and closes it in order',
    run: async () => {
      const runtimeNodeServer = createFakeRuntimeNodeServer();
      const bootstrap = createFinanceHttpPostgresManagedProjectServiceProcessBootstrapContract({
        runtimeNodeServer: runtimeNodeServer.contract,
      });

      const handle = await bootstrap.bootstrap({
        envSnapshot: {
          FINANCE_DATABASE_PASSWORD: 'secret://finance/local/period-close/password',
        },
        host: '127.0.0.1',
        mode: 'local_contract',
        port: 53117,
        processName: 'finance-period-close-local-service',
        requestId: 'bootstrap-local-001',
      });

      assertEqual(runtimeNodeServer.listenCalls.length, 1, 'Local bootstrap should listen once');
      assertDeepEqual(
        runtimeNodeServer.listenCalls[0],
        { host: '127.0.0.1', port: 53117 },
        'Local bootstrap should pass the validated host and port to the runtime node server',
      );
      assertEqual(handle.origin, 'http://127.0.0.1:53117', 'Local bootstrap should expose runtime origin');
      assertEqual(handle.summary.productionServiceBound, false, 'Local bootstrap must not claim production service binding');
      assertEqual(handle.summary.port, 53117, 'Local bootstrap should record listening port from origin');
      assertEqual(
        handle.summary.runtimeBundleEvidenceId,
        runtimeNodeServer.runtimeBundleEvidenceId,
        'Local bootstrap summary should preserve runtime node server bundle evidence id',
      );
      assertEqual(
        handle.summary.runtimeNodeServerLifecycleState,
        'active',
        'Local bootstrap summary should preserve runtime node server lifecycle',
      );
      assertDeepEqual(
        eventNames(handle.readProcessEvents()),
        [
          'validate_bootstrap_config',
          'validate_environment_boundary',
          'listen_runtime_node_server',
          'service_process_ready',
        ],
        'Local bootstrap should record validation before listen and ready',
      );

      const shutdown = await handle.shutdown({ requestId: 'shutdown-local-001' });

      assertEqual(runtimeNodeServer.closeRequests.length, 1, 'Shutdown should close runtime node server once');
      assertEqual(
        runtimeNodeServer.closeRequests[0],
        'shutdown-local-001',
        'Shutdown should forward request id to runtime node server close',
      );
      assertEqual(shutdown.serviceProcessClosed, true, 'Shutdown should mark service process closed');
      assertDeepEqual(
        eventNames(shutdown.processTrace),
        [
          'validate_bootstrap_config',
          'validate_environment_boundary',
          'listen_runtime_node_server',
          'service_process_ready',
          'shutdown_requested',
          'close_runtime_node_server',
          'service_process_closed',
        ],
        'Shutdown trace should preserve startup events and close runtime node server before closed event',
      );
    },
  },
  {
    name: 'rejects production service bootstrap before runtime node server listen',
    run: async () => {
      const runtimeNodeServer = createFakeRuntimeNodeServer();
      const bootstrap = createFinanceHttpPostgresManagedProjectServiceProcessBootstrapContract({
        runtimeNodeServer: runtimeNodeServer.contract,
      });

      await assertRejectsIncludes({
        expected: 'production_bootstrap_requires_separate_manual_approval',
        message: 'Production bootstrap should require a separate manual approval gate',
        run: () =>
          bootstrap.bootstrap({
            envSnapshot: {
              DATABASE_URL: 'postgres://finance:password@db.internal:5432/startupmanage',
            },
            host: '0.0.0.0',
            mode: 'production',
            requestId: 'bootstrap-production-001',
          }),
      });

      assertEqual(runtimeNodeServer.listenCalls.length, 0, 'Rejected production bootstrap must not listen');
    },
  },
  {
    name: 'rejects raw secret environment values before runtime node server listen',
    run: async () => {
      const runtimeNodeServer = createFakeRuntimeNodeServer();
      const bootstrap = createFinanceHttpPostgresManagedProjectServiceProcessBootstrapContract({
        runtimeNodeServer: runtimeNodeServer.contract,
      });

      await assertRejectsIncludes({
        expected: 'raw_secret_env_not_allowed:JWT_SECRET',
        message: 'Raw secret environment values should be rejected',
        run: () =>
          bootstrap.bootstrap({
            envSnapshot: {
              JWT_SECRET: 'local-plaintext-secret',
            },
            host: '127.0.0.1',
            mode: 'local_contract',
            requestId: 'bootstrap-raw-secret-001',
          }),
      });

      assertEqual(runtimeNodeServer.listenCalls.length, 0, 'Rejected raw secret bootstrap must not listen');
    },
  },
  {
    name: 'rejects non-local host in local contract mode before runtime node server listen',
    run: async () => {
      const runtimeNodeServer = createFakeRuntimeNodeServer();
      const bootstrap = createFinanceHttpPostgresManagedProjectServiceProcessBootstrapContract({
        runtimeNodeServer: runtimeNodeServer.contract,
      });

      await assertRejectsIncludes({
        expected: 'local_contract_host_must_be_localhost',
        message: 'Local contract mode should reject non-local hosts',
        run: () =>
          bootstrap.bootstrap({
            host: '0.0.0.0',
            mode: 'local_contract',
            requestId: 'bootstrap-non-local-host-001',
          }),
      });

      assertEqual(runtimeNodeServer.listenCalls.length, 0, 'Rejected non-local bootstrap must not listen');
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
