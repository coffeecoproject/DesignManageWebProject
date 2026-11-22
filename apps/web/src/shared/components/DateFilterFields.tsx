import { DatePicker, Segmented } from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { FilterField } from './FilterControls';

export type DateRangeFilterValue = {
  endDate: string;
  startDate: string;
};

export type DatePeriodMode = 'month' | 'quarter' | 'year' | 'custom';
export type DateScopeFilterMode =
  | 'all'
  | 'currentMonth'
  | 'month'
  | 'currentQuarter'
  | 'quarter'
  | 'currentYear'
  | 'year'
  | 'range';
export type DateScopeFilterValue =
  | { mode: 'all' }
  | { mode: 'currentMonth' }
  | { mode: 'month'; month: string }
  | { mode: 'currentQuarter' }
  | { mode: 'quarter'; quarter: string }
  | { mode: 'currentYear' }
  | { mode: 'year'; year: string }
  | { mode: 'range'; range: DateRangeFilterValue };

export const defaultDatePeriodModeOptions: Array<{ label: string; value: DatePeriodMode }> = [
  { label: '月度', value: 'month' },
  { label: '季度', value: 'quarter' },
  { label: '全年', value: 'year' },
  { label: '自定义', value: 'custom' }
];

export const defaultDateScopeModeOptions: Array<{ label: string; value: DateScopeFilterMode }> = [
  { label: '全部', value: 'all' },
  { label: '当月', value: 'currentMonth' },
  { label: '按月份', value: 'month' },
  { label: '按时间段', value: 'range' }
];

function normalizePickerValue(dateString: string | string[]) {
  return Array.isArray(dateString) ? dateString[0] ?? '' : dateString;
}

function getDefaultMonth(defaultMonth?: string) {
  return defaultMonth ?? dayjs().format('YYYY-MM');
}

function getQuarterFromMonth(month: string) {
  const [year, monthText] = month.split('-');
  const quarter = Math.ceil(Number(monthText) / 3);

  return `${year}-Q${quarter}`;
}

function getDefaultQuarter(defaultMonth?: string) {
  return getQuarterFromMonth(getDefaultMonth(defaultMonth));
}

function getDefaultYear(defaultMonth?: string) {
  return getDefaultMonth(defaultMonth).slice(0, 4);
}

function getDefaultRange(defaultRange?: DateRangeFilterValue) {
  return (
    defaultRange ?? {
      endDate: dayjs().endOf('month').format('YYYY-MM-DD'),
      startDate: dayjs().startOf('month').format('YYYY-MM-DD')
    }
  );
}

export function getDateScopeMonthRange(month: string): DateRangeFilterValue {
  return {
    endDate: dayjs(`${month}-01`).endOf('month').format('YYYY-MM-DD'),
    startDate: `${month}-01`
  };
}

export function getDateScopeQuarterRange(quarter: string): DateRangeFilterValue {
  const match = quarter.match(/^(\d{4})-Q([1-4])$/);

  if (!match) {
    return getDateScopeMonthRange(getDefaultMonth());
  }

  const [, year, quarterText] = match;
  const quarterNumber = Number(quarterText);
  const startMonth = String((quarterNumber - 1) * 3 + 1).padStart(2, '0');
  const endMonth = String(quarterNumber * 3).padStart(2, '0');

  return {
    endDate: dayjs(`${year}-${endMonth}-01`).endOf('month').format('YYYY-MM-DD'),
    startDate: `${year}-${startMonth}-01`
  };
}

export function getDateScopeYearRange(year: string): DateRangeFilterValue {
  return {
    endDate: `${year}-12-31`,
    startDate: `${year}-01-01`
  };
}

export function getDateScopeRange(value: DateScopeFilterValue, defaultMonth?: string) {
  if (value.mode === 'all') {
    return undefined;
  }

  if (value.mode === 'currentMonth') {
    return getDateScopeMonthRange(getDefaultMonth(defaultMonth));
  }

  if (value.mode === 'month') {
    return getDateScopeMonthRange(value.month);
  }

  if (value.mode === 'currentQuarter') {
    return getDateScopeQuarterRange(getDefaultQuarter(defaultMonth));
  }

  if (value.mode === 'quarter') {
    return getDateScopeQuarterRange(value.quarter);
  }

  if (value.mode === 'currentYear') {
    return getDateScopeYearRange(getDefaultYear(defaultMonth));
  }

  if (value.mode === 'year') {
    return getDateScopeYearRange(value.year);
  }

  return value.range;
}

