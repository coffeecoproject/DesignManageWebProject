import type { PublicAccountRecord, PublicAccountRef } from '../system/PublicAccountConfigState';
import {
  bankStatementImportFieldContract,
  type BankStatementDirection,
  type BankStatementImportFieldKey,
  type BankStatementRecord
} from './financeBankImportContract';

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) {
      current += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }

  values.push(current.trim());
  return values;
}

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, '').trim();
}

function buildHeaderIndexes(headers: string[]) {
  const indexes = new Map<BankStatementImportFieldKey, number>();
  bankStatementImportFieldContract.forEach((field) => {
    const index = headers.findIndex((header) => field.aliases.includes(normalizeHeader(header)));
    if (index >= 0) indexes.set(field.key, index);
  });
  return indexes;
}

function readField(values: string[], indexes: Map<BankStatementImportFieldKey, number>, key: BankStatementImportFieldKey) {
  const index = indexes.get(key);
  return index === undefined ? '' : (values[index] ?? '').trim();
}

function normalizeDate(value: string) {
  const normalized = value.trim().replace(/[/.]/g, '-');
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  return match ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : normalized;
}

function normalizeDirection(value: string): BankStatementDirection {
  if (['入账', '收入', '收款'].includes(value.trim())) return '入账';
  if (['出账', '支出', '付款'].includes(value.trim())) return '出账';
  return value.trim() as BankStatementDirection;
}

function normalizeAmount(value: string) {
  return Number(value.replace(/[￥¥,\s]/g, ''));
}

export function parseBankStatementCsv({
  account,
  content,
  publicAccountRef
}: {
  account: PublicAccountRecord;
  content: string;
  publicAccountRef: PublicAccountRef;
}): BankStatementRecord[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headerIndexes = buildHeaderIndexes(parseCsvLine(lines[0]));
  const missingHeaders = bankStatementImportFieldContract
    .filter((field) => !headerIndexes.has(field.key))
    .map((field) => field.label);
  if (missingHeaders.length > 0) {
    throw new Error(`文件缺少字段：${missingHeaders.join('、')}`);
  }

  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    const direction = normalizeDirection(readField(values, headerIndexes, 'direction'));
    return {
      amount: normalizeAmount(readField(values, headerIndexes, 'amount')),
      balance: 0,
      bankSerialNo: readField(values, headerIndexes, 'bankSerialNo'),
      batchNo: '导入预览',
      counterparty: readField(values, headerIndexes, 'counterparty'),
      direction,
      id: `bank-preview-csv-${index + 1}`,
      importedAccountName: readField(values, headerIndexes, 'importedAccountName'),
      importedAccountNumber: readField(values, headerIndexes, 'importedAccountNumber'),
      importedAt: '',
      matchedTransactionIds: [],
      matchReason: '待完成银行流水匹配',
      matchScore: 0,
      matchStatus: '银行未匹配',
      publicAccountId: account.id,
      publicAccountSnapshot: publicAccountRef.publicAccountSnapshot,
      statementDate: normalizeDate(readField(values, headerIndexes, 'statementDate')),
      summary: readField(values, headerIndexes, 'summary')
    };
  });
}
