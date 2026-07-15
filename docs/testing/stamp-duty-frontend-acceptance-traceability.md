# 印花税前端验收追踪

## 范围

本追踪表覆盖小规模企业前端印花税链路：应税凭证识别、税目确认、无固定金额凭证后续结算、营业账簿、申报准备、外部申报结果登记、缴款、更正和会计凭证。页面能展示、类型检查通过或固定 Mock 金额正确，均不能单独作为闭环证据。

## 验收映射

| 编号 | 业务场景 | 预期结果 | 自动证据 |
| --- | --- | --- | --- |
| ST-01 | 已签建设工程合同且增值税单独列明 | 计税依据扣除单列增值税并按有效减免政策测算 | `financeStampDutyModel.test.ts` |
| ST-02 | 咨询服务无法直接确定法定税目 | 保持待确认，不根据名称猜税目 | `financeStampDutyModel.test.ts` |
| ST-03 | 普通主体间借款 | 不自动按金融机构借款合同计税 | `financeStampDutyModel.test.ts` |
| ST-04 | 同一凭证包含多个法定税目 | 分项金额必须完整覆盖原计税依据 | `financeStampDutyModel.test.ts` |
| ST-05 | 核对后确认非应税 | 保存非应税结论、依据和处理人，不生成税额 | `financeStampDutyModel.test.ts` |
| ST-06 | 补充协议调减 | 保留完整调减依据并按抵缴处理，不覆盖原税源 | `financeStampDutyModel.test.ts` |
| ST-07 | 无固定金额凭证 | 首期保留书立事实；实际结算形成独立税源 | `financeStampDutyModel.test.ts` |
| ST-08 | 季末确定实际结算金额 | 按金额确定日归入当季度，不错误滚入下一季度 | `financeStampDutyModel.test.ts` |
| ST-09 | 登记电子税务局申报结果 | 金额与准备快照不一致时必须保存差异原因 | `financeTaxMatterModel.test.ts` |
| ST-10 | 印花税申报成功 | 冻结本版申报和会计金额并进入缴款 | `financeTaxMatterModel.test.ts` |
| ST-11 | 已缴印花税发生调减 | 禁止直接作废；更正只生成净调减并进入退税 | `financeTaxMatterModel.test.ts` |
| ST-12 | 登记实际缴款 | 必须携带缴款回单并生成待复核税费流水 | `financeTaxMatterModel.test.ts` |
| ST-13 | 印花税确认制单 | 借记税金及附加，贷记应交印花税 | `financeAccountingVoucherModel.test.ts` |
| ST-14 | 营业账簿本年新增 | 仅对实收资本与资本公积超过历史已税最高基数的部分计税 | `financeStampDutyModel.test.ts` |
| ST-15 | 营业账簿缺少历史已税基数 | 阻断自动测算，不按当前总余额猜测 | `financeStampDutyModel.test.ts` |
| ST-16 | 已申报印花税发生调减 | 只生成调减差额凭证，不覆盖原税费凭证 | `financeAccountingVoucherModel.test.ts` |
| ST-17 | 印花税缴款流水复核入账 | 借记应交印花税，贷记银行存款 | `financeAccountingVoucherModel.test.ts` |

## 完成判定

每项必须具备真实业务输入、领域状态变化和自动测试证据。无固定金额凭证的结算文件、电子税务局申报回执、缴款回单和更正原因属于不同事实，不得互相替代。原始税源、申报版本和已生成会计凭证不得被后续操作覆盖。

## 当前边界

- 本轮只覆盖前端领域模型、交互、Mock 和自动验收，不接入电子税务局或后端持久化。
- 合同和产权转移书据按主体税种认定配置的申报周期归集；当前 Mock 使用合同按季、营业账簿按年。
- 外部申报金额与系统准备快照允许存在差异，但必须登记差异原因。
- 已缴申报不能直接作废；调增、调减通过版本化更正和后续缴退税处理，不新增平台内部审批。
