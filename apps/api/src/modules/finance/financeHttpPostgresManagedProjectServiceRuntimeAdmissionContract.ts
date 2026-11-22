import type { PeriodClosePostgresDependencyAdmissionResult } from './periodClosePostgresDependencyAdmissionContract.js';
import {
  evaluatePeriodCloseManagedSecretProviderReadiness,
  type PeriodCloseManagedSecretProviderReadinessResult,
} from './periodCloseManagedSecretProviderReadinessContract.js';
import {
  type PeriodClosePostgresRuntimeImplementationResult,
  type PeriodClosePostgresRuntimeImplementationManifest,
} from './periodClosePostgresRuntimeImplementationManifestContract.js';
import {
  evaluatePeriodClosePostgresRuntimeImplementationBundle,
  type PeriodClosePostgresRuntimeImplementationBundleEvidence,
  type PeriodClosePostgresRuntimeImplementationBundleResult,
  type PeriodClosePostgresRuntimeImplementationRepositoryBindings,
} from './periodClosePostgresRuntimeImplementationBundleContract.js';
import type {
  PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput,
} from './periodClosePostgresManagedServicePoolRuntimeContract.js';
import type { PeriodClosePostgresRuntimeReadinessResult } from './periodClosePostgresRuntimeReadinessPackageContract.js';
import type {
  FinanceHttpPostgresManagedProjectServiceProcessRuntimeContract,
  FinanceHttpPostgresManagedProjectServiceProcessRuntimeHandle,
  FinanceHttpPostgresManagedProjectServiceProcessRuntimeManifest,
  FinanceHttpPostgresManagedProjectServiceProcessRuntimeStartInput,
  FinanceHttpPostgresManagedProjectServiceProcessProbe,
} from './financeHttpPostgresManagedProjectServiceProcessRuntimeContract.js';
import {
  summarizeRuntimeImplementationBundle,
  type FinanceHttpPostgresManagedProjectServiceProcessRuntimeBundleSummary,
} from './financeHttpPostgresManagedProjectServiceProcessRuntimeContract.js';

export type FinanceHttpPostgresManagedProjectServiceRuntimeAdmissionStatus =
  | 'dependency_admission_blocked'
  | 'readiness_blocked'
  | 'runtime_implementation_bundle_blocked'
  | 'runtime_implementation_blocked'
  | 'runtime_manifest_invalid'
  | 'runtime_bundle_continuity_blocked'
  | 'runtime_start_failed'
  | 'secret_provider_blocked'
  | 'service_runtime_started'
  | 'trace_invalid';

export type FinanceHttpPostgresManagedProjectServiceRuntimeAdmissionEventName =
  | 'derive_runtime_readiness'
  | 'evaluate_runtime_implementation_bundle'
  | 'evaluate_secret_provider_readiness'
  | 'read_service_probes'
  | 'receive_start_request'
  | 'reject_service_runtime_start'
  | 'return_response'
  | 'start_service_runtime'
  | 'validate_runtime_implementation_bundle'
  | 'validate_service_runtime_bundle_continuity'
  | 'validate_service_runtime_manifest';

export type FinanceHttpPostgresManagedProjectServiceRuntimeAdmissionEvent = {
  event: FinanceHttpPostgresManagedProjectServiceRuntimeAdmissionEventName;
  processName: string;
  requestId: string;
  sequence: number;
  status: FinanceHttpPostgresManagedProjectServiceRuntimeAdmissionStatus;
};

export type FinanceHttpPostgresManagedProjectServiceRuntimeAdmissionStartInput = {
  admission: PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput;
  manifest: FinanceHttpPostgresManagedProjectServiceProcessRuntimeManifest;
  requestId?: string;
  runtimeImplementationBundleEvidence: PeriodClosePostgresRuntimeImplementationBundleEvidence;
  runtimeImplementationManifest: PeriodClosePostgresRuntimeImplementationManifest;
  runtimeRepositoryBindings: PeriodClosePostgresRuntimeImplementationRepositoryBindings;
  runtimeStartInput?: Omit<
    FinanceHttpPostgresManagedProjectServiceProcessRuntimeStartInput,
    'manifest' | 'requestId' | 'runtimeImplementationBundle'
  >;
};

