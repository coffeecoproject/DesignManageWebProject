import type { TableColumnsType, TableProps } from 'antd';
import type { ReactNode } from 'react';
import { CompactDetailTable } from './CompactDetailTable';
import { ReportSummaryBar, type ReportSummaryItem } from './ReportSummaryBar';

type SummaryTablePanelLayout = 'default' | 'amount-trailing';

type SummaryTablePanelProps<T extends object> = {
  columns: TableColumnsType<T>;
  dataSource: T[];
  emptyText?: string;
  rowKey: TableProps<T>['rowKey'];
  scrollX?: number | false;
  summaryItems: ReportSummaryItem[];
  summaryLayout?: SummaryTablePanelLayout;
  summaryMeta?: ReactNode;
  summaryTitle?: ReactNode;
};

export function SummaryTablePanel<T extends object>({
  columns,
  dataSource,
  emptyText,
  rowKey,
  scrollX = 720,
  summaryItems,
  summaryLayout = 'default',
  summaryMeta,
  summaryTitle
}: SummaryTablePanelProps<T>) {
  return (
    <div className="summary-table-panel" data-summary-layout={summaryLayout}>
      <ReportSummaryBar density="compact" items={summaryItems} meta={summaryMeta} title={summaryTitle} />
      <CompactDetailTable<T>
        className="summary-table-panel-table"
        columns={columns}
        dataSource={dataSource}
        emptyText={emptyText}
        rowKey={rowKey}
        scrollX={scrollX}
      />
    </div>
  );
}
