import { peopleMockRepository } from './peopleRepository';
import {
  createInitialPeopleMovementRows,
  initialPeopleMovementSeeds
} from './peopleMovementRecordModel';

type UnitTest = {
  name: string;
  run: () => void;
};

type UnitTestResult = {
  failures: string[];
  passed: number;
  total: number;
};

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    fail(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (!Object.is(actual, expected)) {
    fail(`${message}. Expected ${String(expected)}, received ${String(actual)}`);
  }
}

const forbiddenDerivedRecordIds = new Set([
  'MOV-20250018-REGULAR',
  'MOV-20240009-LEAVE',
  'MOV-20250011-COOP-END'
]);

const tests: UnitTest[] = [
  {
    name: 'builds initial movement rows from explicit transaction seeds only',
    run: () => {
      const snapshot = peopleMockRepository.getInitialSnapshot();
      const rows = createInitialPeopleMovementRows(snapshot.peopleRows);

      assertEqual(rows.length, initialPeopleMovementSeeds.length, 'initial movement rows should match explicit seed count');
      assert(!rows.some((row) => forbiddenDerivedRecordIds.has(row.id)), 'initial movement rows should not include archive-state derived record ids');
      assert(rows.every((row) => initialPeopleMovementSeeds.some((seed) => seed.id === row.id)), 'every initial row should come from an explicit seed');
      assert(rows.some((row) => row.id === 'MOV-20250018-EARLY-REGULAR' && row.summary === '提前转正'), 'explicit early regularization should remain visible as a transaction');
    }
  },
  {
    name: 'keeps effective transactions reversible and pending transactions unapplied',
    run: () => {
      const snapshot = peopleMockRepository.getInitialSnapshot();
      const rows = createInitialPeopleMovementRows(snapshot.peopleRows);
      const effectiveRows = rows.filter((row) => row.recordStatus === '已生效');
      const pendingLeave = rows.find((row) => row.id === 'MOV-20260001-PENDING-LEAVE');

      assert(effectiveRows.length > 0, 'seed data should include effective movement transactions');
      assert(effectiveRows.every((row) => row.beforeMemberSnapshot && row.afterMemberSnapshot), 'effective transaction seeds should carry before/after snapshots');
      assert(pendingLeave, 'seed data should include pending leave transaction');
      assertEqual(pendingLeave.recordStatus, '待生效', 'pending leave should stay pending');
      assert(!pendingLeave.afterMemberSnapshot, 'pending transaction should not claim an applied after snapshot');
      assert(pendingLeave.files.length > 0, 'pending leave should still include required evidence file slots');
    }
  }
];

export function runPeopleMovementRecordModelTests(): UnitTestResult {
  const failures: string[] = [];

  for (const test of tests) {
    try {
      test.run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${test.name}: ${message}`);
    }
  }

  return {
    failures,
    passed: tests.length - failures.length,
    total: tests.length
  };
}
