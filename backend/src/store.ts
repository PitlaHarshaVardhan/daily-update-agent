import fs from 'fs'
import path from 'path'
import { DailyReport, NewsArticle, StockSnapshot, UserRecord, WatchlistItem } from './types'

export interface StoreShape {
  users: UserRecord[]
  news: NewsArticle[]
  reports: DailyReport[]
  marketSnapshots: StockSnapshot[]
  watchlist: WatchlistItem[]
}

const defaultStore: StoreShape = {
  users: [],
  news: [
    {
      id: 'news-1',
      headline: 'Hyderabad metro track expansion gets city review',
      source: 'State Portal',
      url: 'https://example.com/metroroute',
      canonicalUrl: 'https://example.com/metroroute',
      summary: 'Officials reviewed metro expansion corridors and commuter demand forecasts for the next phase.',
      whyMatters: 'This affects commute times, road load, and urban mobility across Hyderabad.',
      category: 'telangana',
      publishedAt: '2026-10-10T08:40:00+05:30',
      relevance: 9,
      location: 'Hyderabad',
      verificationStatus: 'verified',
    },
    {
      id: 'news-2',
      headline: 'India manufacturing capacity improves despite global volatility',
      source: 'Economic Times',
      url: 'https://example.com/india-manufacturing',
      canonicalUrl: 'https://example.com/india-manufacturing',
      summary: 'Industrial output remains resilient as demand and export orders improve modestly.',
      whyMatters: 'It signals soft but positive momentum for capital spending and employment.',
      category: 'india',
      publishedAt: '2026-10-10T08:10:00+05:30',
      relevance: 8,
      location: 'India',
      verificationStatus: 'partial',
    },
    {
      id: 'news-3',
      headline: 'NIFTY 50 holds firm in early trade',
      source: 'Market Desk',
      url: 'https://example.com/nifty-open',
      canonicalUrl: 'https://example.com/nifty-open',
      summary: 'Gains in financials offset weakness in IT and commodity counters.',
      whyMatters: 'Market breadth matters more than index direction for traders and long-term investors.',
      category: 'markets',
      publishedAt: '2026-10-10T09:20:00+05:30',
      relevance: 7,
      location: 'India',
      verificationStatus: 'verified',
    },
  ],
  reports: [],
  marketSnapshots: [
    { symbol: 'NIFTY 50', exchange: 'NSE', value: 24842.3, change: 88.4, percentChange: 0.36, timestamp: '2026-10-10T09:30:00+05:30', source: 'Demo Market Provider', status: 'live' },
    { symbol: 'SENSEX', exchange: 'BSE', value: 81422.1, change: 286.7, percentChange: 0.35, timestamp: '2026-10-10T09:30:00+05:30', source: 'Demo Market Provider', status: 'delayed' },
  ],
  watchlist: [
    { id: 'lalithaa-jewellery', name: 'Lalithaa Jewellery Mart Ltd', assetType: 'equity', symbol: 'LALITHAA.NS', exchange: 'NSE' },
    { id: 'uti-nifty-50-direct-growth', name: 'UTI Nifty 50 Index Fund - Direct Plan - Growth', assetType: 'mutual-fund', symbol: 'UTI Nifty 50 Index Fund', schemeCode: '120716' },
  ],
}

const backendRoot = path.basename(path.dirname(__dirname)) === 'dist'
  ? path.resolve(__dirname, '../..')
  : path.resolve(__dirname, '..')
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(backendRoot, 'data')
const dataFile = path.join(dataDir, 'demo-db.json')

export function readStore(): StoreShape {
  try {
    if (!fs.existsSync(dataFile)) {
      fs.mkdirSync(dataDir, { recursive: true })
      fs.writeFileSync(dataFile, JSON.stringify(defaultStore, null, 2), 'utf8')
    }
    const raw = fs.readFileSync(dataFile, 'utf8')
    const parsed = JSON.parse(raw)
    return { ...defaultStore, ...parsed }
  } catch (error) {
    return defaultStore
  }
}

export function writeStore(value: StoreShape) {
  fs.mkdirSync(dataDir, { recursive: true })
  fs.writeFileSync(dataFile, JSON.stringify(value, null, 2), 'utf8')
}
