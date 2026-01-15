# Deployment Guide - Grow Fortress

## Architecture

- **Frontend**: Vercel (Static SPA)
- **Backend**: Railway (Node.js + PostgreSQL + Redis)
- **Domain**: growfortress.com

---

## 1. Vercel Deployment (Frontend)

### Initial Setup

1. Go to [vercel.com](https://vercel.com) → Import Project
2. Connect GitHub repository: `growFortress/growfortress`
3. Settings:
   - **Framework**: None (manual config)
   - **Root Directory**: `./` (root)
   - **Build Command**: Auto-detected from `vercel.json`
   - **Output Directory**: `apps/web/dist`
4. Deploy

### Domain Setup

1. Add domain: `growfortress.com` and `www.growfortress.com`
2. Configure DNS (see DNS section below)

### Environment Variables

No environment variables needed - API URL is configured via `vercel.json` rewrites.

---

## 2. Railway Deployment (Backend)

### Initial Setup

1. Go to [railway.app](https://railway.app) → New Project
2. **Deploy from GitHub Repo**:
   - Repository: `growFortress/growfortress`
   - Branch: `main`

### Add Services

#### PostgreSQL

1. Click "New" → "Database" → "Add PostgreSQL"
2. Railway will automatically set `DATABASE_URL` environment variable

#### Redis

1. Click "New" → "Database" → "Add Redis"
2. Railway will automatically set `REDIS_URL` environment variable

### Environment Variables (Server)

Set these in Railway Dashboard → Server → Variables:

```bash
# Server
NODE_ENV=production
PORT=3000

# CORS
CORS_ORIGINS=https://growfortress.com,https://www.growfortress.com

# Auth - GENERATE NEW SECRETS!
# Generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=<GENERATE_UNIQUE_64_CHAR_HEX>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Run Token - GENERATE NEW SECRET!
RUN_TOKEN_SECRET=<GENERATE_UNIQUE_64_CHAR_HEX>
RUN_TOKEN_EXPIRY_SECONDS=600

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000

# Stripe (LIVE KEYS)
STRIPE_SECRET_KEY=<STRIPE_SECRET_KEY>
STRIPE_WEBHOOK_SECRET=<STRIPE_WEBHOOK_SECRET>
STRIPE_SUCCESS_URL=https://growfortress.com/shop?success=true
STRIPE_CANCEL_URL=https://growfortress.com/shop?canceled=true

# Email (Optional - for password reset)
# SMTP_HOST=smtp.sendgrid.net
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=apikey
# SMTP_PASS=<SENDGRID_API_KEY>
```

### Database Migration

After deploying, run migrations:

1. Railway Dashboard → Server → Terminal
2. Run:
   ```bash
   pnpm --filter @arcade/server exec prisma migrate deploy
   ```

### Domain Setup

1. Railway Dashboard → Server → Settings → Domains
2. Add custom domain: `api.growfortress.com`
3. Copy the CNAME target provided by Railway

---

## 3. DNS Configuration

### At your domain registrar (e.g., Cloudflare, Namecheap):

```
# Frontend (Vercel)
growfortress.com      → CNAME → cname.vercel-dns.com
www.growfortress.com  → CNAME → cname.vercel-dns.com

# Backend (Railway)
api.growfortress.com  → CNAME → <RAILWAY_PROVIDED_CNAME>
```

---

## 4. Stripe Configuration

### Webhook Setup

1. Go to: https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://api.growfortress.com/v1/shop/webhook`
4. Events to send:
   - `checkout.session.completed`
   - `checkout.session.expired`
5. Copy the **Signing secret** (starts with `whsec_`)
6. Update `STRIPE_WEBHOOK_SECRET` in Railway

### Test Payments

Use Stripe test cards: https://stripe.com/docs/testing

---

## 5. Post-Deployment Checklist

- [ ] Frontend loads at `growfortress.com`
- [ ] API health check: `https://api.growfortress.com/health`
- [ ] User registration works
- [ ] User login works
- [ ] Game session starts and runs
- [ ] Stripe checkout redirects correctly
- [ ] Webhook receives payment confirmations
- [ ] Database migrations applied

---

## 6. Monitoring & Logs

### Railway

- Dashboard → Server → Logs (real-time)
- Dashboard → PostgreSQL → Metrics

### Vercel

- Dashboard → Deployments → [Latest] → Logs

---

## 7. Rollback

### Vercel

Dashboard → Deployments → Previous deployment → Promote to Production

### Railway

Dashboard → Server → Deployments → Previous deployment → Redeploy

---

## Admin Credentials

**Username**: `adminfortress`
**Password**: `olXKKvqiLTf99o2pky_OQA`

Login at: `https://growfortress.com` → Use admin panel at `/admin/`
