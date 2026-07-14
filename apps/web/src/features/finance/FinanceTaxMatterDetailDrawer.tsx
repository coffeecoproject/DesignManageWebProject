import {
  AuditOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ExportOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  ProfileOutlined,
  UploadOutlined,
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
import type { TagChipTone } from '../../components/TagChip';
import { CompactCell } from '../../components/TableCell';
import { CorporateIncomeTaxSourceTable } from './CorporateIncomeTaxSourceTable';
import { PayrollIitEmployeeDetailPanel } from './PayrollIitEmployeeDetailPanel';
import { SocialInsuranceContributionDetailPanel } from './SocialInsuranceContributionDetailPanel';
import { StampDutySourceDetailTable } from './StampDutySourceDetailTable';
import { VatUnbilledIncomeDetailTable } from './VatUnbilledIncomeDetailTable';
import type {
  FinanceDeclarationPreparationRecord,
  FinanceDeclarationUnbilledIncomeCandidate
} from './financeDeclarationPreparationData';
import type { SocialInsuranceEmployeeRecord, SocialInsuranceHandlingStatus } from './financeSocialInsuranceData';
import type { FinanceStampDutySourceRecord } from './financeStampDutyModel';
import {
  getTaxMatterFileStatus,
  taxMatterDeclarationStatusTone,
  taxMatterProcessStatusTone,
  taxMatterSourceStatusTone,
  taxMatterTypeTone,
  type FinanceTaxMatterDeclarationHistoryRecord,
  type FinanceTaxMatterRecord,
  type FinanceTaxMatterSourceItem
} from './financeTaxFilingData';
import {
  getTaxMatterProcessStatusLabel,
  taxMatterOfficialHandlingEntries,
  type TaxMatterEditorMode,
  type TaxMatterModuleScope
} from './financeTaxMatterHandlingModel';
import {
  getTaxMatterSettlementDirection,
  type SocialInsuranceTaxMatterSummary
} from './financeTaxMatterModel';
import { formatMoney } from './financeUtils';

type TaxMatterFileStatus = '未开始' | '待上传' | '待补充' | '已归档';

const taxMatterFileStatusTone = {
  未开始: 'gray',
  待上传: 'amber',
  待补充: 'amber',
  已归档: 'green'
} as const satisfies Record<TaxMatterFileStatus, TagChipTone>;

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

const declarationHistoryColumns: TableColumnsType<FinanceTaxMatterDeclarationHistoryRecord> = [
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
  { dataIndex: 'filedPayableAmount', render: (amount: number) => formatMoney(amount), title: '官方应缴', width: 128 },
  {
    dataIndex: 'reason',
    render: (reason: string, record) => <CompactCell primary={reason} secondary={`${record.operatedBy} / ${record.operatedAt}`} />,
    title: '调整原因',
    width: 260
  }
];

export type FinanceTaxMatterDetailDrawerProps = {
  canOpenOfficialPlatform: boolean;
  canRecordDeclarationResult: boolean;
  canRecordPaymentResult: boolean;
  canRecordRefundResult: boolean;
  canSupplementDeclarationReceipt: boolean;
  canUploadSocialReceipt: boolean;
  declarationDetailPreparation?: FinanceDeclarationPreparationRecord;
  declarationPreparation?: FinanceDeclarationPreparationRecord;
  isSocialInsuranceEmployeeLocked: (record: SocialInsuranceEmployeeRecord) => boolean;
  moduleScope: TaxMatterModuleScope;
  record?: FinanceTaxMatterRecord;
  socialInsuranceEmployeeRows: SocialInsuranceEmployeeRecord[];
  socialInsuranceSummary?: SocialInsuranceTaxMatterSummary;
  vatUnbilledIncomeRows: FinanceDeclarationUnbilledIncomeCandidate[];
  onClose: () => void;
  onDownloadFile: (file: RelatedFileRecord) => void;
  onOpenAction: (mode: TaxMatterEditorMode) => void;
  onOpenOfficialPlatform: () => void;
  onPreviewFile: (file: RelatedFileRecord) => void;
  onSocialInsuranceStatusChange: (
    employeeRecord: SocialInsuranceEmployeeRecord,
    handlingStatus: SocialInsuranceHandlingStatus
  ) => void;
  onStampDutySourceClick: (record: FinanceStampDutySourceRecord) => void;
};

export function FinanceTaxMatterDetailDrawer(props: FinanceTaxMatterDetailDrawerProps) {
  const {
    canOpenOfficialPlatform,
    canRecordDeclarationResult,
    canRecordPaymentResult,
    canRecordRefundResult,
    canSupplementDeclarationReceipt,
    canUploadSocialReceipt,
    declarationDetailPreparation,
    declarationPreparation,
    isSocialInsuranceEmployeeLocked,
    moduleScope,
    onClose,
    onDownloadFile,
    onOpenAction,
    onOpenOfficialPlatform,
    onPreviewFile,
    onSocialInsuranceStatusChange,
    onStampDutySourceClick,
    record,
    socialInsuranceEmployeeRows,
    socialInsuranceSummary,
    vatUnbilledIncomeRows
  } = props;
  const isSocialInsuranceModule = moduleScope === 'social';

  return (
    <DetailDrawerShell
      bodyTestId="finance-tax-detail-drawer"
      className="finance-tax-drawer"
      closeAction={{ label: '关闭', onClick: onClose }}
      open={Boolean(record)}
      primaryAction={getPrimaryAction({
        canRecordDeclarationResult,
        canRecordPaymentResult,
        canRecordRefundResult,
        canSupplementDeclarationReceipt,
        canUploadSocialReceipt,
        isSocialInsuranceModule,
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
          status={getTaxMatterProcessStatusLabel(record.processStatus, moduleScope)}
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
            items={getSummaryItems(record, moduleScope)}
          />
          <DetailTabs
            items={getDetailTabs({
              declarationDetailPreparation,
              declarationPreparation,
              isSocialInsuranceEmployeeLocked,
              isSocialInsuranceModule,
              moduleScope,
              onDownloadFile,
              onPreviewFile,
              onSocialInsuranceStatusChange,
              onStampDutySourceClick,
              record,
              socialInsuranceEmployeeRows,
              socialInsuranceSummary,
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

function renderProcessStatus(record: FinanceTaxMatterRecord, moduleScope: TaxMatterModuleScope) {
  return <StatusTag tone={taxMatterProcessStatusTone[record.processStatus]} value={getTaxMatterProcessStatusLabel(record.processStatus, moduleScope)} />;
}

function getSummaryItems(record: FinanceTaxMatterRecord, moduleScope: TaxMatterModuleScope) {
  const social = moduleScope === 'social';
  return [
    {
      icon: social ? <ProfileOutlined /> : <FileProtectOutlined />,
      key: social ? 'matterType' : 'processStatus',
      label: social ? '缴费类别' : '处理进度',
      value: social ? record.matterType : renderProcessStatus(record, moduleScope)
    },
    { icon: <CalendarOutlined />, key: 'period', label: '所属期间', value: record.period },
    {
      icon: <AuditOutlined />,
      key: 'settlement',
      label: social ? '处理进度' : '补退结果',
      value: social ? renderProcessStatus(record, moduleScope) : getTaxMatterSettlementDirection(record)
    },
    {
      icon: <WalletOutlined />,
      key: 'settlementAmount',
      label: record.declarationStatus === '待申报' ? '系统测算' : '办理金额',
      value: record.processStatus === '数据待确认'
        ? '待确认'
        : record.declarationStatus === '待申报'
          ? formatMoney(record.preparedPayableAmount)
          : formatMoney(getTaxMatterSettlementDirection(record) === '应退' ? record.refundableAmount ?? 0 : record.payableAmount)
    }
  ];
}

function getPrimaryAction({
  canRecordDeclarationResult,
  canRecordPaymentResult,
  canRecordRefundResult,
  canSupplementDeclarationReceipt,
  canUploadSocialReceipt,
  isSocialInsuranceModule,
  onOpenAction,
  record
}: Pick<FinanceTaxMatterDetailDrawerProps,
  | 'canRecordDeclarationResult'
  | 'canRecordPaymentResult'
  | 'canRecordRefundResult'
  | 'canSupplementDeclarationReceipt'
  | 'canUploadSocialReceipt'
  | 'record'
  | 'onOpenAction'
> & { isSocialInsuranceModule: boolean }) {
  if (canUploadSocialReceipt) return { icon: <UploadOutlined />, label: '上传凭证', testId: 'finance-tax-receipt-button', onClick: () => onOpenAction('social-receipt') };
  if (canRecordDeclarationResult) return { icon: <FileProtectOutlined />, label: '登记申报结果', testId: 'finance-tax-declaration-result-button', onClick: () => onOpenAction('declaration-result') };
  if (canSupplementDeclarationReceipt) return { icon: <FileProtectOutlined />, label: '补充申报回执', testId: 'finance-tax-declaration-receipt-button', onClick: () => onOpenAction('declaration-receipt') };
  if (canRecordPaymentResult) return { icon: <WalletOutlined />, label: '登记缴款', testId: 'finance-tax-payment-result-button', onClick: () => onOpenAction('payment-result') };
  if (canRecordRefundResult) return { icon: <WalletOutlined />, label: '登记退税', testId: 'finance-tax-refund-result-button', onClick: () => onOpenAction('refund-result') };
  if (!isSocialInsuranceModule && record && !['待申报', '已作废'].includes(record.declarationStatus)) {
    return { icon: <FileProtectOutlined />, label: '调整申报', testId: 'finance-tax-revision-button', onClick: () => onOpenAction('revision') };
  }
  return undefined;
}

function getDetailTabs({
  declarationDetailPreparation,
  declarationPreparation,
  isSocialInsuranceEmployeeLocked,
  isSocialInsuranceModule,
  moduleScope,
  onDownloadFile,
  onPreviewFile,
  onSocialInsuranceStatusChange,
  onStampDutySourceClick,
  record,
  socialInsuranceEmployeeRows,
  socialInsuranceSummary,
  vatUnbilledIncomeRows
}: Pick<FinanceTaxMatterDetailDrawerProps,
  | 'declarationDetailPreparation'
  | 'declarationPreparation'
  | 'isSocialInsuranceEmployeeLocked'
  | 'moduleScope'
  | 'onDownloadFile'
  | 'onPreviewFile'
  | 'onSocialInsuranceStatusChange'
  | 'onStampDutySourceClick'
  | 'socialInsuranceEmployeeRows'
  | 'socialInsuranceSummary'
  | 'vatUnbilledIncomeRows'
> & { isSocialInsuranceModule: boolean; record: FinanceTaxMatterRecord }) {
  return [
    {
      children: <TaxMatterOverviewPanel declarationPreparation={declarationPreparation} moduleScope={moduleScope} record={record} />,
      key: 'basic',
      label: isSocialInsuranceModule ? '缴费信息' : '办理信息'
    },
    ...(isSocialInsuranceModule ? [{
      children: (
        <DetailSection icon={<FileSearchOutlined />} title="缴费明细">
          <SocialInsuranceContributionDetailPanel
            isRecordLocked={isSocialInsuranceEmployeeLocked}
            payableAmount={record.payableAmount}
            readOnly={record.processStatus === '已完成'}
            records={socialInsuranceEmployeeRows}
            summary={socialInsuranceSummary}
            onStatusChange={onSocialInsuranceStatusChange}
          />
        </DetailSection>
      ),
      key: 'confirmation',
      label: '缴费明细'
    }] : []),
    ...(!isSocialInsuranceModule && declarationDetailPreparation ? [{
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
        <DetailSection icon={<FileProtectOutlined />} title={isSocialInsuranceModule ? '缴费凭证' : '回执文件'}>
          <RelatedFileTable records={record.files} onDownload={onDownloadFile} onPreview={onPreviewFile} />
        </DetailSection>
      ),
      key: 'files',
      label: isSocialInsuranceModule ? '缴费凭证' : '回执文件'
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
  moduleScope,
  record
}: {
  declarationPreparation?: FinanceDeclarationPreparationRecord;
  moduleScope: TaxMatterModuleScope;
  record: FinanceTaxMatterRecord;
}) {
  const social = moduleScope === 'social';
  const officialEntry = taxMatterOfficialHandlingEntries[record.matterType];
  return (
    <div className="detail-tab-stack">
      <DetailSection icon={<AuditOutlined />} title={social ? '缴费信息' : '办理信息'}>
        <DetailInfoGrid columns={3} items={social ? [
          { label: '缴费编号', value: record.matterNo },
          { label: '缴费类型', value: <StatusTag toneMap={taxMatterTypeTone} value={record.matterType} /> },
          { label: '处理进度', value: renderProcessStatus(record, moduleScope) },
          { label: '办理平台', value: officialEntry.platform },
          { label: '凭证状态', value: <StatusTag toneMap={taxMatterFileStatusTone} value={getTaxMatterFileStatus(record)} /> },
          { label: '所属期间', value: record.period },
          { label: '涉及对象', value: record.participantSummary },
          { label: '办理截止日', value: record.declarationDueDate },
          { label: '缴纳截止日', value: record.paymentDueDate }
        ] : getTaxMatterInfoItems(record, officialEntry.platform)} />
      </DetailSection>
      {!social ? (
        <DetailSection icon={<FileSearchOutlined />} title={declarationPreparation ? '申报数据' : '来源资料'}>
          {declarationPreparation ? (
            <DetailInfoGrid columns={3} items={getDeclarationPreparationResultItems(declarationPreparation)} />
          ) : (
            <CompactDetailTable<FinanceTaxMatterSourceItem> columns={taxMatterSourceColumns} dataSource={record.sourceItems} rowKey="id" scrollX={420} />
          )}
        </DetailSection>
      ) : null}
      {!social && record.declarationHistory.length > 0 ? (
        <DetailSection icon={<AuditOutlined />} title="历史申报">
          <CompactDetailTable<FinanceTaxMatterDeclarationHistoryRecord> columns={declarationHistoryColumns} dataSource={record.declarationHistory} rowKey="id" scrollX={608} />
        </DetailSection>
      ) : null}
    </div>
  );
}

function getTaxMatterInfoItems(record: FinanceTaxMatterRecord, platform: string) {
  const direction = getTaxMatterSettlementDirection(record);
  return [
    { label: '事项编号', value: record.matterNo },
    { label: '办理平台', value: platform },
    { label: '申报截止日', value: record.declarationDueDate },
    {
      label: record.declarationStatus === '待申报' ? '系统测算金额' : '办理金额',
      value: formatMoney(record.declarationStatus === '待申报'
        ? record.preparedPayableAmount
        : direction === '应退' ? record.refundableAmount ?? 0 : record.payableAmount)
    },
    ...(direction !== '无需补退' ? [{ label: direction === '应退' ? '退税办理期限' : '缴款截止日', value: record.paymentDueDate }] : []),
    ...(record.declarationDate ? [{ label: '实际申报日期', value: record.declarationDate }] : []),
    ...(record.declarationReceiptNo ? [{ label: '申报凭证号', value: record.declarationReceiptNo }] : []),
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