export type FinanceHttpPostgresManagedProjectServiceRuntimeAdmissionResult = {
  admissionErrors: string[];
  dependencyAdmission?: PeriodClosePostgresDependencyAdmissionResult;
  events: FinanceHttpPostgresManagedProjectServiceRuntimeAdmissionEvent[];
  handle?: FinanceHttpPostgresManagedProjectServiceProcessRuntimeHandle;
  health?: FinanceHttpPostgresManagedProjectServiceProcessProbe;
  manifestErrors: string[];
  readiness: PeriodClosePostgresRuntimeReadinessResult;
  readinessProbe?: FinanceHttpPostgresManagedProjectServiceProcessProbe;
  requestId: string;
  runtimeImplementation: PeriodClosePostgresRuntimeImplementationResult;
  runtimeImplementationBundle: PeriodClosePostgresRuntimeImplementationBundleResult;
  secretProviderReadiness: PeriodCloseManagedSecretProviderReadinessResult;
  status: FinanceHttpPostgresManagedProjectServiceRuntimeAdmissionStatus;
  traceErrors: string[];
};

export type FinanceHttpPostgresManagedProjectServiceRuntimeAdmissionContract = {
  readEvents: () => FinanceHttpPostgresManagedProjectServiceRuntimeAdmissionEvent[];
  start: (
    input: FinanceHttpPostgresManagedProjectServiceRuntimeAdmissionStartInput,
  ) => Promise<FinanceHttpPostgresManagedProjectServiceRuntimeAdmissionResult>;
};

