export const naturalPersonPaymentAcceptanceEvidence = [
  {
    id: 'NP-01',
    frontendChainSources: ['src/modules/salary/salaryDomain.test.ts'],
    sources: ['src/modules/salary/salaryDomain.test.ts']
  },
  {
    id: 'NP-02',
    frontendChainSources: ['src/modules/salary/salaryDomain.test.ts'],
    sources: ['src/modules/salary/salaryDomain.test.ts']
  },
  {
    id: 'NP-03',
    frontendChainSources: ['src/modules/salary/salaryDomain.test.ts'],
    sources: ['src/modules/salary/salaryDomain.test.ts']
  },
  {
    id: 'NP-04',
    frontendChainSources: ['src/modules/finance/partTimeLaborFrontendWorkflow.test.ts'],
    sources: [
      'src/modules/tasks/taskDomainModel.test.ts',
      'src/modules/finance/financeNaturalPersonPaymentModel.test.ts',
      'src/modules/finance/partTimeLaborFrontendWorkflow.test.ts'
    ]
  },
  {
    id: 'NP-05',
    frontendChainSources: ['src/modules/finance/partTimeLaborFrontendWorkflow.test.ts'],
    sources: [
      'src/modules/tasks/taskDomainModel.test.ts',
      'src/modules/finance/partTimeLaborFrontendWorkflow.test.ts'
    ]
  },
  {
    id: 'NP-06',
    frontendChainSources: ['src/modules/finance/partTimeLaborFrontendWorkflow.test.ts'],
    sources: [
      'src/modules/tasks/taskDomainModel.test.ts',
      'src/modules/finance/partTimeLaborFrontendWorkflow.test.ts'
    ]
  },
  {
    id: 'NP-07',
    frontendChainSources: ['src/modules/finance/naturalPersonPaymentFrontendWorkflow.test.ts'],
    sources: [
      'src/modules/finance/financeNaturalPersonPaymentModel.test.ts',
      'src/modules/finance/naturalPersonPaymentFrontendWorkflow.test.ts'
    ]
  },
  {
    id: 'NP-08',
    frontendChainSources: ['src/modules/my-work/myWorkExpenseReviewModel.test.ts'],
    sources: ['src/modules/my-work/myWorkExpenseReviewModel.test.ts']
  },
  {
    id: 'NP-09',
    frontendChainSources: ['src/modules/my-work/myWorkExpenseReviewModel.test.ts'],
    sources: ['src/modules/my-work/myWorkExpenseReviewModel.test.ts']
  },
  {
    id: 'NP-10',
    frontendChainSources: ['src/modules/my-work/myWorkExpenseReviewModel.test.ts'],
    sources: ['src/modules/my-work/myWorkExpenseReviewModel.test.ts']
  },
  {
    id: 'NP-11',
    frontendChainSources: ['src/modules/my-work/myWorkExpenseReviewModel.test.ts'],
    sources: [
      'src/modules/my-work/myWorkExpenseReviewModel.test.ts',
      'src/modules/finance/financeExpenseApprovalCommitModel.test.ts'
    ]
  },
  {
    id: 'NP-12',
    frontendChainSources: ['src/modules/my-work/myWorkExpenseReviewModel.test.ts'],
    sources: ['src/modules/my-work/myWorkExpenseReviewModel.test.ts']
  },
  {
    id: 'NP-13',
    frontendChainSources: ['src/modules/my-work/myWorkExpenseCollectionModel.test.ts'],
    sources: ['src/modules/my-work/myWorkExpenseCollectionModel.test.ts']
  },
  {
    id: 'NP-14',
    frontendChainSources: ['src/modules/finance/naturalPersonPaymentFrontendWorkflow.test.ts'],
    sources: [
      'src/modules/finance/financeReceivablesPayablesModel.test.ts',
      'src/modules/finance/financeNaturalPersonPaymentModel.test.ts',
      'src/modules/finance/financeTaxMatterModel.test.ts',
      'src/modules/finance/naturalPersonPaymentFrontendWorkflow.test.ts'
    ]
  },
  {
    id: 'NP-15',
    frontendChainSources: ['src/modules/finance/naturalPersonPaymentFrontendWorkflow.test.ts'],
    sources: [
      'src/modules/finance/financeTaxMatterModel.test.ts',
      'src/modules/finance/naturalPersonPaymentFrontendWorkflow.test.ts'
    ]
  },
  {
    id: 'NP-16',
    frontendChainSources: ['src/modules/finance/naturalPersonPaymentFrontendWorkflow.test.ts'],
    sources: [
      'src/modules/finance/financeNaturalPersonPaymentModel.test.ts',
      'src/modules/finance/naturalPersonPaymentFrontendWorkflow.test.ts'
    ]
  },
  {
    id: 'NP-17',
    frontendChainSources: ['src/modules/finance/financeExpenseApprovalCommitModel.test.ts'],
    sources: [
      'src/modules/my-work/myWorkExpenseReviewModel.test.ts',
      'src/modules/finance/financeExpenseApprovalCommitModel.test.ts'
    ]
  },
  {
    id: 'NP-18',
    frontendChainSources: ['src/modules/salary/salaryDomain.test.ts'],
    sources: ['src/modules/salary/salaryDomain.test.ts']
  },
  {
    id: 'NP-19',
    frontendChainSources: ['src/modules/finance/salaryFinanceFrontendWorkflow.test.ts'],
    sources: [
      'src/modules/salary/salaryDomain.test.ts',
      'src/modules/finance/financeAccountingVoucherModel.test.ts',
      'src/modules/finance/salaryFinanceFrontendWorkflow.test.ts'
    ]
  },
  {
    id: 'NP-20',
    frontendChainSources: ['src/modules/finance/partTimeLaborFrontendWorkflow.test.ts'],
    sources: ['src/modules/finance/partTimeLaborFrontendWorkflow.test.ts']
  }
];

