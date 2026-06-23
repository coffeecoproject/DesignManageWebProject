import type { UploadFile } from 'antd/es/upload/interface';
import type { OperationRecord } from '../../components/OperationRecordTable';
import {
  performanceSignatureEmployees,
  signatureRuleOptions,
  type PerformanceEmployeeSignatureArchive,
  type PerformanceSignatureFile,
  type PerformanceSignatureRelationStatus,
  type PerformanceSignatureRuleOption
} from './performanceSignatureArchiveData';
import type { PerformanceRuleCategory } from './performanceTypes';

export type PerformanceSignatureFileAction = 'preview' | 'download';
export type SignatureRelationFilter = '全部' | '有历史版本';
export type SignatureCategoryFilter = '全部' | PerformanceRuleCategory;
export type SignatureListTabKey = 'current' | 'history';

export type PerformanceSignatureFilters = {
  category: SignatureCategoryFilter;
  keyword: string;
  position: '全部' | string;
  relation: SignatureRelationFilter;
};

export type PerformanceSignatureRelationRow = {
  id: string;
  category: PerformanceRuleCategory;
  currentFile?: PerformanceSignatureFile;
  employee: PerformanceEmployeeSignatureArchive;
  file: PerformanceSignatureFile;
  historyFiles: PerformanceSignatureFile[];
  relationStatus: PerformanceSignatureRelationStatus;
};

export type SignatureCreateForm = {
  employeeId: string;
  fileName: string | null;
  ruleId: string;
};

export type PerformanceSignatureMetrics = {
  currentCategoryCount: number;
  currentFileCount: number;
  employeeCount: number;
  historyFileCount: number;
};

export type PerformanceSignatureFilterOptions = {
  categories: Array<'全部' | PerformanceRuleCategory>;
  positions: Array<'全部' | string>;
};

export const defaultPerformanceSignatureFilters: PerformanceSignatureFilters = {
  category: '全部',
  keyword: '',
  position: '全部',
  relation: '全部'
};

export const employeeStatusTone = {
  在职: 'green',
  试用期: 'amber',
  离职: 'gray'
} as const;

export function getCurrentFiles(record: PerformanceEmployeeSignatureArchive) {
  return record.files.filter((file) => file.relationStatus === '当前签署');
}

export function getHistoryFiles(record: PerformanceEmployeeSignatureArchive) {
  return record.files.filter((file) => file.relationStatus === '历史文件');
}

export function getCurrentCategories(record: PerformanceEmployeeSignatureArchive) {
  return Array.from(new Set(getCurrentFiles(record).map((file) => file.category)));
}

export function getAllCategories(record: PerformanceEmployeeSignatureArchive) {
  return Array.from(new Set(record.files.map((file) => file.category)));
}

export function formatTextPreview(values: string[], visibleCount = 2) {
  if (values.length === 0) {
    return '-';
  }

  const visibleValues = values.slice(0, visibleCount).join(' / ');
  const hiddenCount = values.length - visibleCount;

  return hiddenCount > 0 ? `${visibleValues} +${hiddenCount}` : visibleValues;
}

export function getSignatureRelationRows(
  employees: PerformanceEmployeeSignatureArchive[],
  relationStatus: PerformanceSignatureRelationStatus
): PerformanceSignatureRelationRow[] {
  return employees.flatMap((employee) =>
    employee.files
      .filter((file) => file.relationStatus === relationStatus)
      .map((file) => {
        const currentFile = getCurrentFiles(employee).find((currentItem) => currentItem.category === file.category);

        return {
          category: file.category,
          currentFile,
          employee,
          file,
          historyFiles: getHistoryFiles(employee).filter((historyFile) => historyFile.category === file.category),
          id: `${employee.id}-${file.id}`,
          relationStatus
        };
      })
  );
}

export function getApplicableRuleOptions(employee: PerformanceEmployeeSignatureArchive | undefined) {
  if (!employee) {
    return [];
  }

  return signatureRuleOptions.filter((rule) => rule.applicablePositions.includes(employee.position));
}

export function getNewSignatureRuleOptions(employee: PerformanceEmployeeSignatureArchive | undefined) {
  const currentCategories = employee ? getCurrentCategories(employee) : [];

  return getApplicableRuleOptions(employee).filter((rule) => !currentCategories.includes(rule.category));
}

export function getSameCategoryRuleOptions(employee: PerformanceEmployeeSignatureArchive | undefined, category: PerformanceRuleCategory) {
  return getApplicableRuleOptions(employee).filter((rule) => rule.category === category);
}

export function getFirstNewSignatureRule(employee: PerformanceEmployeeSignatureArchive | undefined) {
  return getNewSignatureRuleOptions(employee)[0];
}

export function getRuleOption(ruleId: string) {
  return signatureRuleOptions.find((rule) => rule.id === ruleId);
}

export function getSelectedSignatureFileName(file: UploadFile, fallbackName: string) {
  return file.name?.trim() || fallbackName;
}

export function buildSignatureCreateForm(
  employees: PerformanceEmployeeSignatureArchive[],
  employeeId = employees[0]?.id ?? ''
): SignatureCreateForm {
  const employee = employees.find((item) => item.id === employeeId);
  const firstRule = getFirstNewSignatureRule(employee);

  return {
    employeeId,
    fileName: null,
    ruleId: firstRule?.id ?? ''
  };
}

