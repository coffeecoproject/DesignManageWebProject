import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, InputNumber, Select, Switch } from 'antd';
import type { TableColumnsType } from 'antd';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { StatusTag, type StatusTagTone } from '../../components/Detail';
import { CellText, CompactCell } from '../../components/TableCell';
import type { PerformanceRulePreset, PerformanceTaskScoreItem } from '../performance/performanceTypes';
import type { TaskConfigRow } from '../system/TaskConfigState';
import type { BrandPricingContract } from './brandTaskPricingModel';
import {
  getTaskConfigName,
  type BrandTaskDisplayRow,
  type BrandTaskFormDisplayRow
} from './brandFormModel';
import { CustomerTagList } from './CustomerShared';

type BrandContractUsageRow = {
  contractAmount: number;
  contractCode: string;
  contractId: string;
  contractName: string;
  overageAmount: number;
  remainingAmount: number;
  settledAmount: number;
  status: '正常' | '接近上限' | '已超出';
};

const contractUsageStatusTone = {
  '正常': 'green',
  '接近上限': 'amber',
  '已超出': 'red'
} satisfies Record<BrandContractUsageRow['status'], StatusTagTone>;

function formatMoney(value: number) {
  return `${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 元`;
}

const taskConfigColumns: TableColumnsType<BrandTaskDisplayRow> = [
  {
    title: '关联任务',
    key: 'name',
    width: 160,
    render: (_, record) => <CompactCell primary={record.name} secondary={record.category} />
  },
  {
    title: '绩效分值',
    key: 'score',
    align: 'center',
    width: 130,
    render: (_, record) => `${record.score} 分 / ${record.unit}`
  },
  {
    title: '结算方式',
    key: 'billing',
    align: 'center',
    width: 130,
    render: (_, record) => (record.billable ? `${record.unitPrice.toLocaleString('zh-CN')} 元` : '不计费')
  },
  {
    title: '依据合同',
    dataIndex: 'contractName',
    width: 180
  }
];

export function BrandTaskConfigSummary({ rows }: { rows: BrandTaskDisplayRow[] }) {
  if (rows.length === 0) {
    return <CellText tone="subtle">未选择</CellText>;
  }

  return (
    <CompactCell
      align="center"
      primary={`已选择 ${rows.length} 项`}
      secondarySlot={<CustomerTagList items={rows.map((row) => row.name)} maxVisible={1} />}
    />
  );
}

export function BrandTaskConfigTable({ rows }: { rows: BrandTaskDisplayRow[] }) {
  if (rows.length === 0) {
    return <CellText tone="subtle">该品牌暂未选择适用任务，后续创建任务前需要先补充。</CellText>;
  }

  return (
    <CompactDetailTable<BrandTaskDisplayRow>
      className="brand-task-config-table"
      columns={taskConfigColumns}
      dataSource={rows}
      rowKey="id"
      scrollX={760}
    />
  );
}

export function BrandContractUsageTable({ rows }: { rows: BrandContractUsageRow[] }) {
  const columns: TableColumnsType<BrandContractUsageRow> = [
    {
      title: '依据合同',
      key: 'contract',
      width: 220,
      render: (_, record) => <CompactCell primary={record.contractName} secondary={record.contractCode} />
    },
    {
      title: '合同金额',
      dataIndex: 'contractAmount',
      align: 'right',
      width: 150,
      render: formatMoney
    },
    {
      title: '已结算',
      dataIndex: 'settledAmount',
      align: 'right',
      width: 150,
      render: formatMoney
    },
    {
      title: '剩余额度',
      key: 'remainingAmount',
      align: 'right',
      width: 160,
      render: (_, record) => record.overageAmount > 0
        ? <CellText tone="risk">超出 {formatMoney(record.overageAmount)}</CellText>
        : formatMoney(record.remainingAmount)
    },
    {
      title: '状态',
      dataIndex: 'status',
      align: 'center',
      width: 120,
      render: (status: BrandContractUsageRow['status']) => (
        <StatusTag toneMap={contractUsageStatusTone} value={status} />
      )
    }
  ];

  return (
    <CompactDetailTable<BrandContractUsageRow>
      className="brand-task-contract-usage-table"
      columns={columns}
      dataSource={rows}
      rowKey="contractId"
      scrollX={800}
    />
  );
}

