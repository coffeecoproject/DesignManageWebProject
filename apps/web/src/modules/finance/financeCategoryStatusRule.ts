import { allowMasterDataMutation, blockMasterDataMutation } from '../../shared/masterDataLifecycleModel';

export function validatePrimaryCategoryStatusChange(status: '启用' | '停用', enabledChildCount: number) {
  return status === '停用' && enabledChildCount > 0
    ? blockMasterDataMutation('请先停用该一级类目下的启用二级类目')
    : allowMasterDataMutation();
}
