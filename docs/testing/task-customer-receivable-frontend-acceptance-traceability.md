# 任务客户应收前端验收追踪

Status: `passed_frontend_only`

Scope: frontend session only

Source plan: `docs/governance/task-customer-receivable-frontend-hardcut-execution-acceptance-plan-v1.md`

## 1. 证据规则

每个验收项必须能够追溯到业务输入、领域计算、跨模块结果和自动或浏览器证据。类型检查、构建成功和测试总数不能替代单项业务证据。

## 2. 追踪矩阵

| ID | 实现证据 | 自动证据 | 浏览器证据 | 状态 |
| --- | --- | --- | --- | --- |
| TR-01 | `brandTaskPricingModel.ts` 品牌维度解析 | `brandTaskPricingModel.test.ts` | N/A | 自动通过 |
| TR-02 | 计费任务价格校验与任务创建阻断 | `brandTaskPricingModel.test.ts` | 品牌抽屉字段完整 | 通过 |
| TR-03 | 有效合同校验 | `brandTaskPricingModel.test.ts` | N/A | 自动通过 |
| TR-04 | 合同客户归属校验 | `brandTaskPricingModel.test.ts` | 品牌抽屉仅出现同客户合同 | 通过 |
| TR-05 | 价格及结算规则版本替换命令；规则改动按生效月份切换 | `brandTaskPricingModel.test.ts` | N/A | 自动通过 |
| TR-06 | `TaskCustomerBillingSnapshot` 冻结版本和金额 | `taskCustomerBillingModel.test.ts` | N/A | 自动通过 |
| TR-07 | 验收提交生成 `CustomerTaskBillingFact`；缺少结算快照时任务、绩效和结算事实均不写入 | `taskCustomerBillingModel.test.ts`, `taskCustomerReceivableFrontendWorkflow.test.ts` | N/A | 自动通过 |
| TR-08 | 验收提交按任务事实 ID 幂等 | `taskCustomerReceivableFrontendWorkflow.test.ts` | N/A | 自动通过 |
| TR-09 | 返工重验保持事实身份 | `taskCustomerBillingModel.test.ts` | N/A | 自动通过 |
| TR-10 | 中止任务不生成事实 | `taskCustomerBillingModel.test.ts` | N/A | 自动通过 |
| TR-11 | 不计费事实保留但不生成批次 | `taskCustomerBillingModel.test.ts` | N/A | 自动通过 |
| TR-12 | 按任务形成确定性批次和已确认应收 | `taskCustomerBillingModel.test.ts`, `financeCustomerTaskSettlementModel.test.ts` | N/A | 自动通过 |
| TR-13 | 月末按同组汇总 | `taskCustomerBillingModel.test.ts`, `financeCustomerTaskSettlementModel.test.ts` | N/A | 自动通过 |
| TR-14 | 月末前不冻结 | `taskCustomerBillingModel.test.ts` | N/A | 自动通过 |
| TR-15 | 迟到事实不覆盖原应收，并在后续期间生成独立调整应收 | `financeCustomerTaskSettlementModel.test.ts` | N/A | 自动通过 |
| TR-16 | 客户应收和兼职劳务应付独立 | `taskCustomerReceivableFrontendWorkflow.test.ts` | N/A | 自动通过 |
| TR-17 | 固定金额合同额度软提醒 | `taskCustomerBillingModel.test.ts` | 品牌详情展示合同金额、已结算、剩余额度和阈值状态 | 通过 |
| TR-18 | 到期合同不能支撑新快照 | `taskCustomerBillingModel.test.ts` | N/A | 自动通过 |
| TR-19 | 客户、品牌和合同名称使用历史快照 | `financeCustomerTaskSettlementModel.test.ts` | 应收来源抽屉展示冻结名称 | 通过 |
| TR-20 | 后续改价不覆盖原应收和历史价格 | `financeCustomerTaskSettlementModel.test.ts` | N/A | 自动通过 |
| TR-21 | 客户价格字段不进入员工任务 UI | UI 残留扫描 | 任务列表、人员任务、待提交、待验收均无客户金额字段 | 通过 |
| TR-22 | 品牌抽屉维护结算规则和价格 | 组件和状态命令 | 品牌抽屉展示结算规则、任务单价和同客户合同 | 通过 |
| TR-23 | 合同页面无新增计价入口 | 路由和组件残留扫描 | 合同页面无任务计价入口 | 通过 |
| TR-24 | 应收详情展示品牌、合同、任务、验收和金额 | `FinanceReceivablesPayablesDetailDrawer.tsx` | 应收抽屉展示完整来源快照 | 通过 |
| TR-25 | 任务应收进入发票、收款登记、流水复核、结清和权责凭证 | `taskCustomerReceivableFrontendWorkflow.test.ts` | N/A | 自动通过 |
| TR-26 | 来源客户或品牌档案缺失时拒绝生成不完整应收并显式报告交接异常 | `financeCustomerTaskSettlementModel.ts` | `financeCustomerTaskSettlementModel.test.ts` | 自动通过 |
| TR-27 | 撤销尚未被财务下游消费的任务验收 | `reconcileCustomerTaskReversals` 将对应应收作废并保留操作记录 | `financeCustomerTaskSettlementModel.test.ts` | 自动通过 |
| TR-28 | 撤销已被发票、凭证、收付款或锁期消费的任务验收 | 保留原应收历史并产生“来源撤销待财务更正”事项 | `financeCustomerTaskSettlementModel.test.ts`, `FinanceManagementState.tsx` | 自动与代码证据通过 |
| TR-29 | 撤销任务验收的跨模块反向结果 | 任务回到待验收，结算事实冲销，绩效停止计入，劳务来源保留并标记撤销，验收归档作废 | `taskCustomerReceivableFrontendWorkflow.test.ts` | 自动通过 |
| TR-30 | 内部验收生成可追溯归档 | 验收提交生成稳定文件地址，任务应收冻结并复用该归档 | `taskCustomerBillingModel.test.ts`, `taskCustomerReceivableFrontendWorkflow.test.ts` | 自动通过 |
| TR-31 | 兼职劳务资料不完整 | 内部验收、客户结算事实和绩效正常提交；仅劳务结算保留阻断 | `partTimeLaborFrontendWorkflow.test.ts` | 自动通过 |

