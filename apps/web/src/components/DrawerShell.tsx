import { Button, Drawer } from 'antd';
import type { ButtonProps, DrawerProps } from 'antd';
import type { ReactNode } from 'react';

export type DrawerAction = {
  danger?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  label: ReactNode;
  onClick: () => void;
  testId?: string;
  type?: ButtonProps['type'];
};

export type DrawerFooterActionsProps = {
  cancelAction?: DrawerAction;
  closeAction?: DrawerAction;
  primaryAction?: DrawerAction;
  secondaryAction?: DrawerAction;
};

export type DrawerShellProps = DrawerFooterActionsProps & {
  bodyTestId?: string;
  children: ReactNode;
  className?: string;
  contentLayout?: 'detail' | 'plain';
  destroyOnHidden?: DrawerProps['destroyOnHidden'];
  open: boolean;
  title: DrawerProps['title'];
  width?: DrawerProps['width'];
  onClose: () => void;
};

export type DetailDrawerShellProps = Omit<DrawerShellProps, 'contentLayout' | 'destroyOnHidden'>;
export type ImportDrawerShellProps = DetailDrawerShellProps;

function renderFooterAction(action: DrawerAction | undefined, fallbackType?: ButtonProps['type']) {
  if (!action) {
    return null;
  }

  return (
    <Button
      danger={action.danger}
      data-testid={action.testId}
      disabled={action.disabled}
      icon={action.icon}
      type={action.type ?? fallbackType}
      onClick={action.onClick}
    >
      {action.label}
    </Button>
  );
}

function DrawerFooterActions({ cancelAction, closeAction, primaryAction, secondaryAction }: DrawerFooterActionsProps) {
  return (
    <div className="drawer-footer-actions">
      {renderFooterAction(closeAction)}
      {renderFooterAction(cancelAction)}
      {renderFooterAction(secondaryAction)}
      {renderFooterAction(primaryAction, 'primary')}
    </div>
  );
}

export function DrawerShell({
  bodyTestId,
  cancelAction,
  children,
  className,
  closeAction,
  contentLayout = 'plain',
  destroyOnHidden = true,
  open,
  primaryAction,
  secondaryAction,
  title,
  width,
  onClose
}: DrawerShellProps) {
  const drawerClassName = ['detail-drawer-shell', className].filter(Boolean).join(' ');
  const hasFooterActions = Boolean(closeAction || cancelAction || secondaryAction || primaryAction);
  const shouldRenderContent = open || destroyOnHidden === false;
  const content = contentLayout === 'detail'
    ? <div className="drawer-detail-layout" data-testid={bodyTestId}>{children}</div>
    : bodyTestId
      ? <div data-testid={bodyTestId}>{children}</div>
      : children;

  return (
    <Drawer
      className={drawerClassName}
      destroyOnHidden={destroyOnHidden}
      footer={
        hasFooterActions ? (
          <DrawerFooterActions
            cancelAction={cancelAction}
            closeAction={closeAction}
            primaryAction={primaryAction}
            secondaryAction={secondaryAction}
          />
        ) : null
      }
      open={open}
      title={title}
      width={width}
      onClose={onClose}
    >
      {shouldRenderContent ? content : null}
    </Drawer>
  );
}

export function DetailDrawerShell(props: DetailDrawerShellProps) {
  return <DrawerShell {...props} contentLayout="detail" />;
}

export function ImportDrawerShell(props: ImportDrawerShellProps) {
  return <DrawerShell {...props} contentLayout="detail" />;
}
