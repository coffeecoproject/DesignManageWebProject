# 发票关联硬切方案 V1

Date: 2026-07-10

Status: frontend_hardcut_implemented_local_contract_updated

Owner: 财务管理 / 税务管理

## 1. 决策

`发票匹配`不再是独立页面、独立路由或独立待办模块。

系统保留一个统一的发票关联能力：

```text
发票台账导入并维护发票事实
  ├─ 从发票台账发起关联
  └─ 从应收应付详情发起关联
       ↓
同一发票关联抽屉
       ↓
发票 <-> 应收应付 / 前期已申报未开票收入
```

`/tax/invoice-matching`、侧栏入口、页面组件、模型和旧写入接口均已移除，不保留兼容跳转。

## 2. 职责边界

### 发票台账

- 导入、展示和追溯销项/进项、蓝票/红票、普通/专用发票等票据事实。
- 负责发票与应收应付、前期已申报未开票收入、红字原蓝票的关联入口。
- 发票没有有效业务候选时保留为`待关联`，不得自动创建应收应付。

### 应收应付

- 承载已经确认的收入、成本、费用和往来权责事实。
- 只在详情的`发票/票据`内打开共享关联抽屉；不拥有第二套匹配数据或写入逻辑。
- 生成已记账凭证后，原事项及其已有关联不允许直接修改，只能走冲销或后续期间调整。

### 申报准备

- 消费发票事实、未开票收入和税务口径，形成申报测算和待办。
- 前期已申报未开票收入在后续发票关联完成后自动冲抵，不能再由申报准备页面手工确认。

## 3. 关联规则

普通发票可与已确认、涉及发票的应收应付多对多关联。每一条关联都是独立的`发票业务分摊`，必须同时记录价税合计、不含税金额、税额、目标唯一 ID、匹配依据、创建人/时间及撤销留痕。薪酬、绩效等`不涉及发票`的事项不进入候选。

候选优先级如下：

1. 已有关联：仅用于回显和编辑已有分摊。
2. 来源单据：发票导入事实携带业务单号，且严格匹配应收应付的`documentNo`或`sourceNo`。
3. 报销票据：发票导入事实携带报销单号。
4. 对象匹配：仅作为人工候选，不自动建立关联。

不得再以`sourceNo`、`documentNo`的模糊相等替代目标唯一 ID；同一合同或项目存在多笔阶段应收应付时，必须明确选择目标事项。

红字发票必须关联一个原蓝字发票；累计红冲金额不得超过原蓝字发票金额。关联成功后，系统以原蓝票的有效业务分摊为依据，在红票上生成可追溯的负向分摊，供调整凭证使用；不得覆盖原蓝票分摊。原蓝票所属期间即使已结账也只读可选，因为本次写入只发生在红票的当前开放期间。作废发票只保留票据事实，所有分摊均不再参与匹配、税额、凭证和申报读取。

关联金额不得超过发票金额或业务事项可用金额。关联/取消关联检查发票当前期间和目标事项期间：发票所在期间已结账、目标事项所在期间已结账、目标事项已生成已记账凭证，均进入只读；已记账红票也不得重新选择原票。后端落地时必须在同一事务内执行这些校验。

## 3.1 当前前端数据契约

```text
FinanceInvoiceBusinessAllocation
- invoiceId
- targetType: 应收应付 | 未开票收入
- targetId / targetNo / targetTitle
- taxIncludedAmount / taxExcludedAmount / taxAmount
- matchBasis
- status: 有效 | 已撤销
- createdBy / createdAt
- reversalReason / reversedBy / reversedAt
- sourceAllocationId (红票负向分摊指向原蓝票分摊)
```

`FinanceInvoiceRecord.matchedBusinessRefs`及所有以该字段读取、写入、回退的逻辑已移除，不保留兼容适配。应收应付、税额基础、权责凭证、申报准备均从上述分摊关系读取。

## 4. 本地契约形状

当前仅有前端会话状态和本地 API 契约骨架，未声明真实后端服务已经实现。

```text
POST  /api/finance/invoices/import
PATCH /api/finance/invoices/{id}/allocations
PATCH /api/finance/receivables-payables/{id}/invoice-allocations
POST  /api/finance/invoices/{id}/red-original
```

所有写入均使用`invoice_ledger`源单区域，并在改变记录前检查会计期间。后端落地时还必须补齐权限、持久化、并发控制、审计事件和数据库事务证据；分摊表必须以`invoice_id + target_id + status`支持查询，并禁止通过合同号或来源号做写入定位。

## 5. 文档取代关系

下列文档中 2026-07-10 前关于独立`发票匹配`模块、`/tax/invoice-matching`路由和手工“后续开票确认”的表述均是历史设计记录，不再描述当前行为：

- `docs/governance/finance-accounting-voucher-full-workflow-plan-v1.md`
- `docs/governance/vat-declaration-hardcut-plan-v1.md`
- `docs/governance/finance-period-close-industrial-execution-acceptance-plan-v1.md`
- `docs/evidence/*`、`docs/testing/test-plan.md`中的历史验收记录

历史证据不删除，以保留当时实现的审计上下文；当前路由、状态和行为以本文、路由清单与源单 mutation matrix 为准。
