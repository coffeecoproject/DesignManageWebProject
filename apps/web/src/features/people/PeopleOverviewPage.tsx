import {
  AlertOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CalculatorOutlined,
  TeamOutlined,
  WalletOutlined
} from '@ant-design/icons';
import { Select, Space } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo, useState, type ReactNode } from 'react';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag } from '../../components/Detail';
import type { StatusTagTone } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DrawerProfileCard } from '../../components/DrawerProfileCard';
import { DetailDrawerShell } from '../../components/DrawerShell';
import { FilterBar, FilterField, FilterPanel, KeywordFilter } from '../../components/FilterControls';
import { ManagementPageScaffold } from '../../components/ManagementPageScaffold';
import { ManagementTable } from '../../components/ManagementTable';
import { MetricCard } from '../../components/MetricCard';
import { MetricGrid } from '../../components/MetricGrid';
import { TagChipList } from '../../components/TagChip';
import { CellText, CompactCell } from '../../components/TableCell';
import { useFinanceManagement } from '../finance/FinanceManagementState';
import type { FinanceTransactionRecord } from '../finance/financeData';
import { usePerformanceRuleState } from '../performance/PerformanceRuleState';
import type { PerformanceMonthlyCategoryRecord, PerformanceRulePreset } from '../performance/performanceTypes';
import { usePerformanceResults } from '../performance/usePerformanceResults';
import { useWorkCalendarState, type AnnualExceptionConfigRow, type WorkCalendarRow } from '../system/WorkCalendarState';
import { useTaskManagementState, type StoreTaskRecord } from '../tasks/TaskManagementState';
import { peopleAttendanceToday, peopleOrganizationToday, usePeopleOrganizationState, type PeopleAttendanceRecord } from './PeopleOrganizationState';
import {
  getPeopleBaseSalaryText,
  getPeopleHousingFundStatus,
  getPeopleOngoingTaskCount,
  getPeopleOverviewAvailabilitySummary,
  getPeopleRelationPeriodText,
  getPeopleSalaryModeText,
  isPeopleRelationshipActive,
  type PeopleOverviewAvailabilitySummary
} from './peopleDomain';
import {
  createPeopleExpiryRows,
  formatPeopleExpiryDays,
  getPeopleExpiryMetrics,
  type PeopleExpiryRow,
  type PeopleExpiryUrgency
} from './peopleExpiryModel';
import { getPeoplePerformanceRuleRiskLabels, peoplePerformanceTerminationRiskLabel } from './peoplePerformanceRiskModel';
import { formatSalaryMoney } from '../salary/salaryDomain';
import { useSalaryMonthlyReportBuilder } from '../salary/salaryReportBuilder';
import type { SalaryMonthlyReport } from '../salary/salaryDomain';
import type { PeopleFilters, PeopleMember, PeopleStatus } from './peopleTypes';

type PeopleExpiryRiskFilter = '全部' | '即将到期' | '已到期' | '无到期风险';

type PeopleSearchFilters = {
  expiryRisk: PeopleExpiryRiskFilter;
  keyword: string;
  personnelType: PeopleFilters['personnelType'];
  status: PeopleFilters['status'];
};

type PeopleOverviewSummary = {
  averagePerformanceScore: number | null;
  averageSalaryText: string;
  evaluationPeriodCount: number;
  monthlyCompletedAverage: number | null;
  monthlyCompletedTotal: number;
  previousPerformanceRecord?: PerformanceMonthlyCategoryRecord;
  previousPerformanceText: string;
  salaryMode: ReturnType<typeof getPeopleSalaryModeText>;
  salarySourceText: string;
};

const defaultFilters: PeopleSearchFilters = {
  expiryRisk: '全部',
  keyword: '',
  personnelType: '全部',
  status: '全部'
};

const activeFulltimeStatuses: PeopleStatus[] = ['试用期', '在职'];
const activeParttimeStatuses: PeopleStatus[] = ['合作中'];
const expiryRiskOptions: PeopleExpiryRiskFilter[] = ['全部', '即将到期', '已到期', '无到期风险'];

const typeTone = {
  全职: 'blue',
  兼职: 'purple'
} as const;

const statusTone = {
  试用期: 'amber',
  在职: 'green',
  离职: 'gray',
  合作中: 'blue',
  结束合作: 'gray'
} as const;

