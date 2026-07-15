export const taxHandlingSettlementAcceptanceEvidence = [
  { id: 'VAT-14', source: 'src/features/finance/financeTaxMatterModel.test.ts' },
  { id: 'VAT-15', source: 'src/features/finance/financeAccountingVoucherModel.test.ts' },
  { id: 'CIT-16', source: 'src/features/finance/financeTaxMatterModel.test.ts' },
  { id: 'CIT-19', source: 'src/features/finance/financeTaxMatterModel.test.ts' },
  { id: 'ST-11', source: 'src/features/finance/financeTaxMatterModel.test.ts' },
  { id: 'ST-12', source: 'src/features/finance/financeTaxMatterModel.test.ts' },
  { id: 'CROSS-TAX-01', source: 'src/features/finance/financeTaxMatterModel.test.ts' },
  { id: 'CROSS-TAX-02', source: 'src/features/finance/financeTaxMatterModel.test.ts' },
  { id: 'TAX-GL-01', source: 'src/features/finance/taxAccountingFrontendWorkflow.test.ts' },
  { id: 'TAX-GL-02', source: 'src/features/finance/taxAccountingFrontendWorkflow.test.ts' },
  { id: 'TAX-GL-03', source: 'src/features/finance/taxAccountingFrontendWorkflow.test.ts' },
  { id: 'TAX-GL-04', source: 'src/features/finance/taxAccountingFrontendWorkflow.test.ts' },
  { id: 'TAX-GL-05', source: 'src/features/finance/taxAccountingFrontendWorkflow.test.ts' },
  { id: 'TAX-GL-06', source: 'src/features/finance/taxAccountingFrontendWorkflow.test.ts' },
  { id: 'TAX-GL-07', source: 'src/features/finance/taxAccountingFrontendWorkflow.test.ts' },
  { id: 'TAX-GL-08', source: 'src/features/finance/taxAccountingFrontendWorkflow.test.ts' }
];

function containsAcceptanceId(testName, acceptanceId) {
  return new RegExp(`(^|\\s)${acceptanceId}(?=\\s|$)`).test(testName);
}

export function assertTaxHandlingSettlementAcceptanceEvidence(registeredTestEntries, executedTestModules) {
  const registeredEntries = new Set(registeredTestEntries);
  const executionByEntry = new Map(executedTestModules.map((result) => [result.entry, result]));

  for (const evidence of taxHandlingSettlementAcceptanceEvidence) {
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

  return {
    passed: taxHandlingSettlementAcceptanceEvidence.length,
    total: taxHandlingSettlementAcceptanceEvidence.length
  };
}
