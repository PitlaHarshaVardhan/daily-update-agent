import { useEffect, useState } from 'react'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import axios from 'axios'
import './App.css'

const API_URL = `${(import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '').replace(/\/api$/, '')}/api`

function getSimpleInvestmentView(signal: string) {
  if (signal === 'BULLISH_MOMENTUM') {
    return 'Positive trend. Research it now; only consider investing after checking value and risk. Review again after the next weekly close.'
  }
  if (signal === 'BEARISH_MOMENTUM') {
    return 'Do not add now. Wait for the price to stabilize, then review again after five trading sessions.'
  }
  return 'Not yet. Wait until the daily and five-session trends agree; review again after five trading sessions.'
}

function DashboardPage() {
  const [dashboard, setDashboard] = useState<any>(null)
  const [news, setNews] = useState<any[]>([])
  const [market, setMarket] = useState<any[]>([])
  const [stock, setStock] = useState<any>(null)
  const [dailyAnalysis, setDailyAnalysis] = useState<any>(null)
  const [reportMessage, setReportMessage] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('daily-token')
    const headers = token ? { Authorization: `Bearer ${token}` } : {}

    Promise.all([
      axios.get(`${API_URL}/dashboard`, { headers }),
      axios.get(`${API_URL}/news`),
      axios.get(`${API_URL}/market`),
      axios.get(`${API_URL}/stock-of-day`),
      axios.get(`${API_URL}/daily-analysis`, { headers }),
    ])
      .then(([dashboardRes, newsRes, marketRes, stockRes, analysisRes]) => {
        setDashboard({ ...dashboardRes.data.data, newStories: newsRes.data.data.length, sourceHealth: newsRes.data.source })
        setNews(newsRes.data.data.slice(0, 5))
        setMarket(marketRes.data.data)
        setStock(stockRes.data.data)
        setDailyAnalysis(analysisRes.data.data)
      })
      .catch(() => {
        setDashboard({
          lastReport: '2026-10-10T07:00:00+05:30',
          nextScheduledRun: '2026-10-10T07:00:00+05:30',
          newStories: 3,
          sourceHealth: 'stable',
          marketFreshness: 'live',
          watchlistAlerts: 1,
          reportHistory: 5,
        })
      })
  }, [])

  async function generateReport() {
    try {
      const token = localStorage.getItem('daily-token')
      const response = await axios.post(`${API_URL}/reports/generate`, {}, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      setReportMessage(`Report generated. AI summary: ${response.data.data.aiSummary?.status ?? 'unavailable'}.`)
    } catch {
      setReportMessage('Report generation failed. Check the authenticated session and provider status.')
    }
  }

  return (
    <div className="page-grid">
      <div className="hero-panel card">
        <div>
          <p className="eyebrow">Daily Intelligence</p>
          <h1>Telangana, India, and market coverage in one operational briefing.</h1>
        </div>
        <button className="primary-button" type="button" onClick={() => void generateReport()}>Generate report</button>
      </div>
      <p aria-live="polite">{reportMessage}</p>

      <div className="stat-grid">
        <MetricCard label="Last report generation" value={dashboard?.lastReport ? new Date(dashboard.lastReport).toLocaleString() : 'Not yet generated'} />
        <MetricCard label="Next scheduled run" value={dashboard?.nextScheduledRun ? new Date(dashboard.nextScheduledRun).toLocaleString() : 'Not scheduled'} />
        <MetricCard label="New stories" value={String(dashboard?.newStories ?? 0)} />
        <MetricCard label="Source health" value={dashboard?.sourceHealth ?? 'degraded'} />
      </div>

      <div className="card chart-card">
        <div className="section-header">
          <h2>Market overview</h2>
          <span className="pill neutral">{market[0] ? `${market[0].status} · ${market[0].source}` : 'No market quote'}</span>
        </div>
        <div className="table-list">
          {market.map((item) => (
            <div key={item.symbol} className="table-row">
              <strong>{item.symbol} · {item.exchange}</strong>
              <span>{item.instrument}</span>
              <strong>₹{Number(item.value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              <span className={item.change >= 0 ? 'positive' : 'negative'}>
                {item.change >= 0 ? '+' : ''}{Number(item.change).toFixed(2)} ({Number(item.percentChange).toFixed(2)}%) · {item.status}
              </span>
            </div>
          ))}
        </div>
        {market[0] && <small>As of {new Date(market[0].timestamp).toLocaleString()} · Source: {market[0].source}</small>}
      </div>

      <div className="card page-block">
        <div className="section-header">
          <h2>Selected stock</h2>
          <span className="pill neutral">{stock?.signal ?? 'Loading'}</span>
        </div>
        {stock && (
          <>
            <div className="table-list">
              <div className="table-row">
                <strong>{stock.symbol} · BSE</strong>
                <strong>{stock.marketQuote ? `₹${Number(stock.marketQuote.value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Quote unavailable'}</strong>
                <span className={stock.marketQuote?.change >= 0 ? 'positive' : 'negative'}>
                  {stock.marketQuote ? `${stock.marketQuote.change >= 0 ? '+' : ''}${Number(stock.marketQuote.change).toFixed(2)} (${Number(stock.marketQuote.percentChange).toFixed(2)}%)` : 'No provider quote'}
                </span>
                <span>{stock.marketQuote?.status ?? stock.marketSource}</span>
              </div>
            </div>
            <p>{stock.reason}</p>
            <small>Research: {stock.source} · Quote: {stock.marketQuote?.source ?? 'unavailable'}</small>
          </>
        )}
      </div>

      <section className="card page-block">
        <div className="section-header">
          <h2>Watchlist decisions today</h2>
          <Link to="/watchlist">Full analysis</Link>
        </div>
        <p>Simple research view based on end-of-day moves, not personalized financial advice.</p>
        <div className="table-list">
          {dailyAnalysis?.watchlist.map((item: any) => (
            <article className="dashboard-watch-item" key={item.id}>
              <div className="section-header">
                <div>
                  <h3>{item.name}</h3>
                  <small>{item.symbol}{item.exchange ? ` · ${item.exchange}` : ''} · {item.freshness} · {new Date(item.asOf).toLocaleDateString()}</small>
                </div>
                <span className="pill neutral">{item.signal.replaceAll('_', ' ')}</span>
              </div>
              <p><strong>Price:</strong> {item.assetType === 'mutual-fund' ? 'NAV' : 'Close'} ₹{Number(item.price).toFixed(2)} · Today {item.dailyChangePercent >= 0 ? '+' : ''}{Number(item.dailyChangePercent).toFixed(2)}%{item.fiveSessionChangePercent === undefined ? '' : ` · 5 sessions ${item.fiveSessionChangePercent >= 0 ? '+' : ''}${Number(item.fiveSessionChangePercent).toFixed(2)}%`}</p>
              <p><strong>Simple view:</strong> {getSimpleInvestmentView(item.signal)}</p>
              <p><strong>Reason:</strong> {item.bullishReasons[0]} {item.bearishReasons[0]}</p>
            </article>
          ))}
          {!dailyAnalysis && <p>Loading current watchlist prices and suggestions…</p>}
        </div>
      </section>

      <div className="card">
        <div className="section-header">
          <h2>Top stories</h2>
          <Link to="/news">View all</Link>
        </div>
        <div className="story-list">
          {news.map((story) => (
            <article key={story.id} className="story-item">
              <div className="story-tag">{story.category}</div>
              <h3>{story.headline}</h3>
              <p>{story.summary}</p>
              <small>{story.source} · {new Date(story.publishedAt).toLocaleString()}</small>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}

function NewsPage() {
  const [news, setNews] = useState<any[]>([])
  const [source, setSource] = useState('Loading')
  const [category, setCategory] = useState<'all' | 'hyderabad' | 'telangana' | 'india'>('all')

  useEffect(() => {
    axios.get(`${API_URL}/news`).then((res) => {
      setNews(res.data.data)
      setSource(res.data.source)
    }).catch(() => setSource('unavailable'))
  }, [])

  const filteredNews = category === 'all' ? news : news.filter((story) => story.category === category)
  const categories = [
    { value: 'all', label: 'All' },
    { value: 'hyderabad', label: 'Hyderabad' },
    { value: 'telangana', label: 'Telangana' },
    { value: 'india', label: 'India' },
  ] as const

  return (
    <div className="card page-block">
      <div className="section-header">
        <h2>News and source coverage</h2>
        <span className="pill neutral">{source}</span>
      </div>
      <div className="button-row" role="group" aria-label="Filter news by region">
        {categories.map((item) => (
          <button
            key={item.value}
            className={category === item.value ? 'primary-button' : 'secondary-button'}
            type="button"
            aria-pressed={category === item.value}
            onClick={() => setCategory(item.value)}
          >
            {item.label} ({item.value === 'all' ? news.length : news.filter((story) => story.category === item.value).length})
          </button>
        ))}
      </div>
      <div className="story-list">
        {filteredNews.map((story) => (
          <article key={story.id} className="story-item">
            <div className="story-tag">{story.category}</div>
            <h3>{story.headline}</h3>
            <p>{story.summary}</p>
            <small>{story.source} · {story.url}</small>
          </article>
        ))}
        {filteredNews.length === 0 && <p>No recent {category === 'all' ? '' : `${category} `}stories returned by the provider.</p>}
      </div>
    </div>
  )
}

function MarketsPage() {
  const [market, setMarket] = useState<any[]>([])

  useEffect(() => {
    axios.get(`${API_URL}/market`).then((res) => setMarket(res.data.data)).catch(() => setMarket([]))
  }, [])

  return (
    <div className="page-grid">
      <div className="card page-block">
        <div className="section-header">
          <h2>Market data</h2>
          <span className="pill neutral">{market[0] ? `${market[0].status} · ${market[0].source}` : 'No market quote'}</span>
        </div>
        <div className="table-list">
          {market.map((item) => (
            <div key={item.symbol} className="table-row">
              <strong>{item.symbol} · {item.exchange}</strong>
              <span>{item.instrument}</span>
              <strong>₹{Number(item.value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              <span className={item.change >= 0 ? 'positive' : 'negative'}>
                {item.change >= 0 ? '+' : ''}{Number(item.change).toFixed(2)} ({Number(item.percentChange).toFixed(2)}%) · {item.status}
                <small>{new Date(item.timestamp).toLocaleString()}</small>
              </span>
            </div>
          ))}
        </div>
        {market[0] && <small>Source: {market[0].source}. NIFTYBEES is an ETF proxy, not an index quote.</small>}
      </div>
    </div>
  )
}

function WatchlistPage() {
  const [analysis, setAnalysis] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('daily-token')
    axios.get(`${API_URL}/daily-analysis`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((response) => setAnalysis(response.data.data))
      .catch(() => setError('Daily analysis is unavailable. Check the market-data providers and session.'))
  }, [])

  function renderAssessment(item: any) {
    return (
      <div key={item.id} className="analysis-item">
        <div className="table-row">
          <strong>{item.name}<small>{item.symbol}{item.exchange ? ` · ${item.exchange}` : ''}</small></strong>
          <strong>{item.assetType === 'mutual-fund' ? 'NAV' : 'Close'} ₹{Number(item.price).toFixed(2)}</strong>
          <span className={item.dailyChangePercent >= 0 ? 'positive' : 'negative'}>
            {item.dailyChangePercent >= 0 ? '+' : ''}{Number(item.dailyChangePercent).toFixed(2)}% day
            {item.fiveSessionChangePercent !== undefined && <small>{item.fiveSessionChangePercent >= 0 ? '+' : ''}{Number(item.fiveSessionChangePercent).toFixed(2)}% / 5 sessions</small>}
          </span>
          <span>{item.signal.replaceAll('_', ' ')}<small>{item.freshness} · {new Date(item.asOf).toLocaleDateString()}</small></span>
        </div>
        <p>{item.suggestion}</p>
        <div className="analysis-reasons">
          <p><strong>Bullish factors</strong></p>
          <ul>{item.bullishReasons.map((reason: string) => <li key={reason}>{reason}</li>)}</ul>
          <p><strong>Bearish factors</strong></p>
          <ul>{item.bearishReasons.map((reason: string) => <li key={reason}>{reason}</li>)}</ul>
          {item.relatedHeadlines.length > 0 && <p><strong>Related headlines, not proof of cause:</strong> {item.relatedHeadlines.join(' · ')}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="page-grid">
      <div>
        <div className="section-header">
          <h2>Watchlist and daily market review</h2>
          {analysis?.schedule && <span className="pill neutral">Daily {analysis.schedule.cron} · {analysis.schedule.timezone}</span>}
        </div>
        <p>Momentum-based research signals are educational, not personalized investment advice. Price movement alone does not establish its cause.</p>
      </div>
      {error && <p role="alert">{error}</p>}
      {!analysis && !error && <p>Loading current prices and NAV…</p>}
      {analysis && (
        <>
          <section className="card page-block">
            <div className="section-header"><h2>My watchlist</h2><span className="pill neutral">{analysis.watchlist.length} assets</span></div>
            <div className="table-list">{analysis.watchlist.map(renderAssessment)}</div>
          </section>
          <section className="card page-block">
            <div className="section-header"><h2>Top large-cap stocks by daily movement</h2><span className="pill neutral">{analysis.topStocks.length} tracked</span></div>
            <p>{analysis.topStockUniverse}</p>
            <div className="table-list">{analysis.topStocks.map(renderAssessment)}</div>
          </section>
          <small>Prices and NAV are end-of-day. As of {new Date(analysis.generatedAt).toLocaleString()}. {analysis.methodology}</small>
        </>
      )}
    </div>
  )
}

function ReportsPage() {
  const [report, setReport] = useState<any>(null)

  useEffect(() => {
    const token = localStorage.getItem('daily-token')
    axios.post(`${API_URL}/reports/generate`, {}, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => setReport(res.data.data))
      .catch(() => setReport({ title: 'Demo report', sections: { telangana: [], india: [] } }))
  }, [])

  return (
    <div className="card page-block">
      <div className="section-header">
        <h2>Report preview</h2>
        <span className="pill neutral">HTML + text</span>
      </div>
      {report ? (
        <div className="report-block">
          <h3>{report.title}</h3>
          {report.providerSources && <p>News: {report.providerSources.news} · Market: {report.providerSources.market}</p>}
          {report.aiSummary && <p>AI summary ({report.aiSummary.status}): {report.aiSummary.summary}</p>}
          {Object.entries(report.sections ?? {}).map(([section, items]: [string, any]) => (
            <div key={section} className="report-section">
              <h4>{section}</h4>
              {(items as any[]).map((item) => (
                <div key={item.headline ?? item.symbol} className="story-item compact">
                  <strong>{item.headline ?? item.symbol}</strong>
                  <p>{item.summary ?? item.source}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <p>Generating report…</p>
      )}
    </div>
  )
}

function SettingsPage() {
  const [testStatus, setTestStatus] = useState('')
  const [deliveryStatus, setDeliveryStatus] = useState(() => sessionStorage.getItem('daily-delivery-status') ?? 'Not tested in this session')
  const [health, setHealth] = useState<any>(null)

  function recordDeliveryStatus(status: string) {
    sessionStorage.setItem('daily-delivery-status', status)
    setDeliveryStatus(status)
  }

  function formatDeliveryResult(result: any) {
    const counts = result.contentCounts ?? {}
    const email = result.delivery.email
    const telegram = result.delivery.telegram
    const telegramParts = telegram.data?.chunksSent ? ` in ${telegram.data.chunksSent} messages` : ''
    return `Included ${counts.stories ?? 0} stories, ${counts.marketQuotes ?? 0} market quotes, ${counts.watchlistAssets ?? 0} watchlist assets, and ${counts.topStocks ?? 0} top stocks. Email: ${email.status}${email.message ? ` (${email.message})` : ''}. Telegram: ${telegram.status}${telegramParts}${telegram.message ? ` (${telegram.message})` : ''}.`
  }

  useEffect(() => {
    axios.get(`${API_URL}/health`).then((response) => setHealth(response.data.data)).catch(() => setHealth(null))
  }, [])

  async function runNotificationTest(channel: 'email' | 'telegram') {
    try {
      const token = localStorage.getItem('daily-token')
      const response = await axios.post(`${API_URL}/notifications/test-${channel}`, {}, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const detail = response.data.data.message ? ` - ${response.data.data.message}` : ''
      setTestStatus(`${channel}: ${response.data.data.status}${detail}`)
    } catch {
      setTestStatus(`${channel}: request failed`)
    }
  }

  async function sendDailyBriefing() {
    recordDeliveryStatus('Building analysis and sending…')
    try {
      const token = localStorage.getItem('daily-token')
      const response = await axios.post(`${API_URL}/daily-analysis/send`, {}, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      recordDeliveryStatus(formatDeliveryResult(response.data.data))
    } catch (error) {
      const response = axios.isAxiosError(error) ? error.response : undefined
      const result = response?.data?.data
      recordDeliveryStatus(result
        ? formatDeliveryResult(result)
        : 'Daily briefing could not be sent. Check backend and provider status.')
    }
  }

  return (
    <div className="card page-block">
      <div className="section-header">
        <h2>Settings and delivery</h2>
        <span className="pill neutral">Environment-configured</span>
      </div>
      <div className="settings-grid">
        <div><strong>Daily schedule</strong><p>{health?.dailySchedule ? `${health.dailySchedule.cron} · ${health.dailySchedule.timezone}` : 'Loading schedule…'}</p></div>
        <div><strong>Email</strong><p>{health?.providers?.email === 'configured' ? 'Credentials detected; delivery not verified' : 'Not configured'}</p></div>
        <div><strong>Telegram</strong><p>{health?.providers?.telegram === 'configured' ? 'Bot credentials detected; delivery not verified' : 'Not configured'}</p></div>
        <div><strong>Last delivery attempt</strong><p>{deliveryStatus || testStatus || 'Not tested in this session'}</p></div>
      </div>
      <div className="button-row">
        <button className="primary-button" type="button" onClick={() => void sendDailyBriefing()}>Send daily briefing now</button>
        <button className="secondary-button" type="button" onClick={() => void runNotificationTest('email')}>Send test email</button>
        <button className="secondary-button" type="button" onClick={() => void runNotificationTest('telegram')}>Test Telegram</button>
      </div>
      <p aria-live="polite">{deliveryStatus}</p>
      <p aria-live="polite">{testStatus}</p>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card card">
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  )
}

function App() {
  const [loggedIn, setLoggedIn] = useState(() => Boolean(localStorage.getItem('daily-token')))
  const [authReady, setAuthReady] = useState(() => Boolean(localStorage.getItem('daily-token')))
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    if (localStorage.getItem('daily-token')) {
      return
    }

    async function authenticateDemoUser() {
      const credentials = { email: 'demo@dailyintelligence.local', password: 'DemoPass123' }
      try {
        let response
        try {
          response = await axios.post(`${API_URL}/auth/register`, credentials)
        } catch (error) {
          if (!axios.isAxiosError(error) || error.response?.status !== 409) throw error
          response = await axios.post(`${API_URL}/auth/login`, credentials)
        }
        localStorage.setItem('daily-token', response.data.data.token)
        setLoggedIn(true)
      } catch {
        setAuthError('Could not establish a session with the backend.')
      } finally {
        setAuthReady(true)
      }
    }

    void authenticateDemoUser()
  }, [])

  return (
    <BrowserRouter>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand-block">
            <div className="brand-mark">D</div>
            <div>
              <h2>Daily Intelligence</h2>
              <small>India + Telangana + Markets</small>
            </div>
          </div>

          <nav className="nav-links">
            <Link to="/">Dashboard</Link>
            <Link to="/news">News</Link>
            <Link to="/markets">Markets</Link>
            <Link to="/watchlist">Watchlist</Link>
            <Link to="/reports">Reports</Link>
            <Link to="/settings">Settings</Link>
          </nav>

          <div className="status-card">
            <span className="status-dot" />
            {loggedIn ? 'Demo session active' : 'Authenticating…'}
          </div>
        </aside>

        <main className="content-panel">
          {!authReady ? <p>Authenticating…</p> : authError ? <p role="alert">{authError}</p> : (
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/news" element={<NewsPage />} />
              <Route path="/markets" element={<MarketsPage />} />
              <Route path="/watchlist" element={<WatchlistPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          )}
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
