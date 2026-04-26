# SEOMaster - AI-Powered SEO Analytics Platform

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![Platform](https://img.shields.io/badge/platform-Vercel-green)
![AI](https://img.shields.io/badge/AI-MiniMax%20M2.7-purple)
![Database](https://img.shields.io/badge/Database-Neon%20PostgreSQL-blue)

SEOMaster is a comprehensive SEO analytics dashboard powered by AI. It features GSC Command Center, CTR Lab, AI Overview & GEO optimization, Trend Intelligence, Topic Cluster Analyzer, and Core Web Vitals analysis.

## Tech Stack

- **Framework**: Next.js 15 (App Router, TypeScript)
- **AI Engine**: MiniMax M2.7 via Hermes Agent / OpenRouter
- **Database**: Neon PostgreSQL (free serverless)
- **Cache**: Upstash Redis (optional, free tier)
- **Deployment**: Vercel

## Features

- 📊 **GSC Command Center** - Upload CSV or connect via GSC API
- 🎯 **CTR Lab** - Generate title/meta variants powered by AI
- 🤖 **AI Overview & GEO** - Optimize for Google's AI Overviews
- 📈 **Trend Intelligence** - Real-time trend analysis
- 🔬 **Topic Analyzer** - Build topic clusters
- ⚡ **Core Web Vitals** - LCP, FID, CLS optimization

## Setup

### 1. Clone and Install

```bash
cd seomaster-app
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local` and fill in your values:

```bash
# AI - MiniMax M2.7 via OpenRouter/Hermes
ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic
ANTHROPIC_AUTH_TOKEN=sk-cp-your-token
ANTHROPIC_MODEL=MiniMax-M2.7

# Database - Neon PostgreSQL (free serverless)
DATABASE_URL=postgresql://user:password@ep-xxx-xxx-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start.

## Vercel Deployment

1. Push to GitHub
2. Connect repo to Vercel
3. Add environment variables in Vercel dashboard:
   - `ANTHROPIC_BASE_URL`
   - `ANTHROPIC_AUTH_TOKEN`
   - `ANTHROPIC_MODEL`
   - `DATABASE_URL` (Neon PostgreSQL connection string)
4. Deploy

## Database Setup

### Neon PostgreSQL (Recommended - Free)

1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy your connection string (looks like `postgresql://user:pass@host/db?sslmode=require`)
4. Add as `DATABASE_URL` in Vercel

Neon free tier: 0.5GB storage, 5 projects, 5 branches, serverless compute.

### Upstash Redis (Optional - Free)

For caching and sessions, sign up at [upstash.com](https://upstash.com):

```bash
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

Free tier: 10K commands/day.

## Hermes Agent + OpenRouter Setup

SEOMaster routes AI requests through OpenRouter-compatible endpoints. The MiniMax M2.7 model is used as the primary AI engine.

To integrate Hermes Agent:
1. Set up Hermes Agent with OpenRouter provider
2. Configure `OPENROUTER_API_KEY` and `OPENROUTER_BASE_URL`
3. AI requests automatically route through Hermes → MiniMax M2.7

## License

MIT