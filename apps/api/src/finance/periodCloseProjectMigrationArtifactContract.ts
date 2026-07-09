import {
  buildPeriodClosePostgresMigrationPlan,
  validatePeriodClosePostgresMigrationPlan,
  type PeriodClosePostgresMigrationPlan,
  type PeriodClosePostgresMigrationStatement,
  type PeriodClosePostgresTransactionRecipe
} from './periodClosePostgresMigrationContract.js';

export type PeriodCloseProjectMigrationArtifact = {
  applyMode: 'manual_review_required';
  artifactId: 'period-close-persistent-lock-postgres-v1';
  autoApply: false;
  checksum: string;
  checksumAlgorithm: 'fnv1a64';
  destructive: false;
  dialect: 'postgresql';
  evidenceGates: PeriodCloseProjectMigrationEvidenceGate[];
  filename: string;
  formalApplyStatus: 'not_applied';
  forwardFixStrategy: string;
  generatedAt: string;
  minimumVersion: '16';
  prohibitedOperations: string[];
  requiresManualApproval: true;
  rollbackStrategy: string;
  scope: 'period_close_persistent_lock';
  sourceContractId: string;
  statements: PeriodClosePostgresMigrationStatement[];
  transactionRecipes: PeriodClosePostgresTransactionRecipe[];
};

export type PeriodCloseProjectMigrationEvidenceGate = {
  blockingEffect: 'blocks_formal_apply';
  class: 'document_gate' | 'automated_gate' | 'evidence_gate' | 'manual_approval_gate';
  evidence: string;
  name: string;
  status: 'required' | 'local_passed' | 'not_started';
};

const defaultGeneratedAt = '2026-07-04T00:00:00.000Z';
const defaultFilename = '20260704_000001_period_close_persistent_lock.sql';
const requiredEvidenceGateNames = [
  'manual_schema_review',
  'local_rollback_dry_run',
  'isolated_apply_drill',
  'row_lock_concurrency_drill',
  'rollback_forward_fix_review',
  'production_apply_approval'
];

function computeFnv1a64(input: string) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= BigInt(input.charCodeAt(index));
    hash = (hash * prime) & mask;
  }

  return hash.toString(16).padStart(16, '0');
}

function renderChecksumPayload(plan: PeriodClosePostgresMigrationPlan) {
  return [
    plan.dialect,
    plan.minimumVersion,
    plan.sourceContractId,
    ...plan.statements.map((statement) => `${statement.phase}:${statement.id}\n${statement.sql}`),
    ...plan.transactionRecipes.map((recipe) => `recipe:${recipe.id}\n${recipe.sql}`)
  ].join('\n---\n');
}

export function computePeriodCloseProjectMigrationArtifactChecksum(plan: PeriodClosePostgresMigrationPlan) {
  return `fnv1a64:${computeFnv1a64(renderChecksumPayload(plan))}`;
}

function buildEvidenceGates(): PeriodCloseProjectMigrationEvidenceGate[] {
  return [
    {
      blockingEffect: 'blocks_formal_apply',
      class: 'document_gate',
      evidence: 'docs/governance/finance-period-close-industrial-execution-acceptance-plan-v1.md',
      name: 'manual_schema_review',
      status: 'required'
    },
    {
      blockingEffect: 'blocks_formal_apply',
      class: 'automated_gate',
      evidence: 'scripts/local/period-close-postgres-dry-run.sh',
      name: 'local_rollback_dry_run',
      status: 'local_passed'
    },
    {
      blockingEffect: 'blocks_formal_apply',
      class: 'automated_gate',
      evidence: 'scripts/local/period-close-postgres-apply-drill.sh',
      name: 'isolated_apply_drill',
      status: 'local_passed'
    },
    {
      blockingEffect: 'blocks_formal_apply',
      class: 'automated_gate',
      evidence: 'scripts/local/period-close-postgres-concurrency-drill.sh',
      name: 'row_lock_concurrency_drill',
      status: 'local_passed'
    },
    {
      blockingEffect: 'blocks_formal_apply',
      class: 'evidence_gate',
      evidence: 'apps/api/src/finance/periodCloseMigrationFormalApplyReviewContract.ts',
      name: 'rollback_forward_fix_review',
      status: 'local_passed'
    },
    {
      blockingEffect: 'blocks_formal_apply',
      class: 'manual_approval_gate',
      evidence: 'explicit approval is required before applying this artifact to any shared or production database',
      name: 'production_apply_approval',
      status: 'not_started'
    }
  ];
}

