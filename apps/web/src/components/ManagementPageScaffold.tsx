import type { ReactNode } from 'react';

type ManagementPageId =
  | 'finance-business-overview'
  | 'finance-bank-reconciliation'
  | 'finance-account-ledger'
  | 'finance-accounting-subjects'
  | 'finance-accounting-vouchers'
  | 'finance-financial-statements'
  | 'finance-general-ledger'
  | 'finance-period-close'
  | 'finance-invoice-matching'
  | 'finance-invoices'
  | 'finance-receivables-payables'
  | 'finance-review'
  | 'finance-tax-filings'
  | 'my-expense-collection'
  | 'my-expense-review'
  | 'salary-overview'
  | 'salary-social-insurance'
  | 'tax-declaration-preparation'
  | 'tax-handling'
  | 'performance-dashboard'
  | 'performance-monthly'
  | 'system-public-accounts'
  | 'system-ledger-initialization'
  | 'system-tax-policy'
  | 'tasks-dashboard'
  | 'task-workflow';

type ManagementPageScaffoldProps = {
  children: ReactNode;
  feedback?: ReactNode;
  filters?: ReactNode;
  layout?: 'default' | 'table-workbench';
  metrics?: ReactNode;
  overview?: ReactNode;
  pageId?: ManagementPageId;
};

export function ManagementPageScaffold({
  children,
  feedback,
  filters,
  layout = 'default',
  metrics,
  overview,
  pageId
}: ManagementPageScaffoldProps) {
  return (
    <div className="management-page-scaffold" data-layout={layout} data-page={pageId}>
      {feedback}
      {metrics}
      {overview}
      {filters}
      {children}
    </div>
  );
}