const riskTone: Record<string, StatusTagTone> = {
  正常: 'green',
  试用期已逾期: 'red',
  试用期将到期: 'amber',
  劳动合同已逾期: 'red',
  劳动合同将到期: 'amber',
  合作协议已逾期: 'red',
  合作将到期: 'amber',
  [peoplePerformanceTerminationRiskLabel]: 'red',
  平均绩效待关注: 'amber',
  任务参与暂停: 'amber'
};

const expiryUrgencyTone: Record<PeopleExpiryUrgency, StatusTagTone> = {
  已逾期: 'red',
  '7天内': 'red',
  '30天内': 'amber',
  '90天内': 'blue',
  远期: 'gray'
};

const statusSortPriority: Partial<Record<PeopleStatus, number>> = {
  试用期: 0,
  在职: 1,
  合作中: 2
};

const moneyFormatter = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0
});

const overviewPerformanceMonth = getPreviousMonth(peopleOrganizationToday.slice(0, 7));

function formatMoney(value: number) {
  return Number.isFinite(value) && value > 0 ? `${moneyFormatter.format(Math.round(value * 100) / 100)} 元` : '-';
}

function formatScoreValue(score: number | null) {
  if (score === null) {
    return '-';
  }

  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function formatAverageCount(value: number | null) {
  if (value === null) {
    return '-';
  }

  return Number.isInteger(value) ? `${value} 项` : `${value.toFixed(1)} 项`;
}

function getPreviousMonth(month: string) {
  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthNumber = Number(monthText);

  if (!Number.isFinite(year) || !Number.isFinite(monthNumber)) {
    return month;
  }

  if (monthNumber <= 1) {
    return `${year - 1}-12`;
  }

  return `${year}-${String(monthNumber - 1).padStart(2, '0')}`;
}

function parseSalaryAmount(salaryText: string | undefined) {
  const matched = salaryText?.replace(/,/g, '').match(/\d+(?:\.\d+)?/);

  return matched ? Number(matched[0]) : 0;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function averageOrNull(values: number[]) {
  return values.length > 0 ? average(values) : null;
}

function getOverviewStatusOptions(personnelType: PeopleFilters['personnelType']) {
  if (personnelType === '全职') {
    return ['全部', ...activeFulltimeStatuses];
  }

  if (personnelType === '兼职') {
    return ['全部', ...activeParttimeStatuses];
  }

  return ['全部', ...activeFulltimeStatuses, ...activeParttimeStatuses];
}

function isOverviewStatusValidForType(status: PeopleFilters['status'], personnelType: PeopleFilters['personnelType']) {
  return getOverviewStatusOptions(personnelType).includes(status);
}

function renderOverviewAvailabilityStatus(summary: PeopleOverviewAvailabilitySummary): ReactNode {
  if (summary.status === '-') {
    return '-';
  }

  return <StatusTag tone={summary.tone} value={summary.status} />;
}

function getPerformanceSignalClassName(score: number | null) {
  if (score === null) {
    return 'performance-signal-value';
  }

  if (score < 80) {
    return 'performance-signal-value performance-signal-value-amber';
  }

  if (score >= 90) {
    return 'performance-signal-value performance-signal-value-green';
  }

  return 'performance-signal-value performance-signal-value-blue';
}

function getPeopleOverviewSummary(
  member: PeopleMember,
  publishedPerformanceRecords: PerformanceMonthlyCategoryRecord[] = []
): PeopleOverviewSummary {
  const records = publishedPerformanceRecords
    .filter(
      (record) => record.workNo === member.id && record.resultResponseStatus !== '有异议'
    )
    .sort((left, right) => right.performanceMonth.localeCompare(left.performanceMonth));
  const performanceScores = records
    .map((record) => record.qualityScore ?? record.taskScore)
    .filter((score): score is number => typeof score === 'number');
  const averagePerformanceScore = averageOrNull(performanceScores);
  const monthlyCompletedAverage = averageOrNull(records.map((record) => record.sourceTaskCount));
  const monthlyCompletedTotal = records.reduce((total, record) => total + record.sourceTaskCount, 0);
  const baseSalaryText = getPeopleBaseSalaryText(member);
  const salaryAmount = parseSalaryAmount(baseSalaryText);
  const salaryMode = getPeopleSalaryModeText(member);
  const previousPerformanceRecord = records.find(
    (record) => record.performanceMonth === overviewPerformanceMonth
  );
  const previousScore = previousPerformanceRecord?.qualityScore ?? previousPerformanceRecord?.taskScore;

  return {
    averagePerformanceScore,
    averageSalaryText: member.personnelType === '兼职' ? '按任务结算' : formatMoney(salaryAmount),
    evaluationPeriodCount: records.length,
    monthlyCompletedAverage,
    monthlyCompletedTotal,
    previousPerformanceRecord,
    previousPerformanceText: previousPerformanceRecord && typeof previousScore === 'number'
      ? `${formatScoreValue(previousScore)} 分`
      : '-',
    salaryMode,
    salarySourceText: member.personnelType === '兼职' ? member.salaryProfile.taskRateRule ?? '按任务规则' : baseSalaryText
  };
}

function getSocialInsuranceText(member: PeopleMember) {
  return member.personnelType === '全职' ? '缴纳' : '不缴纳';
}

function getHousingFundText(member: PeopleMember) {
  return member.personnelType === '全职' && getPeopleHousingFundStatus(member) === '缴存' ? '缴纳' : '不缴纳';
}

function getLatestSalaryDetailMonth(months: string[]) {
  return [...months].sort((left, right) => right.localeCompare(left))[0];
}

function getReportByMemberId(reports: SalaryMonthlyReport[]) {
  return new Map(reports.map((report) => [report.member.id, report]));
}

function getParttimeActualPayAmount(member: PeopleMember, financeRows: FinanceTransactionRecord[], preferredMonth?: string) {
  if (member.personnelType !== '兼职') {
    return 0;
  }

  const settlementRows = financeRows.filter(
    (record) =>
      record.counterparty === member.name &&
      record.counterpartyType === '外协' &&
      record.direction === '支出' &&
      record.sourceType === '外协结算' &&
      record.status !== '已作废'
  );

  if (preferredMonth) {
    return settlementRows
      .filter((record) => record.accountingPeriod === preferredMonth)
      .reduce((total, record) => total + record.amount, 0);
  }

  const monthlyAmounts = new Map<string, number>();

  for (const record of settlementRows) {
    monthlyAmounts.set(record.accountingPeriod, (monthlyAmounts.get(record.accountingPeriod) ?? 0) + record.amount);
  }

  return average([...monthlyAmounts.values()]);
}

function getMemberExpiryRows(expiryRowsByMemberId: Map<string, PeopleExpiryRow[]>, memberId: string) {
  return expiryRowsByMemberId.get(memberId) ?? [];
}

function getExpiryRiskRows(expiryRows: PeopleExpiryRow[]) {
  return expiryRows.filter((row) => row.status === '已逾期' || (row.daysToDue >= 0 && row.daysToDue <= 30));
}

function getExpiryRiskFilterValue(expiryRows: PeopleExpiryRow[]): Exclude<PeopleExpiryRiskFilter, '全部'> {
  const riskRows = getExpiryRiskRows(expiryRows);

  if (riskRows.some((row) => row.status === '已逾期')) {
    return '已到期';
  }

  if (riskRows.length > 0) {
    return '即将到期';
  }

  return '无到期风险';
}

function getExpiryRiskLabel(row: PeopleExpiryRow) {
  if (row.type === '试用期到期') {
    return row.status === '已逾期' ? '试用期已逾期' : '试用期将到期';
  }

  if (row.type === '劳动合同到期') {
    return row.status === '已逾期' ? '劳动合同已逾期' : '劳动合同将到期';
  }

  return row.status === '已逾期' ? '合作协议已逾期' : '合作将到期';
}

function getRiskItems(
  member: PeopleMember,
  expiryRows: PeopleExpiryRow[] = [],
  performanceRuleRows: PerformanceRulePreset[] = [],
  publishedPerformanceRecords: PerformanceMonthlyCategoryRecord[] = []
) {
  const risks: string[] = [];
  const summary = getPeopleOverviewSummary(member, publishedPerformanceRecords);
  const expiryRiskItems = getExpiryRiskRows(expiryRows).map((row) => getExpiryRiskLabel(row));
  const performanceRuleRiskItems = getPeoplePerformanceRuleRiskLabels(
    member,
    performanceRuleRows,
    publishedPerformanceRecords
  );

  risks.push(...expiryRiskItems);
  risks.push(...performanceRuleRiskItems);

  if (
    summary.averagePerformanceScore !== null
    && summary.averagePerformanceScore < 80
    && performanceRuleRiskItems.length === 0
  ) {
    risks.push('平均绩效待关注');
  }

  if (member.taskAccessStatus === '暂停参与') {
    risks.push('任务参与暂停');
  }

  return risks.length > 0 ? risks : ['正常'];
}

function getRiskSortWeight(risks: string[]) {
  return risks.length === 1 && risks[0] === '正常' ? 0 : risks.length;
}

function comparePeopleMembers(
  left: PeopleMember,
  right: PeopleMember,
  expiryRowsByMemberId: Map<string, PeopleExpiryRow[]>,
  performanceRuleRows: PerformanceRulePreset[],
  publishedPerformanceRecords: PerformanceMonthlyCategoryRecord[]
) {
  return (
    (statusSortPriority[left.status] ?? 9) - (statusSortPriority[right.status] ?? 9) ||
    getRiskSortWeight(
      getRiskItems(
        right,
        getMemberExpiryRows(expiryRowsByMemberId, right.id),
        performanceRuleRows,
        publishedPerformanceRecords
      )
    ) -
      getRiskSortWeight(
        getRiskItems(
          left,
          getMemberExpiryRows(expiryRowsByMemberId, left.id),
          performanceRuleRows,
          publishedPerformanceRecords
        )
      ) ||
    left.id.localeCompare(right.id)
  );
}

function RiskTags({ mode = 'detail', risks }: { mode?: 'detail' | 'table'; risks: string[] }) {
  const compact = mode === 'table';

  return (
    <TagChipList
      items={risks}
      maxVisible={compact ? 1 : risks.length}
      overflowVariant={compact ? 'compact-overflow' : 'default'}
      tone={(risk) => riskTone[String(risk)] ?? 'gray'}
      variant={compact ? 'compact' : 'default'}
      wrap={!compact}
    />
  );
}

function PeopleStatusDrawer({
  annualExceptionRows,
  attendanceRecords,
  expiryRows,
  member,
  open,
  performanceRecords,
  performanceRuleRows,
  storeTaskRows,
  workCalendarRows,
  onClose
}: {
  annualExceptionRows: AnnualExceptionConfigRow[];
  attendanceRecords: PeopleAttendanceRecord[];
  expiryRows: PeopleExpiryRow[];
  member?: PeopleMember;
  open: boolean;
  performanceRecords: PerformanceMonthlyCategoryRecord[];
  performanceRuleRows: PerformanceRulePreset[];
  storeTaskRows: StoreTaskRecord[];
  workCalendarRows: WorkCalendarRow[];
  onClose: () => void;
}) {
  if (!member) {
    return null;
  }

  const summary = getPeopleOverviewSummary(member, performanceRecords);
  const risks = getRiskItems(member, expiryRows, performanceRuleRows, performanceRecords);
  const riskSummary = risks.length === 1 && risks[0] === '正常' ? '正常' : `${risks.length} 项`;
  const availabilitySummary = getPeopleOverviewAvailabilitySummary(member, attendanceRecords, workCalendarRows, annualExceptionRows, peopleAttendanceToday);
  const ongoingTaskCount = getPeopleOngoingTaskCount(member.id, storeTaskRows);
  const expiryReminderItems =
    expiryRows.length > 0
      ? expiryRows.map((row) => ({
          label: row.type,
          value: (
            <Space size={6} wrap>
              <StatusTag toneMap={expiryUrgencyTone} value={row.urgency} />
              <span>{`${row.dueAt} / ${formatPeopleExpiryDays(row)}`}</span>
            </Space>
          ),
          wide: true
        }))
      : [{ label: '到期提醒', value: '无即将到期事项', wide: true }];

  return (
    <DetailDrawerShell
      open={open}
      title={
        <DetailDrawerTitle
          status={`${member.personnelType} / ${member.status}`}
          statusTone={statusTone[member.status]}
          subtitle="人员组织 / 人员总览"
          title="人员详情"
        />
      }
      width={760}
      onClose={onClose}
    >
      <DrawerProfileCard
        avatar={member.name.slice(-1)}
        subtitle={`${member.id} / ${member.position} / ${member.city}`}
        tags={[
          <StatusTag key="type" toneMap={typeTone} value={member.personnelType} />,
          <StatusTag key="status" toneMap={statusTone} value={member.status} />
        ]}
        title={member.name}
      />

      <DetailSummaryCards
        columns={4}
        items={[
          {
            description: summary.salaryMode,
            icon: <WalletOutlined />,
            key: 'salary',
            label: '平均薪酬',
            value: summary.averageSalaryText
          },
          {
            description: `近 ${summary.evaluationPeriodCount} 期`,
            icon: <CheckCircleOutlined />,
            key: 'performance',
            label: '平均绩效',
            value: (
              <span className={getPerformanceSignalClassName(summary.averagePerformanceScore)}>
                {formatScoreValue(summary.averagePerformanceScore)}
              </span>
            )
          },
          {
            description: '已发布绩效结果',
            icon: <ClockCircleOutlined />,
            key: 'tasks',
            label: '月均完成任务',
            value: formatAverageCount(summary.monthlyCompletedAverage)
          },
          {
            description: risks.join('、'),
            icon: <AlertOutlined />,
            key: 'risk',
            label: '人员风险',
            value: riskSummary
          }
        ]}
      />

      <DetailTabs
        defaultActiveKey="basic"
        tabTestIdPrefix="people-overview-detail-tab"
        testId="people-overview-detail-tabs"
        items={[
          {
            key: 'basic',
            label: '基础信息',
            children: (
              <DetailSection icon={<TeamOutlined />} title="基础信息">
                <DetailInfoGrid
                  columns={3}
                  items={[
                    { label: '人员编号', value: member.id },
                    { label: '人员类型', value: <StatusTag toneMap={typeTone} value={member.personnelType} /> },
                    { label: '状态', value: <StatusTag toneMap={statusTone} value={member.status} /> },
                    { label: '岗位', value: member.position },
                    { label: '常驻城市', value: member.city },
                    { label: '人员来源', value: member.source },
                    { label: '社保', value: getSocialInsuranceText(member) },
                    { label: '公积金', value: getHousingFundText(member) },
                    { label: '关系起始', value: member.personnelType === '兼职' ? member.cooperationStartAt ?? member.joinedAt : member.joinedAt },
                    { label: '关系摘要', value: getPeopleRelationPeriodText(member) }
                  ]}
                />
              </DetailSection>
            )
          },
          {
            key: 'compensation',
            label: '绩效薪酬',
            children: (
              <>
                <DetailSection icon={<WalletOutlined />} title="薪酬摘要">
                  <DetailInfoGrid
                    columns={3}
                    items={[
                      { label: '平均薪酬', value: summary.averageSalaryText },
                      { label: '薪酬模式', value: summary.salaryMode },
                      { label: '薪酬口径', value: summary.salarySourceText }
                    ]}
                  />
                </DetailSection>
                <DetailSection icon={<CheckCircleOutlined />} title="绩效摘要">
                  <DetailInfoGrid
                    columns={3}
                    items={[
                      {
                        label: '平均绩效',
                        value: (
                          <span className={getPerformanceSignalClassName(summary.averagePerformanceScore)}>
                            {formatScoreValue(summary.averagePerformanceScore)}
                          </span>
                        )
                      },
                      { label: '统计期数', value: `${summary.evaluationPeriodCount} 期` },
                      { label: '上月绩效', value: summary.previousPerformanceText },
                      { label: '绩效月份', value: summary.previousPerformanceRecord?.performanceMonth ?? overviewPerformanceMonth },
                      { label: '上月绩效金额', value: summary.previousPerformanceRecord ? formatMoney(summary.previousPerformanceRecord.monthlyAmount) : '-' },
                      { label: '上月来源任务', value: summary.previousPerformanceRecord ? `${summary.previousPerformanceRecord.sourceTaskCount} 项` : '-' }
                    ]}
                  />
                </DetailSection>
              </>
            )
          },
          {
            key: 'tasks',
            label: '任务',
            children: (
              <DetailSection icon={<ClockCircleOutlined />} title="任务摘要">
                <DetailInfoGrid
                  columns={3}
                  items={[
                    { label: '参与状态', value: member.taskAccessStatus },
                    { label: '在岗状态', value: renderOverviewAvailabilityStatus(availabilitySummary) },
                    { label: '进行中任务', value: `${ongoingTaskCount} 个` },
                    { label: '月均完成任务', value: formatAverageCount(summary.monthlyCompletedAverage) },
                    { label: '累计来源任务', value: summary.evaluationPeriodCount > 0 ? `${summary.monthlyCompletedTotal} 项` : '-' }
                  ]}
                />
              </DetailSection>
            )
          },
          {
            key: 'risk',
            label: '风险',
            children: (
              <>
                <DetailSection icon={<AlertOutlined />} title="人员风险">
                  <DetailInfoGrid
                    columns={2}
                    items={[
                      { label: '风险状态', value: <RiskTags risks={risks} />, wide: true },
                      { label: '风险数量', value: riskSummary },
                      { label: '到期风险', value: getExpiryRiskFilterValue(expiryRows) }
                    ]}
                  />
                </DetailSection>
                <DetailSection icon={<CalendarOutlined />} title="到期提醒">
                  <DetailInfoGrid columns={2} items={expiryReminderItems} />
                </DetailSection>
              </>
            )
          }
        ]}
      />
    </DetailDrawerShell>
  );
}

export function PeopleOverviewPage() {
  const { attendanceRecords, peopleRows } = usePeopleOrganizationState();
  const { financeRows } = useFinanceManagement();
  const { performanceRuleRows } = usePerformanceRuleState();
  const { publishedMonthlyRecords } = usePerformanceResults();
  const { storeTaskRows } = useTaskManagementState();
  const { annualExceptionRows, workCalendarRows } = useWorkCalendarState();
  const { getSalaryMonthlyReports, salaryState } = useSalaryMonthlyReportBuilder();
  const [filters, setFilters] = useState<PeopleSearchFilters>(defaultFilters);
  const [activeMemberId, setActiveMemberId] = useState<string>();
  const [detailOpen, setDetailOpen] = useState(false);

  const overviewMembers = useMemo(() => peopleRows.filter(isPeopleRelationshipActive), [peopleRows]);
  const expiryRows = useMemo(() => createPeopleExpiryRows(overviewMembers, { today: peopleOrganizationToday }), [overviewMembers]);
  const expiryRowsByMemberId = useMemo(() => {
    const groupedRows = new Map<string, PeopleExpiryRow[]>();

    for (const row of expiryRows) {
      groupedRows.set(row.member.id, [...(groupedRows.get(row.member.id) ?? []), row]);
    }

    return groupedRows;
  }, [expiryRows]);
  const expiryMetrics = useMemo(() => getPeopleExpiryMetrics(expiryRows), [expiryRows]);
  const statusOptions = useMemo(() => getOverviewStatusOptions(filters.personnelType), [filters.personnelType]);
  const activeMember = useMemo(() => overviewMembers.find((member) => member.id === activeMemberId), [activeMemberId, overviewMembers]);
  const activeMemberExpiryRows = activeMember ? getMemberExpiryRows(expiryRowsByMemberId, activeMember.id) : [];
  const currentSalaryMonth = useMemo(() => getLatestSalaryDetailMonth(salaryState.salaryDetailMonths), [salaryState.salaryDetailMonths]);
  const salaryReports = useMemo(
    () => (currentSalaryMonth ? getSalaryMonthlyReports(currentSalaryMonth) : []),
    [currentSalaryMonth, getSalaryMonthlyReports]
  );
  const salaryReportsByMemberId = useMemo(() => getReportByMemberId(salaryReports), [salaryReports]);

  const metrics = useMemo(() => {
    const risk = overviewMembers.filter(
      (member) => getRiskItems(
        member,
        getMemberExpiryRows(expiryRowsByMemberId, member.id),
        performanceRuleRows,
        publishedMonthlyRecords
      )[0] !== '正常'
    ).length;
    const fulltimeSalaryReports = overviewMembers
      .filter((member) => member.personnelType === '全职')
      .map((member) => salaryReportsByMemberId.get(member.id))
      .filter((report): report is SalaryMonthlyReport => Boolean(report));
    const overviewSummaries = overviewMembers.map((member) => getPeopleOverviewSummary(member, publishedMonthlyRecords));
    const performanceScores = overviewSummaries
      .map((summary) => summary.averagePerformanceScore)
      .filter((score): score is number => score !== null);
    const taskVolumes = overviewSummaries
      .map((summary) => summary.monthlyCompletedAverage)
      .filter((value): value is number => value !== null);
    const parttimeActualPayAmounts = overviewMembers
      .filter((member) => member.personnelType === '兼职')
      .map((member) => getParttimeActualPayAmount(member, financeRows, currentSalaryMonth));

    return {
      averageFulltimeNetSalary: average(fulltimeSalaryReports.map((report) => report.netSalary)),
      averagePerformance: averageOrNull(performanceScores),
      averageTaskVolume: averageOrNull(taskVolumes),
      averageParttimeActualPay: average(parttimeActualPayAmounts),
      total: overviewMembers.length,
      fulltime: overviewMembers.filter((member) => member.personnelType === '全职').length,
      parttime: overviewMembers.filter((member) => member.personnelType === '兼职').length,
      risk,
      expiryWithin30Days: expiryMetrics.within30Days
    };
  }, [currentSalaryMonth, expiryMetrics, expiryRowsByMemberId, financeRows, overviewMembers, performanceRuleRows, publishedMonthlyRecords, salaryReportsByMemberId]);

  const filteredMembers = useMemo(
    () =>
      overviewMembers
        .filter((member) => {
          const keyword = filters.keyword.trim().toLowerCase();
          const memberExpiryRows = getMemberExpiryRows(expiryRowsByMemberId, member.id);
          const expiryRisk = getExpiryRiskFilterValue(memberExpiryRows);
          const matchesType = filters.personnelType === '全部' || member.personnelType === filters.personnelType;
          const matchesStatus = filters.status === '全部' || member.status === filters.status;
          const matchesExpiryRisk = filters.expiryRisk === '全部' || filters.expiryRisk === expiryRisk;
          const expiryKeywordBucket = memberExpiryRows.map((row) => `${row.type} ${row.dueAt} ${row.urgency} ${formatPeopleExpiryDays(row)}`).join(' ');
          const matchesKeyword =
            keyword.length === 0 ||
            member.name.toLowerCase().includes(keyword) ||
            member.id.toLowerCase().includes(keyword) ||
            member.position.toLowerCase().includes(keyword) ||
            member.contractNo.toLowerCase().includes(keyword) ||
            expiryKeywordBucket.toLowerCase().includes(keyword);

          return matchesType && matchesStatus && matchesExpiryRisk && matchesKeyword;
        })
        .sort((left, right) => comparePeopleMembers(
          left,
          right,
          expiryRowsByMemberId,
          performanceRuleRows,
          publishedMonthlyRecords
        )),
    [expiryRowsByMemberId, filters, overviewMembers, performanceRuleRows, publishedMonthlyRecords]
  );

  const columns = useMemo<TableColumnsType<PeopleMember>>(
    () => [
      {
        title: '工号',
        dataIndex: 'id',
        key: 'id',
        width: 96,
        render: (id: PeopleMember['id']) => <CellText>{id}</CellText>
      },
      {
        title: '人员',
        key: 'person',
        width: 150,
        render: (_, record) => <CompactCell primary={record.name} secondary={record.position} />
      },
      {
        title: '类型状态',
        key: 'typeStatus',
        align: 'center',
        width: 116,
        render: (_, record) => <StatusTag tone={statusTone[record.status]} value={`${record.personnelType} / ${record.status}`} />
      },
      {
        title: '平均薪酬',
        key: 'averageSalary',
        align: 'right',
        width: 116,
        render: (_, record) => <CellText>{getPeopleOverviewSummary(record, publishedMonthlyRecords).averageSalaryText}</CellText>
      },
      {
        title: '社保',
        key: 'socialInsurance',
        align: 'center',
        width: 76,
        render: (_, record) => <CellText>{getSocialInsuranceText(record)}</CellText>
      },
      {
        title: '公积金',
        key: 'housingFund',
        align: 'center',
        width: 86,
        render: (_, record) => <CellText>{getHousingFundText(record)}</CellText>
      },
      {
        title: '人员风险',
        key: 'risk',
        width: 170,
        render: (_, record) => (
          <RiskTags
            mode="table"
            risks={getRiskItems(
              record,
              getMemberExpiryRows(expiryRowsByMemberId, record.id),
              performanceRuleRows,
              publishedMonthlyRecords
            )}
          />
        )
      },
      {
        title: '在岗状态',
        key: 'availability',
        align: 'center',
        width: 110,
        render: (_, record) => {
          const availabilitySummary = getPeopleOverviewAvailabilitySummary(record, attendanceRecords, workCalendarRows, annualExceptionRows, peopleAttendanceToday);

          return <CompactCell align="center" primarySlot={renderOverviewAvailabilityStatus(availabilitySummary)} />;
        }
      },
      {
        title: '月均完成任务',
        key: 'averageCompletedTasks',
        align: 'center',
        width: 122,
        render: (_, record) => (
          <CellText>{formatAverageCount(getPeopleOverviewSummary(record, publishedMonthlyRecords).monthlyCompletedAverage)}</CellText>
        )
      },
      {
        title: '平均绩效',
        key: 'averagePerformance',
        align: 'center',
        width: 108,
        render: (_, record) => {
          const summary = getPeopleOverviewSummary(record, publishedMonthlyRecords);

          return (
            <CompactCell
              align="center"
              primarySlot={
                <span className={getPerformanceSignalClassName(summary.averagePerformanceScore)}>
                  {formatScoreValue(summary.averagePerformanceScore)}
                </span>
              }
              secondary={`近 ${summary.evaluationPeriodCount} 期`}
            />
          );
        }
      }
    ],
    [annualExceptionRows, attendanceRecords, expiryRowsByMemberId, performanceRuleRows, publishedMonthlyRecords, workCalendarRows]
  );

  return (
    <ManagementPageScaffold
      layout="table-workbench"
      metrics={
        <>
          <MetricGrid columns={5}>
            <MetricCard label="在册人员" value={metrics.total} icon={<TeamOutlined />} />
            <MetricCard label="全职" value={metrics.fulltime} icon={<TeamOutlined />} />
            <MetricCard label="兼职" value={metrics.parttime} icon={<TeamOutlined />} />
            <MetricCard label="人员风险" value={metrics.risk} icon={<AlertOutlined />} />
            <MetricCard label="30天到期" value={metrics.expiryWithin30Days} icon={<CalendarOutlined />} />
          </MetricGrid>
          <MetricGrid columns={4} density="compact">
            <MetricCard label="全职平均实发" value={formatSalaryMoney(metrics.averageFulltimeNetSalary)} icon={<WalletOutlined />} />
            <MetricCard label="平均绩效" value={formatScoreValue(metrics.averagePerformance)} icon={<CheckCircleOutlined />} />
            <MetricCard label="月均任务" value={formatAverageCount(metrics.averageTaskVolume)} icon={<ClockCircleOutlined />} />
            <MetricCard label="兼职月均实发" value={formatSalaryMoney(metrics.averageParttimeActualPay)} icon={<CalculatorOutlined />} />
          </MetricGrid>
        </>
      }
      filters={
        <FilterPanel>
          <FilterBar>
            <FilterField as="div" label="人员类型" variant="type">
              <Select
                value={filters.personnelType}
                options={[
                  { label: '全部', value: '全部' },
                  { label: '全职', value: '全职' },
                  { label: '兼职', value: '兼职' }
                ]}
                onChange={(personnelType: PeopleFilters['personnelType']) => {
                  setFilters((current) => ({
                    ...current,
                    personnelType,
                    status: isOverviewStatusValidForType(current.status, personnelType) ? current.status : '全部'
                  }));
                }}
              />
            </FilterField>
            <FilterField as="div" controlWidth="status-select" label="状态" variant="status">
              <Select
                value={filters.status}
                options={statusOptions.map((status) => ({
                  label: status,
                  value: status
                }))}
                onChange={(status: PeopleFilters['status']) =>
                  setFilters((current) => ({
                    ...current,
                    status
                  }))
                }
              />
            </FilterField>
            <FilterField as="div" controlWidth="status-select" label="到期风险" variant="status">
              <Select
                value={filters.expiryRisk}
                options={expiryRiskOptions.map((expiryRisk) => ({
                  label: expiryRisk,
                  value: expiryRisk
                }))}
                onChange={(expiryRisk: PeopleExpiryRiskFilter) =>
                  setFilters((current) => ({
                    ...current,
                    expiryRisk
                  }))
                }
              />
            </FilterField>
            <KeywordFilter
              as="div"
              placeholder="姓名 / 编号 / 岗位"
              value={filters.keyword}
              onChange={(keyword) =>
                setFilters((current) => ({
                  ...current,
                  keyword
                }))
              }
            />
          </FilterBar>
        </FilterPanel>
      }
    >
      <ManagementTable<PeopleMember>
        columns={columns}
        count={{ value: filteredMembers.length, unit: '人' }}
        dataSource={filteredMembers}
        rowKey="id"
        rowTestIdPrefix="people-overview-table-row"
        tableTestId="people-overview-table"
        onRowClick={(record) => {
          setActiveMemberId(record.id);
          setDetailOpen(true);
        }}
      />
      <PeopleStatusDrawer
        annualExceptionRows={annualExceptionRows}
        attendanceRecords={attendanceRecords}
        expiryRows={activeMemberExpiryRows}
        member={activeMember}
        open={detailOpen}
        performanceRecords={publishedMonthlyRecords}
        performanceRuleRows={performanceRuleRows}
        storeTaskRows={storeTaskRows}
        workCalendarRows={workCalendarRows}
        onClose={() => {
          setDetailOpen(false);
        }}
      />
    </ManagementPageScaffold>
  );
}
