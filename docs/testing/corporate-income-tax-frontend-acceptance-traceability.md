# 企业所得税前端验收追踪

## 范围

本追踪表覆盖查账征收企业的前端企业所得税链路：本年累计账务来源、季度预缴、税务资料核对、小型微利企业判定、以前季度实缴抵减、年度汇算、官方申报结果、缴退税、会计凭证及更正。类型检查、页面可见性或固定 Mock 结果不能单独作为业务闭环证据。

## 验收映射

| 编号 | 业务场景 | 领域结果 | 自动证据 |
| --- | --- | --- | --- |
| CIT-01 | 同一税种存在季度预缴与年度汇算 | 使用独立申报场景和期间，不互相覆盖 | `financeTaxMatterModel.test.ts` |
| CIT-02 | 季度预缴读取账务数据 | 使用年初至季末已记账总账及利润表累计值 | `financeTaxMatterModel.test.ts` |
| CIT-03 | 小型微利人数和资产判定 | 使用截至本期的季度平均人数和资产 | `financeTaxMatterModel.test.ts` |
| CIT-04 | 适用小型微利企业优惠 | 同时满足所得额、人数、资产及行业条件后使用优惠口径 | `financeTaxMatterModel.test.ts` |
| CIT-05 | 已缴季度税额抵减 | 只读取以前季度已完成且已缴纳的办理结果 | `financeTaxMatterModel.test.ts` |
| CIT-06 | 账务或历史申报不连续 | 年初至季末存在未结账月份、待记账凭证或缺失以前季度申报时阻断确认 | `financeTaxMatterModel.test.ts` |
| CIT-07 | 季度税务资料未核对 | 纳税调整、亏损弥补或抵免所得税额缺少核对事实时不得确认 | `financeTaxMatterModel.test.ts` |
| CIT-08 | 已确认后来源变化 | 保留原确认快照并退回准备中，不静默覆盖 | `financeTaxMatterModel.test.ts` |
| CIT-09 | 年度调整和亏损弥补 | 只消费已核对、带来源的年度税务资料，不制造固定调整 | `financeTaxMatterModel.test.ts` |
| CIT-10 | 年度汇算前置条件 | 年度结账、正式报表、Q4 预缴和年度税务资料未完成时不得进入办理 | `financeTaxMatterModel.test.ts` |
| CIT-11 | 登记电子税务局结果 | 保留系统测算基线，实际应补退及差异说明独立保存 | `financeTaxMatterModel.test.ts` |
| CIT-12 | 更正申报 | 生成新申报版本并保留原官方结果和更正原因 | `financeTaxMatterModel.test.ts` |
| CIT-13 | 企业所得税确认后制单 | 按申报所属期确认所得税费用和应交所得税，不重复现金付款事实 | `financeAccountingVoucherModel.test.ts` |
| CIT-14 | 企业所得税退税 | 已复核退税流水冲减所得税负债，不计入营业外收入 | `financeAccountingVoucherModel.test.ts` |
| CIT-15 | 更正产生税额差异 | 生成版本化差额凭证，不覆盖原凭证 | `financeAccountingVoucherModel.test.ts` |
| CIT-16 | 年度汇算形成应退税额 | 先登记退税申请及回执，税务机关处理后才可登记分次到账 | `financeTaxMatterModel.test.ts` |
| CIT-17 | 已缴申报更正后形成退税 | 本版应退只消费本次更正差额，不重复累加历史缴款 | `financeTaxMatterModel.test.ts` |
| CIT-18 | 更正后会计差额 | 以上一申报版本的所得税确认额为基线，只生成本版差额 | `financeTaxMatterModel.test.ts` |
| CIT-19 | 缴款与退税金额门禁 | 不得超过当前申报版本待结算金额，未登记退税申请不得登记到账 | `financeTaxMatterModel.test.ts` |
| CIT-20 | 企业所得税更正顺序 | 只允许更正最近一期季度预缴；年度汇算已申报后不再调整当年季度预缴 | `financeTaxMatterModel.test.ts` |

## 完成判定

每项必须同时具备真实业务输入、领域状态变化、申报或会计结果和自动测试证据。季度与年度税务资料即使金额为零也必须显式核对；非零亏损、抵免和纳税调整必须保留来源。历史官方申报、已记账凭证和确认快照不得被后续计算静默覆盖。

## 当前边界

- 本轮只实现前端领域模型、状态、交互、Mock 场景和测试，不包含电子税务局接口、后端事务、持久化幂等或生产权限。
- 企业所得税口径按生效期读取，业务页面不允许自行修改税率、优惠限额和行业属性。
- 系统测算用于申报准备；正式申报金额、缴退税结果和回执以电子税务局结果为准。
- 退税申请和税务机关处理是外部税务流程，不新增平台内部审批。本系统仅登记申请回执和实际到账事实。
- 更正申报保留原版本，本版应补或应退与历史实缴、实退使用独立基线，不得重复结算。
