import { Space } from 'antd';
import { Children, type ReactNode } from 'react';

export type DrawerProfileCardProps = {
  avatar: ReactNode;
  subtitle?: ReactNode;
  tags?: ReactNode;
  title: ReactNode;
};

function hasProfileText(value: ReactNode) {
  return value !== undefined && value !== null && value !== '';
}

export function DrawerProfileCard({ avatar, subtitle, tags, title }: DrawerProfileCardProps) {
  const tagItems = Children.toArray(tags).filter((tag) => tag !== null && tag !== undefined && typeof tag !== 'boolean');

  return (
    <section className="drawer-profile-card">
      <div className="drawer-profile-main">
        <span className="drawer-profile-avatar">{avatar}</span>
        <div>
          <div className="drawer-profile-name">{title}</div>
          {hasProfileText(subtitle) ? <div className="drawer-profile-sub">{subtitle}</div> : null}
        </div>
      </div>
      {tagItems.length > 0 ? (
        <Space className="drawer-profile-tags" size={6} wrap>
          {tagItems}
        </Space>
      ) : null}
    </section>
  );
}
