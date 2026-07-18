import { FileProtectOutlined, FileTextOutlined, HistoryOutlined, SearchOutlined, TeamOutlined } from '@ant-design/icons';
import { Select, message } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useMemo, useState } from 'react';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import {
  type PerformanceEmployeeSignatureArchive,
  type PerformanceSignatureFile
} from './performanceSignatureArchiveData';
import { PerformanceSignatureCreateDrawer } from './PerformanceSignatureCreateDrawer';
import { PerformanceSignatureDrawer } from './PerformanceSignatureDrawer';
import { PerformanceSignatureListTabs } from './PerformanceSignatureListTabs';
import { usePerformanceRuleState } from './PerformanceRuleState';
import {
  addPerformanceSignatureArchive,
  archivePerformanceSignatureRelation,
  buildPerformanceSignatureRuleOptions,
  buildSignatureCreateForm,
  defaultPerformanceSignatureFilters,
  filterPerformanceSignatureRows,
  getCurrentCategories,
  getInitialSignatureEmployees,
  getPerformanceSignatureFilterOptions,
  getPerformanceSignatureMetrics,
  getRuleOption,
  getSelectedSignatureFileName,
  getSignatureRelationRows,
  updatePerformanceSignatureArchive,
  type PerformanceSignatureFileAction,
  type PerformanceSignatureFilters,
  type SignatureCategoryFilter,
  type SignatureCreateForm,
  type SignatureListTabKey,
  type SignatureRelationFilter
} from './performanceSignatureModel';
import type { PerformanceRuleCategory } from './performanceTypes';

