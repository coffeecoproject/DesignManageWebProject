import {
  createPeriodClosePostgresSecretResolverContract,
  validatePeriodClosePostgresSecretResolverTrace,
  type PeriodClosePostgresSecretRecord,
  type PeriodClosePostgresSecretResolverResult
} from './periodClosePostgresSecretResolverContract.js';

type UnitTest = {
  name: string;
  run: () => Promise<void> | void;
};

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function createSecretStore(overrides: Partial<PeriodClosePostgresSecretRecord> = {}): PeriodClosePostgresSecretRecord[] {
  return [
    {
      enabled: true,
      environment: 'local',
      expiresAt: '2026-12-31T00:00:00.000Z',
      purpose: 'postgres_password',
      reference: 'secret://local/postgres/period-close/password',
      source: 'local_dev_secret_store',
      value: 'local-secret-value',
      version: 'local-v1',
      ...overrides
    }
  ];
}

function cloneResult(result: PeriodClosePostgresSecretResolverResult): PeriodClosePostgresSecretResolverResult {
  return {
    ...result,
    events: result.events.map((event) => ({ ...event })),
    redactedSecretEvidence: result.redactedSecretEvidence ? { ...result.redactedSecretEvidence } : undefined,
    traceErrors: [...result.traceErrors]
  };
}

