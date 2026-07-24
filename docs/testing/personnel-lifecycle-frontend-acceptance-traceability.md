# 人员全生命周期前端验收追踪表

## 1. 验收边界

本追踪表覆盖人员主数据从建档、生效、异动到关系结束后，被考勤、任务、绩效和薪酬消费的前端业务闭环。

本轮不包含后端 API、数据库、账号权限执行、生产数据迁移或服务端并发控制。前端通过共享领域状态和不可变业务快照证明流程口径；后端持久化仍是后续门禁。

## 2. 已确认业务口径

- 人员可以同时任职多个岗位，并明确一个主岗位。
- 岗位调整、转正、薪资标准调整、离职和结束合作通过人事异动留痕，不允许在档案维护中覆盖历史任职事实。
- 工作日历属于人员适用规则；全职建档时生成日历任职记录，后续只能通过工作日历异动按生效日变更，兼职不进入考勤月报。
- 异动按生效日期影响考勤、任务、绩效和薪酬。
- 已确认但未发放的薪酬来源变化后退回待确认；已发放月份不得直接覆盖原人员事实。
- 离职或结束合作后停止新任务承接；既有历史任务、绩效、薪酬和档案记录保留。
- 不新增人员审核、异动审批或员工确认岗位/规则流程。

## 3. 场景追踪

`complete` 表示已有前端生产代码与自动或静态证据；它不代表已取得后端持久化、并发控制和服务端权限证据。

| 编号 | 场景 | 正向结果 | 阻断与反向结果 | 自动证据 | 状态 |
| --- | --- | --- | --- | --- | --- |
| PL-01 | 新增全职人员 | 生成唯一工号，保存主岗位及兼任岗位，默认工作日历，状态为试用期 | 缺少主岗位、主岗位不在任职岗位中或重复工号时禁止保存 | `peopleDomain.test.ts`、建档表单静态门禁 | complete |
| PL-02 | 新增兼职人员 | 状态为合作中，不进入工作日历和考勤月报 | 兼职不得保留全职工作日历或社保公积金口径 | `peopleDomain.test.ts`、`peopleAttendanceMonthlyDomain.test.ts` | complete |
| PL-03 | 档案维护边界 | 联系、学历、收款资料、任务能力和档案文件可维护 | 人员类型、任职岗位、入离职日期和薪资标准不能绕过异动覆盖 | 档案保存契约及残留扫描 | complete |
| PL-04 | 多岗位人数与展示 | 每个任职岗位均统计该人员，主岗位用于紧凑展示 | 岗位重命名同步全部任职关系 | `peopleDomain.test.ts`、`peopleLifecycleFrontendWorkflow.test.ts` | complete |
| PL-05 | 多岗位绩效规则适用 | 任一任职岗位可参与规则匹配；唯一规则自动适用 | 多岗位命中多条同类规则时进入规则冲突，不静默取第一条 | `performanceRuleApplicabilityModel.test.ts` | complete |
| PL-06 | 任务候选任职区间 | 任务时间完全落在人员有效关系区间内才可选择 | 尚未入职、已离职或合作期外均不可选择 | `taskAssignmentCandidates.test.ts`、`peopleLifecycleFrontendWorkflow.test.ts` | complete |
| PL-07 | 转正 | 生效日后切换正式薪资口径并保留异动前后快照 | 影响已确认薪酬时退回待确认；已发放月份阻断直接生效 | `peopleDomain.test.ts`、`peopleLifecycleFrontendWorkflow.test.ts` | complete |
| PL-08 | 岗位调整 | 通过异动更新主岗位和兼任岗位，保留前后值 | 不允许主岗位脱离任职岗位集合；后续异动存在时禁止直接冲正前序记录 | `peopleDomain.test.ts`、`peopleLifecycleFrontendWorkflow.test.ts` | complete |
| PL-09 | 薪资标准调整 | 生效月份及后续未锁月份按新标准重算 | 已发放月份阻断直接生效；已确认未发放月份失效重算 | `salaryDomain.test.ts`、`peopleLifecycleFrontendWorkflow.test.ts` | complete |
| PL-10 | 离职 | 生效日关闭任务资格、停止后续考勤/绩效/薪酬并保留历史 | 存在已发放受影响月份时禁止覆盖原事实 | `peopleDomain.test.ts`、`peopleLifecycleFrontendWorkflow.test.ts` | complete |
| PL-11 | 结束合作 | 生效日关闭兼职任务资格和后续劳务来源 | 已结算历史任务及劳务事实不删除 | `peopleDomain.test.ts`、自然人付款验收 | complete |
| PL-12 | 待生效异动 | 生效前仅保留待办记录，不提前改变主数据 | 可作废且不得产生下游变化 | `peopleMovementRecordModel.test.ts` | complete |
| PL-13 | 已生效异动冲正 | 无后续异动且下游未锁定时恢复原快照 | 有后续异动或已发放月份时禁止直接冲正 | `peopleMovementRecordModel.test.ts`、`peopleLifecycleFrontendWorkflow.test.ts` | complete |
| PL-14 | 考勤月报 | 只生成有效任职区间内全职人员的当月数据 | 兼职和关系区间外人员不生成 | `peopleAttendanceMonthlyDomain.test.ts` | complete |
| PL-15 | 绩效折算 | 月中入职、离职按实际工作日折算目标和金额 | 关系区间外不生成，历史已发布结果不被主数据覆盖 | `performanceMonthlyModel.test.ts`、`performanceResultModel.test.ts` | complete |
| PL-16 | 薪酬折算 | 入职、转正、离职和考勤按工作日/小时进入当月薪酬 | 来源变化退回待确认，已发放锁定 | `salaryDomain.test.ts`、`peopleLifecycleFrontendWorkflow.test.ts` | complete |
| PL-17 | 人员总览与档案一致 | 总览只展示有效关系人员；档案保留全部历史人员 | 离职、结束合作不继续出现在人员总览 | `peopleDomain.test.ts` | complete |
| PL-18 | 跨模块身份一致 | 工号作为人员、任务、绩效、薪酬和财务自然人事实的稳定关联键 | 禁止通过姓名作为当前业务关联主键 | 工号残留扫描、自然人付款验收 | complete |
| PL-19 | 工作日历异动 | 生效日前后分别解析旧、新日历；月中变更按每日有效规则计算 | 档案维护不得覆盖日历；影响已确认未发放月份时撤销考勤确认并重算，已发放月份阻断 | `peopleDomain.test.ts`、`peopleAttendanceMonthlyDomain.test.ts` | complete |
| PL-20 | 工作日历历史快照 | 考勤确认时冻结当月日历、有效工作日和扣减事实 | 日历模板或法定节假日后续变化不得改写已确认月份 | `peopleAttendanceMonthlyDomain.test.ts` | complete |
| PL-21 | 任务容量边界 | 日历缺失、请假冲突或可用工时不足只提示，由员工自行调配 | 不改任务截止时间；人员关系无效、无任务权限或能力不匹配仍禁止选择 | `taskAssignmentCandidates.test.ts` | complete |

