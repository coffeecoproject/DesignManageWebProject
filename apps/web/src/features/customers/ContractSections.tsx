import { BankOutlined, FileProtectOutlined, ProfileOutlined } from '@ant-design/icons';
import { Input, Select } from 'antd';
import type { TableColumnsType } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { CompactDetailTable } from '../../components/CompactDetailTable';
import { StatusTag } from '../../components/Detail';
import { DrawerFormField, DrawerFormGrid } from '../../components/DrawerForm';
import { FileSlot } from '../../components/FileSlot';
import { RelatedFileTable } from '../../components/RelatedFileTable';
import {
  formatContractMoney,
  getContractFiles,
  type ContractDraftFile,
  type ContractForm,
  type ContractRelatedFileRecord
} from './contractFormModel';
import {
  contractReceiptStatusTone,
  getContractReceiptStatus,
  getContractUnreceivedAmount,
  type CustomerContractReceiptView
} from './contractReceiptModel';
import type {
  CustomerContractAmountMode,
  CustomerContractAgreementChangeType,
  CustomerContractAmountTaxMode,
  CustomerContractBusinessNature,
  CustomerContractReceiptRecord,
  CustomerContractRecord,
  CustomerContractType,
  CustomerRecord
} from './customerData';
import { CustomerDetailSection, CustomerInfoGrid, customerContractStatusTone } from './CustomerShared';

type ContractFormPatchHandler = (patch: Partial<ContractForm>) => void;
type ContractFileAction = (file: ContractRelatedFileRecord) => void;
type ContractDraftFileAction = (file: ContractDraftFile) => void;

const receiptColumns: TableColumnsType<CustomerContractReceiptRecord> = [
  {
    title: '收款日期',
    dataIndex: 'receivedAt',
    align: 'center',
    width: 120
  },
  {
    title: '收款金额',
    dataIndex: 'amount',
    align: 'center',
    width: 120,
    render: (amount: number) => formatContractMoney(amount)
  },
  {
    title: '收款方式',
    dataIndex: 'method',
    align: 'center',
    width: 110
  },
  {
    title: '记录人',
    dataIndex: 'recorder',
    align: 'center',
    width: 100
  },
  {
    title: '备注',
    dataIndex: 'note',
    align: 'center',
    width: 220,
    render: (note: string) => <span className="detail-table-sub">{note}</span>
  }
];

export function ContractProfileSection({
  contract,
  customerName,
  customerTaxId
}: {
  contract: CustomerContractRecord;
  customerName?: string;
  customerTaxId?: string;
}) {
  return (
    <CustomerDetailSection icon={<ProfileOutlined />} title="合同资料">
      <CustomerInfoGrid
        columns={2}
        items={[
          { label: '合同编号', value: contract.code },
          { label: '所属客户', value: customerName },
          { label: '客户纳税人识别号', value: customerTaxId },
          { label: '合同类型', value: contract.type },
          { label: '业务性质', value: contract.stampDutyFacts.businessNature },
          { label: '金额方式', value: contract.amountMode },
          { label: '价税方式', value: contract.stampDutyFacts.amountTaxMode },
          ...(contract.stampDutyFacts.amountTaxMode === '价税分列'
            ? [{ label: '单列增值税额', value: formatContractMoney(contract.stampDutyFacts.vatAmount ?? 0) }]
            : []),
          { label: '签署版本', value: contract.stampDutyFacts.signedVersionNo },
          { label: '合同状态', value: <StatusTag toneMap={customerContractStatusTone} value={contract.status} /> },
          { label: '签署日期', value: contract.signedAt },
          { label: '到期日期', value: contract.expiresAt },
          ...(contract.terminatedAt
            ? [
                { label: '终止日期', value: contract.terminatedAt },
                { label: '终止原因', value: contract.terminationReason ?? '-' }
              ]
            : []),
          { label: '负责人', value: contract.owner },
          { label: '备注', value: contract.note }
        ]}
      />
    </CustomerDetailSection>
  );
}

