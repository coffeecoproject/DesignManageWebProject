import type { ReactNode } from 'react';
import { TagChip, type TagChipTone, type TagChipVariant } from './TagChip';

export type StatusTagTone = TagChipTone;

export type DetailInfoGridItem = {
  label: string;
  value?: ReactNode;
  wide?: boolean;
};

type DetailSectionProps = {
  children: ReactNode;
  extra?: ReactNode;
  icon: ReactNode;
  title: ReactNode;
};

type DetailInfoGridProps = {
  columns?: 1 | 2 | 3 | 4;
  emptyText?: ReactNode;
  items: DetailInfoGridItem[];
};

type StatusTagProps = {
  tone?: StatusTagTone;
  toneMap?: Partial<Record<string, StatusTagTone>>;
  value: ReactNode;
  variant?: TagChipVariant;
};

type DetailDrawerTitleProps = {
  eyebrow?: ReactNode;
  status?: ReactNode;
  statusTone?: StatusTagTone;
  statusToneMap?: Partial<Record<string, StatusTagTone>>;
  subtitle?: ReactNode;
  title: ReactNode;
};

type ReadOnlyFieldProps = {
  density?: 'default' | 'compact';
  emptyText?: ReactNode;
  label: ReactNode;
  testId?: string;
  value?: ReactNode;
  wide?: boolean;
};

function hasDisplayValue(value: ReactNode) {
  return value !== undefined && value !== null && value !== '';
}

function renderDetailValue(value: ReactNode, emptyText: ReactNode) {
  if (!hasDisplayValue(value)) {
    return emptyText;
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return value;
}

export function StatusTag({ tone, toneMap, value, variant }: StatusTagProps) {
  const resolvedTone = tone ?? (typeof value === 'string' ? toneMap?.[value] : undefined) ?? 'gray';

  return <TagChip label={value} tone={resolvedTone} variant={variant} />;
}

export function DetailDrawerTitle({
  eyebrow,
  status,
  statusTone,
  statusToneMap,
  subtitle,
  title
}: DetailDrawerTitleProps) {
  return (
    <div className="drawer-title">
      <div>
        <div className="drawer-title-main">{title}</div>
        {subtitle ?? eyebrow ? <div className="drawer-title-sub">{subtitle ?? eyebrow}</div> : null}
      </div>
      {hasDisplayValue(status) ? <StatusTag tone={statusTone} toneMap={statusToneMap} value={status} /> : null}
    </div>
  );
}

export function DetailSection({ children, extra, icon, title }: DetailSectionProps) {
  return (
    <section className="detail-section-card">
      <div className={extra ? 'drawer-section-title drawer-section-title-with-extra' : 'drawer-section-title'}>
        <span className="drawer-section-title-main">
          <span className="drawer-section-icon">{icon}</span>
          <span>{title}</span>
        </span>
        {extra ? <span className="drawer-section-extra">{extra}</span> : null}
      </div>
      {children}
    </section>
  );
}

export function DetailInfoGrid({ columns = 2, emptyText = '-', items }: DetailInfoGridProps) {
  return (
    <div className="detail-info-grid" data-columns={columns}>
      {items.map((item) => (
        <div className={['detail-info-item', item.wide ? 'detail-info-item-wide' : undefined].filter(Boolean).join(' ')} key={item.label}>
          <div className="detail-info-label">{item.label}</div>
          <div className="detail-info-value">{renderDetailValue(item.value, emptyText)}</div>
        </div>
      ))}
    </div>
  );
}

export function ReadOnlyField({ density = 'default', emptyText = '-', label, testId, value, wide }: ReadOnlyFieldProps) {
  return (
    <div className={['read-only-field', wide ? 'read-only-field-wide' : undefined].filter(Boolean).join(' ')} data-density={density} data-testid={testId}>
      <span className="read-only-field-label">{label}</span>
      <span className="read-only-field-value">{renderDetailValue(value, emptyText)}</span>
    </div>
  );
}
