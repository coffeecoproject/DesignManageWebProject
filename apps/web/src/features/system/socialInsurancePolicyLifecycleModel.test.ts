import {
  createSocialInsurancePolicyVersion,
  deleteSocialInsurancePolicyDraft,
  getCurrentPublishedPolicy,
  getSocialInsurancePolicyLifecycleStatus,
  publishSocialInsurancePolicyVersion
} from './socialInsurancePolicyLifecycleModel';
import {
  getActivePolicyByConfigType,
  socialInsurancePolicyVersions,
  type SocialInsurancePolicyVersion
} from './socialInsurancePolicyData';
import { resolveSocialInsurancePolicyForPeriod } from '../finance/financeSocialInsuranceModel';
import { it } from 'vitest';
import { assertEqual } from '../../__tests__/assertions';

function getPolicy(id: string) {
  const policy = socialInsurancePolicyVersions.find((row) => row.id === id);
  if (!policy) throw new Error(`missing policy ${id}`);
  return policy;
}

function buildDraft(source: SocialInsurancePolicyVersion, id: string, effectiveMonth: string, version: string) {
  return {
    ...source,
    effectiveMonth,
    id,
    name: `${source.configType}${version}`,
    operationRecords: [],
    status: '草稿' as const,
    version
  };
}

it('derives current, future and historical states from published versions and period', () => {
  const current = getPolicy('wuhan-social-insurance-2026-06-v1');
  const historical = getPolicy('wuhan-social-insurance-2026-03-v0');
  const futureDraft = getPolicy('wuhan-social-insurance-2026-07-v2');
  const futurePublished = { ...futureDraft, status: '已发布' as const };
  const rows = socialInsurancePolicyVersions.map((row) => row.id === futureDraft.id ? futurePublished : row);

  assertEqual(getSocialInsurancePolicyLifecycleStatus(current, rows, '2026-06'), '当前生效', 'June V1 lifecycle');
  assertEqual(getSocialInsurancePolicyLifecycleStatus(historical, rows, '2026-06'), '历史', 'March V0 lifecycle');
  assertEqual(getSocialInsurancePolicyLifecycleStatus(futurePublished, rows, '2026-06'), '待生效', 'July V2 lifecycle');
  assertEqual(getCurrentPublishedPolicy(rows, '社保配置', '2026-07')?.id, futureDraft.id, 'July current policy');
});

it('publishes a future draft without replacing the current-period policy', () => {
  const mutation = publishSocialInsurancePolicyVersion(
    socialInsurancePolicyVersions,
    'wuhan-social-insurance-2026-07-v2',
    '2026-06-18'
  );

  assertEqual(mutation.result.success, true, 'future policy publication');
  assertEqual(getCurrentPublishedPolicy(mutation.rows, '社保配置', '2026-06')?.version, 'V1', 'June current policy');
  assertEqual(resolveSocialInsurancePolicyForPeriod(mutation.rows, '社保', '2026-07')?.version, 'V2', 'July calculation policy');
});

it('advances a published future policy when the requested business period changes', () => {
  const mutation = publishSocialInsurancePolicyVersion(
    socialInsurancePolicyVersions,
    'wuhan-social-insurance-2026-07-v2',
    '2026-06-18'
  );
  const futurePolicy = mutation.rows.find((row) => row.id === 'wuhan-social-insurance-2026-07-v2');

  if (!futurePolicy) throw new Error('missing published July policy');

  assertEqual(getSocialInsurancePolicyLifecycleStatus(futurePolicy, mutation.rows, '2026-06'), '待生效', 'June lifecycle');
  assertEqual(getSocialInsurancePolicyLifecycleStatus(futurePolicy, mutation.rows, '2026-07'), '当前生效', 'July lifecycle');
  assertEqual(getActivePolicyByConfigType(mutation.rows, '社保配置', '2026-06')?.version, 'V1', 'June copy source');
  assertEqual(getActivePolicyByConfigType(mutation.rows, '社保配置', '2026-07')?.version, 'V2', 'July copy source');
});

it('blocks duplicate effective months and backwards publication', () => {
  const source = getPolicy('wuhan-social-insurance-2026-06-v1');
  const duplicateMonth = buildDraft(source, 'si-duplicate-month', '2026-06', 'V9');
  const duplicateMutation = createSocialInsurancePolicyVersion(
    socialInsurancePolicyVersions,
    duplicateMonth,
    false,
    '2026-06-18'
  );
  assertEqual(duplicateMutation.result.success, false, 'duplicate effective month');

  const backwardsDraft = buildDraft(source, 'si-backwards', '2026-05', 'V8');
  const rows = [...socialInsurancePolicyVersions, backwardsDraft];
  const backwardsMutation = publishSocialInsurancePolicyVersion(rows, backwardsDraft.id, '2026-06-18');
  assertEqual(backwardsMutation.result.success, false, 'backwards publication');
});

it('keeps published versions immutable through lifecycle commands', () => {
  const publishedId = 'wuhan-social-insurance-2026-06-v1';
  assertEqual(
    publishSocialInsurancePolicyVersion(socialInsurancePolicyVersions, publishedId, '2026-06-18').result.success,
    false,
    'published policy cannot publish again'
  );
  assertEqual(
    deleteSocialInsurancePolicyDraft(socialInsurancePolicyVersions, publishedId).result.success,
    false,
    'published policy cannot be deleted'
  );
});
