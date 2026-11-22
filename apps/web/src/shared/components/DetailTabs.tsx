import { Tabs } from 'antd';
import type { TabsProps } from 'antd';

export type DetailTabsVariant = 'drawer' | 'workbench' | 'sticky-workbench';
type DetailTabItem = NonNullable<TabsProps['items']>[number];

type DetailTabsProps = Omit<TabsProps, 'className' | 'items'> & {
  items: DetailTabItem[];
  tabTestIdPrefix?: string;
  testId?: string;
  variant?: DetailTabsVariant;
};

export function DetailTabs({
  items,
  tabTestIdPrefix,
  testId,
  variant = 'drawer',
  ...props
}: DetailTabsProps) {
  const normalizedItems: TabsProps['items'] = items.map(({ children, ...item }) => {
    const tabKey = String(item.key);

    return {
      ...item,
      label: tabTestIdPrefix ? <span data-testid={`${tabTestIdPrefix}-${tabKey}`}>{item.label}</span> : item.label,
      children: <div className="drawer-tab-panel detail-tab-stack">{children}</div>
    };
  });

  return (
    <Tabs
      {...props}
      className="detail-tabs"
      data-testid={testId}
      data-variant={variant}
      items={normalizedItems}
    />
  );
}
