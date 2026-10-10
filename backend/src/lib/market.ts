export function formatMarketDelta(value: number) {
  return `${value >= 0 ? '+' : ''}${Number(value).toFixed(2)}`
}

export function normalizeMarketSnapshot(snapshot: any) {
  return {
    symbol: snapshot.symbol,
    exchange: snapshot.exchange,
    instrument: snapshot.instrument,
    value: Number(snapshot.value ?? 0),
    change: Number(snapshot.change ?? 0),
    percentChange: Number(snapshot.percentChange ?? 0),
    timestamp: snapshot.timestamp ?? new Date().toISOString(),
    source: snapshot.source ?? 'Unconfigured provider',
    status: snapshot.status ?? 'delayed',
  }
}
