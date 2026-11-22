export type PeriodClosePostgresSecretResolverEnvironment = 'local' | 'production' | 'staging' | 'test';

export type PeriodClosePostgresSecretPurpose = 'postgres_password';

export type PeriodClosePostgresSecretSource = 'local_dev_secret_store' | 'managed_secret_store';

export type PeriodClosePostgresSecretRecord = {
  accessPolicyEvidenceId?: string;
  enabled: boolean;
  environment: PeriodClosePostgresSecretResolverEnvironment;
  expiresAt?: string;
  purpose: PeriodClosePostgresSecretPurpose;
  reference: string;
  rotationEvidenceId?: string;
  source: PeriodClosePostgresSecretSource;
  targetDatabaseEvidenceId?: string;
  value: string;
  version: string;
};

export type PeriodClosePostgresResolvedSecretEvidence = {
  accessPolicyEvidenceId?: string;
  expiresAt?: string;
  reference: string;
  rotationEvidenceId?: string;
  source: PeriodClosePostgresSecretSource;
  targetDatabaseEvidenceId?: string;
  version: string;
};

export type PeriodClosePostgresSecretResolverStatus =
  | 'expired'
  | 'not_found'
  | 'reference_invalid'
  | 'resolved'
  | 'scope_invalid'
  | 'trace_invalid';

export type PeriodClosePostgresSecretResolverEventName =
  | 'read_secret_metadata'
  | 'receive_secret_request'
  | 'return_response'
  | 'return_secret_value'
  | 'validate_secret_reference'
  | 'validate_secret_scope';

export type PeriodClosePostgresSecretResolverEvent = {
  environment: PeriodClosePostgresSecretResolverEnvironment;
  event: PeriodClosePostgresSecretResolverEventName;
  period: string;
  purpose: PeriodClosePostgresSecretPurpose;
  requestId: string;
  sequence: number;
  transactionId: string;
};

export type PeriodClosePostgresSecretResolverRunInput = {
  environment: PeriodClosePostgresSecretResolverEnvironment;
  period: string;
  purpose: PeriodClosePostgresSecretPurpose;
  reference: string;
  requestId: string;
  targetDatabaseEvidenceId?: string;
  transactionId: string;
};

export type PeriodClosePostgresSecretResolverResult = {
  environment: PeriodClosePostgresSecretResolverEnvironment;
  events: PeriodClosePostgresSecretResolverEvent[];
  period: string;
  purpose: PeriodClosePostgresSecretPurpose;
  redactedSecretEvidence?: PeriodClosePostgresResolvedSecretEvidence;
  reference: string;
  requestId: string;
  resolvedValue?: string;
  status: PeriodClosePostgresSecretResolverStatus;
  traceErrors: string[];
  transactionId: string;
};

export type PeriodClosePostgresSecretResolverContract = {
  readEvents: () => PeriodClosePostgresSecretResolverEvent[];
  resolve: (input: PeriodClosePostgresSecretResolverRunInput) => Promise<PeriodClosePostgresSecretResolverResult>;
};

function isSecretReference(reference: string) {
  return /^secret:\/\/[A-Za-z0-9._~:/-]+$/.test(reference);
}

function hasExpired(expiresAt: string | undefined, now: string) {
  if (!expiresAt) {
    return false;
  }

  const expiresAtTime = Date.parse(expiresAt);
  const nowTime = Date.parse(now);

  return Number.isFinite(expiresAtTime) && Number.isFinite(nowTime) && expiresAtTime <= nowTime;
}

function toRedactedSecretEvidence(
  record: PeriodClosePostgresSecretRecord
): PeriodClosePostgresResolvedSecretEvidence {
  return {
    ...(record.accessPolicyEvidenceId ? { accessPolicyEvidenceId: record.accessPolicyEvidenceId } : {}),
    ...(record.expiresAt ? { expiresAt: record.expiresAt } : {}),
    ...(record.rotationEvidenceId ? { rotationEvidenceId: record.rotationEvidenceId } : {}),
    ...(record.targetDatabaseEvidenceId ? { targetDatabaseEvidenceId: record.targetDatabaseEvidenceId } : {}),
    reference: record.reference,
    source: record.source,
    version: record.version
  };
}

