export type TaskCreationEligibilityInput = {
  acceptorAvailable: boolean;
  brandAvailable: boolean;
  brandTaskAvailable: boolean;
  customerStatus?: string;
  executorAvailable: boolean;
  storeAvailable: boolean;
  taskConfigAvailable: boolean;
};

export function getTaskCreationBlockingMessage(input: TaskCreationEligibilityInput) {
  if (input.customerStatus !== '合作中') {
    return '当前客户没有生效中的合同，不能新增任务';
  }
  if (!input.brandAvailable) {
    return '当前品牌不可用于新增任务';
  }
  if (!input.brandTaskAvailable) {
    return '当前品牌未配置该任务类型';
  }
  if (!input.storeAvailable) {
    return '当前门店不可用于新增任务';
  }
  if (!input.taskConfigAvailable) {
    return '当前任务类型已停用';
  }
  if (!input.executorAvailable) {
    return '当前执行人不可承接任务';
  }
  if (!input.acceptorAvailable) {
    return '当前验收人不可验收任务';
  }
  return undefined;
}
