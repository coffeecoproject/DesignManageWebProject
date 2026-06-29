import type { StatusTagTone } from '../../components/Detail';
import type { FinanceTransactionRecord } from './financeData';
import {
  financeToday,
  getFinanceTransactionReviewDueAt,
  isFinanceTransactionReviewOverdue
} from './financeUtils';

export type FinanceReviewReadiness = '可复核' | '凭证待补' | '逾期复核';

export function getFinanceReviewReadiness(record: FinanceTransactionRecord, today = financeToday): FinanceReviewReadiness {
  if (record.voucherStatus !== '已上传') {
    return '凭证待补';
  }

  if (isFinanceTransactionReviewOverdue(record, today)) {
    return '逾期复核';
  }

  return '可复核';
}

export function getFinanceReviewReadinessTone(readiness: FinanceReviewReadiness): StatusTagTone {
  if (readiness === '可复核') {
    return 'green';
  }

  if (readiness === '逾期复核') {
    return 'red';
  }

  return 'amber';
}

export function getFinanceReviewQueueRows(records: FinanceTransactionRecord[], today = financeToday) {
  return records
    .filter((record) => record.status === '待复核')
    .sort((left, right) => {
      const leftReady = left.voucherStatus === '已上传' ? 1 : 0;
      const rightReady = right.voucherStatus === '已上传' ? 1 : 0;
      const leftOverdue = isFinanceTransactionReviewOverdue(left, today) ? 0 : 1;
      const rightOverdue = isFinanceTransactionReviewOverdue(right, today) ? 0 : 1;

      return (
        rightReady - leftReady ||
        leftOverdue - rightOverdue ||
        getFinanceTransactionReviewDueAt(left).localeCompare(getFinanceTransactionReviewDueAt(right)) ||
        left.transactionNo.localeCompare(right.transactionNo)
      );
    });
}

export function buildFinanceReviewMetrics(records: FinanceTransactionRecord[], today = financeToday) {
  const queueRows = getFinanceReviewQueueRows(records, today);

  return {
    missingVoucherCount: queueRows.filter((record) => record.voucherStatus !== '已上传').length,
    overdueReviewCount: queueRows.filter((record) => isFinanceTransactionReviewOverdue(record, today)).length,
    pendingReviewCount: queueRows.length
  };
}
