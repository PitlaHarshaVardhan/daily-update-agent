import { DailyAssetSnapshot, DailyAssessment, NewsArticle, WatchlistItem } from '../types'

interface EquityCandidate {
  name: string
  symbol: string
  yahooSymbol: string
  aliases: string[]
}

const topEquityBasket: EquityCandidate[] = [
  { name: 'Reliance Industries', symbol: 'RELIANCE', yahooSymbol: 'RELIANCE.NS', aliases: ['reliance industries', 'reliance'] },
  { name: 'HDFC Bank', symbol: 'HDFCBANK', yahooSymbol: 'HDFCBANK.NS', aliases: ['hdfc bank'] },
  { name: 'ICICI Bank', symbol: 'ICICIBANK', yahooSymbol: 'ICICIBANK.NS', aliases: ['icici bank'] },
  { name: 'Tata Consultancy Services', symbol: 'TCS', yahooSymbol: 'TCS.NS', aliases: ['tata consultancy services', 'tcs'] },
  { name: 'Infosys', symbol: 'INFY', yahooSymbol: 'INFY.NS', aliases: ['infosys'] },
]

const positiveHeadlinePattern = /profit|growth|rises?|gains?|record|beats?|upgrade|expands?|wins?|approval|strong(er)?|surge/i
const negativeHeadlinePattern = /loss|falls?|drops?|declin(?:e|es|ed)|weak|downgrade|probe|fraud|penalt(?:y|ies)|default|miss(?:es|ed)?|cuts?|warning/i

function percentChange(current: number, previous: number) {
  return previous === 0 ? 0 : ((current - previous) / previous) * 100
}

export function assessDailyMovement(snapshot: DailyAssetSnapshot, relatedHeadlines: string[]): DailyAssessment {
  const bullishReasons: string[] = []
  const bearishReasons: string[] = []

  if (snapshot.dailyChangePercent > 0) {
    bullishReasons.push(`Latest close rose ${snapshot.dailyChangePercent.toFixed(2)}% from the prior close.`)
  } else if (snapshot.dailyChangePercent < 0) {
    bearishReasons.push(`Latest close fell ${Math.abs(snapshot.dailyChangePercent).toFixed(2)}% from the prior close.`)
  }

  if (snapshot.fiveSessionChangePercent !== undefined) {
    if (snapshot.fiveSessionChangePercent > 0) {
      bullishReasons.push(`Five-session movement is positive at +${snapshot.fiveSessionChangePercent.toFixed(2)}%.`)
    } else if (snapshot.fiveSessionChangePercent < 0) {
      bearishReasons.push(`Five-session movement is negative at ${snapshot.fiveSessionChangePercent.toFixed(2)}%.`)
    }
  }

  const positiveHeadlines = relatedHeadlines.filter((headline) => positiveHeadlinePattern.test(headline))
  const negativeHeadlines = relatedHeadlines.filter((headline) => negativeHeadlinePattern.test(headline))
  if (positiveHeadlines.length) bullishReasons.push(`Potential positive headline catalyst: ${positiveHeadlines[0]}`)
  if (negativeHeadlines.length) bearishReasons.push(`Potential risk headline: ${negativeHeadlines[0]}`)
  if (!bullishReasons.length) bullishReasons.push('No positive price or matched-headline signal was found in the available data.')
  if (!bearishReasons.length) bearishReasons.push('No negative price or matched-headline signal was found in the available data; downside risk is still possible.')

  const upDay = snapshot.dailyChangePercent > 0
  const upWeek = (snapshot.fiveSessionChangePercent ?? 0) > 0
  const downDay = snapshot.dailyChangePercent < 0
  const downWeek = (snapshot.fiveSessionChangePercent ?? 0) < 0
  const signal = upDay && upWeek ? 'BULLISH_MOMENTUM' : downDay && downWeek ? 'BEARISH_MOMENTUM' : 'MIXED'
  const suggestion = signal === 'BULLISH_MOMENTUM'
    ? 'Momentum is positive. Consider further research on valuation, risk, and position sizing; this is not a personalized buy instruction.'
    : signal === 'BEARISH_MOMENTUM'
      ? 'Momentum is negative. Review downside risk and wait for evidence of stabilization; this is not a personalized sell instruction.'
      : 'Signals are mixed. Keep under review and wait for clearer confirmation before making an investment decision.'

  return { ...snapshot, signal, suggestion, bullishReasons, bearishReasons, relatedHeadlines }
}

