import express, { NextFunction, Request, Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import cron from 'node-cron'
import fs from 'fs'
import path from 'path'
import { config } from './config'

declare global {
  namespace Express {
    interface Request {
      user?: { email: string }
    }
  }
}
import { buildDailyReport, deduplicateArticles, rankStories } from './lib/news'
import { formatDailyBriefing, formatDailyBriefingHtml } from './lib/daily-briefing'
import { getDailyMarketIntelligence } from './lib/market-intelligence'
import { normalizeMarketSnapshot } from './lib/market'
import { pickStockOfDay } from './lib/stock'
import { connectMongo, fetchMarketFromApi, fetchNewsFromApi, generateAiSummary, sendEmailMessage, sendEmailTest, sendTelegramMessage, sendTelegramTest } from './lib/integrations'
import { readStore, writeStore } from './store'

const app = express()

app.use(helmet())
app.use(
  cors({
    origin: config.allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
)
app.use(express.json({ limit: '1mb' }))
app.use(morgan('combined'))

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api/', limiter)

function createToken(email: string) {
  return jwt.sign({ email }, config.jwtSecret, { expiresIn: '7d' })
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization ?? ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!bearer) {
    return res.status(401).json({ success: false, error: 'Authentication required.' })
  }

  try {
    const decoded = jwt.verify(bearer, config.jwtSecret) as { email: string }
    req.user = { email: decoded.email }
    return next()
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token.' })
  }
}

async function buildDailyDigest() {
  const store = readStore()
  const [liveNews, liveMarket] = await Promise.all([fetchNewsFromApi(), fetchMarketFromApi()])
  const stories = rankStories(deduplicateArticles(liveNews.articles.length ? liveNews.articles : store.news))
  const analysis = await getDailyMarketIntelligence(store.watchlist ?? [], liveNews.articles)
  const marketSnapshots = liveMarket.snapshots.length ? liveMarket.snapshots : store.marketSnapshots
  const briefingData = {
    generatedAt: analysis.generatedAt,
    newsSource: liveNews.articles.length ? liveNews.source : 'demo-news',
    stories,
    marketSource: liveMarket.snapshots.length ? liveMarket.source : 'demo-market fallback',
    marketSnapshots,
    watchlist: analysis.watchlist,
    topStocks: analysis.topStocks,
    topStockUniverse: analysis.topStockUniverse,
    methodology: analysis.methodology,
  }
  const message = formatDailyBriefing(briefingData, config.schedulerTimezone)
  const html = formatDailyBriefingHtml(briefingData, config.schedulerTimezone)
  return { analysis, message, html, storyCount: stories.length, marketCount: marketSnapshots.length }
}

async function buildMarketIntelligence() {
  const store = readStore()
  const news = await fetchNewsFromApi()
  return getDailyMarketIntelligence(store.watchlist ?? [], news.articles)
}

async function runDailyDelivery() {
  const { analysis, message, html, storyCount, marketCount } = await buildDailyDigest()
  const [email, telegram] = await Promise.all([
    sendEmailMessage('Daily India market and watchlist review', message, html),
    sendTelegramMessage(message),
  ])
  return {
    generatedAt: analysis.generatedAt,
    contentCounts: { stories: storyCount, marketQuotes: marketCount, watchlistAssets: analysis.watchlist.length, topStocks: analysis.topStocks.length },
    analysis,
    delivery: { email, telegram },
  }
}

app.get('/api/health', async (_req, res) => {
  const mongoStatus = await connectMongo()
  res.json({
    success: true,
    data: {
      status: 'ok',
      app: config.appName,
      timestamp: new Date().toISOString(),
      dailySchedule: { cron: config.dailyReportCron, timezone: config.schedulerTimezone },
      providers: {
        news: config.newsEnabled ? 'configured' : 'demo',
        ai: config.aiEnabled ? 'configured' : 'demo',
        mongo: mongoStatus.status,
        email: process.env.SMTP_USER ? 'configured' : 'demo',
        telegram: config.telegramEnabled ? 'configured' : 'demo',
      },
    },
  })
})

app.post('/api/auth/register', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')

  if (!email || password.length < 6) {
    return res.status(400).json({ success: false, error: 'Provide a valid email and a password with at least 6 characters.' })
  }

  const store = readStore()
  if (store.users.some((user) => user.email === email)) {
    return res.status(409).json({ success: false, error: 'A user with that email already exists.' })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const newUser: { id: string; email: string; passwordHash: string; role: 'owner'; createdAt: string } = {
    id: `user-${Date.now()}`,
    email,
    passwordHash,
    role: 'owner',
    createdAt: new Date().toISOString(),
  }

  store.users.push(newUser)
  writeStore(store)

  return res.status(201).json({ success: true, data: { token: createToken(email), user: { id: newUser.id, email } } })
})

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')

  const user = readStore().users.find((entry) => entry.email === email)
  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid credentials.' })
  }

  const isValid = await bcrypt.compare(password, user.passwordHash)
  if (!isValid) {
    return res.status(401).json({ success: false, error: 'Invalid credentials.' })
  }

  return res.json({ success: true, data: { token: createToken(email), user: { id: user.id, email } } })
})

app.get('/api/dashboard', requireAuth, (_req, res) => {
  const store = readStore()
  const dashboardData = {
    lastReport: store.reports.length ? store.reports[store.reports.length - 1].generatedAt : new Date().toISOString(),
    nextScheduledRun: '2026-10-10T07:00:00+05:30',
    newStories: store.news.length,
    sourceHealth: 'stable',
    marketFreshness: 'live',
    watchlistAlerts: 2,
    reportHistory: store.reports.length,
  }

  res.json({ success: true, data: dashboardData })
})

