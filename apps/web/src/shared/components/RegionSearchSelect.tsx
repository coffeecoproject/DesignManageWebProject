import { CheckOutlined, DownOutlined, SearchOutlined } from '@ant-design/icons';
import { Empty, Input, Popover } from 'antd';
import { useId, useMemo, useState } from 'react';

export type RegionPath = string[];

export type RegionCityOption = {
  label: string;
  value: string;
};

export type RegionProvinceOption = {
  cities: RegionCityOption[];
  label: string;
  value: string;
};

export const regionSearchOptions: RegionProvinceOption[] = [
  {
    label: '湖北省',
    value: '湖北省',
    cities: [
      { label: '武汉市', value: '武汉' },
      { label: '宜昌市', value: '宜昌' },
      { label: '襄阳市', value: '襄阳' }
    ]
  },
  {
    label: '湖南省',
    value: '湖南省',
    cities: [
      { label: '长沙市', value: '长沙' },
      { label: '株洲市', value: '株洲' },
      { label: '岳阳市', value: '岳阳' }
    ]
  }
];

export const defaultRegionPath: RegionPath = ['湖北省', '武汉'];

export function normalizeRegionPath(value: Array<string | number | null | undefined>): RegionPath {
  return value.filter((item): item is string | number => item !== null && item !== undefined).map(String);
}

export function getRegionProvince(path: RegionPath) {
  return path[0] ?? '';
}

export function getRegionCity(path: RegionPath) {
  return path[path.length - 1] ?? '';
}

function isSameCity(option: RegionCityOption, city: string) {
  return option.value === city || option.label === city;
}

function normalizeSearchKeyword(keyword: string) {
  return keyword.trim().toLowerCase();
}

function matchesRegionText(keyword: string, values: string[]) {
  const normalizedKeyword = normalizeSearchKeyword(keyword);

  if (!normalizedKeyword) {
    return true;
  }

  return values.some((value) => value.toLowerCase().includes(normalizedKeyword));
}

export function getRegionCityLabel(path: RegionPath) {
  const [province, city] = path;
  const provinceOption = regionSearchOptions.find((option) => option.value === province);
  const cityOption = provinceOption?.cities.find((option) => isSameCity(option, city));

  return cityOption?.label ?? city ?? '';
}

export function getRegionDisplayLabel(path: RegionPath) {
  const province = getRegionProvince(path);
  const city = getRegionCityLabel(path);

  return province && city ? `${province} / ${city}` : '';
}

export function getRegionPathByCity(city: string, fallback: RegionPath = []): RegionPath {
  if (!city) {
    return fallback;
  }

  for (const province of regionSearchOptions) {
    const cityOption = province.cities.find((option) => isSameCity(option, city));

    if (cityOption) {
      return [province.value, cityOption.value];
    }
  }

  return fallback;
}

export function getRegionPath(province: string, city: string, fallback: RegionPath = []): RegionPath {
  if (!province && !city) {
    return fallback;
  }

  const provinceOption = regionSearchOptions.find((option) => option.value === province);
  const cityOption = provinceOption?.cities.find((option) => isSameCity(option, city));

  if (provinceOption && cityOption) {
    return [provinceOption.value, cityOption.value];
  }

  return getRegionPathByCity(city, fallback);
}

export function getRegionOptionsFromPaths(paths: RegionPath[], options: RegionProvinceOption[] = regionSearchOptions) {
  const cityValuesByProvince = new Map<string, Set<string>>();

  for (const path of paths) {
    const province = getRegionProvince(path);
    const city = getRegionCity(path);

    if (!province || !city) {
      continue;
    }

    const cityValues = cityValuesByProvince.get(province) ?? new Set<string>();
    cityValues.add(city);
    cityValuesByProvince.set(province, cityValues);
  }

  return options.flatMap((province) => {
    const cityValues = cityValuesByProvince.get(province.value);

    if (!cityValues) {
      return [];
    }

    const cities = province.cities.filter((city) => cityValues.has(city.value));
    return cities.length > 0 ? [{ ...province, cities }] : [];
  });
}

