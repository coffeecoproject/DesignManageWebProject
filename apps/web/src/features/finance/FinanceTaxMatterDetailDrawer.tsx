import {
  AuditOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ExportOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  WalletOutlined
} from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import { RelatedFileTable, type RelatedFileRecord } from '../../components/RelatedFileTable';
import { CompactCell } from '../../components/TableCell';
import { CorporateIncomeTaxSourceTable } from './CorporateIncomeTaxSourceTable';
import { PayrollIitEmployeeDetailPanel } from './PayrollIitEmployeeDetailPanel';
import { StampDutySourceDetailTable } from './StampDutySourceDetailTable';
import { VatUnbilledIncomeDetailTable } from './VatUnbilledIncomeDetailTable';
import type { AccountingVoucherRecord } from './financeAccountingVoucherModel';
import type {
  FinanceDeclarationPreparationRecord,
  FinanceDeclarationUnbilledIncomeCandidate
} from './financeDeclarationPreparationData';
import type { FinanceStampDutySourceRecord } from './financeStampDutyModel';
import {
  taxMatterDeclarationStatusTone,
  taxMatterProcessStatusTone,
  taxMatterSourceStatusTone,
  type FinanceTaxMatterDeclarationHistoryRecord,
  type FinanceTaxMatterRecord,
  type FinanceTaxMatterSourceItem
} from './financeTaxFilingData';
import {
  getTaxMatterProcessStatusLabel,
  taxMatterOfficialHandlingEntries,
  type TaxMatterEditorMode
} from './financeTaxMatterHandlingModel';
import {
  getTaxMatterEvidenceStatus,
  getTaxMatterSettlementDirection
} from './financeTaxMatterModel';
import { formatMoney } from './financeUtils';

const taxMatterSourceColumns: TableColumnsType<FinanceTaxMatterSourceItem> = [
  {
    dataIndex: 'name',
    render: (_name: string, record) => <CompactCell primary={record.name} secondary={record.sourceModule} />,
    title: '来源项',
    width: 220
  },
  {
    dataIndex: 'status',
    render: (status: FinanceTaxMatterSourceItem['status']) => <StatusTag toneMap={taxMatterSourceStatusTone} value={status} />,
    title: '状态',
    width: 96
  }
];

function getDeclarationHistoryColumns(
  taxFilingVouchers: AccountingVoucherRecord[]
): TableColumnsType<FinanceTaxMatterDeclarationHistoryRecord> {
  return [
    {
      dataIndex: 'version',
      render: (version: number, record) => <CompactCell primary={`第 ${version} 版`} secondary={record.action} />,
      title: '版本',
      width: 108
    },
    {
      dataIndex: 'declarationStatus',
      render: (status: FinanceTaxMatterDeclarationHistoryRecord['declarationStatus']) => (
        <StatusTag toneMap={taxMatterDeclarationStatusTone} value={status} />
      ),
      title: '申报结果',
      width: 112
    },
    {
      key: 'filingPeriod',
      render: (_, record) => {
        const voucher = taxFilingVouchers.find((candidate) => (
          candidate.taxFilingContext?.declarationVersion === record.version
        ));

        return (
          <CompactCell
            primary={record.declarationDate ?? '-'}
            secondary={voucher ? `入账期间 ${voucher.accountingPeriod}` : '无申报差额凭证'}
          />
        );
      },
      title: '申报与入账',
      width: 178
    },
    {
      key: 'settlement',
      render: (_, record) => {
        const refundableAmount = record.filedRefundableAmount ?? 0;
        const direction = refundableAmount > 0 ? '应退' : record.filedPayableAmount > 0 ? '应缴' : '无需补退';
        const amount = refundableAmount > 0 ? refundableAmount : record.filedPayableAmount;
        return <CompactCell primary={direction} secondary={formatMoney(amount)} />;
      },
      title: '补退结果',
      width: 136
    },
    {
      dataIndex: 'reason',
      render: (reason: string, record) => <CompactCell primary={reason} secondary={`${record.operatedBy} / ${record.operatedAt}`} />,
      title: '调整原因',
      width: 240
    }
  ];
}

