import {
  evaluatePeriodClosePostgresDependencyAdmission,
  validatePeriodClosePostgresDependencyAdmission,
  type PeriodClosePostgresDependencyAdmissionInput,
  type PeriodClosePostgresDependencyAdmissionResult
} from './periodClosePostgresDependencyAdmissionContract.js';
import type { PeriodClosePostgresClientPortRunInput } from './periodClosePostgresClientPortContract.js';
import {
  createPeriodClosePostgresRuntimeImportContract,
  validatePeriodClosePostgresRuntimeImportTrace,
  type PeriodClosePostgresRuntimeImportResult,
  type PeriodClosePostgresRuntimeImportStatus,
  type PeriodClosePostgresRuntimeModuleLoader
} from './periodClosePostgresRuntimeImportContract.js';
import type {
  PeriodClosePostgresRuntimeEnvironment
} from './periodClosePostgresPoolFactoryContract.js';
import {
  derivePeriodClosePostgresRuntimeReadiness,
  type PeriodClosePostgresRuntimeReadinessPackage,
  type PeriodClosePostgresRuntimeReadinessResult
} from './periodClosePostgresRuntimeReadinessPackageContract.js';
import type { PeriodClosePostgresSecretResolverContract } from './periodClosePostgresSecretResolverContract.js';

export type PeriodClosePostgresRuntimeAdmissionOrchestratorStatus =
  | 'admission_invalid'
  | 'readiness_blocked'
  | PeriodClosePostgresRuntimeImportStatus;

export type PeriodClosePostgresRuntimeAdmissionOrchestratorEventName =
  | 'delegate_runtime_import'
  | 'derive_runtime_readiness'
  | 'evaluate_dependency_admission'
  | 'receive_request'
  | 'return_response'
  | 'validate_dependency_admission'
  | 'validate_runtime_readiness'
  | 'validate_runtime_import_trace';

export type PeriodClosePostgresRuntimeAdmissionOrchestratorEnvironment =
  | PeriodClosePostgresRuntimeEnvironment
  | 'unselected';

export type PeriodClosePostgresRuntimeAdmissionOrchestratorEvent = {
  environment: PeriodClosePostgresRuntimeAdmissionOrchestratorEnvironment;
  event: PeriodClosePostgresRuntimeAdmissionOrchestratorEventName;
  period: string;
  requestId: string;
  sequence: number;
  transactionId: string;
};

export type PeriodClosePostgresRuntimeAdmissionOrchestratorRunInput =
  PeriodClosePostgresClientPortRunInput &
    Omit<PeriodClosePostgresDependencyAdmissionInput, 'runtimeEvidence'> & {
      readinessPackage: PeriodClosePostgresRuntimeReadinessPackage;
    };

export type PeriodClosePostgresRuntimeAdmissionOrchestratorResult = {
  admissionErrors: string[];
  dependencyAdmission: PeriodClosePostgresDependencyAdmissionResult;
  environment: PeriodClosePostgresRuntimeAdmissionOrchestratorEnvironment;
  orchestratorEvents: PeriodClosePostgresRuntimeAdmissionOrchestratorEvent[];
  readiness: PeriodClosePostgresRuntimeReadinessResult;
  period: string;
  requestId: string;
  runtimeImportResult?: PeriodClosePostgresRuntimeImportResult;
  status: PeriodClosePostgresRuntimeAdmissionOrchestratorStatus;
  traceErrors: string[];
  transactionId: string;
};

export type PeriodClosePostgresRuntimeAdmissionOrchestratorContract = {
  readEvents: () => PeriodClosePostgresRuntimeAdmissionOrchestratorEvent[];
  run: (
    input: PeriodClosePostgresRuntimeAdmissionOrchestratorRunInput
  ) => Promise<PeriodClosePostgresRuntimeAdmissionOrchestratorResult>;
};

function eventNames(events: readonly PeriodClosePostgresRuntimeAdmissionOrchestratorEvent[]) {
  return events
    .slice()
    .sort((left, right) => left.sequence - right.sequence)
    .map((event) => event.event);
}