export function getFilteredRegionOptions(keyword: string, options: RegionProvinceOption[] = regionSearchOptions) {
  const normalizedKeyword = normalizeSearchKeyword(keyword);

  if (!normalizedKeyword) {
    return options;
  }

  return options.flatMap((province) => {
    const provinceMatched = matchesRegionText(normalizedKeyword, [province.label, province.value]);
    const cities = provinceMatched
      ? province.cities
      : province.cities.filter((city) => matchesRegionText(normalizedKeyword, [city.label, city.value, `${province.label}${city.label}`]));

    return cities.length > 0 ? [{ ...province, cities }] : [];
  });
}

type RegionSearchSelectProps = {
  allLabel?: string;
  allowAll?: boolean;
  disabled?: boolean;
  options?: RegionProvinceOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  value: RegionPath;
  onChange: (value: RegionPath) => void;
};

export function RegionSearchSelect({
  allLabel = '全部',
  allowAll = false,
  disabled,
  options = regionSearchOptions,
  placeholder = '选择地区',
  searchPlaceholder = '搜索省份或城市',
  value,
  onChange
}: RegionSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const inputId = useId();
  const selectedAll = allowAll && value.length === 0;
  const displayLabel = selectedAll ? allLabel : getRegionDisplayLabel(value);
  const selectedProvince = getRegionProvince(value);
  const selectedCity = getRegionCity(value);
  const filteredOptions = useMemo(() => getFilteredRegionOptions(keyword, options), [keyword, options]);

  function handleOpenChange(nextOpen: boolean) {
    if (disabled) {
      return;
    }

    setOpen(nextOpen);

    if (!nextOpen) {
      setKeyword('');
    }
  }

  function handleSelect(province: RegionProvinceOption, city: RegionCityOption) {
    onChange([province.value, city.value]);
    setOpen(false);
    setKeyword('');
  }

  function handleSelectAll() {
    onChange([]);
    setOpen(false);
    setKeyword('');
  }

  const searchPanel = (
    <div className="region-search-panel">
      <Input
        aria-label="地区搜索"
        autoComplete="new-password"
        className="region-search-input"
        data-1p-ignore="true"
        data-lpignore="true"
        id={`${inputId}-region-search`}
        name={`${inputId}-region-search`}
        placeholder={searchPlaceholder}
        prefix={<SearchOutlined />}
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
      />

      <div className="region-search-list">
        {allowAll ? (
          <button
            aria-pressed={selectedAll}
            className={selectedAll ? 'region-search-city region-search-city-selected region-search-all' : 'region-search-city region-search-all'}
            type="button"
            onClick={handleSelectAll}
          >
            <span>{allLabel}</span>
            {selectedAll ? <CheckOutlined /> : null}
          </button>
        ) : null}
        {filteredOptions.length > 0 ? (
          filteredOptions.map((province) => (
            <section className="region-search-group" key={province.value}>
              <div className="region-search-province">{province.label}</div>
              <div className="region-search-cities">
                {province.cities.map((city) => {
                  const selected = selectedProvince === province.value && selectedCity === city.value;

                  return (
                    <button
                      aria-pressed={selected}
                      className={selected ? 'region-search-city region-search-city-selected' : 'region-search-city'}
                      key={city.value}
                      type="button"
                      onClick={() => handleSelect(province, city)}
                    >
                      <span>{city.label}</span>
                      {selected ? <CheckOutlined /> : null}
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        ) : (
          <Empty className="region-search-empty" description="暂无匹配地区" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </div>
    </div>
  );

  return (
    <Popover
      arrow={false}
      content={searchPanel}
      open={open}
      overlayClassName="region-search-popover"
      placement="bottomLeft"
      trigger="click"
      onOpenChange={handleOpenChange}
    >
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className={disabled ? 'region-search-select region-search-select-disabled' : 'region-search-select'}
        disabled={disabled}
        type="button"
      >
        <span className={displayLabel ? 'region-search-select-value' : 'region-search-select-value region-search-select-placeholder'}>
          {displayLabel || placeholder}
        </span>
        <DownOutlined className="region-search-select-icon" />
      </button>
    </Popover>
  );
}
