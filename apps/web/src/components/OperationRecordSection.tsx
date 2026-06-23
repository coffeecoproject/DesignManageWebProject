import { AuditOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import { DetailSection } from './Detail';
import { OperationRecordTable, type OperationRecord } from './OperationRecordTable';

export function OperationRecordSection({
  emptyText,
  icon = <AuditOutlined />,
  records,
  scrollX,
  title = '操作记录'
}: {
  emptyText?: string;
  icon?: ReactNode;
  records: OperationRecord[];
  scrollX?: number | false;
  title?: ReactNode;
}) {
  return (
    <DetailSection icon={icon} title={title}>
      <OperationRecordTable emptyText={emptyText} records={records} scrollX={scrollX} />
    </DetailSection>
  );
}
