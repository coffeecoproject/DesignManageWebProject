import {
  CheckCircleOutlined,
  EditOutlined,
  FileProtectOutlined,
  ProfileOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { Select, message } from 'antd';
import { useMemo, useState } from 'react';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { useTaskConfigState } from '../system/TaskConfigState';
import { PerformanceRuleDrawer } from './PerformanceRuleDrawer';
import { PerformanceRuleTable } from './PerformanceRuleTable';
import { usePerformanceRuleState } from './PerformanceRuleState';
import {
  applyPublishedRule,
  createDraftRuleFromCategory,
  defaultCreateRuleForm,
  defaultPerformanceRuleFilters,
  filterPerformanceRules,
  getNextRuleVersion,
  getPerformanceRuleFilterOptions,
  getPerformanceRuleMetrics,
  getRuleReviewBlockers,
  performanceRuleTypeOptions,
  publishPerformanceRule,
  rejectPerformanceRule,
  ruleCategoryOptions,
  submitRuleForReview,
  type PerformanceRuleFilters,
  type RuleCategoryFilter,
  type RuleDrawerAction,
  type RuleRelatedFileRecord,
  type RuleStatusFilter,
  type RuleTypeFilter
} from './performanceRuleModel';
import type { PerformanceRulePreset } from './performanceTypes';

export function PerformanceRulesPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const { taskConfigRows } = useTaskConfigState();
  const {
    deletePerformanceRule,
    performanceRuleRows: ruleRows,
    savePerformanceRule,
    setPerformanceRuleRows
  } = usePerformanceRuleState();
  const [filters, setFilters] = useState<PerformanceRuleFilters>(defaultPerformanceRuleFilters);
  const [selectedRule, setSelectedRule] = useState<PerformanceRulePreset | null>(null);
  const filterOptions = useMemo(() => getPerformanceRuleFilterOptions(ruleRows), [ruleRows]);
  const nextCreateVersion = useMemo(
    () => getNextRuleVersion(ruleRows),
    [ruleRows]
  );

  const filteredRules = useMemo(() => filterPerformanceRules(ruleRows, filters), [filters, ruleRows]);
  const metrics = useMemo(() => getPerformanceRuleMetrics(ruleRows), [ruleRows]);
  const selectedRuleIsPersisted = selectedRule ? ruleRows.some((rule) => rule.id === selectedRule.id) : false;

  function handleOpenCreateRule() {
    const category = defaultCreateRuleForm.category;
    const performanceType = defaultCreateRuleForm.performanceType;
    const templateRule = ruleRows.find(
      (rule) => rule.performanceType === performanceType && rule.category === category && rule.templateMode === '固定模块' && rule.taskScoreItems.length > 0
    );

    if (performanceRuleTypeOptions.some((option) => option.type === performanceType && option.disabled)) {
      void messageApi.warning('该绩效类型暂未开放');
      return;
    }

    if (ruleCategoryOptions.some((option) => option.category === category && option.disabled)) {
      void messageApi.warning('该绩效方案需要先新增后再创建规则');
      return;
    }

    if (!templateRule) {
      void messageApi.warning('当前绩效方案缺少可用配置，暂不能创建');
      return;
    }

    const nextRule = createDraftRuleFromCategory({
      category,
      files: [],
      performanceType,
      positions: [],
      sequence: ruleRows.length + 1,
      templateRule,
      version: nextCreateVersion
    });

    setSelectedRule(nextRule);
    void messageApi.info(`正在配置 ${nextRule.name}，保存草稿或提交审核后进入列表`);
  }

  function updateRuleRow(nextRule: PerformanceRulePreset) {
    savePerformanceRule(nextRule);
    setSelectedRule(nextRule);
  }

  function handleCloseRuleDrawer() {
    setSelectedRule(null);
  }

  function handlePreviewRuleFile(file: RuleRelatedFileRecord) {
    void messageApi.info(`${file.name} 预览仍为前端原型，未接入真实文件服务`);
  }

  function handleDownloadRuleFile(file: RuleRelatedFileRecord) {
    void messageApi.success(`${file.name} 下载请求已记录`);
  }

  function handleRuleAction(rule: PerformanceRulePreset, action: RuleDrawerAction) {
    if (action === 'deleteDraft') {
      if (rule.status !== '草稿') {
        void messageApi.warning('只有草稿规则可以删除');
        return;
      }

      deletePerformanceRule(rule.id);
      setSelectedRule(null);
      void messageApi.success('草稿规则已删除');
      return;
    }

    if (action === 'saveDraft') {
      const nextRule: PerformanceRulePreset = {
        ...rule,
        lastUpdatedAt: '2026-06-13',
        lastUpdatedBy: '李明'
      };
      updateRuleRow(nextRule);
      void messageApi.success(rule.status === '审核驳回' ? '已保存修改' : '已保存草稿配置');
      return;
    }

    if (action === 'submitReview') {
      const reviewBlockers = getRuleReviewBlockers(rule);

      if (reviewBlockers.length > 0) {
        void messageApi.warning(`请先补全：${reviewBlockers.join('、')}`);
        return;
      }

      const nextRule = submitRuleForReview(rule);
      updateRuleRow(nextRule);
      void messageApi.success(rule.status === '审核驳回' ? '已重新提交审核' : '已提交审核');
      return;
    }

    if (action === 'rejectReview') {
      const nextRule = rejectPerformanceRule(rule);
      updateRuleRow(nextRule);
      void messageApi.info('已驳回，规则可修改后重新提交审核');
      return;
    }

    if (action === 'approveReview') {
      const publishedRule = publishPerformanceRule(rule);

      setPerformanceRuleRows((currentRows) => applyPublishedRule(currentRows, publishedRule));
      setSelectedRule(publishedRule);
      void messageApi.success('审核通过并发布');
    }
  }

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      feedback={contextHolder}
      metrics={
        <MetricGrid columns={4}>
          <MetricCard icon={<ProfileOutlined />} label="规则预设" value={metrics.totalRules} />
          <MetricCard icon={<CheckCircleOutlined />} label="已发布规则" value={metrics.publishedRules} />
          <MetricCard icon={<FileProtectOutlined />} label="待审核" value={metrics.reviewingRules} />
          <MetricCard icon={<EditOutlined />} label="草稿/驳回" value={metrics.draftOrRejectedRules} />
        </MetricGrid>
      }
      filters={
        <FilterPanel>
          <FilterBar>
            <FilterField label="规则状态">
              <Select
                data-testid="performance-rule-status-filter"
                options={['全部', '草稿', '待审核', '审核驳回', '已发布', '停用'].map((status) => ({ label: status, value: status }))}
                value={filters.status}
                onChange={(status: RuleStatusFilter) => setFilters((current) => ({ ...current, status }))}
              />
            </FilterField>
            <FilterField label="绩效类型">
              <Select
                data-testid="performance-rule-type-filter"
                options={filterOptions.performanceTypes.map((performanceType) => ({ label: performanceType, value: performanceType }))}
                value={filters.performanceType}
                onChange={(performanceType: RuleTypeFilter) => setFilters((current) => ({ ...current, performanceType }))}
              />
            </FilterField>
            <FilterField label="绩效方案">
              <Select
                data-testid="performance-rule-category-filter"
                options={filterOptions.categories.map((category) => ({ label: category, value: category }))}
                value={filters.category}
                onChange={(category: RuleCategoryFilter) => setFilters((current) => ({ ...current, category }))}
              />
            </FilterField>
            <FilterField controlWidth="wide-select" label="适用岗位">
              <Select
                data-testid="performance-rule-position-filter"
                options={filterOptions.positions.map((position) => ({ label: position, value: position }))}
                value={filters.position}
                onChange={(position: string) => setFilters((current) => ({ ...current, position }))}
              />
            </FilterField>
            <KeywordFilter
              allowClear
              data-testid="performance-rule-keyword-input"
              placeholder="规则名称/岗位"
              prefix={<SearchOutlined />}
              value={filters.keyword}
              width="wide"
              onChange={(keyword) => setFilters((current) => ({ ...current, keyword }))}
            />
          </FilterBar>
        </FilterPanel>
      }
    >

        <PerformanceRuleTable records={filteredRules} onCreateRule={handleOpenCreateRule} onRowClick={setSelectedRule} />

        <PerformanceRuleDrawer
          canDeleteDraft={selectedRuleIsPersisted}
          rule={selectedRule}
          taskConfigRows={taskConfigRows}
          onClose={handleCloseRuleDrawer}
          onAction={handleRuleAction}
          onDownloadFile={handleDownloadRuleFile}
          onPreviewFile={handlePreviewRuleFile}
        />
    </ManagementPageScaffold>
  );
}
