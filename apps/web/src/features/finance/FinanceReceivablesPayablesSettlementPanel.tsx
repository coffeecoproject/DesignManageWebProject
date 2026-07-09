import { WalletOutlined } from '@ant-design/icons';
import { Alert, Button, DatePicker, Input, InputNumber, Select } from 'antd';
import dayjs from 'dayjs';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { DetailInfoGrid, DetailSection } from '../../components/Detail';
import { DrawerFormField, DrawerFormGrid } from '../../components/DrawerForm';
import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import { TagChip } from '../../components/TagChip';
import type { FinanceTransactionRecord } from './financeData';
import { financeReceivablePayableLinkedTransactionColumns } from './FinanceReceivablesPayablesColumns';
import { FinanceVoucherUploadPanel, type FinanceVoucherUploadFile } from './FinanceVoucherUploadPanel';
import type { FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';
import {
  canRegisterFinanceReceivablePayableSettlement,
  getFinanceReceivablePayablePendingSettlementAmount,
  isFinanceReceivablePayableConfirmed,
  isFinanceReceivablePayableVoided,
  type FinanceReceivablePayableSettlementFormValue
} from './financeReceivablesPayablesModel';
import { formatMoney } from './financeUtils';

type FinanceReceivablesPayablesPublicAccountOption = {
  label: string;
  value: string;
};

type FinanceReceivablesPayablesSettlementPanelProps = {
  accountOptions: FinanceReceivablesPayablesPublicAccountOption[];
  form: FinanceReceivablePayableSettlementFormValue;
  linkedTransactionRows: FinanceTransactionRecord[];
  maxAmount: number;
  record: FinanceReceivablePayableRecord;
  lockedReason?: string;
  lockedNotice?: string;
  submitDisabled: boolean;
  onDownloadFile: (file: RelatedFileRecord) => void;
  onPreviewFile: (file: RelatedFileRecord) => void;
  onRemoveFile: (file: RelatedFileRecord) => void;
  onSelectFile: (file: FinanceVoucherUploadFile) => void;
  onSubmit: () => void;
  onUpdate: <K extends keyof FinanceReceivablePayableSettlementFormValue>(
    field: K,
    value: FinanceReceivablePayableSettlementFormValue[K]
  ) => void;
};

function normalizePickerValue(dateString: string | string[]) {
  return Array.isArray(dateString) ? dateString[0] ?? '' : dateString;
}

export function FinanceReceivablesPayablesSettlementPanel({
  accountOptions,
  form,
  linkedTransactionRows,
  maxAmount,
  record,
  lockedReason,
  lockedNotice,
  submitDisabled,
  onDownloadFile,
  onPreviewFile,
  onRemoveFile,
  onSelectFile,
  onSubmit,
  onUpdate
}: FinanceReceivablesPayablesSettlementPanelProps) {
  const actionLabel = record.direction === '应收' ? '登记收款' : '登记付款';
  const progressLabel = record.direction === '应收' ? '收款进度' : '付款进度';
  const amountLabel = record.direction === '应收' ? '收款金额' : '付款金额';
  const accountLabel = record.direction === '应收' ? '入账账户' : '付款账户';
  const voucherTitle = record.direction === '应收' ? '收款凭证' : '付款凭证';
  const pendingAmount = getFinanceReceivablePayablePendingSettlementAmount(linkedTransactionRows);
  const confirmed = isFinanceReceivablePayableConfirmed(record);
  const voided = isFinanceReceivablePayableVoided(record);
  const canRegister = canRegisterFinanceReceivablePayableSettlement(record, linkedTransactionRows);
  const canRegisterNow = canRegister && !lockedReason;
  const settled = record.settlementStatus === '已结清';
  const statusLabel = canRegister
    ? lockedReason
      ? '只读回看'
      : '可继续登记'
    : voided
      ? '事项已作废'
      : !confirmed
        ? '事项确认后可登记'
        : pendingAmount > 0
      ? '已有待复核流水'
      : settled
        ? '已结清'
        : '暂无可登记金额';

  return (
    <DetailSection
      extra={
        canRegisterNow ? (
          <Button disabled={submitDisabled} type="primary" onClick={onSubmit}>
            {actionLabel}
          </Button>
        ) : (
          <TagChip label={statusLabel} tone={lockedReason || pendingAmount > 0 ? 'blue' : 'gray'} />
        )
      }
      icon={<WalletOutlined />}
      title={progressLabel}
    >
      <div className="finance-rp-settlement-stack">
        {lockedNotice ? (
          <Alert className="finance-period-readback-alert" message={lockedNotice} showIcon type="info" />
        ) : null}

        <DetailInfoGrid
          columns={4}
          items={[
            { label: record.direction === '应收' ? '应收金额' : '应付金额', value: formatMoney(record.amount) },
            { label: record.direction === '应收' ? '已收金额' : '已付金额', value: formatMoney(record.settledAmount) },
            { label: '已登记待复核', value: formatMoney(pendingAmount) },
            { label: record.direction === '应收' ? '剩余可登记收款' : '剩余可登记付款', value: formatMoney(maxAmount) }
          ]}
        />

        <CompactDetailTable<FinanceTransactionRecord>
          columns={financeReceivablePayableLinkedTransactionColumns}
          dataSource={linkedTransactionRows}
          emptyText="暂无关联流水"
          rowKey="id"
          scrollX={800}
        />

        {canRegisterNow ? (
          <DrawerFormGrid>
            <DrawerFormField label={record.direction === '应收' ? '收款日期' : '付款日期'} required>
              <DatePicker
                inputReadOnly
                style={{ width: '100%' }}
                value={form.occurredAt ? dayjs(form.occurredAt) : undefined}
                onChange={(_, dateString) => onUpdate('occurredAt', normalizePickerValue(dateString))}
              />
            </DrawerFormField>
            <DrawerFormField label={amountLabel} required>
              <InputNumber
                max={maxAmount}
                min={0}
                precision={2}
                style={{ width: '100%' }}
                value={form.amount}
                onChange={(amount) => onUpdate('amount', Number(amount ?? 0))}
              />
            </DrawerFormField>
            <DrawerFormField label={accountLabel} required>
              <Select
                options={accountOptions}
                value={form.publicAccountId}
                onChange={(publicAccountId) => onUpdate('publicAccountId', publicAccountId)}
              />
            </DrawerFormField>
            <DrawerFormField label="备注">
              <Input.TextArea
                autoSize={{ minRows: 2, maxRows: 4 }}
                value={form.note}
                onChange={(event) => onUpdate('note', event.target.value)}
              />
            </DrawerFormField>
          </DrawerFormGrid>
        ) : null}

        {canRegisterNow ? (
          <FinanceVoucherUploadPanel
            description="登记收付款必须上传凭证，支持 PDF/JPG/PNG，单个不超过 10MB。"
            files={form.files}
            title={voucherTitle}
            onDownload={onDownloadFile}
            onPreview={onPreviewFile}
            onRemove={onRemoveFile}
            onSelect={onSelectFile}
          />
        ) : null}
      </div>
    </DetailSection>
  );
}
