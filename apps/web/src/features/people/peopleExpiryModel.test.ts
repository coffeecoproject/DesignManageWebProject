import { peopleMockRepository } from './peopleRepository';
import {
  createPeopleExpiryRows,
  formatPeopleExpiryDays,
  getPeopleExpiryMetrics
} from './peopleExpiryModel';
import { it } from 'vitest';
import { assert, assertEqual } from '../../__tests__/assertions';

it('builds expiry rows from active personnel lifecycle fields', () => {
  const snapshot = peopleMockRepository.getInitialSnapshot();
  const rows = createPeopleExpiryRows(snapshot.peopleRows, { today: '2026-06-13' });

  assert(rows.some((row) => row.id === 'EXP-20260001-probation' && row.type === '试用期到期'), 'trial member should produce probation expiry row');
  assert(rows.some((row) => row.id === 'EXP-20260001-labor-contract' && row.type === '劳动合同到期'), 'active full-time member should produce labor-contract expiry row');
  assert(rows.some((row) => row.id === 'EXP-20260006-cooperation-contract' && row.type === '合作协议到期'), 'active part-time member should produce cooperation expiry row');
  assert(!rows.some((row) => row.member.status === '离职' || row.member.status === '结束合作'), 'inactive personnel should not produce active expiry rows');
  assert(!rows.some((row) => row.id === 'EXP-20250018-probation'), 'regular full-time member should not produce probation expiry row');
});

it('classifies urgency and metrics from current date', () => {
  const snapshot = peopleMockRepository.getInitialSnapshot();
  const rows = createPeopleExpiryRows(snapshot.peopleRows, { today: '2026-06-13' });
  const probationRow = rows.find((row) => row.id === 'EXP-20260001-probation');
  const metrics = getPeopleExpiryMetrics(rows);

  assert(probationRow, 'probation row should exist');
  assertEqual(probationRow.daysToDue, 17, 'probation days should be calculated against today');
  assertEqual(probationRow.urgency, '30天内', 'probation row should be a 30-day expiry item');
  assertEqual(formatPeopleExpiryDays(probationRow), '剩余 17 天', 'day display should describe remaining days');
  assertEqual(metrics.within30Days, 1, 'only the probation row should be within 30 days in seed data');
  assert(metrics.pending > 0, 'active expiry reminder rows should be pending');
});

it('keeps expiry rows as read-only reminders without page-local handling state', () => {
  const snapshot = peopleMockRepository.getInitialSnapshot();
  const rows = createPeopleExpiryRows(snapshot.peopleRows, { today: '2026-06-13' });
  const probationRow = rows.find((row) => row.id === 'EXP-20260001-probation');
  const sourceMember = snapshot.peopleRows.find((member) => member.id === '20260001');
  const metrics = getPeopleExpiryMetrics(rows);
  const expectedContractRelated = snapshot.peopleRows.filter((member) =>
    member.status !== '离职'
    && member.status !== '结束合作'
    && (member.contractType === '劳动合同' || member.contractType === '合作协议')
  ).length;

  assert(probationRow, 'probation row should exist');
  assert(sourceMember, 'source member should exist');
  assertEqual(probationRow.status, '待处理', 'probation expiry should remain a reminder status');
  assertEqual(metrics.contractRelated, expectedContractRelated, 'contract-related metric should count active labor contract and cooperation agreement rows');
  assertEqual(sourceMember.status, '试用期', 'expiry reminder should not mutate personnel lifecycle source data');
});
