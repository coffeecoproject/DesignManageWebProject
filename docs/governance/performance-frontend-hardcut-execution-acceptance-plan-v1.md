# 绩效前端硬切执行与验收方案 v1

Status: `phase_0_7_implemented_and_verified_frontend_only`

Last updated: `2026-07-17`

Owners: `绩效管理 / 我的工作 / 人员组织 / 薪酬前端消费契约`

Related documents:

- `docs/governance/natural-person-payment-iit-hardcut-plan-v1.md`
- `docs/governance/personnel-frontend-domain-normalization-v1.md`
- `docs/governance/task-frontend-domain-normalization-v1.md`
- `docs/data/frontend-cross-module-contracts.md`
- `docs/testing/test-plan.md`

## 1. 文档目的

本方案用于把当前绩效前端从“规则、签署文件、月度明细、季度复核、员工端摘要各自维护数据”的状态，硬切为一条统一的绩效结果链路：

```text
已发布绩效规则
  -> 按人员类型、岗位和生效期间自动适用
  -> 任务验收等真实来源形成月度绩效草稿
  -> 管理端发布绩效结果快照
  -> 员工在我的绩效确认结果或提出异议
  -> 月度预发、季度差额按唯一引用进入薪酬
  -> 更正生成新版本或后续薪酬差额
```

该方案不是新增审批系统，也不是后端实施方案。它只约束绩效及其直接前端消费者，解决当前前端的业务口径、状态、组件和验收证据漂移。

## 2. 范围边界

### 2.1 本轮纳入

1. `绩效规则`的自动适用和结构化计算参数。
2. `绩效签署`硬切为线下签署文件的档案管理。
3. 任务验收到月度绩效结果的前端来源契约。
4. 月度绩效草稿、发布、员工反馈、更正和薪酬可消费状态。
5. 季度绩效来源完整性、金额计算、发布和差额结算。
6. `我的绩效`中的员工结果确认和提出异议。
7. 绩效看板、人员绩效摘要、人员风险和任务候选中的绩效只读消费。
8. 薪酬前端只读取符合条件的绩效结果，不重构薪酬、财务或个税页面。
9. 绩效前端 Mock、会话状态、组件、测试和治理证据。

### 2.2 本轮不纳入

1. 后端 API、数据库表、迁移、存储、事务、幂等和并发控制。
2. 文件真实上传、对象存储、电子签、实名认证和第三方签署服务。
3. 新增审批流、审批角色、双人复核或员工规则审批。
4. 薪酬计算体系、工资应付、财务凭证、个税和付款流程重构。
5. 任务验收业务本身重构；本轮只消费其已完成事实。
6. 新增岗位职责考核、项目奖金等尚无真实来源模型的绩效模板。
7. 浏览器刷新后的持久化。当前前端状态只保证同一会话内跨页面一致。

### 2.3 下游边界说明

薪酬、人员总览、任务候选属于绩效结果的前端消费者。对这些模块只允许做以下调整：

- 改为读取同一份已发布绩效结果快照。
- 停止读取旧 `workEvaluationSummary` 或静态绩效 Mock 作为当前事实。
- 不改变这些模块自己的业务流程、页面定位或后端契约。

## 3. 已确认业务决策

以下决策是本轮硬切固定输入，不再保留旧分支：

1. 绩效规则由系统按人员类型、岗位、规则状态和生效期间自动适用。
2. 员工不确认自己适用哪套绩效规则，也不能选择、拒绝或延续旧规则。
3. `绩效签署`表示员工在线下完成签署后，由管理人员上传已签文件留档。
4. 签署文件是档案证据，不是绩效规则适用、绩效计算或薪酬结算门禁。
5. 员工需要确认的是已经发布给自己的绩效结果，而不是绩效规则。
6. 员工确认属于送达与反馈证据，不是审批，不赋予员工直接修改金额的能力。
7. 员工可以对当前结果版本提出异议；异议通过更正结果处理，不新增审批流。
8. 绩效统一进入薪酬，绩效模块不生成独立应付、付款或财务流水。
9. 兼职任务结算不进入本绩效结果链路，继续按已确认的兼职劳务链路处理。
10. 已确认薪酬不得被绩效更正反向覆盖；差额进入后续未确认薪酬。
11. 当前可计算的真实绩效模板仅为 `绘图任务制`。没有真实来源模型的模板不得生成结果或进入薪酬。
12. 不新增任何业务审批状态。管理端的“发布结果”是冻结并送达结果的业务动作，不是审批。
13. 绩效结果反馈期限固定为`3个工作日`，按结果送达时员工适用的工作日历快照计算。
14. 工作日计算跳过周末和法定节假日，法定调休补班计入工作日；从送达次日开始计数，第3个工作日当日结束时到期。
15. 已发布结果的反馈截止日不得因后续工作日历调整而变化；若员工和公司默认工作日历均不可用，则阻断结果发布，不降级为固定周一至周五。

## 4. 当前代码审查结论

### 4.1 规则仍保留员工确认旧模型

`performanceTypes.ts`仍定义：

- `PerformanceSignatureStatus`。
- `PerformanceSignatureMethod`中的`在线确认 / 电子签待接入`。
- `PerformanceSignatureEmployeeStatus`中的`待确认 / 已确认 / 已拒绝`。
- `PerformanceSignatureBatch`和员工确认批次。

`performanceMockData.ts`和部分测试仍保留“员工未确认新版继续执行旧版”数据。该模型与“规则自动适用”冲突，必须删除，而不是隐藏页面文案。

### 4.2 签署档案与计算维护两份事实

当前签署页面已经使用线下文件上传口径，但仍存在以下漂移：

- `PerformanceSignaturesPage.tsx`在页面内维护签署档案状态。
- `usePerformanceMonthlyRecords.ts`独立读取静态签署数据。
- `performanceExecutionContract.ts`仍把`缺少签署 / 签署版本不一致`作为执行状态。
- `performanceSignatureModel.ts`仍存在“停用当前绩效”等会影响业务执行的档案动作。

