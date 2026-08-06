import {
  AuditOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  WalletOutlined
} from '@ant-design/icons';
import { DatePicker, Input, InputNumber, Select } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection } from '../../components/Detail';
import { DrawerFormField, DrawerFormGrid } from '../../components/DrawerForm';
import { DrawerShell } from '../../components/DrawerShell';
import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import { FinanceVoucherUploadPanel, type FinanceVoucherUploadFile } from './FinanceVoucherUploadPanel';
import type { FinanceTaxDeclarationVerificationStatus, FinanceTaxMatterRecord } from './financeTaxFilingData';
import { buildTaxMatterReceiptFile } from './financeTaxMatterHandlingModel';
import {
  getTaxMatterCurrentVersionOffsetAmount,
  getTaxMatterCurrentVersionPaidAmount,
  getTaxMatterCurrentVersionRefundedAmount,
  getTaxMatterDeclarationResultValidationError,
  getTaxMatterOutstandingAmount,
  getTaxMatterRefundOutstandingAmount,
  getTaxMatterSettlementDirection,
  getVatDeclarationVersionSettlement,
  type TaxMatterDeclarationEvidenceInput,
  type TaxMatterDeclarationResultInput,
  type TaxMatterPaymentResultInput,
  type TaxMatterOffsetResultInput,
  type TaxMatterRefundApplicationInput,
  type TaxMatterRefundResultInput,
  type TaxMatterReceiptFileType
} from './financeTaxMatterModel';
import { financeToday, formatMoney } from './financeUtils';

type CommonDrawerProps = {
  onClose: () => void;
  record?: FinanceTaxMatterRecord;
};

