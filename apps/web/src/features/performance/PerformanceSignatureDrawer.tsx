import {
  DeleteOutlined,
  EditOutlined,
  FileProtectOutlined,
  HistoryOutlined,
  PlusOutlined,
  TeamOutlined,
  UploadOutlined
} from '@ant-design/icons';
import { Button, Select } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useEffect, useState } from 'react';
import { DetailDrawerTitle, DetailInfoGrid, DetailSection, ReadOnlyField, StatusTag } from '../../components/Detail';
import { DetailSummaryCards } from '../../components/DetailSummaryCards';
import { DetailTabs } from '../../components/DetailTabs';
import { DrawerFormField, DrawerFormGrid, DrawerFormShell } from '../../components/DrawerForm';
import { OperationRecordTable } from '../../components/OperationRecordTable';
import type { PerformanceSignatureFile } from './performanceSignatureArchiveData';
import { PerformanceSignatureEmptyBlock } from './PerformanceSignatureEmptyBlock';
import { PerformanceSignatureFileTable } from './PerformanceSignatureFileTable';
import { PerformanceSignatureUploadSlot } from './PerformanceSignatureUploadSlot';
import {
  employeeStatusTone,
  getFirstNewSignatureRule,
  getNewSignatureRuleOptions,
  getSameCategoryRuleOptions,
  getSelectedSignatureFileName,
  type PerformanceSignatureFileAction,
  type PerformanceSignatureRelationRow
} from './performanceSignatureModel';
import type { PerformanceRuleCategory } from './performanceTypes';

type PerformanceSignatureDrawerProps = {
  relation: PerformanceSignatureRelationRow | null;
  onAddRelation: (employeeId: string, ruleId: string, fileName: string) => void;
  onClose: () => void;
  onDisableRelation: (employeeId: string, category: PerformanceRuleCategory) => void;
  onFileAction: (action: PerformanceSignatureFileAction, file: PerformanceSignatureFile) => void;
  onUpdateRelation: (employeeId: string, category: PerformanceRuleCategory, ruleId: string, fileName: string) => void;
};

