import {
  AuditOutlined,
  CalendarOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  WalletOutlined
} from '@ant-design/icons';
import { DatePicker, Input, InputNumber, Select } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, ReadOnlyField } from '../../components/Detail';
import { DrawerFormField, DrawerFormGrid } from '../../components/DrawerForm';
import { DrawerShell } from '../../components/DrawerShell';
import type { RelatedFileRecord } from '../../components/RelatedFileTable';
import { FinanceVoucherUploadPanel, type FinanceVoucherUploadFile } from './FinanceVoucherUploadPanel';
import type { FinanceTaxMatterRecord } from './financeTaxFilingData';
import {
  buildTaxMatterNo,
  buildTaxMatterReceiptFile,
  buildTaxMatterRecord,
  defaultTaxMatterFormValue,
  getTaxMatterFormError,
  getTaxMatterFormValue,
  getTaxMatterProcessStatusLabel,
  isSocialInsuranceTaxMatterType,
  taxMatterOfficialHandlingEntries,
  type TaxMatterFormValue
} from './financeTaxMatterHandlingModel';
import {
  getMissingTaxMatterReceiptTypes,
  getTaxMatterCurrentVersionOffsetAmount,
  getTaxMatterCurrentVersionPaidAmount,
  getTaxMatterCurrentVersionRefundedAmount,
  getTaxMatterDeclarationResultValidationError,
  getTaxMatterOutstandingAmount,
  getTaxMatterRefundOutstandingAmount,
  getTaxMatterRequiredReceiptTypes,
  getTaxMatterSettlementDirection,
  getVatDeclarationVersionSettlement,
  type TaxMatterDeclarationReceiptInput,
  type TaxMatterDeclarationResultInput,
  type TaxMatterPaymentResultInput,
  type TaxMatterOffsetResultInput,
  type TaxMatterRefundApplicationInput,
  type TaxMatterRefundResultInput,
  type TaxMatterReceiptFileType
} from './financeTaxMatterModel';
import { taxMatterProcessStatusTone } from './financeTaxFilingData';
import { financeToday, formatMoney } from './financeUtils';

type CommonDrawerProps = {
  onClose: () => void;
  record?: FinanceTaxMatterRecord;
};

