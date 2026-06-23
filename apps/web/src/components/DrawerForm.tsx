import { useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import {
  DrawerShell,
  type DrawerAction,
  type DrawerFooterActionsProps,
  type DrawerShellProps
} from './DrawerShell';

export type DrawerFormMode = 'create' | 'edit';
export type ModeDrawerMode = 'create' | 'detail' | 'edit';

export type DrawerFormAction = DrawerAction;

type ModeDrawerDetailActions = {
  closeAction: DrawerFormAction;
  primaryAction?: DrawerFormAction;
  secondaryAction?: DrawerFormAction;
};

type ModeDrawerFormActions = {
  cancelAction: DrawerFormAction;
  primaryAction: DrawerFormAction;
  secondaryAction?: DrawerFormAction;
};

type DrawerFormGridProps = {
  children: ReactNode;
};

type DrawerFormFieldProps = {
  children: ReactNode;
  label: ReactNode;
  required?: boolean;
  wide?: boolean;
};

type DrawerFormShellProps = DrawerFooterActionsProps & {
  bodyTestId?: string;
  children: ReactNode;
  className?: string;
  detailActions?: ModeDrawerDetailActions;
  formActions?: ModeDrawerFormActions;
  layout?: 'detail' | 'plain';
  mode?: ModeDrawerMode;
  open: boolean;
  title: DrawerShellProps['title'];
  width?: DrawerShellProps['width'];
  onClose: () => void;
};

type DrawerFormStateOptions<TRecord, TForm> = {
  createForm: () => TForm;
  editForm: (record: TRecord) => TForm;
  onCancelEdit?: (record: TRecord) => void;
};

export type DrawerFormState<TRecord, TForm> = {
  cancel: () => void;
  close: () => void;
  form: TForm;
  isCreateMode: boolean;
  isEditMode: boolean;
  mode: DrawerFormMode | undefined;
  open: boolean;
  openCreate: () => void;
  openEdit: (record: TRecord) => void;
  record: TRecord | undefined;
  setForm: Dispatch<SetStateAction<TForm>>;
  updateForm: <K extends keyof TForm>(field: K, value: TForm[K]) => void;
};

type ModeDrawerStateOptions<TRecord, TForm> = {
  createForm: (record?: TRecord) => TForm;
  detailForm: (record: TRecord) => TForm;
  editForm?: (record: TRecord) => TForm;
};

export type ModeDrawerState<TRecord, TForm> = {
  backToDetail: () => void;
  cancel: () => void;
  close: () => void;
  form: TForm;
  isCreateMode: boolean;
  isDetailMode: boolean;
  isEditMode: boolean;
  mode: ModeDrawerMode | undefined;
  open: boolean;
  openCreate: (record?: TRecord) => void;
  openDetail: (record: TRecord) => void;
  openEdit: (record?: TRecord) => void;
  record: TRecord | undefined;
  setForm: Dispatch<SetStateAction<TForm>>;
  syncRecord: (record: TRecord) => void;
  updateForm: <K extends keyof TForm>(field: K, value: TForm[K]) => void;
};

export function DrawerFormShell({
  bodyTestId,
  cancelAction,
  children,
  className,
  closeAction,
  detailActions,
  formActions,
  layout = 'detail',
  mode,
  open,
  primaryAction,
  secondaryAction,
  title,
  width,
  onClose
}: DrawerFormShellProps) {
  const hasModeFooterActions = Boolean(mode && (detailActions || formActions));
  const resolvedCloseAction = hasModeFooterActions && mode === 'detail' ? detailActions?.closeAction : closeAction;
  const resolvedCancelAction = hasModeFooterActions && mode !== 'detail' ? formActions?.cancelAction : cancelAction;
  const resolvedSecondaryAction = hasModeFooterActions
    ? mode === 'detail'
      ? detailActions?.secondaryAction
      : formActions?.secondaryAction
    : secondaryAction;
  const resolvedPrimaryAction = hasModeFooterActions
    ? mode === 'detail'
      ? detailActions?.primaryAction
      : formActions?.primaryAction
    : primaryAction;

  return (
    <DrawerShell
      bodyTestId={bodyTestId}
      cancelAction={resolvedCancelAction}
      className={className}
      closeAction={resolvedCloseAction}
      contentLayout={layout}
      open={open}
      primaryAction={resolvedPrimaryAction}
      secondaryAction={resolvedSecondaryAction}
      title={title}
      width={width}
      onClose={onClose}
    >
      {children}
    </DrawerShell>
  );
}

export function DrawerFormGrid({ children }: DrawerFormGridProps) {
  return <div className="drawer-form-grid">{children}</div>;
}

export function DrawerFormField({ children, label, required, wide }: DrawerFormFieldProps) {
  return (
    <label className={wide ? 'drawer-form-field drawer-form-field-wide' : 'drawer-form-field'}>
      <span className="field-label">
        {label}
        {required ? ' *' : null}
      </span>
      {children}
    </label>
  );
}

export function useDrawerFormState<TRecord, TForm>({
  createForm,
  editForm,
  onCancelEdit
}: DrawerFormStateOptions<TRecord, TForm>): DrawerFormState<TRecord, TForm> {
  const [mode, setMode] = useState<DrawerFormMode>();
  const [record, setRecord] = useState<TRecord>();
  const [form, setForm] = useState<TForm>(() => createForm());
  const open = Boolean(mode);

  function openCreate() {
    setRecord(undefined);
    setForm(createForm());
    setMode('create');
  }

  function openEdit(nextRecord: TRecord) {
    setRecord(nextRecord);
    setForm(editForm(nextRecord));
    setMode('edit');
  }

  function close() {
    setRecord(undefined);
    setMode(undefined);
  }

  function cancel() {
    if (mode === 'edit' && record) {
      onCancelEdit?.(record);
    }

    close();
  }

  function updateForm<K extends keyof TForm>(field: K, value: TForm[K]) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  return {
    cancel,
    close,
    form,
    isCreateMode: mode === 'create',
    isEditMode: mode === 'edit',
    mode,
    open,
    openCreate,
    openEdit,
    record,
    setForm,
    updateForm
  };
}

export function useModeDrawerState<TRecord, TForm>({
  createForm,
  detailForm,
  editForm
}: ModeDrawerStateOptions<TRecord, TForm>): ModeDrawerState<TRecord, TForm> {
  const [mode, setMode] = useState<ModeDrawerMode>();
  const [record, setRecord] = useState<TRecord>();
  const [form, setForm] = useState<TForm>(() => createForm());
  const open = Boolean(mode);

  function openCreate(nextRecord?: TRecord) {
    setRecord(nextRecord);
    setForm(createForm(nextRecord));
    setMode('create');
  }

  function openDetail(nextRecord: TRecord) {
    setRecord(nextRecord);
    setForm(detailForm(nextRecord));
    setMode('detail');
  }

  function openEdit(nextRecord?: TRecord) {
    const targetRecord = nextRecord ?? record;

    if (!targetRecord) {
      return;
    }

    setRecord(targetRecord);
    setForm((editForm ?? detailForm)(targetRecord));
    setMode('edit');
  }

  function close() {
    setRecord(undefined);
    setMode(undefined);
  }

  function backToDetail() {
    if (!record) {
      close();
      return;
    }

    setForm(detailForm(record));
    setMode('detail');
  }

  function cancel() {
    if (mode === 'edit') {
      backToDetail();
      return;
    }

    close();
  }

  function syncRecord(nextRecord: TRecord) {
    setRecord(nextRecord);

    if (mode === 'detail') {
      setForm(detailForm(nextRecord));
    }
  }

  function updateForm<K extends keyof TForm>(field: K, value: TForm[K]) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  return {
    backToDetail,
    cancel,
    close,
    form,
    isCreateMode: mode === 'create',
    isDetailMode: mode === 'detail',
    isEditMode: mode === 'edit',
    mode,
    open,
    openCreate,
    openDetail,
    openEdit,
    record,
    setForm,
    syncRecord,
    updateForm
  };
}
