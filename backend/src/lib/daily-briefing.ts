import { DailyAssessment, NewsArticle, StockSnapshot } from '../types'

export interface DailyBriefingData {
  generatedAt: string
  newsSource: string
  stories: NewsArticle[]
  marketSource: string
  marketSnapshots: StockSnapshot[]
  watchlist: DailyAssessment[]
  topStocks: DailyAssessment[]
  topStockUniverse: string
  methodology: string
}

function formatAssessment(item: DailyAssessment) {
  const fiveSessionChange = item.fiveSessionChangePercent === undefined
    ? ''
    : `; 5 sessions ${item.fiveSessionChangePercent >= 0 ? '+' : ''}${item.fiveSessionChangePercent.toFixed(2)}%`
  return [
    `${item.name} (${item.symbol}) | ${item.assetType === 'mutual-fund' ? 'NAV' : 'close'} INR ${item.price.toFixed(2)} | day ${item.dailyChangePercent >= 0 ? '+' : ''}${item.dailyChangePercent.toFixed(2)}%${fiveSessionChange} | ${item.freshness} ${item.asOf.slice(0, 10)}`,
    `Decision today: ${getEmailDecision(item).label}. ${getEmailDecision(item).reason}`,
    `Simple view: ${item.suggestion}`,
    `Signal: ${item.signal.replace(/_/g, ' ')}. Bullish: ${item.bullishReasons.join(' ')}`,
    `Bearish: ${item.bearishReasons.join(' ')}`,
    item.relatedHeadlines.length ? `Related headlines (not proof of cause): ${item.relatedHeadlines.join(' | ')}` : 'No directly matched company headline in this news feed.',
  ].join('\n')
}

function getEmailDecision(item: DailyAssessment) {
  if (item.signal === 'BULLISH_MOMENTUM') {
    return {
      label: 'CONSIDER AFTER REVIEW',
      reason: 'The trend is positive. Research now, but only consider investing after checking valuation, risk, and your own plan.',
      color: '#166534',
      background: '#dcfce7',
    }
  }
  if (item.signal === 'BEARISH_MOMENTUM') {
    return {
      label: 'NO, NOT NOW',
      reason: 'The trend is weak. Avoid adding now; wait for stabilization and review after five trading sessions.',
      color: '#b91c1c',
      background: '#fee2e2',
    }
  }
  return {
    label: 'WAIT',
    reason: 'Signals are mixed. Wait until daily and five-session moves agree, then review after five trading sessions.',
    color: '#92400e',
    background: '#fef3c7',
  }
}

export function formatDailyBriefing(data: DailyBriefingData, timezone: string) {
  const generatedDate = new Date(data.generatedAt).toLocaleDateString('en-IN', { timeZone: timezone })
  const newsCategories = [
    ['hyderabad', 'HYDERABAD'],
    ['telangana', 'TELANGANA'],
    ['india', 'INDIA'],
    ['world', 'WORLD'],
    ['markets', 'NEWS MARKET COVERAGE'],
  ] as const
  const newsSections = newsCategories.flatMap(([category, label]) => {
    const articles = data.stories.filter((story) => story.category === category)
    if (!articles.length) return []
    return [
      '',
      `${label} NEWS (${articles.length})`,
      ...articles.map((article) => [
        `- ${article.headline}`,
        `  ${article.source} | ${article.publishedAt}`,
        `  ${article.summary}`,
      ].join('\n')),
    ]
  })
  const topStories = data.stories.slice(0, 5)

  const marketSection = [
    '',
    `MARKET QUOTES (${data.marketSource})`,
    ...(data.marketSnapshots.length
      ? data.marketSnapshots.map((snapshot) => `- ${snapshot.symbol} ${snapshot.instrument ? `(${snapshot.instrument}) ` : ''}${snapshot.exchange}: INR ${snapshot.value.toFixed(2)}, change ${snapshot.change >= 0 ? '+' : ''}${snapshot.change.toFixed(2)} (${snapshot.percentChange >= 0 ? '+' : ''}${snapshot.percentChange.toFixed(2)}%), ${snapshot.status}, as of ${snapshot.timestamp}`)
      : ['- No market snapshots available.']),
  ]

  return [
    `DAILY INDIA INTELLIGENCE | ${generatedDate}`,
    `News source: ${data.newsSource} | Stories: ${data.stories.length}`,
    '',
    `TOP TRENDING NEWS (${topStories.length}; ranked by relevance and freshness)`,
    ...(topStories.length
      ? topStories.map((article, index) => `${index + 1}. [${article.category.toUpperCase()}] ${article.headline} | ${article.source} | ${article.summary}`)
      : ['No current news stories available.']),
    ...newsSections,
    ...marketSection,
    '',
    `WATCHLIST (${data.watchlist.length})`,
    ...(data.watchlist.length ? data.watchlist.map(formatAssessment) : ['No watchlist assessments available.']),
    '',
    `TOP STOCKS (${data.topStockUniverse})`,
    ...(data.topStocks.length ? data.topStocks.map(formatAssessment) : ['No top-stock assessments available.']),
    '',
    `Method: ${data.methodology}`,
    'Educational market information only; not personalized investment advice.',
  ].join('\n\n')
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character)
}