export type FinanceTaxMatterDetailDrawerProps = {
  canAdjustDeclaration: boolean;
  canOpenOfficialPlatform: boolean;
  canRecordDeclarationResult: boolean;
  canRecordPaymentResult: boolean;
  canRecordRefundResult: boolean;
  canSubmitRefundApplication: boolean;
  canMaintainDeclarationEvidence: boolean;
  declarationDetailPreparation?: FinanceDeclarationPreparationRecord;
  declarationPreparation?: FinanceDeclarationPreparationRecord;
  record?: FinanceTaxMatterRecord;
  taxFilingVouchers: AccountingVoucherRecord[];
  vatUnbilledIncomeRows: FinanceDeclarationUnbilledIncomeCandidate[];
  onClose: () => void;
  onDownloadFile?: (file: RelatedFileRecord) => void;
  onOpenAction: (mode: TaxMatterEditorMode) => void;
  onOpenOfficialPlatform: () => void;
  onPreviewFile?: (file: RelatedFileRecord) => void;
  onStampDutySourceClick: (record: FinanceStampDutySourceRecord) => void;
};

export function FinanceTaxMatterDetailDrawer(props: FinanceTaxMatterDetailDrawerProps) {
  const {
    canAdjustDeclaration,
    canOpenOfficialPlatform,
    canRecordDeclarationResult,
    canRecordPaymentResult,
    canRecordRefundResult,
    canSubmitRefundApplication,
    canMaintainDeclarationEvidence,
    declarationDetailPreparation,
    declarationPreparation,
    onClose,
    onDownloadFile,
    onOpenAction,
    onOpenOfficialPlatform,
    onPreviewFile,
    onStampDutySourceClick,
    record,
    taxFilingVouchers,
    vatUnbilledIncomeRows
  } = props;
  return (
    <DetailDrawerShell
      bodyTestId="finance-tax-detail-drawer"
      className="finance-tax-drawer"
      closeAction={{ label: '关闭', onClick: onClose }}
      open={Boolean(record)}
      primaryAction={getPrimaryAction({
        canAdjustDeclaration,
        canRecordDeclarationResult,
        canRecordPaymentResult,
        canRecordRefundResult,
        canSubmitRefundApplication,
        canMaintainDeclarationEvidence,
        onOpenAction,
        record
      })}
      secondaryAction={canOpenOfficialPlatform && record?.processStatus !== '已完成'
        ? {
            icon: <ExportOutlined />,
            label: '打开办理平台',
            testId: 'finance-tax-official-entry-button',
            onClick: onOpenOfficialPlatform
          }
        : undefined}
      title={record ? (
        <DetailDrawerTitle
          status={getTaxMatterProcessStatusLabel(record.processStatus)}
          statusTone={taxMatterProcessStatusTone[record.processStatus]}
          subtitle={`${record.matterNo} / ${record.period}`}
          title={record.title}
        />
      ) : null}
      width={860}
      onClose={onClose}
    >
      {record ? (
        <>
          <DetailSummaryCards
            columns={4}
            items={getSummaryItems(record)}
          />
          <DetailTabs
            items={getDetailTabs({
              declarationDetailPreparation,
              declarationPreparation,
              onDownloadFile,
              onPreviewFile,
              onStampDutySourceClick,
              record,
              taxFilingVouchers,
              vatUnbilledIncomeRows
            })}
            tabTestIdPrefix="finance-tax-detail-tab"
            testId="finance-tax-detail-tabs"
          />
        </>
      ) : null}
    </DetailDrawerShell>
  );
}

function renderProcessStatus(record: FinanceTaxMatterRecord) {
  return <StatusTag tone={taxMatterProcessStatusTone[record.processStatus]} value={getTaxMatterProcessStatusLabel(record.processStatus)} />;
}

function getPreparedSettlement(record: FinanceTaxMatterRecord) {
  const direction = record.preparedSettlementDirection
    ?? ((record.preparedRefundableAmount ?? 0) > 0 ? '应退' : record.preparedPayableAmount > 0 ? '应缴' : '无需补退');
  const amount = direction === '应退' ? record.preparedRefundableAmount ?? 0 : record.preparedPayableAmount;

  return { amount, direction };
}