const tests: UnitTest[] = [
  {
    name: 'resolves local postgres password secret with redacted evidence',
    run: async () => {
      const resolver = createPeriodClosePostgresSecretResolverContract({
        now: '2026-07-05T00:00:00.000Z',
        secretStore: createSecretStore()
      });
      const result = await resolver.resolve({
        environment: 'local',
        period: '2026-06',
        purpose: 'postgres_password',
        reference: 'secret://local/postgres/period-close/password',
        requestId: 'req-secret-001',
        transactionId: 'tx-secret-001'
      });

      assertEqual(result.status, 'resolved', 'local secret should resolve');
      assertEqual(result.resolvedValue, 'local-secret-value', 'resolver should return the internal secret value to caller');
      assertEqual(
        result.redactedSecretEvidence?.reference,
        'secret://local/postgres/period-close/password',
        'resolver should expose only redacted reference evidence'
      );
      assert(
        JSON.stringify(result.redactedSecretEvidence).includes('local-secret-value') === false,
        'redacted secret evidence must not include secret value'
      );
      assertEqual(result.traceErrors.length, 0, `resolver trace should validate: ${result.traceErrors.join('; ')}`);
    }
  },
  {
    name: 'rejects non-secret references before reading metadata',
    run: async () => {
      const resolver = createPeriodClosePostgresSecretResolverContract({
        now: '2026-07-05T00:00:00.000Z',
        secretStore: createSecretStore()
      });
      const result = await resolver.resolve({
        environment: 'local',
        period: '2026-06',
        purpose: 'postgres_password',
        reference: 'postgres-password-inline',
        requestId: 'req-secret-invalid-ref',
        transactionId: 'tx-secret-invalid-ref'
      });

      assertEqual(result.status, 'reference_invalid', 'raw secret references should be rejected');
      assert(
        !result.events.some((event) => event.event === 'read_secret_metadata'),
        'invalid references must not read metadata'
      );
      assertEqual(result.resolvedValue, undefined, 'invalid reference must not resolve value');
    }
  },
  {
    name: 'rejects missing secret references without returning a value',
    run: async () => {
      const resolver = createPeriodClosePostgresSecretResolverContract({
        now: '2026-07-05T00:00:00.000Z',
        secretStore: createSecretStore()
      });
      const result = await resolver.resolve({
        environment: 'local',
        period: '2026-06',
        purpose: 'postgres_password',
        reference: 'secret://local/postgres/missing',
        requestId: 'req-secret-missing',
        transactionId: 'tx-secret-missing'
      });

      assertEqual(result.status, 'not_found', 'missing secret should not resolve');
      assertEqual(result.resolvedValue, undefined, 'missing secret must not return value');
      assert(
        result.traceErrors.some((error) => error.includes('not found')),
        'missing secret should explain not found state'
      );
    }
  },
  {
    name: 'rejects production secrets without managed-store evidence',
    run: async () => {
      const resolver = createPeriodClosePostgresSecretResolverContract({
        now: '2026-07-05T00:00:00.000Z',
        secretStore: createSecretStore({
          environment: 'production',
          reference: 'secret://prod/postgres/password',
          source: 'local_dev_secret_store',
          targetDatabaseEvidenceId: 'db-prod-001',
          value: 'prod-secret-value'
        })
      });
      const result = await resolver.resolve({
        environment: 'production',
        period: '2026-06',
        purpose: 'postgres_password',
        reference: 'secret://prod/postgres/password',
        requestId: 'req-secret-prod-scope',
        targetDatabaseEvidenceId: 'db-prod-001',
        transactionId: 'tx-secret-prod-scope'
      });

      assertEqual(result.status, 'scope_invalid', 'production local-dev secret should be rejected');
      assert(
        result.traceErrors.some((error) => error.includes('managed secret store')),
        'production secret should require managed store'
      );
      assert(
        result.traceErrors.some((error) => error.includes('access policy evidence')),
        'production secret should require access policy evidence'
      );
      assert(
        result.traceErrors.some((error) => error.includes('rotation evidence')),
        'production secret should require rotation evidence'
      );
    }
  },
  {
    name: 'resolves production secret only with managed-store and database evidence',
    run: async () => {
      const resolver = createPeriodClosePostgresSecretResolverContract({
        now: '2026-07-05T00:00:00.000Z',
        secretStore: createSecretStore({
          accessPolicyEvidenceId: 'secret-access-prod-001',
          environment: 'production',
          reference: 'secret://prod/postgres/password',
          rotationEvidenceId: 'secret-rotation-prod-001',
          source: 'managed_secret_store',
          targetDatabaseEvidenceId: 'db-prod-001',
          value: 'prod-secret-value',
          version: 'prod-v7'
        })
      });
      const result = await resolver.resolve({
        environment: 'production',
        period: '2026-06',
        purpose: 'postgres_password',
        reference: 'secret://prod/postgres/password',
        requestId: 'req-secret-prod',
        targetDatabaseEvidenceId: 'db-prod-001',
        transactionId: 'tx-secret-prod'
      });

      assertEqual(result.status, 'resolved', 'production secret with evidence should resolve');
      assertEqual(result.redactedSecretEvidence?.source, 'managed_secret_store', 'production evidence should keep source');
      assertEqual(
        result.redactedSecretEvidence?.rotationEvidenceId,
        'secret-rotation-prod-001',
        'production evidence should keep rotation evidence'
      );
    }
  },
  {
    name: 'rejects expired secrets',
    run: async () => {
      const resolver = createPeriodClosePostgresSecretResolverContract({
        now: '2026-07-05T00:00:00.000Z',
        secretStore: createSecretStore({ expiresAt: '2026-01-01T00:00:00.000Z' })
      });
      const result = await resolver.resolve({
        environment: 'local',
        period: '2026-06',
        purpose: 'postgres_password',
        reference: 'secret://local/postgres/period-close/password',
        requestId: 'req-secret-expired',
        transactionId: 'tx-secret-expired'
      });

      assertEqual(result.status, 'expired', 'expired secret should be rejected');
      assertEqual(result.resolvedValue, undefined, 'expired secret must not return value');
    }
  },
  {
    name: 'validator rejects traces that expose values without resolved status',
    run: () => {
      const resolver = createPeriodClosePostgresSecretResolverContract({
        now: '2026-07-05T00:00:00.000Z',
        secretStore: createSecretStore()
      });
      return resolver
        .resolve({
          environment: 'local',
          period: '2026-06',
          purpose: 'postgres_password',
          reference: 'secret://local/postgres/missing',
          requestId: 'req-secret-trace',
          transactionId: 'tx-secret-trace'
        })
        .then((result) => {
          const tampered = cloneResult(result);

          tampered.resolvedValue = 'leaked-value';

          assert(
            validatePeriodClosePostgresSecretResolverTrace(tampered).some((error) =>
              error.includes('unresolved postgres secret must not expose')
            ),
            'resolver trace validator should reject value exposure for unresolved secret'
          );
        });
    }
  }
];

for (const test of tests) {
  await test.run();
}
