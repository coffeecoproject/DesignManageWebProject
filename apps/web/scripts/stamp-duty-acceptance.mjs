const stampDutyAcceptanceSources = {
  model: 'src/features/finance/financeStampDutyModel.test.ts',
  taxMatter: 'src/features/finance/financeTaxMatterModel.test.ts',
  accounting: 'src/features/finance/financeAccountingVoucherModel.test.ts'
};

export const stampDutyAcceptanceEvidence = Array.from({ length: 17 }, (_, index) => {
  const sequence = index + 1;

  return {
    id: `ST-${String(sequence).padStart(2, '0')}`,
    source: sequence <= 8 || sequence === 14 || sequence === 15
      ? stampDutyAcceptanceSources.model
      : sequence === 13 || sequence >= 16
        ? stampDutyAcceptanceSources.accounting
        : stampDutyAcceptanceSources.taxMatter
  };
});

function containsAcceptanceId(testName, acceptanceId) {
  return new RegExp(`(^|\\s)${acceptanceId}(?=\\s|$)`).test(testName);
}

export function assertStampDutyAcceptanceEvidence(registeredTestEntries, executedTestModules) {
  const registeredEntries = new Set(registeredTestEntries);
  const executionByEntry = new Map(executedTestModules.map((result) => [result.entry, result]));

  for (const evidence of stampDutyAcceptanceEvidence) {
    if (!registeredEntries.has(evidence.source)) {
      throw new Error(`${evidence.id} points to an unregistered test module: ${evidence.source}`);
    }

    const execution = executionByEntry.get(evidence.source);
    const executed = execution?.executedTestNames.filter((name) => containsAcceptanceId(name, evidence.id)) ?? [];
    const passed = execution?.passedTestNames.filter((name) => containsAcceptanceId(name, evidence.id)) ?? [];

    if (executed.length === 0) {
      throw new Error(`${evidence.id} has no executed acceptance scenario`);
    }

    if (passed.length !== executed.length) {
      throw new Error(`${evidence.id} has a failed acceptance scenario`);
    }
  }

  return { passed: stampDutyAcceptanceEvidence.length, total: stampDutyAcceptanceEvidence.length };
}