function getSummaryItems(record: FinanceTaxMatterRecord) {
  const preparedSettlement = getPreparedSettlement(record);
  return [
    {
      icon: <FileProtectOutlined />,
      key: 'processStatus',
      label: '处理进度',
      value: renderProcessStatus(record)
    },
    { icon: <CalendarOutlined />, key: 'period', label: '所属税期', value: record.period },
    {
      icon: <AuditOutlined />,
      key: 'settlement',
      label: '补退结果',
      value: getTaxMatterSettlementDirection(record)
    },
    {
      icon: <WalletOutlined />,
      key: 'settlementAmount',
      label: record.declarationStatus === '待申报' ? '系统测算' : '办理金额',
      value: record.processStatus === '数据待确认'
        ? '待确认'
        : record.declarationStatus === '待申报'
          ? formatMoney(preparedSettlement.amount)
          : formatMoney(getTaxMatterSettlementDirection(record) === '应退' ? record.refundableAmount ?? 0 : record.payableAmount)
    }
  ];
}

function getPrimaryAction({
  canAdjustDeclaration,
  canRecordDeclarationResult,
  canRecordPaymentResult,
  canRecordRefundResult,
  canSubmitRefundApplication,
  canMaintainDeclarationEvidence,
  onOpenAction,
  record
}: Pick<FinanceTaxMatterDetailDrawerProps,
  | 'canAdjustDeclaration'
  | 'canRecordDeclarationResult'
  | 'canRecordPaymentResult'
  | 'canRecordRefundResult'
  | 'canSubmitRefundApplication'
  | 'canMaintainDeclarationEvidence'
  | 'record'
  | 'onOpenAction'
>) {
  if (canRecordDeclarationResult) return { icon: <FileProtectOutlined />, label: '登记申报结果', testId: 'finance-tax-declaration-result-button', onClick: () => onOpenAction('declaration-result') };
  if (canRecordPaymentResult) return { icon: <WalletOutlined />, label: '登记缴款', testId: 'finance-tax-payment-result-button', onClick: () => onOpenAction('payment-result') };
  if (canSubmitRefundApplication) return { icon: <FileProtectOutlined />, label: '处理多缴税款', testId: 'finance-tax-refund-application-button', onClick: () => onOpenAction('refund-application') };
  if (canRecordRefundResult) return record?.overpaymentMethod === '抵缴'
    ? { icon: <WalletOutlined />, label: '登记抵缴结果', testId: 'finance-tax-offset-result-button', onClick: () => onOpenAction('offset-result') }
    : { icon: <WalletOutlined />, label: '登记退税到账', testId: 'finance-tax-refund-result-button', onClick: () => onOpenAction('refund-result') };
  if (canMaintainDeclarationEvidence) return { icon: <FileProtectOutlined />, label: '维护申报材料', testId: 'finance-tax-declaration-evidence-button', onClick: () => onOpenAction('declaration-evidence') };
  if (canAdjustDeclaration && record) {
    return { icon: <FileProtectOutlined />, label: '调整申报', testId: 'finance-tax-revision-button', onClick: () => onOpenAction('revision') };
  }
  return undefined;
}

