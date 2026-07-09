import type { FinancePeriodCloseCheckCode } from './financePeriodCloseModel';
import type { FinancePeriodCloseSourceMutationArea } from './financePeriodCloseSourceMutationMatrix';

export type FinancePeriodCloseEvidenceLevel = 'frontend_session' | 'local_contract' | 'documented_gap';

export type FinancePeriodCloseAcceptanceFlowStep = {
  currentEvidence: string;
  currentEvidenceLevel: FinancePeriodCloseEvidenceLevel;
  formalBackendGap: string;
  id: string;
  order: number;
  ownerModule: string;
  ownerRoute: string;
  title: string;
};

export type FinancePeriodCloseCheckAcceptance = {
  code: FinancePeriodCloseCheckCode;
  ownerModule: string;
  ownerRoute?: string;
  sourceActionPolicy: 'navigate_when_blocked' | 'read_only_no_action';
  title: string;
};

export type FinancePeriodCloseExceptionAcceptance = {
  currentEvidence: string;
  expected: string;
  id: string;
  sourceMutationArea?: FinancePeriodCloseSourceMutationArea;
  title: string;
};

export type FinancePeriodCloseFrontendStandard = {
  currentEvidence: string;
  id: string;
  standard: string;
};

export const financePeriodCloseAcceptanceFlowSteps: readonly FinancePeriodCloseAcceptanceFlowStep[] = [
  {
    currentEvidence: '应收应付前端模型、页面和本地 source-mutation route skeleton',
    currentEvidenceLevel: 'frontend_session',
    formalBackendGap: '缺真实业务源单 API、数据库源表、事务和持久化权责事实',
    id: 'source-receivable-payable',
    order: 1,
    ownerModule: '应收应付',
    ownerRoute: '/finance/receivables-payables',
    title: '生成应收应付'
  },
  {
    currentEvidence: '发票台账导入、发票匹配、税额依据前端模型和本地契约矩阵',
    currentEvidenceLevel: 'frontend_session',
    formalBackendGap: '缺真实发票导入解析、发票持久化、税额依据 API 和发票源文件证据',
    id: 'invoice-or-tax-basis',
    order: 2,
    ownerModule: '发票台账 / 发票匹配 / 应收应付',
    ownerRoute: '/tax/invoices',
    title: '匹配或补充发票 / 税额依据'
  },
  {
    currentEvidence: '收支流水前端记录、费用报销/代收生成流水和本地 source-mutation route skeleton',
    currentEvidenceLevel: 'frontend_session',
    formalBackendGap: '缺真实收付款 API、附件存储、资金事实持久化和账户流水事务',
    id: 'cash-flow-created',
    order: 3,
    ownerModule: '收支流水',
    ownerRoute: '/finance/transactions',
    title: '发生收支流水'
  },
  {
    currentEvidence: '流水复核前端状态机、凭证上传组件和本地 route skeleton',
    currentEvidenceLevel: 'frontend_session',
    formalBackendGap: '缺真实复核 API、复核事件表、凭证文件存储和权限证据',
    id: 'cash-flow-reviewed',
    order: 4,
    ownerModule: '流水复核',
    ownerRoute: '/finance/review',
    title: '流水复核通过'
  },
  {
    currentEvidence: '银行对账前端匹配模型、导入预检和本地 route skeleton',
    currentEvidenceLevel: 'frontend_session',
    formalBackendGap: '缺真实银行流水导入、对账关系持久化、重复导入约束和银行账户隔离证据',
    id: 'bank-reconciled',
    order: 5,
    ownerModule: '银行对账',
    ownerRoute: '/finance/bank-reconciliation',
    title: '银行对账完成'
  },
  {
    currentEvidence: '会计凭证前端候选模型读取应收应付、发票、税务、资金和调整事实',
    currentEvidenceLevel: 'frontend_session',
    formalBackendGap: '缺后端候选凭证服务、来源快照冻结、科目映射执行和候选凭证持久化',
    id: 'voucher-candidate-generated',
    order: 6,
    ownerModule: '会计凭证',
    ownerRoute: '/finance/accounting-vouchers',
    title: '生成会计凭证候选'
  },
  {
    currentEvidence: '已记账前端凭证生成总账分录，后续期间调整只在目标期间记账后进入总账，期间结账读取已记账分录',
    currentEvidenceLevel: 'frontend_session',
    formalBackendGap: '缺真实总账分录持久化、重复记账防重、事务和账簿查询 API',
    id: 'voucher-booked',
    order: 7,
    ownerModule: '会计凭证 / 总账',
    ownerRoute: '/finance/accounting-vouchers',
    title: '记账入总账'
  },
  {
    currentEvidence: '薪酬社保、税务办理、会计凭证和后续调整候选已由各自来源模块进入期间结账检查',
    currentEvidenceLevel: 'frontend_session',
    formalBackendGap: '缺后端来源状态汇总服务、来源到候选凭证的统一事实快照和跨模块闭期一致性校验',
    id: 'source-prerequisites-complete',
    order: 8,
    ownerModule: '薪酬社保 / 税务办理 / 会计凭证',
    ownerRoute: '/finance/accounting-vouchers',
    title: '完成来源事项'
  },
  {
    currentEvidence: '总账前端读模型从已记账凭证和期初余额计算科目余额与试算状态',
    currentEvidenceLevel: 'frontend_session',
    formalBackendGap: '缺总账 API、科目余额持久化、期间锁下的账簿快照和正式试算表',
    id: 'general-ledger-balanced',
    order: 9,
    ownerModule: '总账',
    ownerRoute: '/finance/general-ledger',
    title: '总账试算平衡'
  },
  {
    currentEvidence: '税务办理事项按会计期间进入期间结账检查',
    currentEvidenceLevel: 'frontend_session',
    formalBackendGap: '缺真实申报、缴款、回执 API 和税务事项持久化证据',
    id: 'tax-handling-complete',
    order: 10,
    ownerModule: '税务办理',
    ownerRoute: '/tax/handling',
    title: '税务办理完成'
  },
  {
    currentEvidence: '社保/公积金缴费事项按会计期间进入期间结账检查',
    currentEvidenceLevel: 'frontend_session',
    formalBackendGap: '缺真实社保公积金确认、缴费、回单 API 和缴费事实持久化证据',
    id: 'social-insurance-complete',
    order: 11,
    ownerModule: '社保公积金',
    ownerRoute: '/salary/social-insurance',
    title: '社保公积金完成'
  },
  {
    currentEvidence:
      '期间结账前端 read model 汇总八项检查并派生 canClose；本地 API gateway contract 可路由 close-checks；row-backed gateway contract 可通过请求形态提交结账锁，但未成为真实后端权威',
    currentEvidenceLevel: 'local_contract',
    formalBackendGap: '缺后端 close-checks 唯一权威、监听 server、稳定快照 hash 和服务端 canClose',
    id: 'close-checks-passed',
    order: 12,
    ownerModule: '期间结账',
    ownerRoute: '/finance/period-close',
    title: 'close-checks 全部通过'
  },
  {
    currentEvidence: '期间结账确认抽屉写入前端 session 期间锁、结账说明和快照；本地 row-backed gateway contract 可写入候选 period lock / close snapshot / event / idempotency rows',
    currentEvidenceLevel: 'local_contract',
    formalBackendGap: '缺真实持久化期间锁、数据库 migration、SQL 事务、并发版本和操作人鉴权',
    id: 'period-close-confirmed',
    order: 13,
    ownerModule: '期间结账',
    ownerRoute: '/finance/period-close',
    title: '确认结账'
  },
  {
    currentEvidence: '前端 source-write 矩阵、页面禁用态、本地 API guard skeleton、HTTP 请求形态 gateway contract 和 row-backed gateway contract 覆盖既有源单与新增源单的闭期写入拒绝',
    currentEvidenceLevel: 'local_contract',
    formalBackendGap: '缺真实源单 API、数据库事务、权限中间件和直接 API 调用拒绝证据',
    id: 'closed-period-mutation-blocked',
    order: 14,
    ownerModule: '各源单模块',
    ownerRoute: '/finance/period-close',
    title: '已结账期间禁止修改'
  },
  {
    currentEvidence:
      '期间结账、总账和财务报表前端只读回看区分待结账与正式报表；财务报表页面从总账科目余额生成资产负债表、利润表和现金流量表，已结账期间读取结账快照；期间结账复用同一财务报表模型阻断现金流量表项目映射缺口；会计科目页只读呈现现金流量映射来源；本地后端目标契约、route adapter 和 HTTP 请求形态 gateway contract 覆盖已结账正式快照、现金流映射缺口、stale readiness、latest readback、快照不漂移规则，以及期间结账对财务报表 readiness 的派生阻断',
    currentEvidenceLevel: 'local_contract',
    formalBackendGap: '缺正式监听 HTTP、三张表查询 API、总账/科目余额查询 API、现金流量表项目映射持久化/补充资料、报表快照 repository、归档和审计证据',
    id: 'closed-period-report-readback',
    order: 15,
    ownerModule: '总账 / 财务报表',
    ownerRoute: '/finance/financial-statements',
    title: '报表读取已结账结果'
  }
];

