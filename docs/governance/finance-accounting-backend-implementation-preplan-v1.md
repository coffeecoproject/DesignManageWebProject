# 会计凭证与总账后端实现前置设计 V1

Date: 2026-06-28

Status: backend_implementation_preplan

Owner: finance-management backend readiness

Related contract:

- `docs/data/finance-accounting-voucher-ledger-contract.md`
- `docs/data/finance-tax-accounting-backend-contract.md`
- `docs/governance/finance-accounting-voucher-full-workflow-plan-v1.md`
- `docs/governance/finance-period-close-industrial-execution-acceptance-plan-v1.md`
- `docs/api/api-contract-placeholder.md`
- `docs/data/frontend-cross-module-contracts.md`

## 1. 目标

本设计用于在真实后端实现前固定会计凭证与总账的实施边界。

目标不是直接写 production migration，也不是把当前前端 mock 直接接成正式账务。目标是先让后端实现具备以下前置条件：

- 数据库表和 migration 顺序明确。
- 税务口径、发票税额、应收应付税额、会计科目和类目映射的事实源明确。
- 正式凭证号序列具备事务锁设计。
- 候选凭证、持久凭证、记账、冲销、期间关闭和总账读取 API 边界明确。
- 权限、审计、幂等和并发策略明确。
- 前端从 mock 生成器切换到 repository adapter 的路径明确。
- 非生产 contract tests、回滚策略和恢复演练要求明确。

## 2. 不做的事

本轮前置设计不做：

- 不创建真实数据库 migration。
- 不实现 backend API。
- 不接入真实银行、税务或发票平台。
- 不执行生产数据迁移。
- 不做真实月结、法定报表或审计归档。
- 不将当前前端 mock 数据声明为会计、审计或税务证据。

## 3. 实施分层

```text
source facts
  税务口径 / 会计科目 / 类目映射
  应收应付 / 发票台账 / 收支流水 / 银行对账 / 税务办理
    ↓
accounting candidate service
  server-side candidate recomputation
    ↓
accounting voucher service
  persisted voucher + formal voucher number + lines + source refs
    ↓
posting service
  immutable general-ledger entries
    ↓
period service
  close checks / close / exceptional reopen
    ↓
reporting read models
  subject ledger / trial balance / future financial statements
```

核心规则：

- source facts 不由凭证服务反向修改。
- candidate 是查询结果，不是正式凭证。
- persisted voucher 才有正式凭证号。
- posted voucher 才写入 general ledger。
- closed period 不允许制单、记账、冲销或调整当期凭证。
- 已记账错误只能通过冲销或调整处理，不直接改原凭证。

## 4. 非生产 Migration 顺序

建议分 6 个 migration 批次，先在本地/非生产环境执行。

### Batch 0: 税务口径与会计科目事实源

| Table | Purpose | Notes |
| --- | --- | --- |
| `tax_policy_profiles` | 税务口径版本 | 先写入当前小规模纳税人原型口径，状态 `生效中` |
| `tax_policy_profile_events` | 税务口径事件 | append-only |
| `accounting_subjects` | 会计科目主数据 | 系统维护；业务侧只读；禁止页面侧 fallback 默认科目 |
| `finance_category_accounting_mappings` | 财务类目到会计科目映射 | 财务配置；业务侧只读；按生效期和审计事件维护 |
| `invoice_tax_facts` | 发票税额事实 | 从发票导入/台账确认产生，不由活跃税务口径回写 |
| `receivable_payable_tax_facts` | 应收应付税额和科目快照 | 应收应付确认前置事实，含 source hash |

验收：

- 没有覆盖期间的 `生效中` 税务口径时，应收应付税额事实不能确认。
- 财务类目缺会计科目映射时，来源事实停留在 `待配置`。
- 业务单据只能选择业务/财务类目，不能直接选择或修改会计科目。
- 类目到科目映射不需要双人审批，但必须记录生效期、操作人、时间和变更原因。
- 发票税额事实导入后不因税务口径版本变化被改写。
- 已确认应收应付税额事实保留税务口径、会计科目和类目映射快照。
- 已结账期间拒绝重建或确认来源税额事实。

### Batch A: 基础会计主数据

| Table | Purpose | Notes |
| --- | --- | --- |
| `accounting_periods` | 期间状态、结账、重开元数据 | 初始写入当前 mock 涉及月份，状态 `开放` |
| `accounting_voucher_sequences` | 凭证号序列 | `(period, voucher_kind)` 唯一 |
| `accounting_idempotency_keys` | mutating API 幂等 | 设置保留期和唯一约束 |

验收：

- 可以创建开放期间。
- 可以按期间和凭证种类初始化序列。
- 幂等键重复请求能返回原响应或拒绝不一致请求。

### Batch B: 凭证持久化核心

