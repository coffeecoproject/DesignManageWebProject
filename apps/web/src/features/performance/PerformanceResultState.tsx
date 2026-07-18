import dayjs from 'dayjs';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePeopleOrganizationState } from '../people/PeopleOrganizationState';
import { useWorkCalendarState } from '../system/WorkCalendarState';
import {
  correctPerformanceResult,
  publishPerformanceResult,
  type PerformanceResultCorrectionInput,
  type PerformanceResultMutation,
  type PerformanceResultWorkflowInput
} from './performanceResultModel';
import {
  correctQuarterlyPerformanceResult,
  publishQuarterlyPerformanceResult,
  type PerformanceQuarterlyAdjustmentInput
} from './performanceQuarterlyResultModel';
import {
  confirmPerformanceResult,
  objectToPerformanceResult,
  resolvePerformanceResultObjection,
  type PerformanceEmployeeObjectionInput,
  type PerformanceEmployeeResponseActionInput,
  type PerformanceObjectionResolutionInput,
  type PerformanceResultResponseMutation
} from './performanceResultResponseModel';
import {
  settlePerformanceResults,
  type SettlePerformanceResultsInput,
  type SettlePerformanceResultsResult
} from './performanceResultSettlementModel';
import {
  buildPerformanceResultMockBootstrap,
  performanceResultDemoEmployeeId
} from './performanceResultMockBootstrapModel';
import type {
  PerformanceDrawingTaskMonthlyRecord,
  PerformanceMonthlyCategoryRecord,
  PerformanceMonthlyResultSnapshot,
  PerformanceQuarterlyResultSnapshot,
  PerformanceResultSnapshot
} from './performanceTypes';
import { usePerformanceMonthlyRecords } from './usePerformanceMonthlyRecords';

type PerformanceResultStateValue = {
  confirmEmployeeResult: (
    resultId: string,
    input: PerformanceEmployeeResponseActionInput
  ) => PerformanceResultResponseMutation;
  correctMonthlyResult: (
    currentResult: PerformanceMonthlyResultSnapshot,
    currentSource: PerformanceMonthlyCategoryRecord,
    drawingTaskRecord: PerformanceDrawingTaskMonthlyRecord | undefined,
    input: PerformanceResultCorrectionInput
  ) => PerformanceResultMutation;
  correctQuarterlyResult: (
    currentResult: PerformanceQuarterlyResultSnapshot,
    currentDraft: PerformanceQuarterlyResultSnapshot,
    adjustment: PerformanceQuarterlyAdjustmentInput,
    input: PerformanceResultCorrectionInput
  ) => PerformanceResultMutation;
  formalResults: PerformanceResultSnapshot[];
  objectToEmployeeResult: (
    resultId: string,
    input: PerformanceEmployeeObjectionInput
  ) => PerformanceResultResponseMutation;
  publishMonthlyResult: (
    draft: PerformanceMonthlyResultSnapshot,
    input: PerformanceResultWorkflowInput
  ) => PerformanceResultMutation;
  publishQuarterlyResult: (
    draft: PerformanceQuarterlyResultSnapshot,
    adjustment: PerformanceQuarterlyAdjustmentInput,
    input: PerformanceResultWorkflowInput
  ) => PerformanceResultMutation;
  resolveEmployeeObjection: (
    resultId: string,
    input: PerformanceObjectionResolutionInput
  ) => PerformanceResultResponseMutation;
  settleSalaryResults: (input: SettlePerformanceResultsInput) => SettlePerformanceResultsResult;
};

const PerformanceResultContext = createContext<PerformanceResultStateValue | undefined>(undefined);

export function PerformanceResultProvider({ children }: { children: ReactNode }) {
  const performanceMonthlyRecords = usePerformanceMonthlyRecords();
  const { peopleRows } = usePeopleOrganizationState();
  const { annualExceptionRows, workCalendarRows } = useWorkCalendarState();
  const [formalResults, setFormalResults] = useState<PerformanceResultSnapshot[]>(() =>
    buildPerformanceResultMockBootstrap({
      actor: '李明',
      annualExceptionRows,
      deliveredAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      drawingTaskRecords: performanceMonthlyRecords.drawingTaskRecords,
      employeeId: performanceResultDemoEmployeeId,
      monthlyRecords: performanceMonthlyRecords.categoryRecords,
      peopleRows,
      workCalendarRows
    }).results
  );
  const formalResultsRef = useRef<PerformanceResultSnapshot[]>(formalResults);

  const commitResults = useCallback((results: PerformanceResultSnapshot[]) => {
    formalResultsRef.current = results;
    setFormalResults(results);
  }, []);

  const value = useMemo<PerformanceResultStateValue>(() => ({
    confirmEmployeeResult(resultId, input) {
      const outcome = confirmPerformanceResult(formalResultsRef.current, resultId, input);

      if (outcome.success) {
        commitResults(outcome.results);
      }

      return outcome;
    },
    correctMonthlyResult(currentResult, currentSource, drawingTaskRecord, input) {
      const outcome = correctPerformanceResult(
        formalResultsRef.current,
        currentResult,
        currentSource,
        drawingTaskRecord,
        input
      );

      if (outcome.success) {
        commitResults(outcome.results);
      }

      return outcome;
    },
    correctQuarterlyResult(currentResult, currentDraft, adjustment, input) {
      const outcome = correctQuarterlyPerformanceResult(
        formalResultsRef.current,
        currentResult,
        currentDraft,
        adjustment,
        input
      );

      if (outcome.success) {
        commitResults(outcome.results);
      }

      return outcome;
    },
    formalResults,
    objectToEmployeeResult(resultId, input) {
      const outcome = objectToPerformanceResult(formalResultsRef.current, resultId, input);

      if (outcome.success) {
        commitResults(outcome.results);
      }

      return outcome;
    },
    publishMonthlyResult(draft, input) {
      const outcome = publishPerformanceResult(formalResultsRef.current, draft, input);

      if (outcome.success) {
        commitResults(outcome.results);
      }

      return outcome;
    },
    publishQuarterlyResult(draft, adjustment, input) {
      const outcome = publishQuarterlyPerformanceResult(
        formalResultsRef.current,
        draft,
        adjustment,
        input
      );

      if (outcome.success) {
        commitResults(outcome.results);
      }

      return outcome;
    },
    resolveEmployeeObjection(resultId, input) {
      const outcome = resolvePerformanceResultObjection(
        formalResultsRef.current,
        resultId,
        input
      );

      if (outcome.success) {
        commitResults(outcome.results);
      }

      return outcome;
    },
    settleSalaryResults(input) {
      const outcome = settlePerformanceResults(formalResultsRef.current, input);

      if (outcome.success) {
        commitResults(outcome.results);
      }

      return outcome;
    }
  }), [commitResults, formalResults]);

  return <PerformanceResultContext.Provider value={value}>{children}</PerformanceResultContext.Provider>;
}

export function usePerformanceResultState() {
  const value = useContext(PerformanceResultContext);

  if (!value) {
    throw new Error('usePerformanceResultState must be used within PerformanceResultProvider');
  }

  return value;
}
