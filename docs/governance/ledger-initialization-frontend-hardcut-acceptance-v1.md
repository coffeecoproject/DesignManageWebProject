# 账套初始化前端硬切验收矩阵 v1

## 范围

本轮仅处理前端领域模型、页面状态、Mock 数据、总账和报表消费，不接入 API、数据库或持久化。

## 验收矩阵

| 编号 | 场景 | 领域结果 | 页面结果 | 下游结果 | 自动证据 |
| --- | --- | --- | --- | --- | --- |
| LI-01 | 年初启用 | 期初借贷平衡后才可启用 | 流程状态按基础设置、科目确认、期初、试算、启用推进 | 总账读取已启用期初 | `financeLedgerInitializationModel.test.ts` |
| LI-02 | 期中启用 | 同时保存启用日余额和本年累计借贷发生额 | 期初台账可查看、录入本年累计 | 年度总账和利润表包含启用前累计 | `financeGeneralLedgerModel.test.ts` |
| LI-03 | 辅助核算 | 科目、辅助类型、稳定对象 ID 共同唯一 | 辅助类型和对象均为受控选择 | 同科目可按多个客户、供应商或员工拆分 | `financeLedgerInitializationModel.test.ts` |
| LI-04 | 科目确认 | 确认时复制账套科目快照 | 科目确认具有显式动作 | 启用后总账和报表读取快照，不读取可变全局科目 | `financeLedgerInitializationModel.test.ts` |
| LI-05 | 试算阻断 | 期初余额与本年累计分别校验借贷平衡 | 阻断项进入校验结果 | 不平衡数据不进入总账 | `financeLedgerInitializationModel.test.ts` |
| LI-06 | 撤回启用 | 无已记账凭证且启用期间未锁定才允许撤回 | 撤回后回到试算平衡 | 总账停止消费该次启用数据 | `financeLedgerInitializationModel.test.ts` |
| LI-07 | 启用后调整 | 调整必须包含等额借方和贷方科目，辅助核算科目必须选择具体对象 | 在开放会计期间填写平衡分录及辅助对象 | 生成待记账调整凭证，不覆盖原期初 | `financeAccountingVoucherModel.test.ts` |
| LI-08 | 已结账原期间 | 原启用期间锁定不阻断后续开放期间调整 | 调整表单选择目标期间 | 调整归属后续开放期间 | `financeLedgerInitializationModel.test.ts` |

## 前端边界

- 导入文件目前只模拟预览和应用，不声明已经解析真实 Excel。
- 状态只在当前前端会话中保存，刷新持久化属于后端接入范围。
- 已记账凭证数量和期间锁定来自现有前端财务状态，不使用固定判断作为正式规则。
