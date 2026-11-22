// Acceptance-ID coverage and hardcut source checks, run as part of the web test suite.
// Each acceptance ID must name a test declared in its evidence modules. The full suite runs every declared test,
// so a declared, non-skipped test is also an executed and passed one there.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { assertCorporateIncomeTaxAcceptanceEvidence } from './corporate-income-tax-acceptance.mjs';
import { assertFrontendDomainStateHardcut } from './frontend-domain-state-hardcut.mjs';
import { assertNaturalPersonPaymentAcceptanceEvidence } from './natural-person-payment-acceptance.mjs';
import { assertPerformancePhase6ConsumerHardcut } from './performance-phase6-consumer-hardcut.mjs';
import { assertPerformancePhase7ResidualHardcut } from './performance-phase7-residual-hardcut.mjs';
import { assertStampDutyAcceptanceEvidence } from './stamp-duty-acceptance.mjs';
import { assertTaxHandlingSettlementAcceptanceEvidence } from './tax-handling-settlement-acceptance.mjs';

const webRoot = fileURLToPath(new URL('..', import.meta.url));

function declaredTestModules() {
  const modules = [];
  const dynamicNames = [];

  for (const entry of readdirSync(join(webRoot, 'src'), { recursive: true })) {
    if (!entry.endsWith('.test.ts')) {
      continue;
    }

    const path = join(webRoot, 'src', entry);
    const sourceFile = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
    const names = [];

    for (const statement of sourceFile.statements) {
      if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) {
        continue;
      }

      const call = statement.expression;

      if (!ts.isIdentifier(call.expression) || !['it', 'test'].includes(call.expression.text)) {
        continue;
      }

      const [name] = call.arguments;

      if (name && (ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name))) {
        names.push(name.text);
      } else {
        dynamicNames.push(`${entry}:${sourceFile.getLineAndCharacterOfPosition(call.getStart()).line + 1}`);
      }
    }

    modules.push({ entry: relative(webRoot, path), executedTestNames: names, passedTestNames: names });
  }

  return { dynamicNames, modules };
}

const { dynamicNames, modules } = declaredTestModules();
const entries = modules.map((module) => module.entry);

it('declares every web test with a literal name so acceptance IDs can be traced', () => {
  expect(dynamicNames).toEqual([]);
});

it('covers every corporate-income-tax acceptance ID', () => {
  const result = assertCorporateIncomeTaxAcceptanceEvidence(entries, modules);
  expect(result.passed).toBe(result.total);
});

it('covers every natural-person payment acceptance ID', () => {
  const result = assertNaturalPersonPaymentAcceptanceEvidence(entries, modules);
  expect(result.executableEvidenceCount).toBe(result.total);
});

it('covers every stamp-duty acceptance ID', () => {
  const result = assertStampDutyAcceptanceEvidence(entries, modules);
  expect(result.passed).toBe(result.total);
});

it('covers every tax-handling settlement acceptance ID', () => {
  const result = assertTaxHandlingSettlementAcceptanceEvidence(entries, modules);
  expect(result.passed).toBe(result.total);
});

it('keeps the performance phase 6 consumer hardcut', async () => {
  const result = await assertPerformancePhase6ConsumerHardcut(webRoot);
  expect(result.checkedFiles).toBeGreaterThan(0);
});

it('keeps the performance phase 7 residual hardcut', async () => {
  const result = await assertPerformancePhase7ResidualHardcut(webRoot);
  expect(result.checkedSourceFiles).toBeGreaterThan(0);
});

it('keeps the frontend domain state hardcut', async () => {
  const result = await assertFrontendDomainStateHardcut(webRoot);
  expect(result.checkedSourceFiles).toBeGreaterThan(0);
});
