import {
  AuditOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  PartitionOutlined,
  ProfileOutlined
} from '@ant-design/icons';
import { Select } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import { TagChipList } from '../../components/TagChip';
import { CompactCell } from '../../components/TableCell';
import {
  accountingStatementTargetOptions,
  accountingStatementTargetTone,
  accountingSubjectSeedRows,
  accountingSubjectStatusTone,
  accountingSubjectTypeOptions,
  accountingSubjectTypeTone,
  buildAccountingSubjectMetrics,
  defaultAccountingSubjectFilters,
  matchesAccountingSubjectFilters,
  type AccountingAuxiliaryScope,
  type AccountingCashFlowActivity,
  type AccountingSubjectFilters,
  type AccountingSubjectRecord,
  type AccountingSubjectStatus,
  type AccountingSubjectType
} from './financeAccountingSubjectData';

const balanceDirectionTone = {
  借方: 'green',
  贷方: 'red'
} as const;

const accountingSubjectSourceTone = {
  内置规范: 'blue',
  企业明细: 'purple'
} as const;

const cashFlowActivityTone: Record<AccountingCashFlowActivity, 'blue' | 'green' | 'purple'> = {
  经营活动: 'green',
  投资活动: 'blue',
  筹资活动: 'purple'
};

function getCashFlowMappingText(record: AccountingSubjectRecord) {
  if (!record.cashFlowItem || !record.cashFlowActivity) {
    return {
      activity: '不参与',
      item: '不参与现金流量表'
    };
  }

  return {
    activity: record.cashFlowActivity,
    item: record.cashFlowItem
  };
}

function getAuxiliaryScopeTone(scope: AccountingAuxiliaryScope) {
  if (scope === '客户') return 'green';
  if (scope === '供应商') return 'red';
  if (scope === '员工') return 'blue';
  if (scope === '项目') return 'purple';
  if (scope === '税费') return 'amber';
  return 'gray';
}

function AccountingSubjectDetailDrawer({
  record,
  onClose
}: {
  record?: AccountingSubjectRecord;
  onClose: () => void;
}) {
  if (!record) {
    return null;
  }
  const cashFlowMapping = getCashFlowMappingText(record);

  return (
    <DetailDrawerShell
      bodyTestId="finance-accounting-subject-detail-drawer"
      className="finance-transaction-drawer"
      open={Boolean(record)}
      title={
        <DetailDrawerTitle
          status={record.status}
          statusToneMap={accountingSubjectStatusTone}
          subtitle={`${record.code} / ${record.type}`}
          title="会计科目详情"
        />
      }
      width={860}
      onClose={onClose}
    >
      <DetailSummaryCards
        columns={4}
        items={[
          { icon: <ProfileOutlined />, key: 'code', label: '科目编码', value: record.code },
          { icon: <PartitionOutlined />, key: 'type', label: '科目类别', value: record.type },
          { icon: <FileTextOutlined />, key: 'direction', label: '余额方向', value: record.balanceDirection },
          { icon: <FileProtectOutlined />, key: 'statement', label: '报表归属', value: record.statementTarget },
          { icon: <FileTextOutlined />, key: 'cashFlow', label: '现金流量', value: cashFlowMapping.activity }
        ]}
      />

      <DetailSection icon={<ProfileOutlined />} title="基础信息">
        <DetailInfoGrid
          columns={3}
          items={[
            { label: '科目名称', value: record.name },
            { label: '科目编码', value: record.code },
            { label: '科目类别', value: <StatusTag toneMap={accountingSubjectTypeTone} value={record.type} /> },
            { label: '余额方向', value: <StatusTag toneMap={balanceDirectionTone} value={record.balanceDirection} /> },
            { label: '科目来源', value: <StatusTag toneMap={accountingSubjectSourceTone} value={record.source} /> },
            { label: '报表归属', value: <StatusTag toneMap={accountingStatementTargetTone} value={record.statementTarget} /> },
            { label: '报表项目', value: record.reportItem },
            {
              label: '现金流量活动',
              value: record.cashFlowActivity ? <StatusTag toneMap={cashFlowActivityTone} value={record.cashFlowActivity} /> : '不参与'
            },
            { label: '现金流量项目', value: cashFlowMapping.item },
            { label: '状态', value: <StatusTag toneMap={accountingSubjectStatusTone} value={record.status} /> }
          ]}
        />
      </DetailSection>

      <DetailSection icon={<FileProtectOutlined />} title="使用口径">
        <DetailInfoGrid
          columns={2}
          items={[
            {
              label: '辅助核算',
              value: (
                <TagChipList
                  items={record.auxiliaryScopes}
                  tone={(scope) => getAuxiliaryScopeTone(scope as AccountingAuxiliaryScope)}
                  wrap
                />
              )
            },
            {
              label: '关联业务',
              value: <TagChipList emptyText="未直接关联" items={record.sourceLinks} tone="blue" wrap />
            },
            { label: '说明', value: record.note, wide: true }
          ]}
        />
      </DetailSection>

      <OperationRecordSection icon={<AuditOutlined />} records={record.operationRecords} title="操作记录" />
    </DetailDrawerShell>
  );
}

