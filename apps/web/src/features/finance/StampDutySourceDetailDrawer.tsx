import {
  DeleteOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  PlusOutlined,
  SaveOutlined
} from '@ant-design/icons';
import { Button, Input, InputNumber, Select, Space } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { DrawerFormField, DrawerFormGrid } from '../../components/DrawerForm';
import { RelatedFileTable } from '../../components/RelatedFileTable';
import { getActiveFinanceTaxPolicyProfile, type FinanceStampDutyTaxItem } from './financeTaxPolicyModel';
import {
  type FinanceStampDutySourceRecord,
  type FinanceStampDutySourceResolution,
  type FinanceStampDutyTaxItemAllocation,
  type FinanceStampDutyTaxTreatment
} from './financeStampDutyModel';
import { financeToday, formatMoney } from './financeUtils';

type StampDutyTaxItemAllocationDraft = Omit<FinanceStampDutyTaxItemAllocation, 'taxItem'> & {
  taxItem?: FinanceStampDutyTaxItem;
};

type StampDutyResolutionForm = {
  allocations: StampDutyTaxItemAllocationDraft[];
  reason: string;
  treatment: Exclude<FinanceStampDutyTaxTreatment, '待确认'>;
};

function createResolutionForm(
  record: FinanceStampDutySourceRecord,
  resolution?: FinanceStampDutySourceResolution
): StampDutyResolutionForm {
  if (resolution) {
    return {
      allocations: resolution.allocations,
      reason: resolution.reason,
      treatment: resolution.treatment
    };
  }

  return {
    allocations:
      record.taxItem === '待确认'
        ? [{ id: `allocation-${record.sourceId}-1`, taxableBasis: Math.abs(record.taxableBasis) }]
        : [{ id: `allocation-${record.sourceId}-1`, taxableBasis: Math.abs(record.taxableBasis), taxItem: record.taxItem }],
    reason: '',
    treatment: record.adjustmentType === '调减' ? '抵缴' : '应税'
  };
}

function getResolutionError(record: FinanceStampDutySourceRecord, form: StampDutyResolutionForm) {
  if (!form.reason.trim()) {
    return '请填写处理依据';
  }

  if (form.treatment === '非应税') {
    return undefined;
  }

  if (
    form.allocations.length === 0 ||
    form.allocations.some((allocation) => !allocation.taxItem || allocation.taxableBasis <= 0)
  ) {
    return '请完整填写税目和计税依据';
  }

  const allocatedBasis = Number(form.allocations.reduce((total, allocation) => total + allocation.taxableBasis, 0).toFixed(2));
  const sourceBasis = Number(Math.abs(record.taxableBasis).toFixed(2));

  if (allocatedBasis !== sourceBasis) {
    return `税目分配合计应为 ${formatMoney(sourceBasis)}`;
  }

  return undefined;
}

