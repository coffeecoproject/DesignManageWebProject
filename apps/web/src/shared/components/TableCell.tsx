import type { ReactNode } from 'react';

export type CellTextTone = 'default' | 'strong' | 'subtle' | 'risk' | 'income' | 'expense' | 'transfer' | 'muted';

type CellTextProps = {
  children?: ReactNode;
  emptyText?: ReactNode;
  tone?: CellTextTone;
};

type CompactCellProps = {
  align?: 'left' | 'center';
  emptyText?: ReactNode;
  primary?: ReactNode;
  primarySlot?: ReactNode;
  primaryTone?: CellTextTone;
  secondary?: ReactNode;
  secondarySlot?: ReactNode;
  secondaryTone?: CellTextTone;
};

const cellTextToneClassName: Record<CellTextTone, string> = {
  default: '',
  strong: 'cell-strong',
  subtle: 'cell-subtle',
  risk: 'cell-risk',
  income: 'finance-amount-income',
  expense: 'finance-amount-expense',
  transfer: 'finance-amount-transfer',
  muted: 'finance-amount-muted'
};

function hasDisplayValue(value: ReactNode) {
  return value !== undefined && value !== null && value !== '';
}

function renderCellValue(value: ReactNode, emptyText: ReactNode) {
  if (!hasDisplayValue(value)) {
    return emptyText;
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return value;
}

export function CellText({ children, emptyText = '-', tone = 'strong' }: CellTextProps) {
  const className = cellTextToneClassName[tone] || undefined;

  return <span className={className}>{renderCellValue(children, emptyText)}</span>;
}

function CellSlot({ children, tone }: { children: ReactNode; tone: CellTextTone }) {
  const className = cellTextToneClassName[tone] || undefined;

  return <div className={className}>{children}</div>;
}

export function CompactCell({
  align = 'left',
  emptyText = '-',
  primary,
  primarySlot,
  primaryTone = 'strong',
  secondary,
  secondarySlot,
  secondaryTone = 'subtle'
}: CompactCellProps) {
  return (
    <div className={align === 'center' ? 'compact-cell compact-cell-center' : 'compact-cell'}>
      {hasDisplayValue(primarySlot) ? (
        <CellSlot tone={primaryTone}>{primarySlot}</CellSlot>
      ) : (
        <CellText emptyText={emptyText} tone={primaryTone}>
          {primary}
        </CellText>
      )}
      {hasDisplayValue(secondarySlot) ? (
        <CellSlot tone={secondaryTone}>{secondarySlot}</CellSlot>
      ) : hasDisplayValue(secondary) ? (
        <CellText tone={secondaryTone}>
          {secondary}
        </CellText>
      ) : null}
    </div>
  );
}
