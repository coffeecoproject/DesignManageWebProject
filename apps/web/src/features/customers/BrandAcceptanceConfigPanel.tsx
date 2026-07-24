import {
  CalculatorOutlined,
  ClockCircleOutlined,
  StarOutlined
} from '@ant-design/icons';
import { InputNumber } from 'antd';
import { DrawerFormField, DrawerFormGrid } from '../../components/DrawerForm';
import { CustomerDetailSection, CustomerInfoGrid } from './CustomerShared';
import {
  defaultBrandAcceptancePolicy,
  type BrandAcceptancePolicy
} from './brandAcceptancePolicyModel';

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function DeductionConversion({ policy }: { policy: BrandAcceptancePolicy }) {
  const [noDeductionTier, standardTier, highTier] = policy.deductionTiers;
  return (
    <CustomerDetailSection icon={<CalculatorOutlined />} title="扣款换算">
      <div className="brand-acceptance-conversion">
        <div className="brand-acceptance-conversion__item">
          <span className="brand-acceptance-conversion__label">
            累计扣罚分不足 {standardTier?.minimumPenaltyPoints ?? 0} 分
          </span>
          <strong>不扣款</strong>
        </div>
        <div className="brand-acceptance-conversion__item">
          <span className="brand-acceptance-conversion__label">
            累计扣罚分 {standardTier?.minimumPenaltyPoints ?? 0}-{(highTier?.minimumPenaltyPoints ?? 1) - 1} 分
          </span>
          <strong>扣结算金额 {formatPercent(standardTier?.deductionRate ?? noDeductionTier?.deductionRate ?? 0)}</strong>
        </div>
        <div className="brand-acceptance-conversion__item">
          <span className="brand-acceptance-conversion__label">
            累计扣罚分 {highTier?.minimumPenaltyPoints ?? 0} 分及以上
          </span>
          <strong>扣结算金额 {formatPercent(highTier?.deductionRate ?? 0)}</strong>
        </div>
      </div>
    </CustomerDetailSection>
  );
}

function AcceptanceConfigSummary({ policy }: { policy: BrandAcceptancePolicy }) {
  return (
    <>
      <CustomerDetailSection icon={<StarOutlined />} title="质量">
        <CustomerInfoGrid
          columns={2}
          items={[
            { label: '记录内容', value: '甲方评分（0-100 分）' },
            { label: `${policy.noPenaltyScoreMinimum} 分及以上`, value: '0 扣罚分' },
            {
              label: `${policy.standardPenaltyScoreMinimum}-${policy.noPenaltyScoreMinimum - 1} 分`,
              value: `${policy.standardPenaltyPoints} 扣罚分`
            },
            { label: `低于 ${policy.standardPenaltyScoreMinimum} 分`, value: `${policy.lowScorePenaltyPoints} 扣罚分` }
          ]}
        />
      </CustomerDetailSection>

      <CustomerDetailSection icon={<ClockCircleOutlined />} title="时效">
        <CustomerInfoGrid
          columns={2}
          items={[
            { label: '记录结果', value: '未超时 / 超时 / 不计时' },
            { label: '超时', value: `${policy.overduePenaltyPoints} 扣罚分` },
            { label: '未超时', value: '0 扣罚分' },
            { label: '不计时', value: '0 扣罚分' }
          ]}
        />
      </CustomerDetailSection>

      <DeductionConversion policy={policy} />
    </>
  );
}

function AcceptanceConfigForm({
  onChange,
  policy
}: {
  onChange: (policy: BrandAcceptancePolicy) => void;
  policy: BrandAcceptancePolicy;
}) {
  return (
    <>
      <CustomerDetailSection icon={<StarOutlined />} title="质量">
        <DrawerFormGrid>
          <DrawerFormField label="免扣罚评分下限" required>
            <InputNumber
              addonAfter="分"
              max={100}
              min={0}
              precision={0}
              value={policy.noPenaltyScoreMinimum}
              onChange={(value) => onChange({ ...policy, noPenaltyScoreMinimum: value ?? 0 })}
            />
          </DrawerFormField>
          <DrawerFormField label="一般扣罚评分下限" required>
            <InputNumber
              addonAfter="分"
              max={100}
              min={0}
              precision={0}
              value={policy.standardPenaltyScoreMinimum}
              onChange={(value) => onChange({ ...policy, standardPenaltyScoreMinimum: value ?? 0 })}
            />
          </DrawerFormField>
          <DrawerFormField label="一般扣罚分" required>
            <InputNumber
              addonAfter="分"
              min={0}
              precision={0}
              value={policy.standardPenaltyPoints}
              onChange={(value) => onChange({ ...policy, standardPenaltyPoints: value ?? 0 })}
            />
          </DrawerFormField>
          <DrawerFormField label="低分扣罚分" required>
            <InputNumber
              addonAfter="分"
              min={0}
              precision={0}
              value={policy.lowScorePenaltyPoints}
              onChange={(value) => onChange({ ...policy, lowScorePenaltyPoints: value ?? 0 })}
            />
          </DrawerFormField>
        </DrawerFormGrid>
      </CustomerDetailSection>

      <CustomerDetailSection icon={<ClockCircleOutlined />} title="时效">
        <DrawerFormGrid>
          <DrawerFormField label="超时扣罚分" required>
            <InputNumber
              addonAfter="分"
              min={0}
              precision={0}
              value={policy.overduePenaltyPoints}
              onChange={(value) => onChange({ ...policy, overduePenaltyPoints: value ?? 0 })}
            />
          </DrawerFormField>
        </DrawerFormGrid>
        <div className="brand-acceptance-fixed-outcomes">
          <CustomerInfoGrid
            columns={2}
            items={[
              { label: '未超时', value: '0 扣罚分' },
              { label: '不计时', value: '0 扣罚分' }
            ]}
          />
        </div>
      </CustomerDetailSection>

      <DeductionConversion policy={policy} />
    </>
  );
}

export function BrandAcceptanceConfigPanel({
  editable = false,
  onChange,
  policy = defaultBrandAcceptancePolicy
}: {
  editable?: boolean;
  onChange?: (policy: BrandAcceptancePolicy) => void;
  policy?: BrandAcceptancePolicy;
}) {
  return editable && onChange
    ? <AcceptanceConfigForm onChange={onChange} policy={policy} />
    : <AcceptanceConfigSummary policy={policy} />;
}
