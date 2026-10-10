import nodemailer from 'nodemailer'
import mongoose from 'mongoose'
import Parser from 'rss-parser'
import { NewsArticle, StockSnapshot, StoryCategory } from '../types'
import { splitMessageIntoChunks } from './daily-briefing'

const rssParser = new Parser()
let marketCache: { expiresAt: number; source: string; snapshots: StockSnapshot[] } | undefined
let marketInFlight: Promise<{ source: string; snapshots: StockSnapshot[] }> | undefined
let newsCache: { expiresAt: number; result: { source: string; articles: NewsArticle[] } } | undefined

export async function connectMongo() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    return { enabled: false, status: 'not-configured' as const }
  }

  try {
    await mongoose.connect(uri)
    return { enabled: true, status: 'connected' as const }
  } catch (error) {
    return { enabled: true, status: 'error' as const, error: error instanceof Error ? error.message : 'unknown' }
  }
}

export async function fetchNewsFromApi() {
  const apiKey = process.env.NEWS_API_KEY?.trim()
  if (newsCache && newsCache.expiresAt > Date.now()) {
    return newsCache.result
  }

  const queries: Array<{ term: string; category: StoryCategory; matcher: RegExp; location: string }> = [
    { term: 'Hyderabad', category: 'hyderabad', matcher: /hyderabad/i, location: 'Hyderabad' },
    { term: 'Telangana', category: 'telangana', matcher: /telangana/i, location: 'Telangana' },
    { term: 'India', category: 'india', matcher: /\bindia\b|\bindian\b/i, location: 'India' },
  ]

  const results = apiKey ? await Promise.all(queries.map(async (query) => {
    try {
      const url = new URL('https://newsapi.org/v2/everything')
      url.searchParams.set('q', query.term)
      url.searchParams.set('sortBy', 'publishedAt')
      url.searchParams.set('pageSize', '50')
      url.searchParams.set('language', 'en')
      const response = await fetch(url, { headers: { 'X-Api-Key': apiKey }, signal: AbortSignal.timeout(10_000) })
      if (!response.ok) return []

      const payload = (await response.json()) as {
        articles?: Array<{ title?: string; url?: string; source?: { name?: string }; publishedAt?: string; description?: string; content?: string }>
      }
      return (payload.articles ?? [])
        .filter((article) => query.matcher.test(`${article.title ?? ''} ${article.description ?? ''}`))
        .slice(0, 6)
        .map((article, index): NewsArticle => ({
          id: `live-${query.category}-${Date.now()}-${index}`,
          headline: article.title ?? 'Untitled story',
          source: article.source?.name ?? 'News API',
          url: article.url ?? '#',
          canonicalUrl: article.url ?? article.title ?? '#',
          summary: article.description ?? article.content ?? 'Summary unavailable.',
          whyMatters: `Recent ${query.location} coverage from the configured news provider.`,
          category: query.category,
          publishedAt: article.publishedAt ?? new Date().toISOString(),
          fetchedAt: new Date().toISOString(),
          relevance: query.category === 'india' ? 7 : 9,
          location: query.location,
          verificationStatus: 'partial',
        }))
    } catch {
      return []
    }
  })) : []

  const uniqueArticles = new Map<string, NewsArticle>()
  for (const article of results.flat()) {
    const key = (article.canonicalUrl || article.url || article.headline).toLowerCase().trim()
    if (!uniqueArticles.has(key)) uniqueArticles.set(key, article)
  }

  let articles = Array.from(uniqueArticles.values())
  let source = articles.length ? 'newsapi' : 'google-news-rss'
  if (!articles.length) {
    articles = await fetchGoogleNewsRss(queries)
  }
  const result = { source, articles }
  newsCache = { expiresAt: Date.now() + 5 * 60 * 1000, result }
  return result
}