结果是上传文件、切换页面和绩效计算之间不能保持同一事实，并且档案模块越权决定了规则执行。

### 4.3 月度明细缺少结果生命周期

`PerformanceMonthlyCategoryRecord`只有金额、来源和事件，没有：

- 草稿或已发布状态。
- 结果版本和来源快照。
- 发布时间、送达时间和员工反馈。
- 更正关系和薪酬消费状态。

当前薪酬会直接消费所有绩效记录，无法区分未发布、存在异议、已更正或重复记录。

### 4.4 季度结果可任意录入

当前季度复核允许直接填写`finalAmount`和`settlementDate`，且只校验同一人员、规则和季度，不校验季度应有月份是否完整。现有测试还明确允许仅一条月度来源完成季度复核。

这会导致：

- 缺少月份仍能形成季度结果。
- 最终金额脱离月度来源和规则公式。
- 结算日期由绩效页面任意决定，而不是由薪酬周期承接。

### 4.5 员工端、人员摘要和薪酬读取不同事实

- `我的绩效`主要读取`PeopleMember.workEvaluationSummary / workEvaluationRecords`。
- 人员总览和人员风险继续读取同一套旧摘要。
- 薪酬读取`PerformanceMonthlyCategoryRecord`。
- 绩效明细包含真实任务来源和静态非任务 Mock 的混合结果。

同一员工可能在不同页面看到不同分数、金额和月份。

### 4.6 公式仍依赖显示文本和隐藏常量

当前计算存在：

- 从`payoutMode`显示文本解析预发比例。
- 未达标确认比例硬编码为`0.5`。
- 质量维度按隐式等权平均。

显示文案不应成为计算输入，业务系数也不能隐藏在代码常量中。

## 5. 目标前端领域边界

### 5.1 单一事实关系

```text
PerformanceRuleState
  -> 提供已发布规则及结构化参数

TaskManagementState
  -> 提供已验收任务和质量评分来源

PerformanceSignatureArchiveState
  -> 只提供线下签署文件档案，不参与计算

PerformanceResultState
  -> 生成、发布、反馈、更正月度和季度结果

SalaryManagementState
  -> 只消费符合薪酬条件的绩效结果引用

绩效看板 / 我的绩效 / 人员摘要 / 任务候选
  -> 只读消费PerformanceResultState派生视图
```

### 5.2 状态所有权

| 状态 | 唯一所有者 | 允许的消费者 |
| --- | --- | --- |
| 绩效规则及版本 | `PerformanceRuleState` | 绩效计算、规则页、签署档案选项 |
| 已签文件 | `PerformanceSignatureArchiveState` | 签署档案页、人员档案只读摘要 |
| 月度/季度结果 | `PerformanceResultState` | 绩效明细、我的绩效、看板、人员摘要、薪酬 |
| 员工反馈 | `PerformanceResultState` | 我的绩效、绩效明细 |
| 薪酬消费引用 | `SalaryManagementState` | 薪酬明细、绩效结果只读回显 |

禁止页面自行复制并维护这些状态。

### 5.3 会话状态边界

本轮使用统一的前端 Provider 和纯领域函数实现会话状态：

- 同一会话内新增、发布、确认、异议和更正后，所有相关页面立即读取同一状态。
- 路由切换不得丢失状态。
- 浏览器刷新恢复基线 Mock 属于当前前端范围的已知边界。
- 页面不得用第二份 Mock 模拟已发生的跨模块结果。

## 6. 目标领域模型

以下类型用于约束前端内部数据，不代表后端 API 已实现。

### 6.1 规则适用结果

```ts
type PerformanceRuleApplicabilityStatus =
  | '适用'
  | '规则未配置'
  | '规则未发布'
  | '人员类型不适用'
  | '岗位不适用'
  | '不在生效期';

type PerformanceRuleApplicability = {
  employeeId: string;
  workNo: string;
  position: string;
  personnelType: PersonnelType;
  period: string;
  ruleId?: string;
  ruleVersion?: string;
  status: PerformanceRuleApplicabilityStatus;
  reason: string;
};
```

签署文件字段不得出现在该类型中。

### 6.2 结构化任务制规则参数

```ts
type DrawingTaskPerformanceParameters = {
  fullScore: number;
  baselineScore: number;
  basePerformanceAmount: number;
  monthlyPrepayRatio: number;
  belowBaselineFactor: number;
  taskScoreItems: PerformanceTaskScoreItem[];
  qualityDimensions: Array<PerformanceQualityDimension & { weight: number }>;
  qualityBands: PerformanceQualityBand[];
  excessBands: PerformanceExcessBand[];
  reviewCycle: '季度复核';
};
```

约束：

1. 所有计算参数必须来自已发布规则版本。
2. `payoutMode`等显示文本只能由结构化参数派生。
3. 质量权重必须显式保存且总和为`1`；等权也必须持久为明确权重。
4. 未达标系数不得硬编码。

### 6.3 绩效结果快照

```ts
type PerformanceResultKind = '月度结果' | '季度结果';

type PerformanceResultLifecycleStatus =
  | '待发布'
  | '已发布'
  | '已结算'
  | '已更正';

type PerformanceEmployeeResponseStatus =
  | '待确认'
  | '已确认'
  | '有异议'
  | '异议已处理';

type PerformanceResultSnapshot = {
  id: string;
  kind: PerformanceResultKind;
  employeeId: string;
  employeeNameSnapshot: string;
  workNoSnapshot: string;
  positionSnapshot: string;
  period: string;
  ruleId: string;
  ruleVersion: string;
  sourceRecordIds: string[];
  sourceHash: string;
  calculationSnapshot: PerformanceCalculationSnapshot;
  monthlyAmount: number;
  prepayAmount: number;
  quarterCalculatedAmount?: number;
  quarterAdjustmentAmount?: number;
  quarterFinalAmount?: number;
  quarterDifferenceAmount?: number;
  salarySettlementReference: string;
  salarySettlementMonth?: string;
  version: number;
  lifecycleStatus: PerformanceResultLifecycleStatus;
  publishedAt?: string;
  publishedBy?: string;
  deliveredAt?: string;
  responseDeadline?: string;
  employeeResponse: PerformanceEmployeeResponse;
  supersedesResultId?: string;
  correctionReason?: string;
  events: PerformanceResultEvent[];
};
```

