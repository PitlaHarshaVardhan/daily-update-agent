# Daily Intelligence Platform

This repository contains a daily intelligence platform for Hyderabad, Telangana, India, and market coverage. It is built with a React + Vite frontend and a Node + Express TypeScript backend, with live provider integrations and a local JSON fallback.

## What is implemented
- React dashboard with separate regional news filters, market data, and watchlist analysis
- Express API for auth, news, market snapshots, daily analysis, reports, and notifications
- Live India/Hyderabad/Telangana news, Alpha Vantage quotes, Yahoo Finance daily prices, and UTI fund NAV data
- Daily bullish/bearish movement factors and a non-personalized research stance
- Scheduled email and Telegram digest delivery with per-channel status
- Local demo persistence so the app works without a MongoDB connection
- Automated backend tests for deduplication, ranking, and report generation

## Tech stack
- Frontend: React, TypeScript, Vite, Tailwind, React Router, Recharts
- Backend: Node.js, TypeScript, Express, Zod, Helmet, CORS, rate limiting
- Storage: local JSON demo store (MongoDB-ready architecture and config hooks)
- Testing: Vitest

## Run locally
1. Copy `.env.example` to `.env` in the repository root and set local provider credentials. Never commit `.env`.
2. In one terminal, run `cd backend`, `npm install`, then `npm run dev`.
3. In another terminal, run `cd frontend`, `npm install`, then `npm run dev -- --host 0.0.0.0`.
4. Open http://localhost:5173. Vite proxies `/api` to `http://localhost:4000`; no frontend API URL edit is needed.

## Environment variables
Copy the placeholders from `.env.example` to a local `.env` file in the project root.
The daily digest is scheduled for 6:00 AM Asia/Kolkata time.
In production, set `NODE_ENV=production`, a unique strong `JWT_SECRET`, and `FRONTEND_URL` to the public site origin. The backend refuses to start in production with a placeholder JWT secret.

## MongoDB setup
- Set `MONGODB_URI` in `.env` for a MongoDB Atlas or self-hosted instance.
- The current application store is local JSON. MongoDB connectivity is checked, but user/report persistence has not been migrated to MongoDB.

## Email setup
- Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS` in the ignored local `.env`.
- For Gmail, use a valid Google App Password with SMTP on port 587 (STARTTLS) or 465 (TLS). Normal account passwords are rejected.
- Settings includes a test action and a manual daily-digest send action. A scheduled daily digest also sends to the configured SMTP user.

## Telegram setup
- Configure `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` for a bot that can message the target chat.
- The Settings test action and scheduled daily digest use Telegram's sendMessage API; delivery status is reported separately from email status.

## AI and market providers
- `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`: Gemini-backed report summaries
- `NEWS_API_KEY`: regional NewsAPI searches (Google News RSS is used when unset or unavailable)
- `MARKET_DATA_PROVIDER`, `MARKET_DATA_API_KEY`: optional Alpha Vantage market snapshots (Yahoo Finance is used when unset or unavailable)
- Lalithaa Jewellery Mart uses Yahoo Finance symbol `LALITHAA.NS`; UTI Nifty 50 Direct Growth uses AMFI scheme code `120716` via MFAPI.in.

## Deployment
- Build both applications with `cd backend; npm run build:full` (PowerShell) or `cd backend && npm run build:full` (bash).
- Run `npm start` from `backend`. When `frontend/dist` exists, Express serves the UI and `/api` from one origin; deploy one Node service and use that service's public URL.
- Alternatively, host `frontend/dist` separately, set `VITE_API_URL` at frontend build time to the backend's absolute `/api` URL, and set backend `FRONTEND_URL` to the frontend origin.
- Set secrets in the deployment platform, never in the built frontend. Configure the host's `PORT`; the backend listens on it.
- The scheduler is process-local. Run one backend replica or move scheduling to a managed single-run scheduler to prevent duplicate email/Telegram sends.
- Persist `backend/data` on a durable volume if retaining local JSON users/reports; current MongoDB support is connectivity-only, not application persistence.

## Known limitations
- Yahoo Finance and MFAPI.in are public data endpoints without an API-key SLA; availability and licensing/usage limits may change.
- Alpha Vantage quotes and fund NAVs are end-of-day, not streaming prices.
- Bullish/bearish factors summarize price direction and matched headlines. They do not establish causality or provide personalized investment advice.
- Email delivery requires valid SMTP credentials. Delivery failures are surfaced per channel; a Telegram success does not imply email succeeded.
- Multi-instance production scheduling requires a managed scheduler or distributed lock to prevent duplicate digests.
- A static frontend hosted separately must use `VITE_API_URL`; the default relative `/api` is intended for Vite proxy locally and the backend-served same-origin production deployment.

## Manual actions still required
1. Configure a valid Gmail App Password or another SMTP provider.
2. Verify Telegram bot permissions and target chat configuration.
3. Configure MongoDB before relying on persistent users/reports across process restarts.