function containsAcceptanceId(testName, acceptanceId) {
  return new RegExp(`(^|\\s)${acceptanceId}(?=\\s|$)`).test(testName);
}

export function assertNaturalPersonPaymentAcceptanceEvidence(registeredTestEntries, executedTestModules) {
  const expectedIds = Array.from({ length: 20 }, (_, index) => `NP-${String(index + 1).padStart(2, '0')}`);
  const actualIds = naturalPersonPaymentAcceptanceEvidence.map((entry) => entry.id);

  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    throw new Error(`Natural-person acceptance evidence IDs are incomplete or unordered: ${actualIds.join(', ')}`);
  }

  const registeredEntries = new Set(registeredTestEntries);
  const executionByEntry = new Map(executedTestModules.map((result) => [result.entry, result]));
  const matchedScenarioNames = new Set();
  const chainClosedIds = [];

  for (const evidence of naturalPersonPaymentAcceptanceEvidence) {
    for (const sourcePath of evidence.sources) {
      if (!registeredEntries.has(sourcePath)) {
        throw new Error(`${evidence.id} points to an unregistered test module: ${sourcePath}`);
      }

      const execution = executionByEntry.get(sourcePath);

      if (!execution) {
        throw new Error(`${evidence.id} test module was not executed: ${sourcePath}`);
      }

      const matchingExecutedTests = execution.executedTestNames.filter((testName) =>
        containsAcceptanceId(testName, evidence.id)
      );
      const matchingPassedTests = execution.passedTestNames.filter((testName) =>
        containsAcceptanceId(testName, evidence.id)
      );

      if (matchingExecutedTests.length === 0) {
        throw new Error(`${evidence.id} has no executed scenario in ${sourcePath}`);
      }

      if (matchingPassedTests.length !== matchingExecutedTests.length) {
        throw new Error(`${evidence.id} has a failed executable scenario in ${sourcePath}`);
      }

      for (const testName of matchingPassedTests) {
        matchedScenarioNames.add(`${sourcePath}:${testName}`);
      }
    }

    const frontendChainSources = evidence.frontendChainSources ?? [];

    if (
      frontendChainSources.length > 0 &&
      frontendChainSources.every((sourcePath) => {
        const execution = executionByEntry.get(sourcePath);

        return execution?.passedTestNames.some(
          (testName) => containsAcceptanceId(testName, evidence.id) && testName.includes('FRONTEND-CHAIN')
        );
      })
    ) {
      chainClosedIds.push(evidence.id);
    }
  }

  return {
    chainClosedIds,
    executableEvidenceCount: naturalPersonPaymentAcceptanceEvidence.length,
    executedScenarioCount: matchedScenarioNames.size,
    total: naturalPersonPaymentAcceptanceEvidence.length
  };
}