function getDetailTabs({
  declarationDetailPreparation,
  declarationPreparation,
  onDownloadFile,
  onPreviewFile,
  onStampDutySourceClick,
  record,
  taxFilingVouchers,
  vatUnbilledIncomeRows
}: Pick<FinanceTaxMatterDetailDrawerProps,
  | 'declarationDetailPreparation'
  | 'declarationPreparation'
  | 'onDownloadFile'
  | 'onPreviewFile'
  | 'onStampDutySourceClick'
  | 'taxFilingVouchers'
  | 'vatUnbilledIncomeRows'
> & { record: FinanceTaxMatterRecord }) {
  return [
    {
      children: (
        <TaxMatterOverviewPanel
          declarationPreparation={declarationPreparation}
          record={record}
          taxFilingVouchers={taxFilingVouchers}
        />
      ),
      key: 'basic',
      label: '申报结果'
    },
    ...(declarationDetailPreparation ? [{
      children: (
        <TaxDeclarationDetailPanel
          preparation={declarationDetailPreparation}
          vatUnbilledIncomeRows={vatUnbilledIncomeRows}
          onStampDutySourceClick={onStampDutySourceClick}
        />
      ),
      key: 'declaration-details',
      label: '申报明细'
    }] : []),
    {
      children: (
        <DetailSection icon={<FileProtectOutlined />} title="申报材料">
          <RelatedFileTable records={record.files} onDownload={onDownloadFile} onPreview={onPreviewFile} />
        </DetailSection>
      ),
      key: 'files',
      label: '申报材料'
    },
    {
      children: <OperationRecordSection icon={<CheckCircleOutlined />} records={record.operationRecords} title="操作记录" />,
      key: 'operations',
      label: '操作记录'
    }
  ];
}

function TaxMatterOverviewPanel({
  declarationPreparation,
  record,
  taxFilingVouchers
}: {
  declarationPreparation?: FinanceDeclarationPreparationRecord;
  record: FinanceTaxMatterRecord;
  taxFilingVouchers: AccountingVoucherRecord[];
}) {
  const officialEntry = taxMatterOfficialHandlingEntries[record.matterType];
  const currentFilingVoucher = taxFilingVouchers.find((candidate) => (
    candidate.taxFilingContext?.declarationVersion === record.declarationVersion
  ));
  return (
    <div className="detail-tab-stack">
      <DetailSection icon={<AuditOutlined />} title="申报结果">
        <DetailInfoGrid columns={3} items={getTaxMatterInfoItems(record, officialEntry.platform, currentFilingVoucher)} />
      </DetailSection>
      <DetailSection icon={<FileSearchOutlined />} title={declarationPreparation ? '申报数据' : '来源资料'}>
        {declarationPreparation ? (
          <DetailInfoGrid columns={3} items={getDeclarationPreparationResultItems(declarationPreparation)} />
        ) : (
          <CompactDetailTable<FinanceTaxMatterSourceItem> columns={taxMatterSourceColumns} dataSource={record.sourceItems} rowKey="id" scrollX={420} />
        )}
      </DetailSection>
      {record.declarationHistory.length > 0 ? (
        <DetailSection icon={<AuditOutlined />} title="历史申报">
          <CompactDetailTable<FinanceTaxMatterDeclarationHistoryRecord>
            columns={getDeclarationHistoryColumns(taxFilingVouchers)}
            dataSource={record.declarationHistory}
            rowKey="id"
            scrollX={786}
          />
        </DetailSection>
      ) : null}
    </div>
  );
}

