import type {
  FinanceHttpConcreteFrameworkRequest,
} from './financeHttpConcreteFrameworkAdapterContract.js';
import type {
  FinanceHttpAuthenticatedPrincipal,
} from './financeHttpAuthMiddlewareContract.js';
import {
  createFinanceHttpPostgresManagedProjectApiServerWiringContract,
  type FinanceHttpPostgresManagedProjectApiServerResponse,
  type FinanceHttpPostgresManagedProjectApiServerWiringSummary,
} from './financeHttpPostgresManagedProjectApiServerWiringContract.js';
import {
  createFinanceHttpPostgresManagedSourceMutationFrameworkAdapter,
} from './financeHttpPostgresManagedSourceMutationFrameworkAdapterContract.js';
import {
  summarizeRuntimeImplementationBundle,
  type FinanceHttpPostgresManagedProjectServiceProcessRuntimeBundleSummary,
} from './financeHttpPostgresManagedProjectServiceProcessRuntimeContract.js';
import type {
  FinanceHttpServerRuntimeIdentityRequest,
} from './financeHttpServerRuntimeContract.js';
import type { FinanceHttpServerHandler } from './financeHttpServerHandlerContract.js';
import {
  evaluatePeriodClosePostgresDependencyAdmission,
  validatePeriodClosePostgresDependencyAdmission,
  type PeriodClosePostgresDependencyAdmissionResult,
} from './periodClosePostgresDependencyAdmissionContract.js';
import {
  type PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput,
  type PeriodClosePostgresManagedServicePoolRuntimeContract,
  type PeriodClosePostgresManagedServicePoolShutdownResult,
} from './periodClosePostgresManagedServicePoolRuntimeContract.js';
import {
  derivePeriodClosePostgresRuntimeReadiness,
  type PeriodClosePostgresRuntimeReadinessResult,
} from './periodClosePostgresRuntimeReadinessPackageContract.js';
import type {
  FinanceSourceTableSqlRepositoryContract,
} from './periodCloseSourceTableSqlRepositoryContract.js';

export type FinanceHttpPostgresManagedProjectRuntimeProcessStartupStatus =
  | 'active'
  | 'blocked_by_dependency_admission'
  | 'blocked_by_runtime_bundle'
  | 'blocked_by_runtime_readiness';

export type FinanceHttpPostgresManagedProjectRuntimeProcessLifecycleState =
  | FinanceHttpPostgresManagedProjectRuntimeProcessStartupStatus
  | 'closed';

export type FinanceHttpPostgresManagedProjectRuntimeProcessEventName =
  | 'derive_runtime_readiness'
  | 'evaluate_dependency_admission'
  | 'validate_runtime_implementation_bundle'
  | 'construct_source_mutation_framework_adapter'
  | 'construct_project_api_server_wiring'
  | 'receive_framework_request'
  | 'delegate_project_api_server_wiring'
  | 'reject_framework_request'
  | 'shutdown_managed_runtime'
  | 'return_framework_response';

export type FinanceHttpPostgresManagedProjectRuntimeProcessEvent = {
  event: FinanceHttpPostgresManagedProjectRuntimeProcessEventName;
  lifecycleState: FinanceHttpPostgresManagedProjectRuntimeProcessLifecycleState;
  processName: string;
  requestId: string;
  sequence: number;
};

export type FinanceHttpPostgresManagedProjectRuntimeProcessSummary = {
  dependencyAdmission: PeriodClosePostgresDependencyAdmissionResult;
  directFinanceHandlerRegistered: boolean;
  lifecycleState: FinanceHttpPostgresManagedProjectRuntimeProcessLifecycleState;
  processName: string;
  projectApiServerConstructed: boolean;
  productionServerBound: boolean;
  readiness: PeriodClosePostgresRuntimeReadinessResult;
  routes: FinanceHttpPostgresManagedProjectApiServerWiringSummary['routes'];
  runtimeBundleErrors: string[];
  runtimeImplementationBundle?: FinanceHttpPostgresManagedProjectServiceProcessRuntimeBundleSummary;
  sourceSqlRowCount: number;
};

