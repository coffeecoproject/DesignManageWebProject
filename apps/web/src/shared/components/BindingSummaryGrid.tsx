import type { ReactNode } from 'react';

export type BindingSummaryGridItem = {
  extra?: ReactNode;
  key: string;
  label: ReactNode;
};

type BindingSummaryGridProps = {
  emptyText?: ReactNode;
  items: BindingSummaryGridItem[];
};

export function BindingSummaryGrid({ emptyText = '暂无绑定', items }: BindingSummaryGridProps) {
  if (items.length === 0) {
    return <div className="binding-summary-empty">{emptyText}</div>;
  }

  return (
    <div className="binding-summary-grid">
      {items.map((item) => (
        <div className="binding-summary-card" key={item.key}>
          <span className="binding-summary-label">{item.label}</span>
          {item.extra ? <span className="binding-summary-extra">{item.extra}</span> : null}
        </div>
      ))}
    </div>
  );
}
