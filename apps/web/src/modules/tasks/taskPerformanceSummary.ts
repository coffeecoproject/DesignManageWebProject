/** An employee's latest published performance, shown when assigning and reviewing tasks. */
export type TaskPerformanceSummary = {
  period?: string;
  score: number | null;
  sourceTaskCount: number;
};

/** Looks up an employee's latest published performance by work number; the app supplies it from performance results. */
export type TaskPerformanceSummaryLookup = (employeeId: string) => TaskPerformanceSummary;
