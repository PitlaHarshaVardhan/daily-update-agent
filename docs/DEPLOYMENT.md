# Deployment Guide

## Local development
- Copy `.env.example` to the repository-root `.env` and provide local credentials.
- Run backend `npm run dev` from `backend` and frontend `npm run dev -- --host 0.0.0.0` from `frontend`.
- Open `http://localhost:5173`; Vite proxies `/api` to `http://localhost:4000`.

## Single-service production
1. Build from `backend` with `npm run build:full`.
2. Deploy the repository with a persistent Node.js service and run `npm start` from `backend`.
3. Express serves the compiled `frontend/dist` and `/api` on the same origin.
4. Configure `NODE_ENV=production`, a unique `JWT_SECRET`, the public origin in `FRONTEND_URL`, provider credentials, and the platform-provided `PORT`.
5. Attach persistent storage for `backend/data` if local JSON users/reports must survive restarts.

## Separate frontend and backend
- Build the frontend with `VITE_API_URL=https://<backend-host>/api`.
- Set backend `FRONTEND_URL=https://<frontend-host>`; multiple allowed origins can be comma-separated.
- Configure TLS at the host/reverse proxy and keep secrets only in backend environment variables.

## Operational requirements
- Use exactly one backend replica while the in-process daily cron is enabled, or move the cron to a managed scheduler with a single-run lock.
- MongoDB connection health is checked, but user/report writes currently use JSON local storage; configure a persistent disk until the data layer is migrated.
- Confirm the deployment health endpoint, `/api/health`, and manually verify email and Telegram delivery after deployment.
