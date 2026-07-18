import {
  AuditOutlined,
  CheckCircleOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  FileSearchOutlined,
  PartitionOutlined,
  ProfileOutlined,
  SendOutlined,
  TeamOutlined,
  WalletOutlined
} from '@ant-design/icons';
import { Input, InputNumber, message } from 'antd';
import type { TableColumnsType, UploadFile } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, StatusTag, type StatusTagTone } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DrawerFormField, DrawerFormGrid } from '../../components/DrawerForm';
import { DetailDrawerShell, type DrawerAction } from '../../components/DrawerShell';
import { FileUploadDropzone } from '../../components/FileUploadDropzone';
import { OperationRecordSection } from '../../components/OperationRecordSection';
import type { OperationRecord } from '../../components/OperationRecordTable';
import { CellText } from '../../components/TableCell';
import type {
  PerformanceDrawingTaskMonthlyRecord,
  PerformanceMonthlyQualitySummary,
  PerformanceMonthlyTaskSummary,
  PerformanceQuarterlyResultSnapshot,
  PerformanceQuarterlySourceSnapshot,
  PerformanceResultLifecycleStatus,
  PerformanceResultReadRecord,
  PerformanceResultSnapshot
} from './performanceTypes';
import { isMonthlyPerformanceResult } from './performanceResultModel';
import {
  getPerformanceEmployeeResponseAvailability,
  getPerformanceEmployeeResponseDisplayStatus
} from './performanceResultResponseModel';
import type { PerformanceQuarterlyAdjustmentInput } from './performanceQuarterlyResultModel';

type PerformanceResultActionOutcome = {
  reason?: string;
  success: boolean;
};

type PerformanceResultDrawerProps = {
  actionTime?: string;
  audience?: 'employee' | 'management';
  employeeId?: string;
  history: PerformanceResultSnapshot[];
  onClose: () => void;
  onConfirm?: () => PerformanceResultActionOutcome;
  onCorrect?: (
    correctionReason: string,
    adjustment?: PerformanceQuarterlyAdjustmentInput
  ) => PerformanceResultActionOutcome;
  onObject?: (objectionReason: string, evidenceFileIds: string[]) => PerformanceResultActionOutcome;
  onPublish?: (input?: PerformanceQuarterlyAdjustmentInput) => PerformanceResultActionOutcome;
  onResolveObjection?: (resolutionSummary: string) => PerformanceResultActionOutcome;
  readRecord: PerformanceResultReadRecord | null;
};

type PerformanceQuarterlySourceRow = PerformanceQuarterlySourceSnapshot & {
  status: '已发布' | '待发布';
};

const resultStatusTone: Record<PerformanceResultLifecycleStatus, StatusTagTone> = {
  已发布: 'green',
  已更正: 'gray',
  已结算: 'green',
  待发布: 'amber'
};

const employeeResponseStatusTone = {
  已确认: 'green',
  已送达未反馈: 'gray',
  异议已处理: 'blue',
  待确认: 'amber',
  有异议: 'red'
} satisfies Record<string, StatusTagTone>;

const taskSummaryColumns: TableColumnsType<PerformanceMonthlyTaskSummary> = [
  {
    title: '任务项',
    dataIndex: 'taskItem',
    render: (value: string) => <CellText>{value}</CellText>
  },
  {
    align: 'right',
    title: '数量',
    key: 'quantity',
    width: 110,
    render: (_, record) => <CellText>{`${record.quantity} ${record.quantityUnit}`}</CellText>
  },
  {
    align: 'right',
    title: '单项分值',
    key: 'scorePerUnit',
    width: 120,
    render: (_, record) => <CellText>{`${record.scorePerUnit} ${record.scoreUnit}`}</CellText>
  },
  {
    align: 'right',
    title: '小计',
    dataIndex: 'subtotalScore',
    width: 100,
    render: (value: number) => <CellText>{formatScore(value)}</CellText>
  }
];

const qualitySummaryColumns: TableColumnsType<PerformanceMonthlyQualitySummary> = [
  {
    title: '质量维度',
    dataIndex: 'dimension',
    render: (value: string) => <CellText>{value}</CellText>
  },
  {
    align: 'right',
    title: '得分',
    key: 'score',
    width: 140,
    render: (_, record) => <CellText>{`${formatScore(record.score)} / ${formatScore(record.maxScore)}`}</CellText>
  }
];

