import type {
  FinanceHttpPostgresManagedProjectServiceProcessBootstrapContract,
  FinanceHttpPostgresManagedProjectServiceProcessBootstrapInput,
  FinanceHttpPostgresManagedProjectServiceProcessHandle,
  FinanceHttpPostgresManagedProjectServiceProcessMode,
  FinanceHttpPostgresManagedProjectServiceProcessShutdownResult,
  FinanceHttpPostgresManagedProjectServiceProcessSummary,
} from './financeHttpPostgresManagedProjectServiceProcessBootstrapContract.js';
import type {
  PeriodClosePostgresRuntimeImplementationBundleDescriptor,
} from './periodClosePostgresRuntimeImplementationBundleContract.js';

export type FinanceHttpPostgresManagedProjectServiceProcessRuntimeLifecycleState =
  | 'created'
  | 'starting'
  | 'ready'
  | 'draining'
  | 'closed'
  | 'failed';

export type FinanceHttpPostgresManagedProjectServiceProcessRuntimeEventName =
  | 'validate_runtime_manifest'
  | 'reject_runtime_manifest'
  | 'start_bootstrap'
  | 'validate_runtime_bundle_continuity'
  | 'runtime_ready'
  | 'runtime_failed'
  | 'read_health'
  | 'read_readiness'
  | 'mark_draining'
  | 'delegate_bootstrap_shutdown'
  | 'runtime_closed';

export type FinanceHttpPostgresManagedProjectServiceProcessRuntimeEvent = {
  event: FinanceHttpPostgresManagedProjectServiceProcessRuntimeEventName;
  lifecycleState: FinanceHttpPostgresManagedProjectServiceProcessRuntimeLifecycleState;
  processName: string;
  requestId: string;
  sequence: number;
};

export type FinanceHttpPostgresManagedProjectServiceProcessRuntimeManifest = {
  appName: string;
  exposesProductionTraffic: boolean;
  healthPath: string;
  mode: FinanceHttpPostgresManagedProjectServiceProcessMode;
  processName: string;
  readinessPath: string;
  shutdownTimeoutMs: number;
  signals: {
    SIGINT: 'graceful';
    SIGTERM: 'graceful';
  };
  supervisor: 'local_contract' | 'production_process_manager';
};

export type FinanceHttpPostgresManagedProjectServiceProcessRuntimeBundleSummary = {
  managedServicePoolRuntimeModulePath: string;
  poolConfigFingerprint: string;
  repositoryModulePaths: {
    periodLockRepository: string;
    sourceMutationRepository: string;
    voucherLedgerRepository: string;
  };
  runtimeImportModulePath: string;
  serviceRuntimeAdmissionEvidenceId: string;
  sourceMutationBridgeModulePath: string;
};

export type FinanceHttpPostgresManagedProjectServiceProcessRuntimeSummary =
  FinanceHttpPostgresManagedProjectServiceProcessSummary & {
    runtimeImplementationBundle: FinanceHttpPostgresManagedProjectServiceProcessRuntimeBundleSummary;
  };

export type FinanceHttpPostgresManagedProjectServiceProcessProbe = {
  lifecycleState: FinanceHttpPostgresManagedProjectServiceProcessRuntimeLifecycleState;
  path: string;
  productionReady: false;
  runtimeImplementationBundle?: FinanceHttpPostgresManagedProjectServiceProcessRuntimeBundleSummary;
  status: 'healthy' | 'unhealthy' | 'ready' | 'not_ready';
  summary?: FinanceHttpPostgresManagedProjectServiceProcessRuntimeSummary;
};

export type FinanceHttpPostgresManagedProjectServiceProcessRuntimeStartInput = {
  bootstrapInput?: Omit<FinanceHttpPostgresManagedProjectServiceProcessBootstrapInput, 'mode' | 'processName'>;
  manifest: FinanceHttpPostgresManagedProjectServiceProcessRuntimeManifest;
  requestId?: string;
  runtimeImplementationBundle: PeriodClosePostgresRuntimeImplementationBundleDescriptor;
};

export type FinanceHttpPostgresManagedProjectServiceProcessRuntimeShutdownResult = {
  bootstrapShutdown: FinanceHttpPostgresManagedProjectServiceProcessShutdownResult;
  lifecycleState: FinanceHttpPostgresManagedProjectServiceProcessRuntimeLifecycleState;
  runtimeTrace: FinanceHttpPostgresManagedProjectServiceProcessRuntimeEvent[];
};

