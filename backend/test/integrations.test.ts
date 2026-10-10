import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('production data providers', () => {
  it('uses Google News RSS when no NewsAPI key is configured', async () => {
    vi.stubEnv('NEWS_API_KEY', '')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '<rss version="2.0"><channel><item><title>Hyderabad metro expands - Local News</title><link>https://example.com/metro</link><pubDate>Fri, 09 Oct 2026 12:00:00 GMT</pubDate><description>Hyderabad transit coverage.</description></item></channel></rss>',
    }))
    const { fetchNewsFromApi } = await import('../src/lib/integrations')

    const result = await fetchNewsFromApi()

    expect(result.source).toBe('google-news-rss')
    expect(result.articles).toHaveLength(1)
    expect(result.articles[0]).toMatchObject({
      headline: 'Hyderabad metro expands',
      source: 'Local News',
      url: 'https://example.com/metro',
    })
  })

  it('uses Yahoo Finance quotes when Alpha Vantage is not configured', async () => {
    vi.stubEnv('MARKET_DATA_PROVIDER', '')
    vi.stubEnv('MARKET_DATA_API_KEY', '')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        chart: { result: [{
          timestamp: [1791532800, 1791619200],
          indicators: { quote: [{ close: [250, 252] }] },
        }] },
      }),
    }))
    const { fetchMarketFromApi } = await import('../src/lib/integrations')

    const result = await fetchMarketFromApi()

    expect(result.source).toBe('yahoo-finance')
    expect(result.snapshots).toHaveLength(2)
    expect(result.snapshots[0]).toMatchObject({
      symbol: 'NIFTYBEES',
      value: 252,
      change: 2,
      percentChange: 0.8,
      source: 'Yahoo Finance',
      status: 'eod',
    })
  })
})