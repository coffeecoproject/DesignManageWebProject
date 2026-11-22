// Finance transactions that pay social-insurance contributions and contribution corrections.
import type { ContributionCorrectionRecord, SocialInsuranceEmployeeRecord } from '../social-insurance';
import {
  getFinanceCategorySnapshot,
  type FinancePrimaryCategoryConfig,
  type FinanceSecondaryCategoryConfig,
  type FinanceTransactionRecord
} from './financeData';
import { financeToday } from './financeUtils';
import type { PublicAccountRef } from '../public-accounts';

function getNextSocialInsuranceTransactionNo(financeRows: FinanceTransactionRecord[], accountingPeriod: string) {
  const prefix = `FIN-${accountingPeriod.replace('-', '')}-`;
  const nextSequence = financeRows.reduce((maxSequence, record) => {
    if (!record.transactionNo.startsWith(prefix)) return maxSequence;
    const sequence = Number(record.transactionNo.slice(prefix.length));
    return Number.isFinite(sequence) ? Math.max(maxSequence, sequence) : maxSequence;
  }, 0) + 1;

  return `${prefix}${String(nextSequence).padStart(4, '0')}`;
}

export function buildSocialInsurancePaymentTransaction(input: {
  category: SocialInsuranceEmployeeRecord['category'];
  financePrimaryCategories: FinancePrimaryCategoryConfig[];
  financeRows: FinanceTransactionRecord[];
  financeSecondaryCategories: FinanceSecondaryCategoryConfig[];
  paidAt: string;
  paymentFileIds: string[];
  period: string;
  publicAccountRef: PublicAccountRef;
  records: SocialInsuranceEmployeeRecord[];
}) {
  const payableRecords = input.records.filter((record) =>
    record.category === input.category
    && record.period === input.period
    && record.handlingStatus === '待缴费'
    && !record.transactionNo
  );
  const amount = payableRecords.reduce(
    (total, record) => total + (record.assessedEmployerAmount ?? 0) + (record.assessedEmployeeAmount ?? 0),
    0
  );

  if (payableRecords.length === 0 || amount <= 0 || !input.paidAt || input.paymentFileIds.length === 0) return undefined;

  const transactionNo = getNextSocialInsuranceTransactionNo(input.financeRows, input.paidAt.slice(0, 7));
  const category = input.category === '社保' ? '社保缴费' : '公积金缴费';

  return {
    accountingPeriod: input.paidAt.slice(0, 7),
    amount: Math.round(amount * 100) / 100,
    category,
    categorySnapshot: getFinanceCategorySnapshot(category, input.financePrimaryCategories, input.financeSecondaryCategories),
    counterparty: input.category === '社保' ? '社会保险经办机构' : '住房公积金管理中心',
    counterpartyType: '内部',
    currency: 'CNY',
    direction: '支出',
    files: input.paymentFileIds.map((fileId) => ({
      id: fileId,
      name: fileId,
      status: '已上传' as const,
      type: '缴费回单',
      updatedAt: input.paidAt
    })),
    id: `fin-social-insurance-${transactionNo}`,
    note: `${input.period} ${input.category}缴费`,
    occurredAt: input.paidAt,
    operationRecords: [{
      action: '登记流水',
      actor: '李明',
      id: `fin-op-social-insurance-${transactionNo}`,
      object: transactionNo,
      summary: `由 ${input.period} ${input.category}核定结果生成待复核流水`,
      time: `${financeToday} 10:30`
    }],
    paymentMethod: '对公账户付款',
    publicAccountId: input.publicAccountRef.publicAccountId,
    publicAccountSnapshot: input.publicAccountRef.publicAccountSnapshot,
    reconciliationStatus: '未对账',
    registeredBy: '李明',
    sourceNo: `SI-${input.period}-${input.category}`,
    sourceTitle: `${input.period} ${input.category}缴费`,
    sourceType: '社保公积金缴费',
    status: '待复核',
    transactionNo,
    updatedAt: `${financeToday} 10:30`,
    voucherStatus: '已上传'
  } satisfies FinanceTransactionRecord;
}

export function buildContributionCorrectionPaymentTransaction(input: {
  correction: ContributionCorrectionRecord;
  financePrimaryCategories: FinancePrimaryCategoryConfig[];
  financeRows: FinanceTransactionRecord[];
  financeSecondaryCategories: FinanceSecondaryCategoryConfig[];
  paidAt: string;
  paymentFileIds: string[];
  publicAccountRef: PublicAccountRef;
}) {
  const { correction } = input;
  const principalAmount = correction.principalEmployerAmount + correction.principalEmployeeAmount;
  const amount = principalAmount + correction.lateFeeAmount;

  if (
    correction.status !== '待缴费'
    || Boolean(correction.transactionNo)
    || amount <= 0
    || !input.paidAt
    || input.paymentFileIds.length === 0
  ) return undefined;

  const transactionNo = getNextSocialInsuranceTransactionNo(input.financeRows, input.paidAt.slice(0, 7));
  const category = correction.category === '社保' ? '社保缴费' : '公积金缴费';
  return {
    accountingAllocations: [
      ...(correction.principalEmployerAmount > 0 ? [{
        amount: correction.principalEmployerAmount,
        label: `${correction.originalPeriod} ${correction.category}单位补缴本金`,
        subjectCode: '5602.02'
      }] : []),
      ...(correction.principalEmployeeAmount > 0 ? [{
        amount: correction.principalEmployeeAmount,
        label: `${correction.originalPeriod} ${correction.category}个人代垫`,
        subjectCode: '1221'
      }] : []),
      ...(correction.lateFeeAmount > 0 ? [{ amount: correction.lateFeeAmount, label: '补缴滞纳金', subjectCode: '5711' }] : [])
    ],
    accountingPeriod: input.paidAt.slice(0, 7),
    amount: Math.round(amount * 100) / 100,
    category,
    categorySnapshot: getFinanceCategorySnapshot(category, input.financePrimaryCategories, input.financeSecondaryCategories),
    counterparty: correction.category === '社保' ? '社会保险经办机构' : '住房公积金管理中心',
    counterpartyType: '内部',
    currency: 'CNY',
    direction: '支出',
    files: input.paymentFileIds.map((fileId) => ({
      id: fileId,
      name: fileId,
      status: '已上传' as const,
      type: '补缴回单',
      updatedAt: input.paidAt
    })),
    id: `fin-social-correction-${transactionNo}`,
    note: `${correction.originalPeriod} ${correction.category}补缴；办理期 ${correction.handlingPeriod}`,
    occurredAt: input.paidAt,
    operationRecords: [{
      action: '登记流水',
      actor: '李明',
      id: `fin-op-social-correction-${transactionNo}`,
      object: transactionNo,
      summary: `补缴本金 ${principalAmount.toFixed(2)} 元，滞纳金 ${correction.lateFeeAmount.toFixed(2)} 元`,
      time: `${financeToday} 10:30`
    }],
    paymentMethod: '对公账户付款',
    publicAccountId: input.publicAccountRef.publicAccountId,
    publicAccountSnapshot: input.publicAccountRef.publicAccountSnapshot,
    reconciliationStatus: '未对账',
    registeredBy: '李明',
    sourceNo: correction.id,
    sourceTitle: `${correction.originalPeriod} ${correction.category}补缴`,
    sourceType: '社保公积金缴费',
    status: '待复核',
    transactionNo,
    updatedAt: `${financeToday} 10:30`,
    voucherStatus: '已上传'
  } satisfies FinanceTransactionRecord;
}