export function TaxDeclarationResultDrawer({ onClose, onSave, record }: CommonDrawerProps & {
  onSave: (record: FinanceTaxMatterRecord, input: TaxMatterDeclarationResultInput) => void;
}) {
  const [declarationDate, setDeclarationDate] = useState(financeToday);
  const [declarationStatus, setDeclarationStatus] = useState<TaxMatterDeclarationResultInput['declarationStatus']>('申报成功');
  const [settlementAmount, setSettlementAmount] = useState(0);
  const [settlementDirection, setSettlementDirection] = useState<TaxMatterDeclarationResultInput['settlementDirection']>('应缴');
  const [taxAuthorityDeclarationNo, setTaxAuthorityDeclarationNo] = useState('');
  const [taxAuthorityAssessmentVoucherNo, setTaxAuthorityAssessmentVoucherNo] = useState('');
  const [differenceReason, setDifferenceReason] = useState('');
  const [declarationFormFiles, setDeclarationFormFiles] = useState<RelatedFileRecord[]>([]);
  const [declarationResultFile, setDeclarationResultFile] = useState<RelatedFileRecord>();
  const [declarationVerificationStatus, setDeclarationVerificationStatus] = useState<FinanceTaxDeclarationVerificationStatus>('未核验');
  const [declarationVerificationNote, setDeclarationVerificationNote] = useState('');
  const [vatBreakdown, setVatBreakdown] = useState({
    declaredVatAmount: 0,
    educationSurchargeAmount: 0,
    localEducationSurchargeAmount: 0,
    urbanMaintenanceTaxAmount: 0
  });

  useEffect(() => {
    if (!record) return;
    const currentDirection = getTaxMatterSettlementDirection(record);
    const preparedDirection = record.preparedSettlementDirection ?? (
      (record.preparedRefundableAmount ?? 0) > 0
        ? '应退'
        : record.preparedPayableAmount > 0
          ? '应缴'
          : '无需补退'
    );
    setDeclarationDate(record.declarationDate ?? financeToday);
    setDeclarationStatus(record.declarationStatus === '零申报' ? '零申报' : '申报成功');
    setSettlementDirection(currentDirection === '待确定' ? preparedDirection : currentDirection);
    setSettlementAmount(record.declarationStatus === '待申报'
      ? preparedDirection === '应退'
        ? record.preparedRefundableAmount ?? 0
        : preparedDirection === '应缴'
          ? record.preparedPayableAmount
          : 0
      : currentDirection === '应退' ? record.refundableAmount ?? 0 : record.payableAmount);
    setTaxAuthorityDeclarationNo(record.taxAuthorityDeclarationNo ?? '');
    setTaxAuthorityAssessmentVoucherNo(record.taxAuthorityAssessmentVoucherNo ?? '');
    setDifferenceReason(record.declarationDifferenceReason ?? '');
    setDeclarationFormFiles(record.files.filter((file) => record.declarationFormFileIds.includes(file.id)));
    setDeclarationResultFile(record.declarationResultFileId
      ? record.files.find((file) => file.id === record.declarationResultFileId)
      : undefined);
    setDeclarationVerificationStatus(record.declarationVerificationStatus);
    setDeclarationVerificationNote(record.declarationVerificationNote ?? '');
    const settlement = record.vatSettlement;
    setVatBreakdown(settlement?.officialBreakdown ?? {
      declaredVatAmount: settlement?.declaredVatAmount ?? 0,
      educationSurchargeAmount: settlement?.surcharge.educationSurchargeAfterReduction ?? 0,
      localEducationSurchargeAmount: settlement?.surcharge.localEducationSurchargeAfterReduction ?? 0,
      urbanMaintenanceTaxAmount: settlement?.surcharge.urbanMaintenanceTaxAfterReduction ?? 0
    });
  }, [record]);

  if (!record) return null;

  const isVatMatter = record.matterType === '增值税及附加';
  const normalizedVatBreakdown = declarationStatus === '零申报'
    ? {
        declaredVatAmount: 0,
        educationSurchargeAmount: 0,
        localEducationSurchargeAmount: 0,
        urbanMaintenanceTaxAmount: 0
      }
    : vatBreakdown;
  const vatVersionSettlement = isVatMatter
    ? getVatDeclarationVersionSettlement(record, normalizedVatBreakdown)
    : undefined;
  const normalizedDirection = declarationStatus === '零申报'
    ? '无需补退'
    : isVatMatter
      ? vatVersionSettlement?.direction ?? '无需补退'
      : settlementDirection;
  const normalizedAmount = declarationStatus === '零申报'
    ? 0
    : isVatMatter
      ? vatVersionSettlement?.amount ?? 0
      : settlementDirection === '无需补退' ? 0 : settlementAmount;
  const preparedDirection = record.preparedSettlementDirection ?? (
    (record.preparedRefundableAmount ?? 0) > 0
      ? '应退'
      : record.preparedPayableAmount > 0
        ? '应缴'
        : '无需补退'
  );
  const preparedAmount = preparedDirection === '应退'
    ? record.preparedRefundableAmount ?? 0
    : preparedDirection === '应缴'
      ? record.preparedPayableAmount
      : 0;
  const hasAmountDifference = record.declarationVersion === 1 && (
    normalizedDirection !== preparedDirection
      || Math.abs(normalizedAmount - preparedAmount) > 0.01
  );
  const declarationResultError = getTaxMatterDeclarationResultValidationError(record, {
    declarationFormFiles,
    declarationResultFile,
    declarationStatus,
    declarationVerificationNote,
    declarationVerificationStatus,
    settlementAmount: normalizedAmount,
    settlementDirection: normalizedDirection,
    vatBreakdown: isVatMatter ? normalizedVatBreakdown : undefined
  });
  const hasCompleteDeclarationMaterials = declarationFormFiles.length > 0 && Boolean(declarationResultFile);
  const formError = !declarationDate
    ? '请选择实际申报日期'
    : normalizedAmount < 0
      ? '办理金额不能小于 0'
      : declarationVerificationStatus === '人工核验一致' && !hasCompleteDeclarationMaterials
        ? '正式申报表和申报结果回执齐全后才能标记核验一致'
      : declarationVerificationStatus === '核验不一致' && !declarationVerificationNote.trim()
        ? '请填写核验不一致原因'
        : declarationResultError
          ?? (hasAmountDifference && !differenceReason.trim() ? '请填写测算差异说明' : undefined);

  return (
    <DrawerShell
      bodyTestId="finance-tax-declaration-result-drawer"
      cancelAction={{ label: '取消', onClick: onClose }}
      className="finance-tax-drawer"
      contentLayout="detail"
      open
      primaryAction={{
        disabled: Boolean(formError),
        label: '保存申报结果',
        testId: 'finance-tax-declaration-result-save',
        onClick: () => !formError && onSave(record, {
          declarationDate,
          declarationFormFiles,
          declarationResultFile,
          declarationVerificationNote,
          declarationVerificationStatus,
          declarationStatus,
          differenceReason,
          settlementAmount: normalizedAmount,
          settlementDirection: normalizedDirection,
          taxAuthorityAssessmentVoucherNo,
          taxAuthorityDeclarationNo,
          vatBreakdown: isVatMatter ? normalizedVatBreakdown : undefined
        })
      }}
      title={<DetailDrawerTitle status="待登记" statusTone="blue" subtitle={`${record.matterNo} / 第 ${record.declarationVersion} 版`} title="登记申报结果" />}
      width={820}
      onClose={onClose}
    >
      <DetailSection icon={<FileSearchOutlined />} title="申报事项">
        <DetailInfoGrid columns={3} items={[
          { label: '税种', value: record.matterType },
          { label: '所属期间', value: record.period },
          {
            label: '准备结果',
            value: `${preparedDirection} ${formatMoney(preparedAmount)}`
          }
        ]} />
      </DetailSection>
      <DetailSection icon={<FileProtectOutlined />} title="申报结果">
        <DrawerFormGrid>
          <DrawerFormField label="申报结果" required>
            <Select options={[{ label: '申报成功', value: '申报成功' }, { label: '零申报', value: '零申报' }]} value={declarationStatus} onChange={setDeclarationStatus} />
          </DrawerFormField>
          <DrawerFormField label="实际申报日期" required>
            <DatePicker inputReadOnly style={{ width: '100%' }} value={dayjs(declarationDate)} onChange={(value) => setDeclarationDate(value?.format('YYYY-MM-DD') ?? '')} />
          </DrawerFormField>
          {declarationStatus !== '零申报' && !isVatMatter ? (
            <DrawerFormField label="补退方向" required>
              <Select options={record.matterType === '个人所得税'
                ? [{ label: '应缴', value: '应缴' }, { label: '无需补退', value: '无需补退' }]
                : [
                    { label: '应缴', value: '应缴' },
                    { label: '无需补退', value: '无需补退' },
                    { label: '应退', value: '应退' }
                  ]} value={settlementDirection} onChange={setSettlementDirection} />
            </DrawerFormField>
          ) : null}
          {!isVatMatter ? (
            <DrawerFormField label={record.declarationVersion > 1 ? '本次更正补退金额' : '申报补退金额'} required>
              <InputNumber disabled={declarationStatus === '零申报' || settlementDirection === '无需补退'} min={0} precision={2} style={{ width: '100%' }} value={normalizedAmount} onChange={(value) => setSettlementAmount(Number(value ?? 0))} />
            </DrawerFormField>
          ) : null}
        </DrawerFormGrid>
        {isVatMatter && declarationStatus !== '零申报' ? (
          <DrawerFormGrid>
            <DrawerFormField label="增值税" required>
              <InputNumber min={0} precision={2} style={{ width: '100%' }} value={vatBreakdown.declaredVatAmount} onChange={(value) => setVatBreakdown((current) => ({ ...current, declaredVatAmount: Number(value ?? 0) }))} />
            </DrawerFormField>
            <DrawerFormField label="城市维护建设税" required>
              <InputNumber min={0} precision={2} style={{ width: '100%' }} value={vatBreakdown.urbanMaintenanceTaxAmount} onChange={(value) => setVatBreakdown((current) => ({ ...current, urbanMaintenanceTaxAmount: Number(value ?? 0) }))} />
            </DrawerFormField>
            <DrawerFormField label="教育费附加" required>
              <InputNumber min={0} precision={2} style={{ width: '100%' }} value={vatBreakdown.educationSurchargeAmount} onChange={(value) => setVatBreakdown((current) => ({ ...current, educationSurchargeAmount: Number(value ?? 0) }))} />
            </DrawerFormField>
            <DrawerFormField label="地方教育附加" required>
              <InputNumber min={0} precision={2} style={{ width: '100%' }} value={vatBreakdown.localEducationSurchargeAmount} onChange={(value) => setVatBreakdown((current) => ({ ...current, localEducationSurchargeAmount: Number(value ?? 0) }))} />
            </DrawerFormField>
            <DrawerFormField label="合计">
              <InputNumber disabled precision={2} style={{ width: '100%' }} value={vatVersionSettlement?.officialTotalAmount ?? 0} />
            </DrawerFormField>
            {record.declarationVersion > 1 ? (
              <DrawerFormField label="本次更正结果">
                <Input disabled value={`${normalizedDirection} ${formatMoney(normalizedAmount)}`} />
              </DrawerFormField>
            ) : null}
          </DrawerFormGrid>
        ) : null}
        {hasAmountDifference ? (
          <DrawerFormField label="差异说明" required>
            <Input.TextArea rows={3} value={differenceReason} onChange={(event) => setDifferenceReason(event.target.value)} />
          </DrawerFormField>
        ) : null}
      </DetailSection>
      <DeclarationEvidenceEditor
        assessmentVoucherNo={taxAuthorityAssessmentVoucherNo}
        declarationNo={taxAuthorityDeclarationNo}
        formFiles={declarationFormFiles}
        resultFile={declarationResultFile}
        verificationNote={declarationVerificationNote}
        verificationStatus={declarationVerificationStatus}
        onAssessmentVoucherNoChange={setTaxAuthorityAssessmentVoucherNo}
        onDeclarationNoChange={setTaxAuthorityDeclarationNo}
        onFormFilesChange={setDeclarationFormFiles}
        onResultFileChange={setDeclarationResultFile}
        onVerificationNoteChange={setDeclarationVerificationNote}
        onVerificationStatusChange={setDeclarationVerificationStatus}
      />
    </DrawerShell>
  );
}