export function FinanceAccountingSubjectsPage() {
  const [filters, setFilters] = useState<AccountingSubjectFilters>(defaultAccountingSubjectFilters);
  const [activeSubjectId, setActiveSubjectId] = useState<string>();

  const rows = useMemo(
    () => accountingSubjectSeedRows.filter((record) => matchesAccountingSubjectFilters(record, filters)),
    [filters]
  );
  const metrics = useMemo(() => buildAccountingSubjectMetrics(accountingSubjectSeedRows), []);
  const activeRecord = useMemo(
    () => accountingSubjectSeedRows.find((record) => record.id === activeSubjectId),
    [activeSubjectId]
  );

  const columns: TableColumnsType<AccountingSubjectRecord> = [
    {
      title: '科目',
      key: 'subject',
      width: 220,
      render: (_, record) => (
        <CompactCell
          primary={`${record.code} ${record.name}`}
          secondary={record.source}
        />
      )
    },
    {
      title: '类别',
      dataIndex: 'type',
      width: 110,
      render: (type: AccountingSubjectType) => <StatusTag toneMap={accountingSubjectTypeTone} value={type} />
    },
    {
      title: '余额方向',
      dataIndex: 'balanceDirection',
      width: 104,
      render: (direction: AccountingSubjectRecord['balanceDirection']) => <StatusTag toneMap={balanceDirectionTone} value={direction} />
    },
    {
      title: '报表归属',
      key: 'statementTarget',
      width: 150,
      render: (_, record) => <CompactCell primary={record.statementTarget} secondary={record.reportItem} />
    },
    {
      title: '现金流量',
      key: 'cashFlow',
      width: 230,
      render: (_, record) => {
        const cashFlowMapping = getCashFlowMappingText(record);

        return <CompactCell primary={cashFlowMapping.activity} secondary={cashFlowMapping.item} />;
      }
    },
    {
      title: '辅助核算',
      dataIndex: 'auxiliaryScopes',
      width: 190,
      render: (scopes: AccountingAuxiliaryScope[]) => (
        <TagChipList
          items={scopes}
          maxVisible={3}
          tone={(scope) => getAuxiliaryScopeTone(scope as AccountingAuxiliaryScope)}
          wrap
        />
      )
    },
    {
      title: '关联业务',
      dataIndex: 'sourceLinks',
      width: 220,
      render: (sourceLinks: string[]) => <TagChipList emptyText="未直接关联" items={sourceLinks} maxVisible={3} tone="blue" wrap />
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 96,
      render: (status: AccountingSubjectStatus) => <StatusTag toneMap={accountingSubjectStatusTone} value={status} />
    }
  ];

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      metrics={
        <MetricGrid columns={5}>
          <MetricCard icon={<ProfileOutlined />} label="可记账科目" value={metrics.enabledCount} />
          <MetricCard icon={<PartitionOutlined />} label="内置规范" value={metrics.standardCount} />
          <MetricCard icon={<FileProtectOutlined />} label="资产负债表" value={metrics.balanceSheetCount} />
          <MetricCard icon={<FileTextOutlined />} label="利润表" value={metrics.profitStatementCount} />
          <MetricCard icon={<FileTextOutlined />} label="现金流映射" value={metrics.cashFlowMappedCount} />
        </MetricGrid>
      }
      filters={
        <FilterPanel>
          <FilterBar>
            <FilterField label="科目类别">
              <Select
                data-testid="finance-accounting-subject-type-filter"
                options={['全部', ...accountingSubjectTypeOptions].map((type) => ({ label: type, value: type }))}
                value={filters.type}
                onChange={(type) => setFilters((current) => ({ ...current, type }))}
              />
            </FilterField>
            <FilterField label="报表归属">
              <Select
                data-testid="finance-accounting-subject-statement-filter"
                options={['全部', ...accountingStatementTargetOptions].map((statementTarget) => ({ label: statementTarget, value: statementTarget }))}
                value={filters.statementTarget}
                onChange={(statementTarget) => setFilters((current) => ({ ...current, statementTarget }))}
              />
            </FilterField>
            <FilterField label="状态">
              <Select
                data-testid="finance-accounting-subject-status-filter"
                options={['全部', '启用', '停用'].map((status) => ({ label: status, value: status }))}
                value={filters.status}
                onChange={(status) => setFilters((current) => ({ ...current, status }))}
              />
            </FilterField>
            <KeywordFilter
              data-testid="finance-accounting-subject-keyword-input"
              placeholder="编码 / 名称 / 报表项目 / 现金流量 / 关联业务"
              value={filters.keyword}
              width="wide"
              onChange={(keyword) => setFilters((current) => ({ ...current, keyword }))}
            />
          </FilterBar>
        </FilterPanel>
      }
      pageId="finance-accounting-subjects"
    >
      <ManagementTable<AccountingSubjectRecord>
        columns={columns}
        count={{ value: rows.length, unit: '个科目' }}
        dataSource={rows}
        rowKey="id"
        rowTestIdPrefix="finance-accounting-subject-table-row"
        tableTestId="finance-accounting-subject-table"
        onRowClick={(record) => setActiveSubjectId(record.id)}
      />

      <AccountingSubjectDetailDrawer
        record={activeRecord}
        onClose={() => setActiveSubjectId(undefined)}
      />
    </ManagementPageScaffold>
  );
}
