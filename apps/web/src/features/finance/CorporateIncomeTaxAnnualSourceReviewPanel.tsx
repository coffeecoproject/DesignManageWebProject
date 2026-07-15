import { AuditOutlined, FileTextOutlined, PlusOutlined } from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { Button, Checkbox, Input, InputNumber } from 'antd';
import { useState } from 'react';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection } from '../../components/Detail';
import { DrawerFormField, DrawerFormGrid, DrawerFormShell } from '../../components/DrawerForm';
import { CompactCell } from '../../components/TableCell';
import {
  CorporateIncomeTaxAdjustmentEditor,
  isCorporateIncomeTaxAdjustmentComplete
} from './CorporateIncomeTaxAdjustmentEditor';
import {
  type FinanceCorporateIncomeTaxAdjustment,
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
  adjustments: FinanceCorporateIncomeTaxAdjustment[];
  adjustmentReviewCompleted: boolean;
  priorLossDeductionAmount: number;
  priorLossReviewCompleted: boolean;
  priorLossSourceNo: string;
};

function createForm(review?: FinanceCorporateIncomeTaxAnnualSourceReview): AnnualSourceReviewForm {
  return {
    adjustments: review?.adjustments.map((row) => ({ ...row })) ?? [],
    adjustmentReviewCompleted: review?.adjustmentReviewCompleted ?? false,
    priorLossDeductionAmount: review?.priorLossDeductionAmount ?? 0,
    priorLossReviewCompleted: review?.priorLossReviewCompleted ?? false,
    priorLossSourceNo: review?.priorLossSourceNo ?? ''
  };
}

function normalizeForm(form: AnnualSourceReviewForm) {
  return {
    adjustments: form.adjustments.map((row) => ({
      accountingAmount: row.accountingAmount,
      adjustmentAmount: row.adjustmentAmount,
      deductibleAmount: row.deductibleAmount,
      direction: row.direction,
      id: row.id,
      item: row.item,
      sourceModule: row.sourceModule,
      sourceNo: row.sourceNo
    })),
    adjustmentReviewCompleted: form.adjustmentReviewCompleted,
    priorLossDeductionAmount: form.priorLossDeductionAmount,
    priorLossReviewCompleted: form.priorLossReviewCompleted,
    priorLossSourceNo: form.priorLossSourceNo.trim()
  };
}

const columns: TableColumnsType<FinanceCorporateIncomeTaxAdjustment> = [
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
    form.adjustments.every(isCorporateIncomeTaxAdjustmentComplete) &&
    form.priorLossDeductionAmount <= maximumPriorLossDeduction &&
    (form.priorLossDeductionAmount === 0 || Boolean(form.priorLossSourceNo.trim()));
  const isDirty = JSON.stringify(normalizeForm(form)) !== JSON.stringify(normalizeForm(createForm(review)));

  function openReview() {
    setForm(createForm(review));
    setOpen(true);
  }

  function saveReview() {
    if (!canSave || !isDirty) {
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
          <CompactDetailTable<FinanceCorporateIncomeTaxAdjustment>
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
        primaryAction={{ disabled: !canSave || !isDirty, label: '保存核对结果', onClick: saveReview }}
        title={<DetailDrawerTitle title="核对年度税务资料" subtitle="企业所得税年度汇算" />}
        width={920}
        onClose={() => setOpen(false)}
      >
        <DetailSection icon={<FileTextOutlined />} title="纳税调整">
          <CorporateIncomeTaxAdjustmentEditor
            adjustments={form.adjustments}
            scope="annual"
            onChange={(adjustments) => setForm((current) => ({ ...current, adjustments }))}
          />
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
