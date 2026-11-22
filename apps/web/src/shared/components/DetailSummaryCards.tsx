import { Card } from 'antd';
import type { ReactNode } from 'react';

export type DetailSummaryCardItem = {
  description?: ReactNode;
  icon: ReactNode;
  key: string;
  label: string;
  value?: ReactNode;
};

type DetailSummaryCardsProps = {
  className?: string;
  columns?: 2 | 3 | 4;
  items: DetailSummaryCardItem[];
};

function hasSummaryValue(value: ReactNode) {
  return value !== undefined && value !== null && value !== '';
}

function renderSummaryValue(value: ReactNode) {
  if (!hasSummaryValue(value)) {
    return '-';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return value;
}

export function DetailSummaryCards({ className, columns = 3, items }: DetailSummaryCardsProps) {
  return (
    <div className={['detail-summary-cards', className].filter(Boolean).join(' ')} data-columns={columns}>
      {items.map((item) => (
        <Card className="detail-summary-card" key={item.key} variant="borderless">
          <span className="detail-summary-icon">{item.icon}</span>
          <span className="detail-summary-label">{item.label}</span>
          <span className="detail-summary-value">{renderSummaryValue(item.value)}</span>
          {hasSummaryValue(item.description) ? (
            <span className="detail-summary-description">{renderSummaryValue(item.description)}</span>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