export type FinanceHttpPostgresManagedProjectServiceProcessRuntimeHandle = {
  health: (input?: { requestId?: string }) => FinanceHttpPostgresManagedProjectServiceProcessProbe;
  origin: string;
  readiness: (input?: { requestId?: string }) => FinanceHttpPostgresManagedProjectServiceProcessProbe;
  readRuntimeEvents: () => FinanceHttpPostgresManagedProjectServiceProcessRuntimeEvent[];
  shutdown: (input?: { requestId?: string }) => Promise<FinanceHttpPostgresManagedProjectServiceProcessRuntimeShutdownResult>;
  summary: FinanceHttpPostgresManagedProjectServiceProcessRuntimeSummary;
};

export type FinanceHttpPostgresManagedProjectServiceProcessRuntimeContract = {
  start: (
    input: FinanceHttpPostgresManagedProjectServiceProcessRuntimeStartInput,
  ) => Promise<FinanceHttpPostgresManagedProjectServiceProcessRuntimeHandle>;
};

function cloneEvent(
  event: FinanceHttpPostgresManagedProjectServiceProcessRuntimeEvent,
): FinanceHttpPostgresManagedProjectServiceProcessRuntimeEvent {
  return { ...event };
}

export function summarizeRuntimeImplementationBundle(
  bundle: PeriodClosePostgresRuntimeImplementationBundleDescriptor,
): FinanceHttpPostgresManagedProjectServiceProcessRuntimeBundleSummary {
  const poolConfigFingerprint = JSON.stringify(
    Object.keys(bundle.poolConfig)
      .sort()
      .reduce<Record<string, unknown>>((fingerprint, key) => {
        fingerprint[key] = bundle.poolConfig[key as keyof typeof bundle.poolConfig];
        return fingerprint;
      }, {}),
  );

  return {
    managedServicePoolRuntimeModulePath: bundle.managedServicePoolRuntimeModulePath,
    poolConfigFingerprint,
    repositoryModulePaths: {
      periodLockRepository: bundle.repositoryBindings.periodLockRepository.modulePath ?? '',
      sourceMutationRepository: bundle.repositoryBindings.sourceMutationRepository.modulePath ?? '',
      voucherLedgerRepository: bundle.repositoryBindings.voucherLedgerRepository.modulePath ?? '',
    },
    runtimeImportModulePath: bundle.runtimeImportModulePath,
    serviceRuntimeAdmissionEvidenceId: bundle.serviceRuntimeAdmissionEvidenceId,
    sourceMutationBridgeModulePath: bundle.sourceMutationBridgeModulePath,
  };
}

function validateRuntimeManifest(manifest: FinanceHttpPostgresManagedProjectServiceProcessRuntimeManifest) {
  const errors: string[] = [];

  if (!manifest.appName.trim()) {
    errors.push('app_name_required');
  }

  if (!manifest.processName.trim()) {
    errors.push('process_name_required');
  }

  if (manifest.mode === 'production') {
    errors.push('production_runtime_requires_separate_manual_approval');
  }

  if (manifest.supervisor === 'production_process_manager') {
    errors.push('production_process_manager_not_enabled_by_local_contract');
  }

  if (manifest.exposesProductionTraffic) {
    errors.push('local_runtime_must_not_expose_production_traffic');
  }

  if (!manifest.healthPath.startsWith('/')) {
    errors.push('health_path_must_be_absolute');
  }

  if (!manifest.readinessPath.startsWith('/')) {
    errors.push('readiness_path_must_be_absolute');
  }

  if (manifest.healthPath === manifest.readinessPath) {
    errors.push('health_and_readiness_paths_must_be_distinct');
  }

  if (manifest.shutdownTimeoutMs < 1000 || manifest.shutdownTimeoutMs > 30000) {
    errors.push('shutdown_timeout_out_of_range');
  }

  if (manifest.signals.SIGTERM !== 'graceful') {
    errors.push('sigterm_must_be_graceful');
  }

  if (manifest.signals.SIGINT !== 'graceful') {
    errors.push('sigint_must_be_graceful');
  }

  return errors;
}

