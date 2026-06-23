import { Button } from 'antd';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';

export type InlineRowActionTone = 'default' | 'danger';

export type InlineRowAction = {
  disabled?: boolean;
  icon?: ReactNode;
  key: string;
  label: ReactNode;
  tone?: InlineRowActionTone;
  onClick: () => void;
};

type InlineRowActionsProps = {
  actions: InlineRowAction[];
  emptyText?: ReactNode;
};

function InlineRowActionButton({ action }: { action: InlineRowAction }) {
  const handleClick = (event: ReactMouseEvent<HTMLElement>) => {
    event.stopPropagation();
    action.onClick();
  };

  const className = action.tone === 'danger' ? 'inline-row-action inline-row-action-danger' : 'inline-row-action';

  return (
    <Button
      className={className}
      disabled={action.disabled}
      icon={action.icon}
      size="small"
      type="text"
      onClick={handleClick}
    >
      {action.label}
    </Button>
  );
}

export function InlineRowActions({ actions, emptyText = '-' }: InlineRowActionsProps) {
  if (actions.length === 0) {
    return <span className="inline-row-actions-empty">{emptyText}</span>;
  }

  return (
    <div className="inline-row-actions">
      {actions.map((action) => (
        <InlineRowActionButton action={action} key={action.key} />
      ))}
    </div>
  );
}
