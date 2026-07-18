import { CheckCircleOutlined, DeleteOutlined, FileProtectOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { useEffect, useMemo, useState } from 'react';
import { DetailDrawerTitle } from '../../components/Detail';
import { DrawerShell } from '../../components/DrawerShell';
import { WorkflowDrawerShell } from '../../components/WorkflowDrawerShell';
import type { TaskConfigRow } from '../system/TaskConfigState';
import { PerformanceRuleEditWorkspace } from './PerformanceRuleEditWorkspace';
import { PerformanceRuleReadonlyTabs } from './PerformanceRuleReadonlyTabs';
import {
  buildRuleName,
  buildSourceFilesFromUploads,
  createTaskScoreItemFromTaskConfig,
  formatPositionList,
  getRulePositions,
  getRuleRelatedFileRecords,
  getRuleReviewBlockers,
  ruleCategoryOptions,
  ruleStatusTone,
  type RuleDrawerAction,
  type RuleRelatedFileRecord
} from './performanceRuleModel';
import type {
  PerformanceRuleCategory,
  PerformanceRulePreset,
  PerformanceRuleType,
  PerformanceTaskScoreItem
} from './performanceTypes';

type PerformanceRuleDrawerProps = {
  canDeleteDraft: boolean;
  onAction: (rule: PerformanceRulePreset, action: RuleDrawerAction) => void;
  onClose: () => void;
  onDownloadFile: (file: RuleRelatedFileRecord) => void;
  onPreviewFile: (file: RuleRelatedFileRecord) => void;
  rule: PerformanceRulePreset | null;
  taskConfigRows: TaskConfigRow[];
};

export function PerformanceRuleDrawer({
  canDeleteDraft,
  onAction,
  onClose,
  onDownloadFile,
  onPreviewFile,
  rule,
  taskConfigRows
}: PerformanceRuleDrawerProps) {
  const isOpen = Boolean(rule);
  const isReviewingRule = rule?.status === '待审核';
  const isEditMode = rule?.status === '草稿' || rule?.status === '审核驳回';
  const [draftCategory, setDraftCategory] = useState<PerformanceRuleCategory>('绘图任务制');
  const [draftPerformanceType, setDraftPerformanceType] = useState<PerformanceRuleType>('任务制');
  const [draftPositions, setDraftPositions] = useState<string[]>([]);
  const [draftFiles, setDraftFiles] = useState<UploadFile[]>([]);
  const [draftTaskScoreItems, setDraftTaskScoreItems] = useState<PerformanceTaskScoreItem[]>([]);

  useEffect(() => {
    if (!rule) {
      setDraftPerformanceType('任务制');
      setDraftPositions([]);
      setDraftFiles([]);
      setDraftTaskScoreItems([]);
      return;
    }

    setDraftPerformanceType(rule.performanceType);
    setDraftCategory(rule.category);
    setDraftPositions(getRulePositions(rule));
    setDraftTaskScoreItems(rule.taskScoreItems);
    setDraftFiles(
      rule.sourceFiles.map((file) => ({
        uid: file.id,
        name: file.name,
        status: 'done' as const
      }))
    );
  }, [rule]);

  const draftSourceFiles = useMemo(
    () => (rule && isEditMode ? buildSourceFilesFromUploads(rule, draftFiles) : []),
    [draftFiles, isEditMode, rule]
  );
  const editableRule = useMemo<PerformanceRulePreset | null>(() => {
    if (!rule || !isEditMode) {
      return null;
    }

    return {
      ...rule,
      category: draftCategory,
      performanceType: draftPerformanceType,
      name: buildRuleName(draftCategory, rule.currentVersion),
      applicablePositions: draftPositions,
      sourceFiles: draftSourceFiles,
      taskScoreItems: draftTaskScoreItems,
      generatedFileSummary: draftSourceFiles.length > 0 ? `已上传 ${draftSourceFiles[0].name}` : '待上传规则依据文件',
      taskScoreSummary:
        draftPerformanceType === '任务制'
          ? `已配置 ${draftTaskScoreItems.length} 个任务类型，质量评分维度固定`
          : '提成制暂未开放',
      scopeNote:
        rule.status === '审核驳回'
          ? `${draftCategory} ${rule.currentVersion} 已驳回，覆盖岗位：${formatPositionList(draftPositions)}，调整后可重新提交审核`
          : `${draftCategory} ${rule.currentVersion} 草稿，覆盖岗位：${formatPositionList(draftPositions)}，待提交审核后发布`
    };
  }, [draftCategory, draftPerformanceType, draftPositions, draftSourceFiles, draftTaskScoreItems, isEditMode, rule]);
  const activeRule = editableRule ?? rule;
  const reviewBlockers = activeRule ? getRuleReviewBlockers(activeRule) : [];
  const canSubmitReview = isEditMode && reviewBlockers.length === 0;
  const baseConfigComplete = !isEditMode || (draftPositions.length > 0 && draftFiles.length > 0);
  const relatedFileRecords = activeRule ? getRuleRelatedFileRecords(activeRule.sourceFiles) : [];
  const draftBasisFile = draftFiles[0];
  const draftBasisFileRecord = activeRule && activeRule.sourceFiles.length > 0 ? relatedFileRecords[0] : undefined;
  const currentCategoryOptions = ruleCategoryOptions.filter((option) => option.performanceType === draftPerformanceType);

  function addDraftTaskScoreItem(taskConfigId: string) {
    const taskConfig = taskConfigRows.find((row) => row.id === taskConfigId);

    if (!taskConfig) {
      return;
    }

    setDraftTaskScoreItems((currentItems) => {
      if (currentItems.some((item) => item.taskConfigId === taskConfigId)) {
        return currentItems;
      }

      return [...currentItems, createTaskScoreItemFromTaskConfig(taskConfig, currentItems.length + 1)];
    });
  }

  function removeDraftTaskScoreItem(itemId: string) {
    setDraftTaskScoreItems((currentItems) => currentItems.filter((item) => item.id !== itemId));
  }

  function updateDraftTaskScoreItem<K extends keyof PerformanceTaskScoreItem>(itemId: string, key: K, value: PerformanceTaskScoreItem[K]) {
    setDraftTaskScoreItems((currentItems) => currentItems.map((item) => (item.id === itemId ? { ...item, [key]: value } : item)));
  }

  function updateDraftPerformanceType(nextType: PerformanceRuleType) {
    setDraftPerformanceType(nextType);
    setDraftCategory(ruleCategoryOptions.find((option) => option.performanceType === nextType && !option.disabled)?.category ?? '绘图任务制');
    setDraftTaskScoreItems((currentItems) => (nextType === '任务制' ? currentItems : []));
  }

  const drawerTitle = activeRule ? (
    <DetailDrawerTitle
      status={activeRule.status}
      statusToneMap={ruleStatusTone}
      subtitle={`${activeRule.performanceType} / ${activeRule.category} / ${activeRule.currentVersion}`}
      title={activeRule.name}
    />
  ) : null;
  const drawerContent = activeRule ? (
    isEditMode ? (
      <PerformanceRuleEditWorkspace
        activeRule={activeRule}
        baseConfigComplete={baseConfigComplete}
        canSubmitReview={canSubmitReview}
        currentCategoryOptions={currentCategoryOptions}
        draftBasisFile={draftBasisFile}
        draftBasisFileRecord={draftBasisFileRecord}
        draftCategory={draftCategory}
        draftPerformanceType={draftPerformanceType}
        draftPositions={draftPositions}
        taskConfigRows={taskConfigRows}
        onAddTask={addDraftTaskScoreItem}
        onCategoryChange={setDraftCategory}
        onFilesChange={setDraftFiles}
        onPerformanceTypeChange={updateDraftPerformanceType}
        onPositionsChange={setDraftPositions}
        onPreviewFile={onPreviewFile}
        onRemoveTask={removeDraftTaskScoreItem}
        onUpdateTask={updateDraftTaskScoreItem}
      />
    ) : (
      <PerformanceRuleReadonlyTabs
        activeRule={activeRule}
        taskConfigRows={taskConfigRows}
        onDownloadFile={onDownloadFile}
        onPreviewFile={onPreviewFile}
      />
    )
  ) : null;

  if (isReviewingRule) {
    return (
      <WorkflowDrawerShell
        className="performance-rule-drawer"
        dangerAction={
          activeRule
            ? {
                label: '审核驳回',
                onClick: () => onAction(activeRule, 'rejectReview'),
                testId: 'performance-rule-reject-review-button'
              }
            : undefined
        }
        open={isOpen}
        primaryAction={
          activeRule
            ? {
                icon: <CheckCircleOutlined />,
                label: '审核通过并发布',
                onClick: () => onAction(activeRule, 'approveReview'),
                testId: 'performance-rule-approve-review-button'
              }
            : undefined
        }
        title={drawerTitle}
        width={840}
        onClose={onClose}
      >
        {drawerContent}
      </WorkflowDrawerShell>
    );
  }

  return (
    <DrawerShell
      cancelAction={
        activeRule?.status === '草稿' && canDeleteDraft
          ? {
              danger: true,
              icon: <DeleteOutlined />,
              label: '删除草稿',
              onClick: () => onAction(activeRule, 'deleteDraft'),
              testId: 'performance-rule-delete-draft-button'
            }
          : undefined
      }
      className="performance-rule-drawer"
      closeAction={
        isEditMode
          ? {
              label: '取消',
              onClick: onClose,
              testId: 'performance-rule-cancel-button'
            }
          : undefined
      }
      open={isOpen}
      primaryAction={
        activeRule && isEditMode
          ? {
              disabled: !canSubmitReview,
              icon: <FileProtectOutlined />,
              label: activeRule.status === '审核驳回' ? '重新提交审核' : '提交审核',
              onClick: () => onAction(activeRule, 'submitReview'),
              testId: 'performance-rule-submit-review-button'
            }
          : undefined
      }
      secondaryAction={
        activeRule && isEditMode
          ? {
              label: activeRule.status === '审核驳回' ? '保存修改' : '保存草稿',
              onClick: () => onAction(activeRule, 'saveDraft'),
              testId: 'performance-rule-save-draft-button'
            }
          : undefined
      }
      title={drawerTitle}
      width={840}
      onClose={onClose}
    >
      {drawerContent}
    </DrawerShell>
  );
}