export function createFinanceHttpPostgresManagedProjectServiceProcessRuntimeContract({
  bootstrap,
}: {
  bootstrap: FinanceHttpPostgresManagedProjectServiceProcessBootstrapContract;
}): FinanceHttpPostgresManagedProjectServiceProcessRuntimeContract {
  return {
    start: async ({
      bootstrapInput = {},
      manifest,
      requestId = 'service-process-runtime-start',
      runtimeImplementationBundle,
    }) => {
      const runtimeEvents: FinanceHttpPostgresManagedProjectServiceProcessRuntimeEvent[] = [];
      let lifecycleState: FinanceHttpPostgresManagedProjectServiceProcessRuntimeLifecycleState = 'created';
      const runtimeImplementationBundleSummary =
        summarizeRuntimeImplementationBundle(runtimeImplementationBundle);

      function record(
        event: FinanceHttpPostgresManagedProjectServiceProcessRuntimeEventName,
        activeRequestId = requestId,
      ) {
        runtimeEvents.push({
          event,
          lifecycleState,
          processName: manifest.processName,
          requestId: activeRequestId,
          sequence: runtimeEvents.length + 1,
        });
      }

      record('validate_runtime_manifest');
      const manifestErrors = validateRuntimeManifest(manifest);

      if (manifestErrors.length > 0) {
        lifecycleState = 'failed';
        record('reject_runtime_manifest');

        throw new Error(`Finance project service process runtime manifest rejected: ${manifestErrors.join(', ')}`);
      }

      lifecycleState = 'starting';
      record('start_bootstrap');

      let serviceProcessHandle: FinanceHttpPostgresManagedProjectServiceProcessHandle;

      try {
        serviceProcessHandle = await bootstrap.bootstrap({
          ...bootstrapInput,
          mode: manifest.mode,
          processName: manifest.processName,
          requestId,
        });
      } catch (error) {
        lifecycleState = 'failed';
        record('runtime_failed');

        throw error instanceof Error ? error : new Error(String(error));
      }

      record('validate_runtime_bundle_continuity');
      if (serviceProcessHandle.summary.runtimeBundleEvidenceId !== runtimeImplementationBundleSummary.serviceRuntimeAdmissionEvidenceId) {
        lifecycleState = 'failed';
        record('runtime_failed');

        throw new Error(
          [
            'Finance project service process runtime bundle continuity rejected',
            `expected:${runtimeImplementationBundleSummary.serviceRuntimeAdmissionEvidenceId}`,
            `actual:${serviceProcessHandle.summary.runtimeBundleEvidenceId}`,
          ].join(':'),
        );
      }

      lifecycleState = 'ready';
      record('runtime_ready');
      const runtimeSummary: FinanceHttpPostgresManagedProjectServiceProcessRuntimeSummary = {
        ...serviceProcessHandle.summary,
        runtimeImplementationBundle: runtimeImplementationBundleSummary,
      };

      function health({ requestId: probeRequestId = 'service-process-health' } = {}) {
        record('read_health', probeRequestId);

        return {
          lifecycleState,
          path: manifest.healthPath,
          productionReady: false,
          runtimeImplementationBundle: runtimeImplementationBundleSummary,
          status: lifecycleState === 'ready' || lifecycleState === 'draining' ? 'healthy' : 'unhealthy',
          summary: runtimeSummary,
        } satisfies FinanceHttpPostgresManagedProjectServiceProcessProbe;
      }

      function readiness({ requestId: probeRequestId = 'service-process-readiness' } = {}) {
        record('read_readiness', probeRequestId);

        return {
          lifecycleState,
          path: manifest.readinessPath,
          productionReady: false,
          runtimeImplementationBundle: runtimeImplementationBundleSummary,
          status: lifecycleState === 'ready' ? 'ready' : 'not_ready',
          summary: runtimeSummary,
        } satisfies FinanceHttpPostgresManagedProjectServiceProcessProbe;
      }

      return {
        health,
        origin: serviceProcessHandle.origin,
        readiness,
        readRuntimeEvents: () => runtimeEvents.map(cloneEvent),
        shutdown: async ({ requestId: shutdownRequestId = 'service-process-runtime-shutdown' } = {}) => {
          if (lifecycleState === 'closed') {
            return {
              bootstrapShutdown: {
                nodeServerShutdown: {
                  httpServerClosed: true,
                  processShutdown: {
                    lifecycleState: 'closed',
                    processTrace: [],
                    runtimeShutdown: {
                      events: [],
                      poolLifecycleState: 'closed',
                      requestId: shutdownRequestId,
                      shutdownErrors: [],
                      status: 'closed',
                      traceErrors: [],
                      transactionId: `${shutdownRequestId}-already-closed`,
                    },
                  },
                },
                processTrace: serviceProcessHandle.readProcessEvents(),
                serviceProcessClosed: true,
              },
              lifecycleState,
              runtimeTrace: runtimeEvents.map(cloneEvent),
            };
          }

          lifecycleState = 'draining';
          record('mark_draining', shutdownRequestId);
          record('delegate_bootstrap_shutdown', shutdownRequestId);
          const bootstrapShutdown = await serviceProcessHandle.shutdown({ requestId: shutdownRequestId });
          lifecycleState = 'closed';
          record('runtime_closed', shutdownRequestId);

          return {
            bootstrapShutdown,
            lifecycleState,
            runtimeTrace: runtimeEvents.map(cloneEvent),
          };
        },
        summary: runtimeSummary,
      };
    },
  };
}