export function BrandTaskConfigEditor({
  addableTaskScoreItems,
  eligibleContracts,
  performanceRule,
  rows,
  selectedTaskConfigId,
  taskConfigRows,
  onAdd,
  onPricingChange,
  onRemove,
  onSelectTaskConfig
}: {
  addableTaskScoreItems: PerformanceTaskScoreItem[];
  eligibleContracts: BrandPricingContract[];
  performanceRule: PerformanceRulePreset | undefined;
  rows: BrandTaskFormDisplayRow[];
  selectedTaskConfigId: string | undefined;
  taskConfigRows: TaskConfigRow[];
  onAdd: () => void;
  onPricingChange: (
    taskConfigId: string,
    patch: Partial<Pick<BrandTaskFormDisplayRow, 'billable' | 'contractId' | 'unitPrice'>>
  ) => void;
  onRemove: (taskConfigId: string) => void;
  onSelectTaskConfig: (taskConfigId: string) => void;
}) {
  const editorColumns: TableColumnsType<BrandTaskFormDisplayRow> = [
    {
      title: '关联任务',
      key: 'name',
      width: 170,
      render: (_, record) => <CompactCell primary={record.name} secondary={record.category} />
    },
    {
      title: '绩效分值',
      key: 'score',
      align: 'center',
      width: 130,
      render: (_, record) => `${record.score} 分 / ${record.unit}`
    },
    {
      title: '计费',
      key: 'billable',
      align: 'center',
      width: 86,
      render: (_, record) => (
        <Switch
          checked={record.billable}
          checkedChildren="是"
          unCheckedChildren="否"
          onChange={(billable) => onPricingChange(record.taskConfigId, { billable })}
        />
      )
    },
    {
      title: '结算单价',
      key: 'unitPrice',
      width: 150,
      render: (_, record) => (
        <InputNumber
          controls={false}
          disabled={!record.billable}
          min={0.01}
          precision={2}
          prefix="¥"
          value={record.unitPrice || undefined}
          onChange={(unitPrice) => onPricingChange(record.taskConfigId, { unitPrice: unitPrice ?? 0 })}
        />
      )
    },
    {
      title: '依据合同',
      key: 'contractId',
      width: 210,
      render: (_, record) => (
        <Select
          disabled={!record.billable}
          placeholder="选择有效合同"
          value={record.contractId}
          options={eligibleContracts.map((contract) => ({
            label: `${contract.code} / ${contract.name}`,
            value: contract.id
          }))}
          onChange={(contractId) => onPricingChange(record.taskConfigId, { contractId })}
        />
      )
    },
    {
      title: '操作',
      key: 'action',
      align: 'center',
      width: 88,
      render: (_, record) => (
        <Button danger icon={<DeleteOutlined />} size="small" type="text" onClick={() => onRemove(record.taskConfigId)}>
          移除
        </Button>
      )
    }
  ];

  return (
    <div className="brand-task-config-editor">
      <div className="brand-task-config-editor__toolbar">
        <CellText tone="subtle">当前已选择 {rows.length} 项</CellText>
        <div className="brand-task-config-editor__actions">
          <Select
            className="brand-task-config-editor__select"
            disabled={!performanceRule || addableTaskScoreItems.length === 0}
            placeholder={performanceRule ? (addableTaskScoreItems.length > 0 ? '选择任务类型' : '暂无可添加任务') : '先选择绩效方案'}
            value={selectedTaskConfigId}
            options={addableTaskScoreItems.map((taskScoreItem) => ({
              label: getTaskConfigName(taskScoreItem.taskConfigId, taskConfigRows),
              value: taskScoreItem.taskConfigId
            }))}
            onChange={onSelectTaskConfig}
          />
          <Button disabled={!selectedTaskConfigId} icon={<PlusOutlined />} onClick={onAdd}>
            添加任务类型
          </Button>
        </div>
      </div>
      {rows.length > 0 ? (
        <CompactDetailTable<BrandTaskFormDisplayRow>
          className="brand-task-config-table"
          columns={editorColumns}
          dataSource={rows}
          rowKey="taskConfigId"
          scrollX={980}
        />
      ) : (
        <div className="brand-task-config-editor__empty">
          <CellText>暂未选择适用任务</CellText>
          <CellText tone="subtle">从已绑定绩效方案中添加任务；任务分值只读。</CellText>
        </div>
      )}
    </div>
  );
}