export function ContractReceiptSummary({ contract }: { contract: CustomerContractReceiptView }) {
  const unreceivedAmount = getContractUnreceivedAmount(contract);

  return (
    <CustomerDetailSection icon={<BankOutlined />} title="收款概况">
      <CustomerInfoGrid
        columns={2}
        items={[
          { label: '金额方式', value: contract.amountMode },
          {
            label: '合同金额',
            value: contract.amountMode === '无固定金额' ? '-' : formatContractMoney(contract.amount)
          },
          { label: '已收金额', value: formatContractMoney(contract.receivedAmount) },
          {
            label: '未收金额',
            value: unreceivedAmount === null ? '-' : formatContractMoney(unreceivedAmount)
          },
          {
            label: '收款状态',
            value: <StatusTag toneMap={contractReceiptStatusTone} value={getContractReceiptStatus(contract)} />
          },
          { label: '最近收款日期', value: contract.latestReceiptAt },
          { label: '备注', value: contract.receiptNote, wide: true }
        ]}
      />
    </CustomerDetailSection>
  );
}

export function ContractReceiptTable({ records }: { records: CustomerContractReceiptRecord[] }) {
  return (
    <CustomerDetailSection icon={<BankOutlined />} title="收款记录">
      <CompactDetailTable<CustomerContractReceiptRecord>
        columns={receiptColumns}
        dataSource={records}
        emptyText="暂无收款记录"
        rowKey="id"
        scrollX={720}
      />
    </CustomerDetailSection>
  );
}

export function ContractReceiptPanel({ contract }: { contract: CustomerContractReceiptView }) {
  return (
    <>
      <ContractReceiptSummary contract={contract} />
      <ContractReceiptTable records={contract.receiptRecords} />
    </>
  );
}

export function ContractFileSection({
  contract,
  onDownload,
  onPreview
}: {
  contract: CustomerContractRecord;
  onDownload?: ContractFileAction;
  onPreview?: ContractFileAction;
}) {
  return (
    <CustomerDetailSection icon={<FileProtectOutlined />} title="已签合同文件">
      <RelatedFileTable records={getContractFiles(contract)} onDownload={onDownload} onPreview={onPreview} />
    </CustomerDetailSection>
  );
}

