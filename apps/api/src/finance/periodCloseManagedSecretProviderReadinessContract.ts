import type {
  PeriodClosePostgresRuntimeReadinessPackage,
  PeriodClosePostgresRuntimeSecretEvidence,
  PeriodClosePostgresRuntimeTargetDatabase,
} from './periodClosePostgresRuntimeReadinessPackageContract.js';

export type PeriodCloseManagedSecretProviderReadinessStatus = 'blocked' | 'ready';
export type PeriodCloseManagedSecretProviderReadinessGateStatus = 'blocked' | 'satisfied';
export type PeriodCloseManagedSecretProviderReadinessGateId =
  | 'runtime_environment_snapshot'
  | 'secret_management_evidence'
  | 'secret_reference_shape'
  | 'secret_value_non_exposure'
  | 'target_database_scope';

export type PeriodCloseManagedSecretProviderReadinessGate = {
  evidence: string;
  gate: PeriodCloseManagedSecretProviderReadinessGateId;
  status: PeriodCloseManagedSecretProviderReadinessGateStatus;
};

export type PeriodCloseManagedSecretProviderReadinessInput = {
  readinessPackage: PeriodClosePostgresRuntimeReadinessPackage;
  requestId: string;
  runtimeEnvironmentSnapshot?: Record<string, string | undefined>;
};

export type PeriodCloseManagedSecretProviderReadinessResult = {
  gates: PeriodCloseManagedSecretProviderReadinessGate[];
  redactedRuntimeSecretKeys: string[];
  requestId: string;
  sanitizedSecretReference?: string;
  secretValueExposed: false;
  status: PeriodCloseManagedSecretProviderReadinessStatus;
  targetDatabaseEvidenceId?: string;
  traceErrors: string[];
};

const RAW_SECRET_ENV_KEYS = [
  'DATABASE_URL',
  'PGPASSWORD',
  'POSTGRES_PASSWORD',
  'JWT_SECRET',
  'SESSION_SECRET',
  'COOKIE_SECRET',
  'FINANCE_DATABASE_PASSWORD',
];

function isSecretReference(reference: string | undefined) {
  return typeof reference === 'string' && /^secret:\/\/[A-Za-z0-9._~:/-]+$/.test(reference);
}

function isProductionTarget(targetDatabase: PeriodClosePostgresRuntimeTargetDatabase) {
  return targetDatabase.environment === 'production' || targetDatabase.selectedEnvironment === 'production';
}

function gate(
  gateId: PeriodCloseManagedSecretProviderReadinessGateId,
  status: PeriodCloseManagedSecretProviderReadinessGateStatus,
  evidence: string,
): PeriodCloseManagedSecretProviderReadinessGate {
  return {
    evidence,
    gate: gateId,
    status,
  };
}

function secretMetadataReady({
  secret,
  targetDatabase,
}: {
  secret: PeriodClosePostgresRuntimeSecretEvidence;
  targetDatabase: PeriodClosePostgresRuntimeTargetDatabase;
}) {
  if (secret.status !== 'ready') {
    return false;
  }

  if (isProductionTarget(targetDatabase)) {
    return (
      secret.source === 'managed_secret_store' &&
      Boolean(secret.accessPolicyEvidenceId) &&
      Boolean(secret.rotationEvidenceId)
    );
  }

  return Boolean(secret.source);
}

function targetDatabaseScopeReady({
  secret,
  targetDatabase,
}: {
  secret: PeriodClosePostgresRuntimeSecretEvidence;
  targetDatabase: PeriodClosePostgresRuntimeTargetDatabase;
}) {
  return (
    targetDatabase.status === 'selected' &&
    Boolean(targetDatabase.evidenceId) &&
    Boolean(secret.targetDatabaseEvidenceId) &&
    secret.targetDatabaseEvidenceId === targetDatabase.evidenceId
  );
}

function valueLooksLikeRawSecret(key: string, value: string) {
  const lowerKey = key.toLowerCase();
  const lowerValue = value.toLowerCase();

  return (
    lowerKey.includes('password') ||
    lowerKey.includes('secret') ||
    lowerKey.includes('token') ||
    lowerValue.includes('password=') ||
    (lowerValue.includes('://') && lowerValue.includes('@'))
  );
}