export function PerformanceSignatureDrawer({
  relation,
  onAddRelation,
  onClose,
  onDisableRelation,
  onFileAction,
  onUpdateRelation
}: PerformanceSignatureDrawerProps) {
  const [editMode, setEditMode] = useState(false);
  const [updateFileName, setUpdateFileName] = useState<string | null>(null);
  const [updateRuleId, setUpdateRuleId] = useState('');
  const [addFileName, setAddFileName] = useState<string | null>(null);
  const [addRuleId, setAddRuleId] = useState('');
  const isOpen = Boolean(relation);
  const employee = relation?.employee;
  const currentFile = relation?.currentFile;
  const historyFiles = relation?.historyFiles ?? [];
  const currentFiles = currentFile ? [currentFile] : [];
  const sameCategoryRules = employee && relation ? getSameCategoryRuleOptions(employee, relation.category) : [];
  const updateRuleOptions = sameCategoryRules.filter((rule) => rule.ruleName !== currentFile?.ruleName);
  const addRuleOptions = getNewSignatureRuleOptions(employee);
  const selectedUpdateRule = updateRuleOptions.find((rule) => rule.id === updateRuleId);
  const selectedAddRule = addRuleOptions.find((rule) => rule.id === addRuleId);
  const categoryRecords =
    employee && relation
      ? employee.operationRecords.filter((record) => record.object.includes(relation.category) || record.summary.includes(relation.category))
      : [];
  const canEdit = relation?.relationStatus === '当前签署' && Boolean(currentFile);
  const canUpdateRelation = Boolean(employee && relation && selectedUpdateRule && updateFileName);
  const canAddRelation = Boolean(employee && selectedAddRule && addFileName);

  useEffect(() => {
    const nextEmployee = relation?.employee;
    const nextUpdateRule =
      nextEmployee && relation
        ? getSameCategoryRuleOptions(nextEmployee, relation.category).find((rule) => rule.ruleName !== relation.currentFile?.ruleName)
        : undefined;
    const nextAddRule = getFirstNewSignatureRule(nextEmployee);

    setEditMode(false);
    setUpdateRuleId(nextUpdateRule?.id ?? '');
    setUpdateFileName(null);
    setAddRuleId(nextAddRule?.id ?? '');
    setAddFileName(null);
  }, [relation?.id, relation?.employee, relation?.category, relation?.currentFile?.ruleName]);

  function handleSelectUpdateFile(file: UploadFile) {
    if (!employee || !selectedUpdateRule) {
      return;
    }

    setUpdateFileName(getSelectedSignatureFileName(file, `${employee.employeeName}_${selectedUpdateRule.ruleName}_绩效签署文件.pdf`));
  }

  function handleSelectAddFile(file: UploadFile) {
    if (!employee || !selectedAddRule) {
      return;
    }

    setAddFileName(getSelectedSignatureFileName(file, `${employee.employeeName}_${selectedAddRule.ruleName}_绩效签署文件.pdf`));
  }

  function handleSaveUpdate() {
    if (!employee || !relation || !selectedUpdateRule || !updateFileName) {
      return;
    }

    onUpdateRelation(employee.id, relation.category, selectedUpdateRule.id, updateFileName);
  }

  function handleSaveAdd() {
    if (!employee || !selectedAddRule || !addFileName) {
      return;
    }

    onAddRelation(employee.id, selectedAddRule.id, addFileName);
    setAddFileName(null);
    setAddRuleId(getFirstNewSignatureRule(employee)?.id ?? '');
  }

  function handleDisable() {
    if (!employee || !relation) {
      return;
    }

    onDisableRelation(employee.id, relation.category);
  }

  return (
    <DrawerFormShell
      bodyTestId="performance-signature-detail-drawer"
      cancelAction={
        editMode
          ? {
              label: '取消',
              onClick: () => setEditMode(false),
              testId: 'performance-signature-edit-cancel-button'
            }
          : undefined
      }
      className="performance-rule-drawer performance-signature-drawer"
      closeAction={
        !editMode
          ? {
              label: '关闭',
              onClick: onClose,
              testId: 'performance-signature-close-button'
            }
          : undefined
      }
      layout="detail"
      open={isOpen}
      primaryAction={
        !editMode && canEdit
          ? {
              icon: <EditOutlined />,
              label: '编辑',
              onClick: () => setEditMode(true),
              testId: 'performance-signature-edit-button'
            }
          : undefined
      }
      title={
        employee && relation ? (
          <DetailDrawerTitle
            status={relation.relationStatus === '当前签署' ? '当前签署' : '历史签署'}
            statusTone={relation.relationStatus === '当前签署' ? 'green' : 'gray'}
            subtitle={`${employee.workNo} / ${employee.position}`}
            title={`${employee.employeeName} / ${relation.category}`}
          />
        ) : null
      }
      width={900}
      onClose={onClose}
    >
      {employee && relation ? (
        <>
          <DetailSummaryCards
            items={[
              { icon: <FileProtectOutlined />, key: 'category', label: '绩效类别', value: relation.category },
              { icon: <HistoryOutlined />, key: 'currentVersion', label: '当前版本', value: currentFile?.ruleVersion ?? '-' },
              { icon: <TeamOutlined />, key: 'historyFiles', label: '历史文件', value: `${historyFiles.length} 份` }
            ]}
          />

          <DetailSection icon={<TeamOutlined />} title="员工信息">
            <DetailInfoGrid
              columns={2}
              items={[
                { label: '员工', value: `${employee.employeeName} / ${employee.workNo}` },
                { label: '岗位', value: employee.position },
                { label: '部门', value: employee.department },
                { label: '人员类型', value: employee.personnelType },
                { label: '人员状态', value: <StatusTag toneMap={employeeStatusTone} value={employee.employeeStatus} /> },
                { label: '当前绩效类别', value: relation.category }
              ]}
            />
          </DetailSection>

          <DetailSection icon={<FileProtectOutlined />} title="签署信息">
            <DetailInfoGrid
              columns={3}
              items={[
                { label: '绩效规则', value: currentFile?.ruleName ?? relation.file.ruleName },
                { label: '规则版本', value: currentFile?.ruleVersion ?? relation.file.ruleVersion },
                { label: '签署日期', value: currentFile?.signedAt ?? relation.file.signedAt }
              ]}
            />
          </DetailSection>

          {editMode ? (
            <>
              <DetailSection icon={<EditOutlined />} title="编辑当前绩效">
                {updateRuleOptions.length > 0 ? (
                  <>
                    <DrawerFormGrid>
                      <DrawerFormField label="更新至规则版本" required wide>
                        <Select
                          options={updateRuleOptions.map((rule) => ({
                            label: `${rule.ruleName} / ${rule.category}`,
                            value: rule.id
                          }))}
                          value={updateRuleId}
                          onChange={(ruleId) => {
                            setUpdateRuleId(ruleId);
                            setUpdateFileName(null);
                          }}
                        />
                      </DrawerFormField>
                      <ReadOnlyField label="当前版本" value={currentFile?.ruleName} />
                      <ReadOnlyField label="更新动作" value="旧文件转历史，新文件成为当前签署" />
                    </DrawerFormGrid>
                    <PerformanceSignatureUploadSlot
                      description="上传新规则版本对应的员工已签署文件。"
                      fileName={updateFileName}
                      title="新版本签署文件 *"
                      onSelect={handleSelectUpdateFile}
                    />
                    <div className="drawer-section-actions">
                      <Button disabled={!canUpdateRelation} icon={<UploadOutlined />} type="primary" onClick={handleSaveUpdate}>
                        保存版本更新
                      </Button>
                    </div>
                  </>
                ) : (
                  <PerformanceSignatureEmptyBlock text="当前绩效类别暂无可更新的其他规则版本" />
                )}
                <div className="drawer-section-actions drawer-section-actions-danger">
                  <Button danger icon={<DeleteOutlined />} onClick={handleDisable}>
                    停用当前绩效
                  </Button>
                </div>
              </DetailSection>

              <DetailSection icon={<PlusOutlined />} title="新增绩效类别">
                {addRuleOptions.length > 0 ? (
                  <>
                    <DrawerFormGrid>
                      <DrawerFormField label="绩效规则版本" required wide>
                        <Select
                          options={addRuleOptions.map((rule) => ({
                            label: `${rule.ruleName} / ${rule.category}`,
                            value: rule.id
                          }))}
                          value={addRuleId}
                          onChange={(ruleId) => {
                            setAddRuleId(ruleId);
                            setAddFileName(null);
                          }}
                        />
                      </DrawerFormField>
                      <ReadOnlyField label="新增类别" value={selectedAddRule?.category} />
                      <ReadOnlyField label="当前状态" value="新增当前签署" />
                    </DrawerFormGrid>
                    <PerformanceSignatureUploadSlot
                      description="上传新增绩效类别对应的员工已签署文件。"
                      fileName={addFileName}
                      title="新增签署文件 *"
                      onSelect={handleSelectAddFile}
                    />
                    <div className="drawer-section-actions">
                      <Button disabled={!canAddRelation} icon={<PlusOutlined />} type="primary" onClick={handleSaveAdd}>
                        新增签署
                      </Button>
                    </div>
                  </>
                ) : (
                  <PerformanceSignatureEmptyBlock text="该员工暂无可新增的绩效类别" />
                )}
              </DetailSection>
            </>
          ) : null}

          <DetailTabs
            defaultActiveKey="current"
            tabTestIdPrefix="performance-signature-detail-tab"
            testId="performance-signature-detail-tabs"
            items={[
              {
                key: 'current',
                label: '当前签署',
                children:
                  currentFiles.length > 0 ? (
                    <PerformanceSignatureFileTable files={currentFiles} mode="current" onFileAction={onFileAction} />
                  ) : (
                    <PerformanceSignatureEmptyBlock text="该员工暂无当前签署文件" />
                  )
              },
              {
                key: 'history',
                label: '历史签署',
                children:
                  historyFiles.length > 0 ? (
                    <PerformanceSignatureFileTable files={historyFiles} mode="history" onFileAction={onFileAction} />
                  ) : (
                    <PerformanceSignatureEmptyBlock text="该员工该绩效类别暂无历史签署文件" />
                  )
              },
              {
                key: 'records',
                label: '操作记录',
                children:
                  categoryRecords.length > 0 ? (
                    <OperationRecordTable records={categoryRecords} scrollX={856} />
                  ) : (
                    <PerformanceSignatureEmptyBlock text="该员工暂无绩效签署文件操作记录" />
                  )
              }
            ]}
          />
        </>
      ) : null}
    </DrawerFormShell>
  );
}
