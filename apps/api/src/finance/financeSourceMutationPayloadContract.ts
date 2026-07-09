import type { FinanceSourceMutationRepositoryApiRequest } from './periodCloseSourceMutationRepositoryApiContract.js';

export type FinanceSourceMutationPayload = Omit<FinanceSourceMutationRepositoryApiRequest, 'sourceId'> & {
  sourceId?: string;
};

export type ParsedFinanceSourceMutationPayload =
  | {
      body: FinanceSourceMutationPayload;
      ok: true;
    }
  | {
      message: string;
      ok: false;
    };

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function parseFinanceSourceMutationPayload(body: unknown): ParsedFinanceSourceMutationPayload {
  if (body !== undefined && (!body || typeof body !== 'object' || Array.isArray(body))) {
    return { message: '源单写入请求体格式不正确。', ok: false };
  }

  const objectBody = toObject(body);
  const amount = objectBody.amount;
  const expectedVersion = objectBody.expectedVersion;
  const sourceId = objectBody.sourceId;
  const sourceNo = objectBody.sourceNo;
  const status = objectBody.status;
  const targetAccountingPeriod = objectBody.targetAccountingPeriod;

  if (amount !== undefined && typeof amount !== 'string') {
    return { message: '源单金额格式不正确。', ok: false };
  }

  if (expectedVersion !== undefined && typeof expectedVersion !== 'number') {
    return { message: '源单版本格式不正确。', ok: false };
  }

  if (sourceId !== undefined && typeof sourceId !== 'string') {
    return { message: '源单标识格式不正确。', ok: false };
  }

  if (sourceNo !== undefined && typeof sourceNo !== 'string') {
    return { message: '源单编号格式不正确。', ok: false };
  }

  if (status !== undefined && typeof status !== 'string') {
    return { message: '源单状态格式不正确。', ok: false };
  }

  if (targetAccountingPeriod !== undefined && typeof targetAccountingPeriod !== 'string') {
    return { message: '源单归属期间格式不正确。', ok: false };
  }

  return {
    body: {
      amount,
      expectedVersion,
      sourceId,
      sourceNo,
      status,
      targetAccountingPeriod
    },
    ok: true
  };
}