export function ContractFormSection({
  contracts,
  customers,
  form,
  onChange
}: {
  contracts: CustomerContractRecord[];
  customers: CustomerRecord[];
  form: ContractForm;
  onChange: ContractFormPatchHandler;
}) {
  return (
    <CustomerDetailSection icon={<FileProtectOutlined />} title="合同资料">
      <DrawerFormGrid>
        <DrawerFormField label="所属客户" required>
          <Select
            value={form.customerId}
            options={customers.map((customer) => ({ label: customer.name, value: customer.id }))}
            onChange={(customerId) => onChange({ customerId })}
          />
        </DrawerFormField>
        <DrawerFormField label="合同名称" required>
          <Input value={form.name} onChange={(event) => onChange({ name: event.target.value })} />
        </DrawerFormField>
        <DrawerFormField label="合同类型" required>
          <Select
            value={form.type}
            options={(['年框合同', '项目合同'] satisfies CustomerContractType[]).map((type) => ({
              label: type,
              value: type
            }))}
            onChange={(type) => onChange({ type })}
          />
        </DrawerFormField>
        <DrawerFormField label="业务性质" required>
          <Select
            value={form.businessNature}
            options={(
              [
                '设计及咨询服务',
                '工程施工',
                '采购或销售',
                '租赁',
                '技术服务',
                '借款',
                '产权转移',
                '其他'
              ] satisfies CustomerContractBusinessNature[]
            ).map((businessNature) => ({ label: businessNature, value: businessNature }))}
            onChange={(businessNature) => onChange({ businessNature })}
          />
        </DrawerFormField>
        <DrawerFormField label="金额方式" required>
          <Select
            value={form.amountMode}
            options={(['固定金额', '无固定金额'] satisfies CustomerContractAmountMode[]).map((amountMode) => ({
              label: amountMode,
              value: amountMode
            }))}
            onChange={(amountMode) =>
              onChange({
                amountMode,
                amount: amountMode === '无固定金额' ? '' : form.amount
              })
            }
          />
        </DrawerFormField>
        <DrawerFormField label="合同金额" required={form.amountMode === '固定金额'}>
          <Input
            disabled={form.amountMode === '无固定金额'}
            placeholder={form.amountMode === '固定金额' ? '例如 120000' : '无固定金额合同不填写金额'}
            value={form.amount}
            onChange={(event) => onChange({ amount: event.target.value })}
          />
        </DrawerFormField>
        <DrawerFormField label="价税方式" required>
          <Select
            value={form.amountTaxMode}
            options={(
              ['价税分列', '含税未分列', '不涉及增值税'] satisfies CustomerContractAmountTaxMode[]
            ).map((amountTaxMode) => ({ label: amountTaxMode, value: amountTaxMode }))}
            onChange={(amountTaxMode) => onChange({ amountTaxMode, vatAmount: amountTaxMode === '价税分列' ? form.vatAmount : '' })}
          />
        </DrawerFormField>
        {form.amountTaxMode === '价税分列' ? (
          <DrawerFormField label="单列增值税额" required>
            <Input value={form.vatAmount} onChange={(event) => onChange({ vatAmount: event.target.value })} />
          </DrawerFormField>
        ) : null}
        <DrawerFormField label="签署版本" required>
          <Input value={form.signedVersionNo} onChange={(event) => onChange({ signedVersionNo: event.target.value })} />
        </DrawerFormField>
        <DrawerFormField label="原合同">
          <Select
            allowClear
            value={form.parentContractId || undefined}
            options={contracts
              .filter((contract) => contract.customerId === form.customerId)
              .map((contract) => ({ label: `${contract.code} / ${contract.name}`, value: contract.id }))}
            onChange={(parentContractId) =>
              onChange({
                agreementChangeAmount: '',
                agreementChangeType: '',
                parentContractId: parentContractId ?? ''
              })
            }
          />
        </DrawerFormField>
        {form.parentContractId ? (
          <>
            <DrawerFormField label="协议变更类型" required>
              <Select
                value={form.agreementChangeType || undefined}
                options={(
                  ['新增金额', '减少金额', '仅变更非金额条款'] satisfies CustomerContractAgreementChangeType[]
                ).map((agreementChangeType) => ({ label: agreementChangeType, value: agreementChangeType }))}
                onChange={(agreementChangeType) => onChange({ agreementChangeType })}
              />
            </DrawerFormField>
            {form.agreementChangeType && form.agreementChangeType !== '仅变更非金额条款' ? (
              <DrawerFormField label="变更金额" required>
                <Input
                  value={form.agreementChangeAmount}
                  onChange={(event) => onChange({ agreementChangeAmount: event.target.value })}
                />
              </DrawerFormField>
            ) : null}
          </>
        ) : null}
        <DrawerFormField label="签署日期" required>
          <Input placeholder="YYYY-MM-DD" value={form.signedAt} onChange={(event) => onChange({ signedAt: event.target.value })} />
        </DrawerFormField>
        <DrawerFormField label="到期日期" required>
          <Input placeholder="YYYY-MM-DD" value={form.expiresAt} onChange={(event) => onChange({ expiresAt: event.target.value })} />
        </DrawerFormField>
        <DrawerFormField label="负责人" required>
          <Input value={form.owner} onChange={(event) => onChange({ owner: event.target.value })} />
        </DrawerFormField>
        <DrawerFormField label="备注" wide>
          <Input.TextArea
            autoSize={{ minRows: 3, maxRows: 5 }}
            value={form.note}
            onChange={(event) => onChange({ note: event.target.value })}
          />
        </DrawerFormField>
      </DrawerFormGrid>
    </CustomerDetailSection>
  );
}

export function ContractFileUploadSection({
  files,
  onPreview,
  onRemove,
  onSelect
}: {
  files: ContractDraftFile[];
  onPreview?: ContractDraftFileAction;
  onRemove: ContractDraftFileAction;
  onSelect: (file: UploadFile) => void;
}) {
  return (
    <CustomerDetailSection icon={<FileProtectOutlined />} title="已签合同文件">
      <FileSlot<ContractDraftFile>
        accept=".pdf,.jpg,.jpeg,.png"
        description="上传双方已签署完成的合同，可一次选择多份；支持 PDF/JPG/PNG，单个文件不超过 20MB。"
        emptyText="至少上传 1 份已签合同文件"
        files={files}
        multiple
        status={files.length > 0 ? '已选择' : '待补充'}
        title="合同签署文件 *"
        uploadText="上传文件"
        variant="list"
        onPreview={onPreview}
        onRemove={onRemove}
        onSelect={onSelect}
      />
    </CustomerDetailSection>
  );
}
