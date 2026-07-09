import {
  CalculatorOutlined,
  CheckCircleOutlined,
  EditOutlined,
  WalletOutlined
} from '@ant-design/icons';
import { Alert, Input, InputNumber, Select } from 'antd';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import { MonthPickerControl } from '../../components/DateFilterFields';
import { DetailDrawerTitle, DetailSection, ReadOnlyField, StatusTag } from '../../components/Detail';
import { DrawerFormField, DrawerFormGrid, DrawerFormShell } from '../../components/DrawerForm';
import {
  buildSalaryAdjustmentRecord,
  getSalaryAdjustmentDirectionLabel,
  getSalaryAdjustmentMemberOptions,
  getSalaryAdjustmentSelectedReport,
  isSalaryAdjustmentFormValid,
  salaryDetailDefaultMonth,
  salaryAdjustmentDirectionTone,
  salaryAdjustmentTypeOptions,
  salaryMonthlyStatusTone,
  type SalaryAdjustmentFormValue
} from './salaryMonthlyDisplayModel';
import {
  formatSalaryMoney,
  type SalaryAdjustmentRecord,
  type SalaryMonthlyReport
} from './salaryDomain';
import { salaryToday } from './SalaryManagementState';

type SalaryAdjustmentCreateDrawerProps = {
  form: SalaryAdjustmentFormValue;
  getReportsForMonth: (month: string) => SalaryMonthlyReport[];
  open: boolean;
  periodReadbackNotice?: string;
  onCancel: () => void;
  onChange: <K extends keyof SalaryAdjustmentFormValue>(field: K, value: SalaryAdjustmentFormValue[K]) => void;
  onMonthChange: (month: string) => void;
  onSave: (record: SalaryAdjustmentRecord) => void;
};

export function SalaryAdjustmentCreateDrawer({
  form,
  getReportsForMonth,
  open,
  periodReadbackNotice,
  onCancel,
  onChange,
  onMonthChange,
  onSave
}: SalaryAdjustmentCreateDrawerProps) {
  const reports = useMemo(() => getReportsForMonth(form.month), [form.month, getReportsForMonth]);
  const selectedReport = getSalaryAdjustmentSelectedReport(reports, form);
  const adjustmentDirection = getSalaryAdjustmentDirectionLabel(form.type);
  const memberOptions = getSalaryAdjustmentMemberOptions(reports);
  const saveDisabled = Boolean(periodReadbackNotice) || !isSalaryAdjustmentFormValid(form, selectedReport);

  function handleMonthChange(month: string) {
    onMonthChange(month || salaryDetailDefaultMonth);
  }

  function handleSave() {
    if (!selectedReport || saveDisabled) {
      return;
    }

    onSave(buildSalaryAdjustmentRecord({
      actor: '李明',
      createdAt: `${salaryToday} 10:45`,
      form,
      selectedReport
    }));
  }

  return (
    <DrawerFormShell
      bodyTestId="salary-adjustment-create"
      cancelAction={{ label: '取消', onClick: onCancel }}
      layout="detail"
      open={open}
      primaryAction={{
        disabled: saveDisabled,
        icon: <CheckCircleOutlined />,
        label: '保存调整',
        testId: 'salary-adjustment-save',
        onClick: handleSave
      }}
      title={<DetailDrawerTitle subtitle="薪酬社保 / 薪酬明细" title="新增薪酬调整" />}
      width={680}
      onClose={onCancel}
    >
      {periodReadbackNotice ? (
        <Alert className="finance-period-readback-alert" message={periodReadbackNotice} showIcon type="info" />
      ) : null}
      <DetailSection icon={<CalculatorOutlined />} title="调整对象">
        <DrawerFormGrid>
          <DrawerFormField label="薪酬月份" required>
            <MonthPickerControl
              allowClear={false}
              placeholder="选择月份"
              value={form.month ? dayjs(form.month) : undefined}
              onChange={handleMonthChange}
            />
          </DrawerFormField>
          <DrawerFormField label="人员" required>
            <Select
              optionFilterProp="label"
              options={memberOptions}
              placeholder="选择人员"
              showSearch
              value={form.memberId}
              onChange={(memberId) => onChange('memberId', memberId)}
            />
          </DrawerFormField>
        </DrawerFormGrid>
      </DetailSection>

      {selectedReport ? (
        <DetailSection icon={<WalletOutlined />} title="当前薪酬明细">
          <DrawerFormGrid>
            <ReadOnlyField label="人员" value={`${selectedReport.member.name} / ${selectedReport.member.id}`} />
            <ReadOnlyField label="岗位" value={selectedReport.member.position} />
            <ReadOnlyField
              label="月度状态"
              value={<StatusTag toneMap={salaryMonthlyStatusTone} value={selectedReport.status} />}
            />
            <ReadOnlyField label="本月基础薪资" value={formatSalaryMoney(selectedReport.baseSalaryAmount)} />
            <ReadOnlyField label="绩效预发" value={formatSalaryMoney(selectedReport.performancePayAmount)} />
            <ReadOnlyField label="社保公积金" value={formatSalaryMoney(selectedReport.socialInsuranceDeductionAmount)} />
            <ReadOnlyField label="个税扣减" value={formatSalaryMoney(selectedReport.personalIncomeTaxAmount)} />
            <ReadOnlyField label="当前实发" value={formatSalaryMoney(selectedReport.netSalary)} />
          </DrawerFormGrid>
        </DetailSection>
      ) : null}

      <DetailSection icon={<EditOutlined />} title="调整信息">
        <DrawerFormGrid>
          <DrawerFormField label="调整类型" required>
            <Select
              value={form.type}
              options={salaryAdjustmentTypeOptions.map((option) => ({
                label: option,
                value: option
              }))}
              onChange={(type) => onChange('type', type)}
            />
          </DrawerFormField>
          <ReadOnlyField
            label="影响方向"
            value={<StatusTag toneMap={salaryAdjustmentDirectionTone} value={adjustmentDirection} />}
          />
          <DrawerFormField label="调整金额" required>
            <InputNumber
              min={0.01}
              precision={2}
              step={100}
              value={form.amount}
              onChange={(amount) => onChange('amount', amount)}
            />
          </DrawerFormField>
          <DrawerFormField label="调整原因" required wide>
            <Input.TextArea
              autoSize={{ minRows: 3, maxRows: 5 }}
              placeholder="请输入本月薪酬调整原因"
              value={form.reason}
              onChange={(event) => onChange('reason', event.target.value)}
            />
          </DrawerFormField>
        </DrawerFormGrid>
      </DetailSection>
    </DrawerFormShell>
  );
}
