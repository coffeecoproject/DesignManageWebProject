import type {
  PerformanceDrawingTaskMonthlyRecord,
  PerformanceMonthlyCategoryRecord,
  PerformanceRulePreset,
  PerformanceSignatureBatch
} from './performanceTypes';

export const performanceRulePresets: PerformanceRulePreset[] = [
  {
    id: 'perf-rule-space-design-2026-final',
    code: 'PERF-2026-SPACE-001',
    name: '绘图任务制V1',
    performanceType: '任务制',
    category: '绘图任务制',
    categoryVersionState: '员工执行旧版',
    templateMode: '固定模块',
    editableScope: '固定任务项与质量维度；仅调整分值、最高分值、达标线和金额参数',
    applicablePositions: ['空间设计师', '主案设计师'],
    personnelType: '全职',
    status: '已发布',
    currentVersion: 'V1',
    effectiveStartAt: '2026-06-01',
    lockReason: '新版本发布不覆盖员工旧签署；未签V2的员工继续按V1执行',
    generatedFileSummary: '已上传 绩效工资考核与发放规则_最终版.docx',
    fullScore: 100,
    baseLineScore: 80,
    basePerformanceAmount: 2500,
    scoringCycle: '自然月',
    reviewCycle: '季度复核',
    payoutMode: '月度预发50%，季度复核后发放差额',
    taskScoreSummary: '平面图、施工图、物料营建单/下单流程、门店P图按套/门店确认',
    qualityScoreSummary: '成果质量最高40、交付时效最高25、流程闭环最高25、项目配合最高10',
    calculationSummary: '100分以内基础绩效 + 100分以上超额绩效，均受质量确认比例影响',
    structuredFieldSummary: '已拆规则参数、任务事件、月度结果三类可计算字段',
    scopeNote: '适用于空间设计师、主案设计师的绘图任务制类别；不适用于兼职/合作岗位',
    lastUpdatedAt: '2026-06-13',
    lastUpdatedBy: '李明',
    taskScoreItems: [
      {
        id: 'space-plan',
        taskConfigId: 'task-type-floor-plan',
        name: '平面方案',
        score: 3.4,
        unit: '套/门店',
        unitKey: 'store_set',
        requiresConfirmation: true,
        scoreFieldKey: 'task_score_space_plan',
        confirmationMode: '经甲方确认有效后计分',
        evidence: '任务单、项目记录、提审/确认记录'
      },
      {
        id: 'construction-drawing',
        taskConfigId: 'task-type-full-drawing',
        name: '全套施工图',
        score: 2.2,
        unit: '套/门店',
        unitKey: 'store_set',
        requiresConfirmation: true,
        scoreFieldKey: 'task_score_construction_drawing',
        confirmationMode: '经甲方确认有效后计分',
        evidence: '任务单、项目记录、提审/确认记录'
      },
      {
        id: 'material-order',
        taskConfigId: 'task-type-material-order',
        name: '物料下单支持',
        score: 1.2,
        unit: '套/门店',
        unitKey: 'store_set',
        requiresConfirmation: true,
        scoreFieldKey: 'task_score_material_order_flow',
        confirmationMode: '完成相应流程节点后计分',
        evidence: '流程记录、下单记录、甲方确认'
      },
      {
        id: 'store-photoshop',
        taskConfigId: 'task-type-store-image',
        name: '门店P图',
        score: 1.2,
        unit: '套/门店',
        unitKey: 'store_set',
        requiresConfirmation: true,
        scoreFieldKey: 'task_score_store_photoshop',
        confirmationMode: '经甲方确认有效后计分',
        evidence: '任务单、项目记录、甲方确认'
      }
    ],
    qualityDimensions: [
      {
        id: 'quality',
        name: '成果有效性与质量',
        score: 40,
        focus: '成果符合品牌标准、现场条件及施工落地要求，重大错误、漏项、反复返工情况较少',
        evidence: '成果文件、审核意见、返工记录、甲方确认'
      },
      {
        id: 'timeliness',
        name: '交付时效',
        score: 25,
        focus: '按要求及时提交、修改、提审、上传、下单或完成阶段节点',
        evidence: '任务单、项目记录、系统记录、沟通记录'
      },
      {
        id: 'workflow',
        name: '流程闭环',
        score: 25,
        focus: '按既定流程完成提审、反馈处理、文件上传、下单确认、资料归档等闭环工作',
        evidence: '流程记录、提审记录、上传/归档记录'
      },
      {
        id: 'collaboration',
        name: '项目配合与沟通归档',
        score: 10,
        focus: '及时响应项目沟通，配合相关方推进，并完成资料归档',
        evidence: '项目群记录、甲方通知、归档记录'
      }
    ],
    qualityBands: [
      {
        id: 'band-90',
        minScore: 90,
        scoreRange: '90分及以上',
        qualityRatio: 1,
        excessRatio: 1,
        handling: '基础绩效和符合条件的超额绩效可全额确认'
      },
      {
        id: 'band-80',
        minScore: 80,
        maxScore: 89,
        scoreRange: '80-89分',
        qualityRatio: 0.9,
        excessRatio: 0.9,
        handling: '存在轻微不足但整体可用，按质量确认比例确认'
      },
      {
        id: 'band-70',
        minScore: 70,
        maxScore: 79,
        scoreRange: '70-79分',
        qualityRatio: 0.8,
        excessRatio: 0.8,
        handling: '达标情况一般，基础绩效和超额绩效均按较低质量比例确认'
      },
      {
        id: 'band-60',
        minScore: 60,
        maxScore: 69,
        scoreRange: '60-69分',
        qualityRatio: 0.5,
        excessRatio: 0,
        handling: '仅对基础绩效作折减确认，不确认当月超额绩效'
      },
      {
        id: 'band-below-60',
        minScore: 0,
        maxScore: 59,
        scoreRange: '60分以下',
        qualityRatio: 0.3,
        excessRatio: 0,
        handling: '原则上不确认绩效；确有有效交付时可酌情确认少量基础绩效'
      }
    ],
    excessBands: [
      {
        id: 'excess-120',
        minScoreExclusive: 100,
        maxScore: 120,
        scoreRange: '100分以上至120分',
        multiplier: 1.2,
        requirement: '相关成果经确认有效，并结合达标考核分确认'
      },
      {
        id: 'excess-150',
        minScoreExclusive: 120,
        maxScore: 150,
        scoreRange: '120分以上至150分',
        multiplier: 1.35,
        requirement: '相关成果经确认有效，并结合达标考核分确认'
      },
      {
        id: 'excess-over-150',
        minScoreExclusive: 150,
        scoreRange: '150分以上',
        multiplier: 1.5,
        requirement: '相关成果经确认有效，并结合达标考核分确认'
      }
    ],
    formulas: [
      {
        id: 'conversion-base',
        item: '绩效折算基准',
        variables: ['基础绩效基准金额', '满分口径'],
        method: '基础绩效基准金额 ÷ 满分口径',
        result: '每分绩效金额'
      },
      {
        id: 'task-confirm-ratio',
        item: '任务完成分确认比例',
        variables: ['月度任务完成分', '基础达成线'],
        method: '月度任务完成分 >= 基础达成线 ? 100% : 50%',
        result: '任务确认比例'
      },
      {
        id: 'base-performance',
        item: '基础绩效工资',
        variables: ['100分以内确认分', '每分绩效金额', '质量确认比例', '任务确认比例'],
        method: '100分以内确认分 × 每分绩效金额 × 质量确认比例 × 任务确认比例',
        result: '基础绩效金额'
      },
      {
        id: 'excess-performance',
        item: '超额绩效工资',
        variables: ['超额分', '每分绩效金额', '超额激励倍数', '超额绩效确认比例'],
        method: '超额分 × 每分绩效金额 × 超额激励倍数 × 超额绩效确认比例',
        result: '超额绩效金额'
      },
      {
        id: 'monthly-performance',
        item: '月度绩效工资',
        variables: ['基础绩效金额', '超额绩效金额'],
        method: '基础绩效金额 + 超额绩效金额',
        result: '月度绩效金额'
      }
    ],
    ruleParameterFields: [
      {
        id: 'field-full-score',
        fieldKey: 'full_score',
        label: '满分口径',
        type: 'number',
        required: true,
        usage: '限制100分以内基础绩效分，并识别超额分',
        example: '100'
      },
      {
        id: 'field-base-line-score',
        fieldKey: 'base_line_score',
        label: '基础达成线',
        type: 'number',
        required: true,
        usage: '判断任务完成分确认比例',
        example: '80'
      },
      {
        id: 'field-base-performance-amount',
        fieldKey: 'base_performance_amount',
        label: '基础绩效基准金额',
        type: 'money',
        required: true,
        usage: '计算100分口径下每分绩效折算金额',
        example: '2500'
      },
      {
        id: 'field-prepay-ratio',
        fieldKey: 'monthly_prepay_ratio',
        label: '月度预发比例',
        type: 'ratio',
        required: true,
        usage: '生成次月工资中的绩效预发金额',
        example: '0.5'
      },
      {
        id: 'field-review-cycle',
        fieldKey: 'review_cycle',
        label: '复核结算',
        type: 'enum',
        required: true,
        usage: '决定差额复核和发放节奏',
        example: 'quarterly'
      }
    ],
    taskEventFields: [
      {
        id: 'event-task-id',
        fieldKey: 'task_id',
        label: '任务ID',
        type: 'string',
        required: true,
        usage: '关联任务明细和月度绩效归总',
        example: 'TASK-2026-0001'
      },
      {
        id: 'event-employee-id',
        fieldKey: 'employee_id',
        label: '员工ID',
        type: 'string',
        required: true,
        usage: '归集到员工月度绩效',
        example: '20260008'
      },
      {
        id: 'event-task-type-code',
        fieldKey: 'task_type_code',
        label: '任务类型编码',
        type: 'enum',
        required: true,
        usage: '匹配任务计分项并取得分值',
        example: 'task-type-floor-plan'
      },
      {
        id: 'event-accepted-at',
        fieldKey: 'accepted_at',
        label: '验收时间',
        type: 'date',
        required: true,
        usage: '确定计入月份和跨月归属',
        example: '2026-06-20'
      },
      {
        id: 'event-confirmed',
        fieldKey: 'is_confirmed_effective',
        label: '是否有效成果',
        type: 'boolean',
        required: true,
        usage: '决定任务是否计入绩效分',
        example: 'true'
      },
      {
        id: 'event-overdue',
        fieldKey: 'is_overdue',
        label: '是否逾期',
        type: 'boolean',
        required: true,
        usage: '进入达标考核分或异常复核',
        example: 'false'
      },
      {
        id: 'event-rework-count',
        fieldKey: 'rework_count',
        label: '返工次数',
        type: 'number',
        required: true,
        usage: '进入质量维度评分和异常复核',
        example: '1'
      },
      {
        id: 'event-generated-score',
        fieldKey: 'generated_task_score',
        label: '产生任务分',
        type: 'number',
        required: true,
        usage: '由任务类型和确认状态计算后写入月度归总',
        example: '3.4'
      }
    ],
    monthlyResultFields: [
      {
        id: 'monthly-rule-version',
        fieldKey: 'rule_version_id',
        label: '规则版本ID',
        type: 'string',
        required: true,
        usage: '锁定历史绩效按当期规则重算',
        example: 'PERF-2026-SPACE-001@final'
      },
      {
        id: 'monthly-task-score',
        fieldKey: 'monthly_task_score',
        label: '月度任务完成分',
        type: 'number',
        required: true,
        usage: '汇总有效任务明细',
        example: '92.4'
      },
      {
        id: 'monthly-confirmed-score',
        fieldKey: 'confirmed_base_score',
        label: '100分以内确认分',
        type: 'number',
        required: true,
        usage: 'min(月度任务完成分, 满分口径)',
        example: '92.4'
      },
      {
        id: 'monthly-excess-score',
        fieldKey: 'excess_score',
        label: '超额分',
        type: 'number',
        required: true,
        usage: 'max(月度任务完成分 - 满分口径, 0)',
        example: '12.4'
      },
      {
        id: 'monthly-quality-score',
        fieldKey: 'quality_assessment_score',
        label: '达标考核分',
        type: 'number',
        required: true,
        usage: '匹配质量确认比例和超额确认比例',
        example: '86'
      },
      {
        id: 'monthly-quality-ratio',
        fieldKey: 'quality_confirm_ratio',
        label: '质量确认比例',
        type: 'ratio',
        required: true,
        usage: '由达标考核分档位得出',
        example: '0.9'
      },
      {
        id: 'monthly-base-amount',
        fieldKey: 'base_performance_pay',
        label: '基础绩效金额',
        type: 'money',
        required: true,
        usage: '计算100分以内基础绩效',
        example: '2079'
      },
      {
        id: 'monthly-excess-amount',
        fieldKey: 'excess_performance_pay',
        label: '超额绩效金额',
        type: 'money',
        required: true,
        usage: '计算100分以上超额绩效',
        example: '334.8'
      },
      {
        id: 'monthly-prepay-amount',
        fieldKey: 'monthly_prepay_amount',
        label: '月度预发金额',
        type: 'money',
        required: true,
        usage: '按预发比例生成预发金额',
        example: '1206.9'
      }
    ],
    preservedClauses: [
      {
        id: 'clause-valid-result',
        title: '未确认或无效成果',
        treatment: '人工复核',
        note: '未通过验收、重大返工、逾期严重或流程未闭环的成果不应直接计入任务分，需要任务状态和复核结论共同判断。'
      },
      {
        id: 'clause-objection',
        title: '异议与复核',
        treatment: '文本留痕',
        note: '员工收到绩效明细后3个工作日内可提出核对意见；该条款应进入复核流程说明，不直接参与金额公式。'
      },
      {
        id: 'clause-rule-change',
        title: '规则调整',
        treatment: '文本留痕',
        note: '基础金额、任务分值、发放节奏、确认比例等重大调整需要规则版本更新，不应覆盖历史已确认结果。'
      }
    ],
    sourceFiles: [
      {
        id: 'source-space-v1-final',
        name: '绩效工资考核与发放规则_最终版.docx',
        fileType: '上传规则文件',
        uploadedBy: '李明',
        uploadedAt: '2026-06-13',
        note: '空间设计岗原始绩效文件，已拆解为绘图任务制V1的任务计分、质量确认和金额计算配置。'
      }
    ],
    generatedFiles: [],
    versionEvents: [
      {
        id: 'event-1',
        version: 'V1',
        time: '2026-06-13',
        actor: '李明',
        action: '确认规则',
        changeSummary: '按绘图任务制固定模板确认 V1 规则配置',
        note: '上传原始文件作为配置依据，前端按结构化配置维护规则版本'
      },
      {
        id: 'event-2',
        version: 'V1',
        time: '2026-06-13',
        actor: '系统原型',
        action: '前端建模',
        changeSummary: '拆分规则版本与签署批次',
        note: '规则页只维护规则版本，员工确认记录迁移到绩效签署模块'
      }
    ]
  },
  {
    id: 'perf-rule-space-design-v2-draft',
    code: 'PERF-2026-SPACE-002',
    name: '绘图任务制V2',
    performanceType: '任务制',
    category: '绘图任务制',
    categoryVersionState: '当前发布版本',
    templateMode: '固定模块',
    editableScope: '固定任务项与质量维度；仅调整分值、最高分值、达标线和金额参数',
    applicablePositions: ['空间设计师', '主案设计师'],
    personnelType: '全职',
    status: '已发布',
    currentVersion: 'V2',
    parentRuleId: 'perf-rule-space-design-2026-final',
    effectiveStartAt: '2026-07-01',
    lockReason: '已发布为绘图任务制当前版本；员工签署后才替换其当前执行版本，未签仍按V1执行',
    generatedFileSummary: '已上传 绘图任务制V2调整确认文件.docx',
    fullScore: 100,
    baseLineScore: 80,
    basePerformanceAmount: 2500,
    scoringCycle: '自然月',
    reviewCycle: '季度复核',
    payoutMode: '月度预发50%，季度复核后发放差额',
    taskScoreSummary: '绘图任务制固定任务项不增删；拟调整平面图分值，其余任务沿用V1',
    qualityScoreSummary: '成果质量最高40、交付时效最高25、流程闭环最高25、项目配合最高10',
    calculationSummary: '发布后进入签署流程；员工未签署前月度绩效继续按该类别旧版计算',
    structuredFieldSummary: '沿用V1字段结构，发布后按签署结果形成员工执行快照',
    scopeNote: '适用于空间设计师、主案设计师的绘图任务制类别；员工签署后才从约定生效日执行',
    lastUpdatedAt: '2026-06-13',
    lastUpdatedBy: '李明',
    taskScoreItems: [
      {
        id: 'space-plan-v2',
        taskConfigId: 'task-type-floor-plan',
        name: '平面方案',
        score: 3.8,
        unit: '套/门店',
        unitKey: 'store_set',
        requiresConfirmation: true,
        scoreFieldKey: 'task_score_space_plan',
        confirmationMode: '经甲方确认有效后计分',
        evidence: '任务单、项目记录、提审/确认记录'
      },
      {
        id: 'construction-drawing-v2',
        taskConfigId: 'task-type-full-drawing',
        name: '全套施工图',
        score: 2.2,
        unit: '套/门店',
        unitKey: 'store_set',
        requiresConfirmation: true,
        scoreFieldKey: 'task_score_construction_drawing',
        confirmationMode: '经甲方确认有效后计分',
        evidence: '任务单、项目记录、提审/确认记录'
      },
      {
        id: 'material-order-v2',
        taskConfigId: 'task-type-material-order',
        name: '物料下单支持',
        score: 1.2,
        unit: '套/门店',
        unitKey: 'store_set',
        requiresConfirmation: true,
        scoreFieldKey: 'task_score_material_order_flow',
        confirmationMode: '完成相应流程节点后计分',
        evidence: '流程记录、下单记录、甲方确认'
      },
      {
        id: 'store-photoshop-v2',
        taskConfigId: 'task-type-store-image',
        name: '门店P图',
        score: 1.2,
        unit: '套/门店',
        unitKey: 'store_set',
        requiresConfirmation: true,
        scoreFieldKey: 'task_score_store_photoshop',
        confirmationMode: '经甲方确认有效后计分',
        evidence: '任务单、项目记录、甲方确认'
      }
    ],
    qualityDimensions: [
      {
        id: 'quality-v2',
        name: '成果有效性与质量',
        score: 40,
        focus: '成果符合品牌标准、现场条件及施工落地要求，重大错误、漏项、反复返工情况较少',
        evidence: '成果文件、审核意见、返工记录、甲方确认'
      },
      {
        id: 'timeliness-v2',
        name: '交付时效',
        score: 25,
        focus: '按要求及时提交、修改、提审、上传、下单或完成阶段节点',
        evidence: '任务单、项目记录、系统记录、沟通记录'
      },
      {
        id: 'workflow-v2',
        name: '流程闭环',
        score: 25,
        focus: '按既定流程完成提审、反馈处理、文件上传、下单确认、资料归档等闭环工作',
        evidence: '流程记录、提审记录、上传/归档记录'
      },
      {
        id: 'collaboration-v2',
        name: '项目配合与沟通归档',
        score: 10,
        focus: '及时响应项目沟通，配合相关方推进，并完成资料归档',
        evidence: '项目群记录、甲方通知、归档记录'
      }
    ],
    qualityBands: [
      {
        id: 'band-90-v2',
        minScore: 90,
        scoreRange: '90分及以上',
        qualityRatio: 1,
        excessRatio: 1,
        handling: '基础绩效和符合条件的超额绩效可全额确认'
      },
      {
        id: 'band-80-v2',
        minScore: 80,
        maxScore: 89,
        scoreRange: '80-89分',
        qualityRatio: 0.9,
        excessRatio: 0.9,
        handling: '存在轻微不足但整体可用，按质量确认比例确认'
      },
      {
        id: 'band-70-v2',
        minScore: 70,
        maxScore: 79,
        scoreRange: '70-79分',
        qualityRatio: 0.8,
        excessRatio: 0.8,
        handling: '达标情况一般，基础绩效和超额绩效均按较低质量比例确认'
      },
      {
        id: 'band-60-v2',
        minScore: 60,
        maxScore: 69,
        scoreRange: '60-69分',
        qualityRatio: 0.5,
        excessRatio: 0,
        handling: '仅对基础绩效作折减确认，不确认当月超额绩效'
      },
      {
        id: 'band-below-60-v2',
        minScore: 0,
        maxScore: 59,
        scoreRange: '60分以下',
        qualityRatio: 0.3,
        excessRatio: 0,
        handling: '原则上不确认绩效；确有有效交付时可酌情确认少量基础绩效'
      }
    ],
    excessBands: [
      {
        id: 'excess-120-v2',
        minScoreExclusive: 100,
        maxScore: 120,
        scoreRange: '100分以上至120分',
        multiplier: 1.2,
        requirement: '相关成果经确认有效，并结合达标考核分确认'
      },
      {
        id: 'excess-150-v2',
        minScoreExclusive: 120,
        maxScore: 150,
        scoreRange: '120分以上至150分',
        multiplier: 1.35,
        requirement: '相关成果经确认有效，并结合达标考核分确认'
      },
      {
        id: 'excess-over-150-v2',
        minScoreExclusive: 150,
        scoreRange: '150分以上',
        multiplier: 1.5,
        requirement: '相关成果经确认有效，并结合达标考核分确认'
      }
    ],
    formulas: [
      {
        id: 'conversion-base-v2',
        item: '绩效折算基准',
        variables: ['基础绩效基准金额', '满分口径'],
        method: '基础绩效基准金额 ÷ 满分口径',
        result: '每分绩效金额'
      },
      {
        id: 'task-confirm-ratio-v2',
        item: '任务完成分确认比例',
        variables: ['月度任务完成分', '基础达成线'],
        method: '月度任务完成分 >= 基础达成线 ? 100% : 50%',
        result: '任务确认比例'
      },
      {
        id: 'base-performance-v2',
        item: '基础绩效工资',
        variables: ['100分以内确认分', '每分绩效金额', '质量确认比例', '任务确认比例'],
        method: '100分以内确认分 × 每分绩效金额 × 质量确认比例 × 任务确认比例',
        result: '基础绩效金额'
      },
      {
        id: 'excess-performance-v2',
        item: '超额绩效工资',
        variables: ['超额分', '每分绩效金额', '超额激励倍数', '超额绩效确认比例'],
        method: '超额分 × 每分绩效金额 × 超额激励倍数 × 超额绩效确认比例',
        result: '超额绩效金额'
      },
      {
        id: 'monthly-performance-v2',
        item: '月度绩效工资',
        variables: ['基础绩效金额', '超额绩效金额'],
        method: '基础绩效金额 + 超额绩效金额',
        result: '月度绩效金额'
      }
    ],
    ruleParameterFields: [
      {
        id: 'field-full-score-v2',
        fieldKey: 'full_score',
        label: '满分口径',
        type: 'number',
        required: true,
        usage: '限制100分以内基础绩效分，并识别超额分',
        example: '100'
      },
      {
        id: 'field-base-line-score-v2',
        fieldKey: 'base_line_score',
        label: '基础达成线',
        type: 'number',
        required: true,
        usage: '判断任务完成分确认比例',
        example: '80'
      },
      {
        id: 'field-base-performance-amount-v2',
        fieldKey: 'base_performance_amount',
        label: '基础绩效基准金额',
        type: 'money',
        required: true,
        usage: '计算100分口径下每分绩效折算金额',
        example: '2500'
      },
      {
        id: 'field-prepay-ratio-v2',
        fieldKey: 'monthly_prepay_ratio',
        label: '月度预发比例',
        type: 'ratio',
        required: true,
        usage: '生成次月工资中的绩效预发金额',
        example: '0.5'
      },
      {
        id: 'field-review-cycle-v2',
        fieldKey: 'review_cycle',
        label: '复核结算',
        type: 'enum',
        required: true,
        usage: '决定差额复核和发放节奏',
        example: 'quarterly'
      }
    ],
    taskEventFields: [],
    monthlyResultFields: [],
    preservedClauses: [
      {
        id: 'clause-valid-result-v2',
        title: '未确认或无效成果',
        treatment: '人工复核',
        note: '未通过验收、重大返工、逾期严重或流程未闭环的成果不应直接计入任务分，需要任务状态和复核结论共同判断。'
      },
      {
        id: 'clause-objection-v2',
        title: '异议与复核',
        treatment: '文本留痕',
        note: '员工收到绩效明细后3个工作日内可提出核对意见；该条款应进入复核流程说明，不直接参与金额公式。'
      }
    ],
    sourceFiles: [
      {
        id: 'source-space-v2-final',
        name: '绘图任务制V2调整确认文件.docx',
        fileType: '上传规则文件',
        uploadedBy: '李明',
        uploadedAt: '2026-06-13',
        note: 'V2调整依据文件，仅调整平面图分值。'
      }
    ],
    generatedFiles: [],
    versionEvents: [
      {
        id: 'event-v2-1',
        version: 'V2',
        time: '2026-06-13',
        actor: '李明',
        action: '发布规则',
        changeSummary: '平面图 3.4 -> 3.8',
        note: '发布后可发起签署；未完成签署的员工继续按V1执行'
      }
    ]
  }
];

