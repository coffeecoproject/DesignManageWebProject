import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  commitPerformanceQuarterlyReview,
  type PerformanceQuarterlyReviewFact,
  type PerformanceQuarterlyReviewInput,
  type PerformanceQuarterlyReviewPolicy
} from './performanceQuarterlyReviewModel';
import type { PerformanceMonthlyCategoryRecord } from './performanceTypes';

type PerformanceMonthlyStateResult = { reason?: string; success: boolean };

type PerformanceMonthlyStateValue = {
  confirmQuarterlyReview: (
    records: PerformanceMonthlyCategoryRecord[],
    input: PerformanceQuarterlyReviewInput,
    policy?: PerformanceQuarterlyReviewPolicy
  ) => PerformanceMonthlyStateResult;
  quarterlyReviewFacts: PerformanceQuarterlyReviewFact[];
};

const PerformanceMonthlyContext = createContext<PerformanceMonthlyStateValue | undefined>(undefined);

export function PerformanceMonthlyProvider({ children }: { children: ReactNode }) {
  const [quarterlyReviewFacts, setQuarterlyReviewFacts] = useState<PerformanceQuarterlyReviewFact[]>([]);

  const value = useMemo<PerformanceMonthlyStateValue>(() => ({
    confirmQuarterlyReview(records, input, policy) {
      const result = commitPerformanceQuarterlyReview({ facts: quarterlyReviewFacts, input, policy, records });

      if (!result.success) {
        return { reason: result.reason, success: false };
      }

      setQuarterlyReviewFacts(result.facts);
      return { success: true };
    },
    quarterlyReviewFacts
  }), [quarterlyReviewFacts]);

  return <PerformanceMonthlyContext.Provider value={value}>{children}</PerformanceMonthlyContext.Provider>;
}

export function usePerformanceMonthlyState() {
  const value = useContext(PerformanceMonthlyContext);

  if (!value) {
    throw new Error('usePerformanceMonthlyState must be used within PerformanceMonthlyProvider');
  }

  return value;
}