export type FinanceHttpPostgresManagedProjectRuntimeProcessResponse =
  FinanceHttpPostgresManagedProjectApiServerResponse & {
    processTrace: FinanceHttpPostgresManagedProjectRuntimeProcessEvent[];
  };

export type FinanceHttpPostgresManagedProjectRuntimeProcessShutdownResult = {
  lifecycleState: FinanceHttpPostgresManagedProjectRuntimeProcessLifecycleState;
  processTrace: FinanceHttpPostgresManagedProjectRuntimeProcessEvent[];
  runtimeShutdown: PeriodClosePostgresManagedServicePoolShutdownResult;
};

export type FinanceHttpPostgresManagedProjectRuntimeProcessContract = {
  getProcessSummary: () => FinanceHttpPostgresManagedProjectRuntimeProcessSummary;
  handleConcreteFrameworkRequest: (
    request: FinanceHttpConcreteFrameworkRequest,
  ) => Promise<FinanceHttpPostgresManagedProjectRuntimeProcessResponse>;
  readProcessEvents: () => FinanceHttpPostgresManagedProjectRuntimeProcessEvent[];
  shutdown: (input: { requestId: string }) => Promise<FinanceHttpPostgresManagedProjectRuntimeProcessShutdownResult>;
};

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

function createRequestUrl(request: FinanceHttpConcreteFrameworkRequest) {
  return request.originalUrl ?? request.url ?? request.pathname ?? request.path ?? '/';
}

function createRouteBlockedResponse({
  code,
  message,
}: {
  code: string;
  message: string;
}): FinanceHttpPostgresManagedProjectApiServerResponse {
  const bodyText = JSON.stringify({ code, message });

  return {
    bodyText,
    handled: true,
    headers: {
      ...JSON_HEADERS,
      'x-finance-local-managed-application-route-plugin-delegated': 'false',
      'x-finance-local-managed-application-route-plugin-framework': 'not-constructed',
      'x-finance-local-managed-application-route-plugin-matched': 'false',
      'x-finance-local-managed-application-route-plugin-prefix': '/api/finance',
    },
    pluginTrace: {
      adapterKind: 'local_http_managed_postgres_application_framework_route_plugin_contract',
      delegatedToApplicationAdapter: false,
      frameworkName: 'not-constructed',
      handled: true,
      matched: false,
      method: 'N/A',
      routePrefix: '/api/finance',
      url: '/',
    },
    projectServerTrace: {
      adapterKind: 'local_http_managed_postgres_project_api_server_wiring_contract',
      delegatedToRoutePlugin: false,
      directFinanceHandlerRegistered: false,
      frameworkName: 'not-constructed',
      handled: true,
      method: 'N/A',
      methodAllowed: false,
      productionServerBound: false,
      routeMatched: false,
      routePrefix: '/api/finance',
      url: '/',
    },
    status: 503,
  };
}

function cloneProcessEvent(
  event: FinanceHttpPostgresManagedProjectRuntimeProcessEvent,
): FinanceHttpPostgresManagedProjectRuntimeProcessEvent {
  return { ...event };
}

function determineStartupStatus({
  dependencyAdmission,
  readiness,
  runtimeBundleErrors,
}: {
  dependencyAdmission: PeriodClosePostgresDependencyAdmissionResult;
  readiness: PeriodClosePostgresRuntimeReadinessResult;
  runtimeBundleErrors: readonly string[];
}): FinanceHttpPostgresManagedProjectRuntimeProcessStartupStatus {
  if (readiness.status !== 'ready') {
    return 'blocked_by_runtime_readiness';
  }

  const dependencyErrors = validatePeriodClosePostgresDependencyAdmission(dependencyAdmission);
  if (dependencyAdmission.status !== 'admitted' || dependencyErrors.length > 0) {
    return 'blocked_by_dependency_admission';
  }

  if (runtimeBundleErrors.length > 0) {
    return 'blocked_by_runtime_bundle';
  }

  return 'active';
}

