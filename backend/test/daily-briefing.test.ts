import { describe, expect, it } from 'vitest'
import { formatDailyBriefing, formatDailyBriefingHtml, splitMessageIntoChunks } from '../src/lib/daily-briefing'
import { DailyBriefingData } from '../src/lib/daily-briefing'

const briefing: DailyBriefingData = {
  generatedAt: '2026-10-10T01:30:00.000Z',
  newsSource: 'newsapi',
  stories: [
    { id: 'hyd-1', headline: 'Hyderabad metro update', source: 'Local News', url: 'https://example.com/hyd', canonicalUrl: 'https://example.com/hyd', summary: 'Hyderabad transport project update.', whyMatters: 'Local commute impact.', category: 'hyderabad', publishedAt: '2026-10-09T10:00:00Z' },
    { id: 'tel-1', headline: 'Telangana policy update', source: 'State News', url: 'https://example.com/tel', canonicalUrl: 'https://example.com/tel', summary: 'State policy coverage.', whyMatters: 'State impact.', category: 'telangana', publishedAt: '2026-10-09T10:00:00Z' },
    { id: 'ind-1', headline: 'India market update', source: 'National News', url: 'https://example.com/ind', canonicalUrl: 'https://example.com/ind', summary: 'National market coverage.', whyMatters: 'Market impact.', category: 'india', publishedAt: '2026-10-09T10:00:00Z' },
  ],
  marketSource: 'alphavantage',
  marketSnapshots: [{ symbol: 'NIFTYBEES', exchange: 'BSE', instrument: 'ETF proxy', value: 257.2, change: 3.35, percentChange: 1.32, timestamp: '2026-10-09T10:00:00.000Z', source: 'Alpha Vantage', status: 'eod' }],
  watchlist: [],
  topStocks: [],
  topStockUniverse: 'NSE sample',
  methodology: 'Daily and five-session price movements.',
}

describe('daily briefing formatting', () => {
  it('includes each regional news section, market quotes, and analysis headings', () => {
    const message = formatDailyBriefing(briefing, 'Asia/Kolkata')

    expect(message).toContain('HYDERABAD NEWS (1)')
    expect(message).toContain('TELANGANA NEWS (1)')
    expect(message).toContain('INDIA NEWS (1)')
    expect(message).toContain('Hyderabad transport project update.')
    expect(message).toContain('NIFTYBEES (ETF proxy) BSE')
    expect(message).toContain('WATCHLIST (0)')
    expect(message).toContain('TOP STOCKS (NSE sample)')
  })

  it('renders the branded HTML layout and escapes provider-supplied headlines', () => {
    const assessment = {
      id: 'lalithaa',
      name: 'Lalithaa Jewellery Mart',
      assetType: 'equity' as const,
      symbol: 'LALITHAA',
      exchange: 'NSE',
      price: 382.6,
      currency: 'INR',
      dailyChangePercent: 1.6,
      fiveSessionChangePercent: -1.3,
      asOf: '2026-10-09T10:00:00.000Z',
      source: 'Yahoo Finance',
      freshness: 'eod' as const,
      signal: 'MIXED' as const,
      suggestion: 'Wait for clearer direction.',
      bullishReasons: ['The latest close rose.'],
      bearishReasons: ['The five-session move is negative.'],
      relatedHeadlines: [],
    }
    const testBriefing = {
      ...briefing,
      stories: [...briefing.stories, {
        id: 'untrusted',
        headline: '<img src=x onerror=alert(1)>',
        source: 'Provider',
        url: 'javascript:alert(1)',
        canonicalUrl: 'javascript:alert(1)',
        summary: 'Safe text.',
        whyMatters: 'A test headline.',
        category: 'india' as const,
        publishedAt: '2026-10-09T10:00:00Z',
      }],
      watchlist: [assessment],
    }
    const html = formatDailyBriefingHtml(testBriefing, 'Asia/Kolkata')
    const text = formatDailyBriefing(testBriefing, 'Asia/Kolkata')

    expect(html).toContain('background:#0f172a')
    expect(html).toContain('Hyderabad · 1 stories')
    expect(html).toContain('Your watchlist')
    expect(html).toContain('Decision today: WAIT.')
    expect(html).toContain('Bullish factors')
    expect(html).toContain('Bearish factors')
    expect(html.indexOf('Top trending news')).toBeLessThan(html.indexOf('Market close'))
    expect(text).toContain('TOP TRENDING NEWS')
    expect(text).toContain('Decision today: WAIT.')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('href="javascript:')
  })
})

describe('splitMessageIntoChunks', () => {
  it('keeps every part within the limit and preserves long unbroken text', () => {
    const message = `${'a'.repeat(95)}\n\n${'b'.repeat(85)}`
    const chunks = splitMessageIntoChunks(message, 20)

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.length <= 20)).toBe(true)
    expect(chunks.join('').replace(/\n/g, '')).toBe('a'.repeat(95) + 'b'.repeat(85))
  })
})