# 任务客户应收前端浏览器证据

Date: `2026-07-17`

Scope: frontend session only

## 1. 验证方式

当前运行环境未提供内置 Browser MCP，因此使用本机 Chromium DevTools Protocol 作为浏览器回退方式。验证覆盖实际路由、交互、可见文本、水平溢出和浏览器错误，不以静态代码扫描替代页面证据。

## 2. 验证结果

### 品牌管理

- 路由：`/customers/brands`
- 品牌抽屉展示结算方式、验收后到期规则、任务计费开关、任务单价和依据合同。
- 合同候选仅包含当前品牌所属客户的有效合同；其他客户合同未进入候选。
- 证据：`browser/task-customer-receivable/brand-pricing-edit.png`

### 合同管理

- 路由：`/customers/contracts`
- 未新增任务计价、品牌价格或任务结算入口。
- 页面无水平溢出。
- 证据：`browser/task-customer-receivable/contract-page-unchanged.png`

### 任务金额边界

- 路由：`/tasks/list`、`/tasks/people`、`/my-work/task-submit`、`/my-work/task-acceptance`
- 页面未出现`结算单价`、`依据合同`、`客户应收`、`任务应收`或`应收单号`。
- 四个页面均无水平溢出。

### 应收来源追溯

- 路由：`/finance/receivables-payables`
- 页面渲染任务结算应收`AR-202606-T7363`，金额`12,000.00 元`。
- 抽屉展示冻结的品牌、合同、任务、验收时间、验收人、价格版本和结算金额。
- 页面及抽屉无水平溢出。
- 证据：`browser/task-customer-receivable/receivable-task-source-drawer.png`

## 3. 机器结果

- 结构化结果：`browser/task-customer-receivable/browser-results.json`
- 浏览器错误：`0`

## 4. 证据边界

本证据只证明当前前端会话中的交互、领域派生和可见性边界。它不证明刷新持久化、后端权限、并发幂等、数据库唯一约束、真实合同或正式财务审计能力。