export function TaxDeclarationEvidenceDrawer({ onClose, onSave, record }: CommonDrawerProps & {
  onSave: (record: FinanceTaxMatterRecord, input: TaxMatterDeclarationEvidenceInput) => void;
}) {
  const [taxAuthorityDeclarationNo, setTaxAuthorityDeclarationNo] = useState('');
  const [taxAuthorityAssessmentVoucherNo, setTaxAuthorityAssessmentVoucherNo] = useState('');
  const [declarationFormFiles, setDeclarationFormFiles] = useState<RelatedFileRecord[]>([]);
  const [declarationResultFile, setDeclarationResultFile] = useState<RelatedFileRecord>();
  const [declarationVerificationStatus, setDeclarationVerificationStatus] = useState<FinanceTaxDeclarationVerificationStatus>('未核验');
  const [declarationVerificationNote, setDeclarationVerificationNote] = useState('');

  useEffect(() => {
    if (!record) return;
    setTaxAuthorityDeclarationNo(record.taxAuthorityDeclarationNo ?? '');
    setTaxAuthorityAssessmentVoucherNo(record.taxAuthorityAssessmentVoucherNo ?? '');
    setDeclarationFormFiles(record.files.filter((file) => record.declarationFormFileIds.includes(file.id)));
    setDeclarationResultFile(record.declarationResultFileId
      ? record.files.find((file) => file.id === record.declarationResultFileId)
      : undefined);
    setDeclarationVerificationStatus(record.declarationVerificationStatus);
    setDeclarationVerificationNote(record.declarationVerificationNote ?? '');
  }, [record]);

  if (!record) return null;
  const originalFormFileIds = [...record.declarationFormFileIds].sort().join(',');
  const currentFormFileIds = declarationFormFiles.map((file) => file.id).sort().join(',');
  const hasEvidence = declarationFormFiles.length > 0 || Boolean(
    declarationResultFile
      || taxAuthorityDeclarationNo.trim()
      || taxAuthorityAssessmentVoucherNo.trim()
  );
  const hasCompleteDeclarationMaterials = declarationFormFiles.length > 0 && Boolean(declarationResultFile);
  const hasChanged = currentFormFileIds !== originalFormFileIds
    || declarationResultFile?.id !== record.declarationResultFileId
    || taxAuthorityDeclarationNo.trim() !== (record.taxAuthorityDeclarationNo ?? '')
    || taxAuthorityAssessmentVoucherNo.trim() !== (record.taxAuthorityAssessmentVoucherNo ?? '')
    || declarationVerificationStatus !== record.declarationVerificationStatus
    || declarationVerificationNote.trim() !== (record.declarationVerificationNote ?? '');
  const formError = !hasEvidence
    ? '请补充申报材料或税务机关申报序号'
    : declarationVerificationStatus === '人工核验一致' && !hasCompleteDeclarationMaterials
      ? '正式申报表和申报结果回执齐全后才能标记核验一致'
      : declarationVerificationStatus === '核验不一致' && !declarationVerificationNote.trim()
        ? '请填写核验不一致原因'
        : undefined;

  return (
    <DrawerShell
      bodyTestId="finance-tax-declaration-evidence-drawer"
      cancelAction={{ label: '取消', onClick: onClose }}
      className="finance-tax-drawer"
      contentLayout="detail"
      open
      primaryAction={{
        disabled: Boolean(formError) || !hasChanged,
        label: '保存申报材料',
        testId: 'finance-tax-declaration-evidence-save',
        onClick: () => !formError && hasChanged && onSave(record, {
          declarationFormFiles,
          declarationResultFile,
          declarationVerificationNote,
          declarationVerificationStatus,
          taxAuthorityAssessmentVoucherNo,
          taxAuthorityDeclarationNo
        })
      }}
      title={<DetailDrawerTitle
        status={record.declarationVerificationStatus}
        statusTone={record.declarationVerificationStatus === '核验不一致' ? 'red' : 'amber'}
        subtitle={`${record.matterNo} / 第 ${record.declarationVersion} 版`}
        title="维护申报材料"
      />}
      width={820}
      onClose={onClose}
    >
      <DetailSection icon={<FileSearchOutlined />} title="申报结果">
        <DetailInfoGrid columns={3} items={[
          { label: '申报结果', value: record.declarationStatus },
          { label: '实际申报日期', value: record.declarationDate ?? '-' },
          { label: '补退方向', value: getTaxMatterSettlementDirection(record) },
          { label: '办理金额', value: formatMoney(getTaxMatterSettlementDirection(record) === '应退' ? record.refundableAmount ?? 0 : record.payableAmount) }
        ]} />
      </DetailSection>
      <DeclarationEvidenceEditor
        assessmentVoucherNo={taxAuthorityAssessmentVoucherNo}
        declarationNo={taxAuthorityDeclarationNo}
        formFiles={declarationFormFiles}
        resultFile={declarationResultFile}
        verificationNote={declarationVerificationNote}
        verificationStatus={declarationVerificationStatus}
        onAssessmentVoucherNoChange={setTaxAuthorityAssessmentVoucherNo}
        onDeclarationNoChange={setTaxAuthorityDeclarationNo}
        onFormFilesChange={setDeclarationFormFiles}
        onResultFileChange={setDeclarationResultFile}
        onVerificationNoteChange={setDeclarationVerificationNote}
        onVerificationStatusChange={setDeclarationVerificationStatus}
      />
    </DrawerShell>
  );
}