export function StampDutySourceDetailDrawer({
  editable,
  record,
  resolution,
  onClose,
  onDownloadFile,
  onPreviewFile,
  onSave
}: {
  editable: boolean;
  record?: FinanceStampDutySourceRecord;
  resolution?: FinanceStampDutySourceResolution;
  onClose: () => void;
  onDownloadFile: (fileName: string) => void;
  onPreviewFile: (fileName: string) => void;
  onSave: (resolution: FinanceStampDutySourceResolution) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<StampDutyResolutionForm>();

  useEffect(() => {
    if (!record) {
      setEditing(false);
      setForm(undefined);
      return;
    }

    setEditing(false);
    setForm(createResolutionForm(record, resolution));
  }, [record, resolution]);

  const taxItemOptions = useMemo(
    () =>
      getActiveFinanceTaxPolicyProfile(record?.signedAt?.slice(0, 7) ?? financeToday.slice(0, 7)).stampDuty.items
        .filter((item) => item.item !== '营业账簿')
        .map((item) => ({ label: item.item, value: item.item })),
    [record?.signedAt]
  );

  if (!record || !form) {
    return null;
  }

  const resolutionError = getResolutionError(record, form);
  const treatmentOptions = record.adjustmentType === '调减'
    ? [
        { label: '抵缴', value: '抵缴' },
        { label: '非应税', value: '非应税' }
      ]
    : [
        { label: '应税', value: '应税' },
        { label: '非应税', value: '非应税' }
      ];

  function updateAllocation(id: string, patch: Partial<StampDutyTaxItemAllocationDraft>) {
    setForm((current) => current
      ? {
          ...current,
          allocations: current.allocations.map((allocation) => allocation.id === id ? { ...allocation, ...patch } : allocation)
        }
      : current);
  }

  function saveResolution() {
    if (resolutionError || !record || !form) {
      return;
    }

    onSave({
      allocations: form.treatment === '非应税'
        ? []
        : form.allocations.map((allocation) => ({
            ...allocation,
            taxItem: allocation.taxItem!
          })),
      obligationPeriod: record.obligationPeriod,
      reason: form.reason.trim(),
      resolvedAt: financeToday,
      resolvedBy: '李明',
      sourceId: record.sourceId,
      sourceVersion: record.sourceVersion,
      treatment: form.treatment
    });
    setEditing(false);
  }

  return (
    <DetailDrawerShell
      bodyTestId="finance-stamp-duty-source-detail-drawer"
      cancelAction={editing ? { label: '取消', onClick: () => {
        setForm(createResolutionForm(record, resolution));
        setEditing(false);
      } } : undefined}
      closeAction={!editing ? { label: '关闭', onClick: onClose } : undefined}
      open={Boolean(record)}
      primaryAction={editing
        ? { disabled: Boolean(resolutionError), icon: <SaveOutlined />, label: '保存处理结果', onClick: saveResolution }
        : editable
          ? { icon: <FileSearchOutlined />, label: '处理税源', onClick: () => setEditing(true) }
          : undefined}
      title={
        <DetailDrawerTitle
          status={record.resolutionStatus}
          subtitle={`${record.sourceNo} / ${record.sourceType}`}
          title={record.documentName}
        />
      }
      width={860}
      onClose={onClose}
    >
      <DetailSummaryCards
        columns={4}
        items={[
          { icon: <FileProtectOutlined />, key: 'basis', label: '计税依据', value: formatMoney(record.taxableBasis) },
          { icon: <FileSearchOutlined />, key: 'taxItem', label: '税目', value: record.taxItem },
          { icon: <FileProtectOutlined />, key: 'tax', label: '预计税额', value: formatMoney(record.estimatedPayableAmount) },
          { icon: <FileSearchOutlined />, key: 'period', label: '归属期间', value: record.obligationPeriod }
        ]}
      />

      <DetailTabs
        items={[
          {
            key: 'source',
            label: '税源信息',
            children: (
              <>
                <DetailSection icon={<FileSearchOutlined />} title="凭证信息">
                  <DetailInfoGrid
                    columns={3}
                    items={[
                      { label: '来源类型', value: record.sourceType },
                      { label: '书立日期', value: record.signedAt ?? '-' },
                      { label: '实际结算日期', value: record.settlementDate ?? '-' },
                      { label: '对方主体', value: record.counterparty },
                      { label: '对方税号', value: record.counterpartyTaxId ?? '-' },
                      { label: '凭证金额', value: record.statedAmount ? formatMoney(record.statedAmount) : '-' },
                      { label: '单列增值税', value: record.statedVatAmount !== undefined ? formatMoney(record.statedVatAmount) : '-' },
                      { label: '价税口径', value: record.amountTaxMode },
                      { label: '调整类型', value: record.adjustmentType }
                    ]}
                  />
                </DetailSection>

                {editing ? (
                  <DetailSection icon={<FileSearchOutlined />} title="税务处理">
                    <DrawerFormGrid>
                      <DrawerFormField label="处理结论" required>
                        <Select
                          options={treatmentOptions}
                          value={form.treatment}
                          onChange={(treatment) => setForm({ ...form, treatment })}
                        />
                      </DrawerFormField>
                      <DrawerFormField label="处理依据" required wide>
                        <Input.TextArea
                          maxLength={200}
                          placeholder="填写合同内容、对方资格或调减依据"
                          rows={3}
                          value={form.reason}
                          onChange={(event) => setForm({ ...form, reason: event.target.value })}
                        />
                      </DrawerFormField>
                    </DrawerFormGrid>

                    {form.treatment !== '非应税' ? (
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        {form.allocations.map((allocation) => (
                          <Space key={allocation.id} align="end" size={12} style={{ width: '100%' }}>
                            <DrawerFormField label="法定税目" required>
                              <Select
                                options={taxItemOptions}
                                style={{ width: 240 }}
                                value={allocation.taxItem}
                                onChange={(taxItem: FinanceStampDutyTaxItem) => updateAllocation(allocation.id, { taxItem })}
                              />
                            </DrawerFormField>
                            <DrawerFormField label="计税依据" required>
                              <InputNumber
                                min={0.01}
                                precision={2}
                                style={{ width: 180 }}
                                value={allocation.taxableBasis}
                                onChange={(value) => updateAllocation(allocation.id, { taxableBasis: Number(value ?? 0) })}
                              />
                            </DrawerFormField>
                            <Button
                              aria-label="删除税目"
                              disabled={form.allocations.length === 1}
                              icon={<DeleteOutlined />}
                              title="删除税目"
                              onClick={() => setForm({ ...form, allocations: form.allocations.filter((item) => item.id !== allocation.id) })}
                            />
                          </Space>
                        ))}
                        <Button
                          icon={<PlusOutlined />}
                          onClick={() => setForm({
                            ...form,
                            allocations: [
                              ...form.allocations,
                              {
                                id: `allocation-${record.sourceId}-${form.allocations.length + 1}`,
                                taxableBasis: 0
                              }
                            ]
                          })}
                        >
                          增加税目
                        </Button>
                        {resolutionError ? <span className="form-error-text">{resolutionError}</span> : null}
                      </Space>
                    ) : null}
                  </DetailSection>
                ) : record.resolvedAt ? (
                  <DetailSection icon={<FileSearchOutlined />} title="处理结果">
                    <DetailInfoGrid
                      columns={3}
                      items={[
                        { label: '处理结论', value: record.taxTreatment },
                        { label: '处理人', value: record.resolvedBy ?? '-' },
                        { label: '处理日期', value: record.resolvedAt ?? '-' },
                        { label: '处理依据', value: record.resolutionNote ?? '-', wide: true }
                      ]}
                    />
                  </DetailSection>
                ) : null}
              </>
            )
          },
          {
            key: 'files',
            label: '凭证文件',
            children: (
              <DetailSection icon={<FileProtectOutlined />} title="凭证文件">
                <RelatedFileTable
                  records={record.evidenceFiles}
                  onDownload={(file) => onDownloadFile(file.name)}
                  onPreview={(file) => onPreviewFile(file.name)}
                />
              </DetailSection>
            )
          }
        ]}
        testId="finance-stamp-duty-source-detail-tabs"
      />
    </DetailDrawerShell>
  );
}
