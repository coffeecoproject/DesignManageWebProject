import type {
  FinanceHttpPostgresManagedProjectRuntimeNodeServerContract,
  FinanceHttpPostgresManagedProjectRuntimeNodeServerHandle,
  FinanceHttpPostgresManagedProjectRuntimeNodeServerSummary,
  FinanceHttpPostgresManagedProjectRuntimeNodeServerShutdownResult,
} from './financeHttpPostgresManagedProjectRuntimeNodeServerContract.js';

export type FinanceHttpPostgresManagedProjectServiceProcessMode =
  | 'local_contract'
  | 'production';

export type FinanceHttpPostgresManagedProjectServiceProcessBootstrapEventName =
  | 'validate_bootstrap_config'
  | 'validate_environment_boundary'
  | 'reject_bootstrap'
  | 'listen_runtime_node_server'
  | 'service_process_ready'
  | 'shutdown_requested'
  | 'close_runtime_node_server'
  | 'service_process_closed';

export type FinanceHttpPostgresManagedProjectServiceProcessBootstrapEvent = {
  event: FinanceHttpPostgresManagedProjectServiceProcessBootstrapEventName;
  mode: FinanceHttpPostgresManagedProjectServiceProcessMode;
  processName: string;
  requestId: string;
  sequence: number;
};

export type FinanceHttpPostgresManagedProjectServiceProcessBootstrapInput = {
  envSnapshot?: Record<string, string | undefined>;
  host?: string;
  mode: FinanceHttpPostgresManagedProjectServiceProcessMode;
  port?: number;
  processName?: string;
  requestId?: string;
};

export type FinanceHttpPostgresManagedProjectServiceProcessSummary = {
  host: string;
  mode: FinanceHttpPostgresManagedProjectServiceProcessMode;
  origin: string;
  port: number;
  processName: string;
  productionServiceBound: boolean;
  runtimeBundleEvidenceId: string;
  runtimeNodeServerLifecycleState: FinanceHttpPostgresManagedProjectRuntimeNodeServerSummary['lifecycleState'];
};

export type FinanceHttpPostgresManagedProjectServiceProcessShutdownResult = {
  nodeServerShutdown: FinanceHttpPostgresManagedProjectRuntimeNodeServerShutdownResult;
  processTrace: FinanceHttpPostgresManagedProjectServiceProcessBootstrapEvent[];
  serviceProcessClosed: boolean;
};

export type FinanceHttpPostgresManagedProjectServiceProcessHandle = {
  origin: string;
  readProcessEvents: () => FinanceHttpPostgresManagedProjectServiceProcessBootstrapEvent[];
  shutdown: (input?: { requestId?: string }) => Promise<FinanceHttpPostgresManagedProjectServiceProcessShutdownResult>;
  summary: FinanceHttpPostgresManagedProjectServiceProcessSummary;
};

export type FinanceHttpPostgresManagedProjectServiceProcessBootstrapContract = {
  bootstrap: (
    input: FinanceHttpPostgresManagedProjectServiceProcessBootstrapInput,
  ) => Promise<FinanceHttpPostgresManagedProjectServiceProcessHandle>;
};

const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '::1'];
const RAW_SECRET_ENV_KEYS = [
  'DATABASE_URL',
  'PGPASSWORD',
  'POSTGRES_PASSWORD',
  'JWT_SECRET',
  'SESSION_SECRET',
  'COOKIE_SECRET',
  'FINANCE_DATABASE_PASSWORD',
];

function cloneEvent(
  event: FinanceHttpPostgresManagedProjectServiceProcessBootstrapEvent,
): FinanceHttpPostgresManagedProjectServiceProcessBootstrapEvent {
  return { ...event };
}

function getOriginPort(origin: string) {
  const parsed = new URL(origin);

  return Number(parsed.port);
}

