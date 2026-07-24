import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { OperationRecord } from '../../components/OperationRecordTable';
import type { TagChipTone } from '../../components/TagChip';
import {
  blockMasterDataMutation,
  validateDefaultMasterDataStatusChange,
  type MasterDataMutationResult
} from './masterDataLifecycleModel';

export type PublicAccountStatus = '启用' | '停用';
export type PublicAccountUsage = '收款' | '付款' | '银行对账';

export type PublicAccountSnapshot = {
  accountHolder: string;
  accountTailNumber: string;
  bankName: string;
  displayName: string;
};

export type PublicAccountRef = {
  publicAccountId: string;
  publicAccountSnapshot: PublicAccountSnapshot;
};

export type PublicAccountRecord = {
  accountHolder: string;
  accountTailNumber: string;
  bankName: string;
  defaultFor: PublicAccountUsage[];
  displayName: string;
  id: string;
  note: string;
  openingBalance: number;
  openingBalanceDate: string;
  operationRecords: OperationRecord[];
  status: PublicAccountStatus;
  updatedAt: string;
  usage: PublicAccountUsage[];
};

export type PublicAccountFormValue = Pick<
  PublicAccountRecord,
  | 'accountHolder'
  | 'accountTailNumber'
  | 'bankName'
  | 'defaultFor'
  | 'displayName'
  | 'note'
  | 'openingBalance'
  | 'openingBalanceDate'
  | 'status'
  | 'usage'
>;

type PublicAccountConfigStateValue = {
  createPublicAccount: (nextValue: PublicAccountFormValue) => PublicAccountRecord;
  publicAccounts: PublicAccountRecord[];
  updatePublicAccount: (
    id: string,
    nextValue: PublicAccountFormValue,
    activeReferenceCount?: number
  ) => MasterDataMutationResult;
  updatePublicAccountStatus: (id: string, status: PublicAccountStatus, activeReferenceCount?: number) => MasterDataMutationResult;
};

export const publicAccountConfigToday = '2026-06-17';
export const publicAccountUsageOptions: PublicAccountUsage[] = ['收款', '付款', '银行对账'];

export const publicAccountStatusTone: Record<PublicAccountStatus, TagChipTone> = {
  停用: 'gray',
  启用: 'green'
};

export const publicAccountUsageTone: Record<PublicAccountUsage, TagChipTone> = {
  收款: 'green',
  付款: 'red',
  银行对账: 'purple'
};

export const publicAccountSeeds: PublicAccountRecord[] = [
  {
    accountHolder: '武汉启程空间设计有限公司',
    accountTailNumber: '0821',
    bankName: '招商银行',
    defaultFor: ['收款', '付款', '银行对账'],
    displayName: '招商银行基本户',
    id: 'public-account-cmb-basic',
    note: '公司正式对公结算账户。',
    openingBalance: 120000,
    openingBalanceDate: '2026-06-01',
    operationRecords: [
      {
        action: '初始化',
        actor: '系统',
        object: '招商银行基本户',
        summary: '建立对公账户配置',
        time: '2026-06-16 10:20'
      }
    ],
    status: '启用',
    updatedAt: publicAccountConfigToday,
    usage: ['收款', '付款', '银行对账']
  },
  {
    accountHolder: '武汉启程空间设计有限公司',
    accountTailNumber: '3912',
    bankName: '工商银行',
    defaultFor: [],
    displayName: '工商银行备用付款户',
    id: 'public-account-icbc-payment-reserve',
    note: '用于备用付款和银行对账场景，具体业务由来源单据决定。',
    openingBalance: 80000,
    openingBalanceDate: '2026-06-01',
    operationRecords: [
      {
        action: '初始化',
        actor: '系统',
        object: '工商银行备用付款户',
        summary: '建立备用付款账户配置',
        time: '2026-06-16 10:25'
      }
    ],
    status: '启用',
    updatedAt: publicAccountConfigToday,
    usage: ['付款', '银行对账']
  },
  {
    accountHolder: '武汉启程空间设计有限公司',
    accountTailNumber: '7766',
    bankName: '建设银行',
    defaultFor: [],
    displayName: '建设银行备用付款户',
    id: 'public-account-ccb-payment-reserve',
    note: '用于备用付款和银行对账场景，具体业务由来源单据决定。',
    openingBalance: 50000,
    openingBalanceDate: '2026-06-01',
    operationRecords: [
      {
        action: '初始化',
        actor: '系统',
        object: '建设银行备用付款户',
        summary: '建立付款账户配置',
        time: '2026-06-16 10:28'
      }
    ],
    status: '启用',
    updatedAt: publicAccountConfigToday,
    usage: ['付款', '银行对账']
  }
];

