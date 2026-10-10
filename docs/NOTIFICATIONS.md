# Notifications and delivery

The Settings page can test each channel and manually send a daily briefing. The backend automatically sends the daily briefing at 6:00 AM Asia/Kolkata time. Test and manual sends remain user-triggered.

## Email
- Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS` in the ignored local `.env`. Optional `SMTP_TO` sets the digest recipient; it defaults to `SMTP_USER`.
- Gmail requires a Google App Password with SMTP enabled. Use port 587 for STARTTLS or 465 for TLS; whitespace in the App Password is removed by the sender.
- The Settings page reports SMTP failures separately from Telegram, including a clear Gmail App Password hint for authentication failures.
- A `535-5.7.8` response means Gmail rejected the credential. Create a new App Password, update local `.env`, and retry the test action.

## Telegram
- Create a Telegram bot with BotFather.
- Store the resulting bot token securely in `TELEGRAM_BOT_TOKEN`.
- Set the destination chat ID in `TELEGRAM_CHAT_ID`.
- The bot must be able to message the target chat. Test delivery from Settings before relying on the scheduled job.
- The scheduler sends channels independently; an SMTP failure does not prevent Telegram delivery.
- Long Telegram digests are split into ordered messages below Telegram's per-message size limit; the sender reports partial delivery if a chunk fails.

## Daily content
- The briefing includes Lalithaa Jewellery Mart, UTI Nifty 50 Index Fund Direct Growth, and a five-stock NSE large-cap sample.
- Movement signals compare daily and five-session returns. Related headlines are shown as possible context, not verified causes.
- Signals are educational and are not personalized investment advice.
