import type {
  PeriodClosePostgresClientPort,
  PeriodClosePostgresClientPortQueryResult,
  PeriodClosePostgresPoolPort
} from './periodClosePostgresClientPortContract.js';

export type PeriodCloseNativePostgresQueryResult = {
  rowCount?: number | null;
  rows?: readonly Record<string, unknown>[];
};

export type PeriodCloseNativePostgresClientLike = {
  query?: (
    sql: string,
    parameters?: readonly unknown[]
  ) => PeriodCloseNativePostgresQueryResult | Promise<PeriodCloseNativePostgresQueryResult>;
  release?: (error?: Error) => Promise<void> | void;
};

export type PeriodCloseNativePostgresPoolLike = {
  connect?: () => PeriodCloseNativePostgresClientLike | Promise<PeriodCloseNativePostgresClientLike>;
};

export type PeriodCloseNativePostgresPoolAdapterEventName =
  | 'connect_native_pool'
  | 'execute_native_query'
  | 'reject_invalid_native_client'
  | 'reject_invalid_native_pool'
  | 'release_native_client'
  | 'validate_native_pool_shape'
  | 'wrap_native_client';

export type PeriodCloseNativePostgresPoolAdapterEvent = {
  event: PeriodCloseNativePostgresPoolAdapterEventName;
  sequence: number;
};

export type PeriodCloseNativePostgresPoolAdapterContract = PeriodClosePostgresPoolPort & {
  readAdapterEvents: () => PeriodCloseNativePostgresPoolAdapterEvent[];
};

export class PeriodCloseNativePostgresPoolAdapterError extends Error {
  readonly code:
    | 'NATIVE_POSTGRES_CLIENT_SHAPE_INVALID'
    | 'NATIVE_POSTGRES_POOL_SHAPE_INVALID';

  constructor({
    code,
    message
  }: {
    code: PeriodCloseNativePostgresPoolAdapterError['code'];
    message: string;
  }) {
    super(message);
    this.code = code;
    this.name = 'PeriodCloseNativePostgresPoolAdapterError';
  }
}

function cloneRows(rows: readonly Record<string, unknown>[] | undefined) {
  return rows?.map((row) => ({ ...row })) ?? [];
}

function normalizeQueryResult(
  result: PeriodCloseNativePostgresQueryResult | undefined
): PeriodClosePostgresClientPortQueryResult {
  return {
    ...(typeof result?.rowCount === 'number' ? { rowCount: result.rowCount } : {}),
    rows: cloneRows(result?.rows)
  };
}

function isNativeClientShapeValid(client: PeriodCloseNativePostgresClientLike | undefined) {
  return Boolean(client && typeof client.query === 'function' && typeof client.release === 'function');
}

export function validatePeriodCloseNativePostgresPoolAdapterEvents(
  events: readonly PeriodCloseNativePostgresPoolAdapterEvent[]
): string[] {
  const errors: string[] = [];
  const names = events
    .slice()
    .sort((left, right) => left.sequence - right.sequence)
    .map((event) => event.event);
  const validateIndex = names.indexOf('validate_native_pool_shape');
  const connectIndex = names.indexOf('connect_native_pool');
  const wrapIndex = names.indexOf('wrap_native_client');
  const invalidPoolIndex = names.indexOf('reject_invalid_native_pool');
  const invalidClientIndex = names.indexOf('reject_invalid_native_client');
  const firstQueryIndex = names.indexOf('execute_native_query');
  const releaseIndex = names.lastIndexOf('release_native_client');

  if (validateIndex !== 0) {
    errors.push('native postgres pool adapter must validate pool shape first');
  }

  if (invalidPoolIndex !== -1 && connectIndex !== -1) {
    errors.push('invalid native postgres pool must not be connected');
  }

  if (invalidClientIndex !== -1 && firstQueryIndex !== -1) {
    errors.push('invalid native postgres client must not execute queries');
  }

  if (connectIndex !== -1 && connectIndex <= validateIndex) {
    errors.push('native postgres pool adapter must connect after shape validation');
  }

  if (wrapIndex !== -1 && wrapIndex <= connectIndex) {
    errors.push('native postgres client must be wrapped after pool connection');
  }

  if (firstQueryIndex !== -1 && firstQueryIndex <= wrapIndex) {
    errors.push('native postgres query must execute after client wrapping');
  }

  if (releaseIndex !== -1 && wrapIndex !== -1 && releaseIndex <= wrapIndex) {
    errors.push('native postgres client must release after client wrapping');
  }

  return errors;
}

export function createPeriodCloseNativePostgresPoolAdapterContract({
  nativePool
}: {
  nativePool: PeriodCloseNativePostgresPoolLike;
}): PeriodCloseNativePostgresPoolAdapterContract {
  const events: PeriodCloseNativePostgresPoolAdapterEvent[] = [];

  function record(event: PeriodCloseNativePostgresPoolAdapterEventName) {
    events.push({
      event,
      sequence: events.length + 1
    });
  }

  async function releaseInvalidClient(client: PeriodCloseNativePostgresClientLike | undefined) {
    if (client && typeof client.release === 'function') {
      await client.release();
      record('release_native_client');
    }
  }

  return {
    connect: async (): Promise<PeriodClosePostgresClientPort> => {
      record('validate_native_pool_shape');

      if (typeof nativePool.connect !== 'function') {
        record('reject_invalid_native_pool');
        throw new PeriodCloseNativePostgresPoolAdapterError({
          code: 'NATIVE_POSTGRES_POOL_SHAPE_INVALID',
          message: 'Native postgres pool must expose connect().'
        });
      }

      record('connect_native_pool');

      const nativeClient = await nativePool.connect();

      if (!isNativeClientShapeValid(nativeClient)) {
        record('reject_invalid_native_client');
        await releaseInvalidClient(nativeClient);

        throw new PeriodCloseNativePostgresPoolAdapterError({
          code: 'NATIVE_POSTGRES_CLIENT_SHAPE_INVALID',
          message: 'Native postgres client must expose query() and release().'
        });
      }

      record('wrap_native_client');

      return {
        query: async (sql, parameters = []) => {
          record('execute_native_query');

          const result = await nativeClient.query?.(sql, [...parameters]);

          return normalizeQueryResult(result);
        },
        release: async () => {
          await nativeClient.release?.();
          record('release_native_client');
        }
      };
    },
    readAdapterEvents: () => events.map((event) => ({ ...event }))
  };
}
