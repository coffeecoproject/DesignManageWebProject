import {
  CalculatorOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  WalletOutlined
} from '@ant-design/icons';
import { Alert } from 'antd';
import type { TableColumnsType } from 'antd';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import { CellText, CompactCell } from '../../components/TableCell';
import {
  formatDays,
  formatHours,
  formatPayslipAmount,
  formatSignedMoney,
  getSalaryAdjustmentDirectionLabel,
  getSalaryPayslipGeneratedAt,
  getSalaryPayslipLines,
  getSalaryPayslipNo,
  getSalaryPayslipStatus,
  getStatutoryDeductionRows,
  salaryAdjustmentDirectionTone,
  salaryCompositionDirectionTone,
  salaryMonthlyStatusTone,
  salaryPayslipStatusTone,
  salarySettlementSourceStatusTone,
  type SalaryPayslipLine,
  type StatutoryDeductionDisplayRow
} from './salaryMonthlyDisplayModel';
import {
  formatSalaryMoney,
  getSalaryAdjustmentSignedAmount,
  salaryStandardPayrollDays,
  salaryStandardPayrollHours,
  type SalaryAdjustmentRecord,
  type SalaryCompositionLine,
  type SalaryMonthlyReport,
  type SalarySettlementSourceRecord
} from './salaryDomain';

type SalaryPerformanceRecord = SalaryMonthlyReport['performanceRecords'][number];

type SalaryMonthlyDetailDrawerProps = {
  open: boolean;
  report?: SalaryMonthlyReport;
  periodReadbackNotice?: string;
  onClose: () => void;
  onConfirm: (report: SalaryMonthlyReport) => void;
  onOpenPayment: (report: SalaryMonthlyReport) => void;
};

