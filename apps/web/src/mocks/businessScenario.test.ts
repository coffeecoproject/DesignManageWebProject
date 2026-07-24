import {
  brandRecords,
  customerContractRecords,
  customerRecords,
  storeRecords
} from '../features/customers/customerData';
import { financeTransactionRecords } from '../features/finance/financeData';
import { financeDeclarationPreparationRecords } from '../features/finance/financeDeclarationPreparationData';
import {
  financeInvoiceBusinessAllocations,
  financeInvoiceRecords
} from '../features/finance/financeInvoiceData';
import { financeFixedAssetRecords, financePrepaidExpenseRecords } from '../features/finance/financeMonthEndSourceData';
import { financeReceivablePayableRecords } from '../features/finance/financeReceivablesPayablesData';
import { socialInsuranceEmployeeRecords } from '../features/finance/financeSocialInsuranceData';
import { financeTaxMatterRecords } from '../features/finance/financeTaxFilingData';
import { myWorkExpenseCollectionSeedRecords } from '../features/my-work/myWorkExpenseCollectionModel';
import { peopleMembers } from '../features/people/mockData';
import { performanceRulePresets } from '../features/performance/performanceMockData';
import { performanceSignatureEmployees } from '../features/performance/performanceSignatureArchiveData';
import {
  seedClientFeedbackRows,
  seedPartTimeLaborAcceptanceRows,
  seedStoreTaskRows,
  seedTaskPerformanceScoringRows
} from '../features/tasks/TaskManagementState';
import { mockBusinessParties, mockBusinessPeople } from './businessScenario';

type UnitTest = { name: string; run: () => void };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertUnique(values: string[], label: string) {
  assert(new Set(values).size === values.length, `${label} must be unique`);
}

function assertNoDisplayPlaceholder(value: string, label: string) {
  assert(!value.includes('示例'), `${label} must not contain display placeholder text: ${value}`);
}