### 6.4 员工反馈

```ts
type PerformanceEmployeeResponse = {
  status: PerformanceEmployeeResponseStatus;
  resultId: string;
  resultVersion: number;
  respondedAt?: string;
  employeeId: string;
  objectionReason?: string;
  evidenceFileIds?: string[];
  resolvedAt?: string;
  resolutionSummary?: string;
};
```

约束：

1. 员工只能对自己的当前已发布版本操作。
2. `确认结果`只记录人、时间和版本，不改变金额。
3. `提出异议`必须填写原因；文件为可选佐证，复用相关文件组件。
4. 员工不能撤销、删除、修改或替换绩效结果。
5. 旧版本反馈不得覆盖新版本。

## 7. 规则自动适用硬切

### 7.1 适用顺序

对每个`员工 + 绩效期间 + 绩效类别`按以下顺序解析：

1. 人员在该期间属于在职全职人员。
2. 规则人员类型包含该人员类型。
3. 规则适用岗位包含该期间人员岗位。
4. 规则状态为`已发布`。
5. 绩效期间落在规则生效开始和结束期间内。
6. 同一类别、岗位和期间只能命中一个有效发布版本。

多版本同时命中不是选择题，必须作为规则配置冲突阻断。

### 7.2 版本规则

- 新规则只影响其生效期间及以后结果。
- 历史已发布结果继续保留原规则版本快照。
- 规则停用不反向修改历史结果。
- 未发布规则不得进入计算。
- 员工是否上传签署文件不影响规则版本解析。

### 7.3 页面表现

- 规则页保留现有规则配置和发布流程，不新增员工确认。
- 规则详情显示自动适用条件和生效范围。
- 不展示`员工执行旧版 / 未签新版继续旧版`等签署驱动口径。
- 规则冲突在规则页展示，不转移给员工处理。

## 8. 线下签署档案硬切

### 8.1 模块定位

左侧名称由`绩效签署`调整为`签署档案`，页面技术路径可继续使用`/performance/signatures`。保留路径是因为其语义仍为签署资料，不是兼容旧在线确认流程。

### 8.2 保留内容

- 员工、工号、岗位、绩效类别。
- 规则名称和规则版本。
- 签署日期。
- 当前档案和历史档案。
- 已签文件的预览和下载。
- 新增、更新、作废档案的操作记录。

### 8.3 删除内容

- 发起签署、提醒确认、员工确认、拒绝、撤回确认。
- 在线确认、电子签待接入、签署批次和确认进度。
- `payrollUsable`及任何“签署后才能计算/发薪”字段。
- 通过档案动作停用绩效规则或改变规则适用关系。
- 缺少签署和签署版本不一致的计算阻断。

### 8.4 档案关系状态

```ts
type PerformanceSignatureArchiveStatus =
  | '当前档案'
  | '历史档案'
  | '已作废';
```

更新文件时，原当前档案转为历史档案；作废只影响档案展示，不改变绩效计算和历史结果。

## 9. 月度绩效来源与计算

### 9.1 当前活跃来源

首版只有`绘图任务制`进入真实计算：

```text
已验收任务
  -> 任务计分来源
  -> 质量确认来源
  -> 人员、岗位、规则适用
  -> 任职期间折算
  -> 月度绩效草稿
```

来源任务必须同时满足：

- 任务已完成且验收通过。
- 执行人为全职员工。
- 任务未被作废或冲回。
- 验收计分项属于当前发布规则。
- 同一验收事实只能进入一个月度结果。

### 9.2 零来源月份

对规则适用且处于有效任职范围内的员工，即使当月没有来源任务，也必须生成`0分 / 0元`月度草稿。否则季度完整性无法区分“本月确实无任务”和“本月数据漏生成”。

### 9.3 任职期间折算

保留当前基于人员入职、离职日期和适用工作日历的折算方向：

- 任务实际得分不按工作日打折。
- 满分、达标线和基础绩效金额按有效工作日比例折算。
- 兼职不进入该折算和本绩效链路。
- 请假不默认改变任务得分或达标线；只有发布规则明确配置后才能成为绩效参数。

### 9.4 禁止的来源

- 静态`岗位职责考核`月度金额。
- 静态`项目奖金`月度金额。
- 已签文件推导金额。
- 人员档案中的旧`workEvaluationSummary`。
- 页面手工录入但没有来源事实的绩效金额。

尚未实现的模板可保留为代码扩展类型，但不得在业务页面显示为可用、不得生成 Mock 结果、不得进入薪酬。

## 10. 月度结果生命周期

### 10.1 待发布

- 系统根据当前来源和规则生成草稿。
- 来源变化时允许重新计算并覆盖草稿。
- 草稿不进入薪酬，不出现在员工`我的绩效`正式结果列表。
- 管理端可以查看来源和计算明细。

### 10.2 发布

管理端执行`发布绩效结果`后：

- 固定规则版本、人员快照、来源 ID、来源哈希和计算快照。
- 生成不可重复的薪酬结算引用。
- 记录发布人和发布时间。
- 记录送达时间和反馈截止时间。
- 在员工`我的绩效`出现当前结果。

该动作不叫审核或审批。

### 10.3 员工反馈