export function TaxPaymentResultDrawer({ accountOptions, defaultAccountId, onClose, onSave, record }: CommonDrawerProps & {
  accountOptions: Array<{ label: string; value: string }>;
  defaultAccountId?: string;
  onSave: (record: FinanceTaxMatterRecord, input: TaxMatterPaymentResultInput) => void;
}) {
  const [amount, setAmount] = useState(0);
  const [publicAccountId, setPublicAccountId] = useState<string>();
  const [paymentDate, setPaymentDate] = useState(financeToday);
  const [receiptFile, setReceiptFile] = useState<RelatedFileRecord>();

  useEffect(() => {
    if (!record) return;
    setAmount(getTaxMatterOutstandingAmount(record));
    setPublicAccountId(defaultAccountId);
    setPaymentDate(financeToday);
    setReceiptFile(undefined);
  }, [defaultAccountId, record]);

  if (!record) return null;
  const outstandingAmount = getTaxMatterOutstandingAmount(record);
  const currentVersionPaidAmount = getTaxMatterCurrentVersionPaidAmount(record);
  const formError = amount <= 0
    ? '缴款金额必须大于 0'
    : amount - outstandingAmount > 0.01
      ? '缴款金额不能超过待缴金额'
      : !paymentDate ? '请选择实际缴款日期' : !receiptFile ? '请上传缴款回单'
        : !publicAccountId ? '请选择付款账户' : undefined;

  return (
    <DrawerShell
      bodyTestId="finance-tax-payment-result-drawer"
      cancelAction={{ label: '取消', onClick: onClose }}
      className="finance-tax-drawer"
      contentLayout="detail"
      open
      primaryAction={{
        disabled: Boolean(formError),
        label: '登记缴款',
        testId: 'finance-tax-payment-result-save',
        onClick: () => receiptFile && publicAccountId && !formError && onSave(record, { amount, paymentDate, publicAccountId, receiptFile })
      }}
      title={<DetailDrawerTitle status={currentVersionPaidAmount > 0 ? '部分缴纳' : '待缴款'} statusTone={currentVersionPaidAmount > 0 ? 'blue' : 'amber'} subtitle={`${record.matterNo} / ${record.period}`} title="登记缴款" />}
      width={760}
      onClose={onClose}
    >
      <DetailSection icon={<WalletOutlined />} title="缴款信息">
        <DetailInfoGrid columns={3} items={[
          { label: '本版应缴', value: formatMoney(record.payableAmount) },
          { label: '本版已缴', value: formatMoney(currentVersionPaidAmount) },
          { label: '待缴金额', value: formatMoney(outstandingAmount) }
        ]} />
        <DrawerFormGrid>
          <DrawerFormField label="实际缴款日期" required>
            <DatePicker inputReadOnly style={{ width: '100%' }} value={dayjs(paymentDate)} onChange={(value) => setPaymentDate(value?.format('YYYY-MM-DD') ?? '')} />
          </DrawerFormField>
          <DrawerFormField label="本次缴款金额" required>
            <InputNumber max={outstandingAmount} min={0} precision={2} style={{ width: '100%' }} value={amount} onChange={(value) => setAmount(Number(value ?? 0))} />
          </DrawerFormField>
          <DrawerFormField label="付款账户" required>
            <Select options={accountOptions} placeholder="选择实际付款账户" value={publicAccountId} onChange={setPublicAccountId} />
          </DrawerFormField>
        </DrawerFormGrid>
      </DetailSection>
      <ReceiptUploadSection file={receiptFile} title="缴款回单" onChange={setReceiptFile} />
    </DrawerShell>
  );
}