export function SalaryMonthlyDetailDrawer({
  open,
  report,
  periodReadbackNotice,
  onClose,
  onConfirm,
  onOpenPayment
}: SalaryMonthlyDetailDrawerProps) {
  if (!report) {
    return null;
  }

  const adjustmentColumns: TableColumnsType<SalaryAdjustmentRecord> = [
    {
      title: '调整类型',
      key: 'type',
      width: 150,
      render: (_, record) => <CompactCell primary={record.type} secondary={record.status} />
    },
    {
      title: '方向',
      key: 'direction',
      width: 92,
      render: (_, record) => (
        <StatusTag toneMap={salaryAdjustmentDirectionTone} value={getSalaryAdjustmentDirectionLabel(record.type)} />
      )
    },
    {
      title: '金额',
      key: 'amount',
      width: 130,
      render: (_, record) => <CellText>{formatSignedMoney(getSalaryAdjustmentSignedAmount(record))}</CellText>
    },
    {
      title: '原因',
      dataIndex: 'reason',
      width: 260
    },
    {
      title: '记录信息',
      key: 'record',
      width: 160,
      render: (_, record) => <CompactCell primary={record.createdBy} secondary={record.updatedAt} />
    }
  ];
  const settlementSourceColumns: TableColumnsType<SalarySettlementSourceRecord> = [
    {
      title: '确认项',
      dataIndex: 'label',
      width: 120
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (status: SalarySettlementSourceRecord['status']) => (
        <StatusTag toneMap={salarySettlementSourceStatusTone} value={status} />
      )
    },
    {
      title: '归属月份',
      dataIndex: 'sourceMonth',
      width: 118
    },
    {
      title: '本月计入',
      dataIndex: 'amount',
      width: 130,
      render: (amount: number) => <CellText>{formatSalaryMoney(amount)}</CellText>
    },
    {
      title: '说明',
      dataIndex: 'note',
      width: 260
    }
  ];
  const salaryCompositionColumns: TableColumnsType<SalaryCompositionLine> = [
    {
      title: '项目',
      dataIndex: 'item',
      width: 150
    },
    {
      title: '来源',
      dataIndex: 'source',
      width: 130
    },
    {
      title: '方向',
      dataIndex: 'direction',
      width: 92,
      render: (direction: SalaryCompositionLine['direction']) => (
        <StatusTag toneMap={salaryCompositionDirectionTone} value={direction} />
      )
    },
    {
      title: '本月计入',
      dataIndex: 'amount',
      width: 140,
      render: (amount: number) => <CellText>{formatSalaryMoney(amount)}</CellText>
    },
    {
      title: '说明',
      dataIndex: 'note',
      width: 260
    }
  ];
  const performanceColumns: TableColumnsType<SalaryPerformanceRecord> = [
    {
      title: '绩效类别',
      key: 'category',
      width: 150,
      render: (_, record) => <CompactCell primary={record.category} secondary={record.sourceLabel} />
    },
    {
      title: '绩效总额',
      dataIndex: 'monthlyAmount',
      width: 130,
      render: (amount: number) => <CellText>{formatSalaryMoney(amount)}</CellText>
    },
    {
      title: '本月预发',
      dataIndex: 'prepayAmount',
      width: 130,
      render: (amount: number) => <CellText>{formatSalaryMoney(amount)}</CellText>
    },
    {
      title: '说明',
      dataIndex: 'note',
      width: 260
    }
  ];
  const statutoryDeductionColumns: TableColumnsType<StatutoryDeductionDisplayRow> = [
    {
      title: '类别',
      dataIndex: 'category',
      width: 110
    },
    {
      title: '归属月份',
      dataIndex: 'sourceMonth',
      width: 118
    },
    {
      title: '扣减月份',
      dataIndex: 'payrollMonth',
      width: 118
    },
    {
      title: '缴费/计税基数',
      dataIndex: 'baseAmount',
      width: 150,
      render: (amount: number) => <CellText>{formatSalaryMoney(amount)}</CellText>
    },
    {
      title: '个人扣减',
      dataIndex: 'personalAmount',
      width: 130,
      render: (amount: number) => <CellText>{formatSalaryMoney(amount)}</CellText>
    },
    {
      title: '说明',
      dataIndex: 'note',
      width: 220,
      render: (note: string | undefined) => <CellText emptyText="-">{note}</CellText>
    }
  ];
  const payslipColumns: TableColumnsType<SalaryPayslipLine> = [
    {
      title: '项目',
      dataIndex: 'item',
      width: 150
    },
    {
      title: '应发',
      dataIndex: 'incomeAmount',
      width: 130,
      render: (amount: number | undefined) => <CellText>{formatPayslipAmount(amount)}</CellText>
    },
    {
      title: '扣减',
      dataIndex: 'deductionAmount',
      width: 130,
      render: (amount: number | undefined) => <CellText>{formatPayslipAmount(amount)}</CellText>
    },
    {
      title: '说明',
      dataIndex: 'note',
      width: 260
    }
  ];
  const statutoryDeductionRows = getStatutoryDeductionRows(report);
  const personalIncomeTaxRecord = report.personalIncomeTaxRecords[0];
  const payslipStatus = getSalaryPayslipStatus(report);
  const payslipLines = getSalaryPayslipLines(report);
  const primaryAction =
    report.canConfirm
      ? {
          disabled: Boolean(periodReadbackNotice),
          icon: <CheckCircleOutlined />,
          label: '确认薪酬',
          onClick: () => onConfirm(report)
        }
      : report.canPay
        ? {
            disabled: Boolean(periodReadbackNotice),
            icon: <WalletOutlined />,
            label: '确认已发放',
            onClick: () => onOpenPayment(report)
          }
        : undefined;

  return (
    <DetailDrawerShell
      bodyTestId="salary-monthly-detail"
      closeAction={{ label: '关闭', onClick: onClose }}
      open={open}
      primaryAction={primaryAction}
      title={
        <DetailDrawerTitle
          status={report.status}
          statusToneMap={salaryMonthlyStatusTone}
          subtitle="薪酬社保 / 薪酬明细"
          title={`${report.member.name} ${report.month} 薪酬明细`}
        />
      }
      width={980}
      onClose={onClose}
    >
      {periodReadbackNotice ? (
        <Alert className="finance-period-readback-alert" message={periodReadbackNotice} showIcon type="info" />
      ) : null}
      <DetailSummaryCards
        columns={4}
        items={[
          { icon: <WalletOutlined />, key: 'gross', label: '应发工资', value: formatSalaryMoney(report.grossSalary) },
          { icon: <CalendarOutlined />, key: 'deduction', label: '扣减合计', value: formatSalaryMoney(report.deductionAmount) },
          { icon: <CheckCircleOutlined />, key: 'net', label: '实发工资', value: formatSalaryMoney(report.netSalary) },
          { icon: <FileSearchOutlined />, key: 'tax', label: '个税扣减', value: formatSalaryMoney(report.personalIncomeTaxAmount) }
        ]}
      />
      <DetailTabs
        items={[
          {
            key: 'composition',
            label: '薪酬明细',
            children: (
              <>
                <DetailSection icon={<FileTextOutlined />} title="工资单信息">
                  <DetailInfoGrid
                    columns={3}
                    items={[
                      { label: '工资单状态', value: <StatusTag toneMap={salaryPayslipStatusTone} value={payslipStatus} /> },
                      { label: '工资单编号', value: getSalaryPayslipNo(report) },
                      { label: '薪酬月份', value: report.month },
                      { label: '人员', value: `${report.member.name} / ${report.member.id}` },
                      { label: '岗位', value: report.member.position },
                      { label: '计薪方式', value: report.salaryMode },
                      { label: '确认时间', value: report.workflow?.confirmedAt ?? '-' },
                      { label: '发放时间', value: report.workflow?.paidAt ?? '-' },
                      { label: '生成时间', value: getSalaryPayslipGeneratedAt(report) },
                      {
                        label: '缺少确认项',
                        value: report.settlementPendingSourceLabels.length > 0 ? report.settlementPendingSourceLabels.join('、') : '-',
                        wide: true
                      }
                    ]}
                  />
                </DetailSection>
                <DetailSection icon={<CalculatorOutlined />} title="薪酬构成">
                  <CompactDetailTable<SalaryCompositionLine>
                    columns={salaryCompositionColumns}
                    dataSource={report.salaryCompositionLines}
                    rowKey="id"
                    scrollX={820}
                  />
                </DetailSection>
                {payslipStatus === '暂未生成' ? null : (
                  <DetailSection icon={<WalletOutlined />} title="工资单明细">
                    <CompactDetailTable<SalaryPayslipLine>
                      columns={payslipColumns}
                      dataSource={payslipLines}
                      rowKey="id"
                      scrollX={720}
                    />
                  </DetailSection>
                )}
              </>
            )
          },
          {
            key: 'basis',
            label: '计薪依据',
            children: (
              <>
                <DetailSection icon={<FileTextOutlined />} title="结算准备">
                  <CompactDetailTable<SalarySettlementSourceRecord>
                    columns={settlementSourceColumns}
                    dataSource={report.settlementSourceRecords}
                    rowKey="id"
                    scrollX={740}
                  />
                </DetailSection>
                <DetailSection icon={<FileTextOutlined />} title="计薪依据">
                  <DetailInfoGrid
                    columns={3}
                    items={[
                      { label: '月份', value: report.month },
                      { label: '人员', value: `${report.member.name} / ${report.member.id}` },
                      { label: '岗位', value: report.member.position },
                      { label: '计薪方式', value: report.salaryMode },
                      { label: '基础薪资', value: report.baseSalaryText },
                      { label: '本月基础薪资', value: formatSalaryMoney(report.baseSalaryAmount) },
                      { label: '计薪基准', value: `${salaryStandardPayrollDays} 天 / ${salaryStandardPayrollHours} 小时` },
                      { label: '计薪小时均价', value: formatSalaryMoney(report.baseSalaryPayableHours > 0 ? report.baseSalaryAmount / report.baseSalaryPayableHours : 0) },
                      { label: '状态', value: <StatusTag toneMap={salaryMonthlyStatusTone} value={report.status} /> },
                      { label: '绩效预发', value: formatSalaryMoney(report.performancePrepayAmount) },
                      { label: '季度绩效差额', value: formatSignedMoney(report.performanceQuarterlyAdjustmentAmount) },
                      { label: '适用工作日历', value: report.attendanceReport.workCalendarName },
                      { label: '应出勤', value: formatDays(report.expectedWorkdays) },
                      { label: '计薪出勤', value: `${formatHours(report.payableAttendanceHours)} / ${formatDays(report.payableAttendanceDays)}` },
                      { label: '考勤扣减', value: `${formatHours(report.attendanceReport.payrollDeductionHours)} / ${formatSalaryMoney(report.attendanceDeductionAmount)}` },
                      { label: '人工考勤调整', value: `${formatHours(report.attendanceReport.adjustmentHours)} / ${formatSignedMoney(report.attendanceAdjustmentAmount)}` },
                      { label: '个人社保', value: formatSalaryMoney(report.settlementSnapshot.employeeSocialInsuranceAmount) },
                      { label: '个人公积金', value: formatSalaryMoney(report.settlementSnapshot.employeeHousingFundAmount) },
                      { label: '单位社保', value: formatSalaryMoney(report.settlementSnapshot.employerSocialInsuranceAmount) },
                      { label: '单位公积金', value: formatSalaryMoney(report.settlementSnapshot.employerHousingFundAmount) },
                      { label: '计税工资', value: formatSalaryMoney(report.taxableSalaryIncomeAmount) },
                      { label: '个税扣减', value: formatSalaryMoney(report.personalIncomeTaxAmount) },
                      { label: '员工实发', value: formatSalaryMoney(report.settlementSnapshot.employeeNetPayableAmount) },
                      { label: '单位承担', value: formatSalaryMoney(report.settlementSnapshot.employerContributionAmount) },
                      { label: '用工成本', value: formatSalaryMoney(report.settlementSnapshot.totalEmploymentCostAmount) },
                      { label: '薪酬调整', value: formatSignedMoney(report.salaryAdjustmentAmount) },
                      { label: '薪酬单号', value: report.workflow?.payrollNo ?? '-' }
                    ]}
                  />
                </DetailSection>
                <DetailSection icon={<CalculatorOutlined />} title="个税计算">
                  <DetailInfoGrid
                    columns={3}
                    items={
                      personalIncomeTaxRecord
                        ? [
                            { label: '本月计税工资', value: formatSalaryMoney(personalIncomeTaxRecord.currentIncomeAmount) },
                            { label: '本月基本减除', value: formatSalaryMoney(personalIncomeTaxRecord.basicDeductionAmount) },
                            { label: '本月社保公积金', value: formatSalaryMoney(personalIncomeTaxRecord.currentSpecialDeductionAmount) },
                            { label: '本月专项附加扣除', value: formatSalaryMoney(personalIncomeTaxRecord.currentAdditionalDeductionAmount) },
                            { label: '本月其他扣除', value: formatSalaryMoney(personalIncomeTaxRecord.currentOtherDeductionAmount) },
                            { label: '本年累计收入', value: formatSalaryMoney(personalIncomeTaxRecord.cumulativeIncomeAmount) },
                            { label: '累计基本减除', value: formatSalaryMoney(personalIncomeTaxRecord.cumulativeBasicDeductionAmount) },
                            { label: '累计专项扣除', value: formatSalaryMoney(personalIncomeTaxRecord.cumulativeSpecialDeductionAmount) },
                            { label: '累计专项附加扣除', value: formatSalaryMoney(personalIncomeTaxRecord.cumulativeAdditionalDeductionAmount) },
                            { label: '累计其他扣除', value: formatSalaryMoney(personalIncomeTaxRecord.cumulativeOtherDeductionAmount) },
                            { label: '累计应纳税所得额', value: formatSalaryMoney(personalIncomeTaxRecord.cumulativeTaxableIncomeAmount) },
                            { label: '税率 / 速算扣除', value: `${(personalIncomeTaxRecord.taxRate * 100).toFixed(0)}% / ${formatSalaryMoney(personalIncomeTaxRecord.quickDeductionAmount)}` },
                            { label: '累计应扣税额', value: formatSalaryMoney(personalIncomeTaxRecord.cumulativeTaxAmount) },
                            { label: '前期已扣', value: formatSalaryMoney(personalIncomeTaxRecord.priorWithheldTaxAmount) },
                            { label: '本月应扣', value: formatSalaryMoney(personalIncomeTaxRecord.amount) }
                          ]
                        : [{ label: '个税计算', value: '待人员报送和扣除信息获取' }]
                    }
                  />
                </DetailSection>
                <DetailSection icon={<FileSearchOutlined />} title="绩效来源">
                  <CompactDetailTable<SalaryPerformanceRecord>
                    columns={performanceColumns}
                    dataSource={report.performanceRecords}
                    emptyText="暂无进入本月薪酬的绩效结果"
                    rowKey="id"
                    scrollX={720}
                  />
                </DetailSection>
                <DetailSection icon={<WalletOutlined />} title="扣减来源">
                  <CompactDetailTable<StatutoryDeductionDisplayRow>
                    columns={statutoryDeductionColumns}
                    dataSource={statutoryDeductionRows}
                    emptyText="暂无已确认进入本月薪酬的法定扣减"
                    rowKey="id"
                    scrollX={850}
                  />
                </DetailSection>
              </>
            )
          },
          {
            key: 'adjustments',
            label: '调整记录',
            children: (
              <DetailSection icon={<CalculatorOutlined />} title="薪酬调整">
                <CompactDetailTable<SalaryAdjustmentRecord>
                  columns={adjustmentColumns}
                  dataSource={report.salaryAdjustmentRecords}
                  emptyText="暂无薪酬调整"
                  rowKey="id"
                  scrollX={820}
                />
              </DetailSection>
            )
          },
          {
            key: 'operations',
            label: '处理记录',
            children: (
              <OperationRecordSection icon={<FileTextOutlined />} records={report.operationRecords} scrollX={880} title="处理记录" />
            )
          }
        ]}
        tabTestIdPrefix="salary-monthly-detail-tab"
        testId="salary-monthly-detail-tabs"
      />
    </DetailDrawerShell>
  );
}