| Table | Purpose | Notes |
| --- | --- | --- |
| `accounting_vouchers` | 凭证头 | `source_hash` 非冲销凭证唯一 |
| `accounting_voucher_lines` | 借贷分录 | 正金额，借贷方向分开 |
| `accounting_voucher_source_refs` | 来源关系和来源快照 | 包含 source hash 和 snapshot |
| `accounting_voucher_invoice_refs` | 发票事实快照 | 红票需要原蓝票关系或阻断 |
| `accounting_voucher_events` | 操作事件 | append-only |

验收：

- 一个 `待制单` 候选制成一张 `已制单` 凭证。
- 分录借贷平衡才能写入。
- 同一 source hash 不能重复制单非冲销凭证。
- 来源快照和发票快照可在详情中复现当时依据。

### Batch C: 记账与总账

| Table | Purpose | Notes |
| --- | --- | --- |
| `general_ledger_entries` | 已记账分录 | `voucher_line_id` 唯一防重复 |
| `general_ledger_subject_balances` | 科目余额/试算平衡读模型 | 可先以查询聚合替代物化表 |

验收：

- 记账在同一事务内写入总账并更新凭证状态。
- 重复记账不会产生重复总账行。
- 试算平衡接口只读取已记账凭证。

### Batch D: 冲销与期间关闭

| Capability | Tables | Notes |
| --- | --- | --- |
| 凭证冲销 | `accounting_vouchers`, `accounting_voucher_lines`, `general_ledger_entries`, `accounting_voucher_events` | 冲销凭证使用新凭证号，原凭证状态变 `已冲销` |
| 期间关闭 | `accounting_periods`, `accounting_voucher_events` | 关闭前执行 close checks |
| 异常重开 | `accounting_periods`, audit event | 需要高权限、原因和审计 |

验收：

- 已记账凭证可生成关联冲销凭证。
- 已冲销凭证不能再次冲销。
- 有未记账凭证、阻断候选或试算不平时不能结账。
- 已结账期间拒绝制单、记账、冲销。

### Batch E: 前端 API Adapter 切换

| Adapter | Responsibility |
| --- | --- |
| `financeAccountingVoucherRepository.listCandidates` | 调用候选列表 API |
| `readCandidate` | 调用候选详情 API |
| `prepareVoucher` / `batchPrepareVouchers` | 候选制单并持久化正式凭证 |
| `listVouchers` / `readVoucher` | 读取正式凭证 |
| `bookVoucher` / `batchBookVouchers` | 记账 |
| `reverseVoucher` | 冲销 |
| `listAccountingPeriods` / `readPeriodCloseChecks` / `closePeriod` | 期间管理 |
| `listGeneralLedgerEntries` / `listSubjectBalances` | 总账读取 |

验收：

- 页面组件不直接调用 fetch。
- 当前 `buildAccountingVouchers` 只保留为 mock fallback。
- API 模式下页面以 backend candidate/voucher response 为准。

## 5. 凭证号序列锁设计

正式凭证号必须由后端分配。

建议：

```text
BEGIN;
SELECT * FROM accounting_voucher_sequences
 WHERE period = :period AND voucher_kind = :kind
 FOR UPDATE;
number = next_sequence;
UPDATE accounting_voucher_sequences SET next_sequence = next_sequence + 1;
INSERT accounting_vouchers (... voucher_no ...);
COMMIT;
```

规则：

- 不允许前端生成正式凭证号。
- 不允许使用最大号 + 1 的无锁查询。
- 凭证生成失败时同事务回滚，序列号可以不消耗。
- 如果后续要求凭证号严格无缺口，所有失败必须在分配前完成校验。
- 如果允许因事务失败产生缺口，需要写入治理例外；当前建议不消耗失败号。

## 6. 期间关闭与重开权限

### 权限建议

| Scope | Purpose | Risk |
| --- | --- | --- |
| `finance.accountingPeriod.read` | 查看期间和关闭检查 | medium |
| `finance.accountingPeriod.close` | 关闭期间 | high |
| `finance.accountingPeriod.reopen` | 异常重开 | critical |
| `finance.accountingVoucher.prepare` | 制单 | high |
| `finance.accountingVoucher.book` | 记账 | high |
| `finance.accountingVoucher.reverse` | 冲销 | high |
| `finance.generalLedger.read` | 读取总账 | high |

### 关闭前置

关闭期间必须检查：

- 没有 `已制单` 但未 `已记账` 的凭证。
- 没有必须处理的阻断候选。
- 已复核现金流水已完成银行对账，或其未对账事项已按期间结账规则处理。
- 税务办理没有阻断当期税费凭证的未完成事项。
- 试算平衡通过。
- 当前操作人具备关闭权限。

### 重开规则

重开不是日常操作。

要求：

- 必须填写原因。
- 必须写审计事件。
- 必须有高权限。
- 已产生后续期间结账时，默认拒绝重开前序期间。
- 重开后新增或冲销凭证仍应保留完整事件链。

## 7. API Schema Review 清单

每个 API 在实现前必须确认：