export const financePeriodCloseCheckAcceptanceMatrix: readonly FinancePeriodCloseCheckAcceptance[] = [
  {
    code: 'voucher_preparation',
    ownerModule: '会计凭证',
    ownerRoute: '/finance/accounting-vouchers',
    sourceActionPolicy: 'navigate_when_blocked',
    title: '凭证来源'
  },
  {
    code: 'voucher_booking',
    ownerModule: '会计凭证',
    ownerRoute: '/finance/accounting-vouchers',
    sourceActionPolicy: 'navigate_when_blocked',
    title: '凭证记账'
  },
  {
    code: 'general_ledger_trial_balance',
    ownerModule: '总账',
    ownerRoute: '/finance/general-ledger',
    sourceActionPolicy: 'navigate_when_blocked',
    title: '总账试算'
  },
  {
    code: 'cash_review',
    ownerModule: '流水复核',
    ownerRoute: '/finance/review',
    sourceActionPolicy: 'navigate_when_blocked',
    title: '流水复核'
  },
  {
    code: 'cash_reconciliation',
    ownerModule: '银行对账',
    ownerRoute: '/finance/bank-reconciliation',
    sourceActionPolicy: 'navigate_when_blocked',
    title: '资金对账'
  },
  {
    code: 'tax_handling',
    ownerModule: '税务办理',
    ownerRoute: '/tax/handling',
    sourceActionPolicy: 'navigate_when_blocked',
    title: '税务办理'
  },
  {
    code: 'social_insurance_housing_fund',
    ownerModule: '社保公积金',
    ownerRoute: '/salary/social-insurance',
    sourceActionPolicy: 'navigate_when_blocked',
    title: '社保公积金'
  }
];