const quarterlySourceColumns: TableColumnsType<PerformanceQuarterlySourceRow> = [
  {
    title: '适用月份',
    dataIndex: 'period',
    width: 120,
    render: (value: string) => <CellText>{value}</CellText>
  },
  {
    align: 'center',
    title: '月度状态',
    dataIndex: 'status',
    width: 110,
    render: (value: PerformanceQuarterlySourceRow['status']) => (
      <StatusTag tone={value === '已发布' ? 'green' : 'amber'} value={value} variant="compact" />
    )
  },
  {
    title: '绩效规则',
    key: 'rule',
    render: (_, record) => (
      <CellText>{record.ruleName ? `${record.ruleName} / ${record.ruleVersion}` : '-'}</CellText>
    )
  },
  {
    align: 'right',
    title: '绩效金额',
    dataIndex: 'monthlyAmount',
    width: 130,
    render: (value: number) => <CellText>{formatMoney(value)}</CellText>
  },
  {
    align: 'right',
    title: '预发金额',
    dataIndex: 'prepayAmount',
    width: 130,
    render: (value: number) => <CellText>{formatMoney(value)}</CellText>
  }
];

function formatScore(value: number) {
  return Number.isInteger(value) ? `${value} 分` : `${value.toFixed(1)} 分`;
}

function formatOptionalScore(value?: number) {
  return typeof value === 'number' ? formatScore(value) : '-';
}

function formatMoney(value: number) {
  return `${value.toLocaleString('zh-CN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2
  })} 元`;
}

function formatSignedMoney(value: number) {
  if (value === 0) {
    return formatMoney(0);
  }

  return `${value > 0 ? '+' : '-'}${formatMoney(Math.abs(value))}`;
}

function getResultOperationRecords(history: PerformanceResultSnapshot[]): OperationRecord[] {
  return history
    .flatMap((result) =>
      result.events.map((event) => ({
        action: event.action,
        actor: event.actor,
        id: event.id,
        object: `${result.employeeNameSnapshot} ${result.period} V${event.resultVersion}`,
        summary: event.summary,
        time: event.time
      }))
    )
    .sort((left, right) => right.time.localeCompare(left.time) || right.id.localeCompare(left.id));
}

function PerformanceResultOverview({
  actionTime,
  audience,
  readRecord
}: {
  actionTime: string;
  audience: 'employee' | 'management';
  readRecord: PerformanceResultReadRecord;
}) {
  const { result } = readRecord;
  const isMonthly = isMonthlyPerformanceResult(result);
  const sourceRecord = isMonthly ? result.calculationSnapshot.categoryRecord : undefined;
  const responseDisplayStatus = getPerformanceEmployeeResponseDisplayStatus(result, actionTime);
  const resultItems = isMonthly
    ? [
        { label: '绩效规则', value: `${result.ruleNameSnapshot} / ${result.ruleVersion}` },
        { label: '质量分', value: formatOptionalScore(sourceRecord?.qualityScore) },
        { label: '任务完成分', value: formatOptionalScore(sourceRecord?.taskScore) },
        { label: '来源记录', value: `${result.sourceRecordIds.length} 条` }
      ]
    : [
        { label: '绩效类别', value: result.calculationSnapshot.category },
        { label: '适用月份', value: result.calculationSnapshot.expectedMonths.join(' / ') || '-' },
        { label: '月度来源', value: `${result.calculationSnapshot.sourceResults.length} 个月` },
        { label: '季度计算金额', value: formatMoney(result.quarterCalculatedAmount) },
        { label: '季度预发合计', value: formatMoney(result.quarterPrepayAmount) },
        { label: '季度调整', value: formatSignedMoney(result.quarterAdjustmentAmount) },
        { label: '薪酬结算月份', value: result.salarySettlementMonth }
      ];

  return (
    <div className="rule-readonly-stack">
      <DetailSection icon={<ProfileOutlined />} title="结果信息">
        <DetailInfoGrid
          columns={3}
          items={[
            { label: '员工', value: `${result.employeeNameSnapshot} / ${result.workNoSnapshot}` },
            { label: '岗位', value: result.positionSnapshot },
            { label: '结果类型', value: result.kind },
            { label: '结果版本', value: `V${result.version}` },
            {
              label: '结果状态',
              value: <StatusTag tone={resultStatusTone[result.lifecycleStatus]} value={result.lifecycleStatus} />
            },
            ...resultItems
          ]}
        />
      </DetailSection>

      {result.lifecycleStatus === '待发布' && readRecord.publishBlockingReasons.length > 0 ? (
        <DetailSection icon={<FileSearchOutlined />} title="发布条件">
          <DetailInfoGrid
            columns={1}
            items={[
              {
                label: '未满足条件',
                value: readRecord.publishBlockingReasons.join('；'),
                wide: true
              }
            ]}
          />
        </DetailSection>
      ) : null}

      {result.lifecycleStatus !== '待发布' ? (
        <DetailSection icon={<SendOutlined />} title="发布信息">
          <DetailInfoGrid
            columns={3}
            items={[
              { label: '发布时间', value: result.publishedAt },
              { label: '反馈截止', value: result.responseDeadline },
              {
                label: '反馈状态',
                value: (
                  <StatusTag
                    tone={employeeResponseStatusTone[responseDisplayStatus]}
                    value={responseDisplayStatus}
                  />
                )
              },
              ...(result.employeeResponse.respondedAt
                ? [{ label: '反馈时间', value: result.employeeResponse.respondedAt }]
                : []),
              ...(audience === 'management'
                ? [
                    { label: '发布人', value: result.publishedBy },
                    {
                      label: '当前来源',
                      value: !readRecord.sourceAvailable
                        ? '来源已不存在'
                        : readRecord.sourceChangedSincePublish
                          ? <StatusTag tone="amber" value="已有变化" />
                          : <StatusTag tone="green" value="与发布版本一致" />
                    }
                  ]
                : []),
              ...(result.correctionReason ? [{ label: '更正原因', value: result.correctionReason, wide: true }] : [])
            ]}
          />
        </DetailSection>
      ) : null}

      {result.employeeResponse.objectionReason ? (
        <DetailSection icon={<ExclamationCircleOutlined />} title="异议记录">
          <DetailInfoGrid
            columns={2}
            items={[
              { label: '异议原因', value: result.employeeResponse.objectionReason, wide: true },
              {
                label: '佐证文件',
                value: result.employeeResponse.evidenceFileIds?.join('、') || '-'
              },
              ...(result.employeeResponse.resolutionSummary
                ? [
                    { label: '处理结论', value: result.employeeResponse.resolutionSummary, wide: true },
                    { label: '处理人', value: result.employeeResponse.resolvedBy },
                    { label: '处理时间', value: result.employeeResponse.resolvedAt }
                  ]
                : [])
            ]}
          />
        </DetailSection>
      ) : null}
    </div>
  );
}