export function TaxRefundResultDrawer({ accountOptions, defaultAccountId, onClose, onSave, record }: CommonDrawerProps & {
  accountOptions: Array<{ label: string; value: string }>;
  defaultAccountId?: string;
  onSave: (record: FinanceTaxMatterRecord, input: TaxMatterRefundResultInput) => void;
}) {
  const [amount, setAmount] = useState(0);
  const [publicAccountId, setPublicAccountId] = useState<string>();
  const [refundDate, setRefundDate] = useState(financeToday);
  const [receiptFile, setReceiptFile] = useState<RelatedFileRecord>();

  useEffect(() => {
    if (!record) return;
    setAmount(getTaxMatterRefundOutstandingAmount(record));
    setPublicAccountId(defaultAccountId);
    setRefundDate(financeToday);
    setReceiptFile(undefined);
  }, [defaultAccountId, record]);

  if (!record) return null;
  const outstandingAmount = getTaxMatterRefundOutstandingAmount(record);
  const currentVersionRefundedAmount = getTaxMatterCurrentVersionRefundedAmount(record);
  const formError = amount <= 0
    ? '退税金额必须大于 0'
    : amount - outstandingAmount > 0.01
      ? '退税金额不能超过待退金额'
      : !refundDate ? '请选择实际到账日期' : !publicAccountId ? '请选择到账账户' : !receiptFile ? '请上传退税回单' : undefined;

  return (
    <DrawerShell
      bodyTestId="finance-tax-refund-result-drawer"
      cancelAction={{ label: '取消', onClick: onClose }}
      className="finance-tax-drawer"
      contentLayout="detail"
      open
      primaryAction={{
        disabled: Boolean(formError),
        label: '登记退税到账',
        testId: 'finance-tax-refund-result-save',
        onClick: () => receiptFile && publicAccountId && !formError && onSave(record, { amount, publicAccountId, receiptFile, refundDate })
      }}
      title={<DetailDrawerTitle status={(record.refundedAmount ?? 0) > (record.refundBaselineAmount ?? 0) ? '部分到账' : '处理中'} statusTone="blue" subtitle={`${record.matterNo} / ${record.period}`} title="登记退税到账" />}
      width={760}
      onClose={onClose}
    >
      <DetailSection icon={<WalletOutlined />} title="退税信息">
        <DetailInfoGrid columns={4} items={[
          { label: '本版应退', value: formatMoney(record.refundableAmount ?? 0) },
          { label: '本版已退', value: formatMoney(currentVersionRefundedAmount) },
          { label: '待退金额', value: formatMoney(outstandingAmount) }
        ]} />
        <DrawerFormGrid>
          <DrawerFormField label="实际到账日期" required>
            <DatePicker inputReadOnly style={{ width: '100%' }} value={dayjs(refundDate)} onChange={(value) => setRefundDate(value?.format('YYYY-MM-DD') ?? '')} />
          </DrawerFormField>
          <DrawerFormField label="本次退税金额" required>
            <InputNumber max={outstandingAmount} min={0} precision={2} style={{ width: '100%' }} value={amount} onChange={(value) => setAmount(Number(value ?? 0))} />
          </DrawerFormField>
          <DrawerFormField label="到账账户" required>
            <Select options={accountOptions} placeholder="选择实际到账账户" value={publicAccountId} onChange={setPublicAccountId} />
          </DrawerFormField>
        </DrawerFormGrid>
      </DetailSection>
      <ReceiptUploadSection file={receiptFile} title="退税回单" onChange={setReceiptFile} />
    </DrawerShell>
  );
}

