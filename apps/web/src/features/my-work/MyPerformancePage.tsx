import {
  BarChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { StatusTag, type StatusTagTone } from '../../components/Detail';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { CellText, CompactCell } from '../../components/TableCell';
import { PerformanceResultDrawer } from '../performance/PerformanceResultDrawer';
import {
  getPerformanceEmployeeResponseDisplayStatus,
  type PerformanceEmployeeResponseDisplayStatus
} from '../performance/performanceResultResponseModel';
import type { PerformanceResultReadRecord } from '../performance/performanceTypes';
import { isMonthlyPerformanceResult } from '../performance/performanceResultModel';
import { usePerformanceResults } from '../performance/usePerformanceResults';
import { useMyWorkData } from './MyWorkShared';

const responseStatusTone = {
  已确认: 'green',
  已送达未反馈: 'gray',
  异议已处理: 'blue',
  待确认: 'amber',
  有异议: 'red'
} satisfies Record<PerformanceEmployeeResponseDisplayStatus, StatusTagTone>;

function getActionTimestamp() {
  return dayjs().format('YYYY-MM-DD HH:mm:ss');
}

function formatMoney(value: number) {
  return `${value.toLocaleString('zh-CN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2
  })} 元`;
}

function formatSignedMoney(value: number) {
  return value === 0 ? formatMoney(0) : `${value > 0 ? '+' : '-'}${formatMoney(Math.abs(value))}`;
}

function getResultAmount(readRecord: PerformanceResultReadRecord) {
  return isMonthlyPerformanceResult(readRecord.result)
    ? formatMoney(readRecord.result.monthlyAmount)
    : formatSignedMoney(readRecord.result.quarterDifferenceAmount);
}

export function MyPerformancePage() {
  const { member } = useMyWorkData();
  const {
    allResults,
    confirmEmployeeResult,
    getResultHistory,
    objectToEmployeeResult
  } = usePerformanceResults();
  const [selectedResultId, setSelectedResultId] = useState<string>();
  const actionTime = getActionTimestamp();
  const resultRows = useMemo(
    () =>
      member
        ? allResults.filter(
            ({ result }) =>
              result.employeeId === member.id
              && (result.lifecycleStatus === '已发布' || result.lifecycleStatus === '已结算')
          )
        : [],
    [allResults, member]
  );
  const selectedReadRecord = resultRows.find(({ result }) => result.id === selectedResultId) ?? null;
  const selectedHistory = selectedReadRecord
    ? getResultHistory(selectedReadRecord.result.resultKey)
    : [];
  const responseStatuses = resultRows.map(({ result }) =>
    getPerformanceEmployeeResponseDisplayStatus(result, actionTime)
  );
  const columns = useMemo<TableColumnsType<PerformanceResultReadRecord>>(
    () => [
      {
        title: '绩效周期',
        key: 'period',
        width: 150,
        render: (_, readRecord) => (
          <CompactCell
            primary={readRecord.result.period}
            secondary={readRecord.result.kind}
          />
        )
      },
      {
        title: '绩效规则',
        key: 'rule',
        width: 220,
        render: (_, readRecord) => (
          <CompactCell
            primary={readRecord.result.ruleNameSnapshot}
            secondary={readRecord.result.ruleVersion}
          />
        )
      },
      {
        align: 'right',
        title: '结果金额',
        key: 'amount',
        width: 150,
        render: (_, readRecord) => <CellText>{getResultAmount(readRecord)}</CellText>
      },
      {
        title: '反馈状态',
        key: 'response',
        width: 130,
        render: (_, readRecord) => {
          const status = getPerformanceEmployeeResponseDisplayStatus(readRecord.result, actionTime);

          return <StatusTag tone={responseStatusTone[status]} value={status} />;
        }
      },
      {
        title: '发布时间',
        key: 'publishedAt',
        width: 170,
        render: (_, readRecord) => <CellText>{readRecord.result.publishedAt}</CellText>
      }
    ],
    [actionTime]
  );

  if (!member) {
    return null;
  }

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      metrics={
        <MetricGrid columns={4}>
          <MetricCard icon={<BarChartOutlined />} label="绩效结果" value={resultRows.length} />
          <MetricCard
            icon={<ClockCircleOutlined />}
            label="待我反馈"
            value={responseStatuses.filter((status) => status === '待确认').length}
          />
          <MetricCard
            icon={<ExclamationCircleOutlined />}
            label="有异议"
            value={responseStatuses.filter((status) => status === '有异议').length}
          />
          <MetricCard
            icon={<CheckCircleOutlined />}
            label="最近周期"
            value={resultRows[0]?.result.period ?? '-'}
          />
        </MetricGrid>
      }
    >
      <ManagementTable<PerformanceResultReadRecord>
        columns={columns}
        count={{ unit: '条绩效结果', value: resultRows.length }}
        dataSource={resultRows}
        rowKey={(readRecord) => readRecord.result.id}
        rowTestIdPrefix="my-performance-result-row"
        tableTestId="my-performance-result-table"
        onRowClick={(readRecord) => setSelectedResultId(readRecord.result.id)}
      />

      <PerformanceResultDrawer
        actionTime={actionTime}
        audience="employee"
        employeeId={member.id}
        history={selectedHistory}
        readRecord={selectedReadRecord}
        onClose={() => setSelectedResultId(undefined)}
        onConfirm={() =>
          selectedReadRecord
            ? confirmEmployeeResult(selectedReadRecord.result.id, {
                employeeId: member.id,
                respondedAt: getActionTimestamp()
              })
            : { reason: '未选择绩效结果', success: false }
        }
        onObject={(objectionReason, evidenceFileIds) =>
          selectedReadRecord
            ? objectToEmployeeResult(selectedReadRecord.result.id, {
                employeeId: member.id,
                evidenceFileIds,
                objectionReason,
                respondedAt: getActionTimestamp()
              })
            : { reason: '未选择绩效结果', success: false }
        }
      />
    </ManagementPageScaffold>
  );
}