async function fetchGoogleNewsRss(queries: Array<{ term: string; category: StoryCategory; matcher: RegExp; location: string }>) {
  const results = await Promise.all(queries.map(async (query) => {
    try {
      const url = new URL('https://news.google.com/rss/search')
      url.searchParams.set('q', `${query.term} when:7d`)
      url.searchParams.set('hl', 'en-IN')
      url.searchParams.set('gl', 'IN')
      url.searchParams.set('ceid', 'IN:en')
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
      if (!response.ok) return []

      const feed = await rssParser.parseString(await response.text())
      return feed.items
        .filter((item) => query.matcher.test(`${item.title ?? ''} ${item.contentSnippet ?? ''}`))
        .slice(0, 6)
        .map((item, index): NewsArticle => {
          const title = item.title?.trim() ?? 'Untitled story'
          const separator = title.lastIndexOf(' - ')
          const parsedDate = item.pubDate ? new Date(item.pubDate) : undefined
          const publishedAt = item.isoDate ?? (parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : new Date().toISOString())
          return {
            id: `rss-${query.category}-${Date.now()}-${index}`,
            headline: separator > 0 ? title.slice(0, separator) : title,
            source: separator > 0 ? title.slice(separator + 3) : 'Google News RSS',
            url: item.link ?? '#',
            canonicalUrl: item.link ?? title,
            summary: item.contentSnippet ?? 'Summary unavailable.',
            whyMatters: `Recent ${query.location} coverage from Google News RSS.`,
            category: query.category,
            publishedAt,
            fetchedAt: new Date().toISOString(),
            relevance: query.category === 'india' ? 7 : 9,
            location: query.location,
            verificationStatus: 'partial',
          }
        })
    } catch {
      return []
    }
  }))
  const uniqueArticles = new Map<string, NewsArticle>()
  for (const article of results.flat()) {
    const key = (article.canonicalUrl || article.url || article.headline).toLowerCase().trim()
    if (!uniqueArticles.has(key)) uniqueArticles.set(key, article)
  }
  return Array.from(uniqueArticles.values())
}

export async function fetchMarketFromApi() {
  const provider = process.env.MARKET_DATA_PROVIDER?.trim().toLowerCase()
  const apiKey = process.env.MARKET_DATA_API_KEY?.trim()

  if (marketCache && marketCache.expiresAt > Date.now()) {
    return { source: marketCache.source, snapshots: marketCache.snapshots }
  }

  const instruments = [
    { providerSymbol: 'NIFTYBEES.BSE', symbol: 'NIFTYBEES', exchange: 'BSE', instrument: 'Broad-market ETF proxy' },
    { providerSymbol: 'INFY.BSE', symbol: 'INFY', exchange: 'BSE', instrument: 'Selected equity' },
  ]
  if (marketInFlight) return marketInFlight

  const request = (async () => {
    const snapshots: StockSnapshot[] = []
    if (provider === 'alphavantage' && apiKey) {
      for (const [index, instrument] of instruments.entries()) {
        if (index > 0) await new Promise<void>((resolve) => setTimeout(resolve, 1100))
        try {
          const url = new URL('https://www.alphavantage.co/query')
          url.searchParams.set('function', 'GLOBAL_QUOTE')
          url.searchParams.set('symbol', instrument.providerSymbol)
          url.searchParams.set('apikey', apiKey)
          const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
          if (!response.ok) continue

          const payload = (await response.json()) as { 'Global Quote'?: Record<string, string> }
          const quote = payload['Global Quote']
          if (!quote?.['05. price']) continue

          const tradingDay = quote['07. latest trading day'] ?? new Date().toISOString().slice(0, 10)
          snapshots.push({
            symbol: instrument.symbol,
            exchange: instrument.exchange,
            instrument: instrument.instrument,
            value: Number(quote['05. price']),
            change: Number(quote['09. change'] ?? 0),
            percentChange: Number.parseFloat(quote['10. change percent'] ?? '0'),
            timestamp: `${tradingDay}T10:00:00.000Z`,
            source: 'Alpha Vantage',
            status: tradingDay < new Date().toISOString().slice(0, 10) ? 'eod' : 'delayed',
          })
        } catch {
          continue
        }
      }
    }

    if (snapshots.length) {
      marketCache = { expiresAt: Date.now() + 15 * 60 * 1000, source: 'alphavantage', snapshots }
      return { source: 'alphavantage', snapshots }
    }

    const yahooInstruments = [
      { yahooSymbol: 'NIFTYBEES.NS', symbol: 'NIFTYBEES', exchange: 'NSE', instrument: 'Broad-market ETF proxy' },
      { yahooSymbol: 'INFY.NS', symbol: 'INFY', exchange: 'NSE', instrument: 'Selected equity' },
    ]
    const yahooSnapshots = await Promise.all(yahooInstruments.map(async (instrument) => {
      try {
        const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(instrument.yahooSymbol)}`)
        url.searchParams.set('range', '5d')
        url.searchParams.set('interval', '1d')
        const response = await fetch(url, { signal: AbortSignal.timeout(12_000) })
        if (!response.ok) return undefined

        const payload = await response.json() as {
          chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ close?: Array<number | null> }> } }> }
        }
        const result = payload.chart?.result?.[0]
        const closes = result?.indicators?.quote?.[0]?.close ?? []
        const points = closes.map((close, index) => ({ close, timestamp: result?.timestamp?.[index] }))
          .filter((point): point is { close: number; timestamp: number } => Number.isFinite(point.close) && Number.isFinite(point.timestamp))
        if (points.length < 2) return undefined

        const latest = points[points.length - 1]
        const previous = points[points.length - 2]
        return {
          symbol: instrument.symbol,
          exchange: instrument.exchange,
          instrument: instrument.instrument,
          value: latest.close,
          change: latest.close - previous.close,
          percentChange: ((latest.close - previous.close) / previous.close) * 100,
          timestamp: new Date(latest.timestamp * 1000).toISOString(),
          source: 'Yahoo Finance',
          status: 'eod' as const,
        }
      } catch {
        return undefined
      }
    }))
    const liveSnapshots = yahooSnapshots.filter((snapshot): snapshot is NonNullable<typeof snapshot> => snapshot !== undefined)
    if (!liveSnapshots.length) return { source: 'unavailable', snapshots: [] }
    marketCache = { expiresAt: Date.now() + 15 * 60 * 1000, source: 'yahoo-finance', snapshots: liveSnapshots }
    return { source: 'yahoo-finance', snapshots: liveSnapshots }
  })()
  marketInFlight = request

  try {
    return await request
  } finally {
    marketInFlight = undefined
  }
}

export async function generateAiSummary(text: string) {
  const apiKey = process.env.AI_API_KEY
  const model = process.env.AI_MODEL ?? 'gemini-3.8-flash'
  if (!apiKey) {
    return { status: 'not-configured' as const, summary: `Summary unavailable. Source text length: ${text.length}.` }
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Summarize the following daily briefing in plain English with 3 bullets. Focus on what happened, why it matters, and what happens next.\n\n${text}` }] }],
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`Gemini responded with ${response.status}`)
    }

    const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const summary = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join(' ') ?? 'Summary generated from source material.'
    return { status: 'ok' as const, summary }
  } catch (error) {
    return { status: 'fallback' as const, summary: `Summary generated from source material. A configured AI provider was unavailable, so this entry used the local fallback summarizer.` }
  }
}

