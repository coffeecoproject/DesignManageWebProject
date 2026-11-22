import {
  clonePeriodClosePersistentState,
  type PeriodClosePersistentState,
  type PersistentFinanceSourceRecord
} from './periodClosePersistenceContract.js';
import type {
  PeriodCloseRepository,
  PeriodCloseRepositoryTransaction,
  PeriodCloseRepositoryTransactionResult
} from './periodCloseRepositoryContract.js';
import type { FinanceSourceMutationArea } from './periodCloseSourceMutationGuard.js';

export type FinanceSourceTableRow = PersistentFinanceSourceRecord & {
  tableName: string;
  updatedAt?: string;
};

export type FinanceSourceTableRepository = {
  readRows: () => FinanceSourceTableRow[];
  replaceRows: (rows: FinanceSourceTableRow[]) => void;
};

function cloneSourceTableRow(row: FinanceSourceTableRow): FinanceSourceTableRow {
  return { ...row };
}

function cloneSourceTableRows(rows: FinanceSourceTableRow[]): FinanceSourceTableRow[] {
  return rows.map(cloneSourceTableRow);
}

function sourceTableRowToPersistentSourceRecord(row: FinanceSourceTableRow): PersistentFinanceSourceRecord {
  return {
    accountingPeriod: row.accountingPeriod,
    amount: row.amount,
    id: row.id,
    sourceArea: row.sourceArea,
    sourceNo: row.sourceNo,
    status: row.status,
    version: row.version
  };
}

export function getDefaultFinanceSourceTableName(sourceArea: FinanceSourceMutationArea) {
  return `finance_${sourceArea}_source_rows`;
}

function persistentSourceRecordToSourceTableRow({
  previousRows,
  record
}: {
  previousRows: FinanceSourceTableRow[];
  record: PersistentFinanceSourceRecord;
}): FinanceSourceTableRow {
  const previous = previousRows.find((row) => row.id === record.id && row.sourceArea === record.sourceArea);

  return {
    ...record,
    tableName: previous?.tableName ?? getDefaultFinanceSourceTableName(record.sourceArea),
    updatedAt: previous?.updatedAt
  };
}

function sourceRowsFromPersistentState({
  previousRows,
  state
}: {
  previousRows: FinanceSourceTableRow[];
  state: PeriodClosePersistentState;
}) {
  return state.sourceRecords.map((record) => persistentSourceRecordToSourceTableRow({ previousRows, record }));
}

export function createInMemoryFinanceSourceTableRepository(
  initialRows: FinanceSourceTableRow[]
): FinanceSourceTableRepository {
  let rows = cloneSourceTableRows(initialRows);

  return {
    readRows: () => cloneSourceTableRows(rows),
    replaceRows: (nextRows) => {
      rows = cloneSourceTableRows(nextRows);
    }
  };
}

export function createSourceTableBackedPeriodCloseRepository({
  initialState,
  sourceTableRepository
}: {
  initialState: PeriodClosePersistentState;
  sourceTableRepository: FinanceSourceTableRepository;
}): PeriodCloseRepository {
  let committedState = clonePeriodClosePersistentState({
    ...initialState,
    sourceRecords: []
  });

  function readStateWithSourceTableRows(): PeriodClosePersistentState {
    return {
      ...clonePeriodClosePersistentState(committedState),
      sourceRecords: sourceTableRepository.readRows().map(sourceTableRowToPersistentSourceRecord)
    };
  }

  return {
    readState: readStateWithSourceTableRows,
    runInTransaction: <T extends PeriodCloseRepositoryTransactionResult>(
      transaction: PeriodCloseRepositoryTransaction<T>
    ): T => {
      const previousSourceRows = sourceTableRepository.readRows();
      const transactionState = {
        ...clonePeriodClosePersistentState(committedState),
        sourceRecords: previousSourceRows.map(sourceTableRowToPersistentSourceRecord)
      };
      const result = transaction(transactionState);
      const nextState = clonePeriodClosePersistentState(result.state);

      sourceTableRepository.replaceRows(
        sourceRowsFromPersistentState({
          previousRows: previousSourceRows,
          state: nextState
        })
      );
      committedState = clonePeriodClosePersistentState({
        ...nextState,
        sourceRecords: []
      });

      return {
        ...result,
        state: readStateWithSourceTableRows()
      };
    }
  };
}