function getTaxMatterInfoItems(
  record: FinanceTaxMatterRecord,
  platform: string,
  currentFilingVoucher?: AccountingVoucherRecord
) {
  const direction = getTaxMatterSettlementDirection(record);
  const preparedSettlement = getPreparedSettlement(record);
  const overpaymentMethod = record.overpaymentMethod;
  return [
    { label: '事项编号', value: record.matterNo },
    { label: '办理平台', value: platform },
    { label: '申报截止日', value: record.declarationDueDate },
    { label: '当前申报版本', value: `第 ${record.declarationVersion} 版` },
    {
      label: record.declarationStatus === '待申报' ? '系统测算金额' : '办理金额',
      value: formatMoney(record.declarationStatus === '待申报'
        ? preparedSettlement.amount
        : direction === '应退' ? record.refundableAmount ?? 0 : record.payableAmount)
    },
    ...(direction !== '无需补退' ? [{ label: direction === '应退' ? '退税办理期限' : '缴款截止日', value: record.paymentDueDate }] : []),
    ...(record.declarationDate ? [{ label: '实际申报日期', value: record.declarationDate }] : []),
    ...(currentFilingVoucher
      ? [{ label: '差额入账期间', value: currentFilingVoucher.accountingPeriod }]
      : []),
    ...(record.taxAuthorityDeclarationNo ? [{ label: '税务机关申报序号', value: record.taxAuthorityDeclarationNo }] : []),
    ...(record.taxAuthorityAssessmentVoucherNo ? [{ label: '应征凭证序号', value: record.taxAuthorityAssessmentVoucherNo }] : []),
    {
      label: '申报材料',
      value: <StatusTag
        tone={getTaxMatterEvidenceStatus(record) === '已齐全'
          ? 'green'
          : getTaxMatterEvidenceStatus(record) === '核验不一致' ? 'red' : 'amber'}
        value={getTaxMatterEvidenceStatus(record)}
      />
    },
    { label: '核验结果', value: record.declarationVerificationStatus },
    ...(record.declarationVerifiedAt ? [{ label: '核验记录', value: `${record.declarationVerifiedBy ?? '-'} / ${record.declarationVerifiedAt}` }] : []),
    ...(record.declarationVerificationNote ? [{ label: '核验说明', value: record.declarationVerificationNote }] : []),
    ...(overpaymentMethod ? [{ label: '多缴处理方式', value: overpaymentMethod }] : []),
    ...(record.refundApplicationDate ? [{ label: overpaymentMethod === '抵缴' ? '抵缴申请日期' : '退税申请日期', value: record.refundApplicationDate }] : []),
    ...(record.refundApplicationReceiptNo ? [{ label: overpaymentMethod === '抵缴' ? '抵缴申请回执号' : '退税申请回执号', value: record.refundApplicationReceiptNo }] : []),
    ...(record.offsetTargetMatterNo ? [{ label: '抵缴目标事项', value: record.offsetTargetMatterNo }] : []),
    ...(record.offsetDate ? [{ label: '抵缴确认日期', value: record.offsetDate }] : []),
    ...((record.offsetAmount ?? 0) > 0 ? [{ label: '已抵缴金额', value: formatMoney(record.offsetAmount ?? 0) }] : []),
    ...(record.refundDate ? [{ label: '退税到账日期', value: record.refundDate }] : []),
    ...((record.refundedAmount ?? 0) > 0 ? [{ label: '已退税金额', value: formatMoney(record.refundedAmount ?? 0) }] : []),
    ...(record.paymentDate ? [{ label: '实际缴款日期', value: record.paymentDate }] : []),
    ...(record.declarationDifferenceReason ? [{ label: '差异说明', value: record.declarationDifferenceReason }] : [])
  ];
}

function TaxDeclarationDetailPanel({
  onStampDutySourceClick,
  preparation,
  vatUnbilledIncomeRows
}: {
  onStampDutySourceClick: (record: FinanceStampDutySourceRecord) => void;
  preparation: FinanceDeclarationPreparationRecord;
  vatUnbilledIncomeRows: FinanceDeclarationUnbilledIncomeCandidate[];
}) {
  return (
    <DetailSection icon={<FileSearchOutlined />} title="申报明细">
      {preparation.taxType === '个人所得税' ? (
        <PayrollIitEmployeeDetailPanel
          amountLabel="申报个税"
          payableAmount={preparation.iitSummary?.payableAmount ?? 0}
          records={preparation.iitEmployeeRows ?? []}
          summary={preparation.iitSummary}
          summaryTitle="员工申报明细"
        />
      ) : null}
      {preparation.taxType === '增值税及附加' ? <VatUnbilledIncomeDetailTable records={vatUnbilledIncomeRows} /> : null}
      {preparation.taxType === '企业所得税' ? <CorporateIncomeTaxSourceTable record={preparation} /> : null}
      {preparation.taxType === '印花税' ? (
        <StampDutySourceDetailTable records={preparation.stampDutySources ?? []} onRecordClick={onStampDutySourceClick} />
      ) : null}
    </DetailSection>
  );
}