function getNextSequence(rows: PublicAccountRecord[]) {
  return rows.length + 1;
}

function buildOperationRecord(action: string, object: string, summary: string): OperationRecord {
  return {
    action,
    actor: '李明',
    object,
    summary,
    time: `${publicAccountConfigToday} 10:30`
  };
}

function normalizeTailNumber(value: string) {
  return value.replace(/\D/g, '').slice(-4);
}

function normalizePublicAccountValue(nextValue: PublicAccountFormValue): PublicAccountFormValue {
  const usage = [...new Set(nextValue.usage)];
  const defaultFor = nextValue.status === '启用'
    ? [...new Set(nextValue.defaultFor)].filter((item) => usage.includes(item))
    : [];

  return {
    ...nextValue,
    accountHolder: nextValue.accountHolder.trim(),
    accountTailNumber: normalizeTailNumber(nextValue.accountTailNumber),
    bankName: nextValue.bankName.trim(),
    defaultFor,
    displayName: nextValue.displayName.trim(),
    note: nextValue.note.trim(),
    openingBalanceDate: nextValue.openingBalanceDate.trim(),
    usage
  };
}

export function reconcilePublicAccountDefaults(
  rows: PublicAccountRecord[],
  targetId: string,
  nextDefaultFor: PublicAccountUsage[]
) {
  const transferredUsages = new Set(nextDefaultFor);

  return rows.map((row) =>
    row.id === targetId
      ? row
      : {
          ...row,
          defaultFor: row.defaultFor.filter((usage) => !transferredUsages.has(usage))
        }
  );
}

const PublicAccountConfigContext = createContext<PublicAccountConfigStateValue | undefined>(undefined);

export function formatPublicAccountTail(accountTailNumber: string) {
  const tail = normalizeTailNumber(accountTailNumber);
  return tail ? `**** ${tail}` : '-';
}

export function buildPublicAccountSnapshot(record: PublicAccountRecord): PublicAccountSnapshot {
  return {
    accountHolder: record.accountHolder,
    accountTailNumber: record.accountTailNumber,
    bankName: record.bankName,
    displayName: record.displayName
  };
}

export function buildPublicAccountRef(record: PublicAccountRecord): PublicAccountRef {
  return {
    publicAccountId: record.id,
    publicAccountSnapshot: buildPublicAccountSnapshot(record)
  };
}

export function getPublicAccountDisplayName(record?: PublicAccountRecord | PublicAccountSnapshot) {
  return record?.displayName ?? '未配置对公账户';
}

export function getActivePublicAccounts(rows: PublicAccountRecord[], usage?: PublicAccountUsage) {
  return rows.filter((row) => row.status === '启用' && (!usage || row.usage.includes(usage)));
}

export function getDefaultPublicAccount(rows: PublicAccountRecord[], usage?: PublicAccountUsage) {
  const activeRows = getActivePublicAccounts(rows, usage);

  if (usage) {
    return activeRows.find((row) => row.defaultFor.includes(usage)) ?? activeRows[0];
  }

  return activeRows.find((row) => row.defaultFor.length > 0) ?? activeRows[0];
}

export function getDefaultPublicAccountRef(rows: PublicAccountRecord[], usage?: PublicAccountUsage) {
  const account = getDefaultPublicAccount(rows, usage);
  return account ? buildPublicAccountRef(account) : undefined;
}

export function resolvePublicAccountRef(rows: PublicAccountRecord[], publicAccountId: string) {
  const account = rows.find((row) => row.id === publicAccountId);
  return account ? buildPublicAccountRef(account) : undefined;
}

