export type FinanceSourceMutationPeriodCheckMode =
  | 'source_period'
  | 'source_and_target_period'
  | 'target_period_required';

export type FinanceSourceMutationClosedPeriodPath =
  | 'reject_direct_mutation'
  | 'reject_then_later_period_adjustment'
  | 'reject_then_opening_adjustment'
  | 'reject_then_reopen_exception';

export type FinanceSourceMutationOperationMetadata = {
  accountingPeriodSource: string;
  closedPeriodBehavior: string;
  closedPeriodPath: FinanceSourceMutationClosedPeriodPath;
  operation: string;
  periodCheckMode: FinanceSourceMutationPeriodCheckMode;
};

export const financeSourceMutationOperationMetadata = [
  {
    accountingPeriodSource: '新建事项的目标归属月份',
    closedPeriodBehavior: '闭期时不得生成新的应收应付源单。',
    closedPeriodPath: 'reject_direct_mutation',
    operation: '新增应收应付事项',
    periodCheckMode: 'target_period_required'
  },
  {
    accountingPeriodSource: '导入发票所属月份',
    closedPeriodBehavior: '闭期时不得导入、重导入或生成该期间发票事实。',
    closedPeriodPath: 'reject_direct_mutation',
    operation: '导入税务发票数据',
    periodCheckMode: 'target_period_required'
  },
  {
    accountingPeriodSource: '应收应付原归属月份；调整归属月份时同时检查目标月份',
    closedPeriodBehavior: '闭期时不得调整金额、归属月份、税额依据或来源事实。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '调整应收应付事项',
    periodCheckMode: 'source_and_target_period'
  },
  {
    accountingPeriodSource: '应收应付原归属月份和收付款发生月份',
    closedPeriodBehavior: '闭期时不得登记收付款并回写源单结清进度。',
    closedPeriodPath: 'reject_direct_mutation',
    operation: '登记应收应付收付款',
    periodCheckMode: 'source_and_target_period'
  },
  {
    accountingPeriodSource: '应收应付事项归属月份',
    closedPeriodBehavior: '闭期时不得作废已进入账务期间的应收应付事项。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '作废应收应付事项',
    periodCheckMode: 'source_period'
  },
  {
    accountingPeriodSource: '应收应付事项归属月份',
    closedPeriodBehavior: '闭期时不得补确认或改写税额依据。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '确认应收应付税额依据',
    periodCheckMode: 'source_period'
  },
  {
    accountingPeriodSource: '发票所属月份和被匹配业务源单归属月份',
    closedPeriodBehavior: '闭期时不得确认发票匹配或回写应收应付税额依据。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '确认发票匹配',
    periodCheckMode: 'source_and_target_period'
  },
  {
    accountingPeriodSource: '发票所属月份和原匹配业务源单归属月份',
    closedPeriodBehavior: '闭期时不得撤销发票匹配或清除已作为税额依据的关联。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '撤销发票匹配',
    periodCheckMode: 'source_and_target_period'
  },
  {
    accountingPeriodSource: '发票当前所属月份和目标归属月份',
    closedPeriodBehavior: '闭期时不得把发票调入或调出已结账期间。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '调整发票归属期间',
    periodCheckMode: 'source_and_target_period'
  },
  {
    accountingPeriodSource: '红票所属月份和原蓝票所属月份',
    closedPeriodBehavior: '闭期时不得补建或改写红票原票关系。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '确认红票原票关系',
    periodCheckMode: 'source_and_target_period'
  },
  {
    accountingPeriodSource: '前期未开票业务归属月份和后续发票所属月份',
    closedPeriodBehavior: '闭期时不得改写后续开票关系；只能形成后续期间调整事实。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '确认后续开票',
    periodCheckMode: 'source_and_target_period'
  },
  {
    accountingPeriodSource: '流水发生日期对应月份',
    closedPeriodBehavior: '闭期时不得复核入账或把结清进度回写到源单。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '复核流水入账',
    periodCheckMode: 'source_period'
  },
  {
    accountingPeriodSource: '流水发生日期对应月份',
    closedPeriodBehavior: '闭期时不得退回复核中的流水。',
    closedPeriodPath: 'reject_direct_mutation',
    operation: '退回流水复核',
    periodCheckMode: 'source_period'
  },
  {
    accountingPeriodSource: '流水发生日期对应月份',
    closedPeriodBehavior: '闭期时不得作废流水。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '作废流水',
    periodCheckMode: 'source_period'
  },
  {
    accountingPeriodSource: '流水发生日期对应月份',
    closedPeriodBehavior: '闭期时不得补充或删除作为入账依据的流水凭证。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '补充流水凭证',
    periodCheckMode: 'source_period'
  },
  {
    accountingPeriodSource: '原流水发生月份和冲正/补差目标月份',
    closedPeriodBehavior: '闭期时不得改写历史流水，只能在开放期间生成冲正或补差流水。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '生成冲正补差流水',
    periodCheckMode: 'source_and_target_period'
  },
  {
    accountingPeriodSource: '银行流水交易日期和系统流水发生日期对应月份',
    closedPeriodBehavior: '闭期时不得确认对账或改写系统流水对账状态。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '确认银行对账',
    periodCheckMode: 'source_and_target_period'
  },
  {
    accountingPeriodSource: '银行流水交易日期和系统流水发生日期对应月份',
    closedPeriodBehavior: '闭期时不得撤销已确认对账。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '撤销银行对账',
    periodCheckMode: 'source_and_target_period'
  },
  {
    accountingPeriodSource: '银行流水交易日期对应月份',
    closedPeriodBehavior: '闭期时不得从银行记录补登记系统流水。',
    closedPeriodPath: 'reject_direct_mutation',
    operation: '补登记系统流水',
    periodCheckMode: 'source_period'
  },
  {
    accountingPeriodSource: '银行流水交易日期和目标调整流水发生月份',
    closedPeriodBehavior: '闭期时不得直接改历史流水，只能在开放期间生成对账调整流水。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '生成对账调整流水',
    periodCheckMode: 'source_and_target_period'
  },
  {
    accountingPeriodSource: '银行流水交易日期对应月份',
    closedPeriodBehavior: '闭期时不得把异常标记为已处理。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '处理银行对账异常',
    periodCheckMode: 'source_period'
  },
  {
    accountingPeriodSource: '候选凭证来源事实归属月份',
    closedPeriodBehavior: '闭期时不得制单；历史修正走后续期间调整。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '制单会计凭证',
    periodCheckMode: 'source_period'
  },
  {
    accountingPeriodSource: '批量候选凭证来源事实归属月份',
    closedPeriodBehavior: '闭期时不得批量制单。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '批量制单会计凭证',
    periodCheckMode: 'source_period'
  },
  {
    accountingPeriodSource: '会计凭证归属月份',
    closedPeriodBehavior: '闭期时不得记账入总账。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '记账会计凭证',
    periodCheckMode: 'source_period'
  },
  {
    accountingPeriodSource: '批量会计凭证归属月份',
    closedPeriodBehavior: '闭期时不得批量记账。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '批量记账会计凭证',
    periodCheckMode: 'source_period'
  },
  {
    accountingPeriodSource: '被冲销凭证归属月份和冲销目标期间',
    closedPeriodBehavior: '闭期历史凭证不得直接冲销；应创建后续期间调整事实。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '冲销会计凭证',
    periodCheckMode: 'source_and_target_period'
  },
  {
    accountingPeriodSource: '税费缴款流水发生日期对应月份',
    closedPeriodBehavior: '闭期时不得生成税费缴款流水。',
    closedPeriodPath: 'reject_direct_mutation',
    operation: '生成税费缴款流水',
    periodCheckMode: 'source_and_target_period'
  },
  {
    accountingPeriodSource: '申报准备项对应税务期间映射的会计月份',
    closedPeriodBehavior: '闭期时不得确认申报准备项。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '确认申报准备项',
    periodCheckMode: 'source_period'
  },
  {
    accountingPeriodSource: '未开票收入业务归属月份',
    closedPeriodBehavior: '闭期时不得确认未开票收入申报口径。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '确认未开票收入申报口径',
    periodCheckMode: 'source_period'
  },
  {
    accountingPeriodSource: '未开票收入业务归属月份',
    closedPeriodBehavior: '闭期时不得把本期收入改为暂不申报。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '确认本期暂不计入未开票收入',
    periodCheckMode: 'source_period'
  },
  {
    accountingPeriodSource: '前期未开票收入归属月份和后续发票所属月份',
    closedPeriodBehavior: '闭期时不得改写前期未开票后续开票关系。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '确认前期未开票后续开票',
    periodCheckMode: 'source_and_target_period'
  },
  {
    accountingPeriodSource: '申报准备结果所属会计月份',
    closedPeriodBehavior: '闭期时不得确认申报准备结果。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '确认申报准备结果',
    periodCheckMode: 'source_period'
  },
  {
    accountingPeriodSource: '税费所属法定期间映射的会计月份',
    closedPeriodBehavior: '闭期时不得确认税务申报。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '确认税务申报',
    periodCheckMode: 'source_period'
  },
  {
    accountingPeriodSource: '税费所属法定期间映射的会计月份',
    closedPeriodBehavior: '闭期时不得补充或改写税务办理回执。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '更新税务办理回执',
    periodCheckMode: 'source_period'
  },
  {
    accountingPeriodSource: '社保公积金所属缴费月份',
    closedPeriodBehavior: '闭期时不得确认员工社保公积金明细。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '确认社保公积金明细',
    periodCheckMode: 'source_period'
  },
  {
    accountingPeriodSource: '社保公积金缴费发生日期对应月份',
    closedPeriodBehavior: '闭期时不得确认社保公积金缴费或生成缴费流水。',
    closedPeriodPath: 'reject_direct_mutation',
    operation: '确认社保公积金缴费',
    periodCheckMode: 'source_and_target_period'
  },
  {
    accountingPeriodSource: '社保公积金所属缴费月份',
    closedPeriodBehavior: '闭期时不得补充或改写社保公积金回单。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '更新社保公积金回单',
    periodCheckMode: 'source_period'
  },
  {
    accountingPeriodSource: '薪酬结果所属工资月份',
    closedPeriodBehavior: '闭期时不得确认薪酬结果。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '确认薪酬社保结果',
    periodCheckMode: 'source_period'
  },
  {
    accountingPeriodSource: '薪酬结果所属工资月份；发放日只决定现金流发生月份',
    closedPeriodBehavior: '闭期时不得结算薪酬结果或生成工资发放流水。',
    closedPeriodPath: 'reject_direct_mutation',
    operation: '结算薪酬社保结果',
    periodCheckMode: 'source_and_target_period'
  },
  {
    accountingPeriodSource: '薪酬调整所属工资月份',
    closedPeriodBehavior: '闭期时不得新增薪酬调整。',
    closedPeriodPath: 'reject_then_later_period_adjustment',
    operation: '新增薪酬调整',
    periodCheckMode: 'source_period'
  },
  {
    accountingPeriodSource: '账套启用月份或期初调整目标月份',
    closedPeriodBehavior: '闭期时不得直接改期初余额，只能生成开放期间的期初调整凭证。',
    closedPeriodPath: 'reject_then_opening_adjustment',
    operation: '生成期初调整凭证',
    periodCheckMode: 'source_and_target_period'
  },
  {
    accountingPeriodSource: '账套启用月份',
    closedPeriodBehavior: '仅刚启用且未被凭证、总账、锁期使用时允许撤回；闭期或已使用后必须走期初调整。',
    closedPeriodPath: 'reject_then_opening_adjustment',
    operation: '撤回启用账套',
    periodCheckMode: 'source_period'
  }
] as const satisfies readonly FinanceSourceMutationOperationMetadata[];

const metadataByOperation: ReadonlyMap<string, FinanceSourceMutationOperationMetadata> = new Map(
  financeSourceMutationOperationMetadata.map((entry) => [entry.operation, entry] as [string, FinanceSourceMutationOperationMetadata])
);

export function findFinanceSourceMutationOperationMetadata(operation: string) {
  return metadataByOperation.get(operation);
}

export function resolveFinanceSourceMutationGuardPeriods({
  operation,
  sourceAccountingPeriod,
  targetAccountingPeriod
}: {
  operation: string;
  sourceAccountingPeriod?: string;
  targetAccountingPeriod?: string;
}) {
  const metadata = findFinanceSourceMutationOperationMetadata(operation);

  if (!metadata) {
    return [sourceAccountingPeriod, targetAccountingPeriod];
  }

  if (metadata.periodCheckMode === 'target_period_required') {
    return [targetAccountingPeriod];
  }

  if (metadata.periodCheckMode === 'source_period') {
    return [sourceAccountingPeriod];
  }

  return [sourceAccountingPeriod, targetAccountingPeriod];
}