export function TaxMatterReceiptDrawer({
  allRecords,
  onClose,
  onSave,
  record
}: CommonDrawerProps & {
  allRecords: FinanceTaxMatterRecord[];
  onSave: (record: FinanceTaxMatterRecord) => void;
}) {
  const [formValue, setFormValue] = useState<TaxMatterFormValue>(defaultTaxMatterFormValue);
  const [formFiles, setFormFiles] = useState<FinanceTaxMatterRecord['files']>([]);

  useEffect(() => {
    setFormValue(getTaxMatterFormValue(record));
    setFormFiles(record?.files ?? []);
  }, [record]);

  if (!record) return null;

  const matterNo = record.matterNo ?? buildTaxMatterNo(formValue, allRecords, record.id);
  const officialEntry = taxMatterOfficialHandlingEntries[formValue.matterType];
  const isSocialInsuranceMatter = isSocialInsuranceTaxMatterType(formValue.matterType);
  const moduleScope = isSocialInsuranceMatter ? 'social' : 'tax';
  const requiredReceiptTypes = getTaxMatterRequiredReceiptTypes(formValue);
  const missingReceiptTypes = getMissingTaxMatterReceiptTypes(formFiles, requiredReceiptTypes);
  const processStatus = missingReceiptTypes.length === 0 ? '已完成' : '待补回执';
  const formError = missingReceiptTypes.length > 0
    ? `请上传${missingReceiptTypes.join('、')}`
    : getTaxMatterFormError(formValue);

  function handleReceiptFileSelect(receiptType: TaxMatterReceiptFileType, file: FinanceVoucherUploadFile) {
    setFormFiles((currentFiles) => [
      buildTaxMatterReceiptFile(file, receiptType),
      ...currentFiles.filter((currentFile) => currentFile.type !== receiptType)
    ]);
  }

  return (
    <DrawerShell
      bodyTestId="finance-tax-process-drawer"
      cancelAction={{ label: '取消', onClick: onClose }}
      className="finance-tax-drawer"
      contentLayout="detail"
      open
      primaryAction={{
        disabled: Boolean(formError),
        label: isSocialInsuranceMatter ? '保存凭证' : '保存回执',
        testId: 'finance-tax-process-save',
        onClick: () => !formError && onSave(buildTaxMatterRecord(formValue, allRecords, record, formFiles))
      }}
      title={
        <DetailDrawerTitle
          status={getTaxMatterProcessStatusLabel(processStatus, moduleScope)}
          statusTone={taxMatterProcessStatusTone[processStatus]}
          subtitle={matterNo}
          title={isSocialInsuranceMatter ? '上传凭证' : '上传回执'}
        />
      }
      width={820}
      onClose={onClose}
    >
      <DetailSection icon={<FileSearchOutlined />} title={isSocialInsuranceMatter ? '缴费信息' : '办理信息'}>
        <div className="drawer-form-grid">
          <ReadOnlyField label={isSocialInsuranceMatter ? '缴费编号' : '事项编号'} testId="finance-tax-process-no" value={matterNo} />
          <ReadOnlyField label="所属期间" value={formValue.period} />
          <ReadOnlyField label="办理平台" value={officialEntry.platform} />
        </div>
      </DetailSection>
      <DetailSection icon={<CalendarOutlined />} title={isSocialInsuranceMatter ? '缴费日期' : '办理日期'}>
        <DrawerFormGrid>
          {!isSocialInsuranceMatter ? (
            <DrawerFormField label="实际申报日期" required>
              <DatePicker
                inputReadOnly
                style={{ width: '100%' }}
                value={formValue.declarationDate ? dayjs(formValue.declarationDate) : undefined}
                onChange={(value) => setFormValue((current) => ({ ...current, declarationDate: value?.format('YYYY-MM-DD') ?? '' }))}
              />
            </DrawerFormField>
          ) : null}
          {formValue.payableAmount > 0 ? (
            <DrawerFormField label={isSocialInsuranceMatter ? '实际缴费日期' : '实际缴款日期'} required>
              <DatePicker
                inputReadOnly
                style={{ width: '100%' }}
                value={formValue.paymentDate ? dayjs(formValue.paymentDate) : undefined}
                onChange={(value) => setFormValue((current) => ({ ...current, paymentDate: value?.format('YYYY-MM-DD') ?? '' }))}
              />
            </DrawerFormField>
          ) : null}
        </DrawerFormGrid>
      </DetailSection>
      <DetailSection icon={<FileProtectOutlined />} title={isSocialInsuranceMatter ? '凭证文件' : '回执文件'}>
        <div className="detail-tab-stack">
          {requiredReceiptTypes.map((receiptType) => (
            <FinanceVoucherUploadPanel
              key={receiptType}
              description=""
              emptyText={`暂无${receiptType}`}
              files={formFiles.filter((file) => file.type === receiptType)}
              title={receiptType}
              onRemove={(file) => setFormFiles((files) => files.filter((item) => item.id !== file.id))}
              onSelect={(file) => handleReceiptFileSelect(receiptType, file)}
            />
          ))}
        </div>
      </DetailSection>
    </DrawerShell>
  );
}

