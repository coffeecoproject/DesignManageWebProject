import {
  createPeriodClosePostgresPoolFactoryContract,
  validatePeriodClosePostgresPoolFactoryTrace,
  validatePeriodClosePostgresPoolRuntimeConfig,
  type PeriodClosePostgresPoolConstructorLike,
  type PeriodClosePostgresPoolFactoryResult,
  type PeriodClosePostgresPoolFactoryStatus,
  type PeriodClosePostgresPoolFactoryRunInput,
  type PeriodClosePostgresRuntimeEnvironment
} from './periodClosePostgresPoolFactoryContract.js';
import type { PeriodClosePostgresDependencyAdmissionResult } from './periodClosePostgresDependencyAdmissionContract.js';
import type { PeriodClosePostgresSecretResolverContract } from './periodClosePostgresSecretResolverContract.js';

export type PeriodClosePostgresRuntimeModuleLike = {
  default?: unknown;
  Pool?: unknown;
};

export type PeriodClosePostgresRuntimeModuleLoader = () => Promise<PeriodClosePostgresRuntimeModuleLike>;

export type PeriodClosePostgresRuntimeImportStatus =
  | 'admission_blocked'
  | 'config_invalid'
  | 'loader_failed'
  | 'module_invalid'
  | PeriodClosePostgresPoolFactoryStatus;

export type PeriodClosePostgresRuntimeImportEventName =
  | 'delegate_pool_factory'
  | 'import_pg_module'
  | 'receive_request'
  | 'return_response'
  | 'validate_admission'
  | 'validate_config'
  | 'validate_pg_module'
  | 'validate_pool_factory_trace';

export type PeriodClosePostgresRuntimeImportEvent = {
  environment: PeriodClosePostgresRuntimeEnvironment;
  event: PeriodClosePostgresRuntimeImportEventName;
  period: string;
  requestId: string;
  sequence: number;
  transactionId: string;
};

export type PeriodClosePostgresRuntimeImportRunInput = PeriodClosePostgresPoolFactoryRunInput & {
  dependencyAdmission: PeriodClosePostgresDependencyAdmissionResult;
};

export type PeriodClosePostgresRuntimeImportResult = {
  admissionStatus: PeriodClosePostgresDependencyAdmissionResult['status'];
  configErrors: string[];
  environment: PeriodClosePostgresRuntimeEnvironment;
  factoryResult?: PeriodClosePostgresPoolFactoryResult;
  importErrors: string[];
  period: string;
  requestId: string;
  runtimeEvents: PeriodClosePostgresRuntimeImportEvent[];
  runtimeImportAllowed: boolean;
  status: PeriodClosePostgresRuntimeImportStatus;
  traceErrors: string[];
  transactionId: string;
};

export type PeriodClosePostgresRuntimeImportContract = {
  readRuntimeEvents: () => PeriodClosePostgresRuntimeImportEvent[];
  run: (input: PeriodClosePostgresRuntimeImportRunInput) => Promise<PeriodClosePostgresRuntimeImportResult>;
};

export async function loadPeriodClosePostgresRuntimeModule(): Promise<PeriodClosePostgresRuntimeModuleLike> {
  const moduleName = 'pg';

  return (await import(moduleName)) as PeriodClosePostgresRuntimeModuleLike;
}

function eventNames(events: readonly PeriodClosePostgresRuntimeImportEvent[]) {
  return events
    .slice()
    .sort((left, right) => left.sequence - right.sequence)
    .map((event) => event.event);
}

function isPoolConstructor(value: unknown): value is PeriodClosePostgresPoolConstructorLike {
  return typeof value === 'function';
}

function resolvePgPoolConstructor(
  moduleLike: PeriodClosePostgresRuntimeModuleLike
): { errors: string[]; PoolConstructor?: PeriodClosePostgresPoolConstructorLike } {
  const defaultExport = moduleLike.default;
  const defaultPool =
    typeof defaultExport === 'object' && defaultExport !== null
      ? (defaultExport as { Pool?: unknown }).Pool
      : undefined;
  const PoolConstructor = moduleLike.Pool ?? defaultPool;

  if (!isPoolConstructor(PoolConstructor)) {
    return {
      errors: ['period-close postgres runtime import must load a pg module with a Pool constructor']
    };
  }

  return {
    errors: [],
    PoolConstructor
  };
}

