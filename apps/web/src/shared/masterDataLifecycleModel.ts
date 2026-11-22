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

export function validateDefaultMasterDataStatusChange(
  status: '启用' | '停用',
  isDefault: boolean,
  message: string
) {
  return status === '停用' && isDefault ? blockMasterDataMutation(message) : allowMasterDataMutation();
}