- 员工可以`确认结果`或`提出异议`。
- 反馈期限固定为`3个工作日`，从送达次日开始，按送达时员工适用的工作日历快照逐日计算。
- 周末、法定节假日及工作日历休息日不计入；法定调休补班和工作日历特殊工作日计入。
- 截止时间固定为第3个工作日`23:59:59`（项目时区）；后续工作日历调整不追溯改变已发布结果。
- 员工和公司默认工作日历均不可用时，不生成截止日并阻断发布，不能静默按周一至周五估算。
- 到期未反馈只派生显示`已送达未反馈`，不新增持久状态。
- 反馈期内尚未确认的绩效结果暂不进入薪酬；员工确认或反馈期届满且无异议后，绩效结果才具备薪酬消费条件。
- 员工未点击确认不得无限期阻断绩效结算，且任何反馈状态都不得阻断基础工资。
- 存在有效异议时，只暂停该绩效结果进入当前薪酬；基础工资和其他无争议项目继续处理。

### 10.4 更正

| 时点 | 处理方式 |
| --- | --- |
| 未发布 | 重新计算并替换草稿 |
| 已发布、薪酬未确认 | 生成新结果版本，旧版本标记`已更正`，重新送达员工 |
| 薪酬已确认或已发放 | 原结果和原工资保持不变，生成后续未确认薪酬的绩效补发或追回差额 |

已发布结果不得删除或原地覆盖。

## 11. 季度绩效重构

### 11.1 来源完整性

季度应有月份由以下信息自动推导：

- 季度自然月份。
- 员工入职和离职期间。
- 规则生效期间。
- 人员类型和岗位适用关系。

示例：员工`2026-05-15`入职，规则从`2026-05-01`生效，则`2026-Q2`应有月份为`2026-05 / 2026-06`；`2026-04`明确为不适用，不得当成缺失。

适用月必须存在已发布月度结果。零任务月份使用`0分 / 0元`结果，不允许缺失。

### 11.2 金额结构

```text
季度计算金额 = 规则定义的季度公式结果
季度预发合计 = 本季度各月已发布预发金额之和
季度最终金额 = 季度计算金额 + 明确的季度调整金额
季度结算差额 = 季度最终金额 - 季度预发合计
```

首版绘图任务制的季度计算金额为各适用月`monthlyAmount`合计。若季度调整金额不为零，必须填写原因并可上传佐证；不得直接覆盖最终金额。

### 11.3 结算期间

- 删除自由选择`settlementDate`。
- 绩效模块只生成`salarySettlementMonth`。
- 默认进入季度结束月对应的薪酬结算周期；实际发薪日期由薪酬模块决定。
- 若目标薪酬已确认，按现有薪酬规则顺延至下一未确认月份。

### 11.4 发布与员工确认

- 管理端动作改为`发布季度结果`。
- 季度结果使用与月度结果相同的版本、送达、员工确认和异议机制。
- 季度结果只向薪酬提供差额，不重复提供已经月度预发的金额。

## 12. 我的绩效交互

### 12.1 页面定位

`/my-work/performance`是员工查看和反馈本人绩效结果的入口，不再读取人员档案中的静态综合分。

### 12.2 列表

建议字段：

- 期间。
- 结果类型。
- 绩效规则。
- 绩效金额或季度差额。
- 反馈状态。
- 发布时间。

不展示管理端内部来源哈希、薪酬内部引用或规则配置字段。

### 12.3 抽屉

最多三个 Tab：

1. `结果概览`：金额、分数、规则版本、发布时间、反馈状态。
2. `来源明细`：任务和计算过程，只读。
3. `操作记录`：发布、送达、确认、异议和更正记录。

抽屉底部操作：

- 当前版本待反馈：`确认结果 / 提出异议`。
- 已确认：仅`关闭`。
- 有异议：显示异议内容，仅`关闭`。
- 已更正旧版本：仅`关闭`，并显示替代版本。

员工不得查看他人结果。

## 13. 管理端绩效明细交互

### 13.1 主页面

继续使用`绩效明细`作为一个主列表，不新增月度和季度两个子模块。使用结果类型、期间、人员和结果状态进行克制筛选。

主列表一行代表一个结果快照，而不是一条来源任务。来源任务在抽屉中查看。

### 13.2 抽屉组件

当前`基础信息 / 结果金额 / 来源明细 / 处理记录`收敛为：

1. `结果概览`。
2. `来源明细`。
3. `操作记录`。

月度与季度复用同一抽屉壳和共享区块，不使用页面穿透，不复制两套详情组件。

### 13.3 管理动作

- 待发布：`发布结果`。
- 已发布且未结算：`更正结果`。
- 有异议：`生成更正结果`或记录`维持原结果`说明。
- 已结算：只能发起后续差额更正。

`维持原结果`只记录异议处理结论并关闭异议，不产生审批状态。

## 14. 下游消费契约

### 14.1 薪酬

薪酬只消费满足以下条件的绩效结果：

- `lifecycleStatus`为`已发布`且结果版本未被替代，或为已结算结果对应的后续差额。
- 规则适用状态为`适用`。
- 员工已确认，或反馈截止时间已到且没有提出异议。
- 没有有效异议。
- `salarySettlementReference`未被其他薪酬结算消费。
- 月度结果只消费预发金额；季度结果只消费季度差额。

薪酬确认后冻结消费引用。后续绩效更正不得修改已确认薪酬，只能产生后续差额。

### 14.2 绩效看板

- 只统计已发布和已结算结果。
- 待发布草稿不进入组织统计。
- 有异议结果单独进入风险摘要，不混入已确认趋势。
- 不再把缺少签署文件列为绩效计算风险。

### 14.3 人员摘要和风险

- 人员总览的平均绩效、上月绩效从已发布结果派生。
- 删除`触发开除条件`结论性文案，调整为`连续低绩效风险`或`需关注`。
- 绩效结果只提供风险事实，不直接作出解除劳动关系结论。

### 14.4 任务候选和人员任务

- 如需展示绩效摘要，只读取最近一期已发布结果。
- 不读取`workEvaluationSummary`作为当前绩效事实。
- 绩效只作为摘要或排序辅助，不改变任务候选权限和可用性规则。

## 15. 共享组件方案

新增或重构为绩效领域组件：