export function validatePeriodClosePostgresRuntimeImportTrace(
  result: PeriodClosePostgresRuntimeImportResult
): string[] {
  const errors = [...result.traceErrors];
  const events = result.runtimeEvents.slice().sort((left, right) => left.sequence - right.sequence);
  const names = eventNames(events);
  const receiveIndex = names.indexOf('receive_request');
  const admissionIndex = names.indexOf('validate_admission');
  const configIndex = names.indexOf('validate_config');
  const importIndex = names.indexOf('import_pg_module');
  const moduleIndex = names.indexOf('validate_pg_module');
  const delegateIndex = names.indexOf('delegate_pool_factory');
  const factoryValidateIndex = names.indexOf('validate_pool_factory_trace');
  const returnIndex = names.indexOf('return_response');

  if (receiveIndex !== 0) {
    errors.push(`${result.transactionId} postgres runtime import must receive request first`);
  }

  if (admissionIndex <= receiveIndex) {
    errors.push(`${result.transactionId} postgres runtime import must validate admission before config or import`);
  }

  if (!result.runtimeImportAllowed) {
    if (configIndex !== -1 || importIndex !== -1 || moduleIndex !== -1 || delegateIndex !== -1 || result.factoryResult) {
      errors.push(`${result.transactionId} blocked runtime import must not validate config, import pg, or run pool factory`);
    }
  } else if (result.configErrors.length > 0) {
    if (configIndex <= admissionIndex) {
      errors.push(`${result.transactionId} postgres runtime import must validate config after admission`);
    }

    if (importIndex !== -1 || moduleIndex !== -1 || delegateIndex !== -1 || result.factoryResult) {
      errors.push(`${result.transactionId} invalid config must not import pg or run pool factory`);
    }
  } else if (result.importErrors.length > 0) {
    if (importIndex <= configIndex) {
      errors.push(`${result.transactionId} postgres runtime import must import pg after config validation`);
    }

    if (delegateIndex !== -1 || result.factoryResult) {
      errors.push(`${result.transactionId} invalid pg module must not run pool factory`);
    }
  } else {
    if (importIndex <= configIndex) {
      errors.push(`${result.transactionId} postgres runtime import must import pg after config validation`);
    }

    if (moduleIndex <= importIndex) {
      errors.push(`${result.transactionId} postgres runtime import must validate pg module after import`);
    }

    if (delegateIndex <= moduleIndex) {
      errors.push(`${result.transactionId} postgres runtime import must delegate to pool factory after module validation`);
    }

    if (factoryValidateIndex <= delegateIndex) {
      errors.push(`${result.transactionId} postgres runtime import must validate pool factory trace after delegation`);
    }

    if (!result.factoryResult) {
      errors.push(`${result.transactionId} postgres runtime import must keep pool factory result after delegation`);
    }
  }

  if (returnIndex !== events.length - 1) {
    errors.push(`${result.transactionId} postgres runtime import must return response last`);
  }

  if (events.some((event) => event.environment !== result.environment)) {
    errors.push(`${result.transactionId} postgres runtime import events must keep one runtime environment`);
  }

  if (events.some((event) => event.period !== result.period)) {
    errors.push(`${result.transactionId} postgres runtime import events must keep one accounting period`);
  }

  if (events.some((event) => event.requestId !== result.requestId)) {
    errors.push(`${result.transactionId} postgres runtime import events must keep one request id`);
  }

  if (events.some((event) => event.transactionId !== result.transactionId)) {
    errors.push(`${result.transactionId} postgres runtime import events must keep one transaction id`);
  }

  if (result.factoryResult) {
    errors.push(...validatePeriodClosePostgresPoolFactoryTrace(result.factoryResult));
  }

  return errors;
}