app.get('/api/news', async (_req, res) => {
  const live = await fetchNewsFromApi()
  const storeArticles = readStore().news
  const articles = rankStories(deduplicateArticles(live.articles.length ? live.articles : storeArticles))
  res.json({
    success: true,
    data: articles.slice(0, 20),
    source: live.articles.length ? live.source : 'demo-news',
    counts: {
      hyderabad: articles.filter((article) => article.category === 'hyderabad').length,
      telangana: articles.filter((article) => article.category === 'telangana').length,
      india: articles.filter((article) => article.category === 'india').length,
    },
  })
})

app.get('/api/market', async (_req, res) => {
  const live = await fetchMarketFromApi()
  const snapshots = live.snapshots.length ? live.snapshots : readStore().marketSnapshots
  const market = snapshots.map(normalizeMarketSnapshot)
  res.json({ success: true, data: market, source: live.source })
})

app.get('/api/stock-of-day', async (_req, res) => {
  const symbol = 'INFY'
  const marketData = await fetchMarketFromApi()
  const marketQuote = marketData.snapshots.find((snapshot) => snapshot.symbol === symbol)
  const payload = pickStockOfDay([
    { symbol, score: 82, reason: 'Strong cash generation and resilient demand profile.' },
    { symbol: 'TCS', score: 76, reason: 'Client concentration and decent dividend quality.' },
  ])
  res.json({ success: true, data: { ...payload, symbol, source: 'demo research', marketQuote, marketSource: marketData.source } })
})

app.get('/api/watchlist', requireAuth, async (_req, res) => {
  const analysis = await buildMarketIntelligence()
  res.json({ success: true, data: analysis })
})

app.get('/api/daily-analysis', requireAuth, async (_req, res) => {
  const analysis = await buildMarketIntelligence()
  res.json({ success: true, data: { ...analysis, schedule: { cron: config.dailyReportCron, timezone: config.schedulerTimezone } } })
})

app.post('/api/daily-analysis/send', requireAuth, async (_req, res) => {
  const result = await runDailyDelivery()
  const success = result.delivery.email.status === 'sent' && result.delivery.telegram.status === 'sent'
  res.status(success ? 200 : 502).json({ success, data: result })
})

app.get('/api/reports/history', (_req, res) => {
  res.json({ success: true, data: readStore().reports })
})

app.post('/api/reports/generate', requireAuth, async (req, res) => {
  const input = req.body ?? {}
  const baseStories = readStore().news
  const liveNews = await fetchNewsFromApi()
  const stories = rankStories(deduplicateArticles(liveNews.articles.length ? liveNews.articles : baseStories))
  const liveMarket = await fetchMarketFromApi()
  const marketSnapshots = liveMarket.snapshots.length ? liveMarket.snapshots : readStore().marketSnapshots
  const sections = input.sections ?? {
    hyderabad: stories.filter((entry) => entry.category === 'hyderabad'),
    telangana: stories.filter((entry) => entry.category === 'telangana'),
    india: stories.filter((entry) => entry.category === 'india'),
    world: stories.filter((entry) => entry.category === 'world'),
    markets: marketSnapshots,
  }

  const aiSummary = await generateAiSummary(JSON.stringify(stories.slice(0, 3)))
  const report = buildDailyReport({ headline: 'Daily Intelligence', sections })
  const store = readStore()
  store.reports.push({ ...report, id: `report-${Date.now()}`, status: 'draft', generatedAt: new Date().toISOString() })
  writeStore(store)

  res.json({
    success: true,
    data: {
      ...report,
      aiSummary,
      providerSources: {
        news: liveNews.articles.length ? liveNews.source : 'demo-news',
        market: liveMarket.source,
      },
    },
  })
})

app.post('/api/notifications/test-email', requireAuth, async (_req, res) => {
  const result = await sendEmailTest()
  res.json({ success: result.status === 'sent', data: result })
})

app.post('/api/notifications/test-telegram', requireAuth, async (_req, res) => {
  const result = await sendTelegramTest()
  res.json({ success: result.status === 'sent', data: result })
})

const frontendDistCandidates = [
  path.resolve(process.cwd(), '../frontend/dist'),
  path.resolve(__dirname, '../../../frontend/dist'),
]
const frontendDistPath = frontendDistCandidates.find((candidate) => fs.existsSync(path.join(candidate, 'index.html')))

if (frontendDistPath) {
  app.use(express.static(frontendDistPath, { index: false }))
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/') || !req.accepts('html')) return next()
    return res.sendFile(path.join(frontendDistPath, 'index.html'))
  })
}

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[server] unexpected error', err.message)
  res.status(500).json({ success: false, error: 'Unexpected server error.' })
})

if (require.main === module) {
  cron.schedule(config.dailyReportCron, () => {
    void runDailyDelivery()
      .then((result) => {
        console.log(`Daily delivery completed: email=${result.delivery.email.status}, telegram=${result.delivery.telegram.status}`)
      })
      .catch((error: unknown) => {
        console.error('[scheduler] daily delivery failed', error instanceof Error ? error.message : 'unknown error')
      })
  }, { timezone: config.schedulerTimezone })

  console.log(`Daily delivery scheduled for ${config.dailyReportCron} (${config.schedulerTimezone})`)
  app.listen(config.port, async () => {
    const mongoState = await connectMongo()
    console.log(`Daily intelligence backend listening on http://localhost:${config.port}`)
    console.log(`MongoDB status: ${mongoState.status}`)
  })
}

export { app }
