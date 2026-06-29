import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './shell';

const PeopleOverviewPage = lazy(() =>
  import('../features/people/PeopleOverviewPage').then((module) => ({
    default: module.PeopleOverviewPage
  }))
);
const PeopleArchivesPage = lazy(() =>
  import('../features/people/PeopleArchivesPage').then((module) => ({
    default: module.PeopleArchivesPage
  }))
);
const PeoplePositionManagementPage = lazy(() =>
  import('../features/people/PeoplePositionManagementPage').then((module) => ({
    default: module.PeoplePositionManagementPage
  }))
);
const PeopleRolesPage = lazy(() =>
  import('../features/people/PeopleRolesPage').then((module) => ({
    default: module.PeopleRolesPage
  }))
);
const SystemTaskConfigPage = lazy(() =>
  import('../features/system/SystemTaskConfigPage').then((module) => ({
    default: module.SystemTaskConfigPage
  }))
);
const SystemWorkCalendarPage = lazy(() =>
  import('../features/system/SystemWorkCalendarPage').then((module) => ({
    default: module.SystemWorkCalendarPage
  }))
);
const SystemFinanceCategoryPage = lazy(() =>
  import('../features/system/SystemFinanceCategoryPage').then((module) => ({
    default: module.SystemFinanceCategoryPage
  }))
);
const SystemPublicAccountConfigPage = lazy(() =>
  import('../features/system/SystemPublicAccountConfigPage').then((module) => ({
    default: module.SystemPublicAccountConfigPage
  }))
);
const SystemSocialInsuranceConfigPage = lazy(() =>
  import('../features/system/SystemSocialInsuranceConfigPage').then((module) => ({
    default: module.SystemSocialInsuranceConfigPage
  }))
);
const SystemTaxPolicyPage = lazy(() =>
  import('../features/system/SystemTaxPolicyPage').then((module) => ({
    default: module.SystemTaxPolicyPage
  }))
);
const PerformanceDashboardPage = lazy(() =>
  import('../features/performance/PerformanceDashboardPage').then((module) => ({
    default: module.PerformanceDashboardPage
  }))
);
const PerformanceRulesPage = lazy(() =>
  import('../features/performance/PerformanceRulesPage').then((module) => ({
    default: module.PerformanceRulesPage
  }))
);
const PerformanceSignaturesPage = lazy(() =>
  import('../features/performance/PerformanceSignaturesPage').then((module) => ({
    default: module.PerformanceSignaturesPage
  }))
);
const PerformanceMonthlyPage = lazy(() =>
  import('../features/performance/PerformanceMonthlyPage').then((module) => ({
    default: module.PerformanceMonthlyPage
  }))
);
const SalaryOverviewPage = lazy(() =>
  import('../features/salary/SalaryOverviewPage').then((module) => ({
    default: module.SalaryOverviewPage
  }))
);
const SalaryMonthlyPage = lazy(() =>
  import('../features/salary/SalaryMonthlyPage').then((module) => ({
    default: module.SalaryMonthlyPage
  }))
);
const CustomerArchivePage = lazy(() =>
  import('../features/customers/CustomerArchivePage').then((module) => ({
    default: module.CustomerArchivePage
  }))
);
const BrandManagementPage = lazy(() =>
  import('../features/customers/BrandManagementPage').then((module) => ({
    default: module.BrandManagementPage
  }))
);
const StoreManagementPage = lazy(() =>
  import('../features/customers/StoreManagementPage').then((module) => ({
    default: module.StoreManagementPage
  }))
);
const CustomerContractsPage = lazy(() =>
  import('../features/customers/CustomerContractsPage').then((module) => ({
    default: module.CustomerContractsPage
  }))
);
const TaskDashboardPage = lazy(() =>
  import('../features/tasks/TaskDashboardPage').then((module) => ({
    default: module.TaskDashboardPage
  }))
);
const TaskListPage = lazy(() =>
  import('../features/tasks/StoreTasksPage').then((module) => ({
    default: module.TaskListPage
  }))
);
const PeopleTasksPage = lazy(() =>
  import('../features/tasks/PeopleTasksPage').then((module) => ({
    default: module.PeopleTasksPage
  }))
);
const TaskFeedbackPage = lazy(() =>
  import('../features/tasks/TaskFeedbackPage').then((module) => ({
    default: module.TaskFeedbackPage
  }))
);
const FinanceBusinessOverviewPage = lazy(() =>
  import('../features/finance/FinanceBusinessOverviewPage').then((module) => ({
    default: module.FinanceBusinessOverviewPage
  }))
);
const FinanceReceivablesPayablesPage = lazy(() =>
  import('../features/finance/FinanceReceivablesPayablesPage').then((module) => ({
    default: module.FinanceReceivablesPayablesPage
  }))
);
const FinanceInvoicesPage = lazy(() =>
  import('../features/finance/FinanceInvoicesPage').then((module) => ({
    default: module.FinanceInvoicesPage
  }))
);
const FinanceInvoiceMatchingPage = lazy(() =>
  import('../features/finance/FinanceInvoiceMatchingPage').then((module) => ({
    default: module.FinanceInvoiceMatchingPage
  }))
);
const FinanceDeclarationPreparationPage = lazy(() =>
  import('../features/finance/FinanceDeclarationPreparationPage').then((module) => ({
    default: module.FinanceDeclarationPreparationPage
  }))
);
const FinanceTaxFilingsPage = lazy(() =>
  import('../features/finance/FinanceTaxFilingsPage').then((module) => ({
    default: module.FinanceTaxFilingsPage
  }))
);
const FinanceSocialInsurancePage = lazy(() =>
  import('../features/finance/FinanceTaxFilingsPage').then((module) => ({
    default: module.FinanceSocialInsurancePage
  }))
);
const FinanceTransactionsPage = lazy(() =>
  import('../features/finance/FinanceTransactionsPage').then((module) => ({
    default: module.FinanceTransactionsPage
  }))
);
const FinanceReviewPage = lazy(() =>
  import('../features/finance/FinanceReviewPage').then((module) => ({
    default: module.FinanceReviewPage
  }))
);
const FinanceAccountLedgerPage = lazy(() =>
  import('../features/finance/FinanceAccountLedgerPage').then((module) => ({
    default: module.FinanceAccountLedgerPage
  }))
);
const FinanceAccountingSubjectsPage = lazy(() =>
  import('../features/finance/FinanceAccountingSubjectsPage').then((module) => ({
    default: module.FinanceAccountingSubjectsPage
  }))
);
const FinanceAccountingVouchersPage = lazy(() =>
  import('../features/finance/FinanceAccountingVouchersPage').then((module) => ({
    default: module.FinanceAccountingVouchersPage
  }))
);
const FinanceBankReconciliationPage = lazy(() =>
  import('../features/finance/FinanceBankReconciliationPage').then((module) => ({
    default: module.FinanceBankReconciliationPage
  }))
);
const PeopleMovementPage = lazy(() =>
  import('../features/people/PeopleMovementPage').then((module) => ({
    default: module.PeopleMovementPage
  }))
);
const PeopleAttendancePage = lazy(() =>
  import('../features/people/PeopleAttendancePage').then((module) => ({
    default: module.PeopleAttendancePage
  }))
);
const PeopleAttendanceMonthlyPage = lazy(() =>
  import('../features/people/PeopleAttendanceMonthlyPage').then((module) => ({
    default: module.PeopleAttendanceMonthlyPage
  }))
);
const NotFoundPage = lazy(() =>
  import('../features/people/NotFoundPage').then((module) => ({
    default: module.NotFoundPage
  }))
);
const MyWorkOverviewPage = lazy(() =>
  import('../features/my-work/MyWorkPages').then((module) => ({
    default: module.MyWorkOverviewPage
  }))
);
const MyTasksPage = lazy(() =>
  import('../features/my-work/MyWorkPages').then((module) => ({
    default: module.MyTasksPage
  }))
);
const MyTaskSubmitPage = lazy(() =>
  import('../features/my-work/MyWorkPages').then((module) => ({
    default: module.MyTaskSubmitPage
  }))
);
const MyTaskAcceptancePage = lazy(() =>
  import('../features/my-work/MyWorkPages').then((module) => ({
    default: module.MyTaskAcceptancePage
  }))
);
const MyExpenseCollectionPage = lazy(() =>
  import('../features/my-work/MyExpenseCollectionPage').then((module) => ({
    default: module.MyExpenseCollectionPage
  }))
);
const MyExpenseReviewPage = lazy(() =>
  import('../features/my-work/MyExpenseReviewPage').then((module) => ({
    default: module.MyExpenseReviewPage
  }))
);
const MyArchivePage = lazy(() =>
  import('../features/my-work/MyWorkPages').then((module) => ({
    default: module.MyArchivePage
  }))
);
const MySalaryPage = lazy(() =>
  import('../features/my-work/MyWorkPages').then((module) => ({
    default: module.MySalaryPage
  }))
);
const MyPerformancePage = lazy(() =>
  import('../features/my-work/MyWorkPages').then((module) => ({
    default: module.MyPerformancePage
  }))
);

