import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { OperationRecord } from '../../components/OperationRecordTable';
import type { TagChipTone } from '../../components/TagChip';

export type PublicAccountStatus = '启用' | '停用';
export type PublicAccountUsage = '收款' | '付款' | '资金处理' | '银行对账';

export type PublicAccountRecord = {
  accountHolder: string;
  accountTailNumber: string;
  bankName: string;
  displayName: string;
  id: string;
  note: string;
  openingBalance: number;
  operationRecords: OperationRecord[];
  status: PublicAccountStatus;
  updatedAt: string;
  usage: PublicAccountUsage[];
};

export type PublicAccountFormValue = Pick<
  PublicAccountRecord,
  'accountHolder' | 'accountTailNumber' | 'bankName' | 'displayName' | 'note' | 'openingBalance' | 'status' | 'usage'
>;

type PublicAccountConfigStateValue = {
  createPublicAccount: (nextValue: PublicAccountFormValue) => PublicAccountRecord;
  publicAccounts: PublicAccountRecord[];
  updatePublicAccount: (id: string, nextValue: PublicAccountFormValue) => void;
  updatePublicAccountStatus: (id: string, status: PublicAccountStatus) => void;
};

export const publicAccountConfigToday = '2026-06-17';
export const publicAccountUsageOptions: PublicAccountUsage[] = ['收款', '付款', '资金处理', '银行对账'];

export const publicAccountStatusTone: Record<PublicAccountStatus, TagChipTone> = {
  停用: 'gray',
  启用: 'green'
};

export const publicAccountUsageTone: Record<PublicAccountUsage, TagChipTone> = {
  收款: 'green',
  付款: 'red',
  资金处理: 'blue',
  银行对账: 'purple'
};

export const publicAccountSeeds: PublicAccountRecord[] = [
  {
    accountHolder: '示例企业管理有限公司',
    accountTailNumber: '0821',
    bankName: '招商银行',
    displayName: '招商银行基本户',
    id: 'public-account-cmb-basic',
    note: '公司正式对公结算账户。',
    openingBalance: 120000,
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
    usage: ['收款', '付款', '资金处理', '银行对账']
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
  return {
    ...nextValue,
    accountHolder: nextValue.accountHolder.trim(),
    accountTailNumber: normalizeTailNumber(nextValue.accountTailNumber),
    bankName: nextValue.bankName.trim(),
    displayName: nextValue.displayName.trim(),
    note: nextValue.note.trim(),
    usage: [...new Set(nextValue.usage)]
  };
}

const PublicAccountConfigContext = createContext<PublicAccountConfigStateValue | undefined>(undefined);

export function formatPublicAccountTail(accountTailNumber: string) {
  const tail = normalizeTailNumber(accountTailNumber);
  return tail ? `**** ${tail}` : '-';
}

export function getPublicAccountDisplayName(record?: PublicAccountRecord) {
  return record?.displayName ?? '未配置对公账户';
}

export function getActivePublicAccounts(rows: PublicAccountRecord[], usage?: PublicAccountUsage) {
  return rows.filter((row) => row.status === '启用' && (!usage || row.usage.includes(usage)));
}

export function getDefaultPublicAccount(rows: PublicAccountRecord[], usage?: PublicAccountUsage) {
  return getActivePublicAccounts(rows, usage)[0] ?? rows[0];
}

export function buildPublicAccountOptions(rows: PublicAccountRecord[], usage?: PublicAccountUsage) {
  return getActivePublicAccounts(rows, usage).map((row) => ({
    label: row.displayName,
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

        setPublicAccounts((currentRows) => [...currentRows, nextRecord]);

        return nextRecord;
      },
      publicAccounts,
      updatePublicAccount(id, nextValue) {
        const normalizedValue = normalizePublicAccountValue(nextValue);

        setPublicAccounts((currentRows) =>
          currentRows.map((row) =>
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
      },
      updatePublicAccountStatus(id, status) {
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