function validateRecordScope({
  input,
  record
}: {
  input: PeriodClosePostgresSecretResolverRunInput;
  record: PeriodClosePostgresSecretRecord;
}) {
  const errors: string[] = [];

  if (!record.enabled) {
    errors.push('period-close postgres secret must be enabled');
  }

  if (record.environment !== input.environment) {
    errors.push('period-close postgres secret environment must match runtime environment');
  }

  if (record.purpose !== input.purpose) {
    errors.push('period-close postgres secret purpose must match resolver request');
  }

  if (input.environment === 'production') {
    if (record.source !== 'managed_secret_store') {
      errors.push('production period-close postgres secret must come from managed secret store');
    }

    if (!record.accessPolicyEvidenceId) {
      errors.push('production period-close postgres secret requires access policy evidence');
    }

    if (!record.rotationEvidenceId) {
      errors.push('production period-close postgres secret requires rotation evidence');
    }

    if (!record.targetDatabaseEvidenceId || record.targetDatabaseEvidenceId !== input.targetDatabaseEvidenceId) {
      errors.push('production period-close postgres secret must match target database evidence');
    }
  }

  return errors;
}

function eventNames(events: readonly PeriodClosePostgresSecretResolverEvent[]) {
  return events
    .slice()
    .sort((left, right) => left.sequence - right.sequence)
    .map((event) => event.event);
}

export function validatePeriodClosePostgresSecretResolverTrace(
  result: PeriodClosePostgresSecretResolverResult
): string[] {
  const errors = [...result.traceErrors];
  const events = result.events.slice().sort((left, right) => left.sequence - right.sequence);
  const names = eventNames(events);
  const receiveIndex = names.indexOf('receive_secret_request');
  const validateReferenceIndex = names.indexOf('validate_secret_reference');
  const readMetadataIndex = names.indexOf('read_secret_metadata');
  const validateScopeIndex = names.indexOf('validate_secret_scope');
  const returnValueIndex = names.indexOf('return_secret_value');
  const returnIndex = names.indexOf('return_response');

  if (receiveIndex !== 0) {
    errors.push(`${result.transactionId} postgres secret resolver must receive request first`);
  }

  if (validateReferenceIndex <= receiveIndex) {
    errors.push(`${result.transactionId} postgres secret resolver must validate reference before reading metadata`);
  }

  if (result.status === 'reference_invalid') {
    if (readMetadataIndex !== -1 || returnValueIndex !== -1 || result.resolvedValue) {
      errors.push(`${result.transactionId} invalid secret reference must not read metadata or return value`);
    }
  } else if (readMetadataIndex <= validateReferenceIndex) {
    errors.push(`${result.transactionId} postgres secret resolver must read metadata after reference validation`);
  }

  if (result.status === 'resolved') {
    if (validateScopeIndex <= readMetadataIndex) {
      errors.push(`${result.transactionId} postgres secret resolver must validate scope before returning value`);
    }

    if (returnValueIndex <= validateScopeIndex) {
      errors.push(`${result.transactionId} postgres secret resolver must return value after scope validation`);
    }

    if (!result.resolvedValue) {
      errors.push(`${result.transactionId} resolved postgres secret must include an internal value`);
    }

    if (!result.redactedSecretEvidence) {
      errors.push(`${result.transactionId} resolved postgres secret must include redacted evidence`);
    }
  } else if (returnValueIndex !== -1 || result.resolvedValue || result.redactedSecretEvidence) {
    errors.push(`${result.transactionId} unresolved postgres secret must not expose a value or evidence`);
  }

  if (returnIndex !== events.length - 1) {
    errors.push(`${result.transactionId} postgres secret resolver must return response last`);
  }

  if (events.some((event) => event.environment !== result.environment)) {
    errors.push(`${result.transactionId} postgres secret resolver events must keep one environment`);
  }

  if (events.some((event) => event.period !== result.period)) {
    errors.push(`${result.transactionId} postgres secret resolver events must keep one accounting period`);
  }

  if (events.some((event) => event.purpose !== result.purpose)) {
    errors.push(`${result.transactionId} postgres secret resolver events must keep one purpose`);
  }

  if (events.some((event) => event.requestId !== result.requestId)) {
    errors.push(`${result.transactionId} postgres secret resolver events must keep one request id`);
  }

  if (events.some((event) => event.transactionId !== result.transactionId)) {
    errors.push(`${result.transactionId} postgres secret resolver events must keep one transaction id`);
  }

  return errors;
}

