import type { ReactNode } from 'react';

export type ReportSummaryTone = 'default' | 'expense' | 'income' | 'muted';

export type ReportSummaryItem = {
  key: string;
  label: ReactNode;
  tone?: ReportSummaryTone;
  value: ReactNode;
};

type ReportSummaryBarProps = {
  density?: 'default' | 'compact';
  items: ReportSummaryItem[];
  meta?: ReactNode;
  title?: ReactNode;
};

export function ReportSummaryBar({ density = 'default', items, meta, title }: ReportSummaryBarProps) {
  return (
    <section className="report-summary-bar" data-density={density}>
      {title || meta ? (
        <div className="report-summary-heading">
          {title ? <span className="report-summary-title">{title}</span> : null}
          {meta ? <span className="report-summary-meta">{meta}</span> : null}
        </div>
      ) : null}
      <div className="report-summary-items">
        {items.map((item) => (
          <div className="report-summary-item" data-tone={item.tone ?? 'default'} key={item.key}>
            <span className="report-summary-label">{item.label}</span>
            <span className="report-summary-value">{item.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
