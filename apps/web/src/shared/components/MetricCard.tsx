import { Card } from 'antd';
import type { ReactNode } from 'react';

export type MetricCardProps = {
  className?: string;
  icon: ReactNode;
  label: ReactNode;
  value: ReactNode;
};

export function MetricCard({ className, icon, label, value }: MetricCardProps) {
  return (
    <Card className={['metric-card', className].filter(Boolean).join(' ')} variant="borderless">
      <div className="metric-card-line">
        <span className="metric-icon">{icon}</span>
        <span className="metric-label">{label}</span>
        <span className="metric-value">{value}</span>
      </div>
    </Card>
  );
}