function validateServiceRuntimeManifest(manifest: FinanceHttpPostgresManagedProjectServiceProcessRuntimeManifest) {
  const errors: string[] = [];

  if (!manifest.appName.trim()) {
    errors.push('app_name_required');
  }

  if (!manifest.processName.trim()) {
    errors.push('process_name_required');
  }

  if (manifest.mode !== 'local_contract') {
    errors.push('service_runtime_admission_requires_local_contract_mode');
  }

  if (manifest.supervisor !== 'local_contract') {
    errors.push('service_runtime_admission_requires_local_supervisor');
  }

  if (manifest.exposesProductionTraffic) {
    errors.push('service_runtime_admission_must_not_expose_production_traffic');
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

  if (manifest.signals.SIGINT !== 'graceful') {
    errors.push('sigint_must_be_graceful');
  }

  if (manifest.signals.SIGTERM !== 'graceful') {
    errors.push('sigterm_must_be_graceful');
  }

  return errors;
}

function nextBlockedStatus({
  admissionErrors,
  manifestErrors,
  readiness,
  runtimeImplementation,
  runtimeImplementationBundle,
  secretProviderReadiness,
}: {
  admissionErrors: readonly string[];
  manifestErrors: readonly string[];
  readiness: PeriodClosePostgresRuntimeReadinessResult;
  runtimeImplementation: PeriodClosePostgresRuntimeImplementationResult;
  runtimeImplementationBundle: PeriodClosePostgresRuntimeImplementationBundleResult;
  secretProviderReadiness: PeriodCloseManagedSecretProviderReadinessResult;
}): Exclude<
  FinanceHttpPostgresManagedProjectServiceRuntimeAdmissionStatus,
  'runtime_start_failed' | 'service_runtime_started' | 'trace_invalid'
> | undefined {
  if (manifestErrors.length > 0) {
    return 'runtime_manifest_invalid';
  }

  if (readiness.status !== 'ready' || !readiness.poolConfig) {
    return 'readiness_blocked';
  }

  if (runtimeImplementation.status !== 'ready') {
    return 'runtime_implementation_blocked';
  }

  if (runtimeImplementationBundle.status === 'dependency_blocked' || admissionErrors.length > 0) {
    return 'dependency_admission_blocked';
  }

  if (runtimeImplementationBundle.status !== 'ready') {
    return 'runtime_implementation_bundle_blocked';
  }

  if (secretProviderReadiness.status !== 'ready') {
    return 'secret_provider_blocked';
  }

  return undefined;
}

function eventNames(events: readonly FinanceHttpPostgresManagedProjectServiceRuntimeAdmissionEvent[]) {
  return events
    .slice()
    .sort((left, right) => left.sequence - right.sequence)
    .map((event) => event.event);
}

function collectRuntimeBundleContinuityErrors({
  expected,
  handle,
  health,
  readinessProbe,
}: {
  expected: FinanceHttpPostgresManagedProjectServiceProcessRuntimeBundleSummary;
  handle: FinanceHttpPostgresManagedProjectServiceProcessRuntimeHandle;
  health: FinanceHttpPostgresManagedProjectServiceProcessProbe;
  readinessProbe: FinanceHttpPostgresManagedProjectServiceProcessProbe;
}) {
  const errors: string[] = [];

  function validateBundle(
    source: string,
    actual?: FinanceHttpPostgresManagedProjectServiceProcessRuntimeBundleSummary,
  ) {
    if (!actual) {
      errors.push(`${source} runtime implementation bundle is required after service runtime start`);
      return;
    }

    const comparableFields: Array<keyof FinanceHttpPostgresManagedProjectServiceProcessRuntimeBundleSummary> = [
      'managedServicePoolRuntimeModulePath',
      'poolConfigFingerprint',
      'runtimeImportModulePath',
      'serviceRuntimeAdmissionEvidenceId',
      'sourceMutationBridgeModulePath',
    ];

    for (const field of comparableFields) {
      if (actual[field] !== expected[field]) {
        errors.push(
          [
            `${source} runtime implementation bundle continuity rejected`,
            `field:${field}`,
            `expected:${expected[field]}`,
            `actual:${actual[field]}`,
          ].join(':'),
        );
      }
    }

    for (const repositoryName of Object.keys(expected.repositoryModulePaths) as Array<
      keyof FinanceHttpPostgresManagedProjectServiceProcessRuntimeBundleSummary['repositoryModulePaths']
    >) {
      if (actual.repositoryModulePaths[repositoryName] !== expected.repositoryModulePaths[repositoryName]) {
        errors.push(
          [
            `${source} runtime implementation repository continuity rejected`,
            `repository:${repositoryName}`,
            `expected:${expected.repositoryModulePaths[repositoryName]}`,
            `actual:${actual.repositoryModulePaths[repositoryName]}`,
          ].join(':'),
        );
      }
    }
  }

  function validateSummary(
    source: string,
    summary?: FinanceHttpPostgresManagedProjectServiceProcessRuntimeHandle['summary'],
  ) {
    if (!summary) {
      errors.push(`${source} runtime summary is required after service runtime start`);
      return;
    }

    if (summary.runtimeBundleEvidenceId !== expected.serviceRuntimeAdmissionEvidenceId) {
      errors.push(
        [
          `${source} runtime bundle evidence continuity rejected`,
          `expected:${expected.serviceRuntimeAdmissionEvidenceId}`,
          `actual:${summary.runtimeBundleEvidenceId}`,
        ].join(':'),
      );
    }

    validateBundle(`${source}.summary`, summary.runtimeImplementationBundle);
  }

  validateSummary('handle', handle.summary);
  validateSummary('health', health.summary);
  validateBundle('health.probe', health.runtimeImplementationBundle);
  validateSummary('readiness', readinessProbe.summary);
  validateBundle('readiness.probe', readinessProbe.runtimeImplementationBundle);

  return errors;
}

export function validateFinanceHttpPostgresManagedProjectServiceRuntimeAdmissionTrace(
  result: FinanceHttpPostgresManagedProjectServiceRuntimeAdmissionResult,
) {
  const errors = [...result.traceErrors];
  const events = result.events.slice().sort((left, right) => left.sequence - right.sequence);
  const names = eventNames(events);
  const receiveIndex = names.indexOf('receive_start_request');
  const manifestIndex = names.indexOf('validate_service_runtime_manifest');
  const implementationBundleIndex = names.indexOf('evaluate_runtime_implementation_bundle');
  const readinessIndex = names.indexOf('derive_runtime_readiness');
  const secretProviderIndex = names.indexOf('evaluate_secret_provider_readiness');
  const validateBundleIndex = names.indexOf('validate_runtime_implementation_bundle');
  const rejectIndex = names.indexOf('reject_service_runtime_start');
  const startIndex = names.indexOf('start_service_runtime');
  const probeIndex = names.indexOf('read_service_probes');
  const bundleContinuityIndex = names.indexOf('validate_service_runtime_bundle_continuity');
  const returnIndex = names.indexOf('return_response');

  if (receiveIndex !== 0) {
    errors.push('service runtime admission must receive start request first');
  }

  if (manifestIndex <= receiveIndex) {
    errors.push('service runtime admission must validate service manifest after receiving start request');
  }

  if (implementationBundleIndex <= manifestIndex) {
    errors.push('service runtime admission must evaluate runtime implementation bundle after service manifest validation');
  }

  if (readinessIndex <= implementationBundleIndex) {
    errors.push('service runtime admission must derive runtime readiness after runtime implementation bundle evaluation');
  }

  if (secretProviderIndex <= readinessIndex) {
    errors.push('service runtime admission must evaluate secret provider readiness after runtime readiness');
  }

  if (validateBundleIndex <= secretProviderIndex) {
    errors.push('service runtime admission must validate runtime implementation bundle after secret provider readiness');
  }

  if (result.status === 'service_runtime_started') {
    if (startIndex <= validateBundleIndex) {
      errors.push('service runtime admission must start service runtime after all admission checks');
    }
    if (probeIndex <= startIndex) {
      errors.push('service runtime admission must read service probes after runtime start');
    }
    if (bundleContinuityIndex <= probeIndex) {
      errors.push('service runtime admission must validate service runtime bundle continuity after reading probes');
    }
    if (!result.handle || !result.health || !result.readinessProbe) {
      errors.push('started service runtime admission result must expose handle and probe snapshots');
    }
    if (result.health?.productionReady !== false || result.readinessProbe?.productionReady !== false) {
      errors.push('service runtime admission probes must not claim production readiness');
    }
  } else if (result.status === 'runtime_bundle_continuity_blocked') {
    if (startIndex <= validateBundleIndex) {
      errors.push('service runtime admission must start service runtime before detecting post-start bundle drift');
    }
    if (probeIndex <= startIndex) {
      errors.push('service runtime admission must read service probes before detecting post-start bundle drift');
    }
    if (bundleContinuityIndex <= probeIndex) {
      errors.push('service runtime admission must validate service runtime bundle continuity after probe snapshots');
    }
    if (result.handle) {
      errors.push('bundle-continuity blocked service runtime admission must not expose unsafe runtime handle');
    }
    if (!result.health || !result.readinessProbe) {
      errors.push('bundle-continuity blocked service runtime admission must expose probe snapshots for diagnostics');
    }
  } else if (result.status !== 'runtime_start_failed') {
    if (rejectIndex <= validateBundleIndex) {
      errors.push('blocked service runtime admission must reject after runtime implementation bundle validation');
    }
    if (startIndex !== -1 || probeIndex !== -1 || bundleContinuityIndex !== -1 || result.handle) {
      errors.push('blocked service runtime admission must not start runtime or read probes');
    }
  }

  if (returnIndex !== events.length - 1) {
    errors.push('service runtime admission must return response last');
  }

  if (events.some((event) => event.processName !== events[0]?.processName)) {
    errors.push('service runtime admission events must keep one process name');
  }

  if (events.some((event) => event.requestId !== result.requestId)) {
    errors.push('service runtime admission events must keep one request id');
  }

  if (result.status === 'service_runtime_started') {
    if (
      result.manifestErrors.length > 0 ||
      result.admissionErrors.length > 0 ||
      result.readiness.status !== 'ready' ||
      result.runtimeImplementation.status !== 'ready' ||
      result.runtimeImplementationBundle.status !== 'ready' ||
      result.secretProviderReadiness.status !== 'ready'
    ) {
      errors.push('started service runtime admission must have no manifest/admission/implementation/bundle/readiness blockers');
    }
  }

  return errors;
}

function cloneEvent(
  event: FinanceHttpPostgresManagedProjectServiceRuntimeAdmissionEvent,
): FinanceHttpPostgresManagedProjectServiceRuntimeAdmissionEvent {
  return { ...event };
}

export function createFinanceHttpPostgresManagedProjectServiceRuntimeAdmissionContract({
  serviceRuntime,
}: {
  serviceRuntime: FinanceHttpPostgresManagedProjectServiceProcessRuntimeContract;
}): FinanceHttpPostgresManagedProjectServiceRuntimeAdmissionContract {
  const events: FinanceHttpPostgresManagedProjectServiceRuntimeAdmissionEvent[] = [];

  function readRequestEvents(requestId: string) {
    return events.filter((event) => event.requestId === requestId).map(cloneEvent);
  }

  return {
    readEvents: () => events.map(cloneEvent),
    start: async ({
      admission,
      manifest,
      requestId = 'project-service-runtime-admission-start',
      runtimeImplementationBundleEvidence,
      runtimeImplementationManifest,
      runtimeRepositoryBindings,
      runtimeStartInput = {},
    }) => {
      let status: FinanceHttpPostgresManagedProjectServiceRuntimeAdmissionStatus = 'readiness_blocked';

      function record(event: FinanceHttpPostgresManagedProjectServiceRuntimeAdmissionEventName) {
        events.push({
          event,
          processName: manifest.processName,
          requestId,
          sequence: events.length + 1,
          status,
        });
      }

      record('receive_start_request');
      record('validate_service_runtime_manifest');
      const manifestErrors = validateServiceRuntimeManifest(manifest);

      record('evaluate_runtime_implementation_bundle');
      const runtimeImplementationBundle = evaluatePeriodClosePostgresRuntimeImplementationBundle({
        apiPackageManifest: admission.apiPackageManifest,
        apiPackageManifestPath: admission.apiPackageManifestPath,
        bundleEvidence: runtimeImplementationBundleEvidence,
        lockfilePath: admission.lockfilePath,
        lockfileText: admission.lockfileText,
        manifest: runtimeImplementationManifest,
        repositoryBindings: runtimeRepositoryBindings,
      });
      const runtimeImplementation = runtimeImplementationBundle.implementation;

      record('derive_runtime_readiness');
      const readiness = runtimeImplementation.readiness;

      record('evaluate_secret_provider_readiness');
      const secretProviderReadiness = evaluatePeriodCloseManagedSecretProviderReadiness({
        readinessPackage: runtimeImplementationManifest.readinessPackage,
        requestId,
        runtimeEnvironmentSnapshot: runtimeStartInput.bootstrapInput?.envSnapshot,
      });

      record('validate_runtime_implementation_bundle');
      const dependencyAdmission = runtimeImplementationBundle.dependencyAdmission;
      const admissionErrors = runtimeImplementationBundle.traceErrors.filter((error) =>
        error.includes('pg must be a runtime dependency') ||
        error.includes('runtime dependency') ||
        error.includes('dependency admission')
      );
      const blockedStatus = nextBlockedStatus({
        admissionErrors,
        manifestErrors,
        readiness,
        runtimeImplementation,
        runtimeImplementationBundle,
        secretProviderReadiness,
      });

      if (blockedStatus) {
        status = blockedStatus;
        record('reject_service_runtime_start');
        record('return_response');

        const result: FinanceHttpPostgresManagedProjectServiceRuntimeAdmissionResult = {
          admissionErrors,
          dependencyAdmission,
          events: readRequestEvents(requestId),
          manifestErrors,
          readiness,
          requestId,
          runtimeImplementation,
          runtimeImplementationBundle,
          secretProviderReadiness,
          status,
          traceErrors: [],
        };

        return {
          ...result,
          traceErrors: validateFinanceHttpPostgresManagedProjectServiceRuntimeAdmissionTrace(result),
        };
      }

      const readyRuntimeImplementationBundle = runtimeImplementationBundle.bundle;

      if (!readyRuntimeImplementationBundle) {
        status = 'runtime_implementation_bundle_blocked';
        record('reject_service_runtime_start');
        record('return_response');

        const result: FinanceHttpPostgresManagedProjectServiceRuntimeAdmissionResult = {
          admissionErrors,
          dependencyAdmission,
          events: readRequestEvents(requestId),
          manifestErrors,
          readiness,
          requestId,
          runtimeImplementation,
          runtimeImplementationBundle,
          secretProviderReadiness,
          status,
          traceErrors: ['runtime implementation bundle descriptor is required before service runtime start'],
        };

        return {
          ...result,
          traceErrors: validateFinanceHttpPostgresManagedProjectServiceRuntimeAdmissionTrace(result),
        };
      }

      status = 'service_runtime_started';
      record('start_service_runtime');

      try {
        const handle = await serviceRuntime.start({
          ...runtimeStartInput,
          manifest,
          requestId,
          runtimeImplementationBundle: readyRuntimeImplementationBundle,
        });

        const health = handle.health({ requestId: `${requestId}:health` });
        const readinessProbe = handle.readiness({ requestId: `${requestId}:readiness` });
        const expectedRuntimeImplementationBundleSummary =
          summarizeRuntimeImplementationBundle(readyRuntimeImplementationBundle);

        record('read_service_probes');
        const runtimeBundleContinuityErrors = collectRuntimeBundleContinuityErrors({
          expected: expectedRuntimeImplementationBundleSummary,
          handle,
          health,
          readinessProbe,
        });
        if (runtimeBundleContinuityErrors.length > 0) {
          status = 'runtime_bundle_continuity_blocked';
          record('validate_service_runtime_bundle_continuity');
          record('return_response');

          const result: FinanceHttpPostgresManagedProjectServiceRuntimeAdmissionResult = {
            admissionErrors,
            dependencyAdmission,
            events: readRequestEvents(requestId),
            health,
            manifestErrors,
            readiness,
            readinessProbe,
            requestId,
            runtimeImplementation,
            runtimeImplementationBundle,
            secretProviderReadiness,
            status,
            traceErrors: runtimeBundleContinuityErrors,
          };

          return {
            ...result,
            traceErrors: validateFinanceHttpPostgresManagedProjectServiceRuntimeAdmissionTrace(result),
          };
        }

        record('validate_service_runtime_bundle_continuity');
        record('return_response');

        const result: FinanceHttpPostgresManagedProjectServiceRuntimeAdmissionResult = {
          admissionErrors,
          dependencyAdmission,
          events: readRequestEvents(requestId),
          handle,
          health,
          manifestErrors,
          readiness,
          readinessProbe,
          requestId,
          runtimeImplementation,
          runtimeImplementationBundle,
          secretProviderReadiness,
          status,
          traceErrors: [],
        };

        return {
          ...result,
          traceErrors: validateFinanceHttpPostgresManagedProjectServiceRuntimeAdmissionTrace(result),
        };
      } catch (error) {
        status = 'runtime_start_failed';
        record('return_response');

        const result: FinanceHttpPostgresManagedProjectServiceRuntimeAdmissionResult = {
          admissionErrors,
          dependencyAdmission,
          events: readRequestEvents(requestId),
          manifestErrors,
          readiness,
          requestId,
          runtimeImplementation,
          runtimeImplementationBundle,
          secretProviderReadiness,
          status,
          traceErrors: [error instanceof Error ? error.message : String(error)],
        };

        return {
          ...result,
          traceErrors: validateFinanceHttpPostgresManagedProjectServiceRuntimeAdmissionTrace(result),
        };
      }
    },
  };
}
