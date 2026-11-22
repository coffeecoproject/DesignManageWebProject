import {
  evaluatePeriodClosePostgresDependencyAdmission,
  validatePeriodClosePostgresDependencyAdmission,
  type PeriodClosePostgresDependencyAdmissionInput,
  type PeriodClosePostgresDependencyAdmissionResult
} from './periodClosePostgresDependencyAdmissionContract.js';
import {
  evaluatePeriodClosePostgresRuntimeImplementationManifest,
  type PeriodClosePostgresRuntimeImplementationManifest,
  type PeriodClosePostgresRuntimeImplementationResult
} from './periodClosePostgresRuntimeImplementationManifestContract.js';
import {
  validatePeriodClosePostgresPoolRuntimeConfig,
  type PeriodClosePostgresPoolRuntimeConfig
} from './periodClosePostgresPoolFactoryContract.js';

export type PeriodClosePostgresRuntimeImplementationBundleStatus =
  | 'dependency_blocked'
  | 'implementation_blocked'
  | 'pool_config_invalid'
  | 'ready'
  | 'repository_runtime_invalid'
  | 'service_runtime_bundle_invalid';

export type PeriodClosePostgresRuntimeImplementationBundleGateStatus = 'blocked' | 'satisfied';

export type PeriodClosePostgresRuntimeImplementationBundleGateId =
  | 'dependency_admission'
  | 'implementation_manifest'
  | 'pool_runtime_config'
  | 'service_runtime_bundle'
  | 'sql_repository_binding';

export type PeriodClosePostgresSqlRepositoryRuntimeBinding = {
  evidenceId?: string;
  implementation: 'in_memory' | 'row_backed_contract' | 'sql_repository_runtime';
  migrationArtifactPath?: string;
  modulePath?: string;
  transactionBoundary: 'local_contract' | 'managed_postgres_transaction';
};

export type PeriodClosePostgresRuntimeImplementationRepositoryBindings = {
  periodLockRepository: PeriodClosePostgresSqlRepositoryRuntimeBinding;
  sourceMutationRepository: PeriodClosePostgresSqlRepositoryRuntimeBinding;
  voucherLedgerRepository: PeriodClosePostgresSqlRepositoryRuntimeBinding;
};

export type PeriodClosePostgresRuntimeImplementationBundleEvidence = {
  managedServicePoolRuntimeModulePath?: string;
  runtimeImportModulePath?: string;
  serviceRuntimeAdmissionEvidenceId?: string;
  sourceMutationBridgeModulePath?: string;
};

export type PeriodClosePostgresRuntimeImplementationBundleGate = {
  evidence: string;
  gate: PeriodClosePostgresRuntimeImplementationBundleGateId;
  status: PeriodClosePostgresRuntimeImplementationBundleGateStatus;
};

export type PeriodClosePostgresRuntimeImplementationBundleEventName =
  | 'assemble_runtime_bundle'
  | 'evaluate_dependency_admission'
  | 'evaluate_implementation_manifest'
  | 'receive_bundle_request'
  | 'return_bundle_result'
  | 'validate_dependency_admission'
  | 'validate_pool_config'
  | 'validate_repository_bindings'
  | 'validate_service_runtime_bundle';

export type PeriodClosePostgresRuntimeImplementationBundleEvent = {
  event: PeriodClosePostgresRuntimeImplementationBundleEventName;
  manifestEnvironment: PeriodClosePostgresRuntimeImplementationManifest['environment'];
  sequence: number;
};

export type PeriodClosePostgresRuntimeImplementationBundleDescriptor = {
  managedServicePoolRuntimeModulePath: string;
  poolConfig: PeriodClosePostgresPoolRuntimeConfig;
  repositoryBindings: PeriodClosePostgresRuntimeImplementationRepositoryBindings;
  runtimeImportModulePath: string;
  serviceRuntimeAdmissionEvidenceId: string;
  sourceMutationBridgeModulePath: string;
};

