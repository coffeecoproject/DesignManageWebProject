import {
  AuditOutlined,
  BankOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  PercentageOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { TagChipList } from '../../components/TagChip';
import {
  taxPolicyGroupTone,
  taxPolicyOverview,
  taxPolicyRules,
  taxPolicyStatusTone,
  type TaxPolicyCalculationRule,
  type TaxPolicyGroup,
  type TaxPolicyParameter,
  type TaxPolicyRule,
  type TaxPolicyVersionRecord
} from './taxPolicyData';

const taxPolicyGroups: TaxPolicyGroup[] = ['经营税费', '人员税费', '合同税费'];

const taxPolicyIconMap: Record<string, JSX.Element> = {
  'tax-policy-vat-surcharge': <PercentageOutlined />,
  'tax-policy-cit': <BankOutlined />,
  'tax-policy-six-taxes-two-fees': <SafetyCertificateOutlined />,
  'tax-policy-stamp': <FileProtectOutlined />,
  'tax-policy-iit': <AuditOutlined />
};

const parameterColumns: TableColumnsType<TaxPolicyParameter> = [
  {
    dataIndex: 'label',
    key: 'label',
    title: '参数',
    width: 180
  },
  {
    dataIndex: 'value',
    key: 'value',
    title: '当前口径'
  }
];

const calculationColumns: TableColumnsType<TaxPolicyCalculationRule> = [
  {
    dataIndex: 'name',
    key: 'name',
    title: '项目',
    width: 150
  },
  {
    dataIndex: 'basis',
    key: 'basis',
    title: '依据'
  },
  {
    dataIndex: 'result',
    key: 'result',
    title: '结果'
  }
];

const versionColumns: TableColumnsType<TaxPolicyVersionRecord> = [
  {
    dataIndex: 'version',
    key: 'version',
    title: '版本',
    width: 120
  },
  {
    dataIndex: 'changedAt',
    key: 'changedAt',
    title: '生效时间',
    width: 150
  },
  {
    dataIndex: 'changeSummary',
    key: 'changeSummary',
    title: '变更内容'
  }
];

function getTaxPolicyIcon(rule: TaxPolicyRule) {
  return taxPolicyIconMap[rule.id] ?? <FileSearchOutlined />;
}

function TaxPolicyCard({ rule, onOpen }: { rule: TaxPolicyRule; onOpen: (rule: TaxPolicyRule) => void }) {
  return (
    <button className="tax-policy-rule-card" data-group={rule.group} type="button" onClick={() => onOpen(rule)}>
      <span className="tax-policy-rule-icon">{getTaxPolicyIcon(rule)}</span>
      <span className="tax-policy-rule-main">
        <span className="tax-policy-rule-title-row">
          <span className="tax-policy-rule-title">{rule.title}</span>
          <StatusTag toneMap={taxPolicyStatusTone} value={rule.status} variant="compact" />
        </span>
        <span className="tax-policy-rule-sub">{rule.region} / {rule.taxpayerScope}</span>
        {rule.primaryStatement ? <span className="tax-policy-rule-primary">{rule.primaryStatement}</span> : null}
        <span className="tax-policy-rule-metrics">
          {rule.metrics.map((metric) => (
            <span className="tax-policy-rule-metric" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </span>
          ))}
        </span>
        <span className="tax-policy-rule-modules">
          <TagChipList items={rule.usedModules} maxVisible={3} overflowVariant="compact-overflow" variant="compact" />
        </span>
      </span>
    </button>
  );
}

function TaxPolicyDrawer({ rule, onClose }: { rule?: TaxPolicyRule; onClose: () => void }) {
  const items = rule
    ? [
        {
          children: (
            <div className="drawer-detail-stack">
              <DetailSection icon={<FileSearchOutlined />} title="基础口径">
                <DetailInfoGrid
                  columns={3}
                  items={[
                    { label: '税务事项', value: rule.title },
                    { label: '税费分组', value: <StatusTag toneMap={taxPolicyGroupTone} value={rule.group} /> },
                    { label: '当前状态', value: <StatusTag toneMap={taxPolicyStatusTone} value={rule.status} /> },
                    { label: '适用地区', value: rule.region },
                    { label: '适用范围', value: rule.taxpayerScope },
                    { label: '申报周期', value: rule.declarationCycle },
                    { label: '生效区间', value: rule.effectivePeriod },
                    { label: '办理入口', value: rule.officialChannel },
                    {
                      label: '使用模块',
                      value: <TagChipList items={rule.usedModules} maxVisible={5} overflowVariant="compact-overflow" variant="compact" wrap />,
                      wide: true
                    }
                  ]}
                />
              </DetailSection>
              <DetailSection icon={<PercentageOutlined />} title="参数口径">
                <CompactDetailTable<TaxPolicyParameter>
                  columns={parameterColumns}
                  dataSource={rule.parameters}
                  rowKey={(record) => record.label}
                  scrollX={false}
                />
              </DetailSection>
            </div>
          ),
          key: 'parameters',
          label: '口径参数'
        },
        {
          children: (
            <DetailSection icon={<SafetyCertificateOutlined />} title="计算口径">
              <CompactDetailTable<TaxPolicyCalculationRule>
                columns={calculationColumns}
                dataSource={rule.calculationRules}
                rowKey={(record) => `${record.name}-${record.basis}`}
                scrollX={760}
              />
            </DetailSection>
          ),
          key: 'calculation',
          label: '计算口径'
        },
        {
          children: (
            <DetailSection icon={<CalendarOutlined />} title="版本记录">
              <CompactDetailTable<TaxPolicyVersionRecord>
                columns={versionColumns}
                dataSource={rule.versionRecords}
                rowKey="id"
                scrollX={false}
              />
            </DetailSection>
          ),
          key: 'versions',
          label: '版本记录'
        }
      ]
    : [];

  return (
    <DetailDrawerShell
      bodyTestId="system-tax-policy-detail-drawer"
      className="system-tax-policy-drawer"
      closeAction={{ label: '关闭', onClick: onClose, testId: 'system-tax-policy-close-button' }}
      open={Boolean(rule)}
      title={
        <DetailDrawerTitle
          status={rule?.status}
          statusToneMap={taxPolicyStatusTone}
          subtitle={rule ? `系统管理 / 税务口径 / ${rule.group}` : '系统管理 / 税务口径'}
          title={rule?.title ?? '税务口径'}
        />
      }
      width={920}
      onClose={onClose}
    >
      {rule ? (
        <>
          <DetailSummaryCards
            columns={3}
            items={[
              {
                icon: getTaxPolicyIcon(rule),
                key: 'scope',
                label: '适用范围',
                value: rule.taxpayerScope
              },
              {
                icon: <CalendarOutlined />,
                key: 'cycle',
                label: '申报周期',
                value: rule.declarationCycle
              },
              {
                icon: <CheckCircleOutlined />,
                key: 'effective',
                label: '生效区间',
                value: rule.effectivePeriod
              }
            ]}
          />
          <DetailTabs items={items} tabTestIdPrefix="system-tax-policy-detail-tab" testId="system-tax-policy-detail-tabs" />
        </>
      ) : null}
    </DetailDrawerShell>
  );
}

export function SystemTaxPolicyPage() {
  const [activeRuleId, setActiveRuleId] = useState<string>();
  const activeRule = taxPolicyRules.find((rule) => rule.id === activeRuleId);
  const groupedRules = useMemo(
    () =>
      taxPolicyGroups
        .map((group) => ({
          group,
          rules: taxPolicyRules.filter((rule) => rule.group === group)
        }))
        .filter((item) => item.rules.length > 0),
    []
  );

  return (
    <ManagementPageScaffold
      pageId="system-tax-policy"
      metrics={
        <MetricGrid>
          <MetricCard icon={<BankOutlined />} label="适用地区" value={taxPolicyOverview.region} />
          <MetricCard icon={<SafetyCertificateOutlined />} label="纳税人类型" value={taxPolicyOverview.taxpayerType} />
          <MetricCard icon={<CalendarOutlined />} label="申报周期" value={taxPolicyOverview.declarationCycle} />
          <MetricCard icon={<CheckCircleOutlined />} label="口径状态" value={taxPolicyOverview.status} />
        </MetricGrid>
      }
    >
      <div className="tax-policy-board">
        <div className="tax-policy-group-list">
          {groupedRules.map(({ group, rules }) => (
            <section className="tax-policy-group-section" key={group}>
              <div className="tax-policy-group-head">
                <span>{group}</span>
                <StatusTag toneMap={taxPolicyGroupTone} value={group} variant="compact" />
              </div>
              <div className="tax-policy-card-grid">
                {rules.map((rule) => (
                  <TaxPolicyCard key={rule.id} rule={rule} onOpen={(nextRule) => setActiveRuleId(nextRule.id)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      <TaxPolicyDrawer rule={activeRule} onClose={() => setActiveRuleId(undefined)} />
    </ManagementPageScaffold>
  );
}
