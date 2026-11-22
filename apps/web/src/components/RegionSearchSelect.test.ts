import {
  defaultRegionPath,
  getFilteredRegionOptions,
  getRegionCity,
  getRegionCityLabel,
  getRegionDisplayLabel,
  getRegionOptionsFromPaths,
  getRegionPath,
  getRegionPathByCity,
  getRegionProvince,
  normalizeRegionPath
} from './RegionSearchSelect';
import { it } from 'vitest';
import { assertDeepEqual, assertEqual } from '../__tests__/assertions';

it('normalizes region path into string values', () => {
  assertDeepEqual(normalizeRegionPath(['湖北省', '武汉', null, undefined]), ['湖北省', '武汉'], 'region path should remove empty values');
  assertDeepEqual(normalizeRegionPath(['湖北省', 420100]), ['湖北省', '420100'], 'region path should stringify numeric values');
});

it('resolves region path from province and city', () => {
  assertDeepEqual(getRegionPath('湖北省', '武汉'), ['湖北省', '武汉'], 'known province and city should resolve');
  assertDeepEqual(getRegionPath('湖北省', '武汉市'), ['湖北省', '武汉'], 'official city label should resolve to selector value');
  assertDeepEqual(getRegionPath('', ''), [], 'empty province and city should stay empty for required forms');
  assertDeepEqual(getRegionPath('未知省', '武汉'), ['湖北省', '武汉'], 'known city should recover path even if province is stale');
});

it('resolves city path with explicit fallback', () => {
  assertDeepEqual(getRegionPathByCity('长沙'), ['湖南省', '长沙'], 'known city should resolve province path');
  assertDeepEqual(getRegionPathByCity('长沙市'), ['湖南省', '长沙'], 'official city label should resolve province path');
  assertDeepEqual(getRegionPathByCity('未知城市', defaultRegionPath), defaultRegionPath, 'unknown city should use fallback');
});

it('extracts and formats selected region', () => {
  const path = ['湖南省', '长沙'];

  assertEqual(getRegionProvince(path), '湖南省', 'province should be the first path item');
  assertEqual(getRegionCity(path), '长沙', 'city should be the last path item');
  assertEqual(getRegionCityLabel(path), '长沙市', 'city label should use official display name');
  assertEqual(getRegionDisplayLabel(path), '湖南省 / 长沙市', 'display label should include province and official city');
  assertEqual(getRegionProvince([]), '', 'empty path should not invent province');
  assertEqual(getRegionCity([]), '', 'empty path should not invent city');
  assertEqual(getRegionCityLabel([]), '', 'empty path should not invent city label');
  assertEqual(getRegionDisplayLabel([]), '', 'empty path should not invent display label');
});

it('filters region options by province and city keyword', () => {
  assertDeepEqual(
    getFilteredRegionOptions('湖北').map((province) => [province.label, province.cities.map((city) => city.label)]),
    [['湖北省', ['武汉市', '宜昌市', '襄阳市']]],
    'province keyword should return all cities under that province'
  );
  assertDeepEqual(
    getFilteredRegionOptions('武汉').map((province) => [province.label, province.cities.map((city) => city.label)]),
    [['湖北省', ['武汉市']]],
    'city keyword should return matched city under its province'
  );
  assertDeepEqual(getFilteredRegionOptions('不存在'), [], 'unknown keyword should return empty options');
});

it('builds scoped region options from selected paths', () => {
  const options = getRegionOptionsFromPaths([
    ['湖北省', '武汉'],
    ['湖北省', '武汉'],
    ['湖南省', '长沙'],
    [],
    ['未知省', '未知市']
  ]);

  assertDeepEqual(
    options.map((province) => [province.label, province.cities.map((city) => city.label)]),
    [
      ['湖北省', ['武汉市']],
      ['湖南省', ['长沙市']]
    ],
    'scoped options should keep known unique cities only'
  );
  assertDeepEqual(
    getFilteredRegionOptions('长沙', options).map((province) => [province.label, province.cities.map((city) => city.label)]),
    [['湖南省', ['长沙市']]],
    'keyword filtering should respect scoped options'
  );
});
