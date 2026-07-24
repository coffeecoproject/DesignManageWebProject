import {
  CalendarOutlined,
  FileProtectOutlined,
  ProfileOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UploadOutlined,
  WalletOutlined
} from '@ant-design/icons';
import { Button, DatePicker, Input, InputNumber, Select, Upload, message, type TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { MonthFilterField } from '../../components/DateFilterFields';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag, type StatusTagTone } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { FilePreviewModal } from '../../components/FilePreviewModal';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { ManagementTableTabs } from '../../components/ManagementTableTabs';
import { FilterBar, FilterPanel } from '../../components/FilterControls';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { CellText, CompactCell } from '../../components/TableCell';
import { RelatedFileTable, type RelatedFileRecord } from '../../components/RelatedFileTable';
import { usePeopleOrganizationState } from '../people/PeopleOrganizationState';
import type { PeopleMember } from '../people/peopleTypes';
import { useSalaryManagementState } from '../salary/SalaryManagementState';
import type { SalaryAdjustmentRecord } from '../salary/salaryDomain';
import { useFinanceCategoryState } from '../system/FinanceCategoryState';
import { buildPublicAccountRef, usePublicAccountConfigState } from '../system/PublicAccountConfigState';
import { useFinanceManagement } from './FinanceManagementState';
import { useFinanceSocialInsuranceState } from './FinanceSocialInsuranceState';
import {
  socialInsuranceHandlingStatusTone,
  type ContributionCorrectionRecord,
  type EnrollmentHandlingStatus,
  type SocialInsuranceCategory,
  type SocialInsuranceEmployeeRecord,
  type SocialInsuranceEnrollmentProfile
} from './financeSocialInsuranceData';
import {
  buildContributionCorrectionPaymentTransaction,
  buildContributionCorrectionRecord,
  buildSocialInsurancePaymentTransaction
} from './financeSocialInsuranceModel';
import { formatMoney } from './financeUtils';

type SocialInsuranceViewKey = 'enrollment' | 'monthly';

type EnrollmentRow = {
  member: PeopleMember;
  profile: SocialInsuranceEnrollmentProfile;
};

type MonthlyContributionBatchRow = {
  category: SocialInsuranceCategory;
  differenceCount: number;
  employerAmount: number;
  employeeAmount: number;
  id: string;
  participantCount: number;
  period: string;
  records: SocialInsuranceEmployeeRecord[];
  status: SocialInsuranceEmployeeRecord['handlingStatus'];
};

const enrollmentStatusTone: Record<EnrollmentHandlingStatus, StatusTagTone> = {
  待增员: 'amber',
  增员办理中: 'blue',
  已增员: 'green',
  待停保: 'amber',
  停保办理中: 'blue',
  已停保: 'gray',
  办理异常: 'red',
  不适用: 'gray'
};

const enrollmentStatusOrder: Record<EnrollmentHandlingStatus, number> = {
  办理异常: 0,
  待增员: 1,
  待停保: 1,
  增员办理中: 2,
  停保办理中: 2,
  已增员: 3,
  已停保: 3,
  不适用: 4
};

const monthlyStatusOrder: Record<SocialInsuranceEmployeeRecord['handlingStatus'], number> = {
  核定有差异: 0,
  欠缴待补: 1,
  待测算: 2,
  待申报: 3,
  待核定: 4,
  待确认: 5,
  待缴费: 6,
  已缴费: 7,
  无需缴纳: 8
};

function buildEnrollmentRows(peopleRows: PeopleMember[], profiles: SocialInsuranceEnrollmentProfile[]) {
  const peopleById = new Map(peopleRows.map((member) => [member.id, member]));

  return profiles
    .map((profile) => ({ member: peopleById.get(profile.personId), profile }))
    .filter((row): row is EnrollmentRow => Boolean(row.member))
    .sort((left, right) => {
      const leftStatus = Math.min(
        enrollmentStatusOrder[left.profile.socialSecurityStatus],
        enrollmentStatusOrder[left.profile.medicalInsuranceStatus]
      );
      const rightStatus = Math.min(
        enrollmentStatusOrder[right.profile.socialSecurityStatus],
        enrollmentStatusOrder[right.profile.medicalInsuranceStatus]
      );

      return leftStatus - rightStatus || left.member.id.localeCompare(right.member.id);
    });
}

function buildMonthlyBatches(records: SocialInsuranceEmployeeRecord[]) {
  const recordsByBatch = new Map<string, SocialInsuranceEmployeeRecord[]>();

  records.forEach((record) => {
    const key = `${record.period}/${record.category}`;
    recordsByBatch.set(key, [...(recordsByBatch.get(key) ?? []), record]);
  });

  return [...recordsByBatch.entries()]
    .map<MonthlyContributionBatchRow>(([id, batchRecords]) => {
      const sortedRecords = [...batchRecords].sort(
        (left, right) => monthlyStatusOrder[left.handlingStatus] - monthlyStatusOrder[right.handlingStatus]
      );
      const assessedEmployerAmount = batchRecords.reduce(
        (total, record) => total + (record.assessedEmployerAmount ?? 0),
        0
      );
      const assessedEmployeeAmount = batchRecords.reduce(
        (total, record) => total + (record.assessedEmployeeAmount ?? 0),
        0
      );

      return {
        category: batchRecords[0].category,
        differenceCount: batchRecords.filter((record) => record.handlingStatus === '核定有差异').length,
        employerAmount: assessedEmployerAmount,
        employeeAmount: assessedEmployeeAmount,
        id,
        participantCount: new Set(batchRecords.map((record) => record.employeeNo)).size,
        period: batchRecords[0].period,
        records: sortedRecords,
        status: sortedRecords[0].handlingStatus
      };
    })
    .sort((left, right) => right.period.localeCompare(left.period) || left.category.localeCompare(right.category));
}

function toRelatedFiles(fileIds: string[], type: string): RelatedFileRecord[] {
  return fileIds.map((fileId) => ({
    id: fileId,
    name: fileId,
    status: '已上传',
    type,
    updatedAt: dayjs().format('YYYY-MM-DD')
  }));
}

