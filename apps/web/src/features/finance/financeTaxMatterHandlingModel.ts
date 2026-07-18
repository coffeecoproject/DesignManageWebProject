import type { FinanceVoucherUploadFile } from './FinanceVoucherUploadPanel';
import {
  type FinanceTaxMatterProcessStatus,
  type FinanceTaxMatterRecord,
  type FinanceTaxMatterSourceItem,
  type FinanceTaxMatterSourceStatus,
  type FinanceTaxMatterType
} from './financeTaxFilingData';
import {
  getMissingTaxMatterReceiptTypes,
  getSocialInsuranceCategoryByTaxMatterType,
  getTaxMatterRequiredReceiptTypes,
  hasTaxMatterRequiredReceiptFiles,
  type TaxMatterReceiptFileType
} from './financeTaxMatterModel';
import { financeToday } from './financeUtils';

export type TaxMatterModuleScope = 'tax' | 'social';
export type TaxMatterEditorMode =
  | 'social-receipt'
  | 'declaration-result'
  | 'declaration-evidence'
  | 'payment-result'
  | 'refund-application'
  | 'refund-result'
  | 'offset-result'
  | 'revision';

export type TaxMatterFormValue = Pick<
  FinanceTaxMatterRecord,
  | 'dataStatus'
  | 'declarationDate'
  | 'declarationDueDate'
  | 'declarationStatus'
  | 'matterType'
  | 'owner'
  | 'paidAmount'
  | 'participantSummary'
  | 'payableAmount'
  | 'paymentDate'
  | 'paymentDueDate'
  | 'paymentStatus'
  | 'period'
  | 'periodType'
>;

const currentPeriod = financeToday.slice(0, 7);

const taxMatterCodeMap: Record<FinanceTaxMatterType, string> = {
  个人所得税: 'IIT',
  社保缴纳: 'SOCIAL',
  公积金缴纳: 'HF',
  增值税及附加: 'VAT',
  企业所得税: 'CIT',
  印花税: 'STAMP',
  其他税费: 'OTHER'
};

const taxMatterSourceTemplates: Record<FinanceTaxMatterType, Array<Pick<FinanceTaxMatterSourceItem, 'name' | 'sourceModule'>>> = {
  个人所得税: [{ name: '办理依据', sourceModule: '申报准备' }],
  社保缴纳: [
    { name: '社保缴费明细', sourceModule: '社保公积金 / 缴费明细' },
    { name: '社保缴费核定单', sourceModule: '电子税务局' }
  ],
  公积金缴纳: [
    { name: '公积金缴费明细', sourceModule: '社保公积金 / 缴费明细' },
    { name: '公积金汇缴核定单', sourceModule: '公积金系统' }
  ],
  增值税及附加: [{ name: '办理依据', sourceModule: '申报准备' }],
  企业所得税: [{ name: '办理依据', sourceModule: '申报准备' }],
  印花税: [{ name: '办理依据', sourceModule: '申报准备' }],
  其他税费: [{ name: '税费事项资料', sourceModule: '财务管理' }]
};

export const taxMatterOfficialHandlingEntries: Record<
  FinanceTaxMatterType,
  { actionLabel: string; platform: string; url: string }
> = {
  个人所得税: { actionLabel: '去缴办', platform: '自然人电子税务局', url: 'https://etax.chinatax.gov.cn/' },
  社保缴纳: { actionLabel: '去缴办', platform: '湖北省电子税务局', url: 'https://etax.hubei.chinatax.gov.cn/' },
  公积金缴纳: {
    actionLabel: '去缴办',
    platform: '武汉住房公积金单位网上业务系统',
    url: 'https://rmb.pingan.com.cn/whgjj/logon_pro.jsp'
  },
  增值税及附加: { actionLabel: '去缴办', platform: '湖北省电子税务局', url: 'https://etax.hubei.chinatax.gov.cn/' },
  企业所得税: { actionLabel: '去缴办', platform: '湖北省电子税务局', url: 'https://etax.hubei.chinatax.gov.cn/' },
  印花税: { actionLabel: '去缴办', platform: '湖北省电子税务局', url: 'https://etax.hubei.chinatax.gov.cn/' },
  其他税费: { actionLabel: '去缴办', platform: '湖北省电子税务局', url: 'https://etax.hubei.chinatax.gov.cn/' }
};

