export type StoryCategory = 'hyderabad' | 'telangana' | 'india' | 'world' | 'markets' | 'stock' | 'watchlist'

export interface NewsArticle {
  id: string
  headline: string
  source: string
  url: string
  canonicalUrl: string
  summary: string
  whyMatters: string
  category: StoryCategory
  publishedAt: string
  fetchedAt?: string
  relevance?: number
  location?: string
  verificationStatus?: 'verified' | 'partial' | 'unverified'
}

export interface DailyReport {
  id: string
  title: string
  generatedAt: string
  status: 'draft' | 'sent' | 'failed'
  sections: Record<string, NewsArticle[]>
}

export interface UserRecord {
  id: string
  email: string
  passwordHash: string
  role: 'owner' | 'user'
  createdAt: string
}

export interface StockSnapshot {
  symbol: string
  exchange: string
  instrument?: string
  value: number
  change: number
  percentChange: number
  timestamp: string
  source: string
  status: 'live' | 'delayed' | 'eod'
}

export interface WatchlistItem {
  id: string
  name: string
  assetType: 'equity' | 'mutual-fund'
  symbol: string
  exchange?: string
  schemeCode?: string
}

export interface DailyAssetSnapshot {
  id: string
  name: string
  assetType: 'equity' | 'mutual-fund'
  symbol: string
  exchange?: string
  price: number
  currency: string
  dailyChangePercent: number
  fiveSessionChangePercent?: number
  asOf: string
  source: string
  freshness: 'eod' | 'delayed'
}

export interface DailyAssessment extends DailyAssetSnapshot {
  signal: 'BULLISH_MOMENTUM' | 'BEARISH_MOMENTUM' | 'MIXED'
  suggestion: string
  bullishReasons: string[]
  bearishReasons: string[]
  relatedHeadlines: string[]
}
