import type { PeopleMember } from '../people/peopleTypes';
import { performanceRulePresets } from './performanceMockData';
import { resolvePerformanceRuleApplicability } from './performanceRuleApplicabilityModel';
import type { PerformanceMonthlyCategoryRecord } from '../performance/performanceTypes';
import type { PerformanceRulePreset } from './performanceRuleTypes';
import { it } from 'vitest';
import { assertEqual } from '../../__tests__/assertions';

function member(overrides: Partial<PeopleMember> = {}) {
  const position = overrides.position ?? '空间设计师';

  return {
    id: '20269999',
    name: '规则适用测试人员',
    personnelType: '全职',
    position,
    positionAssignments: overrides.positionAssignments ?? [{
      effectiveFrom: '2026-01-01',
      id: 'assignment-performance-test',
      isPrimary: true,
      positionId: `position-${position}`,
      positionName: position,
      status: '生效中'
    }],
    status: '在职',
    ...overrides
  } as PeopleMember;
}

function record(overrides: Partial<PerformanceMonthlyCategoryRecord> = {}) {
  return {
    category: '绘图任务制',
    performanceMonth: '2026-06',
    position: '空间设计师',
    ruleName: '绘图任务制V1',
    ruleVersion: 'V1',
    workNo: '20269999',
    ...overrides
  } as PerformanceMonthlyCategoryRecord;
}

function rules() {
  return performanceRulePresets.map((rule) => ({ ...rule }));
}

it('published rule applies automatically by personnel type position and month', () => {
  const result = resolvePerformanceRuleApplicability({
    peopleRows: [member()],
    record: record(),
    ruleRows: rules()
  });

  assertEqual(result.status, '适用', 'June full-time designer should use V1 automatically');
  assertEqual(result.ruleVersion, 'V1', 'June should resolve the historical effective version');
});

it('new effective version applies without employee signature confirmation', () => {
  const result = resolvePerformanceRuleApplicability({
    peopleRows: [member()],
    record: record({ performanceMonth: '2026-07', ruleName: '绘图任务制V2', ruleVersion: 'V2' }),
    ruleRows: rules()
  });

  assertEqual(result.status, '适用', 'July should automatically use V2');
  assertEqual(result.ruleVersion, 'V2', 'V2 should be selected from its effective period');
});

it('part-time member is not eligible for a full-time rule', () => {
  const result = resolvePerformanceRuleApplicability({
    peopleRows: [member({ personnelType: '兼职', status: '合作中' })],
    record: record(),
    ruleRows: rules()
  });

  assertEqual(result.status, '人员类型不适用', 'personnel type mismatch should block rule applicability');
});

it('position outside rule scope is not eligible', () => {
  const result = resolvePerformanceRuleApplicability({
    peopleRows: [member({ position: '财务专员' })],
    record: record({ position: '财务专员' }),
    ruleRows: rules()
  });

  assertEqual(result.status, '岗位不适用', 'position mismatch should block rule applicability');
});

it('an applicable secondary position can select the published rule', () => {
  const result = resolvePerformanceRuleApplicability({
    peopleRows: [
      member({
        position: '财务专员',
        positionAssignments: [
          { effectiveFrom: '2026-01-01', id: 'assignment-finance', isPrimary: true, positionId: 'position-finance', positionName: '财务专员', status: '生效中' },
          { effectiveFrom: '2026-01-01', id: 'assignment-space', isPrimary: false, positionId: 'position-space-designer', positionName: '空间设计师', status: '生效中' }
        ]
      })
    ],
    record: record({ position: '财务专员' }),
    ruleRows: rules()
  });

  assertEqual(result.status, '适用', 'a matching secondary position should make the rule applicable');
  assertEqual(result.ruleVersion, 'V1', 'the effective rule version should still resolve by month');
});

it('multiple assigned positions cannot silently select overlapping rules', () => {
  const v1 = rules()[0];
  const financeRule: PerformanceRulePreset = {
    ...v1,
    applicablePositions: ['财务专员'],
    currentVersion: 'V8',
    id: 'rule-finance-v8',
    name: '绘图任务制V8'
  };
  const result = resolvePerformanceRuleApplicability({
    peopleRows: [
      member({
        position: '财务专员',
        positionAssignments: [
          { effectiveFrom: '2026-01-01', id: 'assignment-finance', isPrimary: true, positionId: 'position-finance', positionName: '财务专员', status: '生效中' },
          { effectiveFrom: '2026-01-01', id: 'assignment-space', isPrimary: false, positionId: 'position-space-designer', positionName: '空间设计师', status: '生效中' }
        ]
      })
    ],
    record: record({ position: '财务专员' }),
    ruleRows: [v1, financeRule]
  });

  assertEqual(result.status, '规则冲突', 'rules matched through different assigned positions must surface a conflict');
});

it('unpublished rule cannot become an applicable rule', () => {
  const draftRules = rules().map((rule) => ({ ...rule, status: '草稿' as const }));
  const result = resolvePerformanceRuleApplicability({
    peopleRows: [member()],
    record: record(),
    ruleRows: draftRules
  });

  assertEqual(result.status, '规则未发布', 'draft rules should never apply');
});

it('overlapping published rules are surfaced as a conflict', () => {
  const v1 = rules()[0];
  const overlappingRule: PerformanceRulePreset = {
    ...v1,
    currentVersion: 'V9',
    effectiveStartAt: '2026-06-01',
    id: 'rule-overlap-v9',
    name: '绘图任务制V9'
  };
  const result = resolvePerformanceRuleApplicability({
    peopleRows: [member()],
    record: record(),
    ruleRows: [v1, overlappingRule]
  });

  assertEqual(result.status, '规则冲突', 'overlapping effective rules should not be selected silently');
});

it('record version drift is visible without consulting signature files', () => {
  const result = resolvePerformanceRuleApplicability({
    peopleRows: [member()],
    record: record({ performanceMonth: '2026-07', ruleName: '绘图任务制V1', ruleVersion: 'V1' }),
    ruleRows: rules()
  });

  assertEqual(result.status, '规则版本不一致', 'result version should match the automatically applicable period version');
  assertEqual(result.ruleVersion, 'V2', 'drift result should expose the expected V2 version');
});