export const defaultTaxMatterFormValue: TaxMatterFormValue = {
  dataStatus: '待准备',
  declarationDate: '',
  declarationDueDate: '2026-07-15',
  declarationStatus: '待申报',
  matterType: '个人所得税',
  owner: '李明',
  paidAmount: 0,
  participantSummary: '待确认',
  payableAmount: 0,
  paymentDate: '',
  paymentDueDate: '2026-07-15',
  paymentStatus: '未开始',
  period: currentPeriod,
  periodType: '月度'
};

export function getTaxMatterProcessStatusLabel(
  status: FinanceTaxMatterProcessStatus,
  moduleScope: TaxMatterModuleScope
) {
  if (moduleScope !== 'social') return status;
  if (status === '数据待确认') return '明细待确认';
  if (status === '待申报') return '可缴费';
  if (status === '待缴款') return '待缴费';
  if (status === '申报材料待核对') return '待上传凭证';
  return status;
}

export function isSocialInsuranceTaxMatterType(matterType: FinanceTaxMatterType) {
  return Boolean(getSocialInsuranceCategoryByTaxMatterType(matterType));
}

function formatTaxMatterPeriodCode(period: string) {
  return period.replace(/[^0-9A-Z]/gi, '');
}

function buildTaxMatterTitle(formValue: TaxMatterFormValue) {
  return `${formValue.period} ${formValue.matterType}`;
}

export function buildTaxMatterNo(
  formValue: TaxMatterFormValue,
  records: FinanceTaxMatterRecord[],
  currentRecordId?: string
) {
  const baseNo = `TAX-${formatTaxMatterPeriodCode(formValue.period)}-${taxMatterCodeMap[formValue.matterType]}`;
  let candidateNo = baseNo;
  let index = 2;

  while (records.some((record) => record.id !== currentRecordId && record.matterNo === candidateNo)) {
    candidateNo = `${baseNo}-${index}`;
    index += 1;
  }

  return candidateNo;
}

function getSourceStatusFromDataStatus(dataStatus: FinanceTaxMatterRecord['dataStatus']): FinanceTaxMatterSourceStatus {
  if (dataStatus === '已确认') return '已确认';
  if (dataStatus === '待复核') return '待复核';
  return '待准备';
}

function buildTaxMatterSourceItems(formValue: TaxMatterFormValue, existingItems: FinanceTaxMatterSourceItem[] = []) {
  const nextStatus = getSourceStatusFromDataStatus(formValue.dataStatus);
  const periodCode = formatTaxMatterPeriodCode(formValue.period).toLowerCase();
  const typeCode = taxMatterCodeMap[formValue.matterType].toLowerCase();

  return taxMatterSourceTemplates[formValue.matterType].map((template, index) => {
    const existingItem = existingItems.find(
      (item) => item.name === template.name && item.sourceModule === template.sourceModule
    );

    return {
      id: existingItem?.id ?? `tax-source-${typeCode}-${periodCode}-${index + 1}`,
      name: template.name,
      sourceModule: template.sourceModule,
      status: nextStatus,
      updatedAt: financeToday
    };
  });
}

export function getTaxMatterFormValue(record: FinanceTaxMatterRecord | undefined): TaxMatterFormValue {
  if (!record) return defaultTaxMatterFormValue;

  return {
    dataStatus: record.dataStatus,
    declarationDate: record.declarationDate ?? '',
    declarationDueDate: record.declarationDueDate,
    declarationStatus: record.declarationStatus,
    matterType: record.matterType,
    owner: record.owner,
    paidAmount: record.paidAmount,
    participantSummary: record.participantSummary,
    payableAmount: record.payableAmount,
    paymentDate: record.paymentDate ?? '',
    paymentDueDate: record.paymentDueDate,
    paymentStatus: record.paymentStatus,
    period: record.period,
    periodType: record.periodType
  };
}