function EnrollmentDetailDrawer({
  row,
  onClose,
  onDownloadFile,
  onPreviewFile,
  onSave
}: {
  row?: EnrollmentRow;
  onClose: () => void;
  onDownloadFile: (file: RelatedFileRecord) => void;
  onPreviewFile: (file: RelatedFileRecord) => void;
  onSave: (profile: SocialInsuranceEnrollmentProfile) => boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    effectiveMonth: '',
    evidenceFileIds: [] as string[],
    insuredRegionCode: '420100',
    noObligationReason: '' as '' | SocialInsuranceEnrollmentProfile['noObligationReason'],
    obligation: '应参保' as SocialInsuranceEnrollmentProfile['obligation'],
    officialReferenceNo: ''
  });

  useEffect(() => {
    const profile = row?.profile;
    if (!profile) return;

    setEditing(false);
    setDraft({
      effectiveMonth: profile.socialSecurityStatus === '待停保' || profile.socialSecurityStatus === '停保办理中'
        ? profile.socialSecurityStopEffectiveMonth ?? profile.plannedStopMonth ?? ''
        : profile.socialSecurityEffectiveMonth ?? profile.plannedEnrollmentMonth ?? '',
      evidenceFileIds: profile.evidenceFileIds,
      insuredRegionCode: profile.insuredRegionCode ?? '420100',
      noObligationReason: profile.noObligationReason ?? '',
      obligation: profile.obligation,
      officialReferenceNo: profile.officialReferenceNo ?? ''
    });
  }, [row]);

  if (!row) {
    return null;
  }

  const { member, profile } = row;
  const latestEffectiveMonth = [profile.socialSecurityEffectiveMonth, profile.medicalInsuranceEffectiveMonth]
    .filter((month): month is string => Boolean(month))
    .sort()
    .at(-1);
  const isStopHandling = profile.socialSecurityStatus === '待停保' || profile.socialSecurityStatus === '停保办理中';
  const isDetermination = profile.obligation === '待判定';
  const canHandle = isDetermination || ['待增员', '增员办理中', '待停保', '停保办理中', '办理异常'].includes(profile.socialSecurityStatus);
  const actionLabel = isDetermination ? '登记参保结论' : isStopHandling ? '登记停保结果' : '登记增员结果';

  const save = () => {
    if (isDetermination) {
      if (draft.obligation === '待判定' || (draft.obligation === '无需参保' && !draft.noObligationReason)) return;

      const shouldEnroll = draft.obligation === '应参保';
      if (onSave({
        ...profile,
        obligation: draft.obligation,
        noObligationReason: shouldEnroll ? undefined : draft.noObligationReason || undefined,
        socialSecurityStatus: shouldEnroll ? '待增员' : '不适用',
        medicalInsuranceStatus: shouldEnroll ? '待增员' : '不适用',
        plannedEnrollmentMonth: shouldEnroll ? draft.effectiveMonth : undefined,
        updatedAt: dayjs().format('YYYY-MM-DD')
      })) setEditing(false);
      return;
    }

    if (!draft.effectiveMonth || !draft.officialReferenceNo.trim() || draft.evidenceFileIds.length === 0) return;

    if (onSave({
      ...profile,
      obligation: isStopHandling ? '无需参保' : '应参保',
      noObligationReason: isStopHandling ? '劳动关系已于此前结束' : undefined,
      insuredRegionCode: draft.insuredRegionCode,
      socialSecurityStatus: isStopHandling ? '已停保' : '已增员',
      medicalInsuranceStatus: isStopHandling ? '已停保' : '已增员',
      socialSecurityEffectiveMonth: isStopHandling ? profile.socialSecurityEffectiveMonth : draft.effectiveMonth,
      medicalInsuranceEffectiveMonth: isStopHandling ? profile.medicalInsuranceEffectiveMonth : draft.effectiveMonth,
      socialSecurityStopEffectiveMonth: isStopHandling ? draft.effectiveMonth : undefined,
      medicalInsuranceStopEffectiveMonth: isStopHandling ? draft.effectiveMonth : undefined,
      officialReferenceNo: draft.officialReferenceNo.trim(),
      evidenceFileIds: draft.evidenceFileIds,
      updatedAt: dayjs().format('YYYY-MM-DD')
    })) setEditing(false);
  };

  return (
    <DetailDrawerShell
      bodyTestId="social-insurance-enrollment-drawer"
      closeAction={editing ? undefined : { label: '关闭', onClick: onClose }}
      cancelAction={editing ? { label: '取消', onClick: () => setEditing(false) } : undefined}
      open
      primaryAction={canHandle ? {
        disabled: editing && (
          isDetermination
            ? draft.obligation === '待判定' || (draft.obligation === '无需参保' && !draft.noObligationReason)
            : !draft.effectiveMonth || !draft.officialReferenceNo.trim() || draft.evidenceFileIds.length === 0
        ),
        label: editing ? '保存办理结果' : actionLabel,
        onClick: () => editing ? save() : setEditing(true)
      } : undefined}
      title={
        <DetailDrawerTitle
          status={profile.obligation}
          statusTone={profile.obligation === '应参保' ? 'blue' : profile.obligation === '无需参保' ? 'gray' : 'amber'}
          subtitle={`${member.id} / ${member.employmentRelationshipType}`}
          title={member.name}
        />
      }
      width={780}
      onClose={onClose}
    >
      <DetailSummaryCards
        columns={3}
        items={[
          { icon: <SafetyCertificateOutlined />, key: 'social', label: '社保状态', value: profile.socialSecurityStatus },
          { icon: <SafetyCertificateOutlined />, key: 'medical', label: '医保状态', value: profile.medicalInsuranceStatus },
          { icon: <CalendarOutlined />, key: 'effective', label: '最近生效月份', value: latestEffectiveMonth }
        ]}
      />
      <DetailTabs
        items={[
          {
            key: 'handling',
            label: '办理信息',
            children: (
              <DetailSection icon={<ProfileOutlined />} title="参保办理">
                {editing ? (
                  <div className="drawer-form-grid">
                    {isDetermination ? (
                      <>
                        <label className="drawer-form-field">
                          <span>参保结论 *</span>
                          <Select
                            options={[{ label: '应参保', value: '应参保' }, { label: '无需参保', value: '无需参保' }]}
                            value={draft.obligation === '待判定' ? undefined : draft.obligation}
                            onChange={(obligation) => setDraft((current) => ({ ...current, obligation }))}
                          />
                        </label>
                        {draft.obligation === '无需参保' ? (
                          <label className="drawer-form-field">
                            <span>无需参保原因 *</span>
                            <Select
                              options={[
                                { label: '官方确认无需参保', value: '官方确认无需参保' },
                                { label: '独立劳务合作', value: '独立劳务合作' },
                                { label: '企业供应商', value: '企业供应商' }
                              ]}
                              value={draft.noObligationReason || undefined}
                              onChange={(noObligationReason) => setDraft((current) => ({ ...current, noObligationReason }))}
                            />
                          </label>
                        ) : (
                          <MonthFilterField
                            allowClear={false}
                            label="计划增员月份"
                            value={draft.effectiveMonth}
                            width={240}
                            onChange={(effectiveMonth) => setDraft((current) => ({ ...current, effectiveMonth }))}
                          />
                        )}
                      </>
                    ) : (
                      <>
                        <label className="drawer-form-field">
                          <span>参保地 *</span>
                          <Select
                            options={[{ label: '湖北省武汉市', value: '420100' }]}
                            value={draft.insuredRegionCode}
                            onChange={(insuredRegionCode) => setDraft((current) => ({ ...current, insuredRegionCode }))}
                          />
                        </label>
                        <MonthFilterField
                          allowClear={false}
                          label={isStopHandling ? '停保生效月份' : '增员生效月份'}
                          value={draft.effectiveMonth}
                          width={240}
                          onChange={(effectiveMonth) => setDraft((current) => ({ ...current, effectiveMonth }))}
                        />
                        <label className="drawer-form-field">
                          <span>办理编号 *</span>
                          <Input value={draft.officialReferenceNo} onChange={(event) => setDraft((current) => ({ ...current, officialReferenceNo: event.target.value }))} />
                        </label>
                        <label className="drawer-form-field">
                          <span>办理回执 *</span>
                          <Upload
                            beforeUpload={(file) => {
                              setDraft((current) => ({ ...current, evidenceFileIds: [...new Set([...current.evidenceFileIds, file.name])] }));
                              return false;
                            }}
                            fileList={[]}
                            showUploadList={false}
                          >
                            <Button icon={<UploadOutlined />}>选择文件</Button>
                          </Upload>
                        </label>
                      </>
                    )}
                  </div>
                ) : <DetailInfoGrid
                  columns={2}
                  items={[
                    { label: '劳动关系类型', value: member.employmentRelationshipType },
                    { label: '参保结论', value: profile.obligation },
                    { label: '无需参保原因', value: profile.noObligationReason },
                    { label: '参保地', value: profile.insuredRegionCode === '420100' ? '湖北省武汉市' : profile.insuredRegionCode },
                    { label: '社保办理状态', value: <StatusTag toneMap={enrollmentStatusTone} value={profile.socialSecurityStatus} /> },
                    { label: '医保办理状态', value: <StatusTag toneMap={enrollmentStatusTone} value={profile.medicalInsuranceStatus} /> },
                    { label: '计划增员月份', value: profile.plannedEnrollmentMonth },
                    { label: '社保生效月份', value: profile.socialSecurityEffectiveMonth },
                    { label: '医保生效月份', value: profile.medicalInsuranceEffectiveMonth },
                    { label: '计划停保月份', value: profile.plannedStopMonth },
                    { label: '社保停保生效月份', value: profile.socialSecurityStopEffectiveMonth },
                    { label: '医保停保生效月份', value: profile.medicalInsuranceStopEffectiveMonth },
                    { label: '办理编号', value: profile.officialReferenceNo },
                    { label: '回执文件', value: profile.evidenceFileIds.length > 0 ? `${profile.evidenceFileIds.length} 份` : '-' }
                  ]}
                />}
                {draft.evidenceFileIds.length > 0 ? (
                  <RelatedFileTable
                    records={toRelatedFiles(draft.evidenceFileIds, '办理回执')}
                    onDownload={onDownloadFile}
                    onPreview={onPreviewFile}
                  />
                ) : null}
              </DetailSection>
            )
          },
          {
            key: 'operations',
            label: '操作记录',
            children: (
              <DetailSection icon={<FileProtectOutlined />} title="最近记录">
                <DetailInfoGrid
                  columns={2}
                  items={[
                    { label: '更新时间', value: profile.updatedAt },
                    { label: '更新人', value: '李明' },
                    { label: '动作', value: profile.socialSecurityStatus === '已停保' ? '确认停保结果' : '维护参保办理结果' },
                    { label: '结果', value: profile.socialSecurityStatus }
                  ]}
                />
              </DetailSection>
            )
          }
        ]}
      />
    </DetailDrawerShell>
  );
}

