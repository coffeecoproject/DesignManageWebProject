import type { PerformanceRulePreset } from '../performance/performanceTypes';
import type {
  StoreTaskRecord,
  TaskAcceptanceCommitInput
} from './TaskManagementState';
import {
  buildTaskPerformanceScoringRecord,
  formatScore,
  getAcceptanceBlockers,
  type AcceptanceScoringDraft
} from './taskAcceptanceModel';
import { appendTaskOperation } from './taskOperationModel';
import {
  buildPartTimeLaborAcceptanceRecord,
  type PartTimeLaborSettlementPerson
} from './partTimeLaborSettlementModel';

export type PrepareTaskAcceptanceInput = {
  acceptedAt: string;
  performanceRuleRows: PerformanceRulePreset[];
  person?: PartTimeLaborSettlementPerson;
  scoringDraft?: AcceptanceScoringDraft;
  task: StoreTaskRecord;
};

export type PrepareTaskAcceptanceResult =
  | {
      blockers: string[];
      message: string;
      success: false;
      targetTab: 'overview' | 'scoring';
    }
  | {
      commitInput: TaskAcceptanceCommitInput;
      nextTask: StoreTaskRecord;
      success: true;
    };

function getBlockerTargetTab(blockers: string[]) {
  return blockers.some((item) => ['绩效计分项', '归属月份', '质量评分'].includes(item))
    ? 'scoring' as const
    : 'overview' as const;
}

export function prepareTaskAcceptanceCommit({
  acceptedAt,
  performanceRuleRows,
  person,
  scoringDraft,
  task
}: PrepareTaskAcceptanceInput): PrepareTaskAcceptanceResult {
  const blockers = getAcceptanceBlockers(task, scoringDraft);

  if (!scoringDraft || blockers.length > 0) {
    return {
      blockers,
      message: `请先完成：${blockers.join('、')}`,
      success: false,
      targetTab: getBlockerTargetTab(blockers)
    };
  }

  const scoringRecord = buildTaskPerformanceScoringRecord(task, scoringDraft, performanceRuleRows);
  const nextTask = appendTaskOperation(
    {
      ...task,
      acceptedAt,
      acceptorName: task.acceptorName,
      status: '已完成'
    },
    '验收通过',
    `交付验收通过；绩效评分 ${formatScore(scoringRecord.qualityScore)}`,
    '李明',
    acceptedAt
  );
  const laborAcceptanceResult = buildPartTimeLaborAcceptanceRecord({
    person,
    task: nextTask
  });

  if (!laborAcceptanceResult.ready) {
    return {
      blockers: [laborAcceptanceResult.message],
      message: laborAcceptanceResult.message,
      success: false,
      targetTab: 'overview'
    };
  }

  return {
    commitInput: {
      laborAcceptance: laborAcceptanceResult.acceptanceRecord,
      scoringRecord,
      task: nextTask
    },
    nextTask,
    success: true
  };
}
