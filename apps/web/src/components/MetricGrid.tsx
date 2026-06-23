import { Children, Fragment, isValidElement, type CSSProperties, type ReactNode } from 'react';

export type MetricGridColumns = 2 | 3 | 4 | 5 | 6 | 24;
export type MetricGridDensity = 'default' | 'compact';

export type MetricGridProps = {
  children: ReactNode;
  columns?: MetricGridColumns;
  density?: MetricGridDensity;
  spans?: readonly number[];
};

type MetricGridStyle = CSSProperties & {
  '--metric-grid-columns'?: number;
  '--metric-grid-item-span'?: number;
};

type FragmentProps = {
  children?: ReactNode;
};

function getMetricGridColumns(itemCount: number, columns: MetricGridColumns | undefined, spans: readonly number[] | undefined) {
  if (spans) {
    return 24;
  }

  if (columns) {
    return columns;
  }

  return Math.min(Math.max(itemCount, 2), 6);
}

export function MetricGrid({ children, columns, density = 'default', spans }: MetricGridProps) {
  const items = flattenMetricGridChildren(children);
  const resolvedColumns = getMetricGridColumns(items.length, columns, spans);

  return (
    <div
      className="metric-grid"
      data-density={density}
      data-layout={spans ? 'weighted' : 'equal'}
      style={{ '--metric-grid-columns': resolvedColumns } as MetricGridStyle}
    >
      {items.map((child, index) => {
        const span = spans?.[index];
        const itemStyle = span ? ({ '--metric-grid-item-span': span } as MetricGridStyle) : undefined;

        return (
          <div className="metric-grid-item" key={index} style={itemStyle}>
            {child}
          </div>
        );
      })}
    </div>
  );
}

function flattenMetricGridChildren(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap((child) => {
    if (isValidElement(child) && child.type === Fragment) {
      return flattenMetricGridChildren((child.props as FragmentProps).children);
    }

    return child;
  });
}
