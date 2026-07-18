import { performanceSignatureEmployees } from './performanceSignatureArchiveData';
import { performanceRulePresets } from './performanceMockData';
import {
  addPerformanceSignatureArchive,
  archivePerformanceSignatureRelation,
  buildPerformanceSignatureRuleOptions,
  buildSignatureCreateForm,
  filterPerformanceSignatureRows,
  getCurrentFiles,
  getHistoryFiles,
  getPerformanceSignatureFilterOptions,
  getPerformanceSignatureMetrics,
  getRuleOption,
  getSignatureRelationRows,
  updatePerformanceSignatureArchive
} from './performanceSignatureModel';
import type { PerformanceSignatureRuleOption } from './performanceSignatureArchiveData';

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

function fixtureEmployee(index: number) {
  const employee = performanceSignatureEmployees[index];

  assert(employee, `fixture employee ${index} should exist`);
  return employee;
}

const fixtureRuleOptions: PerformanceSignatureRuleOption[] = [
  {
    applicablePositions: ['空间设计师', '主案设计师'],
    category: '绘图任务制',
    id: 'rule-draw-v3',
    personnelType: '全职',
    ruleName: '绘图任务制V3',
    ruleVersion: 'V3'
  },
  {
    applicablePositions: ['空间设计师', '主案设计师'],
    category: '岗位职责考核',
    id: 'rule-duty-v1',
    personnelType: '全职',
    ruleName: '岗位职责考核V1',
    ruleVersion: 'V1'
  }
];

function fixtureRule(ruleId: string) {
  const rule = getRuleOption(ruleId, fixtureRuleOptions);

  assert(rule, `fixture rule ${ruleId} should exist`);
  return rule;
}

const tests: UnitTest[] = [
  {
    name: 'performance signature metrics and filter options are derived from relation rows',
    run() {
      const metrics = getPerformanceSignatureMetrics(performanceSignatureEmployees);
      const filterOptions = getPerformanceSignatureFilterOptions(performanceSignatureEmployees);

      assertEqual(metrics.employeeCount, 3, 'employee metric should include all signature employees');
      assertEqual(metrics.currentFileCount, 3, 'current archive metric should count current files');
      assertEqual(metrics.historyFileCount, 4, 'history metric should count historical files');
      assertEqual(metrics.currentCategoryCount, 1, 'category metric should count current categories once');
      assert(filterOptions.positions.includes('空间设计师'), 'position options should include employee positions');
      assert(filterOptions.categories.includes('项目奖金'), 'category options should include historical-only categories');
    }
  },
  {
    name: 'signature relation rows preserve current and historical category linkage',
    run() {
      const currentRows = getSignatureRelationRows(performanceSignatureEmployees, '当前档案');
      const historyRows = getSignatureRelationRows(performanceSignatureEmployees, '历史档案');
      const zhaoDrawRow = currentRows.find((row) => row.employee.employeeName === '赵倩' && row.category === '绘图任务制');

      assertEqual(currentRows.length, 3, 'current relation rows should include every current signature file');
      assertEqual(historyRows.length, 4, 'history relation rows should include every historical file');
      assertEqual(zhaoDrawRow?.historyFiles.length, 1, 'current row should expose same-category history files');
    }
  },
  {
    name: 'signature filters match relation state, category and keyword',
    run() {
      const currentRows = getSignatureRelationRows(performanceSignatureEmployees, '当前档案');
      const historyLinkedRows = filterPerformanceSignatureRows(currentRows, {
        category: '全部',
        keyword: '',
        position: '全部',
        relation: '有历史版本'
      });
      const chenRows = filterPerformanceSignatureRows(currentRows, {
        category: '全部',
        keyword: '陈思',
        position: '全部',
        relation: '全部'
      });

      assert(historyLinkedRows.every((row) => row.historyFiles.length > 0), 'history filter should keep only rows with history files');
      assertEqual(chenRows.length, 1, 'keyword filter should match current employee archive rows');
    }
  },
  {
    name: 'signature archive options come only from current published performance rules',
    run() {
      const ruleOptions = buildPerformanceSignatureRuleOptions(performanceRulePresets);
      const form = buildSignatureCreateForm(performanceSignatureEmployees, ruleOptions);

      assertEqual(form.employeeId, fixtureEmployee(0).id, 'create form should default to first employee');
      assertEqual(ruleOptions.length, 1, 'only one current published rule should be available for archive upload');
      assertEqual(ruleOptions[0]?.ruleVersion, 'V2', 'archive upload should consume the current rule version');
      assertEqual(form.ruleId, '', 'create form should not offer a category that already has a current archive');
      assertEqual(form.fileName, null, 'create form should start without an uploaded file');
    }
  },
  {
    name: 'adding a signature relation appends a current file and operation record',
    run() {
      const employee = fixtureEmployee(1);
      const result = addPerformanceSignatureArchive(employee, fixtureRule('rule-duty-v1'), '刘宇_岗位职责考核V1_绩效签署文件.pdf', 1);

      assertEqual(result.file.relationStatus, '当前档案', 'added relation should become a current archive');
      assertEqual(result.file.category, '岗位职责考核', 'added relation should use the selected rule category');
      assertEqual(result.employee.files.length, employee.files.length + 1, 'added relation should append one file');
      assertEqual(result.employee.operationRecords[0]?.action, '新增签署档案', 'added archive should prepend an operation record');
    }
  },
  {
    name: 'updating a signature relation demotes old current file to history',
    run() {
      const employee = fixtureEmployee(1);
      const result = updatePerformanceSignatureArchive(employee, '绘图任务制', fixtureRule('rule-draw-v3'), '刘宇_绘图任务制V3_绩效签署文件.pdf', 2);
      const currentDrawFiles = getCurrentFiles(result.employee).filter((file) => file.category === '绘图任务制');
      const historyDrawFiles = getHistoryFiles(result.employee).filter((file) => file.category === '绘图任务制');

      assertEqual(result.file.ruleVersion, 'V3', 'updated relation should use selected new version');
      assertEqual(currentDrawFiles.length, 1, 'updated relation should keep one current file in the category');
      assertEqual(historyDrawFiles.length, 1, 'updated relation should move previous current file to history');
      assertEqual(result.employee.operationRecords[0]?.action, '更新签署档案', 'updated archive should prepend an update operation');
    }
  },
  {
    name: 'archiving a signature relation moves only the file to history',
    run() {
      const employee = fixtureEmployee(2);
      const result = archivePerformanceSignatureRelation(employee, '绘图任务制', 3);
      const currentDrawFiles = getCurrentFiles(result).filter((file) => file.category === '绘图任务制');
      const historyDrawFiles = getHistoryFiles(result).filter((file) => file.category === '绘图任务制');

      assertEqual(currentDrawFiles.length, 0, 'archived category should have no current files');
      assertEqual(historyDrawFiles.length, 1, 'archived current file should become history');
      assertEqual(result.operationRecords[0]?.action, '移入历史档案', 'archive action should not be described as disabling performance');
    }
  }
];

export function runPerformanceSignatureModelTests(): UnitTestResult {
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
