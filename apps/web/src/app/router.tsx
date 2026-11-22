import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import {
  useCustomerContractReceiptViews,
  useSalaryFinanceLink,
  useSocialInsuranceEnrollmentProfiles,
  useTaskContractUsageSummaries,
  useTaskPerformanceSummaryLookup
} from './moduleLinks';
import { AppShell } from './shell';

const PeopleOverviewPage = lazy(() =>
  import('../modules/people-overview/pages').then((module) => ({
    default: module.PeopleOverviewPage
  }))
);
const PeopleArchivesPage = lazy(() =>
  import('../modules/people/pages').then((module) => ({
    default: module.PeopleArchivesPage
  }))
);
const PeoplePositionManagementPage = lazy(() =>
  import('../modules/people/pages').then((module) => ({
    default: module.PeoplePositionManagementPage
  }))
);
const PeopleRolesPage = lazy(() =>
  import('../modules/people/pages').then((module) => ({
    default: module.PeopleRolesPage
  }))
);
const SystemTaskConfigPage = lazy(() =>
  import('../modules/tasks/pages').then((module) => ({
    default: module.SystemTaskConfigPage
  }))
);
const SystemWorkCalendarPage = lazy(() =>
  import('../modules/people/pages').then((module) => ({
    default: module.SystemWorkCalendarPage
  }))
);
const SystemFinanceCategoryPage = lazy(() =>
  import('../modules/finance/pages').then((module) => ({
    default: module.SystemFinanceCategoryPage
  }))
);
const SystemPublicAccountConfigPage = lazy(() =>
  import('../modules/finance/pages').then((module) => ({
    default: module.SystemPublicAccountConfigPage
  }))
);
const SystemSocialInsuranceConfigPage = lazy(() =>
  import('../modules/social-insurance/pages').then((module) => ({
    default: module.SystemSocialInsuranceConfigPage
  }))
);
const SystemTaxPolicyPage = lazy(() =>
  import('../modules/finance/pages').then((module) => ({
    default: module.SystemTaxPolicyPage
  }))
);
const SystemRolesPage = lazy(() =>
  import('../modules/people/pages').then((module) => ({
    default: module.SystemRolesPage
  }))
);
const PerformanceDashboardPage = lazy(() =>
  import('../modules/performance/pages').then((module) => ({
    default: module.PerformanceDashboardPage
  }))
);
const PerformanceRulesPage = lazy(() =>
  import('../modules/performance-rules/pages').then((module) => ({
    default: module.PerformanceRulesPage
  }))
);
const PerformanceSignaturesPage = lazy(() =>
  import('../modules/performance/pages').then((module) => ({
    default: module.PerformanceSignaturesPage
  }))
);
const PerformanceMonthlyPage = lazy(() =>
  import('../modules/performance/pages').then((module) => ({
    default: module.PerformanceMonthlyPage
  }))
);
const SalaryOverviewPage = lazy(() =>
  import('../modules/salary/pages').then((module) => ({
    default: module.SalaryOverviewPage
  }))
);
const SalaryMonthlyPage = lazy(() =>
  import('../modules/salary/pages').then((module) => ({
    default: module.SalaryMonthlyPage
  }))
);
const SalaryPersonalIncomeTaxDeductionsPage = lazy(() =>
  import('../modules/salary/pages').then((module) => ({
    default: module.SalaryPersonalIncomeTaxDeductionsPage
  }))
);
const CustomerArchivePage = lazy(() =>
  import('../modules/customers/pages').then((module) => ({
    default: module.CustomerArchivePage
  }))
);
const BrandManagementPage = lazy(() =>
  import('../modules/customers/pages').then((module) => ({
    default: module.BrandManagementPage
  }))
);
const StoreManagementPage = lazy(() =>
  import('../modules/customers/pages').then((module) => ({
    default: module.StoreManagementPage
  }))
);
const CustomerContractsPage = lazy(() =>
  import('../modules/customers/pages').then((module) => ({
    default: module.CustomerContractsPage
  }))
);
const TaskDashboardPage = lazy(() =>
  import('../modules/tasks/pages').then((module) => ({
    default: module.TaskDashboardPage
  }))
);
const TaskListPage = lazy(() =>
  import('../modules/tasks/pages').then((module) => ({
    default: module.TaskListPage
  }))
);
const PeopleTasksPage = lazy(() =>
  import('../modules/tasks/pages').then((module) => ({
    default: module.PeopleTasksPage
  }))
);
const TaskFeedbackPage = lazy(() =>
  import('../modules/tasks/pages').then((module) => ({
    default: module.TaskFeedbackPage
  }))
);
const FinanceBusinessOverviewPage = lazy(() =>
  import('../modules/finance/pages').then((module) => ({
    default: module.FinanceBusinessOverviewPage
  }))
);
const FinanceReceivablesPayablesPage = lazy(() =>
  import('../modules/finance/pages').then((module) => ({
    default: module.FinanceReceivablesPayablesPage
  }))
);
const FinanceInvoicesPage = lazy(() =>
  import('../modules/finance/pages').then((module) => ({
    default: module.FinanceInvoicesPage
  }))
);
const FinanceDeclarationPreparationPage = lazy(() =>
  import('../modules/finance/pages').then((module) => ({
    default: module.FinanceDeclarationPreparationPage
  }))
);
const FinanceTaxFilingsPage = lazy(() =>
  import('../modules/finance/pages').then((module) => ({
    default: module.FinanceTaxFilingsPage
  }))
);
const FinanceSocialInsurancePage = lazy(() =>
  import('../modules/finance/pages').then((module) => ({
    default: module.FinanceSocialInsurancePage
  }))
);
const FinanceTransactionsPage = lazy(() =>
  import('../modules/finance/pages').then((module) => ({
    default: module.FinanceTransactionsPage
  }))
);
const FinanceReviewPage = lazy(() =>
  import('../modules/finance/pages').then((module) => ({
    default: module.FinanceReviewPage
  }))
);
const FinanceAccountLedgerPage = lazy(() =>
  import('../modules/finance/pages').then((module) => ({
    default: module.FinanceAccountLedgerPage
  }))
);
const FinanceLedgerInitializationPage = lazy(() =>
  import('../modules/finance/pages').then((module) => ({
    default: module.FinanceLedgerInitializationPage
  }))
);
const FinanceAccountingSubjectsPage = lazy(() =>
  import('../modules/finance/pages').then((module) => ({
    default: module.FinanceAccountingSubjectsPage
  }))
);
const FinanceAccountingVouchersPage = lazy(() =>
  import('../modules/finance/pages').then((module) => ({
    default: module.FinanceAccountingVouchersPage
  }))
);
const FinanceAssetsPrepaymentsPage = lazy(() =>
  import('../modules/finance/pages').then((module) => ({
    default: module.FinanceAssetsPrepaymentsPage
  }))
);
const FinanceMonthEndMattersPage = lazy(() =>
  import('../modules/finance/pages').then((module) => ({
    default: module.FinanceMonthEndMattersPage
  }))
);
const FinanceGeneralLedgerPage = lazy(() =>
  import('../modules/finance/pages').then((module) => ({
    default: module.FinanceGeneralLedgerPage
  }))
);
const FinancePeriodClosePage = lazy(() =>
  import('../modules/finance/pages').then((module) => ({
    default: module.FinancePeriodClosePage
  }))
);
const FinanceFinancialStatementsPage = lazy(() =>
  import('../modules/finance/pages').then((module) => ({
    default: module.FinanceFinancialStatementsPage
  }))
);
const FinanceBankReconciliationPage = lazy(() =>
  import('../modules/finance/pages').then((module) => ({
    default: module.FinanceBankReconciliationPage
  }))
);
const PeopleMovementPage = lazy(() =>
  import('../modules/people/pages').then((module) => ({
    default: module.PeopleMovementPage
  }))
);
const PeopleAttendancePage = lazy(() =>
  import('../modules/people/pages').then((module) => ({
    default: module.PeopleAttendancePage
  }))
);
const PeopleAttendanceMonthlyPage = lazy(() =>
  import('../modules/people/pages').then((module) => ({
    default: module.PeopleAttendanceMonthlyPage
  }))
);
const NotFoundPage = lazy(() =>
  import('../modules/people/pages').then((module) => ({
    default: module.NotFoundPage
  }))
);
const MyWorkOverviewPage = lazy(() =>
  import('../modules/my-work/pages').then((module) => ({
    default: module.MyWorkOverviewPage
  }))
);
const MyTasksPage = lazy(() =>
  import('../modules/my-work/pages').then((module) => ({
    default: module.MyTasksPage
  }))
);
const MyTaskSubmitPage = lazy(() =>
  import('../modules/my-work/pages').then((module) => ({
    default: module.MyTaskSubmitPage
  }))
);
const MyTaskAcceptancePage = lazy(() =>
  import('../modules/my-work/pages').then((module) => ({
    default: module.MyTaskAcceptancePage
  }))
);
const MyExpenseCollectionPage = lazy(() =>
  import('../modules/my-work/pages').then((module) => ({
    default: module.MyExpenseCollectionPage
  }))
);
const MyExpenseReviewPage = lazy(() =>
  import('../modules/my-work/pages').then((module) => ({
    default: module.MyExpenseReviewPage
  }))
);
const MyArchivePage = lazy(() =>
  import('../modules/my-work/pages').then((module) => ({
    default: module.MyArchivePage
  }))
);
const MySalaryPage = lazy(() =>
  import('../modules/my-work/pages').then((module) => ({
    default: module.MySalaryPage
  }))
);
const MyPerformancePage = lazy(() =>
  import('../modules/my-work/pages').then((module) => ({
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
        element: withPageSuspense(<PeopleArchivesPage useSocialInsuranceProfiles={useSocialInsuranceEnrollmentProfiles} />)
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
        path: 'system/system-roles',
        element: withPageSuspense(<SystemRolesPage />)
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
        element: withPageSuspense(<BrandManagementPage useTaskContractUsageSummaries={useTaskContractUsageSummaries} />)
      },
      {
        path: 'customers/stores',
        element: withPageSuspense(<StoreManagementPage />)
      },
      {
        path: 'customers/contracts',
        element: withPageSuspense(<CustomerContractsPage useContractReceiptViews={useCustomerContractReceiptViews} />)
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
        element: withPageSuspense(<TaskListPage usePerformanceSummaryLookup={useTaskPerformanceSummaryLookup} />)
      },
      {
        path: 'tasks/people',
        element: withPageSuspense(<PeopleTasksPage usePerformanceSummaryLookup={useTaskPerformanceSummaryLookup} />)
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
        path: 'finance/assets-prepayments',
        element: withPageSuspense(<FinanceAssetsPrepaymentsPage />)
      },
      {
        path: 'finance/month-end',
        element: withPageSuspense(<FinanceMonthEndMattersPage />)
      },
      {
        path: 'finance/general-ledger',
        element: withPageSuspense(<FinanceGeneralLedgerPage />)
      },
      {
        path: 'finance/period-close',
        element: withPageSuspense(<FinancePeriodClosePage />)
      },
      {
        path: 'finance/financial-statements',
        element: withPageSuspense(<FinanceFinancialStatementsPage />)
      },
      {
        path: 'system/ledger-initialization',
        element: withPageSuspense(<FinanceLedgerInitializationPage />)
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
        element: withPageSuspense(<SalaryMonthlyPage useFinanceLink={useSalaryFinanceLink} />)
      },
      {
        path: 'salary/personal-income-tax',
        element: withPageSuspense(<SalaryPersonalIncomeTaxDeductionsPage />)
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
], { basename: import.meta.env.BASE_URL });
