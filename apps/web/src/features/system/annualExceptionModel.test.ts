import {
  applyAnnualExceptionRevisionChange,
  resolveAnnualExceptionRevision,
  validateAnnualExceptionRevisionTimeline
} from './annualExceptionModel';
import type { AnnualExceptionConfigRow, AnnualExceptionItem } from './workCalendarTypes';
import { it } from 'vitest';
import { assertEqual } from '../../__tests__/assertions';

function holiday(date: string, id: string): AnnualExceptionItem {
  return {
    date,
    groupId: 'new-year',
    groupName: '测试假日',
    id,
    name: '测试休息日',
    note: '',
    type: '休息日'
  };
}

function createRow(): AnnualExceptionConfigRow {
  return {
    code: 'EXC-2026-001',
    currentRevisionId: 'annual-2026-r1',
    id: 'annual-2026',
    revisions: [{
      createdAt: '2026-01-01',
      createdBy: '测试人',
      effectiveFrom: '2026-01-01',
      id: 'annual-2026-r1',
      items: [holiday('2026-06-20', 'holiday-v1')],
      revision: 1,
      source: '初始通知'
    }],
    status: '已启用',
    updatedAt: '2026-01-01',
    updatedBy: '测试人',
    year: 2026
  };
}

it('future annual revision does not change the current effective projection', () => {
  const change = applyAnnualExceptionRevisionChange(createRow(), {
    effectiveFrom: '2026-07-01',
    items: [holiday('2026-06-21', 'holiday-v2')],
    source: '修订通知',
    year: 2026
  }, { actor: '测试人', currentDate: '2026-06-16' });

  assertEqual(change.result.success, true, 'future revision should be accepted');
  assertEqual(resolveAnnualExceptionRevision(change.row, new Date('2026-06-30T00:00:00Z'))?.id, 'annual-2026-r1', 'old revision should remain effective before switch');
  assertEqual(resolveAnnualExceptionRevision(change.row, new Date('2026-07-01T00:00:00Z'))?.id, 'annual-2026-r2', 'new revision should apply on its effective date');
  assertEqual(change.row.currentRevisionId, 'annual-2026-r1', 'future revision must not replace current projection early');
});

it('annual revision closes the prior effective range without overlap', () => {
  const change = applyAnnualExceptionRevisionChange(createRow(), {
    effectiveFrom: '2026-07-01',
    items: [holiday('2026-07-01', 'holiday-v2')],
    source: '修订通知',
    year: 2026
  }, { actor: '测试人', currentDate: '2026-06-16' });

  assertEqual(change.row.revisions[0]?.effectiveTo, '2026-06-30', 'previous revision should close the day before the switch');
  assertEqual(validateAnnualExceptionRevisionTimeline(change.row.revisions).success, true, 'generated timeline should remain valid');
});

it('invalid or cross-year annual revisions are rejected', () => {
  const invalidDate = validateAnnualExceptionRevisionTimeline([{
    createdAt: '2026-01-01',
    createdBy: '测试人',
    effectiveFrom: '2026-02-30',
    id: 'invalid',
    items: [],
    revision: 1,
    source: '测试'
  }]);
  const crossYear = applyAnnualExceptionRevisionChange(createRow(), {
    effectiveFrom: '2027-01-01',
    items: [],
    source: '测试',
    year: 2026
  }, { actor: '测试人', currentDate: '2026-06-16' });

  assertEqual(invalidDate.success, false, 'invalid calendar date should be rejected');
  assertEqual(crossYear.result.success, false, 'revision outside the configured year should be rejected');
});

it('disabling an annual configuration preserves historical resolution', () => {
  const row = createRow();
  row.status = '草稿';
  row.statusPeriods = [
    { effectiveFrom: '2026-01-01', effectiveTo: '2026-06-15', status: '已启用' },
    { effectiveFrom: '2026-06-16', status: '草稿' }
  ];

  assertEqual(resolveAnnualExceptionRevision(row, new Date('2026-06-15T00:00:00Z'))?.id, 'annual-2026-r1', 'historical enabled period should remain resolvable');
  assertEqual(resolveAnnualExceptionRevision(row, new Date('2026-06-16T00:00:00Z')), undefined, 'disabled period should not resolve an active revision');
});