function PerformanceResultSource({ readRecord }: { readRecord: PerformanceResultReadRecord }) {
  const { result } = readRecord;

  if (!isMonthlyPerformanceResult(result)) {
    const sourceByMonth = new Map(result.calculationSnapshot.sourceResults.map((source) => [source.period, source]));
    const sourceRows = result.calculationSnapshot.expectedMonths.map<PerformanceQuarterlySourceRow>((period) => {
      const source = sourceByMonth.get(period);

      return source
        ? { ...source, status: '已发布' }
        : {
            monthlyAmount: 0,
            period,
            prepayAmount: 0,
            publishedAt: '',
            resultId: `missing:${period}`,
            resultVersion: 0,
            ruleId: '',
            ruleName: '',
            ruleVersion: '',
            sourceHash: '',
            status: '待发布'
          };
    });

    return (
      <div className="rule-readonly-stack">
        <DetailSection icon={<FileSearchOutlined />} title="月度结果来源">
          <DetailInfoGrid
            columns={3}
            items={[
              { label: '适用月份', value: `${result.calculationSnapshot.expectedMonths.length} 个月` },
              { label: '已发布月份', value: `${result.calculationSnapshot.sourceResults.length} 个月` },
              {
                label: '缺失月份',
                value: result.calculationSnapshot.missingMonths.join(' / ') || '-'
              },
              { label: '季度结束日', value: result.calculationSnapshot.quarterEndDate },
              {
                label: '季度状态',
                value: result.calculationSnapshot.quarterClosed
                  ? <StatusTag tone="green" value="已结束" />
                  : <StatusTag tone="amber" value="进行中" />
              },
              { label: '薪酬结算月份', value: result.salarySettlementMonth }
            ]}
          />
          <CompactDetailTable<PerformanceQuarterlySourceRow>
            className="performance-monthly-compact-table"
            columns={quarterlySourceColumns}
            dataSource={sourceRows}
            emptyText="暂无适用月度结果"
            rowKey="resultId"
            scrollX={false}
          />
        </DetailSection>
      </div>
    );
  }

  const sourceRecord = result.calculationSnapshot.categoryRecord;
  const drawingTaskRecord = result.calculationSnapshot.drawingTaskRecord;

  return (
    <div className="rule-readonly-stack">
      <DetailSection icon={<FileSearchOutlined />} title="来源汇总">
        <DetailInfoGrid
          columns={3}
          items={[
            { label: '来源', value: sourceRecord.sourceLabel },
            { label: '来源记录', value: `${sourceRecord.sourceTaskCount} 条` },
            { label: '计算说明', value: sourceRecord.note },
            ...(sourceRecord.employmentScope
              ? [
                  {
                    label: '计绩区间',
                    value: `${sourceRecord.employmentScope.effectiveStartDate} 至 ${sourceRecord.employmentScope.effectiveEndDate}`
                  },
                  {
                    label: '计绩工作日',
                    value: `${sourceRecord.employmentScope.effectiveWorkdays}/${sourceRecord.employmentScope.monthWorkdays}`
                  },
                  {
                    label: '任职折算',
                    value: `${Math.round(sourceRecord.employmentScope.ratio * 100)}%`
                  }
                ]
              : [])
          ]}
        />
      </DetailSection>

      {drawingTaskRecord ? <DrawingTaskCalculationSource record={drawingTaskRecord} /> : null}
    </div>
  );
}