- `PerformanceResultDrawerContent`：月度、季度、管理端和员工端共享详情编排。
- `PerformanceResultSummary`：结果概览。
- `PerformanceResultSourceTable`：来源及计算明细。
- `PerformanceResultResponseStatus`：员工反馈状态。
- `PerformanceResultOperationRecords`：操作记录。
- `PerformanceResultActionFooter`：按角色和状态渲染动作。
- `PerformanceSignatureArchiveTable`：签署档案当前/历史文件。

继续复用项目通用组件：

- `DetailDrawerShell / WorkflowDrawerShell`。
- `DetailTabs`。
- `DetailSummaryCards`。
- `RelatedFileTable`及其预览、下载能力。
- `OperationRecordTable`。
- 现有日期范围、人员选择和表格壳组件。

约束：

- 通用组件不读取绩效领域状态。
- 页面不通过 props 穿透多层拼装业务逻辑。
- 领域组件接收结果视图模型和动作回调，不直接解析 Mock。

## 16. 硬切删除清单

### 16.1 类型和模型

删除或替换：

- `PerformanceSignatureStatus`。
- `PerformanceSignatureMethod`。
- `PerformanceSignatureEmployeeStatus`。
- `PerformanceSignatureEmployee`。
- `PerformanceSignatureBatch`及批次事件。
- `performanceSignatureBatches`及员工在线确认 Mock。
- `PerformanceExecutionContractStatus`中的`缺少签署 / 签署版本不一致`。
- `PerformanceExecutionContractSource`中的`签署规则选项`。
- `payrollUsable`、旧版回退和确认进度字段。
- `PerformanceQuarterlyReviewInput.finalAmount`自由最终金额。
- `PerformanceQuarterlyReviewInput.settlementDate`自由结算日期。

### 16.2 页面和文案

删除：

- 在线确认、电子签、发起签署、提醒确认、员工拒绝规则。
- 未签新版继续执行旧版。
- 档案页面中的停用绩效业务动作。
- `岗位职责考核 / 项目奖金`静态结果和可结算 Mock。
- 员工端静态综合绩效和评级作为当前结果。
- 绩效风险中的`触发开除条件`。

### 16.3 兼容策略

这是前端领域硬切，不保留：

- 旧数据到新状态的运行时兼容分支。
- 双读或双写。
- 旧在线签署状态到新结果确认状态的映射。
- 隐藏但仍参与计算的旧 Mock。

Mock 基线直接重建为新模型。`/performance/signatures`路径保留不属于兼容层，因为页面仍承载签署档案。

## 17. 分阶段执行方案

### Phase 0：冻结范围和验收追踪

Status: `completed_2026-07-16`.

1. 建立本方案对应的验收追踪表。
2. 每个验收编号绑定真实输入、领域动作、页面状态和自动测试。
3. 未有证据的项目不得标记完成。

### Phase 1：规则适用与签署档案解耦

Status: `completed_2026-07-16`.

1. 新增纯规则适用模型。
2. 删除签署驱动的规则执行状态。
3. 把签署页面状态提升为共享档案状态。
4. 删除档案对规则和薪酬的控制动作。
5. 收敛菜单和页面文案为`签署档案`。

### Phase 2：结构化规则与真实月度来源

Status: `completed_2026-07-16`.

1. 把预发比例、未达标系数和质量权重改为结构化参数。
2. 删除显示文案解析和隐藏常量。
3. 只保留绘图任务制真实来源。
4. 生成零任务月份草稿。
5. 保留任职工作日折算并补齐边界测试。

### Phase 3：统一绩效结果状态

Status: `completed_2026-07-16`.

1. 新增`PerformanceResultState`和结果快照模型。
2. 月度结果增加草稿、发布、版本和更正。
3. 绩效明细、看板和人员摘要统一消费结果快照。
4. 删除旧人员绩效摘要的事实所有权。

实现边界：本阶段只完成管理端绩效明细、绩效看板和人员总览的统一结果读取。员工端反馈、任务候选和薪酬消费仍分别保留在 Phase 5/6，不能据此声明 PF-29 全量通过。

### Phase 4：季度绩效重构

Status: `completed_2026-07-16`.

1. 自动推导季度应有月份。
2. 阻断缺月和未发布月度结果。
3. 从月度结果计算季度金额和预发合计。
4. 将人工输入收敛为`调整金额 + 原因 + 可选佐证`。
5. 派生薪酬结算月份，删除自由结算日期。

实现边界：本阶段完成季度草稿、来源完整性、金额归集、调整、发布、送达和待反馈事实。员工在`我的绩效`执行确认或提出异议仍属于 Phase 5，因此 PF-26 当前只完成前置契约，不能声明员工反馈工作流已经闭环。

### Phase 5：员工结果确认和异议

Status: `completed_2026-07-16`.

1. `我的绩效`切换到统一结果快照。
2. 增加确认结果和提出异议。
3. 新版本送达后旧版本不可反馈。
4. 管理端增加异议处理和更正结果。
5. 不新增审批状态或审批页面。

实现边界：员工端只读取当前员工、当前版本的`已发布 / 已结算`结果；确认和异议不允许修改结果金额。异议由管理端维持原结果或基于已经变化的正式来源生成更正版本。反馈状态已提供薪酬可消费判定，但薪酬明细、任务候选和工作概览旧摘要的消费者硬切仍属于 Phase 6，不能据此声明 PF-29 全量通过。

### Phase 6：薪酬及其他消费者收口

Status: `implemented_and_verified_2026-07-17`.

1. 薪酬只消费符合条件的结果和唯一引用。
2. 已确认薪酬后的更正生成后续差额。
3. 人员、任务候选和绩效看板停止读取旧绩效事实。
4. 收敛风险文案。

实现结果：薪酬通过正式绩效适配器只消费月度预发和季度差额；反馈期内待确认结果和有效异议被排除；薪酬确认只结算实际引用的正式结果。月度来源更正会生成月度 V2，并显式触发季度 V2；若原薪酬已确认，两个新版本都只结算相对已承接版本的差额并顺延至下一未确认月份。工作概览、人员总览、绩效看板、任务候选和人员任务摘要均已切换到当前正式结果，其中任务候选只把绩效作为软提示，不作为可分配资格门禁。