export function validatePeriodClosePostgresRuntimeAdmissionOrchestratorTrace(
  result: PeriodClosePostgresRuntimeAdmissionOrchestratorResult
): string[] {
  const errors = [...result.traceErrors];
  const events = result.orchestratorEvents.slice().sort((left, right) => left.sequence - right.sequence);
  const names = eventNames(events);
  const receiveIndex = names.indexOf('receive_request');
  const deriveReadinessIndex = names.indexOf('derive_runtime_readiness');
  const validateReadinessIndex = names.indexOf('validate_runtime_readiness');
  const evaluateIndex = names.indexOf('evaluate_dependency_admission');
  const validateAdmissionIndex = names.indexOf('validate_dependency_admission');
  const delegateIndex = names.indexOf('delegate_runtime_import');
  const validateRuntimeIndex = names.indexOf('validate_runtime_import_trace');
  const returnIndex = names.indexOf('return_response');

  if (receiveIndex !== 0) {
    errors.push(`${result.transactionId} postgres runtime admission orchestrator must receive request first`);
  }

  if (deriveReadinessIndex <= receiveIndex) {
    errors.push(`${result.transactionId} postgres runtime admission orchestrator must derive runtime readiness after receiving request`);
  }

  if (validateReadinessIndex <= deriveReadinessIndex) {
    errors.push(`${result.transactionId} postgres runtime admission orchestrator must validate runtime readiness before dependency admission`);
  }

  if (evaluateIndex <= validateReadinessIndex) {
    errors.push(`${result.transactionId} postgres runtime admission orchestrator must evaluate dependency admission after readiness validation`);
  }

  if (validateAdmissionIndex <= evaluateIndex) {
    errors.push(`${result.transactionId} postgres runtime admission orchestrator must validate dependency admission before delegation`);
  }

  if (result.admissionErrors.length > 0 || result.readiness.status !== 'ready' || !result.readiness.poolConfig) {
    if (delegateIndex !== -1 || validateRuntimeIndex !== -1 || result.runtimeImportResult) {
      errors.push(`${result.transactionId} blocked readiness or invalid admission must not delegate to runtime import`);
    }
  } else {
    if (delegateIndex <= validateAdmissionIndex) {
      errors.push(`${result.transactionId} postgres runtime admission orchestrator must delegate after admission validation`);
    }

    if (validateRuntimeIndex <= delegateIndex) {
      errors.push(`${result.transactionId} postgres runtime admission orchestrator must validate runtime import trace after delegation`);
    }

    if (!result.runtimeImportResult) {
      errors.push(`${result.transactionId} postgres runtime admission orchestrator must retain runtime import result after delegation`);
    }
  }

  if (returnIndex !== events.length - 1) {
    errors.push(`${result.transactionId} postgres runtime admission orchestrator must return response last`);
  }

  if (events.some((event) => event.environment !== result.environment)) {
    errors.push(`${result.transactionId} postgres runtime admission orchestrator events must keep one runtime environment`);
  }

  if (events.some((event) => event.period !== result.period)) {
    errors.push(`${result.transactionId} postgres runtime admission orchestrator events must keep one accounting period`);
  }

  if (events.some((event) => event.requestId !== result.requestId)) {
    errors.push(`${result.transactionId} postgres runtime admission orchestrator events must keep one request id`);
  }

  if (events.some((event) => event.transactionId !== result.transactionId)) {
    errors.push(`${result.transactionId} postgres runtime admission orchestrator events must keep one transaction id`);
  }

  if (result.runtimeImportResult) {
    errors.push(...validatePeriodClosePostgresRuntimeImportTrace(result.runtimeImportResult));

    if (result.runtimeImportResult.admissionStatus !== result.dependencyAdmission.status) {
      errors.push(`${result.transactionId} runtime import must use orchestrator-owned dependency admission`);
    }
  }

  return errors;
}

function environmentFromReadinessPackage(
  readinessPackage: PeriodClosePostgresRuntimeReadinessPackage
): PeriodClosePostgresRuntimeAdmissionOrchestratorEnvironment {
  if (readinessPackage.targetDatabase.environment) {
    return readinessPackage.targetDatabase.environment;
  }

  switch (readinessPackage.targetDatabase.selectedEnvironment) {
    case 'local_drill_only':
      return 'local';
    case 'shared_staging':
      return 'staging';
    case 'production':
      return 'production';
    default:
      return 'unselected';
  }
}

