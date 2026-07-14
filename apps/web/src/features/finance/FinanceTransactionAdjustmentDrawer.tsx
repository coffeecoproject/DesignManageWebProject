import { AuditOutlined, BankOutlined, FileProtectOutlined, SwapOutlined, WalletOutlined } from '@ant-design/icons';
import { Input, Select } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DrawerFormField, DrawerFormGrid } from '../../components/DrawerForm';
import { ImportDrawerShell } from '../../components/DrawerShell';
import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import { CellText } from '../../components/TableCell';
import type { FinanceTransactionRecord } from './financeData';
import {
  buildFinanceTransactionAdjustmentRecord,
  createFinanceTransactionAdjustmentForm,
  getDefaultFinanceTransactionAdjustmentAmountText,
  getFinanceTransactionAdjustmentAmount,
  getFinanceTransactionAdjustmentSignedDifference,
  type FinanceTransactionAdjustmentBankContext,
  type FinanceTransactionAdjustmentFormValue,
  type FinanceTransactionAdjustmentMode
} from './financeTransactionAdjustmentModel';
import {
  directionTone,
  financeToday,
  formatMoney,
  getFinanceRecordCategorySnapshot,
  getPublicAccountSignedAmount,
  transactionStatusTone
} from './financeUtils';
import { FinanceVoucherUploadPanel, type FinanceVoucherUploadFile } from './FinanceVoucherUploadPanel';

type FinanceTransactionAdjustmentDrawerProps = {
  bankContext?: FinanceTransactionAdjustmentBankContext;
  existingRows: FinanceTransactionRecord[];
  open: boolean;
  originRecord?: FinanceTransactionRecord;
  onClose: () => void;
  onSubmit: (record: FinanceTransactionRecord) => void;
};

const adjustmentModeOptions: FinanceTransactionAdjustmentMode[] = ['冲正', '补差'];

function formatSignedMoney(amount: number | undefined) {
  if (amount === undefined) {
    return '-';
  }

  return amount < 0 ? `-${formatMoney(Math.abs(amount))}` : formatMoney(amount);
}

function buildAdjustmentFile(file: FinanceVoucherUploadFile): RelatedFileRecord {
  return {
    id: `fin-adjust-file-${file.uid}-${Date.now()}`,
    name: file.name,
    status: '已上传',
    type: '调整凭证',
    updatedAt: financeToday
  };
}