function runtimeConfigFingerprint(config: NonNullable<PeriodClosePostgresRuntimeReadinessResult['poolConfig']>) {
  return JSON.stringify(
    Object.keys(config)
      .sort()
      .reduce<Record<string, unknown>>((fingerprint, key) => {
        fingerprint[key] = config[key as keyof typeof config];
        return fingerprint;
      }, {}),
  );
}

function validateRuntimeImplementationBundleForProjectRuntime({
  admission,
  readiness,
}: {
  admission: PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput;
  readiness: PeriodClosePostgresRuntimeReadinessResult;
}) {
  const errors: string[] = [];
  const bundle = admission.runtimeImplementationBundle;

  if (!bundle.managedServicePoolRuntimeModulePath.trim()) {
    errors.push('project runtime bundle managed service pool runtime module path is required');
  }
  if (!bundle.runtimeImportModulePath.trim()) {
    errors.push('project runtime bundle runtime import module path is required');
  }
  if (!bundle.sourceMutationBridgeModulePath.trim()) {
    errors.push('project runtime bundle source mutation bridge module path is required');
  }
  if (!bundle.serviceRuntimeAdmissionEvidenceId.trim()) {
    errors.push('project runtime bundle service runtime admission evidence id is required');
  }
  if (readiness.status === 'ready' && readiness.poolConfig) {
    const readinessFingerprint = runtimeConfigFingerprint(readiness.poolConfig);
    const bundleFingerprint = runtimeConfigFingerprint(bundle.poolConfig);

    if (readinessFingerprint !== bundleFingerprint) {
      errors.push('project runtime bundle pool config must match derived readiness pool config');
    }
  }

  return errors;
}