export function resolveActivePublicAccountRef(rows: PublicAccountRecord[], publicAccountId: string, usage?: PublicAccountUsage) {
  const account = getActivePublicAccounts(rows, usage).find((row) => row.id === publicAccountId);
  return account ? buildPublicAccountRef(account) : undefined;
}

export function buildPublicAccountOptions(rows: PublicAccountRecord[], usage?: PublicAccountUsage) {
  return getActivePublicAccounts(rows, usage).map((row) => ({
    label: row.displayName,
    snapshot: buildPublicAccountSnapshot(row),
    type: '对公账户' as const,
    value: row.id
  }));
}

export function PublicAccountConfigProvider({ children }: { children: ReactNode }) {
  const [publicAccounts, setPublicAccounts] = useState<PublicAccountRecord[]>(() => publicAccountSeeds);

  const value = useMemo<PublicAccountConfigStateValue>(
    () => ({
      createPublicAccount(nextValue) {
        const normalizedValue = normalizePublicAccountValue(nextValue);
        const sequence = String(getNextSequence(publicAccounts)).padStart(3, '0');
        const nextRecord: PublicAccountRecord = {
          ...normalizedValue,
          id: `public-account-custom-${sequence}`,
          operationRecords: [
            buildOperationRecord('新增账户', normalizedValue.displayName, '新增对公账户配置')
          ],
          updatedAt: publicAccountConfigToday
        };

        setPublicAccounts((currentRows) => [
          ...reconcilePublicAccountDefaults(currentRows, nextRecord.id, nextRecord.defaultFor),
          nextRecord
        ]);

        return nextRecord;
      },
      publicAccounts,
      updatePublicAccount(id, nextValue, activeReferenceCount = 0) {
        const normalizedValue = normalizePublicAccountValue(nextValue);
        const target = publicAccounts.find((row) => row.id === id);
        const validation = validateDefaultMasterDataStatusChange(
          normalizedValue.status,
          Boolean(target?.defaultFor.length),
          '请先将默认用途转移到其他启用账户'
        );
        if (!validation.success) {
          return validation;
        }
        if (normalizedValue.status === '停用' && activeReferenceCount > 0) {
          return blockMasterDataMutation(`仍有 ${activeReferenceCount} 条待处理流水使用该账户`);
        }

        setPublicAccounts((currentRows) =>
          reconcilePublicAccountDefaults(currentRows, id, normalizedValue.defaultFor).map((row) =>
            row.id === id
              ? {
                  ...row,
                  ...normalizedValue,
                  operationRecords: [
                    buildOperationRecord('编辑账户', normalizedValue.displayName, '更新对公账户配置'),
                    ...row.operationRecords
                  ],
                  updatedAt: publicAccountConfigToday
                }
              : row
          )
        );
        return validation;
      },
      updatePublicAccountStatus(id, status, activeReferenceCount = 0) {
        const target = publicAccounts.find((row) => row.id === id);
        const validation = validateDefaultMasterDataStatusChange(
          status,
          Boolean(target?.defaultFor.length),
          '请先将默认用途转移到其他启用账户'
        );
        if (!validation.success) {
          return validation;
        }
        if (status === '停用' && activeReferenceCount > 0) {
          return blockMasterDataMutation(`仍有 ${activeReferenceCount} 条待处理流水使用该账户`);
        }

        setPublicAccounts((currentRows) =>
          currentRows.map((row) =>
            row.id === id
              ? {
                  ...row,
                  operationRecords: [
                    buildOperationRecord(status === '启用' ? '启用账户' : '停用账户', row.displayName, `账户状态调整为${status}`),
                    ...row.operationRecords
                  ],
                  status,
                  updatedAt: publicAccountConfigToday
                }
              : row
          )
        );
        return validation;
      }
    }),
    [publicAccounts]
  );

  return <PublicAccountConfigContext.Provider value={value}>{children}</PublicAccountConfigContext.Provider>;
}

export function usePublicAccountConfigState() {
  const value = useContext(PublicAccountConfigContext);

  if (!value) {
    throw new Error('usePublicAccountConfigState must be used within PublicAccountConfigProvider');
  }

  return value;
}
