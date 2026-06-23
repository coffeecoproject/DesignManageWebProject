import type { TabsProps } from 'antd';
import type { ReactNode } from 'react';
import { DetailTabs } from './DetailTabs';
import { ManagementTable, type ManagementTableProps } from './ManagementTable';

export type TabbedManagementTableConfig<TRecord extends object> = {
  disabled?: boolean;
  forceRender?: boolean;
  key: string;
  label: ReactNode;
  table: ManagementTableProps<TRecord>;
};

export type TabbedManagementTableItem = Omit<TabbedManagementTableConfig<object>, 'table'> & {
  table: ManagementTableProps<object>;
};

type TabbedManagementTableProps = Omit<TabsProps, 'className' | 'items'> & {
  tabTestIdPrefix?: string;
  tabs: TabbedManagementTableItem[];
  testId?: string;
};

export function createTabbedManagementTableItem<TRecord extends object>(
  item: TabbedManagementTableConfig<TRecord>
): TabbedManagementTableItem {
  return item as unknown as TabbedManagementTableItem;
}

export function TabbedManagementTable({
  tabTestIdPrefix,
  tabs,
  testId,
  ...props
}: TabbedManagementTableProps) {
  const items: TabsProps['items'] = tabs.map(({ table, ...tab }) => ({
    ...tab,
    children: <ManagementTable<object> {...table} />
  }));

  return (
    <section className="tabbed-management-table">
      <DetailTabs
        {...props}
        items={items}
        tabTestIdPrefix={tabTestIdPrefix}
        testId={testId}
        variant="workbench"
      />
    </section>
  );
}