export function createFinanceHttpPostgresManagedProjectRuntimeProcessContract({
  admission,
  fallbackHandler,
  frameworkName = 'local-managed-project-runtime-process',
  maxBodyBytes,
  now,
  processName = 'finance-period-close-api-process',
  requestIdFactory,
  resolvePrincipal,
  runtime,
  sourceSqlRepository,
}: {
  admission: PeriodClosePostgresManagedServicePoolRuntimeAdmissionInput;
  fallbackHandler: FinanceHttpServerHandler;
  frameworkName?: string;
  maxBodyBytes?: number;
  now?: () => string;
  processName?: string;
  requestIdFactory?: () => string;
  resolvePrincipal: (request: FinanceHttpServerRuntimeIdentityRequest) => FinanceHttpAuthenticatedPrincipal | undefined;
  runtime: PeriodClosePostgresManagedServicePoolRuntimeContract;
  sourceSqlRepository: FinanceSourceTableSqlRepositoryContract;
}): FinanceHttpPostgresManagedProjectRuntimeProcessContract {
  const processEvents: FinanceHttpPostgresManagedProjectRuntimeProcessEvent[] = [];
  const readiness = derivePeriodClosePostgresRuntimeReadiness(admission.readinessPackage);
  const dependencyAdmission = evaluatePeriodClosePostgresDependencyAdmission({
    apiPackageManifest: admission.apiPackageManifest,
    apiPackageManifestPath: admission.apiPackageManifestPath,
    lockfilePath: admission.lockfilePath,
    lockfileText: admission.lockfileText,
    runtimeEvidence: readiness.runtimeEvidence,
  });
  const runtimeBundleErrors = validateRuntimeImplementationBundleForProjectRuntime({ admission, readiness });
  const runtimeImplementationBundleSummary =
    runtimeBundleErrors.length === 0 && readiness.status === 'ready'
      ? summarizeRuntimeImplementationBundle(admission.runtimeImplementationBundle)
      : undefined;
  const startupStatus = determineStartupStatus({ dependencyAdmission, readiness, runtimeBundleErrors });
  let lifecycleState: FinanceHttpPostgresManagedProjectRuntimeProcessLifecycleState = startupStatus;

  function record({
    event,
    requestId,
  }: {
    event: FinanceHttpPostgresManagedProjectRuntimeProcessEventName;
    requestId: string;
  }) {
    processEvents.push({
      event,
      lifecycleState,
      processName,
      requestId,
      sequence: processEvents.length + 1,
    });
  }

  record({ event: 'derive_runtime_readiness', requestId: 'startup' });
  record({ event: 'evaluate_dependency_admission', requestId: 'startup' });
  record({ event: 'validate_runtime_implementation_bundle', requestId: 'startup' });

  const managedSourceMutationAdapter =
    startupStatus === 'active'
      ? createFinanceHttpPostgresManagedSourceMutationFrameworkAdapter({
          admission,
          frameworkName: `${frameworkName}-source-mutation-framework`,
          ...(maxBodyBytes === undefined ? {} : { maxBodyBytes }),
          ...(now === undefined ? {} : { now }),
          ...(requestIdFactory === undefined ? {} : { requestIdFactory }),
          resolvePrincipal,
          runtime,
          sourceSqlRepository,
        })
      : undefined;

  if (managedSourceMutationAdapter) {
    record({ event: 'construct_source_mutation_framework_adapter', requestId: 'startup' });
  }

  const projectApiServer =
    managedSourceMutationAdapter === undefined
      ? undefined
      : createFinanceHttpPostgresManagedProjectApiServerWiringContract({
          fallbackHandler,
          frameworkName,
          managedSourceMutationAdapter,
        });

  if (projectApiServer) {
    record({ event: 'construct_project_api_server_wiring', requestId: 'startup' });
  }

  function blockedResponseForCurrentState() {
    if (lifecycleState === 'closed') {
      return createRouteBlockedResponse({
        code: 'FINANCE_PROJECT_RUNTIME_PROCESS_CLOSED',
        message: '财务项目 API 进程已关闭，不能继续处理请求。',
      });
    }

    if (lifecycleState === 'blocked_by_dependency_admission') {
      return createRouteBlockedResponse({
        code: 'FINANCE_PROJECT_RUNTIME_DEPENDENCY_ADMISSION_BLOCKED',
        message: '财务项目 API 进程依赖准入未通过，未构造项目 API server。',
      });
    }

    if (lifecycleState === 'blocked_by_runtime_bundle') {
      return createRouteBlockedResponse({
        code: 'FINANCE_PROJECT_RUNTIME_BUNDLE_BLOCKED',
        message: '财务项目 API 进程运行时实现包未通过，未构造项目 API server。',
      });
    }

    return createRouteBlockedResponse({
      code: 'FINANCE_PROJECT_RUNTIME_READINESS_BLOCKED',
      message: '财务项目 API 进程运行时证据未就绪，未构造项目 API server。',
    });
  }

  return {
    getProcessSummary: () => {
      const projectSummary = projectApiServer?.getWiringSummary();

      return {
        dependencyAdmission,
        directFinanceHandlerRegistered: projectSummary?.directFinanceHandlerRegistered ?? false,
        lifecycleState,
        processName,
        projectApiServerConstructed: Boolean(projectApiServer),
        productionServerBound: projectSummary?.productionServerBound ?? false,
        readiness,
        routes: projectSummary?.routes ?? [],
        runtimeBundleErrors: [...runtimeBundleErrors],
        ...(runtimeImplementationBundleSummary === undefined
          ? {}
          : { runtimeImplementationBundle: runtimeImplementationBundleSummary }),
        sourceSqlRowCount: sourceSqlRepository.readSqlRows().length,
      };
    },
    handleConcreteFrameworkRequest: async (request) => {
      const requestId = requestIdFactory?.() ?? 'project-runtime-process-request';
      record({ event: 'receive_framework_request', requestId });

      if (!projectApiServer || lifecycleState !== 'active') {
        record({ event: 'reject_framework_request', requestId });
        record({ event: 'return_framework_response', requestId });

        return {
          ...blockedResponseForCurrentState(),
          processTrace: processEvents.map(cloneProcessEvent),
        };
      }

      record({ event: 'delegate_project_api_server_wiring', requestId });
      const response = await projectApiServer.handleConcreteFrameworkRequest(request);
      record({ event: 'return_framework_response', requestId });

      return {
        ...response,
        projectServerTrace: {
          ...response.projectServerTrace,
          url: createRequestUrl(request),
        },
        processTrace: processEvents.map(cloneProcessEvent),
      };
    },
    readProcessEvents: () => processEvents.map(cloneProcessEvent),
    shutdown: async ({ requestId }) => {
      record({ event: 'shutdown_managed_runtime', requestId });
      const runtimeShutdown = await runtime.shutdown({ requestId });
      lifecycleState = 'closed';
      record({ event: 'return_framework_response', requestId });

      return {
        lifecycleState,
        processTrace: processEvents.map(cloneProcessEvent),
        runtimeShutdown,
      };
    },
  };
}

