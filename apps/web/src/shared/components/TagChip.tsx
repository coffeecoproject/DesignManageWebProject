import { Space, Tag, Tooltip } from 'antd';
import { forwardRef, type Key, type ReactNode } from 'react';
import { CellText } from './TableCell';

export type TagChipTone = 'amber' | 'blue' | 'gray' | 'green' | 'purple' | 'red';
export type TagChipVariant = 'default' | 'compact' | 'compact-overflow' | 'finance-direction';

type TagChipProps = {
  label: ReactNode;
  tone?: TagChipTone;
  variant?: TagChipVariant;
};

type TagChipListProps<T extends ReactNode = ReactNode> = {
  emptyText?: ReactNode;
  getKey?: (item: T, index: number) => Key;
  getLabel?: (item: T, index: number) => ReactNode;
  getTooltipLabel?: (item: T, index: number) => string;
  items: T[];
  maxVisible?: number;
  overflowTone?: TagChipTone;
  overflowVariant?: TagChipVariant;
  tone?: TagChipTone | ((item: T, index: number) => TagChipTone);
  tooltipSeparator?: string;
  variant?: TagChipVariant;
  wrap?: boolean;
};

const tagChipClassName: Record<TagChipTone, string> = {
  amber: 'tag-chip tag-chip-amber',
  blue: 'tag-chip tag-chip-blue',
  gray: 'tag-chip tag-chip-gray',
  green: 'tag-chip tag-chip-green',
  purple: 'tag-chip tag-chip-purple',
  red: 'tag-chip tag-chip-red'
};

const tagChipVariantClassName: Record<TagChipVariant, string> = {
  default: '',
  compact: 'tag-chip-compact',
  'compact-overflow': 'tag-chip-compact-overflow',
  'finance-direction': 'finance-direction-pill'
};

function getTagChipClassName(tone: TagChipTone, variant: TagChipVariant) {
  return [tagChipClassName[tone], tagChipVariantClassName[variant]].filter(Boolean).join(' ');
}

function getItemKey<T extends ReactNode>(item: T, index: number, getKey?: (item: T, index: number) => Key) {
  return getKey?.(item, index) ?? (typeof item === 'string' || typeof item === 'number' ? item : index);
}

function getItemTone<T extends ReactNode>(tone: TagChipListProps<T>['tone'], item: T, index: number) {
  return typeof tone === 'function' ? tone(item, index) : tone ?? 'blue';
}

export const TagChip = forwardRef<HTMLSpanElement, TagChipProps>(function TagChip(
  { label, tone = 'blue', variant = 'default' },
  ref
) {
  return (
    <Tag ref={ref} className={getTagChipClassName(tone, variant)}>
      {label}
    </Tag>
  );
});

export function TagChipList<T extends ReactNode = ReactNode>({
  emptyText = '未配置',
  getKey,
  getLabel,
  getTooltipLabel,
  items,
  maxVisible = items.length,
  overflowTone = 'gray',
  overflowVariant = 'default',
  tone = 'blue',
  tooltipSeparator = ' / ',
  variant = 'default',
  wrap = false
}: TagChipListProps<T>) {
  if (items.length === 0) {
    return <CellText tone="subtle">{emptyText}</CellText>;
  }

  const visibleItems = items.slice(0, maxVisible);
  const hiddenItems = items.slice(maxVisible);
  const hiddenTitle = hiddenItems
    .map((item, index) => getTooltipLabel?.(item, maxVisible + index) ?? String(getLabel?.(item, maxVisible + index) ?? item))
    .join(tooltipSeparator);
  const compact = variant === 'compact' || overflowVariant === 'compact-overflow';
  const listClassName = [
    'tag-chip-list',
    wrap ? 'tag-chip-list-wrap' : 'tag-chip-list-nowrap',
    compact ? 'tag-chip-list-compact' : undefined
  ].filter(Boolean).join(' ');

  return (
    <Space className={listClassName} size={compact ? 8 : 6} wrap={wrap}>
      {visibleItems.map((item, index) => (
        <TagChip
          key={getItemKey(item, index, getKey)}
          label={getLabel?.(item, index) ?? item}
          tone={getItemTone(tone, item, index)}
          variant={variant}
        />
      ))}
      {hiddenItems.length > 0 ? (
        <Tooltip title={hiddenTitle}>
          <TagChip label={`+${hiddenItems.length}`} tone={overflowTone} variant={overflowVariant} />
        </Tooltip>
      ) : null}
    </Space>
  );
}