- request schema 是否包含 `version` 和 `idempotencyKey`。
- response schema 是否区分 candidate 与 persisted voucher。
- 金额字段是否使用字符串 decimal 或 backend decimal，不使用浮点数作为正式接口金额。
- 时间字段是否区分 date、period、timestamptz。
- 错误码是否覆盖 closed period、source changed、unbalanced、duplicate source、idempotency mismatch。
- 权限 scope 是否明确。
- 操作是否写 event。

## 8. Contract Tests

首批 contract tests 必须覆盖：

| Test | Expected |
| --- | --- |
| 来源期间缺生效中税务口径 | 应收应付税额事实不能确认，不进入权责凭证候选 |
| 财务类目缺会计科目映射 | 来源事实停留 `待配置`，不返回凭证候选 |
| 发票税额事实导入后税务口径变更 | 已导入发票税额不被改写 |
| 已结账期间重建或确认来源税额事实 | 返回 `CLOSED_ACCOUNTING_PERIOD` |
| 完整应收 + 销项发票 | `待制单` 权责凭证，分录含应收、收入、应交税费 |
| 应收缺发票但已确认来源税额事实 | `待制单` 权责凭证，发票证据保留待补/部分匹配 |
| 应收缺发票且缺来源税额事实 | 不返回权责凭证候选，来源事实停留待补 |
| 应付 + 小规模进项发票 | 制单成本/费用凭证，不生成进项税额抵扣 |
| 已复核流水且来源凭证完整 | `待制单` 资金凭证 |
| 已复核现金流水未银行对账 | 资金凭证可制单，期间结账阻断 |
| 银行金额异常 | 候选需处理，不能制单资金凭证 |
| 税务事项完成但缺回执 | 候选需处理 |
| 记账成功 | 生成总账行，凭证状态已记账 |
| 重复记账 | 不产生重复总账行 |
| 已记账冲销 | 生成冲销凭证，原凭证已冲销 |
| 关闭期间存在未记账凭证 | 关闭失败 |
| 关闭期间试算不平 | 关闭失败 |
| 已结账期间制单/记账/冲销 | 全部拒绝 |
| source hash 变化 | 制单失败并提示来源已变化 |

## 9. Frontend Cutover Plan

### Stage 1: Repository Shadow Mode

- 新增 repository 接口和 mock repository。
- 页面仍走现有 frontend model。
- 测试 repository response shape 与当前页面需要的字段。

### Stage 2: API Read Mode

- 列表和详情读取 API candidate/persisted voucher。
- 前端 model 只负责展示适配，不再自行决定正式状态。
- mock fallback 仅用于无后端的本地演示。

### Stage 3: Mutating API Mode

- 制单、记账、冲销走后端 API。
- 前端移除会话内 lifecycle overlay。
- 所有操作依赖后端返回状态和事件记录。

### Stage 4: Period / Ledger Mode

- 期间状态和关闭检查走后端。
- 总账影响改为后端 general-ledger 查询。
- 报表只读取已记账总账。

## 10. Release / Rollback / Recovery

非生产上线前必须有：

- migration apply 和 rollback/forward-fix 说明。
- seed data replay：至少覆盖权责、资金、税费、调整、冲销。
- contract tests 通过。
- permission tests 通过。
- 幂等和并发测试通过。
- backup/restore drill 记录。
- period close dry-run 记录。

生产前必须额外确认：

- 真实数据库备份策略。
- secrets 和环境变量来源。
- observability 和错误告警。
- release owner 和 rollback owner。
- 生产变更审批。

生产后禁止：

- destructive rollback 删除已记账凭证和总账。
- 直接修改已记账凭证。
- 自动重开已结账期间。
- 通过前端修正正式账务数据而不留审计事件。

## 11. 实施顺序建议

```text
1. API schema review
2. migration design review
3. contract test scaffold
4. non-production migration apply
5. seed data replay
6. backend candidate list/read
7. backend prepare voucher
8. backend post voucher + ledger entries
9. backend reverse voucher
10. accounting period close checks
11. frontend repository shadow mode
12. frontend API read mode
13. frontend mutating API mode
14. release / rollback / recovery evidence
```

## 12. Open Decisions

| Decision | Recommendation | Status |
| --- | --- | --- |
| Backend runtime/framework | Use existing project backend decision when confirmed; do not invent in frontend thread | pending |
| Decimal transport | Use string decimal in API response/request | recommended |
| Strict no-gap voucher numbers | Prefer no failed-number consumption by validating before sequence allocation | recommended |
| Period reopen | Keep as exceptional high-permission operation | recommended |
| Manual accounting voucher entry | Defer; source-driven first, then controlled manual adjustment later | recommended |
| Subject balance storage | Start as query/read model; materialize only when report performance requires | recommended |
| Production migration | Blocked until non-production evidence exists | pending |

## 13. Completion Gate

This preplan is complete when:

- The expanded contract is referenced by API/data docs.
- Migration sequence and tables are listed.
- Voucher-number sequence locking is specified.
- Period close/reopen permission boundary is specified.
- Contract test matrix is listed.
- Frontend repository cutover stages are listed.
- Release, rollback, and recovery evidence requirements are listed.

It does not make the backend implementation ready by itself.