export function validateFinanceHttpPostgresManagedProjectRuntimeProcessSummary(
  summary: FinanceHttpPostgresManagedProjectRuntimeProcessSummary,
) {
  const errors: string[] = [];

  if (summary.productionServerBound) {
    errors.push('PROJECT_RUNTIME_PROCESS_MUST_NOT_BIND_PRODUCTION_SERVER');
  }
  if (summary.directFinanceHandlerRegistered) {
    errors.push('PROJECT_RUNTIME_PROCESS_DIRECT_FINANCE_HANDLER_FORBIDDEN');
  }
  if (summary.lifecycleState === 'active' && !summary.projectApiServerConstructed) {
    errors.push('PROJECT_RUNTIME_PROCESS_ACTIVE_SERVER_MISSING');
  }
  if (summary.lifecycleState !== 'active' && summary.projectApiServerConstructed) {
    errors.push('PROJECT_RUNTIME_PROCESS_BLOCKED_SERVER_MUST_NOT_BE_CONSTRUCTED');
  }
  if (summary.lifecycleState === 'active' && summary.routes.length !== 1) {
    errors.push('PROJECT_RUNTIME_PROCESS_ACTIVE_ROUTE_COUNT_INVALID');
  }
  if (summary.lifecycleState === 'active' && summary.runtimeBundleErrors.length > 0) {
    errors.push('PROJECT_RUNTIME_PROCESS_ACTIVE_BUNDLE_ERRORS');
  }
  if (summary.lifecycleState === 'active' && summary.runtimeImplementationBundle === undefined) {
    errors.push('PROJECT_RUNTIME_PROCESS_ACTIVE_BUNDLE_MISSING');
  }
  if (summary.lifecycleState !== 'active' && summary.runtimeImplementationBundle !== undefined) {
    errors.push('PROJECT_RUNTIME_PROCESS_BLOCKED_BUNDLE_MUST_NOT_BE_EXPOSED');
  }
  if (summary.lifecycleState === 'blocked_by_runtime_bundle' && summary.runtimeBundleErrors.length === 0) {
    errors.push('PROJECT_RUNTIME_PROCESS_BUNDLE_BLOCKED_WITHOUT_ERRORS');
  }
  if (
    summary.lifecycleState === 'active' &&
    summary.readiness.poolConfig &&
    summary.runtimeImplementationBundle &&
    runtimeConfigFingerprint(summary.readiness.poolConfig) !== summary.runtimeImplementationBundle.poolConfigFingerprint
  ) {
    errors.push('PROJECT_RUNTIME_PROCESS_BUNDLE_POOL_CONFIG_DRIFT');
  }

  return {
    errors,
    ok: errors.length === 0,
  };
}