export type PeriodClosePostgresRuntimeImplementationBundleInput =
  Omit<PeriodClosePostgresDependencyAdmissionInput, 'runtimeEvidence'> & {
    bundleEvidence: PeriodClosePostgresRuntimeImplementationBundleEvidence;
    manifest: PeriodClosePostgresRuntimeImplementationManifest;
    repositoryBindings: PeriodClosePostgresRuntimeImplementationRepositoryBindings;
  };

export type PeriodClosePostgresRuntimeImplementationBundleResult = {
  bundle?: PeriodClosePostgresRuntimeImplementationBundleDescriptor;
  bundleErrors: string[];
  dependencyAdmission?: PeriodClosePostgresDependencyAdmissionResult;
  events: PeriodClosePostgresRuntimeImplementationBundleEvent[];
  gates: PeriodClosePostgresRuntimeImplementationBundleGate[];
  implementation: PeriodClosePostgresRuntimeImplementationResult;
  poolConfig?: PeriodClosePostgresPoolRuntimeConfig;
  poolConfigErrors: string[];
  repositoryErrors: string[];
  status: PeriodClosePostgresRuntimeImplementationBundleStatus;
  traceErrors: string[];
};

function gate(
  gateId: PeriodClosePostgresRuntimeImplementationBundleGateId,
  status: PeriodClosePostgresRuntimeImplementationBundleGateStatus,
  evidence: string
): PeriodClosePostgresRuntimeImplementationBundleGate {
  return {
    evidence,
    gate: gateId,
    status
  };
}

function eventNames(events: readonly PeriodClosePostgresRuntimeImplementationBundleEvent[]) {
  return events
    .slice()
    .sort((left, right) => left.sequence - right.sequence)
    .map((event) => event.event);
}

function validateRepositoryBinding({
  binding,
  manifest,
  manifestRepository,
  name
}: {
  binding: PeriodClosePostgresSqlRepositoryRuntimeBinding;
  manifest: PeriodClosePostgresRuntimeImplementationManifest;
  manifestRepository: PeriodClosePostgresRuntimeImplementationManifest['repositories'][keyof PeriodClosePostgresRuntimeImplementationManifest['repositories']];
  name: keyof PeriodClosePostgresRuntimeImplementationRepositoryBindings;
}) {
  const errors: string[] = [];

  if (binding.implementation !== manifestRepository) {
    errors.push(`${name} runtime binding must match implementation manifest repository claim`);
  }

  if (binding.implementation !== 'sql_repository_runtime') {
    errors.push(`${name} must use sql_repository_runtime before runtime bundle can be ready`);
  }

  if (binding.transactionBoundary !== 'managed_postgres_transaction') {
    errors.push(`${name} must use the managed postgres transaction boundary`);
  }

  if (!binding.modulePath) {
    errors.push(`${name} must include a SQL repository runtime module path`);
  }

  if (!binding.evidenceId) {
    errors.push(`${name} must include SQL repository runtime evidence`);
  }

  if (!binding.migrationArtifactPath || binding.migrationArtifactPath !== manifest.migration.artifactPath) {
    errors.push(`${name} migration artifact must match implementation manifest migration artifact`);
  }

  return errors;
}

function validateRepositoryBindings({
  bindings,
  manifest
}: {
  bindings: PeriodClosePostgresRuntimeImplementationRepositoryBindings;
  manifest: PeriodClosePostgresRuntimeImplementationManifest;
}) {
  return [
    ...validateRepositoryBinding({
      binding: bindings.periodLockRepository,
      manifest,
      manifestRepository: manifest.repositories.periodLockRepository,
      name: 'periodLockRepository'
    }),
    ...validateRepositoryBinding({
      binding: bindings.sourceMutationRepository,
      manifest,
      manifestRepository: manifest.repositories.sourceMutationRepository,
      name: 'sourceMutationRepository'
    }),
    ...validateRepositoryBinding({
      binding: bindings.voucherLedgerRepository,
      manifest,
      manifestRepository: manifest.repositories.voucherLedgerRepository,
      name: 'voucherLedgerRepository'
    })
  ];
}

