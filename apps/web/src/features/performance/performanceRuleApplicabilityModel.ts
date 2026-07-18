import type { PeopleMember } from '../people/peopleTypes';
import type {
  PerformanceMonthlyCategoryRecord,
  PerformanceRuleApplicability,
  PerformanceRulePreset
} from './performanceTypes';

type PerformanceApplicabilityRecord = Pick<
  PerformanceMonthlyCategoryRecord,
  'category' | 'performanceMonth' | 'position' | 'ruleName' | 'ruleVersion' | 'workNo'
>;

type ResolvePerformanceRuleApplicabilityInput = {
  peopleRows: PeopleMember[];
  record: PerformanceApplicabilityRecord;
  ruleRows: PerformanceRulePreset[];
};

export type PerformanceRuleResolution = {
  applicability: PerformanceRuleApplicability;
  rule?: PerformanceRulePreset;
};

function getMonthBoundary(month: string) {
  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const endDate = new Date(year, monthIndex + 1, 0);
  const endDateText = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

  return {
    endDate: endDateText,
    startDate: `${yearText}-${monthText}-01`
  };
}

export function isPerformanceRuleEffectiveInMonth(rule: PerformanceRulePreset, month: string) {
  const boundary = getMonthBoundary(month);

  return (
    Boolean(rule.effectiveStartAt) &&
    rule.effectiveStartAt! <= boundary.endDate &&
    (!rule.effectiveEndAt || rule.effectiveEndAt >= boundary.startDate)
  );
}

function buildApplicability(
  record: PerformanceApplicabilityRecord,
  status: PerformanceRuleApplicability['status'],
  note: string,
  rule?: PerformanceRulePreset,
  member?: PeopleMember
): PerformanceRuleApplicability {
  return {
    applicablePositions: rule?.applicablePositions ?? [],
    category: record.category,
    effectiveEndAt: rule?.effectiveEndAt,
    effectiveStartAt: rule?.effectiveStartAt,
    note,
    personnelType: member?.personnelType,
    position: member?.position ?? record.position,
    ruleId: rule?.id,
    ruleName: rule?.name ?? record.ruleName,
    ruleVersion: rule?.currentVersion ?? record.ruleVersion,
    status,
    workNo: record.workNo
  };
}

export function resolvePerformanceRuleForMember({
  category,
  member,
  performanceMonth,
  ruleRows
}: {
  category: PerformanceMonthlyCategoryRecord['category'];
  member: PeopleMember;
  performanceMonth: string;
  ruleRows: PerformanceRulePreset[];
}): PerformanceRuleResolution {
  const record: PerformanceApplicabilityRecord = {
    category,
    performanceMonth,
    position: member.position,
    ruleName: '',
    ruleVersion: '',
    workNo: member.id
  };
  const categoryRules = ruleRows.filter((rule) => rule.category === category);

  if (categoryRules.length === 0) {
    return {
      applicability: buildApplicability(record, '规则未配置', '该绩效方案尚未配置规则。', undefined, member)
    };
  }

  const publishedRules = categoryRules.filter((rule) => rule.status === '已发布');

  if (publishedRules.length === 0) {
    return {
      applicability: buildApplicability(record, '规则未发布', '该绩效方案没有已发布规则。', undefined, member)
    };
  }

  const personnelRules = publishedRules.filter((rule) => rule.personnelType === member.personnelType);

  if (personnelRules.length === 0) {
    return {
      applicability: buildApplicability(
        record,
        '人员类型不适用',
        `已发布规则不适用于${member.personnelType}人员。`,
        publishedRules[0],
        member
      )
    };
  }

  const positionRules = personnelRules.filter((rule) => rule.applicablePositions.includes(member.position));

  if (positionRules.length === 0) {
    return {
      applicability: buildApplicability(
        record,
        '岗位不适用',
        `岗位“${member.position}”不在规则适用范围内。`,
        personnelRules[0],
        member
      )
    };
  }

  const effectiveRules = positionRules.filter((rule) => isPerformanceRuleEffectiveInMonth(rule, performanceMonth));

  if (effectiveRules.length === 0) {
    return {
      applicability: buildApplicability(
        record,
        '不在生效期',
        `${performanceMonth}不在已发布规则的生效区间内。`,
        positionRules[0],
        member
      )
    };
  }

  if (effectiveRules.length > 1) {
    return {
      applicability: buildApplicability(
        record,
        '规则冲突',
        `${performanceMonth}存在${effectiveRules.length}个同时适用的已发布规则。`,
        effectiveRules[0],
        member
      )
    };
  }

  const rule = effectiveRules[0];

  return {
    applicability: buildApplicability(
      record,
      '适用',
      `按${member.personnelType}、岗位“${member.position}”和${performanceMonth}生效期间自动适用。`,
      rule,
      member
    ),
    rule
  };
}

export function resolvePerformanceRuleApplicability({
  peopleRows,
  record,
  ruleRows
}: ResolvePerformanceRuleApplicabilityInput): PerformanceRuleApplicability {
  const member = peopleRows.find((person) => person.id === record.workNo);

  if (!member) {
    return buildApplicability(record, '人员未找到', '人员档案中未找到该工号，无法确定适用规则。');
  }
  const resolution = resolvePerformanceRuleForMember({
    category: record.category,
    member,
    performanceMonth: record.performanceMonth,
    ruleRows
  });
  const rule = resolution.rule;

  if (!rule || resolution.applicability.status !== '适用') {
    return resolution.applicability;
  }

  if (record.ruleName !== rule.name || record.ruleVersion !== rule.currentVersion) {
    return buildApplicability(
      record,
      '规则版本不一致',
      `结果记录为${record.ruleName} ${record.ruleVersion}，该期间应适用${rule.name} ${rule.currentVersion}。`,
      rule,
      member
    );
  }

  return buildApplicability(
    record,
    '适用',
    `按${member.personnelType}、岗位“${member.position}”和${record.performanceMonth}生效期间自动适用。`,
    rule,
    member
  );
}

export function attachPerformanceRuleApplicability<TRecord extends PerformanceApplicabilityRecord>({
  peopleRows,
  records,
  ruleRows
}: Omit<ResolvePerformanceRuleApplicabilityInput, 'record'> & { records: TRecord[] }): TRecord[] {
  return records.map((record) => ({
    ...record,
    ruleApplicability: resolvePerformanceRuleApplicability({ peopleRows, record, ruleRows })
  }));
}
