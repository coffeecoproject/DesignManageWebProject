import type {
  FinanceCorporateIncomeTaxSourceRow,
  FinanceDeclarationPreparationItem
} from './financeDeclarationPreparationData';
import { formatMoney } from './financeUtils';

export type DeclarationCheckResultPresentation = {
  detail?: string;
  summary: string;
};

function formatNetAdjustment(amount: number) {
  if (amount > 0) {
    return `净调增 ${formatMoney(amount)}`;
  }

  if (amount < 0) {
    return `净调减 ${formatMoney(Math.abs(amount))}`;
  }

  return '无净调整';
}

function splitResult(result: string) {
  const separatorIndex = result.indexOf('，');

  if (separatorIndex < 0) {
    return { summary: result };
  }

  return {
    detail: result.slice(separatorIndex + 1),
    summary: result.slice(0, separatorIndex)
  };
}

export function getPreparationItemCheckResult(
  item: FinanceDeclarationPreparationItem
): DeclarationCheckResultPresentation {
  if (item.type === '季度账务完整性检查') {
    return {
      detail: item.result,
      summary: item.status === '待确认' ? '账务尚未完整' : '账务期间完整'
    };
  }

  if (item.type === '历史申报连续性检查') {
    return {
      detail: item.status === '待确认' ? item.result : undefined,
      summary: item.status === '待确认' ? '以前季度申报缺失' : '申报记录连续'
    };
  }

  if (item.type === '纳税调整测算' || item.type === '年度纳税调整') {
    return { detail: item.result, summary: formatNetAdjustment(item.amount) };
  }

  if (item.type === '优惠资格判定') {
    return splitResult(item.result);
  }

  if (item.type === '预缴测算') {
    return { detail: item.result, summary: `本期应预缴 ${formatMoney(item.amount)}` };
  }

  if (item.type === '年度汇算测算') {
    return { detail: item.result, summary: `年度应补 ${formatMoney(item.amount)}` };
  }

  return { summary: item.result };
}

export function getCorporateIncomeTaxSourceCheckResult(
  row: FinanceCorporateIncomeTaxSourceRow
): DeclarationCheckResultPresentation {
  if (row.name === '季度账务完整性' || row.name === '年度账务完整性') {
    return {
      detail: row.result,
      summary: row.status === '待确认' ? '账务尚未完整' : '账务期间完整'
    };
  }

  if (row.name === '以前季度申报' || row.name === '第四季度预缴') {
    return {
      detail: row.status === '待确认' ? row.result : undefined,
      summary: row.status === '待确认' ? '申报记录缺失' : '申报记录连续'
    };
  }

  if (row.name === '本年累计营业收入' || row.name === '本年累计营业成本' || row.name === '本年累计利润总额') {
    return { summary: '与利润表一致' };
  }

  if (row.name === '职工薪酬附报') {
    return { detail: row.result, summary: '已归集职工薪酬' };
  }

  if (row.name === '纳税调整' || row.name === '年度纳税调整') {
    return { detail: row.result, summary: formatNetAdjustment(row.value) };
  }

  if (row.name === '弥补亏损') {
    return {
      summary: row.value > 0 ? `可弥补亏损 ${formatMoney(row.value)}` : '无可弥补亏损'
    };
  }

  if (row.name === '本年实际已缴税额') {
    return { summary: '与历史申报一致' };
  }

  if (row.name === '小型微利资格') {
    const detail = row.result.split(' / ').slice(1).join(' / ');

    return {
      detail: detail || undefined,
      summary: row.displayValue === '符合' ? '符合小型微利企业条件' : '不符合小型微利企业条件'
    };
  }

  return { summary: row.result };
}
