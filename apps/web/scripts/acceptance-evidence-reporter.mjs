// Vitest reporter: binds every acceptance ID (CIT, NP, ST, TAX) to scenarios the test runner actually executed
// and passed, never to test names scanned from source. Only a run of the whole web suite (every web test file,
// no line or name filter) proves coverage, so partial runs skip the check; `testpace full` runs the whole suite.
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCorporateIncomeTaxAcceptanceEvidence } from './corporate-income-tax-acceptance.mjs';
import { assertNaturalPersonPaymentAcceptanceEvidence } from './natural-person-payment-acceptance.mjs';
import { assertStampDutyAcceptanceEvidence } from './stamp-duty-acceptance.mjs';
import { assertTaxHandlingSettlementAcceptanceEvidence } from './tax-handling-settlement-acceptance.mjs';

const webRoot = fileURLToPath(new URL('..', import.meta.url));

function webTestFiles() {
  const list = (dir, suffix) => readdirSync(join(webRoot, dir), { recursive: true })
    .filter((entry) => entry.endsWith(suffix))
    .map((entry) => join(webRoot, dir, entry));

  return [...list('src', '.test.ts'), ...list('scripts', '.test.mjs')];
}

const checks = [
  ['Corporate-income-tax acceptance', assertCorporateIncomeTaxAcceptanceEvidence, (r) => `${r.passed}/${r.total}`],
  [
    'Natural-person acceptance',
    assertNaturalPersonPaymentAcceptanceEvidence,
    (r) => `${r.executableEvidenceCount}/${r.total}, ${r.executedScenarioCount} named scenarios, frontend-chain closure ${r.chainClosedIds.length}/${r.total}`
  ],
  ['Stamp-duty acceptance', assertStampDutyAcceptanceEvidence, (r) => `${r.passed}/${r.total}`],
  ['Tax-handling settlement acceptance', assertTaxHandlingSettlementAcceptanceEvidence, (r) => `${r.passed}/${r.total}`]
];

export default class AcceptanceEvidenceReporter {
  onInit(vitest) {
    this.vitest = vitest;
  }

  onTestRunStart(specifications) {
    this.filtered = Boolean(this.vitest.config.testNamePattern) || specifications.some((spec) => spec.testLines?.length);
    this.specified = new Set(specifications.map((spec) => spec.moduleId));
  }

  onTestRunEnd(testModules, _unhandledErrors, reason) {
    if (reason === 'interrupted' || this.filtered || !webTestFiles().every((file) => this.specified.has(file))) {
      return;
    }

    const executed = testModules.map((testModule) => {
      const tests = [...testModule.children.allTests()];
      const namesIn = (...states) => tests.filter((test) => states.includes(test.result().state)).map((test) => test.name);

      return {
        entry: relative(webRoot, testModule.moduleId),
        executedTestNames: namesIn('passed', 'failed'),
        passedTestNames: namesIn('passed')
      };
    });
    const entries = executed.map((module) => module.entry);
    const failures = [];

    for (const [label, check, summarize] of checks) {
      try {
        console.log(`${label}: ${summarize(check(entries, executed))}`);
      } catch (error) {
        failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (failures.length > 0) {
      console.error(`Acceptance evidence failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`);
      process.exitCode = 1;
    }
  }
}