function validateBundleEvidence(evidence: PeriodClosePostgresRuntimeImplementationBundleEvidence) {
  const errors: string[] = [];

  if (!evidence.managedServicePoolRuntimeModulePath) {
    errors.push('runtime implementation bundle must reference managed service pool runtime module');
  }

  if (!evidence.runtimeImportModulePath) {
    errors.push('runtime implementation bundle must reference postgres runtime import module');
  }

  if (!evidence.sourceMutationBridgeModulePath) {
    errors.push('runtime implementation bundle must reference source mutation bridge module');
  }

  if (!evidence.serviceRuntimeAdmissionEvidenceId) {
    errors.push('runtime implementation bundle must reference service runtime admission evidence');
  }

  return errors;
}

function statusFromGates({
  bundleErrors,
  dependencyAdmission,
  implementation,
  poolConfigErrors,
  repositoryErrors
}: {
  bundleErrors: readonly string[];
  dependencyAdmission?: PeriodClosePostgresDependencyAdmissionResult;
  implementation: PeriodClosePostgresRuntimeImplementationResult;
  poolConfigErrors: readonly string[];
  repositoryErrors: readonly string[];
}): PeriodClosePostgresRuntimeImplementationBundleStatus {
  if (implementation.status !== 'ready') {
    return 'implementation_blocked';
  }

  if (!dependencyAdmission || dependencyAdmission.status !== 'admitted') {
    return 'dependency_blocked';
  }

  if (poolConfigErrors.length > 0) {
    return 'pool_config_invalid';
  }

  if (repositoryErrors.length > 0) {
    return 'repository_runtime_invalid';
  }

  if (bundleErrors.length > 0) {
    return 'service_runtime_bundle_invalid';
  }

  return 'ready';
}

