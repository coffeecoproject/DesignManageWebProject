import type { PeopleMember } from '../people/peopleTypes';
import type {
  StoreTaskRecord,
  TaskPerformanceScoringRecord
} from '../tasks/TaskManagementState';
import { buildPerformanceSalarySettlementReference } from './performanceMonthlyModel';
import type {
  PerformanceMonthlyCategoryRecord,
  PerformanceRulePreset
} from './performanceTypes';

type BuildTaskPerformanceMonthlySourceRecordsInput = {
  peopleRows: PeopleMember[];
  ruleRows: PerformanceRulePreset[];
  scoringRows: TaskPerformanceScoringRecord[];
  taskRows: StoreTaskRecord[];
};

type TaskPerformanceGroup = {
  member: PeopleMember;
  rule: PerformanceRulePreset;
  scoringRows: TaskPerformanceScoringRecord[];
  taskRows: StoreTaskRecord[];
};

function roundPerformanceMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getMonthlyPrepayRatio(rule: PerformanceRulePreset) {
  const matched = rule.payoutMode.match(/预发\s*(\d+(?:\.\d+)?)%/);

  return matched ? Number(matched[1]) / 100 : 0;
}

function getQualityBand(rule: PerformanceRulePreset, qualityScore: number) {
  return rule.qualityBands.find(
    (band) =>
      qualityScore >= band.minScore &&
      (typeof band.maxScore !== 'number' || qualityScore <= band.maxScore)
  );
}

function getExcessMultiplier(rule: PerformanceRulePreset, taskScore: number) {
  return rule.excessBands.find(
    (band) =>
      taskScore > band.minScoreExclusive &&
      (typeof band.maxScore !== 'number' || taskScore <= band.maxScore)
  )?.multiplier ?? 0;
}

function buildGroupKey(memberId: string, month: string, ruleId: string) {
  return `${month}/${memberId}/${ruleId}`;
}

function buildMonthlyRecord(group: TaskPerformanceGroup): PerformanceMonthlyCategoryRecord {
  const { member, rule, scoringRows, taskRows } = group;
  const performanceMonth = scoringRows[0]?.sourceMonth ?? '';
  const taskScore = roundPerformanceMoney(
    scoringRows.reduce((total, record) => total + (record.scoreValue ?? 0), 0)
  );
  const qualityScore = roundPerformanceMoney(
    scoringRows.reduce((total, record) => total + record.qualityScore, 0) / scoringRows.length
  );
  const qualityBand = getQualityBand(rule, qualityScore);
  const pointValue = rule.fullScore > 0 ? (rule.basePerformanceAmount ?? 0) / rule.fullScore : 0;
  const baseScore = Math.min(taskScore, rule.fullScore);
  const excessScore = Math.max(0, taskScore - rule.fullScore);
  const taskConfirmRatio = taskScore >= (rule.baseLineScore ?? 0) ? 1 : 0.5;
  const baseAmount = roundPerformanceMoney(
    baseScore * pointValue * (qualityBand?.qualityRatio ?? 0) * taskConfirmRatio
  );
  const excessAmount = roundPerformanceMoney(
    excessScore * pointValue * getExcessMultiplier(rule, taskScore) * (qualityBand?.excessRatio ?? 0)
  );
  const monthlyAmount = roundPerformanceMoney(baseAmount + excessAmount);
  const recordId = `task-performance:${performanceMonth}:${member.id}:${rule.id}`;
  const taskNames = taskRows.map((task) => task.name).join('、');

  return {
    category: rule.category,
    department: '公司',
    employeeName: member.name,
    events: scoringRows.flatMap((record) =>
      record.operationRecords.map((operation, operationIndex) => ({
        action: operation.action,
        actor: operation.actor,
        id: operation.id ?? `${record.id}/event/${operationIndex + 1}`,
        object: operation.object,
        summary: operation.summary,
        time: operation.time
      }))
    ),
    id: recordId,
    monthlyAmount,
    note: `按 ${scoringRows.length} 条已验收任务评分归集：${taskNames}`,
    performanceMonth,
    position: member.position,
    prepayAmount: roundPerformanceMoney(monthlyAmount * getMonthlyPrepayRatio(rule)),
    qualityScore,
    ruleName: rule.name,
    ruleVersion: scoringRows[0]?.ruleVersion ?? rule.currentVersion,
    salarySettlementReference: buildPerformanceSalarySettlementReference(recordId, 'monthly-prepay'),
    sourceLabel: '任务验收',
    sourceTaskCount: scoringRows.length,
    taskScore,
    updatedAt: scoringRows
      .map((record) => record.updatedAt)
      .sort((left, right) => right.localeCompare(left))[0] ?? `${performanceMonth}-01 00:00`,
    workNo: member.id
  };
}

export function buildTaskPerformanceMonthlySourceRecords({
  peopleRows,
  ruleRows,
  scoringRows,
  taskRows
}: BuildTaskPerformanceMonthlySourceRecordsInput) {
  const peopleById = new Map(peopleRows.map((member) => [member.id, member]));
  const rulesById = new Map(ruleRows.map((rule) => [rule.id, rule]));
  const tasksById = new Map(taskRows.map((task) => [task.id, task]));
  const groups = new Map<string, TaskPerformanceGroup>();

  for (const scoring of scoringRows) {
    const task = tasksById.get(scoring.taskId);
    const member = task?.executorId ? peopleById.get(task.executorId) : undefined;
    const rule = scoring.ruleId ? rulesById.get(scoring.ruleId) : undefined;

    if (
      scoring.status !== '已计入' ||
      !task ||
      task.status !== '已完成' ||
      !task.acceptedAt ||
      !member ||
      member.personnelType !== '全职' ||
      member.paymentProfile.mode !== '工资发放' ||
      !rule ||
      rule.status !== '已发布' ||
      rule.performanceType !== '任务制' ||
      rule.personnelType !== '全职' ||
      !rule.applicablePositions.includes(member.position) ||
      typeof scoring.scoreValue !== 'number' ||
      scoring.scoreValue < 0 ||
      !scoring.sourceMonth
    ) {
      continue;
    }

    const key = buildGroupKey(member.id, scoring.sourceMonth, rule.id);
    const current = groups.get(key);

    if (current) {
      if (!current.scoringRows.some((record) => record.taskId === scoring.taskId)) {
        current.scoringRows.push(scoring);
        current.taskRows.push(task);
      }
      continue;
    }

    groups.set(key, {
      member,
      rule,
      scoringRows: [scoring],
      taskRows: [task]
    });
  }

  return [...groups.values()]
    .map(buildMonthlyRecord)
    .sort(
      (left, right) =>
        right.performanceMonth.localeCompare(left.performanceMonth) ||
        left.workNo.localeCompare(right.workNo) ||
        left.id.localeCompare(right.id)
    );
}
