import { Tabs } from 'antd';
import type { TabsProps } from 'antd';
import type { ReactNode } from 'react';

export type ManagementTableTabItem = {
  disabled?: boolean;
  key: string;
  label: ReactNode;
};

type ManagementTableTabsProps = Omit<TabsProps, 'className' | 'items'> & {
  items: ManagementTableTabItem[];
  tabTestIdPrefix?: string;
  testId?: string;
};

export function ManagementTableTabs({
  items,
  tabTestIdPrefix,
  testId,
  ...props
}: ManagementTableTabsProps) {
  const normalizedItems: TabsProps['items'] = items.map((item) => ({
    ...item,
    children: null,
    label: tabTestIdPrefix ? <span data-testid={`${tabTestIdPrefix}-${item.key}`}>{item.label}</span> : item.label
  }));

  return (
    <Tabs
      {...props}
      className="detail-tabs management-table-tabs"
      data-testid={testId}
      data-variant="workbench"
      items={normalizedItems}
    />
  );
}
