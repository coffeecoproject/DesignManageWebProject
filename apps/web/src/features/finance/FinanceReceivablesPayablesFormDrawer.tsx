import { DatePicker, Input, InputNumber, Select } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import dayjs from 'dayjs';
import { FileProtectOutlined, ProfileOutlined, WalletOutlined } from '@ant-design/icons';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DrawerFormField, DrawerFormGrid, DrawerFormShell } from '../../components/DrawerForm';
import { FileSlot, FileSlotGrid } from '../../components/FileSlot';
import {
  financePrimaryCategorySeeds,
  financeSecondaryCategorySeeds,
  type FinancePrimaryCategoryConfig,
  type FinanceSecondaryCategoryConfig
} from './financeData';
import type { FinanceReceivablePayableRecord } from './financeReceivablesPayablesData';
import {
  receivablePayableDirectionTone
} from './financeReceivablesPayablesData';
import {
  getFinanceReceivablePayableSourceLabel,
  type FinanceReceivablePayableFormValue
} from './financeReceivablesPayablesModel';
import { financeToday } from './financeUtils';

type FinanceReceivablesPayablesFormDrawerProps = {
  form: FinanceReceivablePayableFormValue;
  open: boolean;
  record?: FinanceReceivablePayableRecord;
  saveDisabled: boolean;
  onCancel: () => void;
  onSave: () => void;
  onUpdate: <K extends keyof FinanceReceivablePayableFormValue>(
    field: K,
    value: FinanceReceivablePayableFormValue[K]
  ) => void;
};

function normalizePickerValue(dateString: string | string[]) {
  return Array.isArray(dateString) ? dateString[0] ?? '' : dateString;
}

function getCategoryOptions(direction: FinanceReceivablePayableFormValue['direction']) {
  const targetDirection = direction === '应收' ? '收入' : '支出';

  return financeSecondaryCategorySeeds.filter((category) => category.status === '启用' && category.direction === targetDirection);
}

function getPrimaryCategoryOptions(direction: FinanceReceivablePayableFormValue['direction']) {
  const targetDirection = direction === '应收' ? '收入' : '支出';

  return financePrimaryCategorySeeds.filter((category) => category.status === '启用' && category.direction === targetDirection);
}

function getPrimaryCategorySelectOptions(categories: FinancePrimaryCategoryConfig[]) {
  return categories.map((category) => ({
    label: category.name,
    value: category.id
  }));
}

function getCategorySelectOptions(categories: FinanceSecondaryCategoryConfig[]) {
  return categories.map((category) => ({
    label: category.name,
    value: category.name
  }));
}

function getSelectedSecondaryCategory(categoryName: string) {
  return financeSecondaryCategorySeeds.find((category) => category.name === categoryName);
}

function toBasisFile(file: UploadFile) {
  return {
    id: file.uid || file.name,
    name: file.name,
    status: '已选择',
    type: '确认依据',
    updatedAt: financeToday
  };
}

