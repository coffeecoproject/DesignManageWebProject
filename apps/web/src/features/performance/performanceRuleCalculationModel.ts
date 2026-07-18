import type {
  PerformanceExcessBand,
  PerformanceQualityBand,
  PerformanceQualityDimension
} from './performanceTypes';

type PerformanceDimensionScore = {
  id: string;
  score: number;
};

type DrawingTaskAmountInput = {
  basePerformanceAmount: number;
  baselineScore: number;
  belowBaselineFactor: number;
  excessBands: PerformanceExcessBand[];
  fullScore: number;
  monthlyPrepayRatio: number;
  qualityBands: PerformanceQualityBand[];
  qualityScore: number;
  taskScore: number;
  thresholdRatio?: number;
};

export function roundPerformanceValue(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateWeightedPerformanceQualityScore(
  dimensionScores: PerformanceDimensionScore[],
  qualityDimensions: PerformanceQualityDimension[]
) {
  const scoresById = new Map(dimensionScores.map((item) => [item.id, item.score]));
  const weightedScore = qualityDimensions.reduce((total, dimension) => {
    const score = scoresById.get(dimension.id) ?? 0;
    const normalizedScore = dimension.score > 0
      ? Math.min(1, Math.max(0, score / dimension.score))
      : 0;

    return total + normalizedScore * dimension.weight * 100;
  }, 0);

  return roundPerformanceValue(weightedScore);
}

export function getPerformanceQualityBand(
  qualityBands: PerformanceQualityBand[],
  qualityScore: number
) {
  return qualityBands.find(
    (band) =>
      qualityScore >= band.minScore &&
      (typeof band.maxScore !== 'number' || qualityScore <= band.maxScore)
  );
}

export function getPerformanceExcessMultiplier(
  excessBands: PerformanceExcessBand[],
  taskScore: number,
  thresholdRatio = 1
) {
  return excessBands.find((band) => {
    const minScore = roundPerformanceValue(band.minScoreExclusive * thresholdRatio);
    const maxScore = typeof band.maxScore === 'number'
      ? roundPerformanceValue(band.maxScore * thresholdRatio)
      : undefined;

    return taskScore > minScore && (typeof maxScore !== 'number' || taskScore <= maxScore);
  })?.multiplier ?? 0;
}

export function calculateDrawingTaskPerformanceAmount({
  basePerformanceAmount,
  baselineScore,
  belowBaselineFactor,
  excessBands,
  fullScore,
  monthlyPrepayRatio,
  qualityBands,
  qualityScore,
  taskScore,
  thresholdRatio = 1
}: DrawingTaskAmountInput) {
  const effectiveFullScore = roundPerformanceValue(fullScore * thresholdRatio);
  const effectiveBaselineScore = roundPerformanceValue(baselineScore * thresholdRatio);
  const pointValue = fullScore > 0 ? basePerformanceAmount / fullScore : 0;
  const confirmedBaseScore = Math.min(taskScore, effectiveFullScore);
  const excessScore = Math.max(0, roundPerformanceValue(taskScore - effectiveFullScore));
  const taskConfirmRatio = taskScore >= effectiveBaselineScore ? 1 : belowBaselineFactor;
  const qualityBand = getPerformanceQualityBand(qualityBands, qualityScore);
  const baseQualityRatio = qualityBand?.qualityRatio ?? 0;
  const excessQualityRatio = qualityBand?.excessRatio ?? 0;
  const excessMultiplier = getPerformanceExcessMultiplier(excessBands, taskScore, thresholdRatio);
  const baseAmount = roundPerformanceValue(
    confirmedBaseScore * pointValue * baseQualityRatio * taskConfirmRatio
  );
  const excessAmount = roundPerformanceValue(
    excessScore * pointValue * excessMultiplier * excessQualityRatio
  );
  const monthlyAmount = roundPerformanceValue(baseAmount + excessAmount);
  const prepayAmount = roundPerformanceValue(monthlyAmount * monthlyPrepayRatio);

  return {
    baseAmount,
    baseQualityRatio,
    confirmedBaseScore: roundPerformanceValue(confirmedBaseScore),
    excessAmount,
    excessMultiplier,
    excessQualityRatio,
    excessScore,
    monthlyAmount,
    pointValue: roundPerformanceValue(pointValue),
    prepayAmount,
    prepayRatio: monthlyPrepayRatio,
    qualityBand: qualityBand?.scoreRange ?? '-',
    taskConfirmRatio
  };
}