export function getPerformanceSignatureFilterOptions(employees: PerformanceEmployeeSignatureArchive[]): PerformanceSignatureFilterOptions {
  return {
    categories: ['全部', ...Array.from(new Set(employees.flatMap((employee) => getAllCategories(employee))))],
    positions: ['全部', ...Array.from(new Set(employees.map((employee) => employee.position)))]
  };
}

export function getPerformanceSignatureMetrics(employees: PerformanceEmployeeSignatureArchive[]): PerformanceSignatureMetrics {
  return {
    currentCategoryCount: new Set(employees.flatMap((employee) => getCurrentCategories(employee))).size,
    currentFileCount: employees.reduce((total, employee) => total + getCurrentFiles(employee).length, 0),
    employeeCount: employees.length,
    historyFileCount: employees.reduce((total, employee) => total + getHistoryFiles(employee).length, 0)
  };
}

export function filterPerformanceSignatureRows(rows: PerformanceSignatureRelationRow[], filters: PerformanceSignatureFilters) {
  const keyword = filters.keyword.trim().toLowerCase();

  return rows
    .filter((row) => filters.position === '全部' || row.employee.position === filters.position)
    .filter((row) => filters.category === '全部' || row.category === filters.category)
    .filter((row) => {
      if (filters.relation === '有历史版本') {
        return row.historyFiles.length > 0;
      }

      return true;
    })
    .filter((row) => {
      if (!keyword) {
        return true;
      }

      return [
        row.employee.employeeName,
        row.employee.workNo,
        row.employee.department,
        row.employee.position,
        row.category,
        row.file.ruleName,
        row.file.ruleVersion,
        row.file.fileName
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });
}

export function createSignatureFile(
  employee: PerformanceEmployeeSignatureArchive,
  rule: PerformanceSignatureRuleOption,
  fileName: string,
  note: string,
  now = Date.now()
): PerformanceSignatureFile {
  return {
    category: rule.category,
    fileName,
    id: `perf-file-${employee.workNo}-${rule.id}-${now}`,
    note,
    relationStatus: '当前签署',
    ruleName: rule.ruleName,
    ruleVersion: rule.ruleVersion,
    signedAt: '2026-06-14',
    uploadedAt: '2026-06-14 14:20'
  };
}

export function createSignatureOperation(
  employee: PerformanceEmployeeSignatureArchive,
  rule: Pick<PerformanceSignatureRuleOption, 'id' | 'ruleName'>,
  action: string,
  summary: string,
  now = Date.now()
): OperationRecord {
  return {
    action,
    actor: '李明',
    id: `perf-op-${employee.workNo}-${rule.id}-${now}`,
    object: rule.ruleName,
    summary,
    time: '2026-06-14 14:20'
  };
}

export function addPerformanceSignatureRelation(
  employee: PerformanceEmployeeSignatureArchive,
  rule: PerformanceSignatureRuleOption,
  fileName: string,
  now = Date.now()
) {
  const nextFile = createSignatureFile(employee, rule, fileName, '新增员工绩效签署关系', now);
  const nextOperation = createSignatureOperation(employee, rule, '新增签署', `新增${rule.ruleName}员工签署文件`, now);

  return {
    employee: {
      ...employee,
      files: [...employee.files, nextFile],
      operationRecords: [nextOperation, ...employee.operationRecords],
      updatedAt: '2026-06-14',
      updatedBy: '李明'
    },
    file: nextFile
  };
}

export function updatePerformanceSignatureRelation(
  employee: PerformanceEmployeeSignatureArchive,
  category: PerformanceRuleCategory,
  rule: PerformanceSignatureRuleOption,
  fileName: string,
  now = Date.now()
) {
  const nextFile = createSignatureFile(employee, rule, fileName, '更新绩效规则版本后形成当前签署', now);
  const currentFile = getCurrentFiles(employee).find((file) => file.category === category);
  const nextOperation = createSignatureOperation(
    employee,
    rule,
    '更新绩效版本',
    currentFile ? `上传${rule.ruleName}签署文件，${currentFile.ruleName}转为历史签署` : `上传${rule.ruleName}签署文件`,
    now
  );

  return {
    employee: {
      ...employee,
      files: [
        ...employee.files.map((file) =>
          file.category === category && file.relationStatus === '当前签署'
            ? { ...file, relationStatus: '历史文件' as const, note: '版本更新后转为历史签署' }
            : file
        ),
        nextFile
      ],
      operationRecords: [nextOperation, ...employee.operationRecords],
      updatedAt: '2026-06-14',
      updatedBy: '李明'
    },
    file: nextFile
  };
}

export function disablePerformanceSignatureRelation(
  employee: PerformanceEmployeeSignatureArchive,
  category: PerformanceRuleCategory,
  now = Date.now()
) {
  const currentFile = getCurrentFiles(employee).find((file) => file.category === category);
  const fallbackRule = currentFile
    ? {
        id: currentFile.id,
        ruleName: currentFile.ruleName
      }
    : undefined;
  const nextOperation = fallbackRule
    ? createSignatureOperation(employee, fallbackRule, '停用当前绩效', `${category}当前签署转为历史签署`, now)
    : undefined;

  return {
    ...employee,
    files: employee.files.map((file) =>
      file.category === category && file.relationStatus === '当前签署'
        ? { ...file, relationStatus: '历史文件' as const, note: '停用当前绩效后转为历史签署' }
        : file
    ),
    operationRecords: nextOperation ? [nextOperation, ...employee.operationRecords] : employee.operationRecords,
    updatedAt: '2026-06-14',
    updatedBy: '李明'
  };
}

export function getInitialSignatureEmployees() {
  return performanceSignatureEmployees;
}