export const financePeriodCloseExceptionAcceptanceMatrix: readonly FinancePeriodCloseExceptionAcceptance[] = [
  {
    currentEvidence: 'period-close model blocks pending/issue voucher rows',
    expected: '不能结账',
    id: 'pending-voucher-candidate-blocks-close',
    title: '存在待生成或需处理凭证候选'
  },
  {
    currentEvidence: 'period-close model blocks 待记账 rows',
    expected: '不能结账',
    id: 'prepared-unbooked-voucher-blocks-close',
    title: '存在待记账凭证'
  },
  {
    currentEvidence: 'general-ledger read model feeds trial-balance status',
    expected: '不能结账',
    id: 'imbalanced-ledger-blocks-close',
    title: '总账借贷不平'
  },
  {
    currentEvidence: 'cash-flow reconciliation check counts reviewed-but-unreconciled rows',
    expected: '不能结账',
    id: 'unreconciled-cash-flow-blocks-close',
    title: '已复核流水未银行对账'
  },
  {
    currentEvidence: 'tax-handling check counts unfinished non-social tax matters',
    expected: '不能结账',
    id: 'unfinished-tax-handling-blocks-close',
    title: '税务办理未完成',
    sourceMutationArea: 'tax_handling'
  },
  {
    currentEvidence: 'social-insurance check counts social-insurance and housing-fund matters separately',
    expected: '不能结账',
    id: 'unfinished-social-insurance-blocks-close',
    title: '社保公积金未完成',
    sourceMutationArea: 'social_insurance_housing_fund'
  },
  {
    currentEvidence: 'source-write matrix and local route skeleton cover receivable/payable writes',
    expected: '闭期直接写入拒绝，普通修正进入后续期间调整或反结账异常流程',
    id: 'closed-receivable-payable-write-rejected',
    sourceMutationArea: 'receivable_payable',
    title: '已结账后调整应收应付'
  },
  {
    currentEvidence: 'source-write matrix separates invoice ledger import and invoice matching writes',
    expected: '闭期直接写入拒绝，普通修正进入后续期间调整或反结账异常流程',
    id: 'closed-invoice-ledger-import-rejected',
    sourceMutationArea: 'invoice_ledger',
    title: '已结账后导入发票台账'
  },
  {
    currentEvidence: 'source-write matrix and local route skeleton cover invoice matching writes',
    expected: '闭期直接写入拒绝，普通修正进入后续期间调整或反结账异常流程',
    id: 'closed-invoice-matching-write-rejected',
    sourceMutationArea: 'invoice_matching',
    title: '已结账后修改发票匹配'
  },
  {
    currentEvidence: 'source-write matrix and local route skeleton cover cash-flow review writes',
    expected: '闭期直接写入拒绝，普通修正进入后续期间调整或反结账异常流程',
    id: 'closed-cash-flow-review-write-rejected',
    sourceMutationArea: 'cash_flow_review',
    title: '已结账后复核、退回或作废当期流水'
  },
  {
    currentEvidence: 'source-write matrix and local route skeleton cover bank reconciliation writes',
    expected: '闭期直接写入拒绝，普通修正进入后续期间调整或反结账异常流程',
    id: 'closed-bank-reconciliation-write-rejected',
    sourceMutationArea: 'bank_reconciliation',
    title: '已结账后修改银行对账'
  },
  {
    currentEvidence: 'source-write matrix and local route skeleton cover accounting voucher book/reverse',
    expected: '闭期记账、冲销拒绝；历史修正走后续期间调整',
    id: 'closed-accounting-voucher-write-rejected',
    sourceMutationArea: 'accounting_voucher',
    title: '已结账后记账、冲销'
  },
  {
    currentEvidence: 'source-write matrix covers salary confirmation, settlement and adjustment writes',
    expected: '闭期薪酬结果确认、结算和薪酬调整拒绝',
    id: 'closed-payroll-write-rejected',
    sourceMutationArea: 'payroll',
    title: '已结账后修改薪酬结果'
  },
  {
    currentEvidence: 'source-write matrix covers ledger initialization opening adjustment and withdraw enablement',
    expected: '闭期期初调整或撤回启用拒绝，启用后改错进入期初调整凭证路径',
    id: 'closed-ledger-initialization-write-rejected',
    sourceMutationArea: 'ledger_initialization',
    title: '已结账后调整账套初始化'
  },
  {
    currentEvidence: 'later-period adjustment frontend prototype and local contract skeleton',
    expected: '默认走后续期间调整，不反改历史源单、历史凭证或历史总账',
    id: 'later-period-adjustment-is-default',
    title: '已结账后需要修正'
  },
  {
    currentEvidence: 'local API reopen route and authorization contract skeleton',
    expected: '必须写原因和事件，高权限异常流程；真实后端权限仍缺失',
    id: 'reopen-is-exceptional',
    title: '高权限反结账'
  }
];