export function MonthFilterField({
  allowClear = true,
  label,
  placeholder = '全部月份',
  testId,
  value,
  width = 118,
  onChange
}: {
  allowClear?: boolean;
  label: string;
  placeholder?: string;
  testId?: string;
  value?: string;
  width?: number;
  onChange: (month: string) => void;
}) {
  return (
    <FilterField label={label}>
      <MonthPickerControl
        allowClear={allowClear}
        placeholder={placeholder}
        testId={testId}
        value={value ? dayjs(value) : undefined}
        width={width}
        onChange={onChange}
      />
    </FilterField>
  );
}

export function MonthPickerControl({
  allowClear = true,
  placeholder = '选择月份',
  testId,
  value,
  width = 118,
  onChange
}: {
  allowClear?: boolean;
  placeholder?: string;
  testId?: string;
  value?: Dayjs;
  width?: number;
  onChange: (month: string) => void;
}) {
  return (
    <DatePicker
      allowClear={allowClear}
      data-testid={testId}
      inputReadOnly
      picker="month"
      placeholder={placeholder}
      style={{ width }}
      value={value}
      onChange={(_, dateString) => onChange(normalizePickerValue(dateString))}
    />
  );
}

function getQuarterPickerValue(quarter: string) {
  const match = quarter.match(/^(\d{4})-Q([1-4])$/);

  if (!match) {
    return undefined;
  }

  const [, year, quarterText] = match;
  const startMonth = (Number(quarterText) - 1) * 3 + 1;

  return dayjs(`${year}-${String(startMonth).padStart(2, '0')}-01`);
}

function formatQuarterPickerValue(value: Dayjs) {
  const quarter = Math.floor(value.month() / 3) + 1;

  return `${value.year()}-Q${quarter}`;
}

export function QuarterPickerControl({
  allowClear = true,
  placeholder = '选择季度',
  testId,
  value,
  width = 118,
  onChange
}: {
  allowClear?: boolean;
  placeholder?: string;
  testId?: string;
  value?: string;
  width?: number;
  onChange: (quarter: string) => void;
}) {
  return (
    <DatePicker
      allowClear={allowClear}
      data-testid={testId}
      format="YYYY-[Q]Q"
      inputReadOnly
      picker="quarter"
      placeholder={placeholder}
      style={{ width }}
      value={value ? getQuarterPickerValue(value) : undefined}
      onChange={(date) => onChange(date ? formatQuarterPickerValue(date) : '')}
    />
  );
}

export function YearPickerControl({
  allowClear = true,
  placeholder = '选择年份',
  testId,
  value,
  width = 118,
  onChange
}: {
  allowClear?: boolean;
  placeholder?: string;
  testId?: string;
  value?: string;
  width?: number;
  onChange: (year: string) => void;
}) {
  return (
    <DatePicker
      allowClear={allowClear}
      data-testid={testId}
      inputReadOnly
      picker="year"
      placeholder={placeholder}
      style={{ width }}
      value={value ? dayjs(value) : undefined}
      onChange={(date) => onChange(date ? date.format('YYYY') : '')}
    />
  );
}

export function DateRangeFilterField({
  allowClear = true,
  label = '日期范围',
  testId,
  value,
  width = 240,
  onChange
}: {
  allowClear?: boolean;
  label?: string;
  testId?: string;
  value?: DateRangeFilterValue;
  width?: number;
  onChange: (range: DateRangeFilterValue | undefined) => void;
}) {
  return (
    <FilterField controlWidth="wide-select" label={label}>
      <DatePicker.RangePicker
        allowClear={allowClear}
        data-testid={testId}
        inputReadOnly
        style={{ width }}
        value={value ? [dayjs(value.startDate), dayjs(value.endDate)] : undefined}
        onChange={(_, dateStrings) => {
          const [startDate, endDate] = dateStrings;

          onChange(startDate && endDate ? { endDate, startDate } : undefined);
        }}
      />
    </FilterField>
  );
}