export function validatePeriodClosePostgresRuntimeImplementationBundleTrace(
  result: PeriodClosePostgresRuntimeImplementationBundleResult
): string[] {
  const errors = [...result.traceErrors];
  const events = result.events.slice().sort((left, right) => left.sequence - right.sequence);
  const names = eventNames(events);
  const receiveIndex = names.indexOf('receive_bundle_request');
  const implementationIndex = names.indexOf('evaluate_implementation_manifest');
  const dependencyIndex = names.indexOf('evaluate_dependency_admission');
  const dependencyValidateIndex = names.indexOf('validate_dependency_admission');
  const poolConfigIndex = names.indexOf('validate_pool_config');
  const repositoryIndex = names.indexOf('validate_repository_bindings');
  const serviceBundleIndex = names.indexOf('validate_service_runtime_bundle');
  const assembleIndex = names.indexOf('assemble_runtime_bundle');
  const returnIndex = names.indexOf('return_bundle_result');

  if (receiveIndex !== 0) {
    errors.push('runtime implementation bundle must receive request first');
  }

  if (implementationIndex <= receiveIndex) {
    errors.push('runtime implementation bundle must evaluate implementation manifest after receiving request');
  }

  if (result.implementation.status !== 'ready') {
    if (
      dependencyIndex !== -1 ||
      dependencyValidateIndex !== -1 ||
      poolConfigIndex !== -1 ||
      repositoryIndex !== -1 ||
      serviceBundleIndex !== -1 ||
      assembleIndex !== -1 ||
      result.dependencyAdmission ||
      result.bundle
    ) {
      errors.push('blocked implementation manifest must not evaluate dependency admission or assemble runtime bundle');
    }
  } else {
    if (dependencyIndex <= implementationIndex || dependencyValidateIndex <= dependencyIndex) {
      errors.push('runtime implementation bundle must evaluate and validate dependency admission after implementation manifest');
    }

    if (result.dependencyAdmission?.status !== 'admitted') {
      if (poolConfigIndex !== -1 || repositoryIndex !== -1 || serviceBundleIndex !== -1 || assembleIndex !== -1 || result.bundle) {
        errors.push('blocked dependency admission must not validate pool/repositories or assemble runtime bundle');
      }
    } else {
      if (poolConfigIndex <= dependencyValidateIndex) {
        errors.push('runtime implementation bundle must validate pool config after dependency admission');
      }

      if (repositoryIndex <= poolConfigIndex) {
        errors.push('runtime implementation bundle must validate SQL repository bindings after pool config');
      }

      if (serviceBundleIndex <= repositoryIndex) {
        errors.push('runtime implementation bundle must validate service runtime bundle evidence after repository bindings');
      }

      if (
        result.poolConfigErrors.length > 0 ||
        result.repositoryErrors.length > 0 ||
        result.bundleErrors.length > 0
      ) {
        if (assembleIndex !== -1 || result.bundle) {
          errors.push('invalid pool/repository/service evidence must not assemble runtime bundle');
        }
      } else if (assembleIndex <= serviceBundleIndex || !result.bundle) {
        errors.push('ready runtime implementation bundle must assemble bundle after all validations');
      }
    }
  }

  if (returnIndex !== events.length - 1) {
    errors.push('runtime implementation bundle must return result last');
  }

  if (events.some((event) => event.manifestEnvironment !== result.implementation.environment)) {
    errors.push('runtime implementation bundle events must keep one manifest environment');
  }

  if (result.dependencyAdmission) {
    errors.push(...validatePeriodClosePostgresDependencyAdmission(result.dependencyAdmission));
  }

  if (result.status === 'ready') {
    if (!result.bundle) {
      errors.push('ready runtime implementation bundle must expose bundle descriptor');
    }

    if (!result.poolConfig) {
      errors.push('ready runtime implementation bundle must expose pool config');
    }

    if (result.gates.some((candidate) => candidate.status !== 'satisfied')) {
      errors.push('ready runtime implementation bundle must have all gates satisfied');
    }
  } else if (result.bundle) {
    errors.push('blocked runtime implementation bundle must not expose a ready bundle descriptor');
  }

  return errors;
}