## 4. 当前实现结论

本轮已完成人员前端生命周期硬切：

1. `PeopleMember` 使用“全部任职岗位 + 主岗位”契约，岗位统计、绩效规则匹配和岗位重命名均消费完整岗位集合。
2. 档案维护不再覆盖人员类型、任职岗位、关系日期、工作日历和薪资事实；这些变化统一通过人事异动。
3. 转正、岗位调整、薪资标准调整和离职会使受影响的已确认薪酬退回待确认；已发放月份阻断直接覆盖及冲正。
4. 任务候选同时检查当前状态与任务计划时间，尚未入职、已离职和合作期外均不可选。
5. 兼职实发摘要已由姓名关联硬切为工号关联，不会因重名或改名误归集财务流水。
6. PL-01 至 PL-21 已形成统一验收追踪，不再仅依赖页面可见结果。

仍未进入本轮的是后端持久化、并发唯一性、服务端权限、定时生效调度和审计级不可篡改记录。当前待生效异动在前端只表示为待办事实，刷新后状态不持久，不宣称为正式系统自动生效能力。

## 5. 完成标准

- PL-01 至 PL-21 每项均有生产代码与自动测试或明确的静态门禁证据。
- 人员主数据只有一个共享前端状态源，不保留页面私有人员副本。
- 已确认口径不存在单岗位旧契约、档案绕过异动、姓名关联或已锁期间直接覆盖。
- `typecheck`、`test:web`、`build:web`、`ai-native:check` 和 `git diff --check` 全部通过。
- 未取得后端持久化证据前，只能声明“前端业务闭环通过”。
