import {
  AuditOutlined,
  CheckCircleOutlined,
  CloudDownloadOutlined,
  IdcardOutlined,
  PercentageOutlined,
  SendOutlined,
  UploadOutlined,
  WalletOutlined
} from '@ant-design/icons';
import { Checkbox, DatePicker, Input, InputNumber, Select, message } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import type { TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DrawerFormField, DrawerFormGrid, DrawerFormShell, useModeDrawerState } from '../../components/DrawerForm';
import { FilePreviewModal } from '../../components/FilePreviewModal';
import { FileSlot } from '../../components/FileSlot';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { RelatedFileTable } from '../../components/RelatedFileTable';
import { CompactCell } from '../../components/TableCell';
import { usePeopleOrganizationState } from '../people/PeopleOrganizationState';
import type { PeopleMember } from '../people/peopleTypes';
import { useSalaryManagementState } from './SalaryManagementState';
import {
  createSalaryIitProfile,
  getSalaryIitDeductionSummary,
  maskSalaryIitIdentityNo,
  type SalaryIitBasicDeductionMethod,
  type SalaryIitDeductionAcquisitionStatus,
  type SalaryIitDeductionCategory,
  type SalaryIitDeductionSource,
  type SalaryIitEmploymentScenario,
  type SalaryIitEvidenceFile,
  type SalaryIitPersonnelReportingStatus,
  type SalaryIitProfile
} from './salaryPersonalIncomeTaxModel';

type SalaryIitProfileRow = SalaryIitProfile & { member: PeopleMember };
type SalaryIitEditorKind = 'reporting' | 'tax-system-result' | 'employee-form';

type SalaryIitProfileForm = {
  acquiredAt: string;
  acquisitionStatus: SalaryIitDeductionAcquisitionStatus;
  childEducationAmount: number;
  continuingEducationAmount: number;
  effectiveMonth: string;
  elderlySupportAmount: number;
  employmentScenario: SalaryIitEmploymentScenario;
  evidenceFiles: SalaryIitEvidenceFile[];
  firstEmploymentEvidenceFiles: SalaryIitEvidenceFile[];
  firstEmploymentMonth?: string;
  housingLoanAmount: number;
  housingRentAmount: number;
  infantCareAmount: number;
  basicDeductionMethod: SalaryIitBasicDeductionMethod;
  lowIncomeCurrentYearContinuedEmployment: boolean;
  lowIncomeEligibilityConfirmedAt: string;
  lowIncomePriorYearEveryMonthEmployment: boolean;
  lowIncomePriorYearGrossIncomeAmount: number;
  personalPensionAmount: number;
  personnelReportedAt: string;
  personnelReportingStatus: SalaryIitPersonnelReportingStatus;
  reportingFailureReason: string;
  submittedAt: string;
};

const reportingStatusTone = { 待报送: 'amber', 已报送: 'green', 报送异常: 'red' } as const;
const acquisitionStatusTone = { 待获取: 'amber', 已获取: 'green', 待更新: 'blue' } as const;
const taxYear = '2026';
const calculationMonth = `${taxYear}-06`;

function getDeductionAmount(profile: SalaryIitProfile, category: SalaryIitDeductionCategory) {
  return profile.deductionItems.find((item) => item.category === category)?.monthlyAmount ?? 0;
}

