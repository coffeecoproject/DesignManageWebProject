import { Table } from 'antd';
import type { TableColumnsType, TableProps } from 'antd';

export function CompactDetailTable<T extends object>({
  className,
  columns,
  dataSource,
  emptyText,
  expandable,
  rowSelection,
  rowKey,
  scrollX = 720
}: {
  className?: string;
  columns: TableColumnsType<T>;
  dataSource: T[];
  emptyText?: string;
  expandable?: TableProps<T>['expandable'];
  rowSelection?: TableProps<T>['rowSelection'];
  rowKey: TableProps<T>['rowKey'];
  scrollX?: number | false;
}) {
  const scroll = scrollX === false ? undefined : { x: scrollX };
  const resolvedClassName = ['detail-table', 'detail-table-compact', className].filter(Boolean).join(' ');

  return (
    <Table<T>
      className={resolvedClassName}
      columns={columns}
      dataSource={dataSource}
      expandable={expandable}
      locale={emptyText ? { emptyText } : undefined}
      pagination={false}
      rowKey={rowKey}
      rowSelection={rowSelection}
      scroll={scroll}
      size="small"
    />
  );
}
