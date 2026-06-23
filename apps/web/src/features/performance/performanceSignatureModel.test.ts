import { performanceSignatureEmployees } from './performanceSignatureArchiveData';
import {
  addPerformanceSignatureRelation,
  buildSignatureCreateForm,
  disablePerformanceSignatureRelation,
  filterPerformanceSignatureRows,
  getCurrentFiles,
  getHistoryFiles,
  getPerformanceSignatureFilterOptions,
  getPerformanceSignatureMetrics,
  getRuleOption,
  getSignatureRelationRows,
  updatePerformanceSignatureRelation
} from './performanceSignatureModel';

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

function fixtureRule(ruleId: string) {
  const rule = getRuleOption(ruleId);

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
      assertEqual(metrics.currentFileCount, 5, 'current signature metric should count current files');
      assertEqual(metrics.historyFileCount, 2, 'history metric should count historical files');
      assertEqual(metrics.currentCategoryCount, 2, 'category metric should count current categories once');
      assert(filterOptions.positions.includes('空间设计师'), 'position options should include employee positions');
      assert(filterOptions.categories.includes('项目奖金'), 'category options should include historical-only categories');
    }
  },
  {
    name: 'signature relation rows preserve current and historical category linkage',
    run() {
      const currentRows = getSignatureRelationRows(performanceSignatureEmployees, '当前签署');
      const historyRows = getSignatureRelationRows(performanceSignatureEmployees, '历史文件');
      const zhaoDrawRow = currentRows.find((row) => row.employee.employeeName === '赵倩' && row.category === '绘图任务制');

      assertEqual(currentRows.length, 5, 'current relation rows should include every current signature file');
      assertEqual(historyRows.length, 2, 'history relation rows should include every historical file');
      assertEqual(zhaoDrawRow?.historyFiles.length, 1, 'current row should expose same-category history files');
    }
  },
  {
    name: 'signature filters match relation state, category and keyword',
    run() {
      const currentRows = getSignatureRelationRows(performanceSignatureEmployees, '当前签署');
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
      assertEqual(chenRows.length, 2, 'keyword filter should match employee related rows');
    }
  },
  {
    name: 'signature create form selects the first missing applicable category',
    run() {
      const form = buildSignatureCreateForm(performanceSignatureEmployees);

      assertEqual(form.employeeId, fixtureEmployee(0).id, 'create form should default to first employee');
      assertEqual(form.ruleId, 'rule-bonus-v1', 'create form should skip categories already signed by the employee');
      assertEqual(form.fileName, null, 'create form should start without an uploaded file');
    }
  },
  {
    name: 'adding a signature relation appends a current file and operation record',
    run() {
      const employee = fixtureEmployee(1);
      const result = addPerformanceSignatureRelation(employee, fixtureRule('rule-duty-v1'), '刘宇_岗位职责考核V1_绩效签署文件.pdf', 1);

      assertEqual(result.file.relationStatus, '当前签署', 'added relation should become a current signature');
      assertEqual(result.file.category, '岗位职责考核', 'added relation should use the selected rule category');
      assertEqual(result.employee.files.length, employee.files.length + 1, 'added relation should append one file');
      assertEqual(result.employee.operationRecords[0]?.action, '新增签署', 'added relation should prepend an operation record');
    }
  },
  {
    name: 'updating a signature relation demotes old current file to history',
    run() {
      const employee = fixtureEmployee(1);
      const result = updatePerformanceSignatureRelation(employee, '绘图任务制', fixtureRule('rule-draw-v3'), '刘宇_绘图任务制V3_绩效签署文件.pdf', 2);
      const currentDrawFiles = getCurrentFiles(result.employee).filter((file) => file.category === '绘图任务制');
      const historyDrawFiles = getHistoryFiles(result.employee).filter((file) => file.category === '绘图任务制');

      assertEqual(result.file.ruleVersion, 'V3', 'updated relation should use selected new version');
      assertEqual(currentDrawFiles.length, 1, 'updated relation should keep one current file in the category');
      assertEqual(historyDrawFiles.length, 1, 'updated relation should move previous current file to history');
      assertEqual(result.employee.operationRecords[0]?.action, '更新绩效版本', 'updated relation should prepend an update operation');
    }
  },
  {
    name: 'disabling a signature relation moves current files to history',
    run() {
      const employee = fixtureEmployee(2);
      const result = disablePerformanceSignatureRelation(employee, '岗位职责考核', 3);
      const currentDutyFiles = getCurrentFiles(result).filter((file) => file.category === '岗位职责考核');
      const historyDutyFiles = getHistoryFiles(result).filter((file) => file.category === '岗位职责考核');

      assertEqual(currentDutyFiles.length, 0, 'disabled category should have no current files');
      assertEqual(historyDutyFiles.length, 1, 'disabled current file should become history');
      assertEqual(result.operationRecords[0]?.action, '停用当前绩效', 'disabled relation should prepend a disable operation');
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