export function createPeriodClosePostgresSecretResolverContract({
  now,
  secretStore
}: {
  now: string;
  secretStore: readonly PeriodClosePostgresSecretRecord[];
}): PeriodClosePostgresSecretResolverContract {
  const events: PeriodClosePostgresSecretResolverEvent[] = [];

  function record({
    environment,
    event,
    period,
    purpose,
    requestId,
    transactionId
  }: Omit<PeriodClosePostgresSecretResolverEvent, 'sequence'>) {
    events.push({
      environment,
      event,
      period,
      purpose,
      requestId,
      sequence: events.length + 1,
      transactionId
    });
  }

  function readTransactionEvents(transactionId: string) {
    return events.filter((event) => event.transactionId === transactionId).map((event) => ({ ...event }));
  }

  return {
    readEvents: () => events.map((event) => ({ ...event })),
    resolve: async (input) => {
      const baseEvent = {
        environment: input.environment,
        period: input.period,
        purpose: input.purpose,
        requestId: input.requestId,
        transactionId: input.transactionId
      };

      record({ ...baseEvent, event: 'receive_secret_request' });
      record({ ...baseEvent, event: 'validate_secret_reference' });

      if (!isSecretReference(input.reference)) {
        record({ ...baseEvent, event: 'return_response' });

        return {
          environment: input.environment,
          events: readTransactionEvents(input.transactionId),
          period: input.period,
          purpose: input.purpose,
          reference: input.reference,
          requestId: input.requestId,
          status: 'reference_invalid',
          traceErrors: ['period-close postgres secret reference must use secret:// without raw values'],
          transactionId: input.transactionId
        };
      }

      record({ ...baseEvent, event: 'read_secret_metadata' });

      const recordInStore = secretStore.find((recordItem) => recordItem.reference === input.reference);

      if (!recordInStore) {
        record({ ...baseEvent, event: 'return_response' });

        return {
          environment: input.environment,
          events: readTransactionEvents(input.transactionId),
          period: input.period,
          purpose: input.purpose,
          reference: input.reference,
          requestId: input.requestId,
          status: 'not_found',
          traceErrors: ['period-close postgres secret reference was not found'],
          transactionId: input.transactionId
        };
      }

      record({ ...baseEvent, event: 'validate_secret_scope' });

      const scopeErrors = validateRecordScope({ input, record: recordInStore });

      if (scopeErrors.length > 0) {
        record({ ...baseEvent, event: 'return_response' });

        return {
          environment: input.environment,
          events: readTransactionEvents(input.transactionId),
          period: input.period,
          purpose: input.purpose,
          reference: input.reference,
          requestId: input.requestId,
          status: 'scope_invalid',
          traceErrors: scopeErrors,
          transactionId: input.transactionId
        };
      }

      if (hasExpired(recordInStore.expiresAt, now)) {
        record({ ...baseEvent, event: 'return_response' });

        return {
          environment: input.environment,
          events: readTransactionEvents(input.transactionId),
          period: input.period,
          purpose: input.purpose,
          reference: input.reference,
          requestId: input.requestId,
          status: 'expired',
          traceErrors: ['period-close postgres secret is expired'],
          transactionId: input.transactionId
        };
      }

      record({ ...baseEvent, event: 'return_secret_value' });
      record({ ...baseEvent, event: 'return_response' });

      const result: PeriodClosePostgresSecretResolverResult = {
        environment: input.environment,
        events: readTransactionEvents(input.transactionId),
        period: input.period,
        purpose: input.purpose,
        redactedSecretEvidence: toRedactedSecretEvidence(recordInStore),
        reference: input.reference,
        requestId: input.requestId,
        resolvedValue: recordInStore.value,
        status: 'resolved',
        traceErrors: [],
        transactionId: input.transactionId
      };
      const traceErrors = validatePeriodClosePostgresSecretResolverTrace(result);

      return {
        ...result,
        status: traceErrors.length > 0 ? 'trace_invalid' : result.status,
        traceErrors
      };
    }
  };
}
