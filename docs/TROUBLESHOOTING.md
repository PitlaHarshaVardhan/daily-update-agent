# Troubleshooting

## Port already in use
- Change `PORT` in the environment file or stop the conflicting process.

## Frontend cannot reach backend
- Verify the backend is running on port 4000.
- Confirm `VITE_API_URL` points to the correct API URL.

## Build errors
- Run `npm install` in both frontend and backend directories.
- Ensure Node.js is version 20 or newer.

## Email authentication failure
- For Gmail, use a Google App Password, not the normal account password.
- Regenerate the App Password if SMTP returns `535-5.7.8`, update `SMTP_PASS` in local `.env`, and use the Settings test action.

## Provider data is stale or unavailable
- Quote and NAV feeds are end-of-day; weekends and exchange holidays do not produce new closes.
- Yahoo Finance and MFAPI.in are public endpoints and may throttle or become unavailable.
- Gemini failures fall back to a local summary. Telegram and email delivery statuses are independent.

## Database connection failure
- Health may still return `ok` when MongoDB is unavailable because the current user/report store is local JSON.
- Check Atlas network access, DNS, and the URI separately before relying on durable production storage.