export function PerformanceSignaturesPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const { performanceRuleRows } = usePerformanceRuleState();
  const ruleOptions = useMemo(() => buildPerformanceSignatureRuleOptions(performanceRuleRows), [performanceRuleRows]);
  const [filters, setFilters] = useState<PerformanceSignatureFilters>(defaultPerformanceSignatureFilters);
  const [employees, setEmployees] = useState<PerformanceEmployeeSignatureArchive[]>(() => getInitialSignatureEmployees());
  const [activeListTab, setActiveListTab] = useState<SignatureListTabKey>('current');
  const [selectedRelationId, setSelectedRelationId] = useState<string | null>(null);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [createForm, setCreateForm] = useState<SignatureCreateForm>(() =>
    buildSignatureCreateForm(getInitialSignatureEmployees(), ruleOptions)
  );

  const filterOptions = useMemo(() => getPerformanceSignatureFilterOptions(employees), [employees]);
  const metrics = useMemo(() => getPerformanceSignatureMetrics(employees), [employees]);
  const currentRelationRows = useMemo(() => getSignatureRelationRows(employees, '当前档案'), [employees]);
  const historyRelationRows = useMemo(() => getSignatureRelationRows(employees, '历史档案'), [employees]);
  const allRelationRows = useMemo(() => [...currentRelationRows, ...historyRelationRows], [currentRelationRows, historyRelationRows]);
  const selectedRelation = selectedRelationId ? allRelationRows.find((row) => row.id === selectedRelationId) ?? null : null;
  const activeRows = activeListTab === 'current' ? currentRelationRows : historyRelationRows;
  const filteredRelationRows = useMemo(() => filterPerformanceSignatureRows(activeRows, filters), [activeRows, filters]);

  function handleFileAction(action: PerformanceSignatureFileAction, file: PerformanceSignatureFile) {
    const actionText: Record<PerformanceSignatureFileAction, string> = {
      download: '下载',
      preview: '预览'
    };

    void messageApi.info(`${file.fileName} 的${actionText[action]}能力仍为前端原型`);
  }

  function updateEmployeeSignature(employeeId: string, updater: (employee: PerformanceEmployeeSignatureArchive) => PerformanceEmployeeSignatureArchive) {
    setEmployees((current) => current.map((employee) => (employee.id === employeeId ? updater(employee) : employee)));
  }

  function handleOpenCreateDrawer() {
    setCreateForm(buildSignatureCreateForm(employees, ruleOptions));
    setCreateDrawerOpen(true);
  }

  function handleCreateEmployeeChange(employeeId: string) {
    setCreateForm(buildSignatureCreateForm(employees, ruleOptions, employeeId));
  }

  function handleCreateRuleChange(ruleId: string) {
    setCreateForm((current) => ({ ...current, fileName: null, ruleId }));
  }

  function handleSelectCreateFile(file: UploadFile) {
    const employee = employees.find((item) => item.id === createForm.employeeId);
    const rule = getRuleOption(createForm.ruleId, ruleOptions);

    if (!employee || !rule) {
      return;
    }

    setCreateForm((current) => ({
      ...current,
      fileName: getSelectedSignatureFileName(file, `${employee.employeeName}_${rule.ruleName}_绩效签署文件.pdf`)
    }));
  }

  function handleSubmitCreateSignature() {
    const employee = employees.find((item) => item.id === createForm.employeeId);
    const rule = getRuleOption(createForm.ruleId, ruleOptions);

    if (!employee || !rule || !createForm.fileName) {
      void messageApi.warning('请选择员工、绩效规则版本和签署文件');
      return;
    }

    if (getCurrentCategories(employee).includes(rule.category)) {
      void messageApi.warning('该员工当前已存在该绩效类别，需在详情编辑中更新版本');
      return;
    }

    const result = addPerformanceSignatureArchive(employee, rule, createForm.fileName);
    const nextEmployees = employees.map((current) => (current.id === employee.id ? result.employee : current));

    updateEmployeeSignature(employee.id, () => result.employee);
    setActiveListTab('current');
    setCreateDrawerOpen(false);
    setCreateForm(buildSignatureCreateForm(nextEmployees, ruleOptions, employee.id));
    void messageApi.success('签署档案已新增');
  }

  function handleUpdateRelation(employeeId: string, category: PerformanceRuleCategory, ruleId: string, fileName: string) {
    const rule = getRuleOption(ruleId, ruleOptions);
    const employee = employees.find((item) => item.id === employeeId);

    if (!employee || !rule || rule.category !== category) {
      void messageApi.warning('请选择同一绩效类别下的规则版本');
      return;
    }

    const result = updatePerformanceSignatureArchive(employee, category, rule, fileName);

    updateEmployeeSignature(employeeId, () => result.employee);
    setActiveListTab('current');
    setSelectedRelationId(`${employeeId}-${result.file.id}`);
    void messageApi.success('签署档案已更新');
  }

  function handleArchiveRelation(employeeId: string, category: PerformanceRuleCategory) {
    const employee = employees.find((item) => item.id === employeeId);

    if (!employee) {
      return;
    }

    const nextEmployee = archivePerformanceSignatureRelation(employee, category);

    updateEmployeeSignature(employeeId, () => nextEmployee);
    setActiveListTab('history');
    void messageApi.success('签署文件已移入历史档案');
  }

  function handleAddRelation(employeeId: string, ruleId: string, fileName: string) {
    const rule = getRuleOption(ruleId, ruleOptions);
    const employee = employees.find((item) => item.id === employeeId);

    if (!employee || !rule) {
      return;
    }

    if (getCurrentCategories(employee).includes(rule.category)) {
      void messageApi.warning('该员工当前已存在该绩效类别，需在详情编辑中更新版本');
      return;
    }

    const result = addPerformanceSignatureArchive(employee, rule, fileName);

    updateEmployeeSignature(employeeId, () => result.employee);
    setActiveListTab('current');
    setSelectedRelationId(`${employeeId}-${result.file.id}`);
    void messageApi.success('签署档案已新增');
  }

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      feedback={contextHolder}
      metrics={
        <MetricGrid columns={4}>
          <MetricCard icon={<TeamOutlined />} label="员工数" value={metrics.employeeCount} />
          <MetricCard icon={<FileProtectOutlined />} label="当前档案" value={metrics.currentFileCount} />
          <MetricCard icon={<HistoryOutlined />} label="历史档案" value={metrics.historyFileCount} />
          <MetricCard icon={<FileTextOutlined />} label="绩效类别数" value={metrics.currentCategoryCount} />
        </MetricGrid>
      }
      filters={
        <FilterPanel>
          <FilterBar>
            <FilterField label="版本范围">
              <Select
                data-testid="performance-signature-relation-filter"
                options={['全部', '有历史版本'].map((relation) => ({ label: relation, value: relation }))}
                value={filters.relation}
                onChange={(relation: SignatureRelationFilter) => setFilters((current) => ({ ...current, relation }))}
              />
            </FilterField>
            <FilterField label="绩效类别">
              <Select
                data-testid="performance-signature-category-filter"
                options={filterOptions.categories.map((category) => ({ label: category, value: category }))}
                value={filters.category}
                onChange={(category: SignatureCategoryFilter) => setFilters((current) => ({ ...current, category }))}
              />
            </FilterField>
            <FilterField controlWidth="wide-select" label="岗位">
              <Select
                data-testid="performance-signature-position-filter"
                options={filterOptions.positions.map((position) => ({ label: position, value: position }))}
                value={filters.position}
                onChange={(position: string) => setFilters((current) => ({ ...current, position }))}
              />
            </FilterField>
            <KeywordFilter
              allowClear
              data-testid="performance-signature-keyword-input"
              placeholder="员工/规则/文件"
              prefix={<SearchOutlined />}
              value={filters.keyword}
              width="wide"
              onChange={(keyword) => setFilters((current) => ({ ...current, keyword }))}
            />
          </FilterBar>
        </FilterPanel>
      }
    >
      <PerformanceSignatureListTabs
        activeKey={activeListTab}
        records={filteredRelationRows}
        onChange={setActiveListTab}
        onCreateArchive={handleOpenCreateDrawer}
        onRowClick={(record) => setSelectedRelationId(record.id)}
      />

      <PerformanceSignatureDrawer
        relation={selectedRelation}
        ruleOptions={ruleOptions}
        onAddRelation={handleAddRelation}
        onArchiveRelation={handleArchiveRelation}
        onClose={() => setSelectedRelationId(null)}
        onFileAction={handleFileAction}
        onUpdateRelation={handleUpdateRelation}
      />

      <PerformanceSignatureCreateDrawer
        employees={employees}
        open={createDrawerOpen}
        ruleOptions={ruleOptions}
        value={createForm}
        onClose={() => setCreateDrawerOpen(false)}
        onEmployeeChange={handleCreateEmployeeChange}
        onFileSelect={handleSelectCreateFile}
        onRuleChange={handleCreateRuleChange}
        onSubmit={handleSubmitCreateSignature}
      />
    </ManagementPageScaffold>
  );
}
