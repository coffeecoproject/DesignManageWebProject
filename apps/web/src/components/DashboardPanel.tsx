import type { ReactNode } from 'react';

type DashboardPanelProps = {
  children: ReactNode;
  className?: string;
  icon: ReactNode;
  title: string;
};

export function DashboardPanel({ children, className, icon, title }: DashboardPanelProps) {
  return (
    <section className={['dashboard-panel', className].filter(Boolean).join(' ')}>
      <div className="dashboard-panel-head">
        <span className="dashboard-panel-icon">{icon}</span>
        <span>{title}</span>
      </div>
      {children}
    </section>
  );
}
