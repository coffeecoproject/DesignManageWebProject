import { allowMasterDataMutation, blockMasterDataMutation } from '../../shared/masterDataLifecycleModel';

export function validateTaskConfigStatusChange(status: '启用' | '停用', activeTaskCount: number) {
  return status === '停用' && activeTaskCount > 0
    ? blockMasterDataMutation(`仍有 ${activeTaskCount} 个在途任务使用该类型，暂不可停用`)
    : allowMasterDataMutation();
}
