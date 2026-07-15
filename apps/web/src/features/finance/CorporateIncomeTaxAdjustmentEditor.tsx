import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Input, InputNumber, Select } from 'antd';
import { DrawerFormField, DrawerFormGrid } from '../../components/DrawerForm';
import type { FinanceCorporateIncomeTaxAdjustment } from './financeDeclarationPreparationData';

const sourceModuleOptions = ['总账', '费用台账', '资产台账', '薪酬明细', '税务办理', '其他税务资料'].map((value) => ({
  label: value,
  value
}));

export function createCorporateIncomeTaxAdjustment(scope: 'quarter' | 'annual'): FinanceCorporateIncomeTaxAdjustment {
  return {
    accountingAmount: 0,
    adjustmentAmount: 0,
    deductibleAmount: 0,
    direction: '调增',
    id: `cit-${scope}-adjustment-${Date.now()}`,
    item: '',
    sourceModule: '总账',
    sourceNo: '',
    status: '待归集'
  };
}

export function isCorporateIncomeTaxAdjustmentComplete(row: FinanceCorporateIncomeTaxAdjustment) {
  return Boolean(
    row.item.trim() &&
      row.sourceModule.trim() &&
      row.sourceNo.trim() &&
      row.adjustmentAmount > 0 &&
      row.accountingAmount >= 0 &&
      row.deductibleAmount >= 0
  );
}

export function CorporateIncomeTaxAdjustmentEditor({
  adjustments,
  onChange,
  scope
}: {
  adjustments: FinanceCorporateIncomeTaxAdjustment[];
  onChange: (adjustments: FinanceCorporateIncomeTaxAdjustment[]) => void;
  scope: 'quarter' | 'annual';
}) {
  function updateAdjustment(id: string, patch: Partial<FinanceCorporateIncomeTaxAdjustment>) {
    onChange(adjustments.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  return (
    <>
      <div className="corporate-income-tax-adjustment-toolbar">
        <Button
          icon={<PlusOutlined />}
          onClick={() => onChange([...adjustments, createCorporateIncomeTaxAdjustment(scope)])}
        >
          新增调整事项
        </Button>
      </div>
      {adjustments.map((row, index) => (
        <div className="annual-tax-adjustment-form-row" key={row.id}>
          <div className="annual-tax-adjustment-form-row-header">
            <strong>{`调整事项 ${index + 1}`}</strong>
            <Button
              danger
              icon={<DeleteOutlined />}
              type="text"
              onClick={() => onChange(adjustments.filter((item) => item.id !== row.id))}
            >
              删除
            </Button>
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
    </>
  );
}
