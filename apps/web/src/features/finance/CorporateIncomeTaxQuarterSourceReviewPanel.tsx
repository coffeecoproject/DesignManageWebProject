import { AuditOutlined, FileTextOutlined } from '@ant-design/icons';
import { Button, Checkbox, Input, InputNumber } from 'antd';
import { useState } from 'react';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection } from '../../components/Detail';
import { DrawerFormField, DrawerFormGrid, DrawerFormShell } from '../../components/DrawerForm';
import {
  CorporateIncomeTaxAdjustmentEditor,
  isCorporateIncomeTaxAdjustmentComplete
} from './CorporateIncomeTaxAdjustmentEditor';
import type {
  FinanceCorporateIncomeTaxAdjustment,
  FinanceCorporateIncomeTaxQuarterSourceReview
} from './financeDeclarationPreparationData';
import { formatMoney } from './financeUtils';

type QuarterSourceReviewForm = {
  adjustments: FinanceCorporateIncomeTaxAdjustment[];
  adjustmentReviewCompleted: boolean;
  priorLossDeductionAmount: number;
  priorLossReviewCompleted: boolean;
  priorLossSourceNo: string;
  taxCreditAmount: number;
  taxCreditReviewCompleted: boolean;
  taxCreditSourceNo: string;
};

function createForm(review?: FinanceCorporateIncomeTaxQuarterSourceReview): QuarterSourceReviewForm {
  return {
    adjustments: review?.adjustments.map((row) => ({ ...row })) ?? [],
    adjustmentReviewCompleted: review?.adjustmentReviewCompleted ?? false,
    priorLossDeductionAmount: review?.priorLossDeductionAmount ?? 0,
    priorLossReviewCompleted: review?.priorLossReviewCompleted ?? false,
    priorLossSourceNo: review?.priorLossSourceNo ?? '',
    taxCreditAmount: review?.taxCreditAmount ?? 0,
    taxCreditReviewCompleted: review?.taxCreditReviewCompleted ?? false,
    taxCreditSourceNo: review?.taxCreditSourceNo ?? ''
  };
}

function normalizeForm(form: QuarterSourceReviewForm) {
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
    priorLossSourceNo: form.priorLossSourceNo.trim(),
    taxCreditAmount: form.taxCreditAmount,
    taxCreditReviewCompleted: form.taxCreditReviewCompleted,
    taxCreditSourceNo: form.taxCreditSourceNo.trim()
  };
}