export function TaxRefundApplicationDrawer({ offsetCandidates, onClose, onSave, record }: CommonDrawerProps & {
  offsetCandidates: FinanceTaxMatterRecord[];
  onSave: (record: FinanceTaxMatterRecord, input: TaxMatterRefundApplicationInput) => void;
}) {
  const [applicationDate, setApplicationDate] = useState(financeToday);
  const [method, setMethod] = useState<TaxMatterRefundApplicationInput['method']>('退税');
  const [receiptFile, setReceiptFile] = useState<RelatedFileRecord>();
  const [receiptNo, setReceiptNo] = useState('');
  const [targetMatterId, setTargetMatterId] = useState<string>();

  useEffect(() => {
    setApplicationDate(financeToday);
    setMethod('退税');
    setReceiptFile(undefined);
    setReceiptNo('');
    setTargetMatterId(undefined);
  }, [record]);

  if (!record) return null;
  const outstandingAmount = getTaxMatterRefundOutstandingAmount(record);
  const formError = !applicationDate
    ? '请选择申请日期'
    : method === '抵缴' && !targetMatterId
      ? '请选择抵缴事项'
      : !receiptFile && !receiptNo.trim()
        ? '请上传退抵申请回执或填写回执号'
        : undefined;

  return (
    <DrawerShell
      bodyTestId="finance-tax-refund-application-drawer"
      cancelAction={{ label: '取消', onClick: onClose }}
      className="finance-tax-drawer"
      contentLayout="detail"
      open
      primaryAction={{
        disabled: Boolean(formError),
        label: `保存${method}申请`,
        testId: 'finance-tax-refund-application-save',
        onClick: () => !formError && onSave(record, { applicationDate, method, receiptFile, receiptNo, targetMatterId })
      }}
      title={<DetailDrawerTitle status="待处理" statusTone="amber" subtitle={`${record.matterNo} / ${record.period}`} title="登记多缴税款处理" />}
      width={760}
      onClose={onClose}
    >
      <DetailSection icon={<WalletOutlined />} title="处理申请">
        <DetailInfoGrid columns={3} items={[
          { label: '本版多缴', value: formatMoney(record.refundableAmount ?? 0) },
          { label: '已处理', value: formatMoney(getTaxMatterCurrentVersionRefundedAmount(record) + getTaxMatterCurrentVersionOffsetAmount(record)) },
          { label: '待处理', value: formatMoney(outstandingAmount) }
        ]} />
        <DrawerFormGrid>
          <DrawerFormField label="处理方式" required>
            <Select options={[{ label: '申请退税', value: '退税' }, { label: '抵缴后续税款', value: '抵缴' }]} value={method} onChange={(value) => {
              setMethod(value);
              setTargetMatterId(undefined);
            }} />
          </DrawerFormField>
          <DrawerFormField label="申请日期" required>
            <DatePicker inputReadOnly style={{ width: '100%' }} value={dayjs(applicationDate)} onChange={(value) => setApplicationDate(value?.format('YYYY-MM-DD') ?? '')} />
          </DrawerFormField>
          {method === '抵缴' ? (
            <DrawerFormField label="抵缴事项" required>
              <Select
                options={offsetCandidates.map((candidate) => ({
                  label: `${candidate.matterNo} / ${candidate.period} / 待缴 ${formatMoney(getTaxMatterOutstandingAmount(candidate))}`,
                  value: candidate.id
                }))}
                placeholder="选择同税种待缴事项"
                value={targetMatterId}
                onChange={setTargetMatterId}
              />
            </DrawerFormField>
          ) : null}
          <DrawerFormField label="申请回执号">
            <Input value={receiptNo} onChange={(event) => setReceiptNo(event.target.value)} />
          </DrawerFormField>
        </DrawerFormGrid>
      </DetailSection>
      <ReceiptUploadSection file={receiptFile} title="退抵申请回执" onChange={setReceiptFile} />
    </DrawerShell>
  );
}

