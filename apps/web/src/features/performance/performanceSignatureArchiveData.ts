import type { OperationRecord } from '../../components/OperationRecordTable';
import type { PerformanceRuleCategory } from './performanceTypes';

export type PerformanceSignatureRelationStatus = '当前签署' | '历史文件';
export type PerformanceArchiveEmployeeStatus = '在职' | '试用期' | '离职';

export type PerformanceSignatureRuleOption = {
  id: string;
  category: PerformanceRuleCategory;
  ruleName: string;
  ruleVersion: string;
  applicablePositions: string[];
};

export type PerformanceSignatureFile = {
  id: string;
  category: PerformanceRuleCategory;
  ruleName: string;
  ruleVersion: string;
  relationStatus: PerformanceSignatureRelationStatus;
  fileName: string;
  signedAt: string;
  uploadedAt: string;
  note: string;
};

export type PerformanceEmployeeSignatureArchive = {
  id: string;
  employeeName: string;
  workNo: string;
  department: string;
  position: string;
  employeeStatus: PerformanceArchiveEmployeeStatus;
  personnelType: '全职';
  updatedAt: string;
  updatedBy: string;
  files: PerformanceSignatureFile[];
  operationRecords: OperationRecord[];
};

export const performanceSignatureEmployees: PerformanceEmployeeSignatureArchive[] = [
  {
    id: 'perf-signature-employee-20260004',
    employeeName: '赵倩',
    workNo: '20260004',
    department: '设计部',
    position: '空间设计师',
    employeeStatus: '在职',
    personnelType: '全职',
    updatedAt: '2026-06-14',
    updatedBy: '李明',
    files: [
      {
        id: 'perf-file-20260004-draw-v2',
        category: '绘图任务制',
        ruleName: '绘图任务制V2',
        ruleVersion: 'V2',
        relationStatus: '当前签署',
        fileName: '赵倩_绘图任务制V2_绩效签署文件.pdf',
        signedAt: '2026-06-14',
        uploadedAt: '2026-06-14 10:18',
        note: '当前绘图任务制关联文件'
      },
      {
        id: 'perf-file-20260004-duty-v1',
        category: '岗位职责考核',
        ruleName: '岗位职责考核V1',
        ruleVersion: 'V1',
        relationStatus: '当前签署',
        fileName: '赵倩_岗位职责考核V1_绩效签署文件.pdf',
        signedAt: '2026-06-14',
        uploadedAt: '2026-06-14 10:22',
        note: '当前岗位职责考核关联文件'
      },
      {
        id: 'perf-file-20260004-draw-v1',
        category: '绘图任务制',
        ruleName: '绘图任务制V1',
        ruleVersion: 'V1',
        relationStatus: '历史文件',
        fileName: '赵倩_绘图任务制V1_绩效签署文件.pdf',
        signedAt: '2026-06-01',
        uploadedAt: '2026-06-01 16:30',
        note: '绘图任务制旧版本签署文件'
      }
    ],
    operationRecords: [
      {
        id: 'perf-op-20260004-1',
        time: '2026-06-01 16:30',
        actor: '李明',
        object: '绘图任务制V1',
        action: '上传签署文件',
        summary: '上传赵倩绘图任务制V1签署文件'
      },
      {
        id: 'perf-op-20260004-2',
        time: '2026-06-14 10:18',
        actor: '李明',
        object: '绘图任务制V2',
        action: '更新当前签署',
        summary: '上传V2签署文件，V1转为历史文件'
      },
      {
        id: 'perf-op-20260004-3',
        time: '2026-06-14 10:22',
        actor: '李明',
        object: '岗位职责考核V1',
        action: '上传签署文件',
        summary: '新增岗位职责考核当前签署文件'
      }
    ]
  },
  {
    id: 'perf-signature-employee-20260008',
    employeeName: '刘宇',
    workNo: '20260008',
    department: '设计部',
    position: '空间设计师',
    employeeStatus: '在职',
    personnelType: '全职',
    updatedAt: '2026-06-13',
    updatedBy: '李明',
    files: [
      {
        id: 'perf-file-20260008-draw-v1',
        category: '绘图任务制',
        ruleName: '绘图任务制V1',
        ruleVersion: 'V1',
        relationStatus: '当前签署',
        fileName: '刘宇_绘图任务制V1_绩效签署文件.pdf',
        signedAt: '2026-06-13',
        uploadedAt: '2026-06-13 10:22',
        note: '当前绘图任务制关联文件'
      },
      {
        id: 'perf-file-20260008-bonus-v1',
        category: '项目奖金',
        ruleName: '项目奖金V1',
        ruleVersion: 'V1',
        relationStatus: '历史文件',
        fileName: '刘宇_项目奖金V1_绩效签署文件.pdf',
        signedAt: '2026-05-20',
        uploadedAt: '2026-05-20 15:45',
        note: '历史项目奖金签署文件'
      }
    ],
    operationRecords: [
      {
        id: 'perf-op-20260008-1',
        time: '2026-05-20 15:45',
        actor: '李明',
        object: '项目奖金V1',
        action: '上传签署文件',
        summary: '上传刘宇历史项目奖金签署文件'
      },
      {
        id: 'perf-op-20260008-2',
        time: '2026-06-13 10:22',
        actor: '李明',
        object: '绘图任务制V1',
        action: '上传签署文件',
        summary: '上传刘宇当前绘图任务制签署文件'
      }
    ]
  },
  {
    id: 'perf-signature-employee-20260011',
    employeeName: '陈思',
    workNo: '20260011',
    department: '设计部',
    position: '主案设计师',
    employeeStatus: '试用期',
    personnelType: '全职',
    updatedAt: '2026-06-14',
    updatedBy: '李明',
    files: [
      {
        id: 'perf-file-20260011-draw-v1',
        category: '绘图任务制',
        ruleName: '绘图任务制V1',
        ruleVersion: 'V1',
        relationStatus: '当前签署',
        fileName: '陈思_绘图任务制V1_绩效签署文件.pdf',
        signedAt: '2026-06-14',
        uploadedAt: '2026-06-14 11:12',
        note: '当前绘图任务制关联文件'
      },
      {
        id: 'perf-file-20260011-duty-v1',
        category: '岗位职责考核',
        ruleName: '岗位职责考核V1',
        ruleVersion: 'V1',
        relationStatus: '当前签署',
        fileName: '陈思_岗位职责考核V1_绩效签署文件.pdf',
        signedAt: '2026-06-14',
        uploadedAt: '2026-06-14 11:20',
        note: '当前岗位职责考核关联文件'
      }
    ],
    operationRecords: [
      {
        id: 'perf-op-20260011-1',
        time: '2026-06-14 11:12',
        actor: '李明',
        object: '绘图任务制V1',
        action: '上传签署文件',
        summary: '上传陈思绘图任务制签署文件'
      },
      {
        id: 'perf-op-20260011-2',
        time: '2026-06-14 11:20',
        actor: '李明',
        object: '岗位职责考核V1',
        action: '上传签署文件',
        summary: '上传陈思岗位职责考核签署文件'
      }
    ]
  }
];

export const signatureRuleOptions: PerformanceSignatureRuleOption[] = [
  {
    id: 'rule-draw-v3',
    category: '绘图任务制',
    ruleName: '绘图任务制V3',
    ruleVersion: 'V3',
    applicablePositions: ['空间设计师', '主案设计师']
  },
  {
    id: 'rule-draw-v2',
    category: '绘图任务制',
    ruleName: '绘图任务制V2',
    ruleVersion: 'V2',
    applicablePositions: ['空间设计师', '主案设计师']
  },
  {
    id: 'rule-duty-v1',
    category: '岗位职责考核',
    ruleName: '岗位职责考核V1',
    ruleVersion: 'V1',
    applicablePositions: ['空间设计师', '主案设计师']
  },
  {
    id: 'rule-bonus-v1',
    category: '项目奖金',
    ruleName: '项目奖金V1',
    ruleVersion: 'V1',
    applicablePositions: ['空间设计师']
  }
];