function validateRuntimeEnvironmentSnapshot({
  expectedSecretReference,
  snapshot,
}: {
  expectedSecretReference?: string;
  snapshot: Record<string, string | undefined>;
}) {
  const errors: string[] = [];
  const redactedKeys: string[] = [];

  Object.entries(snapshot).forEach(([key, value]) => {
    if (!value) {
      return;
    }

    if (RAW_SECRET_ENV_KEYS.includes(key)) {
      redactedKeys.push(key);

      if (key === 'DATABASE_URL') {
        errors.push('period-close service runtime must not carry DATABASE_URL; target database comes from readiness package');
        return;
      }

      if (!isSecretReference(value)) {
        errors.push(`period-close service runtime env must not carry raw secret value: ${key}`);
        return;
      }

      if (['FINANCE_DATABASE_PASSWORD', 'PGPASSWORD', 'POSTGRES_PASSWORD'].includes(key) && value !== expectedSecretReference) {
        errors.push(`period-close service runtime env secret reference must match readiness package: ${key}`);
      }

      return;
    }

    if (value.startsWith('secret://')) {
      redactedKeys.push(key);
      return;
    }

    if (valueLooksLikeRawSecret(key, value)) {
      errors.push(`period-close service runtime env must not carry raw secret-like value: ${key}`);
    }
  });

  return {
    errors,
    redactedKeys: Array.from(new Set(redactedKeys)).sort(),
  };
}

export function evaluatePeriodCloseManagedSecretProviderReadiness({
  readinessPackage,
  requestId,
  runtimeEnvironmentSnapshot = {},
}: PeriodCloseManagedSecretProviderReadinessInput): PeriodCloseManagedSecretProviderReadinessResult {
  const { secret, targetDatabase } = readinessPackage;
  const traceErrors: string[] = [];
  const referenceShapeReady = isSecretReference(secret.reference);
  const metadataReady = secretMetadataReady({ secret, targetDatabase });
  const scopeReady = targetDatabaseScopeReady({ secret, targetDatabase });
  const envValidation = validateRuntimeEnvironmentSnapshot({
    expectedSecretReference: secret.reference,
    snapshot: runtimeEnvironmentSnapshot,
  });

  if (!referenceShapeReady) {
    traceErrors.push('period-close service runtime secret reference must use secret:// without embedded values');
  }

  if (!metadataReady) {
    traceErrors.push('period-close service runtime secret requires managed metadata, access policy, and rotation evidence when production-scoped');
  }

  if (!scopeReady) {
    traceErrors.push('period-close service runtime secret must be scoped to the selected target database evidence');
  }

  traceErrors.push(...envValidation.errors);

  const gates = [
    gate(
      'secret_reference_shape',
      referenceShapeReady ? 'satisfied' : 'blocked',
      referenceShapeReady ? 'secret reference is a managed reference' : 'secret reference is missing or embeds raw value',
    ),
    gate(
      'secret_management_evidence',
      metadataReady ? 'satisfied' : 'blocked',
      metadataReady ? 'secret management metadata is present' : 'secret management metadata is missing',
    ),
    gate(
      'target_database_scope',
      scopeReady ? 'satisfied' : 'blocked',
      scopeReady ? `secret is scoped to ${targetDatabase.evidenceId}` : 'secret target database evidence does not match',
    ),
    gate(
      'runtime_environment_snapshot',
      envValidation.errors.length === 0 ? 'satisfied' : 'blocked',
      envValidation.errors.length === 0
        ? 'runtime environment carries no raw database secret values'
        : 'runtime environment carries raw or mismatched database secret values',
    ),
    gate(
      'secret_value_non_exposure',
      'satisfied',
      'readiness result exposes only redacted keys and managed references',
    ),
  ];
  const status =
    traceErrors.length === 0 && gates.every((readinessGate) => readinessGate.status === 'satisfied')
      ? 'ready'
      : 'blocked';

  return {
    gates,
    redactedRuntimeSecretKeys: envValidation.redactedKeys,
    requestId,
    ...(referenceShapeReady ? { sanitizedSecretReference: secret.reference } : {}),
    secretValueExposed: false,
    status,
    ...(targetDatabase.evidenceId ? { targetDatabaseEvidenceId: targetDatabase.evidenceId } : {}),
    traceErrors,
  };
}
