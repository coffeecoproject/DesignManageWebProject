import { Input } from 'antd';
import type { InputProps } from 'antd';
import type { ReactNode } from 'react';

type FilterContainerProps = {
  children: ReactNode;
};

type FilterFieldElement = 'div' | 'label';

type FilterFieldVariant = 'default' | 'keyword' | 'status' | 'type';

export type FilterFieldProps = {
  as?: FilterFieldElement;
  children: ReactNode;
  controlWidth?: 'default' | 'select' | 'status-select' | 'wide-select';
  label: ReactNode;
  variant?: FilterFieldVariant;
};

export type KeywordFilterProps = Omit<InputProps, 'className' | 'onChange' | 'value'> & {
  as?: FilterFieldElement;
  label?: ReactNode;
  onChange: (keyword: string) => void;
  value: string;
  width?: 'default' | 'wide';
};

function joinClassNames(classNames: Array<string | false | undefined>) {
  return classNames.filter(Boolean).join(' ');
}

export function FilterPanel({ children }: FilterContainerProps) {
  return <section className="filter-panel">{children}</section>;
}

export function FilterBar({ children }: FilterContainerProps) {
  return <div className="filter-bar">{children}</div>;
}

export function FilterField({
  as: Component = 'label',
  children,
  controlWidth = 'select',
  label,
  variant = 'default'
}: FilterFieldProps) {
  return (
    <Component
      className={joinClassNames(['filter-field', variant !== 'default' && `filter-field-${variant}`])}
      data-control-width={controlWidth}
    >
      <span className="field-label">{label}</span>
      {children}
    </Component>
  );
}

export function KeywordFilter({
  as = 'label',
  label = '关键词',
  onChange,
  value,
  width = 'default',
  ...inputProps
}: KeywordFilterProps) {
  return (
    <FilterField as={as} controlWidth="default" label={label} variant="keyword">
      <Input
        {...inputProps}
        className={joinClassNames(['field-control', 'field-control-keyword', width === 'wide' && 'field-control-keyword-wide'])}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </FilterField>
  );
}
