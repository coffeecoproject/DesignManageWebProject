import { AuditOutlined, DeleteOutlined, FileTextOutlined, PlusOutlined } from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { Button, Checkbox, Input, InputNumber, Select } from 'antd';
import { useState } from 'react';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection } from '../../components/Detail';
import { DrawerFormField, DrawerFormGrid, DrawerFormShell } from '../../components/DrawerForm';
import { CompactCell } from '../../components/TableCell';
import {
  type FinanceCorporateIncomeTaxAnnualAdjustment,
  type FinanceCorporateIncomeTaxAnnualSourceReview
} from './financeDeclarationPreparationData';
import { formatMoney } from './financeUtils';

type AnnualSourceReviewPanelProps = {
  editable: boolean;
  profitBeforeTaxAmount: number;
  review?: FinanceCorporateIncomeTaxAnnualSourceReview;
  onSave: (review: FinanceCorporateIncomeTaxAnnualSourceReview) => void;
};

type AnnualSourceReviewForm = {
  adjustments: FinanceCorporateIncomeTaxAnnualAdjustment[];
  adjustmentReviewCompleted: boolean;
  priorLossDeductionAmount: number;
  priorLossReviewCompleted: boolean;
  priorLossSourceNo: string;
};

const sourceModuleOptions = ['总账', '费用台账', '资产台账', '薪酬明细', '税务办理', '其他税务资料'].map((value) => ({
  label: value,
  value
}));

function createForm(review?: FinanceCorporateIncomeTaxAnnualSourceReview): AnnualSourceReviewForm {
  return {
    adjustments: review?.adjustments.map((row) => ({ ...row })) ?? [],
    adjustmentReviewCompleted: review?.adjustmentReviewCompleted ?? false,
    priorLossDeductionAmount: review?.priorLossDeductionAmount ?? 0,
    priorLossReviewCompleted: review?.priorLossReviewCompleted ?? false,
    priorLossSourceNo: review?.priorLossSourceNo ?? ''
  };
}

function createAdjustment(): FinanceCorporateIncomeTaxAnnualAdjustment {
  return {
    accountingAmount: 0,
    adjustmentAmount: 0,
    deductibleAmount: 0,
    direction: '调增',
    id: `cit-annual-adjustment-${Date.now()}`,
    item: '',
    sourceModule: '总账',
    sourceNo: '',
    status: '待归集'
  };
}

function isAdjustmentComplete(row: FinanceCorporateIncomeTaxAnnualAdjustment) {
  return Boolean(
    row.item.trim() &&
      row.sourceModule.trim() &&
      row.sourceNo.trim() &&
      row.adjustmentAmount > 0 &&
      row.accountingAmount >= 0 &&
      row.deductibleAmount >= 0
  );
}

const columns: TableColumnsType<FinanceCorporateIncomeTaxAnnualAdjustment> = [
  {
    dataIndex: 'item',
    render: (_value: string, row) => <CompactCell primary={row.item} secondary={`${row.sourceModule} / ${row.sourceNo}`} />,
    title: '调整事项',
    width: 220
  },
  { dataIndex: 'accountingAmount', render: (value: number) => formatMoney(value), title: '账载金额', width: 120 },
  { dataIndex: 'deductibleAmount', render: (value: number) => formatMoney(value), title: '税收金额', width: 120 },
  { dataIndex: 'direction', title: '方向', width: 80 },
  { dataIndex: 'adjustmentAmount', render: (value: number) => formatMoney(value), title: '调整金额', width: 120 }
];

