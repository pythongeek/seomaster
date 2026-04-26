# SEOMaster - AI-Powered SEO Analytics Platform

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![Platform](https://img.shields.io/badge/platform-Vercel-green)
![AI](https://img.shields.io/badge/AI-MiniMax%20M2.7-purple)

SEOMaster is a comprehensive SEO analytics dashboard powered by AI. It features GSC Command Center, CTR Lab, AI Overview & GEO optimization, Trend Intelligence, Topic Cluster Analyzer, and Core Web Vitals analysis.

## Tech Stack

- **Framework**: Next.js 15 (App Router, TypeScript)
- **AI Engine**: MiniMax M2.7 via Hermes Agent / OpenRouter
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel (Node.js standalone)

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
# MiniMax API (via OpenRouter/Hermes compatible endpoint)
ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic
ANTHROPIC_AUTH_TOKEN=sk-cp-your-token
ANTHROPIC_MODEL=MiniMax-M2.7

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenRouter (if using Hermes Agent)
OPENROUTER_API_KEY=sk-cp-your-token
OPENROUTER_BASE_URL=https://api.minimax.io/anthropic
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start.

## Vercel Deployment

1. Push to GitHub
2. Connect repo to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

## Supabase Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Get your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. For server-side operations, generate a `SUPABASE_SERVICE_ROLE_KEY`
4. Add to Vercel environment variables

## Hermes Agent + OpenRouter Setup

SEOMaster routes AI requests through OpenRouter-compatible endpoints. The MiniMax M2.7 model is used as the primary AI engine.

To integrate Hermes Agent:
1. Set up Hermes Agent with OpenRouter provider
2. Configure `OPENROUTER_API_KEY` and `OPENROUTER_BASE_URL`
3. AI requests automatically route through Hermes → MiniMax M2.7

## License

MIT