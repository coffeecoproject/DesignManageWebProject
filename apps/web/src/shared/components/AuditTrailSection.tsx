import { AuditOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import { AuditTrailTable, type AuditTrailRecord } from './AuditTrailTable';
import { DetailSection } from './Detail';
import type { StatusTagTone } from './Detail';

export function AuditTrailSection({
  emptyText,
  icon = <AuditOutlined />,
  records,
  resultToneMap,
  scrollX,
  sourceToneMap,
  summaryTitle,
  title = '操作记录'
}: {
  emptyText?: string;
  icon?: ReactNode;
  records: AuditTrailRecord[];
  resultToneMap?: Partial<Record<string, StatusTagTone>>;
  scrollX?: number | false;
  sourceToneMap?: Partial<Record<string, StatusTagTone>>;
  summaryTitle?: string;
  title?: ReactNode;
}) {
  return (
    <DetailSection icon={icon} title={title}>
      <AuditTrailTable
        emptyText={emptyText}
        records={records}
        resultToneMap={resultToneMap}
        scrollX={scrollX}
        sourceToneMap={sourceToneMap}
        summaryTitle={summaryTitle}
      />
    </DetailSection>
  );
}