自动领域、跨模块和静态残留证据已完成。PF-29已取得发布后的绩效看板、人员总览和薪酬读取证据；PF-32已取得当前账号来源草稿、管理端发布、员工确认、管理端回读及全新会话直接可见证据。

### Phase 7：组件、残留和证据收口

Status: `implemented_and_verified_2026-07-17`.

1. 合并月度和季度详情组件。
2. 抽屉收敛为三个 Tab。
3. 删除旧类型、Mock、测试和文案。
4. 完成自动测试、静态残留扫描和浏览器验收。
5. 更新跨模块契约、路由清单和测试证据。

实现结果：管理端月度/季度结果和员工端我的绩效均复用`PerformanceResultDrawer`，统一为`结果概览 / 来源明细 / 操作记录`三个Tab。`PeopleWorkEvaluationRecord`及`PeopleMember.workEvaluationSummary / workEvaluationRecords`已从人员类型、Mock、创建默认值、仓库克隆和测试夹具中删除；当前绩效只允许由正式绩效结果读模型提供。`performance-phase7-residual-hardcut.mjs`全量扫描前端源文件，并锁定旧文件不回归、两个页面复用共享抽屉及三个Tab结构。

自动领域、静态残留、Web质量及浏览器页面交互证据已完成。PF-29和PF-32均为`passed`；当前账号结果由任务验收来源生成，演示启动模型只调用正式发布领域函数，不维护脱离来源的静态正式结果。

## 18. 验收矩阵

每项必须具备自动测试证据；UI 项另需浏览器证据。单纯类型检查或页面能打开不能替代业务验收。

| ID | 场景 | 输入与动作 | 预期结果 | 证据类型 |
| --- | --- | --- | --- | --- |
| PF-01 | 规则自动适用 | 全职员工、匹配岗位、规则已发布且在生效期 | 唯一命中规则版本，员工无需操作 | 领域测试 |
| PF-02 | 规则不适用 | 兼职、岗位不匹配、未发布或不在生效期 | 返回明确不适用原因，不生成结果 | 领域测试 |
| PF-03 | 规则冲突 | 同岗位同期间命中两个发布版本 | 阻断计算并标记规则配置冲突 | 领域测试 + UI |
| PF-04 | 规则版本边界 | 新版本下月生效 | 历史结果保留旧版，新期间使用新版 | 领域测试 |
| PF-05 | 签署档案不控制计算 | 员工无已签文件但规则适用 | 可正常生成绩效草稿，档案页仅显示资料缺口 | 领域测试 + UI |
| PF-06 | 线下档案维护 | 上传新规则版本已签文件 | 新文件成为当前档案，旧文件转历史，不改变绩效结果 | 领域测试 + UI |
| PF-07 | 在线确认残留清零 | 扫描绩效签署相关代码 | 旧批次、在线确认、电子签和旧版回退类型/逻辑不存在 | 静态自动门禁 |
| PF-08 | 任务验收来源唯一 | 一条任务完成验收 | 只生成一条计分来源，重复验收不重复计入 | 跨模块领域测试 |
| PF-09 | 非有效任务排除 | 未验收、退回、作废或兼职任务 | 不进入全职月度绩效 | 领域测试 |
| PF-10 | 结构化公式 | 修改规则预发比例、未达标系数、质量权重 | 结果按结构化值变化，不解析显示文本 | 领域测试 |
| PF-11 | 中途入离职折算 | 月中入职或离职 | 得分不折算，满分、达标线和基础金额按有效工作日折算 | 领域测试 |
| PF-12 | 零任务月份 | 规则适用但当月无任务 | 生成0分0元草稿，季度来源视为完整 | 领域测试 |
| PF-13 | 未实现模板隔离 | 岗位职责考核、项目奖金未启用 | 不生成结果、不进入薪酬、页面不伪装为可用 | 领域测试 + 静态门禁 |
| PF-14 | 月度草稿重算 | 未发布时来源变化 | 草稿金额和来源哈希更新，不产生历史正式版本 | 领域测试 |
| PF-15 | 月度结果发布 | 管理端发布草稿 | 冻结版本、来源快照、发布信息和薪酬引用，并送达员工 | 工作流测试 + UI |
| PF-16 | 员工确认本人结果 | 当前员工确认当前版本 | 记录员工、时间、版本；金额不变 | 工作流测试 + UI |
| PF-17 | 员工提出异议 | 当前员工填写原因提交 | 状态为有异议，员工不能修改金额，不新增审批 | 工作流测试 + UI |
| PF-18 | 越权与旧版本反馈 | 操作他人结果或已被替代版本 | 操作被拒绝，当前结果不变 | 工作流测试 |
| PF-19 | 反馈期与到期未反馈 | 结果已送达，期间包含普通周末、法定节假日或调休补班，随后超过截止时间 | 从送达次日按员工工作日历计算3个工作日；休息日跳过、特殊工作日计入；反馈期内绩效暂不进入薪酬，到期无异议后可进入，基础工资始终不被阻断 | 领域测试 + UI |
| PF-20 | 异议薪酬边界 | 绩效有有效异议 | 该绩效结果暂不进入当前薪酬，其他工资项目不受影响 | 跨模块测试 |
| PF-21 | 季度应有月份 | 月中入职或规则季度中生效 | 只要求实际适用月份，不适用月份不算缺失 | 领域测试 |
| PF-22 | 季度缺月阻断 | 任一应有月无已发布结果 | 不允许发布季度结果，并列出缺失月份 | 领域测试 + UI |
| PF-23 | 季度金额计算 | 三个月结果及预发齐全 | 自动计算季度金额、预发合计和差额 | 领域测试 |
| PF-24 | 季度调整 | 调整金额非零 | 必须填写原因；最终金额等于计算金额加调整金额 | 工作流测试 + UI |
| PF-25 | 季度结算期间 | 发布季度结果 | 自动派生薪酬结算月份，不出现自由结算日期 | 领域测试 + UI |
| PF-26 | 季度员工反馈 | 季度结果送达员工 | 可确认或提出异议，规则与月度结果一致 | 工作流测试 + UI |
| PF-27 | 薪酬唯一消费 | 同一结果被重复归集 | 只生成一次月度预发或季度差额结算行 | 跨模块测试 |
| PF-28 | 薪酬确认后更正 | 已确认薪酬对应绩效被更正 | 原工资不变，差额进入下一未确认薪酬 | 跨模块测试 |
| PF-29 | 统一读模型 | 查看绩效明细、我的绩效、看板和人员摘要 | 同一结果版本的金额、状态和期间一致 | 集成测试 + UI |
| PF-30 | 风险文案 | 连续低绩效人员 | 显示中性风险事实，不显示直接开除结论 | 单元测试 + UI |
| PF-31 | 共享抽屉 | 管理端月度、季度及员工端打开结果 | 复用三 Tab 领域组件，无重复详情或页面穿透 | UI + 静态检查 |
| PF-32 | 会话一致性 | 全新会话进入我的绩效；发布后路由切换到我的绩效和薪酬 | 全新会话可见来源驱动的演示正式结果；同一会话变更立即反映；刷新重建演示状态但不宣称持久化 | 领域测试 + 浏览器验收 |

