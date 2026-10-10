# Setup Guide

## Prerequisites
- Node.js 20+
- npm 10+

## Backend setup
```bash
cd backend
npm install
npm run dev
```

Create the repository-root `.env` from `.env.example` before starting the backend. In PowerShell use `Copy-Item ..\.env.example ..\.env`; in bash use `cp ../.env.example ../.env`.

## Frontend setup
```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

## Testing
```bash
cd backend
npm test
```

## Production build
```bash
cd backend
npm run build:full
```

## Run compiled backend
```bash
cd backend
npm start
```

The backend scheduler runs in the configured timezone. Run a single backend instance unless a distributed scheduler/lock is configured.

The production backend serves `frontend/dist` automatically when it exists. Set `NODE_ENV=production`, a unique `JWT_SECRET`, and `FRONTEND_URL` to the deployed origin before `npm start`. `PORT` is supplied by most hosting platforms.