export const performanceSignatureBatches: PerformanceSignatureBatch[] = [
  {
    id: 'perf-sign-space-v1-202606',
    code: 'SIGN-2026-SPACE-001',
    name: '绘图任务制V1 签署批次',
    ruleId: 'perf-rule-space-design-2026-final',
    ruleName: '绘图任务制V1',
    category: '绘图任务制',
    ruleVersion: 'V1',
    executionFallback: '员工已签署V1，当前绘图任务制按V1执行',
    positions: ['空间设计师', '主案设计师'],
    personnelType: '全职',
    fileName: '绘图任务制V1.docx',
    fileVersion: '文件V1',
    method: '在线确认',
    status: '已完成',
    launchedAt: '2026-06-13',
    launchedBy: '李明',
    effectiveDate: '2026-06-01',
    totalCount: 2,
    confirmedCount: 2,
    payrollUsableCount: 2,
    riskNote: '员工已在线确认该绩效规则；真实电子签、身份核验和法律效力需要后续接入服务与法务确认',
    employees: [
      {
        id: 'sign-emp-space-20260004-v1',
        employeeName: '赵倩',
        workNo: '20260004',
        position: '空间设计师',
        currentRuleVersion: 'V1',
        executionRuleVersion: 'V1',
        calculationPolicy: '已签署V1，按V1计算',
        confirmStatus: '已确认',
        confirmedAt: '2026-06-13 10:18',
        method: '在线确认',
        effectiveDate: '2026-06-01',
        payrollUsable: true,
        note: '当前月度绩效按该规则版本快照计算'
      },
      {
        id: 'sign-emp-space-20260008-v1',
        employeeName: '刘宇',
        workNo: '20260008',
        position: '空间设计师',
        currentRuleVersion: 'V1',
        executionRuleVersion: 'V1',
        calculationPolicy: '已签署V1，按V1计算',
        confirmStatus: '已确认',
        confirmedAt: '2026-06-13 10:22',
        method: '在线确认',
        effectiveDate: '2026-06-01',
        payrollUsable: true,
        note: '当前月度绩效按该规则版本快照计算'
      }
    ],
    events: [
      {
        id: 'sign-event-space-v1-create',
        time: '2026-06-13 09:50',
        actor: '李明',
        action: '发起签署',
        changeSummary: '按绘图任务制V1发起员工在线确认',
        note: '员工确认对象为规则版本快照'
      },
      {
        id: 'sign-event-space-v1-complete',
        time: '2026-06-13 10:22',
        actor: '系统原型',
        action: '确认完成',
        changeSummary: '2/2 名员工完成在线确认',
        note: '前端原型留痕，未接入真实电子签服务'
      }
    ]
  },
  {
    id: 'perf-sign-space-v2-draft',
    code: 'SIGN-2026-SPACE-002',
    name: '绘图任务制V2 签署批次',
    ruleId: 'perf-rule-space-design-v2-draft',
    ruleName: '绘图任务制V2',
    category: '绘图任务制',
    ruleVersion: 'V2',
    previousRuleVersion: 'V1',
    executionFallback: '员工未签署V2前继续按已签署V1执行',
    positions: ['空间设计师', '主案设计师'],
    personnelType: '全职',
    fileName: '绘图任务制V2.docx',
    fileVersion: '文件V2',
    method: '在线确认',
    status: '待员工确认',
    launchedAt: '2026-06-13',
    launchedBy: '李明',
    effectiveDate: '2026-07-01',
    totalCount: 2,
    confirmedCount: 0,
    payrollUsableCount: 2,
    riskNote: 'V2已发布并发起签署；员工未确认前不替换当前执行版本，月度绩效继续按已签署的V1计算。',
    employees: [
      {
        id: 'sign-emp-space-20260004-v2',
        employeeName: '赵倩',
        workNo: '20260004',
        position: '空间设计师',
        currentRuleVersion: 'V1',
        pendingRuleVersion: 'V2',
        executionRuleVersion: 'V1',
        calculationPolicy: '未签V2，继续按V1计算',
        confirmStatus: '待确认',
        method: '在线确认',
        effectiveDate: '2026-07-01',
        payrollUsable: true,
        note: '待确认新版；当前绘图任务制仍执行V1'
      },
      {
        id: 'sign-emp-space-20260008-v2',
        employeeName: '刘宇',
        workNo: '20260008',
        position: '空间设计师',
        currentRuleVersion: 'V1',
        pendingRuleVersion: 'V2',
        executionRuleVersion: 'V1',
        calculationPolicy: '未签V2，继续按V1计算',
        confirmStatus: '待确认',
        method: '在线确认',
        effectiveDate: '2026-07-01',
        payrollUsable: true,
        note: '待确认新版；当前绘图任务制仍执行V1'
      }
    ],
    events: [
      {
        id: 'sign-event-space-v2-create',
        time: '2026-06-13 14:10',
        actor: '李明',
        action: '发起签署',
        changeSummary: '选择绘图任务制V2，发起绘图任务制新版确认',
        note: '员工未确认前继续按V1执行，同一绩效类别不会同时执行两个版本'
      }
    ]
  }
];

