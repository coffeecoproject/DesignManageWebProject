import { buildAccountingPeriodVoucherSummaries } from './periodCloseVoucherSummaryContract.js';
import { it } from 'vitest';
import { assertEqual } from '../__tests__/assertions.js';

it('aggregates formal voucher counts by accounting period and status', () => {
  const summaries = buildAccountingPeriodVoucherSummaries([
    { accountingPeriod: '2026-06', id: 'voucher-prepared-001', status: '已制单' },
    { accountingPeriod: '2026-06', id: 'voucher-booked-001', status: '已记账' },
    { accountingPeriod: '2026-06', id: 'voucher-reversed-001', status: '已冲销' },
    { accountingPeriod: '2026-07', id: 'voucher-prepared-002', status: '已制单' }
  ]);

  assertEqual(summaries['2026-06']?.preparedVoucherCount, 3, 'prepared count should include all formal vouchers');
  assertEqual(summaries['2026-06']?.bookedVoucherCount, 2, 'booked count should include booked and reversed vouchers');
  assertEqual(summaries['2026-06']?.unbookedVoucherCount, 1, 'unbooked count should include prepared but unbooked vouchers');
  assertEqual(summaries['2026-07']?.preparedVoucherCount, 1, 'summary should be period scoped');
  assertEqual(summaries['2026-07']?.bookedVoucherCount, 0, 'period summary should not leak booked rows');
  assertEqual(summaries['2026-07']?.unbookedVoucherCount, 1, 'period summary should count its own unbooked row');
});