function getDeclarationPreparationResultItems(preparation: FinanceDeclarationPreparationRecord) {
  if (preparation.taxType === '个人所得税') {
    const summary = preparation.iitSummary;
    return [
      { label: '申报人员', value: summary?.participantSummary ?? '待生成' },
      { label: '本月计税工资', value: formatMoney(summary?.currentIncomeAmount ?? 0) },
      { label: '基本减除费用', value: formatMoney(summary?.currentBasicDeductionAmount ?? 0) },
      { label: '社保公积金个人部分', value: formatMoney(summary?.currentSpecialDeductionAmount ?? 0) },
      { label: '专项附加扣除', value: formatMoney(summary?.currentAdditionalDeductionAmount ?? 0) },
      { label: '本次应缴', value: formatMoney(summary?.payableAmount ?? 0) }
    ];
  }
  if (preparation.taxType === '企业所得税') {
    const summary = preparation.citSummary;
    if (preparation.declarationScenario === '年度汇算') return [
      { label: '年度利润总额', value: formatMoney(summary?.cumulativeProfitBeforeTaxAmount ?? 0) },
      { label: '纳税调增', value: formatMoney(summary?.taxAdjustmentIncreaseAmount ?? 0) },
      { label: '纳税调减', value: formatMoney(summary?.taxAdjustmentDecreaseAmount ?? 0) },
      { label: '以前年度亏损弥补', value: formatMoney(summary?.priorLossDeductionAmount ?? 0) },
      { label: '应纳税所得额', value: formatMoney(summary?.cumulativeTaxableIncomeAmount ?? 0) },
      { label: '年度应纳税额', value: formatMoney(summary?.cumulativeIncomeTaxPayableAmount ?? 0) },
      { label: '本年实际已缴', value: formatMoney(summary?.taxPaidYearToDateAmount ?? 0) },
      { label: '本次应补', value: formatMoney(summary?.currentPeriodPayableAmount ?? 0) },
      { label: '本次应退', value: formatMoney(summary?.overpaidTaxAmount ?? 0) }
    ];
    return [
      { label: '本年累计利润总额', value: formatMoney(summary?.cumulativeProfitBeforeTaxAmount ?? 0) },
      { label: '累计实际利润额', value: formatMoney(summary?.cumulativeTaxableIncomeAmount ?? 0) },
      { label: '小型微利资格', value: summary ? (summary.smallLowProfitEligible ? '符合' : '不符合') : '-' },
      { label: '累计应纳所得税额', value: formatMoney(summary?.cumulativeIncomeTaxPayableAmount ?? 0) },
      { label: '本年实际已缴', value: formatMoney(summary?.taxPaidYearToDateAmount ?? 0) },
      { label: '本次应缴', value: formatMoney(summary?.currentPeriodPayableAmount ?? 0) }
    ];
  }
  if (preparation.taxType === '印花税') {
    const summary = preparation.stampDutySummary;
    return [
      { label: '申报类型', value: preparation.declarationScenario },
      { label: '应税凭证', value: `${summary?.sourceCount ?? 0} 条` },
      { label: '计税依据', value: formatMoney(summary?.taxableBasis ?? 0) },
      { label: '减免前税额', value: formatMoney(summary?.taxBeforeReduction ?? 0) },
      { label: '六税两费减征', value: formatMoney(summary?.reductionAmount ?? 0) },
      { label: '本次应缴', value: formatMoney(summary?.estimatedPayableAmount ?? 0) }
    ];
  }
  return [
    { label: '申报销售额', value: formatMoney(preparation.vatSummary.declaredNetSalesAmount) },
    { label: '应缴增值税', value: formatMoney(preparation.vatSummary.estimatedVatAfterExemption) },
    { label: '城市维护建设税', value: formatMoney(preparation.vatSummary.surchargeBreakdown.urbanMaintenanceTaxAfterReduction) },
    { label: '教育费附加', value: formatMoney(preparation.vatSummary.surchargeBreakdown.educationSurchargeAfterReduction) },
    { label: '地方教育附加', value: formatMoney(preparation.vatSummary.surchargeBreakdown.localEducationSurchargeAfterReduction) },
    { label: '附加税减征', value: formatMoney(preparation.vatSummary.surchargeBreakdown.reductionAmount) },
    { label: '本次应缴合计', value: formatMoney(preparation.vatSummary.estimatedTotalTaxAmount) }
  ];
}