function DrawingTaskCalculationSource({ record }: { record: PerformanceDrawingTaskMonthlyRecord }) {
  return (
    <>
      <DetailSection icon={<PartitionOutlined />} title="计算结果">
        <DetailInfoGrid
          columns={3}
          items={[
            { label: '任务完成分', value: formatScore(record.taskScore) },
            { label: '质量分', value: formatScore(record.qualityScore) },
            { label: '质量档位', value: record.qualityBand },
            { label: '基础金额', value: formatMoney(record.amountSummary.baseAmount) },
            { label: '超额金额', value: formatMoney(record.amountSummary.excessAmount) },
            { label: '绩效金额', value: formatMoney(record.amountSummary.monthlyAmount) },
            { label: '预发比例', value: `${Math.round(record.amountSummary.prepayRatio * 100)}%` },
            { label: '预发金额', value: formatMoney(record.amountSummary.prepayAmount) }
          ]}
        />
      </DetailSection>

      <DetailSection icon={<FileSearchOutlined />} title="任务计分">
        <CompactDetailTable<PerformanceMonthlyTaskSummary>
          className="performance-monthly-compact-table"
          columns={taskSummaryColumns}
          dataSource={record.taskSummaries}
          emptyText="本期无有效任务"
          rowKey="id"
          scrollX={false}
        />
      </DetailSection>

      <DetailSection icon={<CheckCircleOutlined />} title="质量确认">
        <CompactDetailTable<PerformanceMonthlyQualitySummary>
          className="performance-monthly-compact-table"
          columns={qualitySummaryColumns}
          dataSource={record.qualitySummaries}
          emptyText="本期无质量评分"
          rowKey="id"
          scrollX={false}
        />
      </DetailSection>
    </>
  );
}

function PerformanceCorrectionForm({
  correctionReason,
  onCorrectionReasonChange,
  readRecord
}: {
  correctionReason: string;
  onCorrectionReasonChange: (value: string) => void;
  readRecord: PerformanceResultReadRecord;
}) {
  const currentAmount = isMonthlyPerformanceResult(readRecord.result)
    ? readRecord.result.monthlyAmount
    : readRecord.result.quarterFinalAmount;
  const latestAmount = isMonthlyPerformanceResult(readRecord.result)
    ? readRecord.currentSourceRecord?.monthlyAmount ?? currentAmount
    : readRecord.currentQuarterDraft?.quarterFinalAmount ?? currentAmount;

  return (
    <DetailSection icon={<EditOutlined />} title="更正内容">
      <DetailInfoGrid
        columns={3}
        items={[
          { label: '当前版本', value: `V${readRecord.result.version}` },
          { label: '已发布金额', value: formatMoney(currentAmount) },
          { label: '最新来源金额', value: formatMoney(latestAmount) },
          { label: '金额变化', value: formatSignedMoney(latestAmount - currentAmount) },
          {
            label: '来源状态',
            value: readRecord.sourceChangedSincePublish
              ? <StatusTag tone="amber" value="已有变化" />
              : <StatusTag tone="gray" value="无变化" />
          }
        ]}
      />
      <DrawerFormGrid>
        <DrawerFormField label="更正原因" required wide>
          <Input.TextArea
            maxLength={200}
            placeholder="填写本次更正的业务原因"
            rows={4}
            showCount
            value={correctionReason}
            onChange={(event) => onCorrectionReasonChange(event.target.value)}
          />
        </DrawerFormField>
      </DrawerFormGrid>
    </DetailSection>
  );
}