function validateBootstrapInput({
  envSnapshot,
  host,
  mode,
  processName,
}: Required<Pick<FinanceHttpPostgresManagedProjectServiceProcessBootstrapInput, 'host' | 'mode' | 'processName'>> & {
  envSnapshot: Record<string, string | undefined>;
}) {
  const errors: string[] = [];

  if (!processName.trim()) {
    errors.push('process_name_required');
  }

  if (mode === 'local_contract' && !LOCAL_HOSTS.includes(host)) {
    errors.push('local_contract_host_must_be_localhost');
  }

  if (mode === 'production') {
    errors.push('production_bootstrap_requires_separate_manual_approval');
    errors.push('production_service_process_wiring_not_enabled_by_local_contract');
  }

  RAW_SECRET_ENV_KEYS.forEach((key) => {
    const value = envSnapshot[key];

    if (value && !value.startsWith('secret://')) {
      errors.push(`raw_secret_env_not_allowed:${key}`);
    }
  });

  Object.entries(envSnapshot).forEach(([key, value]) => {
    if (!value || value.startsWith('secret://')) {
      return;
    }

    const lowerKey = key.toLowerCase();
    const lowerValue = value.toLowerCase();
    const looksLikeSecret =
      lowerKey.includes('password') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('token') ||
      lowerValue.includes('password=') ||
      lowerValue.includes('://') && lowerValue.includes('@');

    if (looksLikeSecret) {
      errors.push(`raw_secret_like_env_not_allowed:${key}`);
    }
  });

  return errors;
}

export function createFinanceHttpPostgresManagedProjectServiceProcessBootstrapContract({
  runtimeNodeServer,
}: {
  runtimeNodeServer: FinanceHttpPostgresManagedProjectRuntimeNodeServerContract;
}): FinanceHttpPostgresManagedProjectServiceProcessBootstrapContract {
  return {
    bootstrap: async ({
      envSnapshot = {},
      host = '127.0.0.1',
      mode,
      port = 0,
      processName = 'finance-period-close-api-service-process',
      requestId = 'service-process-bootstrap',
    }) => {
      const processEvents: FinanceHttpPostgresManagedProjectServiceProcessBootstrapEvent[] = [];

      function record(event: FinanceHttpPostgresManagedProjectServiceProcessBootstrapEventName, activeRequestId = requestId) {
        processEvents.push({
          event,
          mode,
          processName,
          requestId: activeRequestId,
          sequence: processEvents.length + 1,
        });
      }

      record('validate_bootstrap_config');
      record('validate_environment_boundary');

      const validationErrors = validateBootstrapInput({
        envSnapshot,
        host,
        mode,
        processName,
      });

      if (validationErrors.length > 0) {
        record('reject_bootstrap');

        throw new Error(`Finance project service process bootstrap rejected: ${validationErrors.join(', ')}`);
      }

      record('listen_runtime_node_server');
      const nodeServerHandle: FinanceHttpPostgresManagedProjectRuntimeNodeServerHandle =
        await runtimeNodeServer.listen({ host, port });
      record('service_process_ready');

      const summary: FinanceHttpPostgresManagedProjectServiceProcessSummary = {
        host,
        mode,
        origin: nodeServerHandle.origin,
        port: nodeServerHandle.summary.port || getOriginPort(nodeServerHandle.origin),
        processName,
        productionServiceBound: false,
        runtimeBundleEvidenceId: nodeServerHandle.summary.runtimeBundleEvidenceId,
        runtimeNodeServerLifecycleState: nodeServerHandle.summary.lifecycleState,
      };

      return {
        origin: nodeServerHandle.origin,
        readProcessEvents: () => processEvents.map(cloneEvent),
        shutdown: async ({ requestId: shutdownRequestId = 'service-process-shutdown' } = {}) => {
          record('shutdown_requested', shutdownRequestId);
          record('close_runtime_node_server', shutdownRequestId);
          const nodeServerShutdown = await nodeServerHandle.close({ requestId: shutdownRequestId });
          record('service_process_closed', shutdownRequestId);

          return {
            nodeServerShutdown,
            processTrace: processEvents.map(cloneEvent),
            serviceProcessClosed: true,
          };
        },
        summary,
      };
    },
  };
}