export function FinanceTransactionAdjustmentDrawer({
  bankContext,
  existingRows,
  open,
  originRecord,
  onClose,
  onSubmit
}: FinanceTransactionAdjustmentDrawerProps) {
  const [form, setForm] = useState<FinanceTransactionAdjustmentFormValue | undefined>();
  const [files, setFiles] = useState<RelatedFileRecord[]>([]);

  useEffect(() => {
    if (open && originRecord) {
      setForm(createFinanceTransactionAdjustmentForm(originRecord, bankContext));
      setFiles([]);
    }
  }, [bankContext, open, originRecord]);

  const signedDifference = useMemo(
    () => (originRecord ? getFinanceTransactionAdjustmentSignedDifference(originRecord, bankContext) : undefined),
    [bankContext, originRecord]
  );
  const availableModeOptions = bankContext ? adjustmentModeOptions.filter((mode) => mode === '补差') : adjustmentModeOptions;
  const adjustmentAmount = form ? getFinanceTransactionAdjustmentAmount(form) : 0;
  const requiresFullReversal = Boolean(originRecord?.naturalPersonPayment && form?.mode === '冲正');
  const hasInvalidPartialNaturalPersonReversal = Boolean(
    requiresFullReversal && originRecord && Math.abs(adjustmentAmount - originRecord.amount) >= 0.01
  );
  const primaryDisabled = !originRecord
    || !form
    || adjustmentAmount <= 0
    || form.reason.trim().length === 0
    || hasInvalidPartialNaturalPersonReversal;

  function updateForm<K extends keyof FinanceTransactionAdjustmentFormValue>(field: K, value: FinanceTransactionAdjustmentFormValue[K]) {
    setForm((current) => current ? { ...current, [field]: value } : current);
  }

  function handleModeChange(mode: FinanceTransactionAdjustmentMode) {
    if (!originRecord) {
      return;
    }

    setForm((current) =>
      current
        ? {
            ...current,
            amountText: getDefaultFinanceTransactionAdjustmentAmountText(originRecord, mode, bankContext),
            mode
          }
        : current
    );
  }

  function handleFileSelect(file: FinanceVoucherUploadFile) {
    setFiles((current) => [buildAdjustmentFile(file), ...current]);
  }

  function handleSubmit() {
    if (!originRecord || !form || primaryDisabled) {
      return;
    }

    onSubmit(buildFinanceTransactionAdjustmentRecord({
      bankContext,
      existingRows,
      files,
      form,
      originRecord
    }));
  }

  return (
    <ImportDrawerShell
      bodyTestId="finance-transaction-adjustment-drawer"
      cancelAction={{ label: '取消', onClick: onClose }}
      className="finance-transaction-drawer"
      open={open}
      primaryAction={{
        disabled: primaryDisabled,
        icon: <SwapOutlined />,
        label: '生成待复核流水',
        testId: 'finance-transaction-adjustment-submit-button',
        onClick: handleSubmit
      }}
      title="冲正补差"
      width={820}
      onClose={onClose}
    >
      {originRecord && form ? (
        <div className="detail-tab-stack">
          <DetailSection icon={<WalletOutlined />} title="原流水">
            <DetailInfoGrid
              columns={3}
              items={[
                { label: '流水号', value: originRecord.transactionNo },
                { label: '发生日期', value: originRecord.occurredAt },
                { label: '流水状态', value: <StatusTag toneMap={transactionStatusTone} value={originRecord.status} /> },
                { label: '收支方向', value: <StatusTag toneMap={directionTone} value={originRecord.direction} /> },
                { label: '财务类目', value: getFinanceRecordCategorySnapshot(originRecord).secondaryName },
                { label: '原流水金额', value: formatSignedMoney(getPublicAccountSignedAmount(originRecord)) },
                { label: '业务对象', value: originRecord.counterparty },
                { label: '来源单号', value: originRecord.sourceNo },
                { label: '事项说明', value: originRecord.sourceTitle, wide: true }
              ]}
            />
          </DetailSection>

          {bankContext ? (
            <DetailSection icon={<BankOutlined />} title="银行流水">
              <DetailInfoGrid
                columns={3}
                items={[
                  { label: '银行流水号', value: bankContext.bankSerialNo },
                  { label: '银行日期', value: bankContext.statementDate },
                  { label: '银行金额', value: formatSignedMoney(bankContext.direction === '出账' ? -bankContext.amount : bankContext.amount) },
                  { label: '对方户名', value: bankContext.counterparty },
                  { label: '差额', value: <CellText tone={signedDifference === 0 ? 'muted' : 'expense'}>{formatSignedMoney(signedDifference)}</CellText> },
                  { label: '摘要', value: bankContext.summary, wide: true }
                ]}
              />
            </DetailSection>
          ) : null}

          <DetailSection icon={<AuditOutlined />} title="处理信息">
            <DrawerFormGrid>
              <DrawerFormField label="处理方式" required>
                <Select
                  options={availableModeOptions.map((mode) => ({ label: mode, value: mode }))}
                  value={form.mode}
                  onChange={handleModeChange}
                />
              </DrawerFormField>
              <DrawerFormField label="发生日期" required>
                <Input value={form.occurredAt} onChange={(event) => updateForm('occurredAt', event.target.value)} />
              </DrawerFormField>
              <DrawerFormField label="处理金额" required>
                <Input
                  disabled={Boolean(bankContext) || requiresFullReversal}
                  value={form.amountText}
                  onChange={(event) => updateForm('amountText', event.target.value)}
                />
              </DrawerFormField>
              <DrawerFormField label="原因" required wide>
                <Input value={form.reason} onChange={(event) => updateForm('reason', event.target.value)} />
              </DrawerFormField>
              <DrawerFormField label="说明" wide>
                <Input.TextArea rows={3} value={form.note} onChange={(event) => updateForm('note', event.target.value)} />
              </DrawerFormField>
            </DrawerFormGrid>
          </DetailSection>

          <DetailSection icon={<FileProtectOutlined />} title="处理凭证">
            <FinanceVoucherUploadPanel
              emptyText="暂无处理凭证文件"
              files={files}
              title="上传处理凭证"
              onRemove={(file) => setFiles((current) => current.filter((item) => item.id !== file.id))}
              onSelect={handleFileSelect}
            />
          </DetailSection>
        </div>
      ) : null}
    </ImportDrawerShell>
  );
}
