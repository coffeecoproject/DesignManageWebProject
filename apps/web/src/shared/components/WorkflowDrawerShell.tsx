import { Button, Drawer } from 'antd';
import type { ButtonProps, DrawerProps } from 'antd';
import type { ReactNode } from 'react';

export type WorkflowDrawerAction = {
  danger?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  label: ReactNode;
  onClick: () => void;
  testId?: string;
  type?: ButtonProps['type'];
};

export type WorkflowDrawerShellProps = {
  bodyTestId?: string;
  children: ReactNode;
  className?: string;
  closeAction?: WorkflowDrawerAction;
  dangerAction?: WorkflowDrawerAction;
  destroyOnHidden?: DrawerProps['destroyOnHidden'];
  open: boolean;
  primaryAction?: WorkflowDrawerAction;
  secondaryAction?: WorkflowDrawerAction;
  title: DrawerProps['title'];
  width?: DrawerProps['width'];
  onClose: () => void;
};

function renderWorkflowAction(action: WorkflowDrawerAction | undefined, fallbackType?: ButtonProps['type'], fallbackDanger = false) {
  if (!action) {
    return null;
  }

  return (
    <Button
      danger={action.danger ?? fallbackDanger}
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

export function WorkflowDrawerShell({
  bodyTestId,
  children,
  className,
  closeAction,
  dangerAction,
  destroyOnHidden = true,
  open,
  primaryAction,
  secondaryAction,
  title,
  width,
  onClose
}: WorkflowDrawerShellProps) {
  const drawerClassName = ['detail-drawer-shell', className].filter(Boolean).join(' ');
  const hasFooterActions = Boolean(closeAction || secondaryAction || dangerAction || primaryAction);
  const shouldRenderContent = open || destroyOnHidden === false;

  return (
    <Drawer
      className={drawerClassName}
      destroyOnHidden={destroyOnHidden}
      footer={
        hasFooterActions ? (
          <div className="drawer-footer-actions">
            {renderWorkflowAction(closeAction)}
            {renderWorkflowAction(secondaryAction)}
            {renderWorkflowAction(dangerAction, undefined, true)}
            {renderWorkflowAction(primaryAction, 'primary')}
          </div>
        ) : null
      }
      open={open}
      title={title}
      width={width}
      onClose={onClose}
    >
      {shouldRenderContent ? (
        <div className="drawer-detail-layout" data-testid={bodyTestId}>
          {children}
        </div>
      ) : null}
    </Drawer>
  );
}