const tests: UnitTest[] = [
  {
    name: 'MOCK-01 uses stable people identities without display placeholders',
    run() {
      assertUnique(peopleMembers.map((row) => row.id), 'people ids');
      assertUnique(peopleMembers.map((row) => row.name), 'people names');

      const expectedPeople = Object.values(mockBusinessPeople);
      expectedPeople.forEach((expected) => {
        const person = peopleMembers.find((row) => row.id === expected.id);
        assert(person, `person ${expected.id} must exist`);
        assert(person.name === expected.name, `person ${expected.id} must use scenario name ${expected.name}`);
      });
      peopleMembers.forEach((row) => assertNoDisplayPlaceholder(row.name, `person ${row.id}`));
    }
  },
  {
    name: 'MOCK-02 keeps customer brand store and contract references closed',
    run() {
      const customerIds = new Set(customerRecords.map((row) => row.id));
      const brandIds = new Set(brandRecords.map((row) => row.id));

      assertUnique(customerRecords.map((row) => row.id), 'customer ids');
      assertUnique(brandRecords.map((row) => row.id), 'brand ids');
      assertUnique(storeRecords.map((row) => row.id), 'store ids');
      assertUnique(customerContractRecords.map((row) => row.id), 'contract ids');

      brandRecords.forEach((row) => assert(customerIds.has(row.customerId), `brand ${row.id} customer must exist`));
      storeRecords.forEach((row) => {
        assert(customerIds.has(row.customerId), `store ${row.id} customer must exist`);
        assert(brandIds.has(row.brandId), `store ${row.id} brand must exist`);
        const brand = brandRecords.find((item) => item.id === row.brandId);
        assert(brand?.customerId === row.customerId, `store ${row.id} customer and brand owner must agree`);
      });
      customerContractRecords.forEach((row) =>
        assert(customerIds.has(row.customerId), `contract ${row.id} customer must exist`)
      );

      Object.values(mockBusinessParties).forEach((party) => {
        assert(customerRecords.some((row) => row.id === party.customerId && row.name === party.customerName), `${party.customerId} must match registry`);
        assert(brandRecords.some((row) => row.id === party.brandId && row.name === party.brandName), `${party.brandId} must match registry`);
      });
    }
  },
  {
    name: 'MOCK-03 keeps task people store and derived records traceable',
    run() {
      const peopleIds = new Set(peopleMembers.map((row) => row.id));
      const storeIds = new Set(storeRecords.map((row) => row.id));
      const taskIds = new Set(seedStoreTaskRows.map((row) => row.id));

      assertUnique(seedStoreTaskRows.map((row) => row.id), 'task ids');
      seedStoreTaskRows.forEach((row) => {
        assert(storeIds.has(row.storeId), `task ${row.id} store must exist`);
        if (row.executorId) assert(peopleIds.has(row.executorId), `task ${row.id} executor must exist`);
        if (row.acceptorId) assert(peopleIds.has(row.acceptorId), `task ${row.id} acceptor must exist`);
        if (row.executorName) assertNoDisplayPlaceholder(row.executorName, `task ${row.id} executor`);
        if (row.acceptorName) assertNoDisplayPlaceholder(row.acceptorName, `task ${row.id} acceptor`);
      });
      seedClientFeedbackRows.forEach((row) => assert(taskIds.has(row.taskId), `feedback ${row.id} task must exist`));
      seedTaskPerformanceScoringRows.forEach((row) => assert(taskIds.has(row.taskId), `score ${row.id} task must exist`));
      seedPartTimeLaborAcceptanceRows.forEach((row) => assert(taskIds.has(row.taskId), `labor ${row.id} task must exist`));
    }
  },
  {
    name: 'MOCK-04 keeps employee expense and operational roots populated',
    run() {
      const peopleById = new Map(peopleMembers.map((row) => [row.id, row]));

      assert(performanceRulePresets.length >= 2, 'performance must include current and historical rule samples');
      performanceSignatureEmployees.forEach((row) => {
        const employee = peopleById.get(row.workNo);
        assert(employee, `performance signature employee ${row.workNo} must exist`);
        assert(employee.name === row.employeeName, `performance signature employee ${row.workNo} must match people data`);
      });
      assert(myWorkExpenseCollectionSeedRecords.length >= 3, 'expense and collection must include actionable samples');
      myWorkExpenseCollectionSeedRecords.forEach((row) => {
        assert(row.submitterId, `expense or collection ${row.id} submitter id must exist`);
        const submitter = peopleById.get(row.submitterId);
        assert(submitter, `expense or collection ${row.id} submitter must exist`);
        assert(submitter.name === row.submitterName, `expense or collection ${row.id} submitter snapshot must match people data`);
      });
      assert(socialInsuranceEmployeeRecords.length >= 2, 'social insurance must include multiple employee states');
      assert(financeFixedAssetRecords.length > 0, 'month-end close must include fixed-asset source data');
      assert(financePrepaidExpenseRecords.length > 0, 'month-end close must include prepaid-expense source data');
    }
  },
  {
    name: 'MOCK-05 covers finance accounting and tax lifecycle states',
    run() {
      const customerNames = new Set(customerRecords.map((row) => row.name));
      const peopleNames = new Set(peopleMembers.map((row) => row.name));
      const receivablePayableDirections = new Set(financeReceivablePayableRecords.map((row) => row.direction));
      const settlementStatuses = new Set(financeReceivablePayableRecords.map((row) => row.settlementStatus));
      const transactionDirections = new Set(financeTransactionRecords.map((row) => row.direction));
      const transactionStatuses = new Set(financeTransactionRecords.map((row) => row.status));
      const invoiceDirections = new Set(financeInvoiceRecords.map((row) => row.direction));
      const declarationTaxTypes = new Set(financeDeclarationPreparationRecords.map((row) => row.taxType));
      const matterTaxTypes = new Set(financeTaxMatterRecords.map((row) => row.matterType));

      assert(receivablePayableDirections.has('应收') && receivablePayableDirections.has('应付'), 'receivables and payables must cover both directions');
      assert(settlementStatuses.has('未结清') && settlementStatuses.has('部分结清') && settlementStatuses.has('已结清'), 'settlement samples must cover open partial and settled states');
      assert(transactionDirections.has('收入') && transactionDirections.has('支出'), 'transactions must cover income and expense');
      assert(transactionStatuses.has('待复核') && transactionStatuses.has('已入账'), 'transactions must cover pending review and posted states');
      assert(invoiceDirections.has('销项') && invoiceDirections.has('进项'), 'invoice ledger must cover output and input invoices');
      assert(financeInvoiceBusinessAllocations.length > 0, 'invoice ledger must include saved business allocations');

      const customerCounterparties = [
        ...financeReceivablePayableRecords.filter((row) => row.counterpartyType === '客户').map((row) => row.counterparty),
        ...financeTransactionRecords.filter((row) => row.counterpartyType === '客户').map((row) => row.counterparty),
        ...financeInvoiceRecords.filter((row) => row.direction === '销项').map((row) => row.counterparty)
      ];
      const unknownCustomers = [...new Set(customerCounterparties.filter((name) => !customerNames.has(name)))];
      assert(unknownCustomers.length === 0, `finance customer counterparties must exist in customer archive: ${unknownCustomers.join(', ')}`);

      const employeeCounterparties = [
        ...financeReceivablePayableRecords.filter((row) => row.counterpartyType === '员工').map((row) => row.counterparty),
        ...financeTransactionRecords.filter((row) => row.counterpartyType === '员工').map((row) => row.counterparty)
      ];
      const unknownEmployees = [...new Set(employeeCounterparties.filter((name) => !peopleNames.has(name)))];
      assert(unknownEmployees.length === 0, `finance employee counterparties must exist in people archive: ${unknownEmployees.join(', ')}`);

      ['个人所得税', '增值税及附加', '企业所得税', '印花税'].forEach((taxType) => {
        assert(declarationTaxTypes.has(taxType as never), `declaration preparation must cover ${taxType}`);
        assert(matterTaxTypes.has(taxType as never), `tax handling must cover ${taxType}`);
      });

      [
        ...financeReceivablePayableRecords,
        ...financeTransactionRecords,
        ...financeInvoiceRecords,
        ...financeDeclarationPreparationRecords,
        ...financeTaxMatterRecords
      ].forEach((row) => assertNoDisplayPlaceholder(JSON.stringify(row), 'finance seed row'));
    }
  }
];

export function runBusinessScenarioTests() {
  const failures: string[] = [];
  const passedTestNames: string[] = [];

  tests.forEach((test) => {
    try {
      test.run();
      passedTestNames.push(test.name);
    } catch (error) {
      failures.push(`${test.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  return {
    executedTestNames: tests.map((test) => test.name),
    failures,
    passed: passedTestNames.length,
    passedTestNames,
    total: tests.length
  };
}
