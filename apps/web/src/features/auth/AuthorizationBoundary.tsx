import { LockOutlined } from '@ant-design/icons';
import { Result } from 'antd';
import type { ReactNode } from 'react';
import { useAuthorizationState } from './AuthorizationState';
import { canAccessRoute } from './routeAuthorization';

export function AuthorizationBoundary({ children, pathname }: { children: ReactNode; pathname: string }) {
  const { authorization } = useAuthorizationState();

  if (!canAccessRoute(authorization, pathname)) {
    return (
      <Result
        icon={<LockOutlined />}
        status="403"
        subTitle="当前账号没有访问此页面的权限"
        title="无访问权限"
      />
    );
  }

  return children;
}
