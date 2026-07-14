export type NaturalPersonIncomeType = '工资薪金' | '劳务报酬' | '费用返还';

export type NaturalPersonTaxIdentityType = '居民个人' | '非居民个人';

export type NaturalPersonWithholdingMethod = '累计预扣法' | '按次预扣法' | '不计入个人所得';

export type NaturalPersonPaymentSnapshot = {
  deductibleExpenseAmount: number;
  grossIncomeAmount: number;
  incomeType: NaturalPersonIncomeType;
  identityNo?: string;
  netPaymentAmount: number;
  paymentFactId: string;
  personId: string;
  personName: string;
  sourceBatchNo: string;
  sourceRecordNos?: string[];
  taxIdentityType: NaturalPersonTaxIdentityType;
  taxPeriod: string;
  taxableIncomeAmount: number;
  withheldTaxAmount: number;
  withholdingMethod: NaturalPersonWithholdingMethod;
};

export type NaturalPersonPaymentFactStatus = '待核验' | '已核验' | '已冲正';

export type NaturalPersonPaymentFact = NaturalPersonPaymentSnapshot & {
  financeTransactionNo?: string;
  occurredAt: string;
  sourceModule: '薪酬明细' | '应收应付' | '费用报销';
  status: NaturalPersonPaymentFactStatus;
};