export function evaluatePeriodClosePostgresRuntimeImplementationBundle(
  input: PeriodClosePostgresRuntimeImplementationBundleInput
): PeriodClosePostgresRuntimeImplementationBundleResult {
  const events: PeriodClosePostgresRuntimeImplementationBundleEvent[] = [];

  function record(event: PeriodClosePostgresRuntimeImplementationBundleEventName) {
    events.push({
      event,
      manifestEnvironment: input.manifest.environment,
      sequence: events.length + 1
    });
  }

  record('receive_bundle_request');
  record('evaluate_implementation_manifest');

  const implementation = evaluatePeriodClosePostgresRuntimeImplementationManifest(input.manifest);
  const gates: PeriodClosePostgresRuntimeImplementationBundleGate[] = [];
  const traceErrors: string[] = [...implementation.traceErrors];

  gates.push(
    gate(
      'implementation_manifest',
      implementation.status === 'ready' ? 'satisfied' : 'blocked',
      implementation.status === 'ready'
        ? 'runtime implementation manifest is ready'
        : 'runtime implementation manifest is blocked'
    )
  );

  if (implementation.status !== 'ready') {
    record('return_bundle_result');

    const result: PeriodClosePostgresRuntimeImplementationBundleResult = {
      bundleErrors: [],
      events,
      gates,
      implementation,
      poolConfigErrors: [],
      repositoryErrors: [],
      status: 'implementation_blocked',
      traceErrors
    };

    return {
      ...result,
      traceErrors: validatePeriodClosePostgresRuntimeImplementationBundleTrace(result)
    };
  }

  record('evaluate_dependency_admission');
  const dependencyAdmission = evaluatePeriodClosePostgresDependencyAdmission({
    apiPackageManifest: input.apiPackageManifest,
    apiPackageManifestPath: input.apiPackageManifestPath,
    lockfilePath: input.lockfilePath,
    lockfileText: input.lockfileText,
    runtimeEvidence: implementation.readiness.runtimeEvidence
  });

  record('validate_dependency_admission');

  gates.push(
    gate(
      'dependency_admission',
      dependencyAdmission.status === 'admitted' ? 'satisfied' : 'blocked',
      dependencyAdmission.runtimeImportAllowed
        ? 'postgres dependency admission allows runtime import'
        : 'postgres dependency admission blocks runtime import'
    )
  );

  if (dependencyAdmission.status !== 'admitted') {
    record('return_bundle_result');

    const result: PeriodClosePostgresRuntimeImplementationBundleResult = {
      bundleErrors: [],
      dependencyAdmission,
      events,
      gates,
      implementation,
      poolConfigErrors: [],
      repositoryErrors: [],
      status: 'dependency_blocked',
      traceErrors
    };

    return {
      ...result,
      traceErrors: validatePeriodClosePostgresRuntimeImplementationBundleTrace(result)
    };
  }

  record('validate_pool_config');

  const poolConfig = implementation.readiness.poolConfig;
  const poolConfigErrors = poolConfig
    ? validatePeriodClosePostgresPoolRuntimeConfig(poolConfig)
    : ['runtime implementation bundle requires readiness-derived pool config'];

  gates.push(
    gate(
      'pool_runtime_config',
      poolConfigErrors.length === 0 ? 'satisfied' : 'blocked',
      poolConfigErrors.length === 0 ? 'readiness-derived pool config is valid' : poolConfigErrors.join('; ')
    )
  );

  record('validate_repository_bindings');

  const repositoryErrors = validateRepositoryBindings({
    bindings: input.repositoryBindings,
    manifest: input.manifest
  });

  gates.push(
    gate(
      'sql_repository_binding',
      repositoryErrors.length === 0 ? 'satisfied' : 'blocked',
      repositoryErrors.length === 0
        ? 'SQL repository runtime bindings match implementation manifest and migration artifact'
        : repositoryErrors.join('; ')
    )
  );

  record('validate_service_runtime_bundle');

  const bundleErrors = validateBundleEvidence(input.bundleEvidence);

  gates.push(
    gate(
      'service_runtime_bundle',
      bundleErrors.length === 0 ? 'satisfied' : 'blocked',
      bundleErrors.length === 0 ? 'service runtime bundle evidence is complete' : bundleErrors.join('; ')
    )
  );

  const status = statusFromGates({
    bundleErrors,
    dependencyAdmission,
    implementation,
    poolConfigErrors,
    repositoryErrors
  });

  let bundle: PeriodClosePostgresRuntimeImplementationBundleDescriptor | undefined;

  if (status === 'ready' && poolConfig) {
    record('assemble_runtime_bundle');

    bundle = {
      managedServicePoolRuntimeModulePath: input.bundleEvidence.managedServicePoolRuntimeModulePath ?? '',
      poolConfig,
      repositoryBindings: input.repositoryBindings,
      runtimeImportModulePath: input.bundleEvidence.runtimeImportModulePath ?? '',
      serviceRuntimeAdmissionEvidenceId: input.bundleEvidence.serviceRuntimeAdmissionEvidenceId ?? '',
      sourceMutationBridgeModulePath: input.bundleEvidence.sourceMutationBridgeModulePath ?? ''
    };
  }

  record('return_bundle_result');

  const result: PeriodClosePostgresRuntimeImplementationBundleResult = {
    bundle,
    bundleErrors,
    dependencyAdmission,
    events,
    gates,
    implementation,
    poolConfig,
    poolConfigErrors,
    repositoryErrors,
    status,
    traceErrors
  };

  return {
    ...result,
    traceErrors: validatePeriodClosePostgresRuntimeImplementationBundleTrace(result)
  };
}