export function TaxDeclarationResultDrawer({ onClose, onSave, record }: CommonDrawerProps & {
  onSave: (record: FinanceTaxMatterRecord, input: TaxMatterDeclarationResultInput) => void;
}) {
  const [declarationDate, setDeclarationDate] = useState(financeToday);
  const [declarationStatus, setDeclarationStatus] = useState<TaxMatterDeclarationResultInput['declarationStatus']>('申报成功');
  const [settlementAmount, setSettlementAmount] = useState(0);
  const [settlementDirection, setSettlementDirection] = useState<TaxMatterDeclarationResultInput['settlementDirection']>('应缴');
  const [receiptNo, setReceiptNo] = useState('');
  const [differenceReason, setDifferenceReason] = useState('');
  const [receiptFile, setReceiptFile] = useState<RelatedFileRecord>();
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
    setReceiptNo(record.declarationReceiptNo ?? '');
    setDifferenceReason(record.declarationDifferenceReason ?? '');
    setReceiptFile(record.declarationReceiptFileId
      ? record.files.find((file) => file.id === record.declarationReceiptFileId)
      : undefined);
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
    declarationStatus,
    settlementAmount: normalizedAmount,
    settlementDirection: normalizedDirection,
    vatBreakdown: isVatMatter ? normalizedVatBreakdown : undefined
  });
  const formError = !declarationDate
    ? '请选择实际申报日期'
    : normalizedAmount < 0
      ? '办理金额不能小于 0'
      : !receiptFile && !receiptNo.trim()
        ? '请上传申报回执或填写申报凭证号'
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
          declarationReceiptFile: receiptFile,
          declarationReceiptNo: receiptNo,
          declarationStatus,
          differenceReason,
          settlementAmount: normalizedAmount,
          settlementDirection: normalizedDirection,
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
          <DrawerFormField label="申报回执号">
            <Input value={receiptNo} onChange={(event) => setReceiptNo(event.target.value)} />
          </DrawerFormField>
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
      <ReceiptUploadSection file={receiptFile} title="申报回执" onChange={setReceiptFile} />
    </DrawerShell>
  );
}

export function TaxDeclarationReceiptDrawer({ onClose, onSave, record }: CommonDrawerProps & {
  onSave: (record: FinanceTaxMatterRecord, input: TaxMatterDeclarationReceiptInput) => void;
}) {
  const [receiptNo, setReceiptNo] = useState('');
  const [receiptFile, setReceiptFile] = useState<RelatedFileRecord>();

  useEffect(() => {
    if (!record) return;
    setReceiptNo(record.declarationReceiptNo ?? '');
    setReceiptFile(record.declarationReceiptFileId
      ? record.files.find((file) => file.id === record.declarationReceiptFileId)
      : undefined);
  }, [record]);

  if (!record) return null;
  const originalFile = record.declarationReceiptFileId
    ? record.files.find((file) => file.id === record.declarationReceiptFileId)
    : undefined;
  const hasEvidence = Boolean(receiptFile || receiptNo.trim());
  const hasChanged = receiptNo.trim() !== (record.declarationReceiptNo ?? '') || receiptFile?.id !== originalFile?.id;

  return (
    <DrawerShell
      bodyTestId="finance-tax-declaration-receipt-drawer"
      cancelAction={{ label: '取消', onClick: onClose }}
      className="finance-tax-drawer"
      contentLayout="detail"
      open
      primaryAction={{
        disabled: !hasEvidence || !hasChanged,
        label: '保存回执',
        testId: 'finance-tax-declaration-receipt-save',
        onClick: () => hasEvidence && hasChanged && onSave(record, { declarationReceiptFile: receiptFile, declarationReceiptNo: receiptNo })
      }}
      title={<DetailDrawerTitle status="待补回执" statusTone="amber" subtitle={`${record.matterNo} / 第 ${record.declarationVersion} 版`} title="补充申报回执" />}
      width={760}
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
      <DetailSection icon={<FileProtectOutlined />} title="申报回执">
        <DrawerFormField label="申报回执号">
          <Input value={receiptNo} onChange={(event) => setReceiptNo(event.target.value)} />
        </DrawerFormField>
        <FinanceVoucherUploadPanel
          description=""
          emptyText="暂无申报回执"
          files={receiptFile ? [receiptFile] : []}
          title="申报回执"
          onRemove={() => setReceiptFile(undefined)}
          onSelect={(file) => setReceiptFile(buildTaxMatterReceiptFile(file, '申报回执'))}
        />
      </DetailSection>
    </DrawerShell>
  );
}