function MonthlyContributionDetailDrawer({
  batch,
  canRegisterNoContribution,
  correctionRecords,
  paymentAccountOptions,
  onClose,
  onConfirmAssessment,
  onDownloadFile,
  onPreviewFile,
  onRegisterPayment,
  onRegisterCorrectionPayment,
  onRegisterNoContribution,
  onSaveCorrection,
  onSaveBase,
  onStatusChange
}: {
  batch?: MonthlyContributionBatchRow;
  canRegisterNoContribution: (record: SocialInsuranceEmployeeRecord) => boolean;
  correctionRecords: ContributionCorrectionRecord[];
  paymentAccountOptions: Array<{ label: string; value: string }>;
  onClose: () => void;
  onConfirmAssessment: (recordId: string, input: {
    assessedAt: string;
    assessedEmployeeAmount: number;
    assessedEmployerAmount: number;
    assessmentFileIds: string[];
    assessmentNo: string;
    differenceReason?: string;
  }) => boolean;
  onDownloadFile: (file: RelatedFileRecord) => void;
  onPreviewFile: (file: RelatedFileRecord) => void;
  onRegisterPayment: (batch: MonthlyContributionBatchRow, input: {
    paidAt: string;
    paymentFileIds: string[];
    publicAccountId: string;
  }) => boolean;
  onRegisterCorrectionPayment: (correction: ContributionCorrectionRecord, input: {
    paidAt: string;
    paymentFileIds: string[];
    publicAccountId: string;
  }) => boolean;
  onRegisterNoContribution: (recordId: string, input: {
    confirmedAt: string;
    evidenceFileIds: string[];
    officialReferenceNo: string;
    reason: string;
  }) => boolean;
  onSaveCorrection: (record: ContributionCorrectionRecord) => boolean;
  onSaveBase: (recordId: string, contributionBase: number) => boolean;
  onStatusChange: (recordId: string, status: SocialInsuranceEmployeeRecord['handlingStatus']) => boolean;
}) {
  const [selectedRecordId, setSelectedRecordId] = useState<string>();
  const [registeringNoContribution, setRegisteringNoContribution] = useState(false);
  const [draft, setDraft] = useState({
    assessedAt: dayjs().format('YYYY-MM-DD'),
    assessedEmployeeAmount: 0,
    assessedEmployerAmount: 0,
    assessmentFileIds: [] as string[],
    assessmentNo: '',
    contributionBase: 0,
    correctionEvidenceFileIds: [] as string[],
    correctionHandlingPeriod: dayjs().format('YYYY-MM'),
    correctionLateFeeAmount: 0,
    correctionOfficialReferenceNo: '',
    correctionReason: '',
    correctionEmployeeAmount: 0,
    correctionEmployerAmount: 0,
    differenceReason: '',
    noContributionConfirmedAt: dayjs().format('YYYY-MM-DD'),
    noContributionEvidenceFileIds: [] as string[],
    noContributionOfficialReferenceNo: '',
    noContributionReason: '',
    paidAt: dayjs().format('YYYY-MM-DD'),
    paymentFileIds: [] as string[],
    publicAccountId: paymentAccountOptions[0]?.value ?? ''
  });

  const selectedRecord = batch?.records.find((record) => record.id === selectedRecordId) ?? batch?.records[0];

  useEffect(() => {
    const record = batch?.records[0];
    setSelectedRecordId(record?.id);
    setRegisteringNoContribution(false);
  }, [batch?.id]);

  useEffect(() => {
    if (!selectedRecord) return;
    setDraft({
      assessedAt: selectedRecord.assessedAt ?? dayjs().format('YYYY-MM-DD'),
      assessedEmployeeAmount: selectedRecord.assessedEmployeeAmount ?? selectedRecord.estimatedEmployeeAmount,
      assessedEmployerAmount: selectedRecord.assessedEmployerAmount ?? selectedRecord.estimatedEmployerAmount,
      assessmentFileIds: selectedRecord.assessmentFileIds,
      assessmentNo: selectedRecord.assessmentNo ?? '',
      contributionBase: selectedRecord.contributionBase,
      correctionEvidenceFileIds: [],
      correctionHandlingPeriod: dayjs().format('YYYY-MM'),
      correctionLateFeeAmount: 0,
      correctionOfficialReferenceNo: '',
      correctionReason: '',
      correctionEmployeeAmount: selectedRecord.assessedEmployeeAmount ?? selectedRecord.estimatedEmployeeAmount,
      correctionEmployerAmount: selectedRecord.assessedEmployerAmount ?? selectedRecord.estimatedEmployerAmount,
      differenceReason: selectedRecord.differenceReason ?? '',
      noContributionConfirmedAt: dayjs().format('YYYY-MM-DD'),
      noContributionEvidenceFileIds: [],
      noContributionOfficialReferenceNo: '',
      noContributionReason: '',
      paidAt: selectedRecord.paidAt ?? dayjs().format('YYYY-MM-DD'),
      paymentFileIds: selectedRecord.paymentFileIds,
      publicAccountId: paymentAccountOptions[0]?.value ?? ''
    });
  }, [paymentAccountOptions, selectedRecord]);

  if (!batch) {
    return null;
  }

  const detailColumns: TableColumnsType<SocialInsuranceEmployeeRecord> = [
    {
      key: 'employee',
      title: '人员',
      width: 180,
      render: (_, record) => <CompactCell primary={record.employeeName} secondary={record.employeeNo} />
    },
    { dataIndex: 'contributionBase', key: 'base', title: '缴费基数', width: 120, render: (value: number) => formatMoney(value) },
    {
      key: 'employer',
      title: '单位金额',
      width: 120,
      render: (_, record) => formatMoney(record.assessedEmployerAmount ?? record.estimatedEmployerAmount)
    },
    {
      key: 'employeeAmount',
      title: '个人金额',
      width: 120,
      render: (_, record) => formatMoney(record.assessedEmployeeAmount ?? record.estimatedEmployeeAmount)
    },
    {
      dataIndex: 'handlingStatus',
      key: 'status',
      title: '核定状态',
      width: 120,
      render: (value: SocialInsuranceEmployeeRecord['handlingStatus']) => (
        <StatusTag toneMap={socialInsuranceHandlingStatusTone} value={value} />
      )
    }
  ];

  const assessedTotal = batch.employerAmount + batch.employeeAmount;
  const selectedCorrection = selectedRecord
    ? correctionRecords.find((record) => record.sourceRecordId === selectedRecord.id)
    : undefined;
  const primaryAction = selectedRecord ? (() => {
    if (registeringNoContribution) {
      return {
        disabled: !draft.noContributionConfirmedAt
          || !draft.noContributionOfficialReferenceNo.trim()
          || !draft.noContributionReason.trim()
          || draft.noContributionEvidenceFileIds.length === 0,
        label: '保存无需缴纳结论',
        onClick: () => {
          if (onRegisterNoContribution(selectedRecord.id, {
            confirmedAt: draft.noContributionConfirmedAt,
            evidenceFileIds: draft.noContributionEvidenceFileIds,
            officialReferenceNo: draft.noContributionOfficialReferenceNo,
            reason: draft.noContributionReason
          })) setRegisteringNoContribution(false);
        }
      };
    }

    if (selectedRecord.handlingStatus === '欠缴待补') {
      if (selectedCorrection) {
        return {
          disabled: Boolean(selectedCorrection.transactionNo)
            || selectedCorrection.status !== '待缴费'
            || !draft.paidAt
            || !draft.publicAccountId
            || draft.paymentFileIds.length === 0,
          label: selectedCorrection.status === '已完成'
            ? '补缴已完成'
            : selectedCorrection.transactionNo
              ? '补缴流水待复核'
              : '登记补缴结果',
          onClick: () => onRegisterCorrectionPayment(selectedCorrection, {
            paidAt: draft.paidAt,
            paymentFileIds: draft.paymentFileIds,
            publicAccountId: draft.publicAccountId
          })
        };
      }

      const correction = buildContributionCorrectionRecord({
        evidenceFileIds: draft.correctionEvidenceFileIds,
        handlingPeriod: draft.correctionHandlingPeriod,
        lateFeeAmount: draft.correctionLateFeeAmount,
        officialReferenceNo: draft.correctionOfficialReferenceNo,
        principalEmployeeAmount: draft.correctionEmployeeAmount,
        principalEmployerAmount: draft.correctionEmployerAmount,
        reason: draft.correctionReason,
        sourceRecord: selectedRecord
      });
      return {
        disabled: !correction,
        label: '创建补缴事项',
        onClick: () => correction && onSaveCorrection(correction)
      };
    }

    if (selectedRecord.handlingStatus === '待测算') {
      return {
        disabled: draft.contributionBase <= 0,
        label: '保存缴费基数',
        onClick: () => onSaveBase(selectedRecord.id, draft.contributionBase)
      };
    }

    if (selectedRecord.handlingStatus === '待申报') {
      return { label: '提交核定', onClick: () => onStatusChange(selectedRecord.id, '待核定') };
    }

    if (selectedRecord.handlingStatus === '待核定') {
      const hasDifference = Math.abs(draft.assessedEmployerAmount - selectedRecord.estimatedEmployerAmount) > 0.009
        || Math.abs(draft.assessedEmployeeAmount - selectedRecord.estimatedEmployeeAmount) > 0.009;
      return {
        disabled: !draft.assessmentNo.trim() || draft.assessmentFileIds.length === 0 || (hasDifference && !draft.differenceReason.trim()),
        label: '保存核定结果',
        onClick: () => onConfirmAssessment(selectedRecord.id, draft)
      };
    }

    if (selectedRecord.handlingStatus === '核定有差异') {
      return { label: '确认差异结果', onClick: () => onStatusChange(selectedRecord.id, '待确认') };
    }

    if (selectedRecord.handlingStatus === '待确认') {
      return { label: '确认缴费金额', onClick: () => onStatusChange(selectedRecord.id, '待缴费') };
    }

    if (selectedRecord.handlingStatus === '待缴费') {
      return {
        disabled: Boolean(selectedRecord.transactionNo)
          || !draft.paidAt
          || !draft.publicAccountId
          || draft.paymentFileIds.length === 0,
        label: selectedRecord.transactionNo ? '缴费流水待复核' : '登记缴费结果',
        onClick: () => onRegisterPayment(batch, {
          paidAt: draft.paidAt,
          paymentFileIds: draft.paymentFileIds,
          publicAccountId: draft.publicAccountId
        })
      };
    }

    return undefined;
  })() : undefined;

  return (
    <DetailDrawerShell
      bodyTestId="social-insurance-monthly-drawer"
      closeAction={{ label: '关闭', onClick: onClose }}
      open
      primaryAction={primaryAction}
      title={
        <DetailDrawerTitle
          status={batch.status}
          statusToneMap={socialInsuranceHandlingStatusTone}
          subtitle={`${batch.period} / ${batch.category}`}
          title="月度缴费"
        />
      }
      width={880}
      onClose={onClose}
    >
      <DetailSummaryCards
        columns={4}
        items={[
          { icon: <TeamOutlined />, key: 'people', label: '应缴人数', value: `${batch.participantCount} 人` },
          { icon: <WalletOutlined />, key: 'employer', label: '单位金额', value: formatMoney(batch.employerAmount) },
          { icon: <WalletOutlined />, key: 'employee', label: '个人金额', value: formatMoney(batch.employeeAmount) },
          { icon: <SafetyCertificateOutlined />, key: 'difference', label: '差异人数', value: `${batch.differenceCount} 人` }
        ]}
      />
      <DetailTabs
        items={[
          {
            key: 'people',
            label: '人员明细',
            children: (
              <ManagementTable<SocialInsuranceEmployeeRecord>
                columns={detailColumns}
                count={{ value: batch.records.length, unit: '条明细' }}
                dataSource={batch.records}
                rowKey="id"
                rowTestIdPrefix="social-insurance-person-row"
                scrollX={720}
                onRowClick={(record) => setSelectedRecordId(record.id)}
              />
            )
          },
          {
            key: 'assessment',
            label: '核定缴费',
            children: (
              <DetailSection icon={<SafetyCertificateOutlined />} title="核定结果">
                {selectedRecord ? (
                  <>
                    <DetailInfoGrid
                      columns={3}
                      items={[
                        { label: '当前人员', value: `${selectedRecord.employeeName} / ${selectedRecord.employeeNo}` },
                        { label: '内部测算单位金额', value: formatMoney(selectedRecord.estimatedEmployerAmount) },
                        { label: '内部测算个人金额', value: formatMoney(selectedRecord.estimatedEmployeeAmount) }
                      ]}
                    />
                    {selectedRecord.handlingStatus === '待测算' ? (
                      <div className="drawer-form-grid">
                        <label className="drawer-form-field">
                          <span>缴费基数 *</span>
                          <InputNumber min={0.01} precision={2} style={{ width: '100%' }} value={draft.contributionBase} onChange={(value) => setDraft((current) => ({ ...current, contributionBase: Number(value ?? 0) }))} />
                        </label>
                      </div>
                    ) : null}
                    {selectedRecord.handlingStatus === '待核定' ? (
                      <div className="drawer-form-grid">
                        <label className="drawer-form-field">
                          <span>核定编号 *</span>
                          <Input value={draft.assessmentNo} onChange={(event) => setDraft((current) => ({ ...current, assessmentNo: event.target.value }))} />
                        </label>
                        <label className="drawer-form-field">
                          <span>核定日期 *</span>
                          <DatePicker inputReadOnly style={{ width: '100%' }} value={draft.assessedAt ? dayjs(draft.assessedAt) : undefined} onChange={(value) => setDraft((current) => ({ ...current, assessedAt: value?.format('YYYY-MM-DD') ?? '' }))} />
                        </label>
                        <label className="drawer-form-field">
                          <span>单位核定金额 *</span>
                          <InputNumber min={0} precision={2} style={{ width: '100%' }} value={draft.assessedEmployerAmount} onChange={(value) => setDraft((current) => ({ ...current, assessedEmployerAmount: Number(value ?? 0) }))} />
                        </label>
                        <label className="drawer-form-field">
                          <span>个人核定金额 *</span>
                          <InputNumber min={0} precision={2} style={{ width: '100%' }} value={draft.assessedEmployeeAmount} onChange={(value) => setDraft((current) => ({ ...current, assessedEmployeeAmount: Number(value ?? 0) }))} />
                        </label>
                        <label className="drawer-form-field">
                          <span>差异原因</span>
                          <Input value={draft.differenceReason} onChange={(event) => setDraft((current) => ({ ...current, differenceReason: event.target.value }))} />
                        </label>
                        <label className="drawer-form-field">
                          <span>核定文件 *</span>
                          <Upload beforeUpload={(file) => { setDraft((current) => ({ ...current, assessmentFileIds: [...new Set([...current.assessmentFileIds, file.name])] })); return false; }} fileList={[]} showUploadList={false}>
                            <Button icon={<UploadOutlined />}>选择文件</Button>
                          </Upload>
                        </label>
                      </div>
                    ) : null}
                    {selectedRecord.handlingStatus === '待缴费' ? (
                      <div className="drawer-form-grid">
                        <label className="drawer-form-field">
                          <span>缴费日期 *</span>
                          <DatePicker inputReadOnly style={{ width: '100%' }} value={draft.paidAt ? dayjs(draft.paidAt) : undefined} onChange={(value) => setDraft((current) => ({ ...current, paidAt: value?.format('YYYY-MM-DD') ?? '' }))} />
                        </label>
                        <label className="drawer-form-field">
                          <span>付款账户 *</span>
                          <Select
                            options={paymentAccountOptions}
                            value={draft.publicAccountId}
                            onChange={(publicAccountId) => setDraft((current) => ({ ...current, publicAccountId }))}
                          />
                        </label>
                        <label className="drawer-form-field">
                          <span>缴费回单 *</span>
                          <Upload
                            beforeUpload={(file) => {
                              setDraft((current) => ({
                                ...current,
                                paymentFileIds: [...new Set([...current.paymentFileIds, file.name])]
                              }));
                              return false;
                            }}
                            fileList={[]}
                            showUploadList={false}
                          >
                            <Button icon={<UploadOutlined />}>选择文件</Button>
                          </Upload>
                        </label>
                      </div>
                    ) : null}
                    {canRegisterNoContribution(selectedRecord) && selectedRecord.handlingStatus !== '无需缴纳' ? (
                      registeringNoContribution ? (
                        <div className="drawer-form-grid">
                          <label className="drawer-form-field">
                            <span>官方结论编号 *</span>
                            <Input value={draft.noContributionOfficialReferenceNo} onChange={(event) => setDraft((current) => ({ ...current, noContributionOfficialReferenceNo: event.target.value }))} />
                          </label>
                          <label className="drawer-form-field">
                            <span>确认日期 *</span>
                            <DatePicker inputReadOnly style={{ width: '100%' }} value={draft.noContributionConfirmedAt ? dayjs(draft.noContributionConfirmedAt) : undefined} onChange={(value) => setDraft((current) => ({ ...current, noContributionConfirmedAt: value?.format('YYYY-MM-DD') ?? '' }))} />
                          </label>
                          <label className="drawer-form-field">
                            <span>无需缴纳原因 *</span>
                            <Input value={draft.noContributionReason} onChange={(event) => setDraft((current) => ({ ...current, noContributionReason: event.target.value }))} />
                          </label>
                          <label className="drawer-form-field">
                            <span>官方回执 *</span>
                            <Upload beforeUpload={(file) => { setDraft((current) => ({ ...current, noContributionEvidenceFileIds: [...new Set([...current.noContributionEvidenceFileIds, file.name])] })); return false; }} fileList={[]} showUploadList={false}>
                              <Button icon={<UploadOutlined />}>选择文件</Button>
                            </Upload>
                          </label>
                        </div>
                      ) : (
                        <Button onClick={() => setRegisteringNoContribution(true)}>登记当月无需缴纳</Button>
                      )
                    ) : null}
                    {selectedRecord.handlingStatus === '欠缴待补' ? (
                      selectedCorrection ? (
                        <>
                          <DetailInfoGrid
                            columns={3}
                            items={[
                              { label: '原所属月份', value: selectedCorrection.originalPeriod },
                              { label: '补缴办理月份', value: selectedCorrection.handlingPeriod },
                              { label: '补缴状态', value: selectedCorrection.status },
                              { label: '单位本金', value: formatMoney(selectedCorrection.principalEmployerAmount) },
                              { label: '个人本金', value: formatMoney(selectedCorrection.principalEmployeeAmount) },
                              { label: '滞纳金', value: formatMoney(selectedCorrection.lateFeeAmount) },
                              { label: '核定编号', value: selectedCorrection.officialReferenceNo },
                              { label: '薪酬调整月份', value: selectedCorrection.salaryAdjustmentPeriod ?? '-' },
                              { label: '补缴原因', value: selectedCorrection.reason }
                            ]}
                          />
                          {selectedCorrection.status === '待缴费' ? (
                            <div className="drawer-form-grid">
                              <label className="drawer-form-field">
                                <span>补缴日期 *</span>
                                <DatePicker inputReadOnly style={{ width: '100%' }} value={draft.paidAt ? dayjs(draft.paidAt) : undefined} onChange={(value) => setDraft((current) => ({ ...current, paidAt: value?.format('YYYY-MM-DD') ?? '' }))} />
                              </label>
                              <label className="drawer-form-field">
                                <span>付款账户 *</span>
                                <Select options={paymentAccountOptions} value={draft.publicAccountId} onChange={(publicAccountId) => setDraft((current) => ({ ...current, publicAccountId }))} />
                              </label>
                              <label className="drawer-form-field">
                                <span>补缴回单 *</span>
                                <Upload beforeUpload={(file) => { setDraft((current) => ({ ...current, paymentFileIds: [...new Set([...current.paymentFileIds, file.name])] })); return false; }} fileList={[]} showUploadList={false}>
                                  <Button icon={<UploadOutlined />}>选择文件</Button>
                                </Upload>
                              </label>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <div className="drawer-form-grid">
                          <MonthFilterField allowClear={false} label="补缴办理月份" value={draft.correctionHandlingPeriod} width={240} onChange={(value) => setDraft((current) => ({ ...current, correctionHandlingPeriod: value }))} />
                          <label className="drawer-form-field"><span>单位本金 *</span><InputNumber min={0} precision={2} style={{ width: '100%' }} value={draft.correctionEmployerAmount} onChange={(value) => setDraft((current) => ({ ...current, correctionEmployerAmount: Number(value ?? 0) }))} /></label>
                          <label className="drawer-form-field"><span>个人本金 *</span><InputNumber min={0} precision={2} style={{ width: '100%' }} value={draft.correctionEmployeeAmount} onChange={(value) => setDraft((current) => ({ ...current, correctionEmployeeAmount: Number(value ?? 0) }))} /></label>
                          <label className="drawer-form-field"><span>滞纳金</span><InputNumber min={0} precision={2} style={{ width: '100%' }} value={draft.correctionLateFeeAmount} onChange={(value) => setDraft((current) => ({ ...current, correctionLateFeeAmount: Number(value ?? 0) }))} /></label>
                          <label className="drawer-form-field"><span>核定编号 *</span><Input value={draft.correctionOfficialReferenceNo} onChange={(event) => setDraft((current) => ({ ...current, correctionOfficialReferenceNo: event.target.value }))} /></label>
                          <label className="drawer-form-field"><span>补缴原因 *</span><Input value={draft.correctionReason} onChange={(event) => setDraft((current) => ({ ...current, correctionReason: event.target.value }))} /></label>
                          <label className="drawer-form-field">
                            <span>核定文件 *</span>
                            <Upload beforeUpload={(file) => { setDraft((current) => ({ ...current, correctionEvidenceFileIds: [...new Set([...current.correctionEvidenceFileIds, file.name])] })); return false; }} fileList={[]} showUploadList={false}>
                              <Button icon={<UploadOutlined />}>选择文件</Button>
                            </Upload>
                          </label>
                        </div>
                      )
                    ) : null}
                    {draft.assessmentFileIds.length > 0 ? (
                      <RelatedFileTable
                        records={toRelatedFiles(draft.assessmentFileIds, '核定文件')}
                        onDownload={onDownloadFile}
                        onPreview={onPreviewFile}
                      />
                    ) : null}
                    {draft.paymentFileIds.length > 0 ? (
                      <RelatedFileTable
                        records={toRelatedFiles(draft.paymentFileIds, '缴费回单')}
                        onDownload={onDownloadFile}
                        onPreview={onPreviewFile}
                      />
                    ) : null}
                  </>
                ) : null}
                <DetailInfoGrid
                  columns={2}
                  items={[
                    { label: '所属月份', value: batch.period },
                    { label: '缴费类别', value: batch.category },
                    { label: '官方核定合计', value: assessedTotal > 0 ? formatMoney(assessedTotal) : '待核定' },
                    { label: '差异人数', value: `${batch.differenceCount} 人` },
                    { label: '核定编号', value: batch.records.map((record) => record.assessmentNo).filter(Boolean).join(' / ') },
                    {
                      label: '核定文件',
                      value: `${batch.records.reduce((total, record) => total + record.assessmentFileIds.length, 0)} 份`
                    },
                    { label: '缴费日期', value: batch.records.map((record) => record.paidAt).filter(Boolean).join(' / ') },
                    { label: '关联流水', value: batch.records.map((record) => record.transactionNo).filter(Boolean).join(' / ') }
                  ]}
                />
              </DetailSection>
            )
          },
          {
            key: 'operations',
            label: '操作记录',
            children: (
              <DetailSection icon={<FileProtectOutlined />} title="处理记录">
                <DetailInfoGrid
                  columns={2}
                  items={batch.records.flatMap((record) =>
                    record.operationRecords.slice(0, 2).map((operation) => ({
                      label: `${operation.time} / ${operation.actor}`,
                      value: operation.summary
                    }))
                  )}
                />
              </DetailSection>
            )
          }
        ]}
      />
    </DetailDrawerShell>
  );
}

export function FinanceSocialInsurancePage() {
  const { peopleRows } = usePeopleOrganizationState();
  const { financePrimaryCategories, financeSecondaryCategories } = useFinanceCategoryState();
  const { publicAccounts } = usePublicAccountConfigState();
  const { addFinanceTransaction, financeRows, getAccountingPeriodGuard } = useFinanceManagement();
  const salaryState = useSalaryManagementState();
  const {
    confirmMonthlyAssessment,
    correctionRecords,
    enrollmentProfiles,
    getSocialInsuranceRecordsForPeriod,
    registerMonthlyBatchPayment,
    registerContributionCorrectionPayment,
    registerMonthlyNoContribution,
    saveContributionCorrection,
    saveEnrollmentProfile,
    saveSocialInsuranceContributionBase,
    updateSocialInsuranceRecordStatus
  } = useFinanceSocialInsuranceState();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [activeView, setActiveView] = useState<SocialInsuranceViewKey>('enrollment');
  const [selectedMonth, setSelectedMonth] = useState('2026-06');
  const [activeEnrollmentPersonId, setActiveEnrollmentPersonId] = useState<string>();
  const [activeMonthlyBatchId, setActiveMonthlyBatchId] = useState<string>();
  const [previewFile, setPreviewFile] = useState<RelatedFileRecord>();
  const paymentAccounts = useMemo(
    () => publicAccounts.filter((account) => account.status === '启用' && account.usage.includes('付款')),
    [publicAccounts]
  );
  const paymentAccountOptions = useMemo(
    () => paymentAccounts.map((account) => ({ label: account.displayName, value: account.id })),
    [paymentAccounts]
  );

  const enrollmentRows = useMemo(
    () => buildEnrollmentRows(peopleRows, enrollmentProfiles),
    [enrollmentProfiles, peopleRows]
  );
  const selectedMonthRecords = useMemo(
    () => getSocialInsuranceRecordsForPeriod(selectedMonth),
    [getSocialInsuranceRecordsForPeriod, selectedMonth]
  );
  const monthlyBatches = useMemo(() => buildMonthlyBatches(selectedMonthRecords), [selectedMonthRecords]);
  const activeEnrollmentRow = enrollmentRows.find((row) => row.profile.personId === activeEnrollmentPersonId);
  const activeMonthlyBatch = monthlyBatches.find((batch) => batch.id === activeMonthlyBatchId);

  const enrollmentColumns: TableColumnsType<EnrollmentRow> = [
    { key: 'employeeNo', title: '工号', width: 120, render: (_, row) => <CellText>{row.member.id}</CellText> },
    { key: 'person', title: '人员', width: 160, render: (_, row) => <CompactCell primary={row.member.name} secondary={row.member.position} /> },
    { key: 'relationship', title: '劳动关系', width: 170, render: (_, row) => <CellText>{row.member.employmentRelationshipType}</CellText> },
    {
      key: 'social',
      title: '社保状态',
      width: 130,
      render: (_, row) => <StatusTag toneMap={enrollmentStatusTone} value={row.profile.socialSecurityStatus} />
    },
    {
      key: 'medical',
      title: '医保状态',
      width: 130,
      render: (_, row) => <StatusTag toneMap={enrollmentStatusTone} value={row.profile.medicalInsuranceStatus} />
    },
    {
      key: 'effective',
      title: '生效月份',
      width: 130,
      render: (_, row) => <CellText>{row.profile.socialSecurityEffectiveMonth ?? row.profile.plannedEnrollmentMonth ?? '-'}</CellText>
    }
  ];

  const monthlyColumns: TableColumnsType<MonthlyContributionBatchRow> = [
    { dataIndex: 'period', key: 'period', title: '所属月份', width: 130 },
    { dataIndex: 'category', key: 'category', title: '类别', width: 110 },
    { dataIndex: 'participantCount', key: 'people', title: '应缴人数', width: 120, render: (value: number) => `${value} 人` },
    {
      key: 'amount',
      title: '核定金额',
      width: 150,
      render: (_, row) => row.employerAmount + row.employeeAmount > 0 ? formatMoney(row.employerAmount + row.employeeAmount) : '-'
    },
    { dataIndex: 'differenceCount', key: 'difference', title: '差异人数', width: 120, render: (value: number) => `${value} 人` },
    {
      dataIndex: 'status',
      key: 'status',
      title: '缴费状态',
      width: 130,
      render: (value: MonthlyContributionBatchRow['status']) => <StatusTag toneMap={socialInsuranceHandlingStatusTone} value={value} />
    }
  ];

  const handlingCount = enrollmentRows.filter((row) =>
    ['待增员', '增员办理中', '待停保', '停保办理中', '办理异常'].includes(row.profile.socialSecurityStatus)
  ).length;
  const monthlyPendingCount = monthlyBatches.filter((batch) => batch.status !== '已缴费' && batch.status !== '无需缴纳').length;
  const assessedAmount = monthlyBatches.reduce((total, batch) => total + batch.employerAmount + batch.employeeAmount, 0);

  return (
    <>
      {messageContextHolder}
      <ManagementPageScaffold
      metrics={
        <MetricGrid columns={3}>
          <MetricCard icon={<SafetyCertificateOutlined />} label="参保待办" value={`${handlingCount} 人`} />
          <MetricCard icon={<CalendarOutlined />} label="月度待处理" value={`${monthlyPendingCount} 项`} />
          <MetricCard icon={<WalletOutlined />} label="已核定金额" value={formatMoney(assessedAmount)} />
        </MetricGrid>
      }
      pageId="salary-social-insurance"
    >
      <ManagementTableTabs
        activeKey={activeView}
        items={[
          { key: 'enrollment', label: `参保办理 ${enrollmentRows.length}` },
          { key: 'monthly', label: `月度缴费 ${monthlyBatches.length}` }
        ]}
        tabTestIdPrefix="social-insurance-view-tab"
        testId="social-insurance-view-tabs"
        onChange={(key) => setActiveView(key as SocialInsuranceViewKey)}
      />

      {activeView === 'monthly' ? (
        <FilterPanel>
          <FilterBar>
            <MonthFilterField
              allowClear={false}
              label="所属月份"
              value={selectedMonth}
              onChange={(month) => {
                setSelectedMonth(month || '2026-06');
                setActiveMonthlyBatchId(undefined);
              }}
            />
          </FilterBar>
        </FilterPanel>
      ) : null}

      {activeView === 'enrollment' ? (
        <ManagementTable<EnrollmentRow>
          columns={enrollmentColumns}
          count={{ value: enrollmentRows.length, unit: '人' }}
          dataSource={enrollmentRows}
          emptyText="暂无参保办理记录"
          rowKey={(row) => row.profile.personId}
          rowTestIdPrefix="social-insurance-enrollment-row"
          tableTestId="social-insurance-enrollment-table"
          onRowClick={(row) => setActiveEnrollmentPersonId(row.profile.personId)}
        />
      ) : (
        <ManagementTable<MonthlyContributionBatchRow>
          columns={monthlyColumns}
          count={{ value: monthlyBatches.length, unit: '项' }}
          dataSource={monthlyBatches}
          emptyText="暂无月度缴费记录"
          rowKey="id"
          rowTestIdPrefix="social-insurance-monthly-row"
          tableTestId="social-insurance-monthly-table"
          onRowClick={(row) => setActiveMonthlyBatchId(row.id)}
        />
      )}

      <EnrollmentDetailDrawer
        row={activeEnrollmentRow}
        onClose={() => setActiveEnrollmentPersonId(undefined)}
        onDownloadFile={(file) => {
          void messageApi.success(`已下载 ${file.name}`);
        }}
        onPreviewFile={setPreviewFile}
        onSave={(profile) => {
          const saved = saveEnrollmentProfile(profile);
          if (saved) void messageApi.success('参保办理结果已保存');
          return saved;
        }}
      />
      <MonthlyContributionDetailDrawer
        batch={activeMonthlyBatch}
        canRegisterNoContribution={(record) => {
          const profile = enrollmentProfiles.find((currentProfile) => currentProfile.personId === record.employeeNo);
          return Boolean(profile?.socialSecurityStopEffectiveMonth && profile.socialSecurityStopEffectiveMonth <= record.period);
        }}
        correctionRecords={correctionRecords}
        paymentAccountOptions={paymentAccountOptions}
        onClose={() => setActiveMonthlyBatchId(undefined)}
        onConfirmAssessment={(recordId, input) => {
          const saved = confirmMonthlyAssessment(recordId, input);
          if (saved) void messageApi.success('核定结果已保存');
          return saved;
        }}
        onDownloadFile={(file) => {
          void messageApi.success(`已下载 ${file.name}`);
        }}
        onPreviewFile={setPreviewFile}
        onRegisterPayment={(batch, input) => {
          const paymentAccount = paymentAccounts.find((account) => account.id === input.publicAccountId);
          if (!paymentAccount) return false;

          const transaction = buildSocialInsurancePaymentTransaction({
            category: batch.category,
            financePrimaryCategories,
            financeRows,
            financeSecondaryCategories,
            paidAt: input.paidAt,
            paymentFileIds: input.paymentFileIds,
            period: batch.period,
            publicAccountRef: buildPublicAccountRef(paymentAccount),
            records: batch.records
          });
          if (!transaction) return false;

          const periodGuard = getAccountingPeriodGuard(transaction.accountingPeriod, '登记社保公积金缴费流水');
          if (!periodGuard.allowed || !addFinanceTransaction(transaction)) {
            void messageApi.warning(periodGuard.reason ?? '缴费流水不可登记');
            return false;
          }

          const saved = registerMonthlyBatchPayment({
            category: batch.category,
            paidAt: input.paidAt,
            paymentFileIds: input.paymentFileIds,
            period: batch.period,
            transactionNo: transaction.transactionNo
          });
          if (saved) void messageApi.success('缴费结果已登记，流水待复核');
          return saved;
        }}
        onRegisterCorrectionPayment={(correction, input) => {
          const paymentAccount = paymentAccounts.find((account) => account.id === input.publicAccountId);
          if (!paymentAccount) return false;

          const transaction = buildContributionCorrectionPaymentTransaction({
            correction,
            financePrimaryCategories,
            financeRows,
            financeSecondaryCategories,
            paidAt: input.paidAt,
            paymentFileIds: input.paymentFileIds,
            publicAccountRef: buildPublicAccountRef(paymentAccount)
          });
          if (!transaction) return false;

          const periodGuard = getAccountingPeriodGuard(transaction.accountingPeriod, '登记社保公积金补缴流水');
          if (!periodGuard.allowed || !addFinanceTransaction(transaction)) {
            void messageApi.warning(periodGuard.reason ?? '补缴流水不可登记');
            return false;
          }

          const saved = registerContributionCorrectionPayment(correction.id, {
            paidAt: input.paidAt,
            paymentFileIds: input.paymentFileIds,
            transactionNo: transaction.transactionNo
          });
          if (saved) void messageApi.success('补缴结果已登记，流水待复核');
          return saved;
        }}
        onRegisterNoContribution={(recordId, input) => {
          const saved = registerMonthlyNoContribution(recordId, input);
          if (saved) void messageApi.success('无需缴纳结论已保存');
          return saved;
        }}
        onSaveCorrection={(record) => {
          const salaryAdjustment: SalaryAdjustmentRecord | undefined = record.principalEmployeeAmount > 0 ? {
            amount: record.principalEmployeeAmount,
            createdAt: `${dayjs().format('YYYY-MM-DD')} 10:30`,
            createdBy: '李明',
            id: `salary-adjust-${record.id}`,
            memberId: record.employeeNo,
            month: record.handlingPeriod,
            reason: `${record.originalPeriod} ${record.category}补缴个人承担部分`,
            salarySettlementReference: record.id,
            source: '薪酬调整',
            status: '已生效',
            taxTreatment: '税前计税',
            type: '代垫款收回',
            updatedAt: `${dayjs().format('YYYY-MM-DD')} 10:30`
          } : undefined;

          if (salaryAdjustment && !salaryState.isSalaryAdjustmentPeriodOpen(salaryAdjustment)) {
            void messageApi.warning('补缴办理月份薪酬已发放，请选择后续开放月份');
            return false;
          }

          const saved = saveContributionCorrection(record);
          if (!saved) return false;
          if (salaryAdjustment && !salaryState.saveSalaryAdjustment(salaryAdjustment)) return false;
          void messageApi.success('补缴事项已创建');
          return true;
        }}
        onSaveBase={(recordId, contributionBase) => {
          const saved = saveSocialInsuranceContributionBase(recordId, contributionBase);
          if (saved) void messageApi.success('缴费基数已保存');
          return saved;
        }}
        onStatusChange={(recordId, status) => {
          const saved = updateSocialInsuranceRecordStatus(recordId, status);
          if (saved) void messageApi.success('处理状态已更新');
          return saved;
        }}
      />
      <FilePreviewModal
        file={previewFile ? {
          category: previewFile.type,
          name: previewFile.name,
          status: previewFile.status,
          updatedAt: previewFile.updatedAt
        } : undefined}
        title="文件预览"
        onClose={() => setPreviewFile(undefined)}
      />
      </ManagementPageScaffold>
    </>
  );
}
