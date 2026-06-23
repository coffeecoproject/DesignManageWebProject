import type { ReactNode } from 'react';

type ManagementPageId =
  | 'finance-business-overview'
  | 'finance-bank-reconciliation'
  | 'finance-invoice-matching'
  | 'finance-invoices'
  | 'finance-overview'
  | 'finance-receivables-payables'
  | 'finance-statistics'
  | 'finance-tax-filings'
  | 'salary-overview'
  | 'salary-social-insurance'
  | 'tax-declaration-preparation'
  | 'tax-handling'
  | 'performance-dashboard'
  | 'performance-monthly'
  | 'system-public-accounts'
  | 'system-tax-policy'
  | 'tasks-dashboard'
  | 'task-workflow';

type ManagementPageScaffoldProps = {
  children: ReactNode;
  feedback?: ReactNode;
  filters?: ReactNode;
  metrics?: ReactNode;
  overview?: ReactNode;
  pageId?: ManagementPageId;
};

export function ManagementPageScaffold({ children, feedback, filters, metrics, overview, pageId }: ManagementPageScaffoldProps) {
  return (
    <div className="management-page-scaffold" data-page={pageId}>
      {feedback}
      {metrics}
      {overview}
      {filters}
      {children}
    </div>
  );
}
