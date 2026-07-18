import type { PerformanceRulePreset } from './performanceTypes';

export const performanceRulePresets: PerformanceRulePreset[] = [
  {
    id: 'perf-rule-space-design-2026-final',
    code: 'PERF-2026-SPACE-001',
    name: '绘图任务制V1',
    performanceType: '任务制',
    category: '绘图任务制',
    categoryVersionState: '历史发布版本',
    templateMode: '固定模块',
    editableScope: '固定任务项与质量维度；仅调整分值、最高分值、达标线和金额参数',
    applicablePositions: ['CEO', '空间设计师', '主案设计师'],
    personnelType: '全职',
    status: '已发布',
    currentVersion: 'V1',
    effectiveStartAt: '2026-06-01',
    effectiveEndAt: '2026-06-30',
    lockReason: '历史发布版本，仅适用于2026-06期间；后续期间按新版本自动适用',
    generatedFileSummary: '已上传 绩效工资考核与发放规则_最终版.docx',
    fullScore: 100,
    baseLineScore: 80,
    basePerformanceAmount: 2500,
    belowBaselineFactor: 0.5,
    monthlyPrepayRatio: 0.5,
    scoringCycle: '自然月',
    reviewCycle: '季度复核',
    taskScoreSummary: '平面图、施工图、物料营建单/下单流程、门店P图按套/门店确认',
    qualityScoreSummary: '成果质量最高40、交付时效最高25、流程闭环最高25、项目配合最高10',
    calculationSummary: '100分以内基础绩效 + 100分以上超额绩效，均受质量确认比例影响',
    structuredFieldSummary: '已拆规则参数、任务事件、月度结果三类可计算字段',
    scopeNote: '适用于空间设计师、主案设计师及兼任设计执行的CEO；不适用于兼职/合作岗位',
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
        weight: 0.4,
        focus: '成果符合品牌标准、现场条件及施工落地要求，重大错误、漏项、反复返工情况较少',
        evidence: '成果文件、审核意见、返工记录、甲方确认'
      },
      {
        id: 'timeliness',
        name: '交付时效',
        score: 25,
        weight: 0.25,
        focus: '按要求及时提交、修改、提审、上传、下单或完成阶段节点',
        evidence: '任务单、项目记录、系统记录、沟通记录'
      },
      {
        id: 'workflow',
        name: '流程闭环',
        score: 25,
        weight: 0.25,
        focus: '按既定流程完成提审、反馈处理、文件上传、下单确认、资料归档等闭环工作',
        evidence: '流程记录、提审记录、上传/归档记录'
      },
      {
        id: 'collaboration',
        name: '项目配合与沟通归档',
        score: 10,
        weight: 0.1,
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
        changeSummary: '拆分规则版本与签署档案',
        note: '规则页只维护规则版本，签署文件仅作为线下档案留存'
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
    applicablePositions: ['CEO', '空间设计师', '主案设计师'],
    personnelType: '全职',
    status: '已发布',
    currentVersion: 'V2',
    parentRuleId: 'perf-rule-space-design-2026-final',
    effectiveStartAt: '2026-07-01',
    lockReason: '已发布为绘图任务制当前版本；自生效日期起按人员类型和岗位自动适用',
    generatedFileSummary: '已上传 绘图任务制V2调整确认文件.docx',
    fullScore: 100,
    baseLineScore: 80,
    basePerformanceAmount: 2500,
    belowBaselineFactor: 0.5,
    monthlyPrepayRatio: 0.5,
    scoringCycle: '自然月',
    reviewCycle: '季度复核',
    taskScoreSummary: '绘图任务制固定任务项不增删；拟调整平面图分值，其余任务沿用V1',
    qualityScoreSummary: '成果质量最高40、交付时效最高25、流程闭环最高25、项目配合最高10',
    calculationSummary: '发布后自生效日期起自动适用，不以签署档案作为计算条件',
    structuredFieldSummary: '沿用V1字段结构，月度结果保存实际适用规则版本快照',
    scopeNote: '适用于全职空间设计师、主案设计师及兼任设计执行的CEO；自约定生效日自动执行',
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
        weight: 0.4,
        focus: '成果符合品牌标准、现场条件及施工落地要求，重大错误、漏项、反复返工情况较少',
        evidence: '成果文件、审核意见、返工记录、甲方确认'
      },
      {
        id: 'timeliness-v2',
        name: '交付时效',
        score: 25,
        weight: 0.25,
        focus: '按要求及时提交、修改、提审、上传、下单或完成阶段节点',
        evidence: '任务单、项目记录、系统记录、沟通记录'
      },
      {
        id: 'workflow-v2',
        name: '流程闭环',
        score: 25,
        weight: 0.25,
        focus: '按既定流程完成提审、反馈处理、文件上传、下单确认、资料归档等闭环工作',
        evidence: '流程记录、提审记录、上传/归档记录'
      },
      {
        id: 'collaboration-v2',
        name: '项目配合与沟通归档',
        score: 10,
        weight: 0.1,
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
        note: '发布后按人员类型、岗位和生效期间自动适用'
      }
    ]
  }
];