export const performanceDrawingTaskMonthlyRecords: PerformanceDrawingTaskMonthlyRecord[] = [
  {
    id: 'monthly-drawing-202606-liuyu',
    employeeName: '刘宇',
    workNo: '20260008',
    position: '空间设计师',
    department: '设计部',
    category: '绘图任务制',
    ruleName: '绘图任务制V1',
    ruleVersion: 'V1',
    performanceMonth: '2026-06',
    taskScore: 76.4,
    qualityScore: 86,
    qualityBand: '80-89分',
    baseQualityRatio: 0.9,
    excessQualityRatio: 0.9,
    monthlyAmount: 859.5,
    prepayAmount: 429.75,
    sourceTaskCount: 35,
    updatedAt: '2026-06-14 10:22',
    taskSummaries: [
      { id: 'liuyu-202606-plan', taskItem: '平面图', quantity: 12, quantityUnit: '套/门店', scorePerUnit: 3.4, scoreUnit: '分', subtotalScore: 40.8 },
      { id: 'liuyu-202606-drawing', taskItem: '施工图', quantity: 8, quantityUnit: '套/门店', scorePerUnit: 2.2, scoreUnit: '分', subtotalScore: 17.6 },
      { id: 'liuyu-202606-order', taskItem: '物料营建单/下单流程', quantity: 7, quantityUnit: '套/门店', scorePerUnit: 1.2, scoreUnit: '分', subtotalScore: 8.4 },
      { id: 'liuyu-202606-photoshop', taskItem: '门店P图', quantity: 8, quantityUnit: '套/门店', scorePerUnit: 1.2, scoreUnit: '分', subtotalScore: 9.6 }
    ],
    qualitySummaries: [
      { id: 'liuyu-202606-quality', dimension: '成果有效性与质量', maxScore: 40, score: 34 },
      { id: 'liuyu-202606-timeliness', dimension: '交付时效', maxScore: 25, score: 22 },
      { id: 'liuyu-202606-workflow', dimension: '流程闭环', maxScore: 25, score: 22 },
      { id: 'liuyu-202606-collaboration', dimension: '项目配合与沟通归档', maxScore: 10, score: 8 }
    ],
    amountSummary: {
      pointValue: 25,
      confirmedBaseScore: 76.4,
      excessScore: 0,
      taskConfirmRatio: 0.5,
      baseQualityRatio: 0.9,
      excessQualityRatio: 0.9,
      excessMultiplier: 0,
      baseAmount: 859.5,
      excessAmount: 0,
      monthlyAmount: 859.5,
      prepayRatio: 0.5,
      prepayAmount: 429.75,
      settlementNote: '未达到80分基础达成线，100分以内确认分按50%任务确认比例计算。'
    },
    events: [
      {
        id: 'monthly-event-liuyu-202606-sync',
        time: '2026-06-14 10:18',
        actor: '系统同步',
        action: '归集绩效明细',
        object: '刘宇 / 2026-06 / 绘图任务制',
        summary: '从任务模块归集 35 条来源任务形成绩效明细'
      },
      {
        id: 'monthly-event-liuyu-202606-quality',
        time: '2026-06-14 10:22',
        actor: '系统同步',
        action: '写入质量确认',
        object: '刘宇 / 绘图任务制V1',
        summary: '质量分 86 分，匹配 80-89 分档'
      }
    ]
  },
  {
    id: 'monthly-drawing-202606-chensi',
    employeeName: '陈思',
    workNo: '20260011',
    position: '主案设计师',
    department: '设计部',
    category: '绘图任务制',
    ruleName: '绘图任务制V1',
    ruleVersion: 'V1',
    performanceMonth: '2026-06',
    taskScore: 133,
    qualityScore: 91,
    qualityBand: '90分及以上',
    baseQualityRatio: 1,
    excessQualityRatio: 1,
    monthlyAmount: 3613.75,
    prepayAmount: 1806.88,
    sourceTaskCount: 58,
    updatedAt: '2026-06-14 11:05',
    taskSummaries: [
      { id: 'chensi-202606-plan', taskItem: '平面图', quantity: 22, quantityUnit: '套/门店', scorePerUnit: 3.4, scoreUnit: '分', subtotalScore: 74.8 },
      { id: 'chensi-202606-drawing', taskItem: '施工图', quantity: 15, quantityUnit: '套/门店', scorePerUnit: 2.2, scoreUnit: '分', subtotalScore: 33 },
      { id: 'chensi-202606-order', taskItem: '物料营建单/下单流程', quantity: 9, quantityUnit: '套/门店', scorePerUnit: 1.2, scoreUnit: '分', subtotalScore: 10.8 },
      { id: 'chensi-202606-photoshop', taskItem: '门店P图', quantity: 12, quantityUnit: '套/门店', scorePerUnit: 1.2, scoreUnit: '分', subtotalScore: 14.4 }
    ],
    qualitySummaries: [
      { id: 'chensi-202606-quality', dimension: '成果有效性与质量', maxScore: 40, score: 37 },
      { id: 'chensi-202606-timeliness', dimension: '交付时效', maxScore: 25, score: 23 },
      { id: 'chensi-202606-workflow', dimension: '流程闭环', maxScore: 25, score: 23 },
      { id: 'chensi-202606-collaboration', dimension: '项目配合与沟通归档', maxScore: 10, score: 8 }
    ],
    amountSummary: {
      pointValue: 25,
      confirmedBaseScore: 100,
      excessScore: 33,
      taskConfirmRatio: 1,
      baseQualityRatio: 1,
      excessQualityRatio: 1,
      excessMultiplier: 1.35,
      baseAmount: 2500,
      excessAmount: 1113.75,
      monthlyAmount: 3613.75,
      prepayRatio: 0.5,
      prepayAmount: 1806.88,
      settlementNote: '任务完成分超过120分，超额分按 1.35 倍计算。'
    },
    events: [
      {
        id: 'monthly-event-chensi-202606-sync',
        time: '2026-06-14 11:00',
        actor: '系统同步',
        action: '归集绩效明细',
        object: '陈思 / 2026-06 / 绘图任务制',
        summary: '从任务模块归集 58 条来源任务形成绩效明细'
      },
      {
        id: 'monthly-event-chensi-202606-quality',
        time: '2026-06-14 11:05',
        actor: '系统同步',
        action: '写入质量确认',
        object: '陈思 / 绘图任务制V1',
        summary: '质量分 91 分，基础和超额绩效均可全额确认'
      }
    ]
  },
  {
    id: 'monthly-drawing-202606-zhaoqian',
    employeeName: '赵倩',
    workNo: '20260004',
    position: '空间设计师',
    department: '设计部',
    category: '绘图任务制',
    ruleName: '绘图任务制V2',
    ruleVersion: 'V2',
    performanceMonth: '2026-06',
    taskScore: 100.6,
    qualityScore: 88,
    qualityBand: '80-89分',
    baseQualityRatio: 0.9,
    excessQualityRatio: 0.9,
    monthlyAmount: 2266.2,
    prepayAmount: 1133.1,
    sourceTaskCount: 43,
    updatedAt: '2026-06-14 09:35',
    taskSummaries: [
      { id: 'zhaoqian-202606-plan', taskItem: '平面图', quantity: 15, quantityUnit: '套/门店', scorePerUnit: 3.8, scoreUnit: '分', subtotalScore: 57 },
      { id: 'zhaoqian-202606-drawing', taskItem: '施工图', quantity: 10, quantityUnit: '套/门店', scorePerUnit: 2.2, scoreUnit: '分', subtotalScore: 22 },
      { id: 'zhaoqian-202606-order', taskItem: '物料营建单/下单流程', quantity: 8, quantityUnit: '套/门店', scorePerUnit: 1.2, scoreUnit: '分', subtotalScore: 9.6 },
      { id: 'zhaoqian-202606-photoshop', taskItem: '门店P图', quantity: 10, quantityUnit: '套/门店', scorePerUnit: 1.2, scoreUnit: '分', subtotalScore: 12 }
    ],
    qualitySummaries: [
      { id: 'zhaoqian-202606-quality', dimension: '成果有效性与质量', maxScore: 40, score: 35 },
      { id: 'zhaoqian-202606-timeliness', dimension: '交付时效', maxScore: 25, score: 22 },
      { id: 'zhaoqian-202606-workflow', dimension: '流程闭环', maxScore: 25, score: 22 },
      { id: 'zhaoqian-202606-collaboration', dimension: '项目配合与沟通归档', maxScore: 10, score: 9 }
    ],
    amountSummary: {
      pointValue: 25,
      confirmedBaseScore: 100,
      excessScore: 0.6,
      taskConfirmRatio: 1,
      baseQualityRatio: 0.9,
      excessQualityRatio: 0.9,
      excessMultiplier: 1.2,
      baseAmount: 2250,
      excessAmount: 16.2,
      monthlyAmount: 2266.2,
      prepayRatio: 0.5,
      prepayAmount: 1133.1,
      settlementNote: '员工已签署 V2，平面图按 3.8 分计入当月。'
    },
    events: [
      {
        id: 'monthly-event-zhaoqian-202606-sync',
        time: '2026-06-14 09:20',
        actor: '系统同步',
        action: '归集绩效明细',
        object: '赵倩 / 2026-06 / 绘图任务制',
        summary: '按已签署的绘图任务制V2归集当月任务'
      },
      {
        id: 'monthly-event-zhaoqian-202606-confirm',
        time: '2026-06-14 09:35',
        actor: '李明',
        action: '写入绩效明细',
        object: '赵倩 / 绘图任务制V2',
        summary: '写入 2026-06 绩效明细金额 2,266.20 元'
      }
    ]
  },
  {
    id: 'monthly-drawing-202605-liuyu',
    employeeName: '刘宇',
    workNo: '20260008',
    position: '空间设计师',
    department: '设计部',
    category: '绘图任务制',
    ruleName: '绘图任务制V1',
    ruleVersion: 'V1',
    performanceMonth: '2026-05',
    taskScore: 92,
    qualityScore: 90,
    qualityBand: '90分及以上',
    baseQualityRatio: 1,
    excessQualityRatio: 1,
    monthlyAmount: 2300,
    prepayAmount: 1150,
    sourceTaskCount: 39,
    updatedAt: '2026-06-05 18:30',
    taskSummaries: [
      { id: 'liuyu-202605-plan', taskItem: '平面图', quantity: 16, quantityUnit: '套/门店', scorePerUnit: 3.4, scoreUnit: '分', subtotalScore: 54.4 },
      { id: 'liuyu-202605-drawing', taskItem: '施工图', quantity: 10, quantityUnit: '套/门店', scorePerUnit: 2.2, scoreUnit: '分', subtotalScore: 22 },
      { id: 'liuyu-202605-order', taskItem: '物料营建单/下单流程', quantity: 6, quantityUnit: '套/门店', scorePerUnit: 1.2, scoreUnit: '分', subtotalScore: 7.2 },
      { id: 'liuyu-202605-photoshop', taskItem: '门店P图', quantity: 7, quantityUnit: '套/门店', scorePerUnit: 1.2, scoreUnit: '分', subtotalScore: 8.4 }
    ],
    qualitySummaries: [
      { id: 'liuyu-202605-quality', dimension: '成果有效性与质量', maxScore: 40, score: 36 },
      { id: 'liuyu-202605-timeliness', dimension: '交付时效', maxScore: 25, score: 23 },
      { id: 'liuyu-202605-workflow', dimension: '流程闭环', maxScore: 25, score: 22 },
      { id: 'liuyu-202605-collaboration', dimension: '项目配合与沟通归档', maxScore: 10, score: 9 }
    ],
    amountSummary: {
      pointValue: 25,
      confirmedBaseScore: 92,
      excessScore: 0,
      taskConfirmRatio: 1,
      baseQualityRatio: 1,
      excessQualityRatio: 1,
      excessMultiplier: 0,
      baseAmount: 2300,
      excessAmount: 0,
      monthlyAmount: 2300,
      prepayRatio: 0.5,
      prepayAmount: 1150,
      settlementNote: '2026-05 绩效明细已锁定，后续仅保留查看。'
    },
    events: [
      {
        id: 'monthly-event-liuyu-202605-sync',
        time: '2026-06-01 09:30',
        actor: '系统同步',
        action: '归集绩效明细',
        object: '刘宇 / 2026-05 / 绘图任务制',
        summary: '从任务模块归集 39 条来源任务形成绩效明细'
      },
      {
        id: 'monthly-event-liuyu-202605-lock',
        time: '2026-06-05 18:30',
        actor: '李明',
        action: '锁定绩效明细',
        object: '刘宇 / 绘图任务制V1',
        summary: '锁定 2026-05 绩效明细'
      }
    ]
  }
];

