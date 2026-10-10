export function pickStockOfDay(candidates: any[] = []) {
  if (!candidates.length) {
    return { signal: 'INSUFFICIENT DATA', reason: 'No reliable stock candidates were available for selection.' }
  }

  const ranked = [...candidates].sort((left, right) => Number(right.score ?? 0) - Number(left.score ?? 0))
  const winner = ranked[0]

  return {
    symbol: winner.symbol,
    signal: winner.score >= 70 ? 'POTENTIAL CANDIDATE' : 'RESEARCH WATCH',
    reason: winner.reason ?? 'Strong fundamentals and trend alignment justify a watchlist review.',
  }
}