function PerformanceObjectionForm({
  evidenceFiles,
  objectionReason,
  onEvidenceFilesChange,
  onObjectionReasonChange
}: {
  evidenceFiles: UploadFile[];
  objectionReason: string;
  onEvidenceFilesChange: (files: UploadFile[]) => void;
  onObjectionReasonChange: (value: string) => void;
}) {
  return (
    <DetailSection icon={<ExclamationCircleOutlined />} title="提出异议">
      <DrawerFormGrid>
        <DrawerFormField label="异议原因" required wide>
          <Input.TextArea
            maxLength={300}
            placeholder="填写对当前绩效结果有异议的具体原因"
            rows={4}
            showCount
            value={objectionReason}
            onChange={(event) => onObjectionReasonChange(event.target.value)}
          />
        </DrawerFormField>
        <DrawerFormField label="佐证文件" wide>
          <FileUploadDropzone
            accept=".pdf,.jpg,.jpeg,.png"
            description="可选；支持 PDF/JPG/PNG。"
            fileList={evidenceFiles}
            multiple
            title="异议佐证文件"
            uploadText="上传文件"
            onChange={onEvidenceFilesChange}
          />
        </DrawerFormField>
      </DrawerFormGrid>
    </DetailSection>
  );
}

function PerformanceObjectionResolutionForm({
  resolutionSummary,
  onResolutionSummaryChange
}: {
  resolutionSummary: string;
  onResolutionSummaryChange: (value: string) => void;
}) {
  return (
    <DetailSection icon={<CheckCircleOutlined />} title="维持原结果">
      <DrawerFormGrid>
        <DrawerFormField label="处理说明" required wide>
          <Input.TextArea
            maxLength={300}
            placeholder="填写维持当前结果的事实依据"
            rows={4}
            showCount
            value={resolutionSummary}
            onChange={(event) => onResolutionSummaryChange(event.target.value)}
          />
        </DrawerFormField>
      </DrawerFormGrid>
    </DetailSection>
  );
}

function PerformanceQuarterlyPublishForm({
  adjustmentAmount,
  adjustmentReason,
  evidenceFiles,
  onAdjustmentAmountChange,
  onAdjustmentReasonChange,
  onEvidenceFilesChange,
  result
}: {
  adjustmentAmount: number;
  adjustmentReason: string;
  evidenceFiles: UploadFile[];
  onAdjustmentAmountChange: (value: number) => void;
  onAdjustmentReasonChange: (value: string) => void;
  onEvidenceFilesChange: (files: UploadFile[]) => void;
  result: PerformanceQuarterlyResultSnapshot;
}) {
  const finalAmount = result.quarterCalculatedAmount + adjustmentAmount;
  const differenceAmount = finalAmount - result.quarterPrepayAmount;

  return (
    <DetailSection icon={<EditOutlined />} title="季度调整">
      <DetailInfoGrid
        columns={4}
        items={[
          { label: '季度计算金额', value: formatMoney(result.quarterCalculatedAmount) },
          { label: '季度预发合计', value: formatMoney(result.quarterPrepayAmount) },
          { label: '调整后金额', value: formatMoney(finalAmount) },
          { label: '结算差额', value: formatSignedMoney(differenceAmount) }
        ]}
      />
      <DrawerFormGrid>
        <DrawerFormField label="调整金额（元）">
          <InputNumber
            min={-result.quarterCalculatedAmount}
            precision={2}
            step={100}
            value={adjustmentAmount}
            onChange={(value) => onAdjustmentAmountChange(Number(value ?? 0))}
          />
        </DrawerFormField>
        <DrawerFormField label="调整原因" required={adjustmentAmount !== 0} wide>
          <Input.TextArea
            maxLength={200}
            placeholder={adjustmentAmount === 0 ? '无季度调整时无需填写' : '填写季度调整的业务原因'}
            rows={3}
            showCount
            value={adjustmentReason}
            onChange={(event) => onAdjustmentReasonChange(event.target.value)}
          />
        </DrawerFormField>
        <DrawerFormField label="调整佐证" wide>
          <FileUploadDropzone
            accept=".pdf,.jpg,.jpeg,.png"
            description="可选；支持 PDF/JPG/PNG。"
            fileList={evidenceFiles}
            multiple
            title="调整佐证文件"
            uploadText="上传文件"
            onChange={onEvidenceFilesChange}
          />
        </DrawerFormField>
      </DrawerFormGrid>
    </DetailSection>
  );
}

