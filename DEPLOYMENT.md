# Options Buddy - Production Deployment Guide

This guide covers deploying Options Buddy to the internet with multi-user support.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────────────────────────────┐
│  Vercel (Free)  │────▶│  Railway ($5 free credit)                │
│  Next.js App    │     │  ┌─────────────┐    ┌─────────────────┐  │
└─────────────────┘     │  │ FastAPI +WS │────│ PostgreSQL      │  │
                        │  └──────┬──────┘    └─────────────────┘  │
                        └─────────┼────────────────────────────────┘
                                 │
                                 │ WebSocket
                                 ▼
                    ┌────────────────────────┐
                    │  User's Local Machine  │
                    │  Relay Agent + IB GW   │
                    └────────────────────────┘
```

## Prerequisites

1. **GitHub account** - For repository hosting
2. **Railway account** - Sign up at [railway.app](https://railway.app)
3. **Vercel account** - Sign up at [vercel.com](https://vercel.com)
4. **Resend account** - Sign up at [resend.com](https://resend.com) (for magic link emails)

## Step 1: Set Up Railway (Backend + PostgreSQL)

### 1.1 Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Connect your GitHub account and select the repository
5. Railway will detect the `backend/` folder

### 1.2 Add PostgreSQL

1. In your Railway project, click "New"
2. Select "Database" → "Add PostgreSQL"
3. Railway will automatically add `DATABASE_URL` to your environment

### 1.3 Configure Environment Variables

In Railway dashboard, go to your backend service → "Variables" tab and add:

```
ENVIRONMENT=production
DATABASE_URL=[auto-filled by Railway PostgreSQL]
JWT_SECRET=[generate with: openssl rand -base64 32]
RESEND_API_KEY=[from resend.com dashboard]
ENCRYPTION_KEY=[generate with: openssl rand -base64 32]
FRONTEND_URL=https://your-app.vercel.app
```

### 1.4 Deploy

1. Set the root directory to `backend/`
2. Railway will auto-deploy on push to `production` branch

## Step 2: Set Up Vercel (Frontend)

### 2.1 Import Project

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New" → "Project"
3. Import your GitHub repository

### 2.2 Configure Build Settings

- **Framework Preset**: Next.js
- **Root Directory**: `.` (root)
- **Build Command**: `npm run build`
- **Output Directory**: `.next`

### 2.3 Environment Variables

Add these in Vercel dashboard → Settings → Environment Variables:

```
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
NEXT_PUBLIC_AUTH_ENABLED=true
```

### 2.4 Deploy

1. Select the `production` branch
2. Click "Deploy"

## Step 3: Set Up Email (Resend)

### 3.1 Get API Key

1. Sign up at [resend.com](https://resend.com)
2. Go to API Keys → Create API Key
3. Copy the key (starts with `re_`)

### 3.2 Verify Domain (Optional)

For production, verify your domain to send from your own email address instead of `onboarding@resend.dev`.

## Step 4: Initialize Admin Access

### 4.1 Add Your Email to Whitelist

Connect to your Railway PostgreSQL and run:

```sql
INSERT INTO email_whitelist (email) VALUES ('your-email@example.com');
```

Or use the Railway CLI:
```bash
railway run psql -c "INSERT INTO email_whitelist (email) VALUES ('your-email@example.com');"
```

### 4.2 First Login

1. Go to your Vercel app URL
2. Enter your whitelisted email
3. Check your email for the magic link
4. Click the link to sign in (you're now admin)

## Step 5: Set Up IBKR Relay (Per User)

Each user needs to run the relay agent on their local machine.

### 5.1 Install Relay Agent

```bash
cd relay-agent
pip install -r requirements.txt
```

### 5.2 Get JWT Token

After logging into the web app, get your JWT token from:
- Browser DevTools → Application → Cookies → `auth_token`
- Or from the API response after magic link verification

### 5.3 Run Relay Agent

```bash
python relay_agent.py \
  --token "your-jwt-token" \
  --server "wss://your-backend.railway.app"
```

Make sure IB Gateway is running on your local machine first.

## Adding New Users

As admin, you can add users to the whitelist:

### Via Web App (Coming Soon)
Admin panel at `/admin/users`

### Via Database
```sql
INSERT INTO email_whitelist (email, added_by)
VALUES ('new-user@example.com', 'admin-user-id');
```

### Via API
```bash
curl -X POST https://your-backend.railway.app/api/admin/whitelist \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"email": "new-user@example.com"}'
```

## Environment Variables Reference

### Backend (Railway)

| Variable | Required | Description |
|----------|----------|-------------|
| `ENVIRONMENT` | Yes | Set to `production` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for signing JWT tokens |
| `RESEND_API_KEY` | Yes | Resend API key for emails |
| `ENCRYPTION_KEY` | Yes | Key for encrypting API keys |
| `FRONTEND_URL` | Yes | Vercel app URL |

### Frontend (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Railway backend URL |
| `NEXT_PUBLIC_AUTH_ENABLED` | Yes | Set to `true` |

## Troubleshooting

### "Email not whitelisted"
Add the email to the `email_whitelist` table in PostgreSQL.

### "IBKR relay not connected"
1. Ensure IB Gateway is running locally
2. Check relay agent is running with correct token
3. Verify WebSocket connection in browser DevTools

### "Magic link expired"
Links expire after 10 minutes. Request a new one from the login page.

### Railway deployment fails
Check the build logs. Common issues:
- Missing environment variables
- Python dependency conflicts

## Monitoring

### Railway Logs
```bash
railway logs
```

### Check Database
```bash
railway run psql
```

## Costs

| Service | Free Tier | Notes |
|---------|-----------|-------|
| Railway | $5/month credit | Backend + PostgreSQL |
| Vercel | Unlimited | Frontend hosting |
| Resend | 100 emails/day | Magic link emails |

**Total: $0/month** for 2 users with normal usage.