function formatEmailAssessment(item: DailyAssessment) {
  const decision = getEmailDecision(item)
  const signalColor = item.signal === 'BULLISH_MOMENTUM' ? '#166534' : item.signal === 'BEARISH_MOMENTUM' ? '#b91c1c' : '#92400e'
  const signalBackground = item.signal === 'BULLISH_MOMENTUM' ? '#dcfce7' : item.signal === 'BEARISH_MOMENTUM' ? '#fee2e2' : '#fef3c7'
  const fiveSession = item.fiveSessionChangePercent === undefined
    ? ''
    : `<span style="color:#475569;font-size:13px">&nbsp;|&nbsp; 5 sessions ${item.fiveSessionChangePercent >= 0 ? '+' : ''}${item.fiveSessionChangePercent.toFixed(2)}%</span>`
  const factors = (title: string, reasons: string[], color: string) => `
    <td valign="top" width="50%" style="padding:10px 12px;background:#f8fafc;border-top:1px solid #e2e8f0">
      <div style="font-size:12px;font-weight:700;color:${color};text-transform:uppercase">${title}</div>
      <ul style="margin:7px 0 0;padding-left:18px;color:#334155;font-size:13px;line-height:1.5">${reasons.map((reason) => `<li style="padding:0 0 4px">${escapeHtml(reason)}</li>`).join('')}</ul>
    </td>`

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;border:1px solid #dbe3ee;border-radius:8px;border-collapse:separate;background:#ffffff">
      <tr><td colspan="2" style="padding:14px 16px 8px">
        <div style="font-size:16px;font-weight:700;color:#0f172a">${escapeHtml(item.name)}</div>
        <div style="margin-top:4px;color:#64748b;font-size:12px">${escapeHtml(item.symbol)}${item.exchange ? ` · ${escapeHtml(item.exchange)}` : ''} · ${escapeHtml(item.freshness)} · ${escapeHtml(item.asOf.slice(0, 10))}</div>
      </td></tr>
      <tr><td colspan="2" style="padding:4px 16px 12px">
        <span style="font-size:20px;font-weight:700;color:#0f172a">INR ${item.price.toFixed(2)}</span>
        <span style="color:${item.dailyChangePercent >= 0 ? '#166534' : '#b91c1c'};font-weight:700;font-size:14px">&nbsp;${item.dailyChangePercent >= 0 ? '+' : ''}${item.dailyChangePercent.toFixed(2)}% today</span>${fiveSession}
        <span style="margin-left:8px;padding:4px 8px;border-radius:12px;background:${signalBackground};color:${signalColor};font-size:11px;font-weight:700">${escapeHtml(item.signal.replace(/_/g, ' '))}</span>
      </td></tr>
      <tr><td colspan="2" style="padding:11px 16px;background:#eff6ff;border-top:1px solid #dbeafe;color:#1e3a8a;font-size:14px;line-height:1.5"><strong>Simple view:</strong> ${escapeHtml(item.suggestion)}</td></tr>
      <tr><td colspan="2" style="padding:10px 16px;background:${decision.background};border-top:1px solid #e2e8f0;color:${decision.color};font-size:13px;line-height:1.5"><strong>Decision today: ${decision.label}.</strong> ${escapeHtml(decision.reason)}</td></tr>
      <tr>${factors('Bullish factors', item.bullishReasons, '#166534')}${factors('Bearish factors', item.bearishReasons, '#b91c1c')}</tr>
      ${item.relatedHeadlines.length ? `<tr><td colspan="2" style="padding:10px 12px;border-top:1px solid #e2e8f0;color:#475569;font-size:12px"><strong>Related headlines, not proof of cause:</strong> ${item.relatedHeadlines.map(escapeHtml).join(' · ')}</td></tr>` : ''}
    </table>`
}

export function formatDailyBriefingHtml(data: DailyBriefingData, timezone: string) {
  const generatedDate = new Date(data.generatedAt).toLocaleDateString('en-IN', { timeZone: timezone, dateStyle: 'full' })
  const articleCategories = [
    ['hyderabad', 'Hyderabad'],
    ['telangana', 'Telangana'],
    ['india', 'India'],
    ['world', 'World'],
    ['markets', 'Market coverage'],
  ] as const
  const newsSections = articleCategories.flatMap(([category, title]) => {
    const articles = data.stories.filter((story) => story.category === category)
    if (!articles.length) return []
    const articleRows = articles.map((article) => {
      const storyLink = /^https?:\/\//i.test(article.url)
        ? `<a href="${escapeHtml(article.url)}" style="color:#1d4ed8;text-decoration:none">${escapeHtml(article.headline)}</a>`
        : escapeHtml(article.headline)
      return `<tr><td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;border-left:3px solid #38bdf8">
        <div style="font-size:14px;font-weight:700;line-height:1.45;color:#0f172a">${storyLink}</div>
        <div style="margin-top:4px;color:#64748b;font-size:11px">${escapeHtml(article.source)} · ${escapeHtml(article.publishedAt)}</div>
        <div style="margin-top:7px;color:#334155;font-size:13px;line-height:1.55">${escapeHtml(article.summary)}</div>
        ${article.whyMatters ? `<div style="margin-top:5px;color:#475569;font-size:12px"><strong>Why it matters:</strong> ${escapeHtml(article.whyMatters)}</div>` : ''}
      </td></tr>`
    }).join('')
    return [`
      <tr><td style="padding:22px 24px 8px">
        <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#2563eb">${title} · ${articles.length} stories</div>
      </td></tr>
      <tr><td style="padding:0 20px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;border-collapse:separate">${articleRows}</table></td></tr>`]
  })

  const marketRows = data.marketSnapshots.map((snapshot) => `
    <tr>
      <td style="padding:12px 10px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-weight:700">${escapeHtml(snapshot.symbol)}<div style="margin-top:3px;color:#64748b;font-size:11px;font-weight:400">${escapeHtml(snapshot.instrument ?? snapshot.exchange)}</div></td>
      <td align="right" style="padding:12px 10px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-weight:700">INR ${snapshot.value.toFixed(2)}</td>
      <td align="right" style="padding:12px 10px;border-bottom:1px solid #e2e8f0;color:${snapshot.change >= 0 ? '#166534' : '#b91c1c'};font-weight:700">${snapshot.change >= 0 ? '+' : ''}${snapshot.change.toFixed(2)} (${snapshot.percentChange >= 0 ? '+' : ''}${snapshot.percentChange.toFixed(2)}%)</td>
      <td align="right" style="padding:12px 10px;border-bottom:1px solid #e2e8f0;color:#475569;font-size:12px">${escapeHtml(snapshot.status)}</td>
    </tr>`).join('')
  const marketTable = data.marketSnapshots.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr style="color:#64748b;font-size:10px;text-transform:uppercase"><th align="left" style="padding:7px 10px">Asset</th><th align="right" style="padding:7px 10px">Close / NAV</th><th align="right" style="padding:7px 10px">Change</th><th align="right" style="padding:7px 10px">Freshness</th></tr>${marketRows}</table>`
    : '<p style="color:#64748b">No market quotes available.</p>'

  const assessmentSection = (title: string, items: DailyAssessment[], subtitle: string) => `
    <tr><td style="padding:22px 24px 8px">
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#2563eb">${title} · ${items.length}</div>
      ${subtitle ? `<div style="margin-top:4px;color:#64748b;font-size:12px">${escapeHtml(subtitle)}</div>` : ''}
    </td></tr>
    <tr><td style="padding:0 20px">${items.length ? items.map(formatEmailAssessment).join('') : '<p style="color:#64748b">No assessments available.</p>'}</td></tr>`

  const marketChangeCount = data.marketSnapshots.filter((snapshot) => snapshot.change > 0).length
  const marketSummary = data.marketSnapshots.length
    ? `${marketChangeCount} of ${data.marketSnapshots.length} tracked quotes are positive today`
    : 'Market quotes unavailable'
  const topStories = data.stories.slice(0, 5)
  const trendingRows = topStories.map((article, index) => {
    const headline = escapeHtml(article.headline)
    const linkedHeadline = /^https?:\/\//i.test(article.url)
      ? `<a href="${escapeHtml(article.url)}" style="color:#1d4ed8;text-decoration:none">${headline}</a>`
      : headline
    return `<tr><td style="padding:12px 14px;border-bottom:1px solid #e2e8f0">
      <div style="font-size:10px;font-weight:700;letter-spacing:.5px;color:#2563eb">${index + 1} · ${escapeHtml(article.category.toUpperCase())}</div>
      <div style="margin-top:4px;font-size:14px;font-weight:700;line-height:1.45">${linkedHeadline}</div>
      <div style="margin-top:3px;color:#64748b;font-size:11px">${escapeHtml(article.source)} · ${escapeHtml(article.publishedAt)}</div>
      <div style="margin-top:6px;color:#334155;font-size:13px;line-height:1.5">${escapeHtml(article.summary)}</div>
    </td></tr>`
  }).join('')
  const trendingSection = `
    <tr><td style="padding:22px 24px 8px">
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#2563eb">Top trending news · ranked by relevance and freshness</div>
    </td></tr>
    <tr><td style="padding:0 20px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;border-collapse:separate">${trendingRows || '<tr><td style="padding:14px;color:#64748b">No current news stories available.</td></tr>'}</table></td></tr>`

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Daily India Intelligence</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${data.stories.length} regional stories, ${data.marketSnapshots.length} market quotes, and ${data.watchlist.length} watchlist reviews for ${escapeHtml(generatedDate)}.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:20px 8px"><tr><td align="center">
    <table role="presentation" width="680" cellpadding="0" cellspacing="0" style="width:100%;max-width:680px;background:#ffffff;border:1px solid #dbe3ee;border-radius:10px;overflow:hidden">
      <tr><td style="padding:28px 28px 24px;background:#0f172a;border-bottom:4px solid #38bdf8">
        <div style="font-size:11px;letter-spacing:1.5px;font-weight:700;color:#7dd3fc">DAILY INTELLIGENCE</div>
        <h1 style="margin:9px 0 5px;color:#ffffff;font-size:25px;line-height:1.25">India market &amp; news briefing</h1>
        <div style="color:#cbd5e1;font-size:13px">${escapeHtml(generatedDate)} · Sources: ${escapeHtml(data.newsSource)}, ${escapeHtml(data.marketSource)}</div>
      </td></tr>
      <tr><td style="padding:16px 20px;background:#f8fafc">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td width="25%" style="padding:9px 10px;border-right:1px solid #e2e8f0"><div style="font-size:20px;font-weight:700;color:#0f172a">${data.stories.length}</div><div style="font-size:11px;color:#64748b">News stories</div></td>
          <td width="25%" style="padding:9px 10px;border-right:1px solid #e2e8f0"><div style="font-size:20px;font-weight:700;color:#0f172a">${data.marketSnapshots.length}</div><div style="font-size:11px;color:#64748b">Market quotes</div></td>
          <td width="25%" style="padding:9px 10px;border-right:1px solid #e2e8f0"><div style="font-size:20px;font-weight:700;color:#0f172a">${data.watchlist.length}</div><div style="font-size:11px;color:#64748b">Watchlist assets</div></td>
          <td width="25%" style="padding:9px 10px"><div style="font-size:13px;font-weight:700;color:#0f172a">${escapeHtml(marketSummary)}</div><div style="font-size:11px;color:#64748b">Market pulse</div></td>
        </tr></table>
      </td></tr>
      ${trendingSection}
      ${newsSections.join('')}
      <tr><td style="padding:18px 24px 4px"><div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#2563eb">Market close · ${escapeHtml(data.marketSource)}</div></td></tr>
      <tr><td style="padding:4px 20px 8px">${marketTable}</td></tr>
      ${assessmentSection('Your watchlist', data.watchlist, 'Simple daily and five-session research signals')}
      ${assessmentSection('Top stock movement', data.topStocks, data.topStockUniverse)}
      <tr><td style="padding:18px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:11px;line-height:1.55">
        <strong style="color:#334155">How to read this:</strong> ${escapeHtml(data.methodology)} Signals and headlines describe available data and do not prove cause or predict returns. Educational information only, not personalized investment advice.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`
}

export function splitMessageIntoChunks(message: string, maxLength = 3500) {
  const lines = message.split('\n')
  const chunks: string[] = []
  let current = ''

  for (const originalLine of lines) {
    let line = originalLine
    while (line.length > maxLength) {
      const splitAt = line.lastIndexOf(' ', maxLength)
      const boundary = splitAt > maxLength / 2 ? splitAt : maxLength
      const part = line.slice(0, boundary)
      if (current) chunks.push(current)
      chunks.push(part)
      current = ''
      line = line.slice(boundary).trimStart()
    }

    const next = current ? `${current}\n${line}` : line
    if (next.length > maxLength) {
      chunks.push(current)
      current = line
    } else {
      current = next
    }
  }

  if (current) chunks.push(current)
  return chunks
}