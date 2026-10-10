import { describe, it, expect } from 'vitest'
import { deduplicateArticles, rankStories, buildDailyReport } from '../src/lib/news'

describe('deduplicateArticles', () => {
  it('removes repeated headlines while keeping the more complete entry', () => {
    const articles = [
      {
        id: 'a1',
        headline: 'Hyderabad metro expansion approved',
        source: 'The Hindu',
        url: 'https://example.com/metro-1',
        canonicalUrl: 'https://example.com/metro-1',
        category: 'telangana',
        summary: 'Metro expansion approved.',
        whyMatters: 'Affects commuters.',
        publishedAt: '2026-10-10T09:00:00+05:30',
      },
      {
        id: 'a2',
        headline: 'Hyderabad metro expansion approved',
        source: 'Times of India',
        url: 'https://example.com/metro-2',
        canonicalUrl: 'https://example.com/metro-1',
        category: 'telangana',
        summary: 'Metro expansion approved and traffic relief expected.',
        whyMatters: 'Benefits daily commuters.',
        publishedAt: '2026-10-10T09:15:00+05:30',
      },
    ]

    const result = deduplicateArticles(articles as any)
    expect(result).toHaveLength(1)
    expect(result[0].summary).toContain('traffic relief')
  })

  it('removes syndicated copies with matching headlines and different URLs', () => {
    const articles = [
      {
        id: 'wire-1',
        headline: 'India market update: stocks rise',
        source: 'Publisher One',
        url: 'https://one.example.com/story',
        canonicalUrl: 'https://one.example.com/story',
        category: 'india',
        summary: 'Markets advanced.',
        whyMatters: 'Investors reacted.',
        publishedAt: '2026-10-10T09:00:00Z',
      },
      {
        id: 'wire-2',
        headline: 'India market update: stocks rise',
        source: 'Publisher Two',
        url: 'https://two.example.com/story',
        canonicalUrl: 'https://two.example.com/story',
        category: 'india',
        summary: 'Markets advanced.',
        whyMatters: 'Investors reacted.',
        publishedAt: '2026-10-10T09:05:00Z',
      },
    ]

    expect(deduplicateArticles(articles as any)).toHaveLength(1)
  })
})

describe('rankStories', () => {
  it('prioritizes more important and recent stories', () => {
    const articles = [
      {
        id: 'low',
        headline: 'Local market update',
        category: 'market',
        summary: 'Small move.',
        whyMatters: 'Low relevance.',
        publishedAt: '2026-10-09T10:00:00+05:30',
        source: 'Example Daily',
        relevance: 1,
      },
      {
        id: 'high',
        headline: 'State budget review announced',
        category: 'telangana',
        summary: 'The state budget revision is likely to affect spending.',
        whyMatters: 'Directly impacts public services and infrastructure.',
        publishedAt: '2026-10-10T08:30:00+05:30',
        source: 'State Gazette',
        relevance: 9,
      },
    ]

    const ranked = rankStories(articles as any)
    expect(ranked[0].id).toBe('high')
  })
})

describe('buildDailyReport', () => {
  it('creates a structured report with expected sections and source links', () => {
    const report = buildDailyReport({
      headline: 'Daily Intelligence',
      sections: {
        telangana: [{ headline: 'Government scheme launch', source: 'State portal', url: 'https://example.com/scheme', summary: 'Launch of a subsidy scheme.', whyMatters: 'Helps citizens.' }],
        india: [{ headline: 'India growth outlook', source: 'Reuters', url: 'https://example.com/india-growth', summary: 'Economy remains stable.', whyMatters: 'Affects policy.' }],
      },
    } as any)

    expect(report.title).toBe('Daily Intelligence')
    expect(report.sections.telangana).toHaveLength(1)
    expect(report.sections.telangana[0].url).toContain('example.com')
  })
})