export function buildPeriodCloseProjectMigrationArtifact({
  filename = defaultFilename,
  generatedAt = defaultGeneratedAt,
  plan = buildPeriodClosePostgresMigrationPlan()
}: {
  filename?: string;
  generatedAt?: string;
  plan?: PeriodClosePostgresMigrationPlan;
} = {}): PeriodCloseProjectMigrationArtifact {
  const planErrors = validatePeriodClosePostgresMigrationPlan(plan);

  if (planErrors.length > 0) {
    throw new Error(`Cannot build period-close project migration artifact: ${planErrors.join('; ')}`);
  }

  return {
    applyMode: 'manual_review_required',
    artifactId: 'period-close-persistent-lock-postgres-v1',
    autoApply: false,
    checksum: computePeriodCloseProjectMigrationArtifactChecksum(plan),
    checksumAlgorithm: 'fnv1a64',
    destructive: false,
    dialect: plan.dialect,
    evidenceGates: buildEvidenceGates(),
    filename,
    formalApplyStatus: 'not_applied',
    forwardFixStrategy:
      'Use an additive follow-up migration after review; do not mutate closed-period source rows directly.',
    generatedAt,
    minimumVersion: plan.minimumVersion,
    prohibitedOperations: ['DROP', 'TRUNCATE', 'DELETE', 'ALTER TYPE DROP VALUE'],
    requiresManualApproval: true,
    rollbackStrategy:
      'For pre-apply drills use isolated-schema rollback; after formal apply use reviewed forward-fix migration.',
    scope: 'period_close_persistent_lock',
    sourceContractId: plan.sourceContractId,
    statements: plan.statements,
    transactionRecipes: plan.transactionRecipes
  };
}

function buildPlanFromArtifact(artifact: PeriodCloseProjectMigrationArtifact): PeriodClosePostgresMigrationPlan {
  return {
    destructive: artifact.destructive,
    dialect: artifact.dialect,
    minimumVersion: artifact.minimumVersion,
    sourceContractId: artifact.sourceContractId,
    statements: artifact.statements,
    transactionRecipes: artifact.transactionRecipes
  };
}

export function renderPeriodCloseProjectMigrationArtifactSql(artifact: PeriodCloseProjectMigrationArtifact) {
  const transactionRecipeSummary = artifact.transactionRecipes
    .map((recipe) => `-- Transaction recipe: ${recipe.id}`)
    .join('\n');

  return [
    '-- StartupManageSystem period-close project migration artifact.',
    `-- Artifact: ${artifact.artifactId}`,
    `-- Filename: ${artifact.filename}`,
    `-- Generated at: ${artifact.generatedAt}`,
    `-- Source contract: ${artifact.sourceContractId}`,
    `-- Checksum: ${artifact.checksum}`,
    '-- Formal apply status: not_applied',
    '-- Apply mode: manual_review_required',
    '-- This artifact is not a production migration record until manual review and formal apply evidence exist.',
    transactionRecipeSummary,
    '',
    artifact.statements.map((statement) => statement.sql).join('\n\n')
  ].join('\n');
}

export function validatePeriodCloseProjectMigrationArtifact(
  artifact: PeriodCloseProjectMigrationArtifact = buildPeriodCloseProjectMigrationArtifact()
): string[] {
  const errors: string[] = [];
  const plan = buildPlanFromArtifact(artifact);
  const planErrors = validatePeriodClosePostgresMigrationPlan(plan);
  const statementSql = artifact.statements.map((statement) => statement.sql).join('\n');
  const gateNames = new Set(artifact.evidenceGates.map((gate) => gate.name));

  errors.push(...planErrors);

  if (artifact.artifactId !== 'period-close-persistent-lock-postgres-v1') {
    errors.push('project migration artifact must keep the period-close artifact identity');
  }

  if (!/^\d{8}_\d{6}_period_close_persistent_lock\.sql$/.test(artifact.filename)) {
    errors.push('project migration artifact filename must use the project migration naming format');
  }

  if (artifact.applyMode !== 'manual_review_required' || artifact.formalApplyStatus !== 'not_applied') {
    errors.push('project migration artifact must remain not_applied until formal schema migration apply evidence exists');
  }

  if (artifact.requiresManualApproval !== true || artifact.autoApply !== false) {
    errors.push('project migration artifact must require manual approval and must not support auto apply');
  }

  if (artifact.checksumAlgorithm !== 'fnv1a64') {
    errors.push('project migration artifact checksum algorithm must be fnv1a64');
  }

  if (artifact.checksum !== computePeriodCloseProjectMigrationArtifactChecksum(plan)) {
    errors.push('project migration artifact checksum does not match statements and transaction recipes');
  }

  if (/\b(DROP|TRUNCATE|DELETE)\b/i.test(statementSql) || /\bALTER\s+TYPE\b[\s\S]*\bDROP\s+VALUE\b/i.test(statementSql)) {
    errors.push('project migration artifact statements must not include destructive DDL/DML');
  }

  for (const gateName of requiredEvidenceGateNames) {
    if (!gateNames.has(gateName)) {
      errors.push(`project migration artifact is missing evidence gate ${gateName}`);
    }
  }

  if (!artifact.rollbackStrategy.includes('forward-fix')) {
    errors.push('project migration artifact rollback strategy must preserve forward-fix guidance');
  }

  if (!artifact.forwardFixStrategy.includes('additive')) {
    errors.push('project migration artifact forward-fix strategy must require additive migration');
  }

  return errors;
}
