import { FileProtectOutlined, TeamOutlined, UploadOutlined } from '@ant-design/icons';
import { Select } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { DetailDrawerTitle, DetailSection, ReadOnlyField } from '../../components/Detail';
import { DrawerFormField, DrawerFormGrid, DrawerFormShell } from '../../components/DrawerForm';
import type {
  PerformanceEmployeeSignatureArchive,
  PerformanceSignatureRuleOption
} from './performanceSignatureArchiveData';
import { PerformanceSignatureEmptyBlock } from './PerformanceSignatureEmptyBlock';
import { PerformanceSignatureUploadSlot } from './PerformanceSignatureUploadSlot';
import {
  formatTextPreview,
  getCurrentCategories,
  getNewSignatureRuleOptions,
  type SignatureCreateForm
} from './performanceSignatureModel';

type PerformanceSignatureCreateDrawerProps = {
  employees: PerformanceEmployeeSignatureArchive[];
  onClose: () => void;
  onEmployeeChange: (employeeId: string) => void;
  onFileSelect: (file: UploadFile) => void;
  onRuleChange: (ruleId: string) => void;
  onSubmit: () => void;
  open: boolean;
  ruleOptions: PerformanceSignatureRuleOption[];
  value: SignatureCreateForm;
};

export function PerformanceSignatureCreateDrawer({
  employees,
  onClose,
  onEmployeeChange,
  onFileSelect,
  onRuleChange,
  onSubmit,
  open,
  ruleOptions,
  value
}: PerformanceSignatureCreateDrawerProps) {
  const selectedEmployee = employees.find((employee) => employee.id === value.employeeId);
  const availableRules = getNewSignatureRuleOptions(selectedEmployee, ruleOptions);
  const selectedRule = availableRules.find((rule) => rule.id === value.ruleId);
  const canSubmit = Boolean(selectedEmployee && selectedRule && value.fileName);

  return (
    <DrawerFormShell
      cancelAction={{ label: '取消', onClick: onClose }}
      className="performance-rule-drawer"
      layout="detail"
      open={open}
      primaryAction={{
        disabled: !canSubmit,
        icon: <UploadOutlined />,
        label: '保存档案',
        onClick: onSubmit
      }}
      title={<DetailDrawerTitle subtitle="绩效管理 / 签署档案" title="新增签署档案" />}
      width={840}
      onClose={onClose}
    >
      <DetailSection icon={<TeamOutlined />} title="签署对象">
        <DrawerFormGrid>
          <DrawerFormField label="员工" required>
            <Select
              options={employees.map((employee) => ({
                label: `${employee.employeeName} / ${employee.workNo}`,
                value: employee.id
              }))}
              value={value.employeeId}
              onChange={onEmployeeChange}
            />
          </DrawerFormField>
          <ReadOnlyField label="岗位" value={selectedEmployee?.position} />
          <ReadOnlyField
            label="当前绩效类别"
            value={selectedEmployee ? formatTextPreview(getCurrentCategories(selectedEmployee), 3) : '-'}
          />
        </DrawerFormGrid>
      </DetailSection>

      <DetailSection icon={<FileProtectOutlined />} title="签署内容">
        {availableRules.length > 0 ? (
          <>
            <DrawerFormGrid>
              <DrawerFormField label="绩效规则版本" required wide>
                <Select
                  options={availableRules.map((rule) => ({
                    label: `${rule.ruleName} / ${rule.category}`,
                    value: rule.id
                  }))}
                  value={value.ruleId}
                  onChange={onRuleChange}
                />
              </DrawerFormField>
              <ReadOnlyField label="绩效类别" value={selectedRule?.category} />
              <ReadOnlyField label="档案状态" value="当前档案" />
            </DrawerFormGrid>
            <PerformanceSignatureUploadSlot
              description="上传员工已签署完成文件，支持 PDF/JPG/PNG，20MB 内。"
              fileName={value.fileName}
              title="签署文件 *"
              onSelect={onFileSelect}
            />
          </>
        ) : (
          <PerformanceSignatureEmptyBlock text="该员工暂无可归档的当前适用规则" />
        )}
      </DetailSection>
    </DrawerFormShell>
  );
}
