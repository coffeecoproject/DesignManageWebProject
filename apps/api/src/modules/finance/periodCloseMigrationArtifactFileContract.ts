import {
  buildPeriodCloseProjectMigrationArtifact,
  renderPeriodCloseProjectMigrationArtifactSql,
  validatePeriodCloseProjectMigrationArtifact,
  type PeriodCloseProjectMigrationArtifact
} from './periodCloseProjectMigrationArtifactContract.js';

export const periodCloseNotAppliedMigrationArtifactPath =
  'apps/api/migrations/not-applied/20260704_000001_period_close_persistent_lock.sql';

export type PeriodCloseMigrationArtifactFileValidationInput = {
  artifact?: PeriodCloseProjectMigrationArtifact;
  path?: string;
  sqlText: string;
};

function normalizeSqlText(sqlText: string) {
  return sqlText.replace(/\r\n/g, '\n').trimEnd();
}

export function validatePeriodCloseMigrationArtifactFile({
  artifact = buildPeriodCloseProjectMigrationArtifact(),
  path = periodCloseNotAppliedMigrationArtifactPath,
  sqlText
}: PeriodCloseMigrationArtifactFileValidationInput): string[] {
  const errors: string[] = [];
  const normalizedSql = normalizeSqlText(sqlText);
  const expectedSql = normalizeSqlText(renderPeriodCloseProjectMigrationArtifactSql(artifact));

  errors.push(...validatePeriodCloseProjectMigrationArtifact(artifact));

  if (!path.endsWith(`/not-applied/${artifact.filename}`)) {
    errors.push('period-close migration artifact file must live under the not-applied migration path');
  }

  if (!normalizedSql.startsWith('-- StartupManageSystem period-close project migration artifact.')) {
    errors.push('period-close migration artifact file must keep the provenance header');
  }

  if (!normalizedSql.includes(`-- Artifact: ${artifact.artifactId}`)) {
    errors.push('period-close migration artifact file must keep the artifact identity header');
  }

  if (!normalizedSql.includes(`-- Checksum: ${artifact.checksum}`)) {
    errors.push('period-close migration artifact file must keep the contract checksum header');
  }

  if (!normalizedSql.includes('-- Formal apply status: not_applied')) {
    errors.push('period-close migration artifact file must stay not_applied until formal apply evidence exists');
  }

  if (!normalizedSql.includes('-- Apply mode: manual_review_required')) {
    errors.push('period-close migration artifact file must require manual review');
  }

  if (/\bCOMMIT\b/i.test(normalizedSql)) {
    errors.push('period-close migration artifact file must not include an implicit commit');
  }

  if (/\b(DROP|TRUNCATE|DELETE)\b/i.test(normalizedSql) || /\bALTER\s+TYPE\b[\s\S]*\bDROP\s+VALUE\b/i.test(normalizedSql)) {
    errors.push('period-close migration artifact file must not include destructive DDL/DML');
  }

  if (normalizedSql !== expectedSql) {
    errors.push('period-close migration artifact file must match the rendered project migration artifact exactly');
  }

  return errors;
}