export const financePeriodCloseFrontendStandards: readonly FinancePeriodCloseFrontendStandard[] = [
  {
    currentEvidence: 'FinancePeriodClosePage renders a table workbench with check/detail/confirm drawers only',
    id: 'page-is-check-workbench',
    standard: '期间结账页只展示检查、详情和确认结账，不直接处理上游业务事项'
  },
  {
    currentEvidence: 'FinancePeriodClosePage only passes primary confirm action when record.canClose is true',
    id: 'confirm-only-when-clear',
    standard: '确认结账只在全部检查通过时出现'
  },
  {
    currentEvidence: 'PeriodCloseConfirmDrawer requires non-empty close reason before submit',
    id: 'close-reason-required',
    standard: '确认抽屉必须填写结账说明'
  },
  {
    currentEvidence: 'closed period rows use readback notice and remove source-route actions',
    id: 'closed-readback-only',
    standard: '已结账后不再显示可结账动作，检查行只读回看'
  },
  {
    currentEvidence: 'FinancePeriodClosePage check rows include status, detail, source summary and next step',
    id: 'check-row-shape',
    standard: '检查项包含状态、说明、来源和下一步'
  },
  {
    currentEvidence: 'source-route actions are navigation-only and only appear for unresolved checks with active owner pages',
    id: 'source-action-is-navigation-only',
    standard: '未处理检查只能导航到来源模块，不在结账页处理源单'
  },
  {
    currentEvidence: 'frontend-session guards and source-write matrix document that UI disabling is not backend safety',
    id: 'frontend-disable-is-not-security',
    standard: '不把隐藏按钮或禁用态当作正式安全控制'
  }
];