export function TaxOffsetResultDrawer({ onClose, onSave, record, targetRecord }: CommonDrawerProps & {
  onSave: (record: FinanceTaxMatterRecord, targetRecord: FinanceTaxMatterRecord, input: TaxMatterOffsetResultInput) => void;
  targetRecord?: FinanceTaxMatterRecord;
}) {
  const [amount, setAmount] = useState(0);
  const [offsetDate, setOffsetDate] = useState(financeToday);
  const [receiptFile, setReceiptFile] = useState<RelatedFileRecord>();
  const [receiptNo, setReceiptNo] = useState('');

  useEffect(() => {
    if (!record || !targetRecord) return;
    setAmount(Math.min(getTaxMatterRefundOutstandingAmount(record), getTaxMatterOutstandingAmount(targetRecord)));
    setOffsetDate(financeToday);
    setReceiptFile(undefined);
    setReceiptNo('');
  }, [record, targetRecord]);

  if (!record || !targetRecord) return null;
  const maximumAmount = Math.min(getTaxMatterRefundOutstandingAmount(record), getTaxMatterOutstandingAmount(targetRecord));
  const formError = amount <= 0
    ? '抵缴金额必须大于 0'
    : amount - maximumAmount > 0.01
      ? '抵缴金额不能超过双方待处理金额'
      : !offsetDate
        ? '请选择抵缴确认日期'
        : !receiptFile && !receiptNo.trim()
          ? '请上传抵缴确认单或填写凭证号'
          : undefined;

  return (
    <DrawerShell
      bodyTestId="finance-tax-offset-result-drawer"
      cancelAction={{ label: '取消', onClick: onClose }}
      className="finance-tax-drawer"
      contentLayout="detail"
      open
      primaryAction={{
        disabled: Boolean(formError),
        label: '保存抵缴结果',
        testId: 'finance-tax-offset-result-save',
        onClick: () => !formError && onSave(record, targetRecord, { amount, offsetDate, receiptFile, receiptNo })
      }}
      title={<DetailDrawerTitle status="处理中" statusTone="blue" subtitle={`${record.matterNo} / ${record.period}`} title="登记抵缴结果" />}
      width={760}
      onClose={onClose}
    >
      <DetailSection icon={<WalletOutlined />} title="抵缴信息">
        <DetailInfoGrid columns={3} items={[
          { label: '多缴事项', value: record.matterNo },
          { label: '抵缴事项', value: targetRecord.matterNo },
          { label: '可抵缴金额', value: formatMoney(maximumAmount) }
        ]} />
        <DrawerFormGrid>
          <DrawerFormField label="确认日期" required>
            <DatePicker inputReadOnly style={{ width: '100%' }} value={dayjs(offsetDate)} onChange={(value) => setOffsetDate(value?.format('YYYY-MM-DD') ?? '')} />
          </DrawerFormField>
          <DrawerFormField label="抵缴金额" required>
            <InputNumber min={0} precision={2} style={{ width: '100%' }} value={amount} onChange={(value) => setAmount(Number(value ?? 0))} />
          </DrawerFormField>
          <DrawerFormField label="确认凭证号">
            <Input value={receiptNo} onChange={(event) => setReceiptNo(event.target.value)} />
          </DrawerFormField>
        </DrawerFormGrid>
      </DetailSection>
      <ReceiptUploadSection file={receiptFile} title="抵缴确认单" onChange={setReceiptFile} />
    </DrawerShell>
  );
}

export function TaxDeclarationRevisionDrawer({ canVoid, onClose, onSave, record }: CommonDrawerProps & {
  canVoid: boolean;
  onSave: (record: FinanceTaxMatterRecord, action: '更正' | '作废', reason: string) => void;
}) {
  const [action, setAction] = useState<'更正' | '作废'>('更正');
  const [reason, setReason] = useState('');

  useEffect(() => {
    setAction('更正');
    setReason('');
  }, [record]);

  if (!record) return null;
  return (
    <DrawerShell
      bodyTestId="finance-tax-revision-drawer"
      cancelAction={{ label: '取消', onClick: onClose }}
      className="finance-tax-drawer"
      contentLayout="detail"
      open
      primaryAction={{
        disabled: !reason.trim(),
        label: action === '更正' ? '发起更正' : '确认作废',
        testId: 'finance-tax-revision-save',
        onClick: () => onSave(record, action, reason)
      }}
      title={<DetailDrawerTitle status={`第 ${record.declarationVersion} 版`} statusTone="amber" subtitle={`${record.matterNo} / ${record.period}`} title="调整申报" />}
      width={720}
      onClose={onClose}
    >
      <DetailSection icon={<FileProtectOutlined />} title="当前申报">
        <DetailInfoGrid columns={3} items={[
          { label: '申报结果', value: record.declarationStatus },
          {
            label: getTaxMatterSettlementDirection(record) === '应退' ? '本版应退' : '本版应缴',
            value: formatMoney(getTaxMatterSettlementDirection(record) === '应退'
              ? record.refundableAmount ?? 0
              : record.payableAmount)
          },
          { label: '累计已缴', value: formatMoney(record.paidAmount) }
        ]} />
      </DetailSection>
      <DetailSection icon={<AuditOutlined />} title="调整内容">
        <DrawerFormGrid>
          <DrawerFormField label="调整方式" required>
            <Select options={[
              { label: '更正申报', value: '更正' },
              ...(canVoid ? [{ label: '作废申报', value: '作废' as const }] : [])
            ]} value={action} onChange={setAction} />
          </DrawerFormField>
        </DrawerFormGrid>
        <DrawerFormField label="调整原因" required>
          <Input.TextArea rows={4} value={reason} onChange={(event) => setReason(event.target.value)} />
        </DrawerFormField>
      </DetailSection>
    </DrawerShell>
  );
}