export function createPeriodClosePostgresRuntimeImportContract({
  loadPgModule = loadPeriodClosePostgresRuntimeModule,
  secretResolver
}: {
  loadPgModule?: PeriodClosePostgresRuntimeModuleLoader;
  secretResolver?: PeriodClosePostgresSecretResolverContract;
} = {}): PeriodClosePostgresRuntimeImportContract {
  const runtimeEvents: PeriodClosePostgresRuntimeImportEvent[] = [];

  function record({
    environment,
    event,
    period,
    requestId,
    transactionId
  }: Omit<PeriodClosePostgresRuntimeImportEvent, 'sequence'>) {
    runtimeEvents.push({
      environment,
      event,
      period,
      requestId,
      sequence: runtimeEvents.length + 1,
      transactionId
    });
  }

  function readTransactionEvents(transactionId: string) {
    return runtimeEvents
      .filter((event) => event.transactionId === transactionId)
      .map((event) => ({ ...event }));
  }

  return {
    readRuntimeEvents: () => runtimeEvents.map((event) => ({ ...event })),
    run: async ({ config, dependencyAdmission, operation, period, requestId, statements, transactionId }) => {
      const baseEvent = {
        environment: config.environment,
        period,
        requestId,
        transactionId
      };

      record({ ...baseEvent, event: 'receive_request' });
      record({ ...baseEvent, event: 'validate_admission' });

      if (!dependencyAdmission.runtimeImportAllowed || dependencyAdmission.status !== 'admitted') {
        record({ ...baseEvent, event: 'return_response' });

        return {
          admissionStatus: dependencyAdmission.status,
          configErrors: [],
          environment: config.environment,
          importErrors: ['period-close postgres runtime import is blocked by dependency admission gates'],
          period,
          requestId,
          runtimeEvents: readTransactionEvents(transactionId),
          runtimeImportAllowed: false,
          status: 'admission_blocked',
          traceErrors: [],
          transactionId
        };
      }

      record({ ...baseEvent, event: 'validate_config' });

      const configErrors = validatePeriodClosePostgresPoolRuntimeConfig(config);

      if (configErrors.length > 0) {
        record({ ...baseEvent, event: 'return_response' });

        return {
          admissionStatus: dependencyAdmission.status,
          configErrors,
          environment: config.environment,
          importErrors: [],
          period,
          requestId,
          runtimeEvents: readTransactionEvents(transactionId),
          runtimeImportAllowed: true,
          status: 'config_invalid',
          traceErrors: [],
          transactionId
        };
      }

      record({ ...baseEvent, event: 'import_pg_module' });

      let pgModule: PeriodClosePostgresRuntimeModuleLike;

      try {
        pgModule = await loadPgModule();
      } catch (error) {
        record({ ...baseEvent, event: 'return_response' });

        return {
          admissionStatus: dependencyAdmission.status,
          configErrors,
          environment: config.environment,
          importErrors: [error instanceof Error ? error.message : 'period-close postgres runtime module import failed'],
          period,
          requestId,
          runtimeEvents: readTransactionEvents(transactionId),
          runtimeImportAllowed: true,
          status: 'loader_failed',
          traceErrors: [],
          transactionId
        };
      }

      record({ ...baseEvent, event: 'validate_pg_module' });

      const { errors: importErrors, PoolConstructor } = resolvePgPoolConstructor(pgModule);

      if (importErrors.length > 0 || !PoolConstructor) {
        record({ ...baseEvent, event: 'return_response' });

        return {
          admissionStatus: dependencyAdmission.status,
          configErrors,
          environment: config.environment,
          importErrors,
          period,
          requestId,
          runtimeEvents: readTransactionEvents(transactionId),
          runtimeImportAllowed: true,
          status: 'module_invalid',
          traceErrors: [],
          transactionId
        };
      }

      const poolFactory = createPeriodClosePostgresPoolFactoryContract({ PoolConstructor, secretResolver });

      record({ ...baseEvent, event: 'delegate_pool_factory' });

      const factoryResult = await poolFactory.run({ config, operation, period, requestId, statements, transactionId });

      record({ ...baseEvent, event: 'validate_pool_factory_trace' });
      record({ ...baseEvent, event: 'return_response' });

      const result: PeriodClosePostgresRuntimeImportResult = {
        admissionStatus: dependencyAdmission.status,
        configErrors,
        environment: config.environment,
        factoryResult,
        importErrors,
        period,
        requestId,
        runtimeEvents: readTransactionEvents(transactionId),
        runtimeImportAllowed: true,
        status: factoryResult.status,
        traceErrors: factoryResult.traceErrors,
        transactionId
      };
      const traceErrors = validatePeriodClosePostgresRuntimeImportTrace(result);

      return {
        ...result,
        status: traceErrors.length > 0 ? 'trace_invalid' : result.status,
        traceErrors
      };
    }
  };
}
