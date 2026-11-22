import type { EffectiveAuthorization, SystemPermission } from './authorizationModel';
import { hasBusinessPermission, hasSystemPermission } from './authorizationModel';

export type RouteAccessRequirement = {
  business?: string;
  system?: SystemPermission;
};

export const routeByMenuKey: Record<string, string> = {
  'my-work-overview': '/my-work/overview',
  'my-work-tasks': '/my-work/tasks',
  'my-work-task-submit': '/my-work/task-submit',
  'my-work-task-acceptance': '/my-work/task-acceptance',
  'my-work-expense-collection': '/my-work/expense-collection',
  'my-work-expense-review': '/my-work/expense-review',
  'my-work-archive': '/my-work/archive',
  'my-work-salary': '/my-work/salary',
  'my-work-performance': '/my-work/performance',
  'people-overview': '/people/overview',
  'people-archives': '/people/archives',
  'people-movements': '/people/movements',
  'people-position-permissions': '/people/position-permissions',
  'people-attendance': '/people/attendance',
  'people-attendance-monthly': '/people/attendance-monthly',
  'customers-archives': '/customers/archives',
  'customers-brands': '/customers/brands',
  'customers-stores': '/customers/stores',
  'customers-contracts': '/customers/contracts',
  'tasks-dashboard': '/tasks/dashboard',
  'tasks-list': '/tasks/list',
  'tasks-people': '/tasks/people',
  'tasks-feedback': '/tasks/feedback',
  'performance-dashboard': '/performance/dashboard',
  'performance-rules': '/performance/rules',
  'performance-signatures': '/performance/signatures',
  'performance-monthly': '/performance/monthly',
  'salary-overview': '/salary/overview',
  'salary-monthly': '/salary/monthly',
  'salary-social-insurance': '/salary/social-insurance',
  'salary-personal-income-tax': '/salary/personal-income-tax',
  'finance-business-overview': '/finance/business-overview',
  'finance-receivables-payables': '/finance/receivables-payables',
  'finance-transactions': '/finance/transactions',
  'finance-review': '/finance/review',
  'finance-bank-reconciliation': '/finance/bank-reconciliation',
  'finance-account-ledger': '/finance/account-ledger',
  'finance-accounting-subjects': '/finance/accounting-subjects',
  'finance-accounting-vouchers': '/finance/accounting-vouchers',
  'finance-assets-prepayments': '/finance/assets-prepayments',
  'finance-month-end': '/finance/month-end',
  'finance-general-ledger': '/finance/general-ledger',
  'finance-period-close': '/finance/period-close',
  'finance-financial-statements': '/finance/financial-statements',
  'tax-invoices': '/tax/invoices',
  'tax-declaration-preparation': '/tax/declaration-preparation',
  'tax-handling': '/tax/handling',
  'system-roles': '/system/roles',
  'system-system-roles': '/system/system-roles',
  'system-task-config': '/system/task-config',
  'system-work-calendar': '/system/work-calendar',
  'system-ledger-initialization': '/system/ledger-initialization',
  'system-finance-categories': '/system/finance-categories',
  'system-public-accounts': '/system/public-accounts',
  'system-social-insurance-config': '/system/social-insurance-config',
  'system-tax-policy': '/system/tax-policy'
};

const routeAccessRequirements: Array<[string, RouteAccessRequirement]> = [
  ['/my-work/overview', {}],
  ['/my-work/tasks', {}],
  ['/my-work/task-submit', { business: 'task.submit' }],
  ['/my-work/task-acceptance', { business: 'task.accept' }],
  ['/my-work/expense-collection', {}],
  ['/my-work/expense-review', { business: 'finance.manage' }],
  ['/my-work/archive', {}],
  ['/my-work/salary', {}],
  ['/my-work/performance', {}],
  ['/people/overview', { business: 'people.overview.read' }],
  ['/people/archives', { business: 'people.archive.read' }],
  ['/people/movements', { business: 'people.movement.manage' }],
  ['/people/position-permissions', { business: 'people.position.manage' }],
  ['/people/attendance-monthly', { business: 'people.attendance.manage' }],
  ['/people/attendance', { business: 'people.attendance.manage' }],
  ['/customers', { business: 'customer.manage' }],
  ['/tasks/dashboard', { business: 'task.read' }],
  ['/tasks/list', { business: 'task.manage' }],
  ['/tasks/people', { business: 'task.manage' }],
  ['/tasks/feedback', { business: 'task.read' }],
  ['/performance/dashboard', { business: 'performance.read' }],
  ['/performance/rules', { business: 'performance.manage' }],
  ['/performance/signatures', { business: 'performance.manage' }],
  ['/performance/monthly', { business: 'performance.manage' }],
  ['/salary', { business: 'salary.manage' }],
  ['/finance/business-overview', { business: 'finance.read' }],
  ['/finance', { business: 'finance.manage' }],
  ['/tax', { business: 'tax.manage' }],
  ['/system/roles', { system: 'system.roles.view' }],
  ['/system/system-roles', { system: 'system.roles.view' }],
  ['/system/ledger-initialization', { system: 'system.initialization.manage' }],
  ['/system', { system: 'system.configuration.manage' }]
];

const redirectTargets: Record<string, string> = {
  '/': '/people/overview',
  '/people': '/people/overview',
  '/my-work': '/my-work/overview',
  '/people/organization': '/people/overview',
  '/people/capability': '/people/position-permissions',
  '/people/expiry': '/people/overview',
  '/people/roles': '/system/roles',
  '/customers': '/customers/archives',
  '/tasks': '/tasks/dashboard',
  '/tasks/store-tasks': '/tasks/list',
  '/finance': '/finance/business-overview',
  '/finance/overview': '/finance/business-overview',
  '/tax': '/tax/invoices',
  '/salary': '/salary/overview',
  '/salary/adjustments': '/salary/monthly',
  '/performance': '/performance/dashboard',
  '/performance/records': '/performance/monthly'
};

const controlledRoutePrefixes = [
  '/my-work',
  '/people',
  '/customers',
  '/tasks',
  '/performance',
  '/salary',
  '/finance',
  '/tax',
  '/system'
];

export function getRouteAccessRequirement(pathname: string) {
  return routeAccessRequirements.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1];
}

export function canAccessRoute(authorization: EffectiveAuthorization, pathname: string) {
  if (authorization.account.status !== '启用') {
    return false;
  }

  const redirectTarget = redirectTargets[pathname];
  if (redirectTarget) {
    return canAccessRoute(authorization, redirectTarget);
  }

  const requirement = getRouteAccessRequirement(pathname);
  if (!requirement) {
    return !controlledRoutePrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );
  }

  return (!requirement.business || hasBusinessPermission(authorization, requirement.business))
    && (!requirement.system || hasSystemPermission(authorization, requirement.system));
}