export function createPeriodClosePostgresRuntimeAdmissionOrchestratorContract({
  loadPgModule,
  secretResolver
}: {
  loadPgModule?: PeriodClosePostgresRuntimeModuleLoader;
  secretResolver?: PeriodClosePostgresSecretResolverContract;
} = {}): PeriodClosePostgresRuntimeAdmissionOrchestratorContract {
  const orchestratorEvents: PeriodClosePostgresRuntimeAdmissionOrchestratorEvent[] = [];

  function record({
    environment,
    event,
    period,
    requestId,
    transactionId
  }: Omit<PeriodClosePostgresRuntimeAdmissionOrchestratorEvent, 'sequence'>) {
    orchestratorEvents.push({
      environment,
      event,
      period,
      requestId,
      sequence: orchestratorEvents.length + 1,
      transactionId
    });
  }

  function readTransactionEvents(transactionId: string) {
    return orchestratorEvents
      .filter((event) => event.transactionId === transactionId)
      .map((event) => ({ ...event }));
  }

  return {
    readEvents: () => orchestratorEvents.map((event) => ({ ...event })),
    run: async ({
      apiPackageManifest,
      apiPackageManifestPath,
      lockfilePath,
      lockfileText,
      operation,
      period,
      readinessPackage,
      requestId,
      statements,
      transactionId
    }) => {
      const environment = environmentFromReadinessPackage(readinessPackage);
      const baseEvent = {
        environment,
        period,
        requestId,
        transactionId
      };

      record({ ...baseEvent, event: 'receive_request' });
      record({ ...baseEvent, event: 'derive_runtime_readiness' });

      const readiness = derivePeriodClosePostgresRuntimeReadiness(readinessPackage);

      record({ ...baseEvent, event: 'validate_runtime_readiness' });
      record({ ...baseEvent, event: 'evaluate_dependency_admission' });

      const dependencyAdmission = evaluatePeriodClosePostgresDependencyAdmission({
        apiPackageManifest,
        apiPackageManifestPath,
        lockfilePath,
        lockfileText,
        runtimeEvidence: readiness.runtimeEvidence
      });

      record({ ...baseEvent, event: 'validate_dependency_admission' });

      const admissionErrors = validatePeriodClosePostgresDependencyAdmission(dependencyAdmission);

      if (admissionErrors.length > 0 || readiness.status !== 'ready' || !readiness.poolConfig) {
        record({ ...baseEvent, event: 'return_response' });

        const result: PeriodClosePostgresRuntimeAdmissionOrchestratorResult = {
          admissionErrors,
          dependencyAdmission,
          environment,
          orchestratorEvents: readTransactionEvents(transactionId),
          period,
          readiness,
          requestId,
          status: admissionErrors.length > 0 ? 'admission_invalid' : 'readiness_blocked',
          traceErrors: [],
          transactionId
        };
        const traceErrors = validatePeriodClosePostgresRuntimeAdmissionOrchestratorTrace(result);

        return {
          ...result,
          traceErrors
        };
      }

      const runtimeImport = createPeriodClosePostgresRuntimeImportContract({ loadPgModule, secretResolver });

      record({ ...baseEvent, event: 'delegate_runtime_import' });

      const runtimeImportResult = await runtimeImport.run({
        config: readiness.poolConfig,
        dependencyAdmission,
        operation,
        period,
        requestId,
        statements,
        transactionId
      });

      record({ ...baseEvent, event: 'validate_runtime_import_trace' });
      record({ ...baseEvent, event: 'return_response' });

      const result: PeriodClosePostgresRuntimeAdmissionOrchestratorResult = {
        admissionErrors,
        dependencyAdmission,
        environment,
        orchestratorEvents: readTransactionEvents(transactionId),
        period,
        readiness,
        requestId,
        runtimeImportResult,
        status: runtimeImportResult.status,
        traceErrors: runtimeImportResult.traceErrors,
        transactionId
      };
      const traceErrors = validatePeriodClosePostgresRuntimeAdmissionOrchestratorTrace(result);

      return {
        ...result,
        status: traceErrors.length > 0 ? 'trace_invalid' : result.status,
        traceErrors
      };
    }
  };
}
