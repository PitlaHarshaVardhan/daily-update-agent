import { DailyReport, NewsArticle } from '../types'

export function deduplicateArticles(articles: NewsArticle[]) {
  const grouped: NewsArticle[] = []
  const indexes = new Map<string, number>()

  for (const article of articles) {
    const url = (article.canonicalUrl || article.url).toLowerCase().trim()
    const urlKey = url && url !== '#' ? `url:${url}` : undefined
    const headlineKey = `headline:${article.headline.toLowerCase().trim().replace(/\s+/g, ' ')}`
    const lengthScore = (article.summary?.length ?? 0) + (article.whyMatters?.length ?? 0)
    const existingIndex = (urlKey ? indexes.get(urlKey) : undefined) ?? indexes.get(headlineKey)

    if (existingIndex === undefined) {
      const newIndex = grouped.length
      grouped.push(article)
      if (urlKey) indexes.set(urlKey, newIndex)
      indexes.set(headlineKey, newIndex)
      continue
    }

    const existing = grouped[existingIndex]
    const currentScore = (existing.summary?.length ?? 0) + (existing.whyMatters?.length ?? 0)
    if (lengthScore > currentScore) {
      grouped[existingIndex] = article
    }
  }

  return grouped
}

export function rankStories(articles: NewsArticle[]) {
  return [...articles].sort((left, right) => {
    const leftScore = Number(left.relevance ?? 0) + (left.publishedAt && new Date(left.publishedAt).getTime() > Date.now() - 86400000 ? 2 : 0)
    const rightScore = Number(right.relevance ?? 0) + (right.publishedAt && new Date(right.publishedAt).getTime() > Date.now() - 86400000 ? 2 : 0)
    return rightScore - leftScore
  })
}

export function buildDailyReport(input: { headline: string; sections: Record<string, any[]> }) {
  return {
    title: input.headline,
    generatedAt: new Date().toISOString(),
    sections: input.sections,
  } as DailyReport
}