export function CorporateIncomeTaxQuarterSourceReviewPanel({
  editable,
  period,
  profitBeforeTaxAmount,
  review,
  onSave
}: {
  editable: boolean;
  period: string;
  profitBeforeTaxAmount: number;
  review?: FinanceCorporateIncomeTaxQuarterSourceReview;
  onSave: (review: FinanceCorporateIncomeTaxQuarterSourceReview) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<QuarterSourceReviewForm>(() => createForm(review));
  const netAdjustmentAmount = form.adjustments.reduce(
    (total, row) => total + (row.direction === '调增' ? row.adjustmentAmount : -row.adjustmentAmount),
    0
  );
  const maximumPriorLossDeduction = Math.max(0, profitBeforeTaxAmount + netAdjustmentAmount);
  const canSave =
    form.adjustmentReviewCompleted &&
    form.priorLossReviewCompleted &&
    form.taxCreditReviewCompleted &&
    form.adjustments.every(isCorporateIncomeTaxAdjustmentComplete) &&
    form.priorLossDeductionAmount <= maximumPriorLossDeduction &&
    (form.priorLossDeductionAmount === 0 || Boolean(form.priorLossSourceNo.trim())) &&
    (form.taxCreditAmount === 0 || Boolean(form.taxCreditSourceNo.trim()));
  const isDirty = JSON.stringify(normalizeForm(form)) !== JSON.stringify(normalizeForm(createForm(review)));
  const savedNetAdjustmentAmount = (review?.adjustments ?? []).reduce(
    (total, row) => total + (row.direction === '调增' ? row.adjustmentAmount : -row.adjustmentAmount),
    0
  );

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
      reviewedBy: '李明',
      taxCreditAmount: form.taxCreditAmount,
      taxCreditReviewCompleted: true,
      taxCreditSourceNo: form.taxCreditSourceNo.trim() || undefined
    });
    setOpen(false);
  }

  return (
    <>
      <DetailSection
        extra={editable ? <Button icon={<AuditOutlined />} onClick={openReview}>核对季度税务资料</Button> : null}
        icon={<AuditOutlined />}
        title="季度税务资料"
      >
        <DetailInfoGrid
          columns={4}
          items={[
            { label: '纳税调整', value: review?.adjustmentReviewCompleted ? formatMoney(savedNetAdjustmentAmount) : '待核对' },
            { label: '调整事项', value: `${review?.adjustments.length ?? 0} 项` },
            { label: '弥补亏损', value: review?.priorLossReviewCompleted ? formatMoney(review.priorLossDeductionAmount) : '待核对' },
            { label: '所得税抵免', value: review?.taxCreditReviewCompleted ? formatMoney(review.taxCreditAmount) : '待核对' }
          ]}
        />
      </DetailSection>

      <DrawerFormShell
        cancelAction={{ label: '取消', onClick: () => setOpen(false) }}
        open={open}
        primaryAction={{ disabled: !canSave || !isDirty, label: '保存核对结果', onClick: saveReview }}
        title={<DetailDrawerTitle title="核对季度税务资料" subtitle={`${period} 企业所得税预缴`} />}
        width={920}
        onClose={() => setOpen(false)}
      >
        <DetailSection icon={<FileTextOutlined />} title="纳税调整">
          <CorporateIncomeTaxAdjustmentEditor
            adjustments={form.adjustments}
            scope="quarter"
            onChange={(adjustments) => setForm((current) => ({ ...current, adjustments }))}
          />
          <Checkbox checked={form.adjustmentReviewCompleted} onChange={(event) => setForm((current) => ({ ...current, adjustmentReviewCompleted: event.target.checked }))}>
            本年累计纳税调整已核对
          </Checkbox>
        </DetailSection>

        <DetailSection icon={<AuditOutlined />} title="亏损与抵免">
          <DrawerFormGrid>
            <DrawerFormField label="弥补以前年度亏损" required>
              <InputNumber max={maximumPriorLossDeduction} min={0} precision={2} value={form.priorLossDeductionAmount} onChange={(value) => setForm((current) => ({ ...current, priorLossDeductionAmount: value ?? 0 }))} />
            </DrawerFormField>
            <DrawerFormField label="亏损台账单号" required={form.priorLossDeductionAmount > 0}>
              <Input value={form.priorLossSourceNo} onChange={(event) => setForm((current) => ({ ...current, priorLossSourceNo: event.target.value }))} />
            </DrawerFormField>
            <DrawerFormField label="抵免所得税额" required>
              <InputNumber min={0} precision={2} value={form.taxCreditAmount} onChange={(value) => setForm((current) => ({ ...current, taxCreditAmount: value ?? 0 }))} />
            </DrawerFormField>
            <DrawerFormField label="抵免资料单号" required={form.taxCreditAmount > 0}>
              <Input value={form.taxCreditSourceNo} onChange={(event) => setForm((current) => ({ ...current, taxCreditSourceNo: event.target.value }))} />
            </DrawerFormField>
          </DrawerFormGrid>
          <div className="corporate-income-tax-review-checks">
            <Checkbox checked={form.priorLossReviewCompleted} onChange={(event) => setForm((current) => ({ ...current, priorLossReviewCompleted: event.target.checked }))}>
              以前年度可弥补亏损已核对
            </Checkbox>
            <Checkbox checked={form.taxCreditReviewCompleted} onChange={(event) => setForm((current) => ({ ...current, taxCreditReviewCompleted: event.target.checked }))}>
              本年累计抵免所得税额已核对
            </Checkbox>
          </div>
        </DetailSection>
      </DrawerFormShell>
    </>
  );
}