function ReceiptUploadSection({
  file,
  onChange,
  title
}: {
  file?: RelatedFileRecord;
  onChange: (file: RelatedFileRecord | undefined) => void;
  title: TaxMatterReceiptFileType;
}) {
  return (
    <DetailSection icon={<FileProtectOutlined />} title={title}>
      <FinanceVoucherUploadPanel
        description=""
        emptyText={`暂无${title}`}
        files={file ? [file] : []}
        title={title}
        onRemove={() => onChange(undefined)}
        onSelect={(selectedFile) => onChange(buildTaxMatterReceiptFile(selectedFile, title))}
      />
    </DetailSection>
  );
}

function DeclarationEvidenceEditor({
  assessmentVoucherNo,
  declarationNo,
  formFiles,
  onAssessmentVoucherNoChange,
  onDeclarationNoChange,
  onFormFilesChange,
  onResultFileChange,
  onVerificationNoteChange,
  onVerificationStatusChange,
  resultFile,
  verificationNote,
  verificationStatus
}: {
  assessmentVoucherNo: string;
  declarationNo: string;
  formFiles: RelatedFileRecord[];
  onAssessmentVoucherNoChange: (value: string) => void;
  onDeclarationNoChange: (value: string) => void;
  onFormFilesChange: (files: RelatedFileRecord[]) => void;
  onResultFileChange: (file: RelatedFileRecord | undefined) => void;
  onVerificationNoteChange: (value: string) => void;
  onVerificationStatusChange: (status: FinanceTaxDeclarationVerificationStatus) => void;
  resultFile?: RelatedFileRecord;
  verificationNote: string;
  verificationStatus: FinanceTaxDeclarationVerificationStatus;
}) {
  const addFormFile = (selectedFile: FinanceVoucherUploadFile) => {
    const nextFile = buildTaxMatterReceiptFile(selectedFile, '正式申报表');
    onFormFilesChange([nextFile, ...formFiles.filter((file) => file.id !== nextFile.id)]);
  };

  return (
    <DetailSection icon={<FileProtectOutlined />} title="申报材料与核验">
      <DrawerFormGrid>
        <DrawerFormField label="税务机关申报序号">
          <Input value={declarationNo} onChange={(event) => onDeclarationNoChange(event.target.value)} />
        </DrawerFormField>
        <DrawerFormField label="应征凭证序号">
          <Input value={assessmentVoucherNo} onChange={(event) => onAssessmentVoucherNoChange(event.target.value)} />
        </DrawerFormField>
        <DrawerFormField label="核验状态" required>
          <Select<FinanceTaxDeclarationVerificationStatus>
            options={[
              { label: '未核验', value: '未核验' },
              { label: '人工核验一致', value: '人工核验一致' },
              { label: '核验不一致', value: '核验不一致' }
            ]}
            value={verificationStatus}
            onChange={onVerificationStatusChange}
          />
        </DrawerFormField>
      </DrawerFormGrid>
      {verificationStatus === '核验不一致' ? (
        <DrawerFormField label="不一致原因" required>
          <Input.TextArea rows={3} value={verificationNote} onChange={(event) => onVerificationNoteChange(event.target.value)} />
        </DrawerFormField>
      ) : null}
      <FinanceVoucherUploadPanel
        description=""
        emptyText="暂无正式申报表"
        files={formFiles}
        title="正式申报表"
        onRemove={(file) => onFormFilesChange(formFiles.filter((item) => item.id !== file.id))}
        onSelect={addFormFile}
      />
      <FinanceVoucherUploadPanel
        description=""
        emptyText="暂无申报结果回执"
        files={resultFile ? [resultFile] : []}
        title="申报结果回执"
        onRemove={() => onResultFileChange(undefined)}
        onSelect={(selectedFile) => onResultFileChange(buildTaxMatterReceiptFile(selectedFile, '申报结果回执'))}
      />
    </DetailSection>
  );
}
