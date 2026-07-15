# 增值税前端验收追踪

## 范围

本追踪表覆盖小规模纳税人前端链路：业务纳税义务、销项发票、未开票收入、红票、申报准备、官方申报结果、附加税、会计调整、缴款及更正。它不把类型检查或页面可见性视为业务闭环证据。

## 验收映射

| 编号 | 业务场景 | 领域结果 | 自动证据 |
| --- | --- | --- | --- |
| VAT-01 | 按所属期选择税务政策 | 申报准备使用当期小规模口径 | `financeTaxMatterModel.test.ts` |
| VAT-02 | 已确认收入尚未收款、尚未开票 | 按权责事实进入未开票候选，不依赖收款 | `financeTaxMatterModel.test.ts` |
| VAT-03 | 财务排除系统纳入的未开票事项 | 必须选择真实原因，否则阻断确认 | `financeTaxMatterModel.test.ts` |
| VAT-04 | 季度销售额低于门槛但存在专票 | 专票部分仍按票面计税 | `financeTaxMatterModel.test.ts` |
| VAT-05 | 前期已按未开票收入申报 | 后期不得再次作为未开票收入申报 | `financeTaxMatterModel.test.ts` |
| VAT-06 | 后期开票关联前期收入 | 不反写前期权责凭证 | `financeAccountingVoucherModel.test.ts` |
| VAT-07 | 前期未开票后期开票、红票冲销 | 后期开票只做当期冲抵；红票必须关联原蓝票并形成调整 | 两个领域测试文件 |
| VAT-08 | 已确认来源后业务数据变化 | 已申报快照不被静默覆盖，改走更正 | `financeTaxMatterModel.test.ts` |
| VAT-09 | 官方申报成功或零申报 | 申报准备归档为已进入税务办理 | `financeTaxMatterModel.test.ts` |
| VAT-10 | 申报额与账面已确认增值税勾稽 | 两者独立计算，禁止同值复制自证 | `financeTaxMatterModel.test.ts` |
| VAT-11 | 登记电子税务局实际结果 | 增值税、城建税、教育费附加、地方教育附加分项保存并合计 | `financeTaxMatterModel.test.ts` |
| VAT-12 | 申报额与权责凭证税额存在差异 | 生成可复核的增值税差额及附加税调整凭证，不改原凭证 | `financeAccountingVoucherModel.test.ts` |
| VAT-13 | 税费缴款 | 流水分项与增值税及三项附加负债一致 | `financeTaxMatterModel.test.ts`、`financeAccountingVoucherModel.test.ts` |
| VAT-14 | 申报更正、流水冲正 | 保留原申报版本，后续仅生成差额凭证及剩余缴款 | 两个领域测试文件 |

## 完成判定

每项必须同时满足：真实业务输入可构造、领域状态可验证、会计或申报结果可验证、反向场景不改写历史、自动测试通过。Mock 仅用于承载场景，不得绕过生成和状态转换函数直接拼接“已完成”结果。

## 当前边界

- 本轮只实现前端领域模型、状态、交互和测试，不包含电子税务局接口、后端事务、持久化幂等或生产权限。
- 税率、免税门槛、附加税减免继续由税务口径版本提供，业务页面不允许自行配置。
- 申报结果允许登记电子税务局分项结果；差异必须保留说明，不覆盖申报前测算快照。