function withPageSuspense(page: ReactNode) {
  return <Suspense fallback={<div className="route-loading">页面加载中...</div>}>{page}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <Navigate to="/people/overview" replace />
      },
      {
        path: 'people',
        element: <Navigate to="/people/overview" replace />
      },
      {
        path: 'my-work',
        element: <Navigate to="/my-work/overview" replace />
      },
      {
        path: 'my-work/overview',
        element: withPageSuspense(<MyWorkOverviewPage />)
      },
      {
        path: 'my-work/tasks',
        element: withPageSuspense(<MyTasksPage />)
      },
      {
        path: 'my-work/task-submit',
        element: withPageSuspense(<MyTaskSubmitPage />)
      },
      {
        path: 'my-work/task-acceptance',
        element: withPageSuspense(<MyTaskAcceptancePage />)
      },
      {
        path: 'my-work/expense-collection',
        element: withPageSuspense(<MyExpenseCollectionPage />)
      },
      {
        path: 'my-work/expense-review',
        element: withPageSuspense(<MyExpenseReviewPage />)
      },
      {
        path: 'my-work/archive',
        element: withPageSuspense(<MyArchivePage />)
      },
      {
        path: 'my-work/salary',
        element: withPageSuspense(<MySalaryPage />)
      },
      {
        path: 'my-work/performance',
        element: withPageSuspense(<MyPerformancePage />)
      },
      {
        path: 'people/overview',
        element: withPageSuspense(<PeopleOverviewPage />)
      },
      {
        path: 'people/archives',
        element: withPageSuspense(<PeopleArchivesPage />)
      },
      {
        path: 'people/organization',
        element: <Navigate to="/people/overview" replace />
      },
      {
        path: 'people/position-permissions',
        element: withPageSuspense(<PeoplePositionManagementPage />)
      },
      {
        path: 'people/capability',
        element: <Navigate to="/people/position-permissions" replace />
      },
      {
        path: 'people/movements',
        element: withPageSuspense(<PeopleMovementPage />)
      },
      {
        path: 'people/expiry',
        element: <Navigate to="/people/overview" replace />
      },
      {
        path: 'people/attendance',
        element: withPageSuspense(<PeopleAttendancePage />)
      },
      {
        path: 'people/attendance-monthly',
        element: withPageSuspense(<PeopleAttendanceMonthlyPage />)
      },
      {
        path: 'people/roles',
        element: <Navigate to="/system/roles" replace />
      },
      {
        path: 'system/roles',
        element: withPageSuspense(<PeopleRolesPage />)
      },
      {
        path: 'system/task-config',
        element: withPageSuspense(<SystemTaskConfigPage />)
      },
      {
        path: 'system/work-calendar',
        element: withPageSuspense(<SystemWorkCalendarPage />)
      },
      {
        path: 'system/finance-categories',
        element: withPageSuspense(<SystemFinanceCategoryPage />)
      },
      {
        path: 'system/public-accounts',
        element: withPageSuspense(<SystemPublicAccountConfigPage />)
      },
      {
        path: 'system/social-insurance-config',
        element: withPageSuspense(<SystemSocialInsuranceConfigPage />)
      },
      {
        path: 'system/tax-policy',
        element: withPageSuspense(<SystemTaxPolicyPage />)
      },
      {
        path: 'customers',
        element: <Navigate to="/customers/archives" replace />
      },
      {
        path: 'customers/archives',
        element: withPageSuspense(<CustomerArchivePage />)
      },
      {
        path: 'customers/brands',
        element: withPageSuspense(<BrandManagementPage />)
      },
      {
        path: 'customers/stores',
        element: withPageSuspense(<StoreManagementPage />)
      },
      {
        path: 'customers/contracts',
        element: withPageSuspense(<CustomerContractsPage />)
      },
      {
        path: 'tasks',
        element: <Navigate to="/tasks/dashboard" replace />
      },
      {
        path: 'tasks/dashboard',
        element: withPageSuspense(<TaskDashboardPage />)
      },
      {
        path: 'tasks/list',
        element: withPageSuspense(<TaskListPage />)
      },
      {
        path: 'tasks/people',
        element: withPageSuspense(<PeopleTasksPage />)
      },
      {
        path: 'tasks/store-tasks',
        element: <Navigate to="/tasks/list" replace />
      },
      {
        path: 'tasks/feedback',
        element: withPageSuspense(<TaskFeedbackPage />)
      },
      {
        path: 'finance',
        element: <Navigate to="/finance/business-overview" replace />
      },
      {
        path: 'finance/overview',
        element: <Navigate to="/finance/business-overview" replace />
      },
      {
        path: 'finance/business-overview',
        element: withPageSuspense(<FinanceBusinessOverviewPage />)
      },
      {
        path: 'finance/receivables-payables',
        element: withPageSuspense(<FinanceReceivablesPayablesPage />)
      },
      {
        path: 'finance/transactions',
        element: withPageSuspense(<FinanceTransactionsPage />)
      },
      {
        path: 'finance/review',
        element: withPageSuspense(<FinanceReviewPage />)
      },
      {
        path: 'finance/bank-reconciliation',
        element: withPageSuspense(<FinanceBankReconciliationPage />)
      },
      {
        path: 'finance/account-ledger',
        element: withPageSuspense(<FinanceAccountLedgerPage />)
      },
      {
        path: 'finance/accounting-subjects',
        element: withPageSuspense(<FinanceAccountingSubjectsPage />)
      },
      {
        path: 'finance/accounting-vouchers',
        element: withPageSuspense(<FinanceAccountingVouchersPage />)
      },
      {
        path: 'tax',
        element: <Navigate to="/tax/invoices" replace />
      },
      {
        path: 'tax/invoices',
        element: withPageSuspense(<FinanceInvoicesPage />)
      },
      {
        path: 'tax/invoice-matching',
        element: withPageSuspense(<FinanceInvoiceMatchingPage />)
      },
      {
        path: 'tax/declaration-preparation',
        element: withPageSuspense(<FinanceDeclarationPreparationPage />)
      },
      {
        path: 'tax/handling',
        element: withPageSuspense(<FinanceTaxFilingsPage />)
      },
      {
        path: 'salary/social-insurance',
        element: withPageSuspense(<FinanceSocialInsurancePage />)
      },
      {
        path: 'salary',
        element: <Navigate to="/salary/overview" replace />
      },
      {
        path: 'salary/overview',
        element: withPageSuspense(<SalaryOverviewPage />)
      },
      {
        path: 'salary/monthly',
        element: withPageSuspense(<SalaryMonthlyPage />)
      },
      {
        path: 'salary/adjustments',
        element: <Navigate to="/salary/monthly" replace />
      },
      {
        path: 'performance',
        element: <Navigate to="/performance/dashboard" replace />
      },
      {
        path: 'performance/dashboard',
        element: withPageSuspense(<PerformanceDashboardPage />)
      },
      {
        path: 'performance/rules',
        element: withPageSuspense(<PerformanceRulesPage />)
      },
      {
        path: 'performance/signatures',
        element: withPageSuspense(<PerformanceSignaturesPage />)
      },
      {
        path: 'performance/monthly',
        element: withPageSuspense(<PerformanceMonthlyPage />)
      },
      {
        path: 'performance/records',
        element: <Navigate to="/performance/monthly" replace />
      },
      {
        path: '*',
        element: withPageSuspense(<NotFoundPage />)
      }
    ]
  }
]);
