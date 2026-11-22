import type { FinanceVoucherUploadFile } from './FinanceVoucherUploadPanel';
import type { FinanceTaxMatterProcessStatus, FinanceTaxMatterType } from './financeTaxFilingData';
import type { TaxMatterReceiptFileType } from './financeTaxMatterModel';
import { financeToday } from './financeUtils';

export type TaxMatterEditorMode =
  | 'declaration-result'
  | 'declaration-evidence'
  | 'payment-result'
  | 'refund-application'
  | 'refund-result'
  | 'offset-result'
  | 'revision';

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

export function getTaxMatterProcessStatusLabel(status: FinanceTaxMatterProcessStatus) {
  return status;
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
