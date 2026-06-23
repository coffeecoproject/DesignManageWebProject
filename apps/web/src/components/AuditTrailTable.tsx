import type { TableColumnsType } from 'antd';
import { CompactDetailTable } from './CompactDetailTable';
import { StatusTag } from './Detail';
import type { StatusTagTone } from './Detail';
import { CellText } from './TableCell';

export type AuditTrailRecord = {
  action: string;
  actor: string;
  id?: string;
  note?: string;
  object: string;
  result: string;
  source: string;
  summary: string;
  time: string;
};

const auditTrailResultTone: Partial<Record<string, StatusTagTone>> = {
  成功: 'green',
  草稿: 'gray',
  待生效: 'amber',
  已生效: 'green',
  已作废: 'gray',
  已冲正: 'purple'
};

const auditTrailSourceTone: Partial<Record<string, StatusTagTone>> = {
  人员总览: 'blue',
  人员档案: 'green',
  人事异动: 'blue',
  岗位管理: 'purple',
  权限角色: 'amber',
  系统生成: 'gray',
  冲正: 'amber'
};

function getActorTone(actor: string): StatusTagTone {
  return actor.includes('系统') ? 'gray' : 'blue';
}

function buildAuditTrailColumns({
  resultToneMap,
  summaryTitle = '变更摘要',
  sourceToneMap
}: {
  resultToneMap?: Partial<Record<string, StatusTagTone>>;
  summaryTitle?: string;
  sourceToneMap?: Partial<Record<string, StatusTagTone>>;
}): TableColumnsType<AuditTrailRecord> {
  const resolvedResultToneMap = { ...auditTrailResultTone, ...resultToneMap };
  const resolvedSourceToneMap = { ...auditTrailSourceTone, ...sourceToneMap };

  return [
    {
      title: '时间',
      dataIndex: 'time',
      align: 'center',
      width: 138
    },
    {
      title: '操作人',
      dataIndex: 'actor',
      align: 'center',
      width: 108,
      render: (actor: string) => <StatusTag tone={getActorTone(actor)} value={actor} variant="compact" />
    },
    {
      title: '操作对象',
      dataIndex: 'object',
      width: 148,
      render: (object: string) => <CellText tone="default">{object}</CellText>
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      align: 'center',
      width: 118
    },
    {
      title: summaryTitle,
      dataIndex: 'summary',
      width: 220,
      render: (summary: string) => <span className="detail-table-sub">{summary}</span>
    },
    {
      title: '结果',
      dataIndex: 'result',
      align: 'center',
      width: 86,
      render: (result: string) => <StatusTag toneMap={resolvedResultToneMap} value={result} variant="compact" />
    },
    {
      title: '来源',
      dataIndex: 'source',
      align: 'center',
      width: 96,
      render: (source: string) => <StatusTag toneMap={resolvedSourceToneMap} value={source} variant="compact" />
    },
    {
      title: '备注',
      dataIndex: 'note',
      width: 160,
      render: (note?: string) => note || '-'
    }
  ];
}

export function AuditTrailTable({
  emptyText,
  records,
  resultToneMap,
  scrollX = 1074,
  summaryTitle,
  sourceToneMap
}: {
  emptyText?: string;
  records: AuditTrailRecord[];
  resultToneMap?: Partial<Record<string, StatusTagTone>>;
  scrollX?: number | false;
  summaryTitle?: string;
  sourceToneMap?: Partial<Record<string, StatusTagTone>>;
}) {
  return (
    <CompactDetailTable<AuditTrailRecord>
      className="audit-trail-table"
      columns={buildAuditTrailColumns({ resultToneMap, sourceToneMap, summaryTitle })}
      dataSource={records}
      emptyText={emptyText}
      rowKey={(record) => record.id ?? `${record.time}-${record.source}-${record.action}-${record.object}`}
      scrollX={scrollX}
    />
  );
}
