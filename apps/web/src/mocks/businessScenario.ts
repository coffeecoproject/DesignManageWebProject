export const mockBusinessClock = {
  currentDate: '2026-06-30',
  currentDateTime: '2026-06-30 10:00',
  currentMonth: '2026-06',
  currentQuarter: '2026-Q2',
  currentYear: '2026'
} as const;

export const mockAccountingPeriods = {
  archived: '2026-04',
  adjusted: '2026-05',
  current: '2026-06',
  next: '2026-07'
} as const;

export const mockBusinessPeople = {
  fullTimeLead: { id: '20260001', name: '李明' },
  fullTimeDesigner: { id: '20250018', name: '陈浩' },
  fullTimeAdmin: { id: '20260004', name: '赵倩' },
  fullTimeSpaceDesigner: { id: '20260008', name: '刘宇' },
  probationDesigner: { id: '20260011', name: '陈思' },
  departedEmployee: { id: '20240009', name: '孙宁' },
  activeContractor: { id: '20260006', name: '林悦' },
  endedContractor: { id: '20250011', name: '高远' }
} as const;

export const mockBusinessOperator = mockBusinessPeople.fullTimeLead;

export const mockBusinessParties = {
  starry: {
    customerId: 'customer-starry',
    customerName: '湖北星际装饰有限公司',
    brandId: 'brand-starry-space',
    brandName: '星际空间'
  },
  nova: {
    customerId: 'customer-nova',
    customerName: '湖南新岚餐饮管理有限公司',
    brandId: 'brand-nova-tea',
    brandName: '新岚茶集'
  }
} as const;

export const mockBusinessScenarioIds = {
  personnel: {
    probation: 'PEOPLE-PROBATION',
    active: 'PEOPLE-ACTIVE',
    departure: 'PEOPLE-DEPARTURE',
    contractor: 'PEOPLE-CONTRACTOR'
  },
  task: {
    inProgress: 'TASK-IN-PROGRESS',
    pendingSubmission: 'TASK-PENDING-SUBMISSION',
    pendingAcceptance: 'TASK-PENDING-ACCEPTANCE',
    rework: 'TASK-REWORK',
    completed: 'TASK-COMPLETED',
    customerAccepted: 'TASK-CUSTOMER-ACCEPTED'
  },
  finance: {
    openReceivable: 'FINANCE-OPEN-RECEIVABLE',
    partialPayable: 'FINANCE-PARTIAL-PAYABLE',
    pendingReview: 'FINANCE-PENDING-REVIEW',
    reconciled: 'FINANCE-RECONCILED',
    reversed: 'FINANCE-REVERSED',
    closedPeriod: 'FINANCE-CLOSED-PERIOD'
  },
  tax: {
    vat: 'TAX-VAT',
    individualIncomeTax: 'TAX-IIT',
    corporateIncomeTax: 'TAX-CIT',
    stampDuty: 'TAX-STAMP-DUTY'
  }
} as const;

export type MockBusinessScenarioId =
  | (typeof mockBusinessScenarioIds.personnel)[keyof typeof mockBusinessScenarioIds.personnel]
  | (typeof mockBusinessScenarioIds.task)[keyof typeof mockBusinessScenarioIds.task]
  | (typeof mockBusinessScenarioIds.finance)[keyof typeof mockBusinessScenarioIds.finance]
  | (typeof mockBusinessScenarioIds.tax)[keyof typeof mockBusinessScenarioIds.tax];
