import type {
  PerformanceEmployeeSignatureArchive,
  PerformanceSignatureFile,
  PerformanceSignatureRuleOption
} from './performanceSignatureArchiveData';
import type {
  PerformanceExecutionContract,
  PerformanceExecutionContractSource,
  PerformanceMonthlyCategoryRecord,
  PerformanceRulePreset,
  PerformanceRuleStatus
} from './performanceTypes';

type PerformanceContractRecord = Pick<
  PerformanceMonthlyCategoryRecord,
  'category' | 'position' | 'ruleName' | 'ruleVersion' | 'workNo'
>;

type ResolvePerformanceExecutionContractInput = {
  record: PerformanceContractRecord;
  ruleOptions: PerformanceSignatureRuleOption[];
  ruleRows: PerformanceRulePreset[];
  signatureEmployees: PerformanceEmployeeSignatureArchive[];
};

type PerformanceContractRuleBasis = {
  applicablePositions: string[];
  ruleId?: string;
  ruleName: string;
  ruleSource: PerformanceExecutionContractSource;
  ruleStatus?: PerformanceRuleStatus;
  ruleVersion: string;
};

function findSignatureEmployee(record: PerformanceContractRecord, signatureEmployees: PerformanceEmployeeSignatureArchive[]) {
  return signatureEmployees.find((employee) => employee.workNo === record.workNo);
}

function signatureFileMatchesRecord(file: PerformanceSignatureFile, record: PerformanceContractRecord) {
  return file.category === record.category && file.ruleVersion === record.ruleVersion;
}

function findSignatureFile(record: PerformanceContractRecord, signatureEmployees: PerformanceEmployeeSignatureArchive[]) {
  const employee = findSignatureEmployee(record, signatureEmployees);

  if (!employee) {
    return undefined;
  }

  const sameCategoryFiles = employee.files.filter((file) => file.category === record.category);
  const exactCurrentFile = sameCategoryFiles.find(
    (file) => file.relationStatus === '当前签署' && signatureFileMatchesRecord(file, record)
  );
  const exactHistoricalFile = sameCategoryFiles.find(
    (file) => file.relationStatus === '历史文件' && signatureFileMatchesRecord(file, record)
  );
  const currentCategoryFile = sameCategoryFiles.find((file) => file.relationStatus === '当前签署');

  return exactCurrentFile ?? exactHistoricalFile ?? currentCategoryFile;
}

function findStructuredRule(record: PerformanceContractRecord, ruleRows: PerformanceRulePreset[]) {
  return ruleRows.find(
    (rule) =>
      rule.category === record.category &&
      (rule.currentVersion === record.ruleVersion || rule.name === record.ruleName)
  );
}

function findSignatureRuleOption(record: PerformanceContractRecord, ruleOptions: PerformanceSignatureRuleOption[]) {
  return ruleOptions.find(
    (rule) =>
      rule.category === record.category &&
      (rule.ruleVersion === record.ruleVersion || rule.ruleName === record.ruleName)
  );
}

function buildRuleContractBasis(
  record: PerformanceContractRecord,
  ruleRows: PerformanceRulePreset[],
  ruleOptions: PerformanceSignatureRuleOption[]
): PerformanceContractRuleBasis {
  const structuredRule = findStructuredRule(record, ruleRows);

  if (structuredRule) {
    return {
      applicablePositions: structuredRule.applicablePositions,
      ruleId: structuredRule.id,
      ruleName: structuredRule.name,
      ruleSource: '结构化规则' as const,
      ruleStatus: structuredRule.status,
      ruleVersion: structuredRule.currentVersion
    };
  }

  const signatureRule = findSignatureRuleOption(record, ruleOptions);

  if (signatureRule) {
    return {
      applicablePositions: signatureRule.applicablePositions,
      ruleId: signatureRule.id,
      ruleName: signatureRule.ruleName,
      ruleSource: '签署规则选项' as const,
      ruleStatus: '已发布' as const,
      ruleVersion: signatureRule.ruleVersion
    };
  }

  return {
    applicablePositions: [] as string[],
    ruleName: record.ruleName,
    ruleSource: '未匹配' as const,
    ruleStatus: undefined,
    ruleVersion: record.ruleVersion
  };
}

export function resolvePerformanceExecutionContract({
  record,
  ruleOptions,
  ruleRows,
  signatureEmployees
}: ResolvePerformanceExecutionContractInput): PerformanceExecutionContract {
  const signatureFile = findSignatureFile(record, signatureEmployees);
  const rule = buildRuleContractBasis(record, ruleRows, ruleOptions);
  const isVersionMatched = Boolean(signatureFile && signatureFile.ruleVersion === record.ruleVersion);
  const isPositionMatched = rule.applicablePositions.includes(record.position);
  let status: PerformanceExecutionContract['status'] = '已匹配';
  let note = '绩效结果已匹配当前规则适用范围和员工签署关系。';

  if (!signatureFile) {
    status = '缺少签署';
    note = '该员工和绩效类别缺少可回溯的签署文件。';
  } else if (rule.ruleSource === '未匹配') {
    status = '规则未配置';
    note = '绩效结果中的规则版本未匹配到结构化规则或签署规则选项。';
  } else if (rule.ruleStatus !== '已发布') {
    status = '规则未发布';
    note = '绩效结果中的规则版本不是已发布规则。';
  } else if (!isPositionMatched) {
    status = '岗位不适用';
    note = '员工岗位不在该绩效规则的适用范围内。';
  } else if (!isVersionMatched) {
    status = '签署版本不一致';
    note = '绩效结果版本与员工当前或历史签署文件版本不一致。';
  }

  return {
    applicablePositions: rule.applicablePositions,
    category: record.category,
    note,
    position: record.position,
    ruleId: rule.ruleId,
    ruleName: rule.ruleName,
    ruleSource: rule.ruleSource,
    ruleVersion: rule.ruleVersion,
    signedAt: signatureFile?.signedAt,
    signedFileId: signatureFile?.id,
    signedFileName: signatureFile?.fileName,
    signedRuleName: signatureFile?.ruleName,
    signedRuleVersion: signatureFile?.ruleVersion,
    status,
    workNo: record.workNo
  };
}

export function attachPerformanceExecutionContracts<TRecord extends PerformanceContractRecord>({
  records,
  ruleOptions,
  ruleRows,
  signatureEmployees
}: Omit<ResolvePerformanceExecutionContractInput, 'record'> & { records: TRecord[] }): TRecord[] {
  return records.map((record) => ({
    ...record,
    executionContract: resolvePerformanceExecutionContract({
      record,
      ruleOptions,
      ruleRows,
      signatureEmployees
    })
  }));
}