export function PerformanceResultDrawer({
  actionTime = dayjs().format('YYYY-MM-DD HH:mm:ss'),
  audience = 'management',
  employeeId,
  history,
  onClose,
  onConfirm,
  onCorrect,
  onObject,
  onPublish,
  onResolveObjection,
  readRecord
}: PerformanceResultDrawerProps) {
  const [messageApi, contextHolder] = message.useMessage();
  const [activeTab, setActiveTab] = useState('overview');
  const [correctionMode, setCorrectionMode] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');
  const [objectionMode, setObjectionMode] = useState(false);
  const [objectionReason, setObjectionReason] = useState('');
  const [objectionEvidenceFiles, setObjectionEvidenceFiles] = useState<UploadFile[]>([]);
  const [resolutionMode, setResolutionMode] = useState(false);
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [quarterAdjustmentAmount, setQuarterAdjustmentAmount] = useState(0);
  const [quarterAdjustmentReason, setQuarterAdjustmentReason] = useState('');
  const [quarterEvidenceFiles, setQuarterEvidenceFiles] = useState<UploadFile[]>([]);
  const operationRecords = useMemo(() => getResultOperationRecords(history), [history]);
  const result = readRecord?.result;

  useEffect(() => {
    setActiveTab('overview');
    setCorrectionMode(false);
    setCorrectionReason('');
    setObjectionMode(false);
    setObjectionReason('');
    setObjectionEvidenceFiles([]);
    setResolutionMode(false);
    setResolutionSummary('');
    setQuarterAdjustmentAmount(result?.kind === '季度结果' ? result.quarterAdjustmentAmount : 0);
    setQuarterAdjustmentReason(result?.kind === '季度结果' ? result.quarterAdjustmentReason ?? '' : '');
    setQuarterEvidenceFiles([]);
  }, [result?.id]);

  function handlePublish() {
    if (!onPublish) {
      void messageApi.error('当前视图不支持发布绩效结果');
      return;
    }

    const outcome = onPublish(
      result?.kind === '季度结果'
        ? {
            adjustmentAmount: quarterAdjustmentAmount,
            adjustmentReason: quarterAdjustmentReason,
            evidenceFileIds: quarterEvidenceFiles.map((file) => file.uid)
          }
        : undefined
    );

    if (!outcome.success) {
      void messageApi.error(outcome.reason ?? '绩效结果未发布');
      return;
    }

    void messageApi.success('绩效结果已发布');
  }

  function handleCorrect() {
    if (!onCorrect) {
      void messageApi.error('当前视图不支持更正绩效结果');
      return;
    }

    const outcome = onCorrect(
      correctionReason,
      result?.kind === '季度结果'
        ? {
            adjustmentAmount: quarterAdjustmentAmount,
            adjustmentReason: quarterAdjustmentReason,
            evidenceFileIds: quarterEvidenceFiles.map((file) => file.uid)
          }
        : undefined
    );

    if (!outcome.success) {
      void messageApi.error(outcome.reason ?? '绩效结果未更正');
      return;
    }

    setCorrectionMode(false);
    setCorrectionReason('');
    void messageApi.success('已发布更正版本');
  }

  function enterCorrectionMode() {
    setActiveTab('overview');
    setObjectionMode(false);
    setResolutionMode(false);
    setCorrectionMode(true);
  }

  function resetEmployeeActionMode() {
    setObjectionMode(false);
    setObjectionReason('');
    setObjectionEvidenceFiles([]);
  }

  function resetActionMode() {
    setCorrectionMode(false);
    setCorrectionReason('');
    resetEmployeeActionMode();
    setResolutionMode(false);
    setResolutionSummary('');
  }

  function enterObjectionMode() {
    resetActionMode();
    setActiveTab('overview');
    setObjectionMode(true);
  }

  function enterResolutionMode() {
    resetActionMode();
    setActiveTab('overview');
    setResolutionMode(true);
  }

  function handleConfirm() {
    const outcome = onConfirm?.() ?? { reason: '当前视图不支持确认绩效结果', success: false };

    if (!outcome.success) {
      void messageApi.error(outcome.reason ?? '绩效结果未确认');
      return;
    }

    void messageApi.success('绩效结果已确认');
  }

  function handleObject() {
    const outcome = onObject?.(
      objectionReason,
      objectionEvidenceFiles.map((file) => file.name)
    ) ?? { reason: '当前视图不支持提交异议', success: false };

    if (!outcome.success) {
      void messageApi.error(outcome.reason ?? '绩效异议未提交');
      return;
    }

    resetEmployeeActionMode();
    void messageApi.success('绩效异议已提交');
  }

  function handleResolveObjection() {
    const outcome = onResolveObjection?.(resolutionSummary)
      ?? { reason: '当前视图不支持处理绩效异议', success: false };

    if (!outcome.success) {
      void messageApi.error(outcome.reason ?? '绩效异议未处理');
      return;
    }

    setResolutionMode(false);
    setResolutionSummary('');
    void messageApi.success('已记录维持原结果');
  }

  const canPublish = Boolean(
    readRecord?.sourceAvailable
      && readRecord.publishBlockingReasons.length === 0
      && result?.lifecycleStatus === '待发布'
      && (
        result.kind === '季度结果'
          ? result.quarterCalculatedAmount + quarterAdjustmentAmount >= 0
            && (quarterAdjustmentAmount === 0 || quarterAdjustmentReason.trim().length > 0)
          : readRecord.currentSourceRecord?.ruleApplicability?.status === '适用'
      )
  );
  const canEnterCorrection = Boolean(
    result
      && (result.lifecycleStatus === '已发布' || result.lifecycleStatus === '已结算')
      && readRecord?.sourceAvailable
      && (result.kind === '季度结果' || readRecord.sourceChangedSincePublish)
      && (result.kind === '月度结果' ? readRecord.currentSourceRecord : readRecord.currentQuarterDraft)
  );
  const canSubmitCorrection = Boolean(
    canEnterCorrection
      && correctionReason.trim().length > 0
      && (
        result?.kind !== '季度结果'
        || (
          result.quarterCalculatedAmount + quarterAdjustmentAmount >= 0
          && (quarterAdjustmentAmount === 0 || quarterAdjustmentReason.trim().length > 0)
        )
      )
  );
  const employeeResponseAvailability = result && employeeId
    ? getPerformanceEmployeeResponseAvailability(history, result.id, employeeId, actionTime)
    : undefined;
  const canEmployeeRespond = Boolean(
    audience === 'employee'
      && employeeResponseAvailability?.allowed
      && result?.employeeResponse.status === '待确认'
  );
  const hasOpenObjection = Boolean(
    audience === 'management' && result?.employeeResponse.status === '有异议'
  );
  const cancelMode = correctionMode || objectionMode || resolutionMode;
  const responseDisplayStatus = result
    ? getPerformanceEmployeeResponseDisplayStatus(result, actionTime)
    : '待确认';
  let cancelAction: DrawerAction | undefined;
  let primaryAction: DrawerAction | undefined;
  let secondaryAction: DrawerAction | undefined;

  if (cancelMode) {
    cancelAction = {
      label: correctionMode ? '取消更正' : objectionMode ? '取消异议' : '取消处理',
      onClick: resetActionMode
    };
  }

  if (audience === 'management' && result?.lifecycleStatus === '待发布') {
    primaryAction = {
      disabled: !canPublish,
      icon: <SendOutlined />,
      label: result.kind === '季度结果' ? '发布季度结果' : '发布月度结果',
      onClick: handlePublish,
      testId: 'performance-result-publish-action'
    };
  } else if (correctionMode) {
    primaryAction = {
      disabled: !canSubmitCorrection,
      icon: <CheckCircleOutlined />,
      label: '发布更正版本',
      onClick: handleCorrect,
      testId: 'performance-result-correct-submit-action'
    };
  } else if (objectionMode) {
    primaryAction = {
      disabled: objectionReason.trim().length === 0,
      icon: <ExclamationCircleOutlined />,
      label: '提交异议',
      onClick: handleObject,
      testId: 'performance-result-object-submit-action'
    };
  } else if (resolutionMode) {
    primaryAction = {
      disabled: resolutionSummary.trim().length === 0,
      icon: <CheckCircleOutlined />,
      label: '维持原结果',
      onClick: handleResolveObjection,
      testId: 'performance-result-objection-resolve-submit-action'
    };
  } else if (canEmployeeRespond) {
    primaryAction = {
      icon: <CheckCircleOutlined />,
      label: '确认结果',
      onClick: handleConfirm,
      testId: 'performance-result-confirm-action'
    };
    secondaryAction = {
      icon: <ExclamationCircleOutlined />,
      label: '提出异议',
      onClick: enterObjectionMode,
      testId: 'performance-result-object-action'
    };
  } else if (hasOpenObjection) {
    if (canEnterCorrection) {
      primaryAction = {
        icon: <EditOutlined />,
        label: '生成更正结果',
        onClick: enterCorrectionMode,
        testId: 'performance-result-objection-correct-action'
      };
    }
    secondaryAction = {
      icon: <CheckCircleOutlined />,
      label: '维持原结果',
      onClick: enterResolutionMode,
      testId: 'performance-result-objection-resolve-action'
    };
  } else if (audience === 'management' && canEnterCorrection) {
    secondaryAction = {
      icon: <EditOutlined />,
      label: '更正结果',
      onClick: enterCorrectionMode,
      testId: 'performance-result-correct-action'
    };
  }

  return (
    <DetailDrawerShell
      bodyTestId="performance-result-drawer"
      cancelAction={cancelAction}
      className="performance-monthly-drawer"
      closeAction={{ label: '关闭', onClick: onClose }}
      open={Boolean(readRecord)}
      primaryAction={primaryAction}
      secondaryAction={secondaryAction}
      title={
        result ? (
          <DetailDrawerTitle
            status={audience === 'employee' ? responseDisplayStatus : result.lifecycleStatus}
            statusTone={
              audience === 'employee'
                ? employeeResponseStatusTone[responseDisplayStatus]
                : resultStatusTone[result.lifecycleStatus]
            }
            subtitle={`${result.kind} / ${result.ruleNameSnapshot} ${result.ruleVersion} / V${result.version}`}
            title={`${result.employeeNameSnapshot} ${result.period} 绩效结果`}
          />
        ) : null
      }
      width={960}
      onClose={onClose}
    >
      {contextHolder}
      {readRecord && result ? (
        <div className="rule-readonly-stack performance-monthly-detail-stack">
          <DetailSummaryCards
            columns={4}
            items={[
              { icon: <TeamOutlined />, key: 'employee', label: '员工', value: result.employeeNameSnapshot },
              { icon: <ProfileOutlined />, key: 'period', label: '绩效周期', value: result.period },
              {
                icon: <WalletOutlined />,
                key: 'amount',
                label: result.kind === '月度结果' ? '绩效金额' : '季度最终金额',
                value: formatMoney(
                  result.kind === '月度结果' ? result.monthlyAmount : result.quarterFinalAmount
                )
              },
              {
                icon: <CheckCircleOutlined />,
                key: 'prepay',
                label: result.kind === '月度结果' ? '预发金额' : '季度结算差额',
                value: result.kind === '月度结果'
                  ? formatMoney(result.prepayAmount)
                  : formatSignedMoney(result.quarterDifferenceAmount)
              }
            ]}
          />

          <DetailTabs
            activeKey={activeTab}
            tabTestIdPrefix="performance-result-drawer-tab"
            testId="performance-result-drawer-tabs"
            items={[
              {
                key: 'overview',
                label: '结果概览',
                children: (
                  <div className="rule-readonly-stack">
                    <PerformanceResultOverview
                      actionTime={actionTime}
                      audience={audience}
                      readRecord={readRecord}
                    />
                    {result.kind === '季度结果' && result.lifecycleStatus === '待发布' ? (
                      <PerformanceQuarterlyPublishForm
                        adjustmentAmount={quarterAdjustmentAmount}
                        adjustmentReason={quarterAdjustmentReason}
                        evidenceFiles={quarterEvidenceFiles}
                        result={result}
                        onAdjustmentAmountChange={setQuarterAdjustmentAmount}
                        onAdjustmentReasonChange={setQuarterAdjustmentReason}
                        onEvidenceFilesChange={setQuarterEvidenceFiles}
                      />
                    ) : null}
                    {correctionMode ? (
                      <>
                        {result.kind === '季度结果' ? (
                          <PerformanceQuarterlyPublishForm
                            adjustmentAmount={quarterAdjustmentAmount}
                            adjustmentReason={quarterAdjustmentReason}
                            evidenceFiles={quarterEvidenceFiles}
                            result={readRecord.currentQuarterDraft ?? result}
                            onAdjustmentAmountChange={setQuarterAdjustmentAmount}
                            onAdjustmentReasonChange={setQuarterAdjustmentReason}
                            onEvidenceFilesChange={setQuarterEvidenceFiles}
                          />
                        ) : null}
                        <PerformanceCorrectionForm
                          correctionReason={correctionReason}
                          readRecord={readRecord}
                          onCorrectionReasonChange={setCorrectionReason}
                        />
                      </>
                    ) : null}
                    {objectionMode ? (
                      <PerformanceObjectionForm
                        evidenceFiles={objectionEvidenceFiles}
                        objectionReason={objectionReason}
                        onEvidenceFilesChange={setObjectionEvidenceFiles}
                        onObjectionReasonChange={setObjectionReason}
                      />
                    ) : null}
                    {resolutionMode ? (
                      <PerformanceObjectionResolutionForm
                        resolutionSummary={resolutionSummary}
                        onResolutionSummaryChange={setResolutionSummary}
                      />
                    ) : null}
                  </div>
                )
              },
              {
                key: 'source',
                label: '来源明细',
                children: <PerformanceResultSource readRecord={readRecord} />
              },
              {
                key: 'records',
                label: '操作记录',
                children: (
                  <OperationRecordSection
                    emptyText="暂无结果操作记录"
                    icon={<AuditOutlined />}
                    records={operationRecords}
                    title="操作记录"
                  />
                )
              }
            ]}
            onChange={setActiveTab}
          />
        </div>
      ) : null}
    </DetailDrawerShell>
  );
}
