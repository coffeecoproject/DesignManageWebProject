import {
  AppstoreOutlined,
  AuditOutlined,
  BarChartOutlined,
  BankOutlined,
  BellOutlined,
  BookOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  HomeOutlined,
  LineChartOutlined,
  LockOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  PercentageOutlined,
  PartitionOutlined,
  ProfileOutlined,
  ProjectOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  SettingOutlined,
  ShopOutlined,
  SwapOutlined,
  TeamOutlined,
  UserOutlined,
  UserSwitchOutlined,
  WalletOutlined
} from '@ant-design/icons';
import { Avatar, Badge, Breadcrumb, Button, Layout, Menu, Space, Tooltip } from 'antd';
import { useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

const { Header, Sider, Content } = Layout;

const pageMeta: Record<string, { module: string; title: string }> = {
  '/my-work/overview': {
    module: '我的工作',
    title: '工作概览'
  },
  '/my-work/tasks': {
    module: '我的工作',
    title: '我的任务'
  },
  '/my-work/task-submit': {
    module: '我的工作',
    title: '待我提交'
  },
  '/my-work/task-acceptance': {
    module: '我的工作',
    title: '待我验收'
  },
  '/my-work/expense-collection': {
    module: '我的工作',
    title: '费用与代收'
  },
  '/my-work/expense-review': {
    module: '我的工作',
    title: '费用报销审核'
  },
  '/my-work/archive': {
    module: '我的工作',
    title: '我的档案'
  },
  '/my-work/salary': {
    module: '我的工作',
    title: '我的薪资'
  },
  '/my-work/performance': {
    module: '我的工作',
    title: '我的绩效'
  },
  '/people/overview': {
    module: '人员组织',
    title: '人员总览'
  },
  '/people/archives': {
    module: '人员组织',
    title: '人员档案'
  },
  '/people/position-permissions': {
    module: '人员组织',
    title: '岗位管理'
  },
  '/people/movements': {
    module: '人员组织',
    title: '人事异动'
  },
  '/people/attendance': {
    module: '人员组织',
    title: '考勤假勤'
  },
  '/people/attendance-monthly': {
    module: '人员组织',
    title: '考勤月报'
  },
  '/customers/archives': {
    module: '客户管理',
    title: '客户档案'
  },
  '/customers/brands': {
    module: '客户管理',
    title: '品牌管理'
  },
  '/customers/stores': {
    module: '客户管理',
    title: '门店管理'
  },
  '/customers/contracts': {
    module: '客户管理',
    title: '合同管理'
  },
  '/tasks/list': {
    module: '任务管理',
    title: '任务列表'
  },
  '/tasks/dashboard': {
    module: '任务管理',
    title: '任务看板'
  },
  '/tasks/people': {
    module: '任务管理',
    title: '人员任务'
  },
  '/tasks/feedback': {
    module: '任务管理',
    title: '任务反馈'
  },
  '/performance/dashboard': {
    module: '绩效管理',
    title: '绩效看板'
  },
  '/performance/rules': {
    module: '绩效管理',
    title: '绩效规则'
  },
  '/performance/signatures': {
    module: '绩效管理',
    title: '签署档案'
  },
  '/performance/monthly': {
    module: '绩效管理',
    title: '绩效明细'
  },
  '/performance/records': {
    module: '绩效管理',
    title: '绩效明细'
  },
  '/salary/overview': {
    module: '薪酬社保',
    title: '薪酬总览'
  },
  '/salary/monthly': {
    module: '薪酬社保',
    title: '薪酬明细'
  },
  '/salary/social-insurance': {
    module: '薪酬社保',
    title: '社保公积金'
  },
  '/salary/personal-income-tax': {
    module: '薪酬社保',
    title: '个税信息'
  },
  '/finance/business-overview': {
    module: '财务管理',
    title: '经营总览'
  },
  '/finance/receivables-payables': {
    module: '财务管理',
    title: '应收应付'
  },
  '/tax/invoices': {
    module: '税务管理',
    title: '发票台账'
  },
  '/tax/declaration-preparation': {
    module: '税务管理',
    title: '申报准备'
  },
  '/tax/handling': {
    module: '税务管理',
    title: '税务办理'
  },
  '/finance/transactions': {
    module: '财务管理',
    title: '收支流水'
  },
  '/finance/review': {
    module: '财务管理',
    title: '流水复核'
  },
  '/finance/bank-reconciliation': {
    module: '财务管理',
    title: '银行对账'
  },
  '/finance/account-ledger': {
    module: '财务管理',
    title: '账户台账'
  },
  '/finance/accounting-subjects': {
    module: '财务管理',
    title: '会计科目'
  },
  '/finance/accounting-vouchers': {
    module: '财务管理',
    title: '会计凭证'
  },
  '/finance/assets-prepayments': {
    module: '财务管理',
    title: '资产与待摊'
  },
  '/finance/month-end': {
    module: '财务管理',
    title: '月末事项'
  },
  '/finance/general-ledger': {
    module: '财务管理',
    title: '总账'
  },
  '/finance/period-close': {
    module: '财务管理',
    title: '期间结账'
  },
  '/finance/financial-statements': {
    module: '财务管理',
    title: '财务报表'
  },
  '/system/roles': {
    module: '系统管理',
    title: '业务角色'
  },
  '/system/task-config': {
    module: '系统管理',
    title: '任务配置'
  },
  '/system/work-calendar': {
    module: '系统管理',
    title: '工作日历'
  },
  '/system/ledger-initialization': {
    module: '系统管理',
    title: '账套初始化'
  },
  '/system/finance-categories': {
    module: '系统管理',
    title: '财务类目'
  },
  '/system/public-accounts': {
    module: '系统管理',
    title: '对公账户配置'
  },
  '/system/social-insurance-config': {
    module: '系统管理',
    title: '社保公积金配置'
  },
  '/system/tax-policy': {
    module: '系统管理',
    title: '税务口径'
  }
};

function getSelectedKeys(pathname: string) {
  if (pathname.startsWith('/my-work/overview')) {
    return ['my-work-overview'];
  }

  if (pathname.startsWith('/my-work/tasks')) {
    return ['my-work-tasks'];
  }

  if (pathname.startsWith('/my-work/task-submit')) {
    return ['my-work-task-submit'];
  }

  if (pathname.startsWith('/my-work/task-acceptance')) {
    return ['my-work-task-acceptance'];
  }

  if (pathname.startsWith('/my-work/expense-collection')) {
    return ['my-work-expense-collection'];
  }

  if (pathname.startsWith('/my-work/expense-review')) {
    return ['my-work-expense-review'];
  }

  if (pathname.startsWith('/my-work/archive')) {
    return ['my-work-archive'];
  }

  if (pathname.startsWith('/my-work/salary')) {
    return ['my-work-salary'];
  }

  if (pathname.startsWith('/my-work/performance')) {
    return ['my-work-performance'];
  }

  if (pathname.startsWith('/people/archives')) {
    return ['people-archives'];
  }

  if (pathname.startsWith('/people/position-permissions') || pathname.startsWith('/people/capability')) {
    return ['people-position-permissions'];
  }

  if (pathname.startsWith('/people/movements')) {
    return ['people-movements'];
  }

  if (pathname.startsWith('/people/expiry')) {
    return ['people-overview'];
  }

  if (pathname.startsWith('/people/attendance')) {
    if (pathname.startsWith('/people/attendance-monthly')) {
      return ['people-attendance-monthly'];
    }

    return ['people-attendance'];
  }

  if (pathname.startsWith('/system/roles') || pathname.startsWith('/people/roles')) {
    return ['system-roles'];
  }

  if (pathname.startsWith('/system/task-config')) {
    return ['system-task-config'];
  }

  if (pathname.startsWith('/system/work-calendar')) {
    return ['system-work-calendar'];
  }

  if (pathname.startsWith('/system/ledger-initialization')) {
    return ['system-ledger-initialization'];
  }

  if (pathname.startsWith('/system/finance-categories')) {
    return ['system-finance-categories'];
  }

  if (pathname.startsWith('/system/public-accounts')) {
    return ['system-public-accounts'];
  }

  if (pathname.startsWith('/customers/archives')) {
    return ['customers-archives'];
  }

  if (pathname.startsWith('/customers/brands')) {
    return ['customers-brands'];
  }

  if (pathname.startsWith('/customers/stores')) {
    return ['customers-stores'];
  }

  if (pathname.startsWith('/customers/contracts')) {
    return ['customers-contracts'];
  }

  if (pathname.startsWith('/tasks/dashboard')) {
    return ['tasks-dashboard'];
  }

  if (pathname.startsWith('/tasks/list') || pathname.startsWith('/tasks/store-tasks')) {
    return ['tasks-list'];
  }

  if (pathname.startsWith('/tasks/people')) {
    return ['tasks-people'];
  }

  if (pathname.startsWith('/tasks/feedback')) {
    return ['tasks-feedback'];
  }

  if (pathname.startsWith('/performance/dashboard')) {
    return ['performance-dashboard'];
  }

  if (pathname.startsWith('/performance/rules')) {
    return ['performance-rules'];
  }

  if (pathname.startsWith('/performance/signatures')) {
    return ['performance-signatures'];
  }

  if (pathname.startsWith('/performance/monthly') || pathname.startsWith('/performance/records')) {
    return ['performance-monthly'];
  }

  if (pathname.startsWith('/salary/overview')) {
    return ['salary-overview'];
  }

  if (pathname.startsWith('/salary/monthly')) {
    return ['salary-monthly'];
  }

  if (pathname.startsWith('/salary/social-insurance')) {
    return ['salary-social-insurance'];
  }

  if (pathname.startsWith('/salary/personal-income-tax')) {
    return ['salary-personal-income-tax'];
  }

  if (pathname.startsWith('/finance/business-overview')) {
    return ['finance-business-overview'];
  }

  if (pathname.startsWith('/finance/receivables-payables')) {
    return ['finance-receivables-payables'];
  }

  if (pathname.startsWith('/tax/invoices')) {
    return ['tax-invoices'];
  }

  if (pathname.startsWith('/tax/declaration-preparation')) {
    return ['tax-declaration-preparation'];
  }

  if (pathname.startsWith('/tax/handling')) {
    return ['tax-handling'];
  }

  if (pathname.startsWith('/finance/transactions')) {
    return ['finance-transactions'];
  }

  if (pathname.startsWith('/finance/review')) {
    return ['finance-review'];
  }

  if (pathname.startsWith('/finance/bank-reconciliation')) {
    return ['finance-bank-reconciliation'];
  }

  if (pathname.startsWith('/finance/account-ledger')) {
    return ['finance-account-ledger'];
  }

  if (pathname.startsWith('/finance/accounting-subjects')) {
    return ['finance-accounting-subjects'];
  }

  if (pathname.startsWith('/finance/accounting-vouchers')) {
    return ['finance-accounting-vouchers'];
  }

  if (pathname.startsWith('/finance/assets-prepayments')) {
    return ['finance-assets-prepayments'];
  }

  if (pathname.startsWith('/finance/month-end')) {
    return ['finance-month-end'];
  }

  if (pathname.startsWith('/finance/general-ledger')) {
    return ['finance-general-ledger'];
  }

  if (pathname.startsWith('/finance/period-close')) {
    return ['finance-period-close'];
  }

  if (pathname.startsWith('/finance/financial-statements')) {
    return ['finance-financial-statements'];
  }

  if (pathname.startsWith('/system/social-insurance-config')) {
    return ['system-social-insurance-config'];
  }

  if (pathname.startsWith('/system/tax-policy')) {
    return ['system-tax-policy'];
  }

  if (pathname.startsWith('/system/finance-categories')) {
    return ['system-finance-categories'];
  }

  if (pathname.startsWith('/system/public-accounts')) {
    return ['system-public-accounts'];
  }

  if (pathname.startsWith('/system/work-calendar')) {
    return ['system-work-calendar'];
  }

  if (pathname.startsWith('/system/task-config')) {
    return ['system-task-config'];
  }

  return ['people-overview'];
}

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const page = pageMeta[location.pathname] ?? {
    module: '系统',
    title: '页面未找到'
  };

  const menuItems = useMemo(
    () => [
      {
        key: 'my-work',
        icon: <UserOutlined />,
        label: '我的工作',
        children: [
          {
            key: 'my-work-overview',
            icon: <DashboardOutlined />,
            label: '工作概览'
          },
          {
            key: 'my-work-tasks',
            icon: <FileTextOutlined />,
            label: '我的任务'
          },
          {
            key: 'my-work-task-submit',
            icon: <SendOutlined />,
            label: '待我提交'
          },
          {
            key: 'my-work-task-acceptance',
            icon: <CheckCircleOutlined />,
            label: '待我验收'
          },
          {
            key: 'my-work-expense-collection',
            icon: <WalletOutlined />,
            label: '费用与代收'
          },
          {
            key: 'my-work-expense-review',
            icon: <AuditOutlined />,
            label: '费用报销审核'
          },
          {
            key: 'my-work-archive',
            icon: <FileProtectOutlined />,
            label: '我的档案'
          },
          {
            key: 'my-work-salary',
            icon: <WalletOutlined />,
            label: '我的薪资'
          },
          {
            key: 'my-work-performance',
            icon: <BarChartOutlined />,
            label: '我的绩效'
          }
        ]
      },
      {
        key: 'people',
        icon: <TeamOutlined />,
        label: '人员组织',
        children: [
          {
            key: 'people-overview',
            icon: <DashboardOutlined />,
            label: '人员总览'
          },
          {
            key: 'people-archives',
            icon: <FileProtectOutlined />,
            label: '人员档案'
          },
          {
            key: 'people-movements',
            icon: <SwapOutlined />,
            label: '人事异动'
          },
          {
            key: 'people-position-permissions',
            icon: <SafetyCertificateOutlined />,
            label: '岗位管理'
          },
          {
            key: 'people-attendance',
            icon: <CalendarOutlined />,
            label: '考勤假勤'
          },
          {
            key: 'people-attendance-monthly',
            icon: <FileTextOutlined />,
            label: '考勤月报'
          }
        ]
      },
      {
        key: 'customers',
        icon: <ShopOutlined />,
        label: '客户管理',
        children: [
          {
            key: 'customers-archives',
            icon: <ProfileOutlined />,
            label: '客户档案'
          },
          {
            key: 'customers-brands',
            icon: <AppstoreOutlined />,
            label: '品牌管理'
          },
          {
            key: 'customers-stores',
            icon: <HomeOutlined />,
            label: '门店管理'
          },
          {
            key: 'customers-contracts',
            icon: <FileProtectOutlined />,
            label: '合同管理'
          }
        ]
      },
      {
        key: 'tasks',
        icon: <ProjectOutlined />,
        label: '任务管理',
        children: [
          {
            key: 'tasks-dashboard',
            icon: <DashboardOutlined />,
            label: '任务看板'
          },
          {
            key: 'tasks-list',
            icon: <FileTextOutlined />,
            label: '任务列表'
          },
          {
            key: 'tasks-people',
            icon: <UserSwitchOutlined />,
            label: '人员任务'
          },
          {
            key: 'tasks-feedback',
            icon: <MessageOutlined />,
            label: '任务反馈'
          }
        ]
      },
      {
        key: 'performance',
        icon: <BarChartOutlined />,
        label: '绩效管理',
        children: [
          {
            key: 'performance-dashboard',
            icon: <DashboardOutlined />,
            label: '绩效看板'
          },
          {
            key: 'performance-rules',
            icon: <ProfileOutlined />,
            label: '绩效规则'
          },
          {
            key: 'performance-signatures',
            icon: <UserSwitchOutlined />,
            label: '签署档案'
          },
          {
            key: 'performance-monthly',
            icon: <FileTextOutlined />,
            label: '绩效明细'
          }
        ]
      },
      {
        key: 'salary',
        icon: <WalletOutlined />,
        label: '薪酬社保',
        children: [
          {
            key: 'salary-overview',
            icon: <DashboardOutlined />,
            label: '薪酬总览'
          },
          {
            key: 'salary-monthly',
            icon: <FileTextOutlined />,
            label: '薪酬明细'
          },
          {
            key: 'salary-social-insurance',
            icon: <TeamOutlined />,
            label: '社保公积金'
          },
          {
            key: 'salary-personal-income-tax',
            icon: <PercentageOutlined />,
            label: '个税信息'
          }
        ]
      },
      {
        key: 'finance',
        icon: <BankOutlined />,
        label: '财务管理',
        children: [
          {
            key: 'finance-business-overview',
            icon: <LineChartOutlined />,
            label: '经营总览'
          },
          {
            key: 'finance-receivables-payables',
            icon: <FileProtectOutlined />,
            label: '应收应付'
          },
          {
            key: 'finance-transactions',
            icon: <WalletOutlined />,
            label: '收支流水'
          },
          {
            key: 'finance-review',
            icon: <AuditOutlined />,
            label: '流水复核'
          },
          {
            key: 'finance-bank-reconciliation',
            icon: <FileSearchOutlined />,
            label: '银行对账'
          },
          {
            key: 'finance-account-ledger',
            icon: <BankOutlined />,
            label: '账户台账'
          },
          {
            key: 'finance-accounting-subjects',
            icon: <PartitionOutlined />,
            label: '会计科目'
          },
          {
            key: 'finance-accounting-vouchers',
            icon: <FileTextOutlined />,
            label: '会计凭证'
          },
          {
            key: 'finance-assets-prepayments',
            icon: <ProfileOutlined />,
            label: '资产与待摊'
          },
          {
            key: 'finance-month-end',
            icon: <CalendarOutlined />,
            label: '月末事项'
          },
          {
            key: 'finance-general-ledger',
            icon: <BookOutlined />,
            label: '总账'
          },
          {
            key: 'finance-period-close',
            icon: <LockOutlined />,
            label: '期间结账'
          },
          {
            key: 'finance-financial-statements',
            icon: <FileProtectOutlined />,
            label: '财务报表'
          }
        ]
      },
      {
        key: 'tax',
        icon: <PercentageOutlined />,
        label: '税务管理',
        children: [
          {
            key: 'tax-invoices',
            icon: <FileTextOutlined />,
            label: '发票台账'
          },
          {
            key: 'tax-declaration-preparation',
            icon: <FileSearchOutlined />,
            label: '申报准备'
          },
          {
            key: 'tax-handling',
            icon: <AuditOutlined />,
            label: '税务办理'
          }
        ]
      },
      {
        key: 'system',
        icon: <SettingOutlined />,
        label: '系统管理',
        children: [
          {
            key: 'system-roles',
            icon: <SafetyCertificateOutlined />,
            label: '业务角色'
          },
          {
            key: 'system-task-config',
            icon: <ProfileOutlined />,
            label: '任务配置'
          },
          {
            key: 'system-work-calendar',
            icon: <CalendarOutlined />,
            label: '工作日历'
          },
          {
            key: 'system-ledger-initialization',
            icon: <ProfileOutlined />,
            label: '账套初始化'
          },
          {
            key: 'system-finance-categories',
            icon: <BankOutlined />,
            label: '财务类目'
          },
          {
            key: 'system-public-accounts',
            icon: <WalletOutlined />,
            label: '对公账户配置'
          },
          {
            key: 'system-social-insurance-config',
            icon: <SafetyCertificateOutlined />,
            label: '社保公积金配置'
          },
          {
            key: 'system-tax-policy',
            icon: <PercentageOutlined />,
            label: '税务口径'
          }
        ]
      }
    ],
    []
  );

  return (
    <Layout className="app-shell">
      <Sider
        className="app-sider"
        data-compact={collapsed ? 'true' : 'false'}
        trigger={null}
        width={collapsed ? 172 : 228}
      >
        <div className="sider-brand">
          <div className="brand-mark">SMS</div>
          <div className="brand-copy">
            <div className="brand-title">{collapsed ? '管理后台' : 'StartupManageSystem'}</div>
            {!collapsed ? <div className="brand-subtitle">企业经营管理平台</div> : null}
          </div>
        </div>
        <Menu
          className="sider-menu"
          defaultOpenKeys={['my-work', 'people', 'customers', 'tasks', 'performance', 'salary', 'finance', 'tax', 'system']}
          mode="inline"
          selectedKeys={getSelectedKeys(location.pathname)}
          theme="dark"
          items={menuItems}
          onClick={({ key }) => {
            if (key === 'my-work-overview') {
              navigate('/my-work/overview');
            }

            if (key === 'my-work-tasks') {
              navigate('/my-work/tasks');
            }

            if (key === 'my-work-task-submit') {
              navigate('/my-work/task-submit');
            }

            if (key === 'my-work-task-acceptance') {
              navigate('/my-work/task-acceptance');
            }

            if (key === 'my-work-expense-collection') {
              navigate('/my-work/expense-collection');
            }

            if (key === 'my-work-expense-review') {
              navigate('/my-work/expense-review');
            }

            if (key === 'my-work-archive') {
              navigate('/my-work/archive');
            }

            if (key === 'my-work-salary') {
              navigate('/my-work/salary');
            }

            if (key === 'my-work-performance') {
              navigate('/my-work/performance');
            }

            if (key === 'people-overview') {
              navigate('/people/overview');
            }

            if (key === 'people-archives') {
              navigate('/people/archives');
            }

            if (key === 'people-position-permissions') {
              navigate('/people/position-permissions');
            }

            if (key === 'people-movements') {
              navigate('/people/movements');
            }

            if (key === 'people-attendance') {
              navigate('/people/attendance');
            }

            if (key === 'people-attendance-monthly') {
              navigate('/people/attendance-monthly');
            }

            if (key === 'customers-archives') {
              navigate('/customers/archives');
            }

            if (key === 'customers-brands') {
              navigate('/customers/brands');
            }

            if (key === 'customers-stores') {
              navigate('/customers/stores');
            }

            if (key === 'customers-contracts') {
              navigate('/customers/contracts');
            }

            if (key === 'tasks-dashboard') {
              navigate('/tasks/dashboard');
            }

            if (key === 'tasks-list') {
              navigate('/tasks/list');
            }

            if (key === 'tasks-people') {
              navigate('/tasks/people');
            }

            if (key === 'tasks-feedback') {
              navigate('/tasks/feedback');
            }

            if (key === 'performance-dashboard') {
              navigate('/performance/dashboard');
            }

            if (key === 'performance-rules') {
              navigate('/performance/rules');
            }

            if (key === 'performance-signatures') {
              navigate('/performance/signatures');
            }

            if (key === 'performance-monthly') {
              navigate('/performance/monthly');
            }

            if (key === 'salary-overview') {
              navigate('/salary/overview');
            }

            if (key === 'salary-monthly') {
              navigate('/salary/monthly');
            }

            if (key === 'salary-social-insurance') {
              navigate('/salary/social-insurance');
            }

            if (key === 'salary-personal-income-tax') {
              navigate('/salary/personal-income-tax');
            }

            if (key === 'finance-business-overview') {
              navigate('/finance/business-overview');
            }

            if (key === 'finance-receivables-payables') {
              navigate('/finance/receivables-payables');
            }

            if (key === 'tax-invoices') {
              navigate('/tax/invoices');
            }

            if (key === 'tax-declaration-preparation') {
              navigate('/tax/declaration-preparation');
            }

            if (key === 'tax-handling') {
              navigate('/tax/handling');
            }

            if (key === 'finance-transactions') {
              navigate('/finance/transactions');
            }

            if (key === 'finance-review') {
              navigate('/finance/review');
            }

            if (key === 'finance-bank-reconciliation') {
              navigate('/finance/bank-reconciliation');
            }

            if (key === 'finance-account-ledger') {
              navigate('/finance/account-ledger');
            }

            if (key === 'finance-accounting-subjects') {
              navigate('/finance/accounting-subjects');
            }

            if (key === 'finance-accounting-vouchers') {
              navigate('/finance/accounting-vouchers');
            }

            if (key === 'finance-assets-prepayments') {
              navigate('/finance/assets-prepayments');
            }

            if (key === 'finance-month-end') {
              navigate('/finance/month-end');
            }

            if (key === 'finance-general-ledger') {
              navigate('/finance/general-ledger');
            }

            if (key === 'finance-period-close') {
              navigate('/finance/period-close');
            }

            if (key === 'finance-financial-statements') {
              navigate('/finance/financial-statements');
            }

            if (key === 'system-roles') {
              navigate('/system/roles');
            }

            if (key === 'system-task-config') {
              navigate('/system/task-config');
            }

            if (key === 'system-work-calendar') {
              navigate('/system/work-calendar');
            }

            if (key === 'system-ledger-initialization') {
              navigate('/system/ledger-initialization');
            }

            if (key === 'system-finance-categories') {
              navigate('/system/finance-categories');
            }

            if (key === 'system-public-accounts') {
              navigate('/system/public-accounts');
            }

            if (key === 'system-social-insurance-config') {
              navigate('/system/social-insurance-config');
            }

            if (key === 'system-tax-policy') {
              navigate('/system/tax-policy');
            }
          }}
        />
      </Sider>
      <Layout className="app-main">
        <Header className="app-header">
          <div className="app-header-left">
            <Button
              aria-label={collapsed ? '展开侧栏' : '收窄侧栏'}
              className="header-collapse-button"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              type="text"
              onClick={() => setCollapsed((value) => !value)}
            />
            <Breadcrumb
              items={[
                {
                  title: page.module
                },
                {
                  title: page.title
                }
              ]}
            />
          </div>
          <Space className="app-header-actions" size={8}>
            <Tooltip title="通知">
              <Badge count={3} size="small">
                <Button aria-label="通知" icon={<BellOutlined />} shape="circle" type="text" />
              </Badge>
            </Tooltip>
            <div className="header-user">
              <div className="header-user-copy">
                <span>李明</span>
                <small>演示账号</small>
              </div>
              <Avatar className="header-avatar">李</Avatar>
            </div>
          </Space>
        </Header>
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
