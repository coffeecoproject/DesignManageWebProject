/** Display text for a score: two decimals without a trailing .00, or '-' when there is none. */
export function formatScore(score: number | null) {
  return score === null ? '-' : `${score.toFixed(2).replace(/\.00$/, '')} 分`;
}
