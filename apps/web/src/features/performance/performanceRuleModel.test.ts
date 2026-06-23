import type { UploadFile } from 'antd/es/upload/interface';
import { performanceRulePresets } from './performanceMockData';
import {
  applyPublishedRule,
  createDraftRuleFromCategory,
  filterPerformanceRules,
  formatRulePositionPreview,
  getNextRuleVersion,
  getPerformanceRuleFilterOptions,
  getPerformanceRuleMetrics,
  getRuleRelatedFileRecords,
  getRuleReviewBlockers,
  publishPerformanceRule,
  submitRuleForReview
} from './performanceRuleModel';
import type { PerformanceRulePreset } from './performanceTypes';

type UnitTest = {
  name: string;
  run: () => void;
};

type UnitTestResult = {
  failures: string[];
  passed: number;
  total: number;
};

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    fail(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (!Object.is(actual, expected)) {
    fail(`${message}. Expected ${String(expected)}, received ${String(actual)}`);
  }
}

function firstRule(): PerformanceRulePreset {
  const rule = performanceRulePresets[0];

  assert(rule, 'fixture should include at least one performance rule');
  return rule;
}

const tests: UnitTest[] = [
  {
    name: 'performance rule metrics and filters use normalized model functions',
    run() {
      const metrics = getPerformanceRuleMetrics(performanceRulePresets);
      const filterOptions = getPerformanceRuleFilterOptions(performanceRulePresets);
      const publishedRules = filterPerformanceRules(performanceRulePresets, {
        category: '全部',
        keyword: '空间设计师',
        performanceType: '全部',
        position: '空间设计师',
        status: '已发布'
      });

      assertEqual(metrics.totalRules, performanceRulePresets.length, 'total metric should reflect all rule rows');
      assertEqual(metrics.publishedRules, performanceRulePresets.length, 'mock rule rows should all be published');
      assert(filterOptions.positions.includes('空间设计师'), 'position filter options should be derived from rule applicability');
      assert(publishedRules.length > 0, 'filter should match published space designer rules');
      assert(publishedRules.every((rule) => rule.status === '已发布'), 'status filter should restrict rows');
    }
  },
  {
    name: 'performance rule review blockers require complete editable configuration',
    run() {
      const incompleteRule: PerformanceRulePreset = {
        ...firstRule(),
        applicablePositions: [],
        sourceFiles: [],
        taskScoreItems: []
      };
      const blockers = getRuleReviewBlockers(incompleteRule);

      assert(blockers.includes('适用岗位'), 'review blockers should require applicable positions');
      assert(blockers.includes('规则依据文件'), 'review blockers should require source files');
      assert(blockers.includes('任务计分'), 'review blockers should require task score items');
    }
  },
  {
    name: 'performance rule draft creation copies template structure and uploaded files',
    run() {
      const templateRule = firstRule();
      const uploadFile = {
        uid: 'upload-rule-file-1',
        name: '绘图任务制V3依据.pdf'
      } as UploadFile;
      const draftRule = createDraftRuleFromCategory({
        category: '绘图任务制',
        files: [uploadFile],
        performanceType: '任务制',
        positions: ['空间设计师'],
        sequence: 3,
        templateRule,
        version: 'V3'
      });

      assertEqual(draftRule.name, '绘图任务制V3', 'draft rule name should follow category and version');
      assertEqual(draftRule.status, '草稿', 'newly created rule should be draft');
      assertEqual(draftRule.sourceFiles.length, 1, 'uploaded basis file should become a source file');
      assertEqual(draftRule.taskScoreItems.length, templateRule.taskScoreItems.length, 'task score structure should copy the template');
      assertEqual(formatRulePositionPreview(draftRule), '空间设计师', 'position preview should use selected positions');
    }
  },
  {
    name: 'performance rule status transitions are centralized in the model',
    run() {
      const draftRule: PerformanceRulePreset = {
        ...firstRule(),
        id: 'rule-under-review',
        categoryVersionState: '草稿',
        currentVersion: 'V3',
        name: '绘图任务制V3',
        status: '草稿'
      };
      const reviewingRule = submitRuleForReview(draftRule);

      assertEqual(reviewingRule.status, '待审核', 'submit review should move draft to reviewing');
      assertEqual(reviewingRule.categoryVersionState, '待审核', 'submit review should lock category version state');
      assertEqual(reviewingRule.versionEvents.at(-1)?.action, '提交审核', 'submit review should append an audit event');
    }
  },
  {
    name: 'performance rule publish replaces current version and downgrades previous published rules',
    run() {
      const currentRule = firstRule();
      const reviewingRule: PerformanceRulePreset = {
        ...currentRule,
        id: 'perf-rule-space-design-v3-reviewing',
        categoryVersionState: '待审核',
        currentVersion: 'V3',
        effectiveStartAt: undefined,
        name: '绘图任务制V3',
        status: '待审核'
      };
      const publishedRule = publishPerformanceRule(reviewingRule);
      const appliedRows = applyPublishedRule([currentRule, reviewingRule], publishedRule);
      const oldRule = appliedRows.find((rule) => rule.id === currentRule.id);
      const newRule = appliedRows.find((rule) => rule.id === reviewingRule.id);

      assertEqual(publishedRule.status, '已发布', 'publish should move reviewing rule to published');
      assertEqual(publishedRule.effectiveStartAt, '2026-07-01', 'publish should default missing effective date');
      assertEqual(oldRule?.categoryVersionState, '员工执行旧版', 'previous published rule should become legacy execution version');
      assertEqual(newRule?.categoryVersionState, '当前发布版本', 'new published rule should become current category version');
    }
  },
  {
    name: 'performance rule file records provide uploaded and placeholder states',
    run() {
      const uploadedFileRecords = getRuleRelatedFileRecords(firstRule().sourceFiles);
      const placeholderFileRecords = getRuleRelatedFileRecords([]);

      assertEqual(uploadedFileRecords[0]?.status, '已上传', 'uploaded source file should become uploaded related file');
      assertEqual(placeholderFileRecords[0]?.status, '待上传', 'empty source files should produce a placeholder');
      assertEqual(getNextRuleVersion(performanceRulePresets), 'V3', 'next version should derive from existing rules');
    }
  }
];

export function runPerformanceRuleModelTests(): UnitTestResult {
  const failures: string[] = [];
  let passed = 0;

  for (const test of tests) {
    try {
      test.run();
      passed += 1;
    } catch (error) {
      failures.push(`${test.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    failures,
    passed,
    total: tests.length
  };
}
