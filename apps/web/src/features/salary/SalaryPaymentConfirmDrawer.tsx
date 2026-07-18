import { BankOutlined, CalculatorOutlined, CheckCircleOutlined, WalletOutlined } from '@ant-design/icons';
import { DatePicker, Select } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { DetailDrawerTitle, DetailSection, ReadOnlyField } from '../../components/Detail';
import { DrawerFormField, DrawerFormGrid, DrawerFormShell } from '../../components/DrawerForm';
import {
  formatSalaryMoney,
  getSalaryScheduledPaymentDate,
  type SalaryMonthlyReport,
  type SalaryPaymentEvidenceInput
} from './salaryDomain';

type SalaryPaymentConfirmDrawerProps = {
  open: boolean;
  paymentCandidates: SalaryPaymentEvidenceInput[];
  report?: SalaryMonthlyReport;
  onCancel: () => void;
  onConfirm: (report: SalaryMonthlyReport, evidence: SalaryPaymentEvidenceInput) => void;
  onRecalculate: (report: SalaryMonthlyReport, paymentDate: string) => void;
};

export function SalaryPaymentConfirmDrawer({
  open,
  paymentCandidates,
  report,
  onCancel,
  onConfirm,
  onRecalculate
}: SalaryPaymentConfirmDrawerProps) {
  const [selectedTransactionNo, setSelectedTransactionNo] = useState('');
  const [selectedPaymentDate, setSelectedPaymentDate] = useState('');

  useEffect(() => {
    if (open) {
      const singleCandidate = paymentCandidates.length === 1 ? paymentCandidates[0] : undefined;
      setSelectedTransactionNo(singleCandidate?.financeTransactionNo ?? '');
      setSelectedPaymentDate(
        singleCandidate?.occurredAt ?? getSalaryScheduledPaymentDate(report?.month ?? '')
      );
    }
  }, [open, paymentCandidates, report?.id]);

  if (!report) {
    return null;
  }

  const scheduledPaymentDate = getSalaryScheduledPaymentDate(report.month);
  const settlement = report.settlementSnapshot;
  const selectedEvidence = paymentCandidates.find(
    (candidate) => candidate.financeTransactionNo === selectedTransactionNo
  );
  const currentPersonalIncomeTaxPeriod = report.workflow?.personalIncomeTaxPeriod
    ?? report.personalIncomeTaxRecords[0]?.payrollMonth
    ?? scheduledPaymentDate.slice(0, 7);
  const selectedPaymentPeriod = selectedPaymentDate.slice(0, 7);
  const requiresRecalculation = Boolean(
    selectedPaymentPeriod && currentPersonalIncomeTaxPeriod !== selectedPaymentPeriod
  );
  const paymentDateMatches = selectedEvidence?.occurredAt === selectedPaymentDate;
  const paymentAmountMatches = Boolean(
    selectedEvidence &&
      Math.abs(selectedEvidence.amount - settlement.employeeNetPayableAmount) <= 0.01
  );
  const reconciliationResult = requiresRecalculation
    ? `需按 ${selectedPaymentPeriod} 重新核定`
    : !selectedEvidence
      ? '待选择付款流水'
      : !paymentDateMatches
        ? '付款日期与核定日期不一致'
        : !paymentAmountMatches
          ? '付款金额与核定实发不一致'
          : '可确认';

  return (
    <DrawerFormShell
      bodyTestId="salary-payment-confirm"
      cancelAction={{ label: '取消', onClick: onCancel }}
      layout="detail"
      open={open}
      primaryAction={{
        disabled: requiresRecalculation
          ? !selectedPaymentDate
          : !selectedEvidence || !paymentDateMatches || !paymentAmountMatches,
        icon: requiresRecalculation ? <CalculatorOutlined /> : <CheckCircleOutlined />,
        label: requiresRecalculation ? '重新核定' : '确认关联',
        testId: requiresRecalculation
          ? 'salary-payment-recalculate-submit'
          : 'salary-payment-confirm-submit',
        onClick: () => {
          if (requiresRecalculation) {
            onRecalculate(report, selectedPaymentDate);
            return;
          }
          if (selectedEvidence) {
            onConfirm(report, selectedEvidence);
          }
        }
      }}
      title={<DetailDrawerTitle subtitle="薪酬社保 / 薪酬明细" title="关联工资发放流水" />}
      width={680}
      onClose={onCancel}
    >
      <DetailSection icon={<WalletOutlined />} title="发放信息">
        <DrawerFormGrid>
          <ReadOnlyField label="人员" value={`${report.member.name} / ${report.member.id}`} />
          <ReadOnlyField label="薪酬月份" value={report.month} />
          <ReadOnlyField label="工资单编号" value={report.workflow?.payrollNo ?? '-'} />
          <ReadOnlyField label="计划发薪日" value={scheduledPaymentDate || '-'} />
          <ReadOnlyField label="当前个税月份" value={currentPersonalIncomeTaxPeriod || '-'} />
          <ReadOnlyField label="应发工资" value={formatSalaryMoney(settlement.grossEarningsAmount)} />
          <ReadOnlyField label="业务扣减" value={formatSalaryMoney(settlement.businessDeductionAmount)} />
          <ReadOnlyField label="计税工资" value={formatSalaryMoney(settlement.taxableIncomeAmount)} />
          <ReadOnlyField label="个人社保" value={formatSalaryMoney(settlement.employeeSocialInsuranceAmount)} />
          <ReadOnlyField label="个人公积金" value={formatSalaryMoney(settlement.employeeHousingFundAmount)} />
          <ReadOnlyField label="代扣个税" value={formatSalaryMoney(settlement.withheldPersonalIncomeTaxAmount)} />
          <ReadOnlyField label="员工实发" value={formatSalaryMoney(settlement.employeeNetPayableAmount)} />
          <ReadOnlyField label="单位承担" value={formatSalaryMoney(settlement.employerContributionAmount)} />
        </DrawerFormGrid>
      </DetailSection>
      <DetailSection icon={<BankOutlined />} title="付款流水">
        <DrawerFormGrid>
          <DrawerFormField label="实际发放日期" required>
            <DatePicker
              value={selectedPaymentDate ? dayjs(selectedPaymentDate) : undefined}
              onChange={(value) => setSelectedPaymentDate(value?.format('YYYY-MM-DD') ?? '')}
            />
          </DrawerFormField>
          <DrawerFormField label="已入账流水" required>
            <Select
              options={paymentCandidates.map((candidate) => ({
                label: `${candidate.financeTransactionNo} / ${candidate.occurredAt} / ${formatSalaryMoney(candidate.amount)}`,
                value: candidate.financeTransactionNo
              }))}
              placeholder={paymentCandidates.length > 0 ? '选择对应的工资付款流水' : '暂无匹配的已入账工资流水'}
              value={selectedTransactionNo || undefined}
              onChange={(transactionNo) => {
                const evidence = paymentCandidates.find(
                  (candidate) => candidate.financeTransactionNo === transactionNo
                );
                setSelectedTransactionNo(transactionNo);
                if (evidence) {
                  setSelectedPaymentDate(evidence.occurredAt);
                }
              }}
            />
          </DrawerFormField>
          <ReadOnlyField label="付款日期" value={selectedEvidence?.occurredAt ?? '-'} />
          <ReadOnlyField label="付款账户" value={selectedEvidence?.accountName ?? '-'} />
          <ReadOnlyField label="付款金额" value={selectedEvidence ? formatSalaryMoney(selectedEvidence.amount) : '-'} />
          <ReadOnlyField label="个税扣缴月份" value={selectedEvidence?.occurredAt.slice(0, 7) ?? '-'} />
          <ReadOnlyField label="核对结果" value={reconciliationResult} />
        </DrawerFormGrid>
      </DetailSection>
    </DrawerFormShell>
  );
}
