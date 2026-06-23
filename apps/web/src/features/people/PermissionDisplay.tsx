import { Select, Tag } from 'antd';
import { TagChip, TagChipList } from '../../components/TagChip';
import {
  getPermissionCategory,
  permissionCatalog,
  permissionCategoryOrder,
  permissionCategoryTone,
  type PermissionCategory
} from './rolePermissionModel';

export function getPermissionGroups(permissions: string[]) {
  return permissionCategoryOrder
    .map((category) => ({
      category,
      permissions: permissions.filter((permission) => getPermissionCategory(permission) === category)
    }))
    .filter((item) => item.permissions.length > 0);
}

export function PermissionPreviewTags({
  emptyText = '未配置权限项',
  maxVisible = 3,
  permissions
}: {
  emptyText?: string;
  maxVisible?: number;
  permissions: string[];
}) {
  return <TagChipList emptyText={emptyText} items={permissions} maxVisible={maxVisible} wrap />;
}

export function PermissionGroupList({
  emptyText = '未配置权限项',
  permissions,
  onRemove
}: {
  emptyText?: string;
  permissions: string[];
  onRemove?: (permission: string) => void;
}) {
  const groupedPermissions = getPermissionGroups(permissions);

  if (groupedPermissions.length === 0) {
    return <div className="role-permission-empty">{emptyText}</div>;
  }

  return (
    <div className="role-permission-category-list">
      {groupedPermissions.map((group: { category: PermissionCategory; permissions: string[] }) => (
        <div className="role-permission-category-block" key={group.category}>
          <div className="role-permission-category-head">
            <span>{group.category}</span>
            <TagChip label={`${group.permissions.length} 项`} tone={permissionCategoryTone[group.category]} />
          </div>
          <div className="role-permission-tags">
            {group.permissions.map((permission) => (
              <Tag
                className="role-permission-tag"
                closable={Boolean(onRemove)}
                key={permission}
                onClose={(event) => {
                  event.preventDefault();
                  onRemove?.(permission);
                }}
              >
                {permission}
              </Tag>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PermissionAddSelect({
  excludedPermissions = [],
  placeholder = '+ 添加权限',
  selectedPermissions,
  onAdd
}: {
  excludedPermissions?: string[];
  placeholder?: string;
  selectedPermissions: string[];
  onAdd: (permission: string) => void;
}) {
  const selectedSet = new Set([...selectedPermissions, ...excludedPermissions]);
  const addPermissionOptions = permissionCatalog
    .filter((permission) => !selectedSet.has(permission.name))
    .map((permission) => ({
      label: permission.name,
      value: permission.name
    }));

  return (
    <div className="role-permission-control">
      <Select
        key={`add-permission-${selectedPermissions.join('-')}-${excludedPermissions.join('-')}`}
        className="role-permission-add-select"
        disabled={addPermissionOptions.length === 0}
        options={addPermissionOptions}
        placeholder={placeholder}
        showSearch
        value={undefined}
        onChange={onAdd}
      />
    </div>
  );
}