function profileToForm(profile: SalaryIitProfile): SalaryIitProfileForm {
  return {
    acquiredAt: profile.acquiredAt ?? dayjs().format('YYYY-MM-DD'),
    acquisitionStatus: profile.acquisitionStatus,
    basicDeductionMethod: profile.basicDeductionMethod,
    childEducationAmount: getDeductionAmount(profile, '子女教育'),
    continuingEducationAmount: getDeductionAmount(profile, '继续教育'),
    effectiveMonth: profile.deductionItems[0]?.effectiveFrom ?? `${profile.taxYear}-01`,
    elderlySupportAmount: getDeductionAmount(profile, '赡养老人'),
    employmentScenario: profile.employmentScenario,
    evidenceFiles: [...profile.evidenceFiles],
    firstEmploymentEvidenceFiles: [...profile.firstEmploymentEvidenceFiles],
    firstEmploymentMonth: profile.firstEmploymentMonth,
    housingLoanAmount: getDeductionAmount(profile, '住房贷款利息'),
    housingRentAmount: getDeductionAmount(profile, '住房租金'),
    infantCareAmount: getDeductionAmount(profile, '3岁以下婴幼儿照护'),
    lowIncomeCurrentYearContinuedEmployment: profile.lowIncomeEligibility?.currentYearContinuedEmployment ?? false,
    lowIncomeEligibilityConfirmedAt: profile.lowIncomeEligibility?.confirmedAt ?? dayjs().format('YYYY-MM-DD'),
    lowIncomePriorYearEveryMonthEmployment: profile.lowIncomeEligibility?.priorYearEveryMonthEmployment ?? false,
    lowIncomePriorYearGrossIncomeAmount: profile.lowIncomeEligibility?.priorYearGrossIncomeAmount ?? 0,
    personalPensionAmount: getDeductionAmount(profile, '个人养老金'),
    personnelReportedAt: profile.personnelReportedAt ?? dayjs().format('YYYY-MM-DD'),
    personnelReportingStatus: profile.personnelReportingStatus,
    reportingFailureReason: profile.reportingFailureReason ?? '',
    submittedAt: profile.submittedAt ?? dayjs().format('YYYY-MM-DD')
  };
}

function buildDeductionItems(employeeNo: string, form: SalaryIitProfileForm) {
  const values: Array<[SalaryIitDeductionCategory, number]> = [
    ['子女教育', form.childEducationAmount],
    ['3岁以下婴幼儿照护', form.infantCareAmount],
    ['继续教育', form.continuingEducationAmount],
    ['住房贷款利息', form.housingLoanAmount],
    ['住房租金', form.housingRentAmount],
    ['赡养老人', form.elderlySupportAmount],
    ['个人养老金', form.personalPensionAmount]
  ];

  return values.filter(([, amount]) => amount > 0).map(([category, monthlyAmount]) => ({
    category,
    effectiveFrom: form.effectiveMonth,
    id: `iit-deduction-${employeeNo}-${category}`,
    monthlyAmount
  }));
}

function formatMoney(amount: number) {
  return `${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 元`;
}

function getEditorTitle(kind: SalaryIitEditorKind) {
  if (kind === 'reporting') return '登记人员报送结果';
  if (kind === 'employee-form') return '录入员工扣除信息表';
  return '登记税务端获取结果';
}