export function buildTaxMatterRecord(
  formValue: TaxMatterFormValue,
  records: FinanceTaxMatterRecord[],
  existingRecord?: FinanceTaxMatterRecord,
  files: FinanceTaxMatterRecord['files'] = existingRecord?.files ?? []
): FinanceTaxMatterRecord {
  const title = buildTaxMatterTitle(formValue);
  const matterNo = existingRecord?.period === formValue.period && existingRecord.matterType === formValue.matterType
    ? existingRecord.matterNo
    : buildTaxMatterNo(formValue, records, existingRecord?.id);
  const isSocialInsuranceMatter = isSocialInsuranceTaxMatterType(formValue.matterType);
  const requiredReceiptTypes = getTaxMatterRequiredReceiptTypes(formValue);
  const hasRequiredReceiptFiles = hasTaxMatterRequiredReceiptFiles(files, requiredReceiptTypes);

  return {
    ...(existingRecord ?? {
      declarationFormFileIds: [],
      declarationHistory: [],
      declarationVerificationStatus: '未核验',
      declarationVersion: 1,
      files: [],
      id: `tax-matter-local-${Date.now()}`,
      linkedTransactionNos: [],
      operationRecords: [],
      preparedPayableAmount: formValue.payableAmount
    }),
    ...formValue,
    declarationDate: isSocialInsuranceMatter ? existingRecord?.declarationDate : formValue.declarationDate,
    files,
    matterNo,
    operationRecords: [
      ...(existingRecord?.operationRecords ?? []),
      {
      action: isSocialInsuranceMatter ? '上传凭证' : '维护申报材料',
        actor: '李明',
        id: `tax-op-receipt-${Date.now()}`,
        object: matterNo,
        summary: `归档 ${title} ${requiredReceiptTypes.join('、')}`,
        time: `${financeToday} 15:30`
      }
    ],
    declarationStatus: formValue.payableAmount > 0 ? '申报成功' : '零申报',
    paidAmount: formValue.payableAmount,
    paymentDate: formValue.payableAmount > 0 ? formValue.paymentDate : undefined,
    paymentStatus: formValue.payableAmount > 0 ? '已缴纳' : '无需缴纳',
    processStatus: hasRequiredReceiptFiles ? '已完成' : '申报材料待核对',
    sourceItems: buildTaxMatterSourceItems(formValue, existingRecord?.sourceItems),
    title,
    updatedAt: financeToday
  };
}

export function getTaxMatterFormError(formValue: TaxMatterFormValue) {
  if (
    !formValue.period.trim()
    || !formValue.owner.trim()
    || !formValue.participantSummary.trim()
    || !formValue.declarationDueDate.trim()
    || !formValue.paymentDueDate.trim()
  ) return '请补全必填信息';
  if (formValue.payableAmount < 0) return '金额不能小于 0';
  if (!isSocialInsuranceTaxMatterType(formValue.matterType) && !formValue.declarationDate) {
    return '请选择实际申报日期';
  }
  if (formValue.payableAmount > 0 && !formValue.paymentDate) {
    return isSocialInsuranceTaxMatterType(formValue.matterType) ? '请选择实际缴费日期' : '请选择实际缴款日期';
  }
  return undefined;
}

export function buildTaxMatterReceiptFile(file: FinanceVoucherUploadFile, receiptType: TaxMatterReceiptFileType) {
  return {
    id: `tax-file-local-${file.uid}-${Date.now()}`,
    name: file.name,
    status: '已上传' as const,
    type: receiptType,
    updatedAt: financeToday
  };
}

export function getMissingReceiptTypes(
  files: FinanceTaxMatterRecord['files'],
  formValue: TaxMatterFormValue
) {
  return getMissingTaxMatterReceiptTypes(files, getTaxMatterRequiredReceiptTypes(formValue));
}