export function FinanceReceivablesPayablesFormDrawer({
  form,
  open,
  record,
  saveDisabled,
  onCancel,
  onSave,
  onUpdate
}: FinanceReceivablesPayablesFormDrawerProps) {
  const primaryCategoryOptions = getPrimaryCategoryOptions(form.direction);
  const selectedSecondaryCategory = getSelectedSecondaryCategory(form.category);
  const selectedPrimaryCategoryId = selectedSecondaryCategory?.primaryId ?? primaryCategoryOptions[0]?.id;
  const categoryOptions = getCategoryOptions(form.direction).filter((category) => category.primaryId === selectedPrimaryCategoryId);

  function handlePrimaryCategoryChange(primaryId: string) {
    const nextCategory = getCategoryOptions(form.direction).find((category) => category.primaryId === primaryId);

    if (nextCategory) {
      onUpdate('category', nextCategory.name);
    }
  }

  function handleBasisFileSelect(file: UploadFile) {
    const nextFile = toBasisFile(file);
    const nextFiles = form.files.some((currentFile) => currentFile.name === nextFile.name)
      ? form.files.map((currentFile) => (currentFile.name === nextFile.name ? nextFile : currentFile))
      : [...form.files, nextFile];

    onUpdate('files', nextFiles);
  }

  return (
    <DrawerFormShell
      bodyTestId="finance-rp-form-drawer"
      cancelAction={{ label: '取消', onClick: onCancel }}
      layout="plain"
      open={open}
      primaryAction={{
        disabled: saveDisabled,
        label: '保存调整',
        onClick: onSave
      }}
      title={
        <DetailDrawerTitle
          subtitle={record?.documentNo ?? '事项调整'}
          title="调整事项"
        />
      }
      width={860}
      onClose={onCancel}
    >
      <DetailSection icon={<ProfileOutlined />} title="源单信息">
        <DetailInfoGrid
          columns={3}
          items={[
            {
              label: '方向',
              value: <StatusTag toneMap={receivablePayableDirectionTone} value={form.direction} />
            },
            { label: '对象', value: form.counterparty },
            { label: '对象类型', value: form.counterpartyType },
            { label: '来源类型', value: getFinanceReceivablePayableSourceLabel(form.sourceType) },
            { label: '来源单号', value: form.sourceNo },
            { label: '事项名称', value: form.sourceTitle }
          ]}
        />
      </DetailSection>

      <DetailSection icon={<FileProtectOutlined />} title="事项信息">
        <DrawerFormGrid>
          <DrawerFormField label="一级类目" required>
            <Select
              options={getPrimaryCategorySelectOptions(primaryCategoryOptions)}
              value={selectedPrimaryCategoryId}
              onChange={handlePrimaryCategoryChange}
            />
          </DrawerFormField>
          <DrawerFormField label="二级类目" required>
            <Select
              options={getCategorySelectOptions(categoryOptions)}
              value={form.category}
              onChange={(category) => onUpdate('category', category)}
            />
          </DrawerFormField>
          <DrawerFormField label="归属月份" required>
            <DatePicker
              inputReadOnly
              picker="month"
              style={{ width: '100%' }}
              value={form.accountingPeriod ? dayjs(form.accountingPeriod) : undefined}
              onChange={(_, dateString) => onUpdate('accountingPeriod', normalizePickerValue(dateString))}
            />
          </DrawerFormField>
          <DrawerFormField label="确认日期" required>
            <DatePicker
              inputReadOnly
              style={{ width: '100%' }}
              value={form.confirmDate ? dayjs(form.confirmDate) : undefined}
              onChange={(_, dateString) => onUpdate('confirmDate', normalizePickerValue(dateString))}
            />
          </DrawerFormField>
          <DrawerFormField label="到期日" required>
            <DatePicker
              inputReadOnly
              style={{ width: '100%' }}
              value={form.dueDate ? dayjs(form.dueDate) : undefined}
              onChange={(_, dateString) => onUpdate('dueDate', normalizePickerValue(dateString))}
            />
          </DrawerFormField>
          <DrawerFormField label="责任人" required>
            <Input value={form.owner} onChange={(event) => onUpdate('owner', event.target.value)} />
          </DrawerFormField>
        </DrawerFormGrid>
      </DetailSection>

      <DetailSection icon={<FileProtectOutlined />} title="确认依据">
        <FileSlotGrid flush>
          <FileSlot
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,image/png,image/jpeg"
            description="账单、结算单或线下确认材料；收付款回单在流水环节处理。"
            files={form.files}
            multiple
            status={form.files.length > 0 ? '已选择' : '未上传'}
            statusTone={form.files.length > 0 ? 'green' : 'amber'}
            title="确认依据"
            uploadText="上传确认依据"
            variant="list"
            onRemove={(file) => onUpdate('files', form.files.filter((currentFile) => currentFile.id !== file.id))}
            onSelect={handleBasisFileSelect}
          />
        </FileSlotGrid>
      </DetailSection>

      <DetailSection icon={<WalletOutlined />} title="金额与说明">
        <DrawerFormGrid>
          <DrawerFormField label="确认金额" required>
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%' }}
              value={form.amount}
              onChange={(amount) => onUpdate('amount', Number(amount ?? 0))}
            />
          </DrawerFormField>
          <DrawerFormField label="备注" wide>
            <Input.TextArea
              autoSize={{ minRows: 3, maxRows: 5 }}
              value={form.note}
              onChange={(event) => onUpdate('note', event.target.value)}
            />
          </DrawerFormField>
        </DrawerFormGrid>
      </DetailSection>
    </DrawerFormShell>
  );
}