export function CorporateIncomeTaxAnnualSourceReviewPanel({ editable, profitBeforeTaxAmount, review, onSave }: AnnualSourceReviewPanelProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AnnualSourceReviewForm>(() => createForm(review));

  const netAdjustmentAmount = (review?.adjustments ?? []).reduce(
    (total, row) => total + (row.direction === '调增' ? row.adjustmentAmount : -row.adjustmentAmount),
    0
  );
  const formNetAdjustmentAmount = form.adjustments.reduce(
    (total, row) => total + (row.direction === '调增' ? row.adjustmentAmount : -row.adjustmentAmount),
    0
  );
  const maximumPriorLossDeduction = Math.max(0, profitBeforeTaxAmount + formNetAdjustmentAmount);
  const canSave = form.adjustmentReviewCompleted &&
    form.priorLossReviewCompleted &&
    form.adjustments.every(isAdjustmentComplete) &&
    form.priorLossDeductionAmount <= maximumPriorLossDeduction &&
    (form.priorLossDeductionAmount === 0 || Boolean(form.priorLossSourceNo.trim()));

  function openReview() {
    setForm(createForm(review));
    setOpen(true);
  }

  function updateAdjustment(id: string, patch: Partial<FinanceCorporateIncomeTaxAnnualAdjustment>) {
    setForm((current) => ({
      ...current,
      adjustments: current.adjustments.map((row) => (row.id === id ? { ...row, ...patch } : row))
    }));
  }

  function saveReview() {
    if (!canSave) {
      return;
    }

    onSave({
      adjustments: form.adjustments.map((row) => ({ ...row, status: '已归集' })),
      adjustmentReviewCompleted: true,
      priorLossDeductionAmount: form.priorLossDeductionAmount,
      priorLossReviewCompleted: true,
      priorLossSourceNo: form.priorLossSourceNo.trim() || undefined,
      reviewedAt: new Date().toISOString(),
      reviewedBy: '李明'
    });
    setOpen(false);
  }

  return (
    <>
      <DetailSection
        extra={editable ? <Button icon={<PlusOutlined />} onClick={openReview}>核对年度税务资料</Button> : null}
        icon={<AuditOutlined />}
        title="年度税务资料"
      >
        <DetailInfoGrid
          columns={4}
          items={[
            { label: '纳税调整核对', value: review?.adjustmentReviewCompleted ? '已完成' : '待完成' },
            { label: '调整事项', value: `${review?.adjustments.length ?? 0} 项` },
            { label: '净调整额', value: formatMoney(netAdjustmentAmount) },
            { label: '以前年度亏损', value: review?.priorLossReviewCompleted ? formatMoney(review.priorLossDeductionAmount) : '待核对' }
          ]}
        />
        {(review?.adjustments.length ?? 0) > 0 ? (
          <CompactDetailTable<FinanceCorporateIncomeTaxAnnualAdjustment>
            className="detail-section-table"
            columns={columns}
            dataSource={review?.adjustments ?? []}
            rowKey="id"
            scrollX={760}
          />
        ) : null}
      </DetailSection>

      <DrawerFormShell
        cancelAction={{ label: '取消', onClick: () => setOpen(false) }}
        open={open}
        primaryAction={{ disabled: !canSave, label: '保存核对结果', onClick: saveReview }}
        title={<DetailDrawerTitle title="核对年度税务资料" subtitle="企业所得税年度汇算" />}
        width={920}
        onClose={() => setOpen(false)}
      >
        <DetailSection
          extra={<Button icon={<PlusOutlined />} onClick={() => setForm((current) => ({ ...current, adjustments: [...current.adjustments, createAdjustment()] }))}>新增调整事项</Button>}
          icon={<FileTextOutlined />}
          title="纳税调整"
        >
          {form.adjustments.map((row, index) => (
            <div className="annual-tax-adjustment-form-row" key={row.id}>
              <div className="annual-tax-adjustment-form-row-header">
                <strong>{`调整事项 ${index + 1}`}</strong>
                <Button danger icon={<DeleteOutlined />} type="text" onClick={() => setForm((current) => ({ ...current, adjustments: current.adjustments.filter((item) => item.id !== row.id) }))}>删除</Button>
              </div>
              <DrawerFormGrid>
                <DrawerFormField label="事项名称" required wide>
                  <Input value={row.item} onChange={(event) => updateAdjustment(row.id, { item: event.target.value })} />
                </DrawerFormField>
                <DrawerFormField label="账载金额" required>
                  <InputNumber min={0} precision={2} value={row.accountingAmount} onChange={(value) => updateAdjustment(row.id, { accountingAmount: value ?? 0 })} />
                </DrawerFormField>
                <DrawerFormField label="税收金额" required>
                  <InputNumber min={0} precision={2} value={row.deductibleAmount} onChange={(value) => updateAdjustment(row.id, { deductibleAmount: value ?? 0 })} />
                </DrawerFormField>
                <DrawerFormField label="调整方向" required>
                  <Select options={['调增', '调减'].map((value) => ({ label: value, value }))} value={row.direction} onChange={(direction) => updateAdjustment(row.id, { direction })} />
                </DrawerFormField>
                <DrawerFormField label="调整金额" required>
                  <InputNumber min={0} precision={2} value={row.adjustmentAmount} onChange={(value) => updateAdjustment(row.id, { adjustmentAmount: value ?? 0 })} />
                </DrawerFormField>
                <DrawerFormField label="来源模块" required>
                  <Select options={sourceModuleOptions} value={row.sourceModule} onChange={(sourceModule) => updateAdjustment(row.id, { sourceModule })} />
                </DrawerFormField>
                <DrawerFormField label="来源单号" required>
                  <Input value={row.sourceNo} onChange={(event) => updateAdjustment(row.id, { sourceNo: event.target.value })} />
                </DrawerFormField>
              </DrawerFormGrid>
            </div>
          ))}
          <Checkbox checked={form.adjustmentReviewCompleted} onChange={(event) => setForm((current) => ({ ...current, adjustmentReviewCompleted: event.target.checked }))}>
            年度纳税调整已核对
          </Checkbox>
        </DetailSection>

        <DetailSection icon={<AuditOutlined />} title="以前年度亏损">
          <DrawerFormGrid>
            <DrawerFormField label="本年弥补金额" required>
              <InputNumber max={maximumPriorLossDeduction} min={0} precision={2} value={form.priorLossDeductionAmount} onChange={(value) => setForm((current) => ({ ...current, priorLossDeductionAmount: value ?? 0 }))} />
            </DrawerFormField>
            <DrawerFormField label="来源单号" required={form.priorLossDeductionAmount > 0}>
              <Input value={form.priorLossSourceNo} onChange={(event) => setForm((current) => ({ ...current, priorLossSourceNo: event.target.value }))} />
            </DrawerFormField>
          </DrawerFormGrid>
          <Checkbox checked={form.priorLossReviewCompleted} onChange={(event) => setForm((current) => ({ ...current, priorLossReviewCompleted: event.target.checked }))}>
            以前年度可弥补亏损已核对
          </Checkbox>
        </DetailSection>
      </DrawerFormShell>
    </>
  );
}
