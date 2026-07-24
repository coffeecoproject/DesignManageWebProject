export type MasterDataMutationResult = {
  message?: string;
  success: boolean;
};

export function allowMasterDataMutation(): MasterDataMutationResult {
  return { success: true };
}

export function blockMasterDataMutation(message: string): MasterDataMutationResult {
  return { message, success: false };
}

export function validateTaskConfigStatusChange(status: '启用' | '停用', activeTaskCount: number) {
  return status === '停用' && activeTaskCount > 0
    ? blockMasterDataMutation(`仍有 ${activeTaskCount} 个在途任务使用该类型，暂不可停用`)
    : allowMasterDataMutation();
}

export function validateDefaultMasterDataStatusChange(
  status: '启用' | '停用',
  isDefault: boolean,
  message: string
) {
  return status === '停用' && isDefault ? blockMasterDataMutation(message) : allowMasterDataMutation();
}

export function validatePrimaryCategoryStatusChange(status: '启用' | '停用', enabledChildCount: number) {
  return status === '停用' && enabledChildCount > 0
    ? blockMasterDataMutation('请先停用该一级类目下的启用二级类目')
    : allowMasterDataMutation();
}
