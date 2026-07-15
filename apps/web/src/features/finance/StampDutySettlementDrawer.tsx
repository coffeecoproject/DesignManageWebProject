import { FileProtectOutlined, SaveOutlined } from '@ant-design/icons';
import { DatePicker, Input, InputNumber } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection } from '../../components/Detail';
import { DrawerFormField, DrawerFormGrid, DrawerFormShell } from '../../components/DrawerForm';
import { FileSlot } from '../../components/FileSlot';
import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import {
  validateStampDutyDocumentAmounts,
  type FinanceStampDutySettlementInput,
  type FinanceStampDutySourceRecord
} from './financeStampDutyModel';
import { financeToday } from './financeUtils';

type SettlementForm = {
  amount?: number;
  evidenceFiles: RelatedFileRecord[];
  referenceNo: string;
  settledAt: string;
  statedVatAmount?: number;
};

function createSettlementForm(record?: FinanceStampDutySourceRecord): SettlementForm {
  return {
    evidenceFiles: [],
    referenceNo: '',
    settledAt: record?.signedAt && record.signedAt > financeToday ? record.signedAt : financeToday
  };
}

function getSettlementFormError(record: FinanceStampDutySourceRecord, form: SettlementForm) {
  if (!form.referenceNo.trim()) {
    return '请填写结算单号';
  }

  if (!form.settledAt) {
    return '请选择实际结算日期';
  }

  if (record.signedAt && form.settledAt < record.signedAt) {
    return '实际结算日期不能早于应税凭证书立日期';
  }

  const amountError = validateStampDutyDocumentAmounts({
    amount: form.amount,
    amountTaxMode: record.amountTaxMode,
    vatAmount: form.statedVatAmount
  });

  if (amountError || form.amount === undefined) {
    return amountError ?? '请填写实际结算金额';
  }

  if (record.amountTaxMode === '价税分列' && form.statedVatAmount === undefined) {
    return '请填写单列增值税额';
  }

  if (form.evidenceFiles.length === 0) {
    return '请上传实际结算依据';
  }

  return undefined;
}

export function StampDutySettlementDrawer({
  record,
  onClose,
  onSave
}: {
  record?: FinanceStampDutySourceRecord;
  onClose: () => void;
  onSave: (input: FinanceStampDutySettlementInput) => void;
}) {
  const [form, setForm] = useState<SettlementForm>(createSettlementForm);

  useEffect(() => {
    setForm(createSettlementForm(record));
  }, [record]);

  const formError = useMemo(
    () => record ? getSettlementFormError(record, form) : '未选择税源',
    [form, record]
  );

  if (!record) {
    return null;
  }

  const selectedRecord = record;

  function addEvidenceFile(file: UploadFile) {
    setForm((current) => ({
      ...current,
      evidenceFiles: [
        ...current.evidenceFiles.filter((currentFile) => currentFile.name !== file.name),
        {
          id: String(file.uid),
          name: file.name,
          status: '已选择',
          type: '结算依据',
          updatedAt: form.settledAt || financeToday
        }
      ]
    }));
  }

  function save() {
    if (formError || form.amount === undefined) {
      return;
    }

    onSave({
      amount: form.amount,
      evidenceFiles: form.evidenceFiles,
      id: form.referenceNo.trim().replace(/\s+/g, '-'),
      settledAt: form.settledAt,
      statedVatAmount: selectedRecord.amountTaxMode === '价税分列' ? form.statedVatAmount : undefined
    });
  }

  return (
    <DrawerFormShell
      bodyTestId="finance-stamp-duty-settlement-drawer"
      cancelAction={{ label: '取消', onClick: onClose }}
      open
      primaryAction={{ disabled: Boolean(formError), icon: <SaveOutlined />, label: '保存结算', onClick: save }}
      title={
        <DetailDrawerTitle
          status="待后续结算"
          subtitle={`${record.sourceNo} / ${record.taxItem}`}
          title="登记实际结算"
        />
      }
      width={760}
      onClose={onClose}
    >
      <DetailSection icon={<FileProtectOutlined />} title="原应税凭证">
        <DetailInfoGrid
          columns={3}
          items={[
            { label: '凭证名称', value: record.documentName },
            { label: '书立日期', value: record.signedAt ?? '-' },
            { label: '申报方式', value: record.declarationScenario },
            { label: '对方主体', value: record.counterparty },
            { label: '价税口径', value: record.amountTaxMode },
            { label: '原税源状态', value: record.resolutionStatus }
          ]}
        />
      </DetailSection>

      <DetailSection icon={<FileProtectOutlined />} title="结算信息">
        <DrawerFormGrid>
          <DrawerFormField label="结算单号" required>
            <Input
              maxLength={50}
              placeholder="填写结算单或对账单编号"
              value={form.referenceNo}
              onChange={(event) => setForm({ ...form, referenceNo: event.target.value })}
            />
          </DrawerFormField>
          <DrawerFormField label="实际结算日期" required>
            <DatePicker
              allowClear={false}
              disabledDate={(date) => Boolean(selectedRecord.signedAt && date.isBefore(dayjs(selectedRecord.signedAt), 'day'))}
              style={{ width: '100%' }}
              value={dayjs(form.settledAt)}
              onChange={(date) => setForm({ ...form, settledAt: date?.format('YYYY-MM-DD') ?? '' })}
            />
          </DrawerFormField>
          <DrawerFormField label="实际结算金额" required>
            <InputNumber
              min={0.01}
              precision={2}
              style={{ width: '100%' }}
              value={form.amount}
              onChange={(amount) => setForm({ ...form, amount: amount === null ? undefined : Number(amount) })}
            />
          </DrawerFormField>
          {record.amountTaxMode === '价税分列' ? (
            <DrawerFormField label="单列增值税额" required>
              <InputNumber
                min={0}
                precision={2}
                style={{ width: '100%' }}
                value={form.statedVatAmount}
                onChange={(statedVatAmount) => setForm({
                  ...form,
                  statedVatAmount: statedVatAmount === null ? undefined : Number(statedVatAmount)
                })}
              />
            </DrawerFormField>
          ) : null}
        </DrawerFormGrid>
      </DetailSection>

      <DetailSection icon={<FileProtectOutlined />} title="结算依据">
        <FileSlot<RelatedFileRecord>
          accept=".pdf,.jpg,.jpeg,.png"
          description="上传结算单、对账单或其他能够确定实际金额的文件。"
          emptyText="至少上传 1 份结算依据"
          files={form.evidenceFiles}
          multiple
          status={form.evidenceFiles.length > 0 ? '已选择' : '待补充'}
          title="结算文件 *"
          uploadText="上传文件"
          variant="list"
          onRemove={(file) => setForm((current) => ({
            ...current,
            evidenceFiles: current.evidenceFiles.filter((currentFile) => currentFile.id !== file.id)
          }))}
          onSelect={addEvidenceFile}
        />
      </DetailSection>
    </DrawerFormShell>
  );
}