## 19. 自动测试与证据映射

### 19.1 计划测试文件

- `performanceRuleApplicabilityModel.test.ts`：PF-01至PF-05。
- `performanceSignatureModel.test.ts`：PF-05至PF-07。
- `taskPerformanceMonthlySourceModel.test.ts`：PF-08、PF-09、PF-12、PF-13。
- `performanceMonthlyModel.test.ts`：PF-10、PF-11；PF-14 在 Phase 3 实现。
- `performanceResultWorkflow.test.ts`：PF-15至PF-20。
- `performanceQuarterlyResultModel.test.ts`：PF-21至PF-26；PF-26当前覆盖季度发布后的送达和待反馈契约，员工动作证据由 Phase 5 补齐。
- `salaryPerformanceConsumptionModel.test.ts`、`salaryDomain.test.ts`：PF-20、PF-27、PF-28。
- `performanceQuarterlyResultModel.test.ts`：PF-28季度来源更正和季度V2证据。
- `peopleDomain.test.ts`、`personTaskViewModel.test.ts`、`taskAssignmentCandidates.test.ts`：PF-29、PF-30。
- `performance-phase6-consumer-hardcut.mjs`：PF-29当前消费页面的旧绩效事实残留门禁。
- 绩效前端行为验收脚本：PF-15至PF-17、PF-22、PF-24至PF-26、PF-29至PF-32。

### 19.2 强制追踪格式

`docs/testing/performance-frontend-acceptance-traceability.md`必须逐项记录：

```text
验收编号
-> 真实业务输入
-> 领域计算
-> 跨模块状态变化
-> 薪酬消费结果（如适用）
-> 反向处理
-> 自动测试名称和命令
-> 浏览器证据（如适用）
```

没有真实测试名称、执行命令和结果的验收项只能标记`未完成`。

### 19.3 验证命令

```bash
corepack pnpm test:web
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build:web
corepack pnpm ai-native:check
git diff --check
```

需要增加针对旧模型的自动静态扫描，至少覆盖：

- `PerformanceSignatureStatus`
- `PerformanceSignatureMethod`
- `PerformanceSignatureEmployeeStatus`
- `PerformanceSignatureBatch`
- `performanceSignatureBatches`
- `缺少签署`
- `签署版本不一致`
- `签署规则选项`
- 绩效签署上下文中的`在线确认 / 电子签待接入 / 未签新版继续旧版`
- 业务消费者对`workEvaluationSummary / workEvaluationRecords`的当前绩效读取

## 20. UI 验收标准

浏览器验收至少覆盖：

1. `/performance/rules`：规则适用条件、版本和生效期清晰；无员工确认规则文案。
2. `/performance/signatures`：页面名称和内容为线下签署档案；当前/历史文件可预览下载；无在线确认流程。
3. `/performance/monthly`：月度和季度结果统一列表；抽屉最多三个 Tab；发布、更正动作符合状态。
4. `/my-work/performance`：员工只看到本人结果；可以确认或提出异议；不能编辑金额。
5. `/performance/dashboard`：只统计已发布结果；异议单独摘要。
6. 人员总览和人员详情绩效摘要：与绩效明细同一版本，风险文案中性。
7. 薪酬绩效构成：只出现符合条件的预发和季度差额，无重复结算。

通用视觉标准：

- 页面和抽屉无横向溢出。
- Tab 区域与内容区使用项目统一结构和间距。
- 月度、季度详情不复制卡片和表格结构。
- 操作按钮只出现在当前状态可执行时；禁用按钮有业务原因。
- 文件继续使用预览、下载一体的相关文件组件。
- 键盘可聚焦，Tab、表格行和抽屉操作有可辨识名称。
- 空状态、错误状态、无权限状态和无适用规则状态均有真实业务文案。

## 21. 计划影响文件

### 21.1 绩效领域

- `apps/web/src/features/performance/performanceTypes.ts`
- `performanceRuleModel.ts`
- `performanceExecutionContract.ts`
- `performanceSignatureArchiveData.ts`
- `performanceSignatureModel.ts`
- `PerformanceSignaturesPage.tsx`
- `PerformanceSignatureCreateDrawer.tsx`
- `PerformanceSignatureDrawer.tsx`
- `taskPerformanceMonthlySourceModel.ts`
- `performanceMonthlyModel.ts`
- `usePerformanceMonthlyRecords.ts`
- `performanceQuarterlyReviewModel.ts`
- `PerformanceMonthlyState.tsx`
- `PerformanceMonthlyPage.tsx`
- `PerformanceDashboardPage.tsx`
- `performanceDashboardModel.ts`
- 对应测试和新结果领域文件。