## 3. 原型边界

- 通过项只证明当前前端会话内的领域行为。
- 后端持久化、并发幂等、数据库唯一约束、服务端权限和审计仍未实施。
- 月度批次生成后的迟到事实不在前端静默覆盖原应收，而是在发现月份生成独立后续调整应收；后端接入后仍需以事务、期间锁和唯一约束保证正式调整的幂等与不可变性。
- 固定金额合同额度仅是管理提醒：品牌当前计费配置中的固定金额合同先进入额度台账，尚无验收事实时显示 `0` 使用额；已结算金额基于有效已验收计费事实累计，达到 `80%` 提醒接近上限，达到或超过 `100%` 提醒已超出；不阻断任务创建、验收或应收生成。
- 统一收入政策为“内部验收完成即形成客户任务结算事实”，不增加甲方确认状态或审批流。
- 验收归档是客户任务应收的来源证据，必须具有稳定文件地址；只有标签而没有地址的 Mock 文件不能作为财务确认依据。
- 兼职劳务资料与客户收入是两条独立链路。资料缺失只阻断自然人劳务应付，不得阻断客户任务收入和任务绩效。
- 撤销验收不会删除历史事实。财务尚未消费时直接作废或重算应收；已经被发票、凭证、收付款或锁期消费时保留原记录，并要求通过冲销或后续调整更正。

## 4. 浏览器证据

- `docs/evidence/task-customer-receivable-frontend-browser-evidence-2026-07-17.md`
- `docs/evidence/browser/task-customer-receivable/browser-results.json`
- `docs/evidence/browser/task-customer-receivable/brand-pricing-edit.png`
- `docs/evidence/browser/task-customer-receivable/contract-page-unchanged.png`
- `docs/evidence/browser/task-customer-receivable/receivable-task-source-drawer.png`