export function SalaryPersonalIncomeTaxDeductionsPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const { peopleRows } = usePeopleOrganizationState();
  const salaryState = useSalaryManagementState();
  const [keyword, setKeyword] = useState('');
  const [reportingStatus, setReportingStatus] = useState<'全部' | SalaryIitPersonnelReportingStatus>('全部');
  const [acquisitionStatus, setAcquisitionStatus] = useState<'全部' | SalaryIitDeductionAcquisitionStatus>('全部');
  const [editorKind, setEditorKind] = useState<SalaryIitEditorKind>('reporting');
  const [previewFile, setPreviewFile] = useState<(SalaryIitEvidenceFile & { category: string })>();
  const drawer = useModeDrawerState<SalaryIitProfileRow, SalaryIitProfileForm>({
    createForm: (record) => profileToForm(record ?? ({ ...createSalaryIitProfile(peopleRows[0]?.id ?? '', taxYear), member: peopleRows[0] } as SalaryIitProfileRow)),
    detailForm: profileToForm,
    editForm: profileToForm
  });
  const rows = useMemo<SalaryIitProfileRow[]>(
    () => peopleRows.filter((member) => member.personnelType === '全职' && member.status !== '离职').map((member) => ({
      ...(salaryState.personalIncomeTaxProfiles.find((profile) => profile.employeeNo === member.id && profile.taxYear === taxYear) ?? createSalaryIitProfile(member.id, taxYear)),
      member
    })),
    [peopleRows, salaryState.personalIncomeTaxProfiles]
  );
  const filteredRows = useMemo(() => rows.filter((row) => {
    if (reportingStatus !== '全部' && row.personnelReportingStatus !== reportingStatus) return false;
    if (acquisitionStatus !== '全部' && row.acquisitionStatus !== acquisitionStatus) return false;
    const normalizedKeyword = keyword.trim().toLowerCase();
    return !normalizedKeyword || `${row.member.name} ${row.member.id} ${row.member.position}`.toLowerCase().includes(normalizedKeyword);
  }), [acquisitionStatus, keyword, reportingStatus, rows]);
  const activeRow = drawer.record ? rows.find((row) => row.employeeNo === drawer.record?.employeeNo) ?? drawer.record : undefined;
  const activeSummary = activeRow ? getSalaryIitDeductionSummary(activeRow, calculationMonth) : undefined;
  const metrics = {
    acquired: rows.filter((row) => row.acquisitionStatus === '已获取').length,
    acquisitionPending: rows.filter((row) => row.acquisitionStatus !== '已获取').length,
    reported: rows.filter((row) => row.personnelReportingStatus === '已报送').length,
    reportingPending: rows.filter((row) => row.personnelReportingStatus !== '已报送').length
  };

  function openEditor(kind: SalaryIitEditorKind) {
    setEditorKind(kind);
    drawer.openEdit(activeRow);
    if (kind === 'reporting' && activeRow?.personnelReportingStatus === '待报送') {
      drawer.setForm(profileToForm({ ...activeRow, personnelReportingStatus: '已报送' }));
    }
  }

  function validateDeductionForm(requireEvidence: boolean) {
    if (!drawer.form.effectiveMonth.startsWith(taxYear)) {
      void messageApi.warning(`生效月份必须属于 ${taxYear} 纳税年度`);
      return false;
    }
    if (drawer.form.housingLoanAmount > 0 && drawer.form.housingRentAmount > 0) {
      void messageApi.warning('住房贷款利息与住房租金不能在同一期间同时扣除');
      return false;
    }
    if (requireEvidence && drawer.form.evidenceFiles.length === 0) {
      void messageApi.warning('请上传员工提交的扣除信息表');
      return false;
    }
    return true;
  }

  function handleSave() {
    if (!activeRow) return;
    const updatedAt = dayjs().format('YYYY-MM-DD');
    let nextProfile: SalaryIitProfile;

    if (editorKind === 'reporting') {
      if (drawer.form.personnelReportingStatus === '待报送') {
        void messageApi.warning('请登记已报送或报送异常');
        return;
      }
      if (drawer.form.personnelReportingStatus === '报送异常' && !drawer.form.reportingFailureReason.trim()) {
        void messageApi.warning('请填写报送异常原因');
        return;
      }
      if (drawer.form.employmentScenario === '本年首次就业' && !drawer.form.firstEmploymentMonth) {
        void messageApi.warning('请选择首次就业月份');
        return;
      }
      if (
        drawer.form.employmentScenario === '本年首次就业' &&
        drawer.form.firstEmploymentEvidenceFiles.length === 0
      ) {
        void messageApi.warning('请上传首次就业佐证');
        return;
      }
      if (
        drawer.form.basicDeductionMethod === '全年6万元直接扣除' &&
        drawer.form.employmentScenario !== '普通任职'
      ) {
        void messageApi.warning('本年首次就业不适用全年 6 万元直接扣除');
        return;
      }
      if (
        drawer.form.basicDeductionMethod === '全年6万元直接扣除' &&
        (
          !drawer.form.lowIncomePriorYearEveryMonthEmployment ||
          !drawer.form.lowIncomeCurrentYearContinuedEmployment ||
          drawer.form.lowIncomePriorYearGrossIncomeAmount < 0 ||
          drawer.form.lowIncomePriorYearGrossIncomeAmount > 60000 ||
          !drawer.form.lowIncomeEligibilityConfirmedAt
        )
      ) {
        void messageApi.warning('请完整核定全年 6 万元直接扣除资格');
        return;
      }
      nextProfile = {
        ...activeRow,
        basicDeductionMethod: drawer.form.basicDeductionMethod,
        employmentScenario: drawer.form.employmentScenario,
        firstEmploymentEvidenceFiles: drawer.form.employmentScenario === '本年首次就业'
          ? drawer.form.firstEmploymentEvidenceFiles
          : [],
        firstEmploymentMonth: drawer.form.employmentScenario === '本年首次就业' ? drawer.form.firstEmploymentMonth : undefined,
        lowIncomeEligibility: drawer.form.basicDeductionMethod === '全年6万元直接扣除'
          ? {
              confirmedAt: drawer.form.lowIncomeEligibilityConfirmedAt,
              currentYearContinuedEmployment: drawer.form.lowIncomeCurrentYearContinuedEmployment,
              priorYearEveryMonthEmployment: drawer.form.lowIncomePriorYearEveryMonthEmployment,
              priorYearGrossIncomeAmount: drawer.form.lowIncomePriorYearGrossIncomeAmount
            }
          : undefined,
        personnelReportedAt: drawer.form.personnelReportedAt,
        personnelReportingStatus: drawer.form.personnelReportingStatus,
        reportingFailureReason: drawer.form.personnelReportingStatus === '报送异常' ? drawer.form.reportingFailureReason.trim() : undefined,
        updatedAt
      };
    } else {
      const isEmployeeForm = editorKind === 'employee-form';
      if (!validateDeductionForm(isEmployeeForm)) return;
      nextProfile = {
        ...activeRow,
        acquiredAt: isEmployeeForm ? drawer.form.submittedAt : drawer.form.acquiredAt,
        acquisitionStatus: '已获取',
        deductionItems: buildDeductionItems(activeRow.employeeNo, drawer.form),
        evidenceFiles: isEmployeeForm ? drawer.form.evidenceFiles : [],
        source: isEmployeeForm ? '员工提交扣除信息表' : '自然人电子税务局',
        submittedAt: isEmployeeForm ? drawer.form.submittedAt : undefined,
        updatedAt
      };
    }

    salaryState.savePersonalIncomeTaxProfile(nextProfile);
    drawer.syncRecord({ ...nextProfile, member: activeRow.member });
    drawer.backToDetail();
    void messageApi.success(`${getEditorTitle(editorKind)}已保存`);
  }

  function handleEvidenceSelect(file: UploadFile) {
    const nextFile: SalaryIitEvidenceFile = {
      id: `iit-evidence-${activeRow?.employeeNo ?? 'employee'}-${file.uid}`,
      name: file.name,
      status: '已上传',
      type: '扣除信息表',
      updatedAt: dayjs().format('YYYY-MM-DD')
    };
    drawer.updateForm('evidenceFiles', [nextFile]);
  }

  function handleFirstEmploymentEvidenceSelect(file: UploadFile) {
    const nextFile: SalaryIitEvidenceFile = {
      id: `iit-first-employment-${activeRow?.employeeNo ?? 'employee'}-${file.uid}`,
      name: file.name,
      status: '已上传',
      type: '首次就业佐证',
      updatedAt: dayjs().format('YYYY-MM-DD')
    };
    drawer.updateForm('firstEmploymentEvidenceFiles', [nextFile]);
  }

  const columns: TableColumnsType<SalaryIitProfileRow> = [
    { title: '员工', width: 190, render: (_, row) => <CompactCell primary={row.member.name} secondary={row.member.position} /> },
    { title: '工号', dataIndex: 'employeeNo', width: 112 },
    { title: '人员报送', dataIndex: 'personnelReportingStatus', width: 112, render: (value) => <StatusTag toneMap={reportingStatusTone} value={value} /> },
    { title: '扣除信息', dataIndex: 'acquisitionStatus', width: 112, render: (value) => <StatusTag toneMap={acquisitionStatusTone} value={value} /> },
    { title: '专项附加扣除', width: 146, render: (_, row) => formatMoney(getSalaryIitDeductionSummary(row, calculationMonth).additionalDeductionAmount) },
    { title: '其他扣除', width: 124, render: (_, row) => formatMoney(getSalaryIitDeductionSummary(row, calculationMonth).otherDeductionAmount) },
    { title: '信息来源', dataIndex: 'source', width: 170, render: (value?: SalaryIitDeductionSource) => value ?? '-' },
    { title: '更新日期', dataIndex: 'updatedAt', width: 118 }
  ];

  const detailTabs = activeRow ? [
    {
      key: 'base',
      label: '基础信息',
      children: (
        <DetailSection icon={<IdcardOutlined />} title="个税人员信息">
          <DetailInfoGrid columns={3} items={[
            { label: '员工', value: `${activeRow.member.name} / ${activeRow.employeeNo}` },
            { label: '证件号码', value: maskSalaryIitIdentityNo(activeRow.member.identityNo) },
            { label: '居民身份', value: activeRow.residentType },
            { label: '任职场景', value: activeRow.employmentScenario },
            { label: '首次就业月份', value: activeRow.firstEmploymentMonth ?? '-' },
            { label: '基本减除费用', value: activeRow.basicDeductionMethod },
            {
              label: '上年工资收入',
              value: activeRow.lowIncomeEligibility
                ? formatMoney(activeRow.lowIncomeEligibility.priorYearGrossIncomeAmount)
                : '-'
            },
            { label: '纳税年度', value: activeRow.taxYear },
            { label: '人员报送', value: <StatusTag toneMap={reportingStatusTone} value={activeRow.personnelReportingStatus} /> },
            { label: '报送日期', value: activeRow.personnelReportedAt ?? '-' },
            { label: '报送异常', value: activeRow.reportingFailureReason ?? '-' },
            { label: '扣除信息', value: <StatusTag toneMap={acquisitionStatusTone} value={activeRow.acquisitionStatus} /> },
            { label: '获取日期', value: activeRow.acquiredAt ?? '-' },
            { label: '信息来源', value: activeRow.source ?? '-' }
          ]} />
          {activeRow.firstEmploymentEvidenceFiles.length > 0 ? (
            <RelatedFileTable
              records={activeRow.firstEmploymentEvidenceFiles}
              onPreview={(file) => setPreviewFile({ ...file, category: file.type })}
            />
          ) : null}
        </DetailSection>
      )
    },
    {
      key: 'deductions',
      label: '扣除记录',
      children: (
        <>
          <DetailSection icon={<PercentageOutlined />} title="扣除项目">
            <DetailInfoGrid columns={3} items={activeRow.deductionItems.length > 0 ? activeRow.deductionItems.map((item) => ({
              label: item.category,
              value: `${formatMoney(item.monthlyAmount)} / ${item.effectiveFrom}起`
            })) : [{ label: '专项附加扣除', value: '0.00 元' }]} />
          </DetailSection>
          <DetailSection icon={<UploadOutlined />} title="来源资料">
            {activeRow.evidenceFiles.length > 0 ? (
              <RelatedFileTable
                records={activeRow.evidenceFiles}
                onPreview={(file) => setPreviewFile({ ...file, category: file.type })}
              />
            ) : <DetailInfoGrid columns={2} items={[{ label: '信息来源', value: activeRow.source ?? '-' }, { label: '资料文件', value: '-' }]} />}
          </DetailSection>
        </>
      )
    }
  ] : [];

  const deductionFields: Array<[keyof SalaryIitProfileForm, string]> = [
    ['childEducationAmount', '子女教育'],
    ['infantCareAmount', '3岁以下婴幼儿照护'],
    ['continuingEducationAmount', '继续教育'],
    ['housingLoanAmount', '住房贷款利息'],
    ['housingRentAmount', '住房租金'],
    ['elderlySupportAmount', '赡养老人'],
    ['personalPensionAmount', '个人养老金']
  ];

  return (
    <ManagementPageScaffold
      filters={<FilterPanel><FilterBar>
        <FilterField label="人员报送" controlWidth="status-select"><Select value={reportingStatus} options={['全部', '待报送', '已报送', '报送异常'].map((value) => ({ label: value, value }))} onChange={setReportingStatus} /></FilterField>
        <FilterField label="扣除信息" controlWidth="status-select"><Select value={acquisitionStatus} options={['全部', '待获取', '已获取', '待更新'].map((value) => ({ label: value, value }))} onChange={setAcquisitionStatus} /></FilterField>
        <KeywordFilter value={keyword} placeholder="员工 / 工号 / 岗位" onChange={setKeyword} />
      </FilterBar></FilterPanel>}
      layout="table-workbench"
      metrics={<MetricGrid columns={4}>
        <MetricCard icon={<SendOutlined />} label="已报送" value={`${metrics.reported} 人`} />
        <MetricCard icon={<AuditOutlined />} label="报送待处理" value={`${metrics.reportingPending} 人`} />
        <MetricCard icon={<CloudDownloadOutlined />} label="已获取" value={`${metrics.acquired} 人`} />
        <MetricCard icon={<WalletOutlined />} label="扣除待处理" value={`${metrics.acquisitionPending} 人`} />
      </MetricGrid>}
    >
      {contextHolder}
      <ManagementTable<SalaryIitProfileRow> columns={columns} count={{ unit: '人', value: filteredRows.length }} dataSource={filteredRows} rowKey="employeeNo" scrollX={1180} onRowClick={drawer.openDetail} />

      <DrawerFormShell
        bodyTestId="salary-iit-profile-drawer"
        detailActions={activeRow ? {
          closeAction: { label: '关闭', onClick: drawer.close },
          primaryAction: activeRow.personnelReportingStatus === '已报送'
            ? { icon: <CloudDownloadOutlined />, label: '登记获取结果', onClick: () => openEditor('tax-system-result') }
            : { icon: <SendOutlined />, label: '登记报送结果', onClick: () => openEditor('reporting') },
          secondaryAction: activeRow.personnelReportingStatus === '已报送'
            ? { icon: <UploadOutlined />, label: '录入员工资料', onClick: () => openEditor('employee-form') }
            : undefined
        } : undefined}
        formActions={{ cancelAction: { label: '取消', onClick: drawer.backToDetail }, primaryAction: { icon: <CheckCircleOutlined />, label: '保存', onClick: handleSave } }}
        mode={drawer.mode}
        open={drawer.open}
        title={activeRow ? <DetailDrawerTitle
          status={activeRow.personnelReportingStatus !== '已报送' ? activeRow.personnelReportingStatus : activeRow.acquisitionStatus}
          statusToneMap={{ ...reportingStatusTone, ...acquisitionStatusTone }}
          subtitle={`${activeRow.employeeNo} / ${taxYear}`}
          title={drawer.isDetailMode ? `${activeRow.member.name} 个税信息` : getEditorTitle(editorKind)}
        /> : null}
        width={1040}
        onClose={drawer.close}
      >
        {activeRow ? drawer.isDetailMode ? (
          <>
            <DetailSummaryCards columns={4} items={[
              { icon: <SendOutlined />, key: 'report', label: '人员报送', value: activeRow.personnelReportingStatus },
              { icon: <CloudDownloadOutlined />, key: 'acquisition', label: '扣除信息', value: activeRow.acquisitionStatus },
              { icon: <PercentageOutlined />, key: 'additional', label: '专项附加扣除', value: formatMoney(activeSummary?.additionalDeductionAmount ?? 0) },
              { icon: <WalletOutlined />, key: 'other', label: '其他扣除', value: formatMoney(activeSummary?.otherDeductionAmount ?? 0) }
            ]} />
            <DetailTabs items={detailTabs} tabTestIdPrefix="salary-iit-detail-tab" testId="salary-iit-detail-tabs" />
          </>
        ) : editorKind === 'reporting' ? (
          <DetailSection icon={<SendOutlined />} title="人员报送">
            <DrawerFormGrid>
              <DrawerFormField required label="报送结果"><Select value={drawer.form.personnelReportingStatus} options={['已报送', '报送异常'].map((value) => ({ label: value, value }))} onChange={(value) => drawer.updateForm('personnelReportingStatus', value)} /></DrawerFormField>
              <DrawerFormField required label="报送日期"><DatePicker value={dayjs(drawer.form.personnelReportedAt)} onChange={(value) => drawer.updateForm('personnelReportedAt', value?.format('YYYY-MM-DD') ?? '')} /></DrawerFormField>
              <DrawerFormField required label="任职场景"><Select value={drawer.form.employmentScenario} options={['普通任职', '本年首次就业'].map((value) => ({ label: value, value }))} onChange={(value) => {
                drawer.updateForm('employmentScenario', value);
                if (value === '本年首次就业') {
                  drawer.updateForm('basicDeductionMethod', '按月累计');
                }
              }} /></DrawerFormField>
              <DrawerFormField label="首次就业月份"><DatePicker disabled={drawer.form.employmentScenario !== '本年首次就业'} picker="month" value={drawer.form.firstEmploymentMonth ? dayjs(drawer.form.firstEmploymentMonth) : undefined} onChange={(value) => drawer.updateForm('firstEmploymentMonth', value?.format('YYYY-MM'))} /></DrawerFormField>
              <DrawerFormField required label="基本减除费用"><Select value={drawer.form.basicDeductionMethod} options={(drawer.form.employmentScenario === '本年首次就业' ? ['按月累计'] : ['按月累计', '全年6万元直接扣除']).map((value) => ({ label: value, value }))} onChange={(value) => drawer.updateForm('basicDeductionMethod', value)} /></DrawerFormField>
              {drawer.form.basicDeductionMethod === '全年6万元直接扣除' ? (
                <>
                  <DrawerFormField required label="上年工资收入"><InputNumber min={0} max={60000} precision={2} value={drawer.form.lowIncomePriorYearGrossIncomeAmount} onChange={(value) => drawer.updateForm('lowIncomePriorYearGrossIncomeAmount', Number(value ?? 0))} /></DrawerFormField>
                  <DrawerFormField required label="资格确认日期"><DatePicker value={dayjs(drawer.form.lowIncomeEligibilityConfirmedAt)} onChange={(value) => drawer.updateForm('lowIncomeEligibilityConfirmedAt', value?.format('YYYY-MM-DD') ?? '')} /></DrawerFormField>
                  <DrawerFormField label="上年连续任职"><Checkbox checked={drawer.form.lowIncomePriorYearEveryMonthEmployment} onChange={(event) => drawer.updateForm('lowIncomePriorYearEveryMonthEmployment', event.target.checked)}>全年各月均在本单位任职</Checkbox></DrawerFormField>
                  <DrawerFormField label="本年继续任职"><Checkbox checked={drawer.form.lowIncomeCurrentYearContinuedEmployment} onChange={(event) => drawer.updateForm('lowIncomeCurrentYearContinuedEmployment', event.target.checked)}>本年仍在本单位任职</Checkbox></DrawerFormField>
                </>
              ) : null}
              {drawer.form.employmentScenario === '本年首次就业' ? <div className="drawer-form-field drawer-form-field-wide"><FileSlot
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/png,image/jpeg"
                files={drawer.form.firstEmploymentEvidenceFiles}
                title="首次就业佐证"
                variant="list"
                onPreview={(file) => setPreviewFile({ ...file, category: file.type })}
                onRemove={() => drawer.updateForm('firstEmploymentEvidenceFiles', [])}
                onSelect={handleFirstEmploymentEvidenceSelect}
              /></div> : null}
              {drawer.form.personnelReportingStatus === '报送异常' ? <DrawerFormField required wide label="异常原因"><Input.TextArea rows={3} value={drawer.form.reportingFailureReason} onChange={(event) => drawer.updateForm('reportingFailureReason', event.target.value)} /></DrawerFormField> : null}
            </DrawerFormGrid>
          </DetailSection>
        ) : (
          <DetailSection icon={editorKind === 'employee-form' ? <UploadOutlined /> : <CloudDownloadOutlined />} title={getEditorTitle(editorKind)}>
            <DrawerFormGrid>
              <DrawerFormField required label={editorKind === 'employee-form' ? '员工提交日期' : '获取日期'}><DatePicker value={dayjs(editorKind === 'employee-form' ? drawer.form.submittedAt : drawer.form.acquiredAt)} onChange={(value) => drawer.updateForm(editorKind === 'employee-form' ? 'submittedAt' : 'acquiredAt', value?.format('YYYY-MM-DD') ?? '')} /></DrawerFormField>
              <DrawerFormField required label="生效月份"><DatePicker picker="month" value={dayjs(drawer.form.effectiveMonth)} onChange={(value) => drawer.updateForm('effectiveMonth', value?.format('YYYY-MM') ?? '')} /></DrawerFormField>
              {deductionFields.map(([field, label]) => <DrawerFormField key={field} label={`${label}（月）`}><InputNumber min={0} precision={2} value={drawer.form[field] as number} onChange={(value) => drawer.updateForm(field, Number(value ?? 0) as never)} /></DrawerFormField>)}
              {editorKind === 'employee-form' ? <div className="drawer-form-field drawer-form-field-wide"><FileSlot
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/png,image/jpeg"
                description="员工直接提交给公司时必须保留扣除信息表。"
                files={drawer.form.evidenceFiles}
                title="扣除信息表"
                variant="list"
                onPreview={(file) => setPreviewFile({ ...file, category: file.type })}
                onRemove={() => drawer.updateForm('evidenceFiles', [])}
                onSelect={handleEvidenceSelect}
              /></div> : null}
            </DrawerFormGrid>
          </DetailSection>
        ) : null}
      </DrawerFormShell>

      <FilePreviewModal file={previewFile} title={`${previewFile?.type ?? '资料'}预览`} onClose={() => setPreviewFile(undefined)} />
    </ManagementPageScaffold>
  );
}