export const performanceMonthlyCategoryRecords: PerformanceMonthlyCategoryRecord[] = [
  ...performanceDrawingTaskMonthlyRecords.map((record) => ({
    id: record.id,
    employeeName: record.employeeName,
    workNo: record.workNo,
    position: record.position,
    department: record.department,
    category: record.category,
    ruleName: record.ruleName,
    ruleVersion: record.ruleVersion,
    performanceMonth: record.performanceMonth,
    monthlyAmount: record.monthlyAmount,
    prepayAmount: record.prepayAmount,
    sourceTaskCount: record.sourceTaskCount,
    qualityScore: record.qualityScore,
    taskScore: record.taskScore,
    updatedAt: record.updatedAt,
    sourceLabel: '任务汇总',
    note: '来自绘图任务制绩效明细',
    events: record.events
  })),
  {
    id: 'monthly-duty-202606-zhaoqian',
    employeeName: '赵倩',
    workNo: '20260004',
    position: '空间设计师',
    department: '设计部',
    category: '岗位职责考核',
    ruleName: '岗位职责考核V1',
    ruleVersion: 'V1',
    performanceMonth: '2026-06',
    monthlyAmount: 1200,
    prepayAmount: 600,
    sourceTaskCount: 0,
    qualityScore: 92,
    updatedAt: '2026-06-14 10:45',
    sourceLabel: '周期考核',
    note: '岗位职责考核按周期评价结果进入员工绩效汇总',
    events: [
      {
        id: 'monthly-event-zhaoqian-duty-202606-sync',
        time: '2026-06-14 10:40',
        actor: '系统同步',
        action: '归集绩效明细',
        object: '赵倩 / 2026-06 / 岗位职责考核',
        summary: '按已上传签署文件和周期评价结果归集岗位职责考核绩效明细'
      },
      {
        id: 'monthly-event-zhaoqian-duty-202606-write',
        time: '2026-06-14 10:45',
        actor: '李明',
        action: '写入绩效明细',
        object: '赵倩 / 岗位职责考核V1',
        summary: '写入岗位职责考核绩效明细金额 1,200.00 元'
      }
    ]
  },
  {
    id: 'monthly-duty-202606-chensi',
    employeeName: '陈思',
    workNo: '20260011',
    position: '主案设计师',
    department: '设计部',
    category: '岗位职责考核',
    ruleName: '岗位职责考核V1',
    ruleVersion: 'V1',
    performanceMonth: '2026-06',
    monthlyAmount: 1500,
    prepayAmount: 750,
    sourceTaskCount: 0,
    qualityScore: 90,
    updatedAt: '2026-06-14 11:40',
    sourceLabel: '周期考核',
    note: '岗位职责考核按周期评价结果进入员工绩效汇总',
    events: [
      {
        id: 'monthly-event-chensi-duty-202606-sync',
        time: '2026-06-14 11:35',
        actor: '系统同步',
        action: '归集绩效明细',
        object: '陈思 / 2026-06 / 岗位职责考核',
        summary: '按已上传签署文件和周期评价结果归集岗位职责考核绩效明细'
      },
      {
        id: 'monthly-event-chensi-duty-202606-write',
        time: '2026-06-14 11:40',
        actor: '李明',
        action: '写入绩效明细',
        object: '陈思 / 岗位职责考核V1',
        summary: '写入岗位职责考核绩效明细金额 1,500.00 元'
      }
    ]
  },
  {
    id: 'monthly-bonus-202605-liuyu',
    employeeName: '刘宇',
    workNo: '20260008',
    position: '空间设计师',
    department: '设计部',
    category: '项目奖金',
    ruleName: '项目奖金V1',
    ruleVersion: 'V1',
    performanceMonth: '2026-05',
    monthlyAmount: 600,
    prepayAmount: 600,
    sourceTaskCount: 0,
    qualityScore: 88,
    updatedAt: '2026-06-03 16:20',
    sourceLabel: '奖金记录',
    note: '历史项目奖金作为员工月度汇总构成保留',
    events: [
      {
        id: 'monthly-event-liuyu-bonus-202605-sync',
        time: '2026-06-03 16:10',
        actor: '系统同步',
        action: '归集绩效明细',
        object: '刘宇 / 2026-05 / 项目奖金',
        summary: '按历史项目奖金签署文件和奖金记录归集绩效明细'
      },
      {
        id: 'monthly-event-liuyu-bonus-202605-write',
        time: '2026-06-03 16:20',
        actor: '李明',
        action: '写入绩效明细',
        object: '刘宇 / 项目奖金V1',
        summary: '写入项目奖金 600.00 元'
      }
    ]
  }
];