export async function sendEmailMessage(subject: string, text: string, html?: string) {
  const host = process.env.SMTP_HOST?.trim()
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, '')
  const recipient = process.env.SMTP_TO?.trim() || user

  if (!host || !user || !pass) {
    return { status: 'not-configured' as const, message: 'Email provider not configured.' }
  }

  try {
    const port = Number(process.env.SMTP_PORT ?? 587)
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    })

    const info = await transporter.sendMail({
      from: user,
      to: recipient,
      subject,
      text,
      ...(html ? { html } : {}),
    })

    return { status: 'sent' as const, message: 'Email sent successfully.', messageId: info.messageId, recipient }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Email delivery failed.'
    const message = /EAUTH|535|invalid login/i.test(detail)
      ? 'SMTP authentication failed. For Gmail, use a valid Google App Password in SMTP_PASS; the regular account password will not work.'
      : detail
    return { status: 'error' as const, message }
  }
}

export function sendEmailTest() {
  return sendEmailMessage('Daily Intelligence test email', 'Daily Intelligence test email sent successfully.')
}

export async function sendTelegramMessage(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId || chatId === 'replace-with-chat-id') {
    return { status: 'not-configured' as const, message: 'Telegram bot token or chat ID is not configured.' }
  }

  const chunks = splitMessageIntoChunks(message)
  const messageIds: number[] = []
  try {
    for (const [index, chunk] of chunks.entries()) {
      if (index > 0) await new Promise<void>((resolve) => setTimeout(resolve, 1100))
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({ chat_id: chatId, text: chunk }),
      })
      const payload = await response.json() as { ok?: boolean; description?: string; result?: { message_id?: number } }
      if (!response.ok || !payload.ok) {
        throw new Error(payload.description ?? `Telegram rejected message ${index + 1} of ${chunks.length}.`)
      }
      if (payload.result?.message_id) messageIds.push(payload.result.message_id)
    }

    return {
      status: 'sent' as const,
      message: `Complete briefing sent in ${chunks.length} Telegram message${chunks.length === 1 ? '' : 's'}.`,
      data: { messageIds, chunksSent: chunks.length },
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Telegram message failed.'
    return { status: 'error' as const, message: `Telegram sent ${messageIds.length} of ${chunks.length} messages before failure: ${detail}` }
  }
}

export function sendTelegramTest() {
  return sendTelegramMessage('Daily Intelligence test message from the local app.')
}