export function DateScopeFilter({
  defaultMonth,
  defaultRange,
  label = '生效时间',
  modeOptions = defaultDateScopeModeOptions,
  monthLabel = '月份',
  quarterLabel = '季度',
  rangeLabel = '时间段',
  rangeWidth = 240,
  testIdPrefix,
  value,
  yearLabel = '年份',
  onChange
}: {
  defaultMonth?: string;
  defaultRange?: DateRangeFilterValue;
  label?: string;
  modeOptions?: Array<{ label: string; value: DateScopeFilterMode }>;
  monthLabel?: string;
  quarterLabel?: string;
  rangeLabel?: string;
  rangeWidth?: number;
  testIdPrefix?: string;
  value: DateScopeFilterValue;
  yearLabel?: string;
  onChange: (value: DateScopeFilterValue) => void;
}) {
  function handleModeChange(mode: DateScopeFilterMode) {
    if (mode === 'all') {
      onChange({ mode: 'all' });
      return;
    }

    if (mode === 'currentMonth') {
      onChange({ mode: 'currentMonth' });
      return;
    }

    if (mode === 'month') {
      onChange({
        mode: 'month',
        month: value.mode === 'month' ? value.month : getDefaultMonth(defaultMonth)
      });
      return;
    }

    if (mode === 'currentQuarter') {
      onChange({ mode: 'currentQuarter' });
      return;
    }

    if (mode === 'quarter') {
      onChange({
        mode: 'quarter',
        quarter: value.mode === 'quarter' ? value.quarter : getDefaultQuarter(defaultMonth)
      });
      return;
    }

    if (mode === 'currentYear') {
      onChange({ mode: 'currentYear' });
      return;
    }

    if (mode === 'year') {
      onChange({
        mode: 'year',
        year: value.mode === 'year' ? value.year : getDefaultYear(defaultMonth)
      });
      return;
    }

    onChange({
      mode: 'range',
      range: value.mode === 'range' ? value.range : getDefaultRange(defaultRange)
    });
  }

  return (
    <>
      <FilterField as="div" controlWidth="wide-select" label={label}>
        <Segmented<DateScopeFilterMode>
          data-testid={testIdPrefix ? `${testIdPrefix}-mode` : undefined}
          options={modeOptions}
          value={value.mode}
          onChange={handleModeChange}
        />
      </FilterField>
      {value.mode === 'month' ? (
        <MonthFilterField
          allowClear={false}
          label={monthLabel}
          placeholder="选择月份"
          testId={testIdPrefix ? `${testIdPrefix}-month` : undefined}
          value={value.month}
          onChange={(month) => {
            if (month) {
              onChange({ mode: 'month', month });
            }
          }}
        />
      ) : null}
      {value.mode === 'quarter' ? (
        <FilterField label={quarterLabel}>
          <QuarterPickerControl
            allowClear={false}
            testId={testIdPrefix ? `${testIdPrefix}-quarter` : undefined}
            value={value.quarter}
            onChange={(quarter) => {
              if (quarter) {
                onChange({ mode: 'quarter', quarter });
              }
            }}
          />
        </FilterField>
      ) : null}
      {value.mode === 'year' ? (
        <FilterField label={yearLabel}>
          <YearPickerControl
            allowClear={false}
            testId={testIdPrefix ? `${testIdPrefix}-year` : undefined}
            value={value.year}
            onChange={(year) => {
              if (year) {
                onChange({ mode: 'year', year });
              }
            }}
          />
        </FilterField>
      ) : null}
      {value.mode === 'range' ? (
        <DateRangeFilterField
          allowClear={false}
          label={rangeLabel}
          testId={testIdPrefix ? `${testIdPrefix}-range` : undefined}
          value={value.range}
          width={rangeWidth}
          onChange={(range) => {
            if (range) {
              onChange({ mode: 'range', range });
            }
          }}
        />
      ) : null}
    </>
  );
}

export function DatePeriodRangeFilter({
  customRange,
  mode,
  modeOptions = defaultDatePeriodModeOptions,
  periodLabel = '统计周期',
  rangeLabel = '日期范围',
  rangeWidth = 240,
  onCustomRangeChange,
  onModeChange
}: {
  customRange: DateRangeFilterValue;
  mode: DatePeriodMode;
  modeOptions?: Array<{ label: string; value: DatePeriodMode }>;
  periodLabel?: string;
  rangeLabel?: string;
  rangeWidth?: number;
  onCustomRangeChange: (range: DateRangeFilterValue) => void;
  onModeChange: (mode: DatePeriodMode) => void;
}) {
  return (
    <>
      <FilterField as="div" controlWidth="wide-select" label={periodLabel}>
        <Segmented<DatePeriodMode> options={modeOptions} value={mode} onChange={onModeChange} />
      </FilterField>
      {mode === 'custom' ? (
        <DateRangeFilterField
          allowClear={false}
          label={rangeLabel}
          value={customRange}
          width={rangeWidth}
          onChange={(range) => {
            if (range) {
              onCustomRangeChange(range);
            }
          }}
        />
      ) : null}
    </>
  );
}
