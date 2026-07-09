import { Button, Space, Table } from 'antd';
import type { ButtonProps, TableColumnsType, TablePaginationConfig } from 'antd';
import { useMemo, type HTMLAttributes, type Key, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { CellText } from './TableCell';

export type ManagementTableRowKey<T> = string | ((record: T) => Key);
type ColumnAlign = 'left' | 'center' | 'right';
type ManagementColumn<T extends object> = TableColumnsType<T>[number] & {
  align?: ColumnAlign;
  children?: TableColumnsType<T>;
  className?: string;
  dataIndex?: Key | readonly Key[];
  key?: Key;
  title?: ReactNode;
  width?: number | string;
};

export type ManagementTableAction = {
  danger?: ButtonProps['danger'];
  disabled?: ButtonProps['disabled'];
  icon?: ReactNode;
  label: ReactNode;
  testId?: string;
  onClick: ButtonProps['onClick'];
};

export type ManagementTableCount = {
  prefix?: ReactNode;
  unit?: ReactNode;
  value: ReactNode;
};

export type ManagementTableProps<T extends object> = {
  columns: TableColumnsType<T>;
  count?: ManagementTableCount;
  dataSource: T[];
  primaryAction?: ManagementTableAction;
  rowTestIdPrefix?: string;
  rowKey: ManagementTableRowKey<T>;
  secondaryAction?: ManagementTableAction;
  scrollX?: number | false;
  scrollY?: number | string;
  tableTestId?: string;
  title?: ReactNode;
  onRowClick?: (record: T) => void;
};

const defaultColumnWidth = 120;
const tableWidthBuffer = 160;
const minimumScrollableWidth = 960;
const managementTablePagination: TablePaginationConfig = {
  pageSize: 10,
  showSizeChanger: false,
  showTotal: (total) => `共 ${total} 条`
};

function parseColumnWidth(width: number | string | undefined) {
  if (typeof width === 'number') {
    return width;
  }

  if (typeof width === 'string') {
    const parsed = Number.parseFloat(width);
    return Number.isFinite(parsed) ? parsed : defaultColumnWidth;
  }

  return defaultColumnWidth;
}

function sumColumnWidths<T extends object>(columns: TableColumnsType<T>): number {
  return columns.reduce((total, column) => {
    const managementColumn = column as ManagementColumn<T>;

    if (managementColumn.children?.length) {
      return total + sumColumnWidths(managementColumn.children);
    }

    return total + parseColumnWidth(managementColumn.width);
  }, 0);
}

function getColumnAlign<T extends object>(column: ManagementColumn<T>, columnIndex: number, level: number): ColumnAlign {
  if (column.align) {
    return column.align;
  }

  const title = typeof column.title === 'string' ? column.title : '';
  const key = String(column.key ?? '');
  const dataIndex = Array.isArray(column.dataIndex) ? column.dataIndex.join('.') : String(column.dataIndex ?? '');

  if (level === 0 && columnIndex === 0) {
    return 'left';
  }

  if (title === '人员' || key === 'person' || dataIndex === 'person') {
    return 'left';
  }

  return 'center';
}

function createRowProps(testId: string | undefined, rowKeyValue: string): HTMLAttributes<HTMLElement> {
  return {
    ...(testId ? { 'data-testid': testId } : {}),
    'data-record-key': rowKeyValue
  } as HTMLAttributes<HTMLElement>;
}

function appendAlignmentClass(className: string | undefined, align: ColumnAlign) {
  return [className, `management-table-cell-${align}`].filter(Boolean).join(' ');
}

function normalizeColumns<T extends object>(columns: TableColumnsType<T>, level = 0): TableColumnsType<T> {
  return columns.map((column, columnIndex) => {
    const managementColumn = { ...column } as ManagementColumn<T>;
    const align = getColumnAlign(managementColumn, columnIndex, level);

    if (managementColumn.children?.length) {
      managementColumn.children = normalizeColumns(managementColumn.children, level + 1);
    }

    managementColumn.align = align;
    managementColumn.className = appendAlignmentClass(managementColumn.className, align);

    return managementColumn;
  });
}

function shouldIgnoreDelegatedRowClick(event: ReactMouseEvent<HTMLElement>) {
  const target = event.target instanceof Element ? event.target : event.currentTarget;
  return Boolean(target.closest('button, a, input, textarea, .ant-select, .ant-picker'));
}

function getRecordKey<T extends object>(record: T, rowKey: ManagementTableRowKey<T>) {
  if (typeof rowKey === 'function') {
    return String(rowKey(record));
  }

  return String((record as Record<string, Key>)[rowKey]);
}

function renderAction(action: ManagementTableAction, type?: ButtonProps['type']) {
  return (
    <Button
      danger={action.danger}
      data-testid={action.testId}
      disabled={action.disabled}
      icon={action.icon}
      type={type}
      onClick={action.onClick}
    >
      {action.label}
    </Button>
  );
}

function renderCount({ prefix = '共', unit, value }: ManagementTableCount) {
  return (
    <span className="management-table-count">
      {prefix} {value}
      {unit ? <> {unit}</> : null}
    </span>
  );
}

export function ManagementTable<T extends object>({
  columns,
  count,
  dataSource,
  primaryAction,
  rowTestIdPrefix,
  rowKey,
  scrollX: scrollXOverride,
  scrollY,
  secondaryAction,
  tableTestId,
  title,
  onRowClick
}: ManagementTableProps<T>) {
  const normalizedColumns = useMemo(() => normalizeColumns(columns), [columns]);
  const recordsByKey = useMemo(
    () => new Map(dataSource.map((record) => [getRecordKey(record, rowKey), record])),
    [dataSource, rowKey]
  );
  const scrollX = useMemo(() => {
    const columnWidth = sumColumnWidths(columns);
    const bufferedWidth = columnWidth >= minimumScrollableWidth ? columnWidth + tableWidthBuffer : columnWidth;
    return Math.max(bufferedWidth, minimumScrollableWidth);
  }, [columns]);
  const tableScroll =
    scrollXOverride === false && scrollY === undefined
      ? undefined
      : {
          ...(scrollXOverride === false ? {} : { x: scrollXOverride ?? scrollX }),
          ...(scrollY === undefined ? {} : { y: scrollY })
        };

  function handleWorkbenchClick(event: ReactMouseEvent<HTMLElement>) {
    if (!onRowClick || event.defaultPrevented || shouldIgnoreDelegatedRowClick(event)) {
      return;
    }

    const target = event.target instanceof Element ? event.target : event.currentTarget;
    const row = target.closest('tr[data-record-key], tr[data-row-key]');
    const rowKeyValue = row?.getAttribute('data-record-key') ?? row?.getAttribute('data-row-key');

    if (!rowKeyValue) {
      return;
    }

    const record = recordsByKey.get(rowKeyValue);

    if (record) {
      onRowClick(record);
    }
  }

  return (
    <section className="management-table-workbench" data-testid={tableTestId} onClick={handleWorkbenchClick}>
      <div className="management-table-toolbar">
        <Space size={8}>
          {title ? <CellText>{title}</CellText> : null}
          {primaryAction ? renderAction(primaryAction, 'primary') : null}
          {secondaryAction ? renderAction(secondaryAction) : null}
        </Space>
        {count ? renderCount(count) : null}
      </div>
      <Table<T>
        className="management-table"
        columns={normalizedColumns}
        dataSource={dataSource}
        pagination={managementTablePagination}
        onRow={(record) => {
          const rowKeyValue = getRecordKey(record, rowKey);
          const rowProps = createRowProps(rowTestIdPrefix ? `${rowTestIdPrefix}-${rowKeyValue}` : undefined, rowKeyValue);

          if (!onRowClick) {
            return rowProps;
          }

          return {
            ...rowProps,
            onClick: (event) => {
              if (shouldIgnoreDelegatedRowClick(event)) {
                return;
              }

              event.stopPropagation();
              onRowClick(record);
            }
          };
        }}
        rowClassName={onRowClick ? 'management-table-row-clickable' : undefined}
        rowKey={rowKey}
        scroll={tableScroll}
        size="middle"
        tableLayout="fixed"
      />
    </section>
  );
}
