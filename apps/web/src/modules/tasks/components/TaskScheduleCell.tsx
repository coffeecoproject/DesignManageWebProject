import { StatusTag } from '../../../shared/components/Detail';
import { CompactCell } from '../../../shared/components/TableCell';
import { formatTaskDuration, type StoreTaskRecord } from '../TaskManagementState';
import { isTaskOverdue } from '../taskDisplayModel';

type TaskScheduleCellProps = {
  showOverdueTag?: boolean;
  task: StoreTaskRecord;
};

export function TaskScheduleCell({ showOverdueTag = true, task }: TaskScheduleCellProps) {
  const overdue = isTaskOverdue(task);

  return (
    <CompactCell
      align="center"
      primary={formatTaskDuration(task.plannedDurationHours)}
      secondaryTone={overdue ? 'risk' : 'subtle'}
      secondarySlot={
        <>
          {task.plannedDeliveryAt}
          {showOverdueTag && overdue ? <StatusTag tone="amber" value="逾期" /> : null}
        </>
      }
    />
  );
}
