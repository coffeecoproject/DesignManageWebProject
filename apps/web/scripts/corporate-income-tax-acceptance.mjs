export const corporateIncomeTaxAcceptanceEvidence = Array.from({ length: 20 }, (_, index) => {
  const id = `CIT-${String(index + 1).padStart(2, '0')}`;
  const sequence = index + 1;

  return {
    id,
    source: sequence >= 13 && sequence <= 15
      ? 'src/features/finance/financeAccountingVoucherModel.test.ts'
      : 'src/features/finance/financeTaxMatterModel.test.ts'
  };
});

function containsAcceptanceId(testName, acceptanceId) {
  return new RegExp(`(^|\\s)${acceptanceId}(?=\\s|$)`).test(testName);
}

export function assertCorporateIncomeTaxAcceptanceEvidence(registeredTestEntries, executedTestModules) {
  const registeredEntries = new Set(registeredTestEntries);
  const executionByEntry = new Map(executedTestModules.map((result) => [result.entry, result]));

  for (const evidence of corporateIncomeTaxAcceptanceEvidence) {
    if (!registeredEntries.has(evidence.source)) {
      throw new Error(`${evidence.id} points to an unregistered test module: ${evidence.source}`);
    }

    const execution = executionByEntry.get(evidence.source);
    const matchingExecutedTests = execution?.executedTestNames.filter((testName) =>
      containsAcceptanceId(testName, evidence.id)
    ) ?? [];
    const matchingPassedTests = execution?.passedTestNames.filter((testName) =>
      containsAcceptanceId(testName, evidence.id)
    ) ?? [];

    if (matchingExecutedTests.length === 0) {
      throw new Error(`${evidence.id} has no executed acceptance scenario`);
    }

    if (matchingPassedTests.length !== matchingExecutedTests.length) {
      throw new Error(`${evidence.id} has a failed acceptance scenario`);
    }
  }

  return {
    passed: corporateIncomeTaxAcceptanceEvidence.length,
    total: corporateIncomeTaxAcceptanceEvidence.length
  };
}