async function fetchEquityHistory(candidate: EquityCandidate): Promise<DailyAssetSnapshot | undefined> {
  try {
    const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(candidate.yahooSymbol)}`)
    url.searchParams.set('range', '1mo')
    url.searchParams.set('interval', '1d')
    const response = await fetch(url, { signal: AbortSignal.timeout(12_000) })
    if (!response.ok) return undefined

    const payload = await response.json() as {
      chart?: { result?: Array<{ timestamp?: number[]; meta?: { currency?: string; exchangeName?: string }; indicators?: { quote?: Array<{ close?: Array<number | null> }> } }> }
    }
    const result = payload.chart?.result?.[0]
    const closes = result?.indicators?.quote?.[0]?.close ?? []
    const points = closes.map((close, index) => ({ close, timestamp: result?.timestamp?.[index] }))
      .filter((point): point is { close: number; timestamp: number } => Number.isFinite(point.close) && Number.isFinite(point.timestamp))
    if (points.length < 2) return undefined

    const latest = points[points.length - 1]
    const previous = points[points.length - 2]
    const fiveSessionsAgo = points[Math.max(0, points.length - 6)]
    return {
      id: candidate.symbol.toLowerCase(),
      name: candidate.name,
      assetType: 'equity',
      symbol: candidate.symbol,
      exchange: candidate.yahooSymbol.endsWith('.NS') ? 'NSE' : candidate.yahooSymbol.endsWith('.BO') ? 'BSE' : result?.meta?.exchangeName ?? 'NSE',
      price: latest.close,
      currency: result?.meta?.currency ?? 'INR',
      dailyChangePercent: percentChange(latest.close, previous.close),
      fiveSessionChangePercent: percentChange(latest.close, fiveSessionsAgo.close),
      asOf: new Date(latest.timestamp * 1000).toISOString(),
      source: 'Yahoo Finance',
      freshness: 'eod',
    }
  } catch {
    return undefined
  }
}

async function fetchFundNav(item: WatchlistItem): Promise<DailyAssetSnapshot | undefined> {
  if (!item.schemeCode) return undefined
  try {
    const response = await fetch(`https://api.mfapi.in/mf/${encodeURIComponent(item.schemeCode)}`, { signal: AbortSignal.timeout(12_000) })
    if (!response.ok) return undefined
    const payload = await response.json() as { meta?: { scheme_name?: string }; data?: Array<{ date?: string; nav?: string }> }
    const rows = (payload.data ?? []).map((row) => ({
      date: row.date ?? '',
      nav: Number(row.nav),
    })).filter((row) => row.date && Number.isFinite(row.nav))
    if (rows.length < 2) return undefined

    const latest = rows[0]
    const previous = rows[1]
    const [day, month, year] = latest.date.split('-')
    return {
      id: item.id,
      name: payload.meta?.scheme_name ?? item.name,
      assetType: 'mutual-fund',
      symbol: item.symbol,
      price: latest.nav,
      currency: 'INR',
      dailyChangePercent: percentChange(latest.nav, previous.nav),
      fiveSessionChangePercent: rows.length > 5 ? percentChange(latest.nav, rows[5].nav) : undefined,
      asOf: `${year}-${month}-${day}T10:00:00.000Z`,
      source: 'AMFI NAV via MFAPI.in',
      freshness: 'eod',
    }
  } catch {
    return undefined
  }
}

function matchingHeadlines(candidate: EquityCandidate, news: NewsArticle[]) {
  const terms = candidate.aliases.map((alias) => alias.toLowerCase())
  return news
    .filter((article) => terms.some((term) => `${article.headline} ${article.summary}`.toLowerCase().includes(term)))
    .map((article) => article.headline)
}

export async function getDailyMarketIntelligence(watchlist: WatchlistItem[], news: NewsArticle[]) {
  const equityByTicker = new Map<string, EquityCandidate>()
  for (const item of watchlist.filter((entry) => entry.assetType === 'equity')) {
    equityByTicker.set(item.id, {
      name: item.name,
      symbol: item.symbol.replace(/\.NS$|\.BO$/i, ''),
      yahooSymbol: item.symbol,
      aliases: [item.name, item.symbol.replace(/\.NS$|\.BO$/i, '')],
    })
  }

  const watchlistResults = await Promise.all(watchlist.map(async (item) => {
    const snapshot = item.assetType === 'mutual-fund'
      ? await fetchFundNav(item)
      : await fetchEquityHistory(equityByTicker.get(item.id)!)
    if (!snapshot) return undefined
    const candidate = equityByTicker.get(item.id)
    return assessDailyMovement(snapshot, candidate ? matchingHeadlines(candidate, news) : [])
  }))

  const topStockResults = await Promise.all(topEquityBasket.map(async (candidate) => {
    const snapshot = await fetchEquityHistory(candidate)
    return snapshot ? assessDailyMovement(snapshot, matchingHeadlines(candidate, news)) : undefined
  }))

  return {
    generatedAt: new Date().toISOString(),
    watchlist: watchlistResults.filter((assessment): assessment is DailyAssessment => Boolean(assessment)),
    topStocks: topStockResults
      .filter((assessment): assessment is DailyAssessment => Boolean(assessment))
      .sort((left, right) => Math.abs(right.dailyChangePercent) - Math.abs(left.dailyChangePercent)),
    topStockUniverse: 'NSE large-cap sample: Reliance, HDFC Bank, ICICI Bank, TCS, and Infosys',
    methodology: 'Signals compare the latest close with the prior close and five sessions earlier. Headlines are shown only when the company name matches; price direction does not prove a cause.',
  }
}