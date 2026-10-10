import dotenv from 'dotenv'
import path from 'path'

dotenv.config({
  path: [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '..', '.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../../.env'),
  ],
})

const isProduction = process.env.NODE_ENV === 'production'
const jwtSecret = process.env.JWT_SECRET ?? ''
if (isProduction && (!jwtSecret || jwtSecret === 'demo-local-secret-change-me' || jwtSecret === 'replace-with-a-long-random-secret')) {
  throw new Error('Set a unique JWT_SECRET before starting the backend in production.')
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: jwtSecret || 'demo-local-secret-change-me',
  mongoUri: process.env.MONGODB_URI ?? '',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  allowedOrigins: (process.env.FRONTEND_URL ?? 'http://localhost:5173').split(',').map((origin) => origin.trim()).filter(Boolean),
  appName: process.env.APP_NAME ?? 'Daily Intelligence Platform',
  isProduction,
  aiProvider: process.env.AI_PROVIDER ?? 'demo',
  aiModel: process.env.AI_MODEL ?? 'gemini-3.8-flash',
  dailyReportCron: process.env.DAILY_REPORT_CRON ?? '0 7 * * *',
  schedulerTimezone: process.env.SCHEDULER_TIMEZONE ?? 'Asia/Kolkata',
  aiEnabled: Boolean(process.env.AI_API_KEY),
  newsEnabled: Boolean(process.env.NEWS_API_KEY),
  telegramEnabled: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID && process.env.TELEGRAM_CHAT_ID !== 'replace-with-chat-id'),
}