### 21.2 直接消费者

- `apps/web/src/features/my-work/MyWorkPages.tsx`或拆出的绩效员工页。
- `apps/web/src/features/people/PeopleOverviewPage.tsx`
- `apps/web/src/features/people/peoplePerformanceRiskModel.ts`
- 任务候选和人员任务中的绩效摘要适配器。
- `apps/web/src/features/salary/salaryDomain.ts`及测试，仅调整绩效消费条件和引用。

### 21.3 路由、导航和证据

- `apps/web/src/app/router.tsx`
- `apps/web/src/app/shell.tsx`
- `docs/data/frontend-cross-module-contracts.md`
- `docs/testing/test-plan.md`
- 新增`docs/testing/performance-frontend-acceptance-traceability.md`
- 路由和代码结构清单中受影响的绩效条目。

## 22. 门禁

| 门禁 | 分类 | 当前状态 | 阻断效果 |
| --- | --- | --- | --- |
| 范围仅绩效前端 | `document_gate` | 已确认 | 发现后端、数据库、财务实现改动立即停止 |
| 不新增审批流 | `document_gate` | 已确认 | 出现新审批状态或页面不得合并 |
| 规则自动适用 | `document_gate + evidence_gate` | Phase 1 已通过 | 员工规则确认残留时不得完成 |
| 签署仅为档案 | `document_gate + evidence_gate` | Phase 1 已通过 | 档案仍影响计算时不得完成 |
| 真实任务来源与结构化公式 | `document_gate + automated_gate` | Phase 2 已通过 | 静态结果 Mock、显示文案计算或来源重复时不得完成 |
| 单一绩效结果事实 | `evidence_gate` | Phase 6生产消费者和静态门禁已完成；2026-07-17浏览器验证管理端发布后看板、人员和薪酬读取边界一致 | 多页面金额或版本不一致时不得完成 |
| 季度结果归集 | `document_gate + automated_gate` | PF-21至PF-26已通过 | 缺月、未发布月度来源、自由结算日期、无原因调整或员工反馈绕过当前版本时不得完成 |
| 员工结果反馈 | `document_gate + automated_gate` | PF-16至PF-20及PF-26员工动作已通过 | 越权、旧版本、超期反馈、金额可编辑或新增审批状态时不得完成 |
| 验收编号自动映射 | `automated_gate` | PF-01至PF-32证据已建立；PF-32已完成当前账号来源草稿、来源驱动演示初始化、管理端发布、员工确认和管理端回读 | 未覆盖验收项不得声明整条绩效链路闭环 |
| 旧模型残留扫描 | `automated_gate` | Phase 7已删除旧人员绩效类型、Mock和测试夹具，并对全部前端源文件建立静态门禁 | 任一前端源文件重新出现旧绩效契约不得完成 |
| Web质量门禁 | `automated_gate` | Phase 6 Web单测、类型检查、Lint、生产构建和AI Native检查均已通过 | test/typecheck/lint/build任一失败不得完成 |
| 浏览器交互验收 | `evidence_gate` | 已通过；本机Chromium CDP完成管理端三Tab键盘切换、月度/季度发布、跨路由读取、当前账号员工确认、管理端回读、截图和控制台检查 | 页面状态、身份隔离、反馈回写或浏览器错误不符合预期时不得完成 |

本轮文档编制不触发生产、数据、权限或财务高风险手工审批门禁。

## 23. 回退与恢复

本轮无数据库迁移或持久化数据转换。执行期间按阶段提交：

- 每个 Phase 独立提交并附对应验收编号。
- 若阶段门禁失败，回退该阶段代码提交，不保留双读兼容分支。
- Mock 直接回到上一个已通过阶段基线。
- 不通过恢复旧在线签署流程来规避问题。

## 24. 已知边界与剩余风险

1. 当前状态为前端会话状态，刷新后不会保留发布、确认和异议操作。
2. 文件上传、预览和下载仍是前端原型，不能作为真实存储证据。
3. 后端接入前无法证明并发发布、重复提交、权限绕过和跨会话幂等。
4. 反馈期限已确定为`3个工作日`；前端阶段只能验证日历算法与快照口径，真实送达证据和跨会话截止日持久化仍待后端接入。
5. 当前只闭环绘图任务制；新绩效模板必须先提供真实来源、公式和验收，再进入结果状态机。
6. 低绩效风险只作管理提示，不能由前端直接推导劳动关系处理结论。
7. Phase 3 未初始化虚假的正式结果 Mock；未发布数据保持草稿，只有同一前端会话内执行发布后才进入看板和人员摘要。
8. Phase 7已删除人员档案中的旧评价字段；历史绩效只能读取正式绩效结果版本，不再保留双读兼容契约。
9. 任务验收计分的反向修正入口属于任务验收业务重构，在本计划第5.5项中明确排除；绩效结果会在正式来源变化后重算和生成更正版本，但本轮不偷加任务审批或重开验收流程。

## 25. 完成定义

只有同时满足以下条件，才能声明“绩效前端硬切完成”：

1. PF-01至PF-32全部有可执行测试证据且通过。
2. 规则自动适用与签署档案彻底解耦。
3. 月度、季度、员工端、看板、人员摘要和薪酬读取同一结果版本。
4. 员工规则确认旧模型和签署驱动计算逻辑无残留。
5. 未实现模板不再产生静态业务结果。
6. 月度发布、员工确认、异议、更正、季度差额和薪酬消费正向及反向场景通过。
7. Web测试、类型检查、Lint、构建、AI Native检查和差异检查全部通过。
8. 关键页面完成浏览器交互和布局验收。
9. 测试计划、跨模块契约、路由清单和验收追踪文档同步。
10. 关闭报告明确说明未进入后端，且不得声称跨会话持久化或生产闭环。

该文档是执行基线，不是实现完成证据。