export function TaxPaymentResultDrawer({ defaultAccountName, onClose, onSave, record }: CommonDrawerProps & {
  defaultAccountName: string;
  onSave: (record: FinanceTaxMatterRecord, input: TaxMatterPaymentResultInput) => void;
}) {
  const [amount, setAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState(financeToday);
  const [receiptFile, setReceiptFile] = useState<RelatedFileRecord>();

  useEffect(() => {
    if (!record) return;
    setAmount(getTaxMatterOutstandingAmount(record));
    setPaymentDate(financeToday);
    setReceiptFile(undefined);
  }, [record]);

  if (!record) return null;
  const outstandingAmount = getTaxMatterOutstandingAmount(record);
  const currentVersionPaidAmount = getTaxMatterCurrentVersionPaidAmount(record);
  const formError = amount <= 0
    ? '缴款金额必须大于 0'
    : amount - outstandingAmount > 0.01
      ? '缴款金额不能超过待缴金额'
      : !paymentDate ? '请选择实际缴款日期' : !receiptFile ? '请上传缴款回单'
        : defaultAccountName === '未配置默认付款账户' ? '请先配置默认付款账户' : undefined;

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
        onClick: () => receiptFile && !formError && onSave(record, { amount, paymentDate, receiptFile })
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
          <ReadOnlyField label="付款账户" value={defaultAccountName} />
        </DrawerFormGrid>
      </DetailSection>
      <ReceiptUploadSection file={receiptFile} title="缴款回单" onChange={setReceiptFile} />
    </DrawerShell>
  );
}

export function TaxRefundResultDrawer({ defaultAccountName, onClose, onSave, record }: CommonDrawerProps & {
  defaultAccountName: string;
  onSave: (record: FinanceTaxMatterRecord, input: TaxMatterRefundResultInput) => void;
}) {
  const [amount, setAmount] = useState(0);
  const [refundDate, setRefundDate] = useState(financeToday);
  const [receiptFile, setReceiptFile] = useState<RelatedFileRecord>();

  useEffect(() => {
    if (!record) return;
    setAmount(getTaxMatterRefundOutstandingAmount(record));
    setRefundDate(financeToday);
    setReceiptFile(undefined);
  }, [record]);

  if (!record) return null;
  const outstandingAmount = getTaxMatterRefundOutstandingAmount(record);
  const currentVersionRefundedAmount = getTaxMatterCurrentVersionRefundedAmount(record);
  const formError = amount <= 0
    ? '退税金额必须大于 0'
    : amount - outstandingAmount > 0.01
      ? '退税金额不能超过待退金额'
      : !refundDate ? '请选择实际到账日期' : !receiptFile ? '请上传退税回单' : undefined;

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
        onClick: () => receiptFile && !formError && onSave(record, { amount, receiptFile, refundDate })
      }}
      title={<DetailDrawerTitle status={(record.refundedAmount ?? 0) > (record.refundBaselineAmount ?? 0) ? '部分到账' : '处理中'} statusTone="blue" subtitle={`${record.matterNo} / ${record.period}`} title="登记退税到账" />}
      width={760}
      onClose={onClose}
    >
      <DetailSection icon={<WalletOutlined />} title="退税信息">
        <DetailInfoGrid columns={4} items={[
          { label: '本版应退', value: formatMoney(record.refundableAmount ?? 0) },
          { label: '本版已退', value: formatMoney(currentVersionRefundedAmount) },
          { label: '待退金额', value: formatMoney(outstandingAmount) },
          { label: '到账账户', value: defaultAccountName }
        ]} />
        <DrawerFormGrid>
          <DrawerFormField label="实际到账日期" required>
            <DatePicker inputReadOnly style={{ width: '100%' }} value={dayjs(refundDate)} onChange={(value) => setRefundDate(value?.format('YYYY-MM-DD') ?? '')} />
          </DrawerFormField>
          <DrawerFormField label="本次退税金额" required>
            <InputNumber max={outstandingAmount} min={0} precision={2} style={{ width: '100%' }} value={amount} onChange={(value) => setAmount(Number(value ?? 0))} />
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
