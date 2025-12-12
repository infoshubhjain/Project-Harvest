# Backend Deployment Alternatives (No Render Required)

## Quick Comparison

| Platform | Free Tier | Ease of Use | Best For |
|----------|-----------|-------------|----------|
| **Vercel** | ✅ Unlimited (fair use) | ⭐⭐⭐⭐⭐ Easiest | Serverless apps |
| **Railway** | ✅ $5/month credit | ⭐⭐⭐⭐ Easy | Traditional servers |
| **Fly.io** | ✅ Limited free | ⭐⭐⭐ Medium | Docker apps |
| **Cyclic** | ✅ 3 free apps | ⭐⭐⭐⭐⭐ Very Easy | Node.js apps |
| **GitHub Pages + Cloudflare Workers** | ✅ Free | ⭐⭐ Complex | Serverless edge |

---

## Option 1: Vercel (RECOMMENDED - 100% Free Forever)

**Why Vercel?**
- Completely free forever (no credit card needed)
- Automatic HTTPS
- Global CDN
- Zero configuration needed
- Instant deploys on every git push

### Step-by-Step Deployment

1. **Install Vercel CLI** (optional but easier)
   ```bash
   npm install -g vercel
   ```

2. **Deploy from Terminal**
   ```bash
   cd /Users/shubh/Desktop/Project-Harvest
   vercel
   ```
   - Follow prompts
   - Login with GitHub
   - Accept defaults
   - Done! Copy the URL

3. **OR Deploy from Website**
   - Go to https://vercel.com
   - Click "Add New" → "Project"
   - Import your GitHub repo: `infoshubhjain/Project-Harvest`
   - Vercel auto-detects settings
   - Click "Deploy"
   - Copy the provided URL (e.g., `https://project-harvest.vercel.app`)

4. **Update Your Flutter App**
   Edit `Frontend/flutter_easyeats/lib/config/api_config.dart`:
   ```dart
   static const String baseUrl = 'https://project-harvest.vercel.app/api';
   ```

**Note**: Your database and file uploads work on Vercel, but data persists only during the serverless function execution. For permanent storage, you'd need to:
- Use Vercel KV (key-value store) or
- Connect to external database (like Supabase - also free)

---

## Option 2: Railway.app (Easiest - $5/month free credit)

**Why Railway?**
- Very similar to Render
- $5 free credit per month (enough for this app)
- Supports traditional servers (your current setup works as-is)
- Database persistence included

### Deployment Steps

1. Go to https://railway.app
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select: `infoshubhjain/Project-Harvest`
5. Railway auto-detects Node.js
6. Settings → Environment:
   - `NODE_ENV` = `production`
7. Generate Domain (Settings → Generate Domain)
8. Copy the URL (e.g., `https://project-harvest-production.up.railway.app`)

9. **Update Your Flutter App**
   ```dart
   static const String baseUrl = 'https://project-harvest-production.up.railway.app/api';
   ```

---

## Option 3: Cyclic.sh (Great Free Tier)

**Why Cyclic?**
- 3 free apps forever
- Built specifically for Node.js
- File storage included
- Auto-deploys from GitHub

### Deployment Steps

1. Go to https://cyclic.sh
2. Connect GitHub account
3. Click "Deploy"
4. Select: `infoshubhjain/Project-Harvest`
5. Choose "Backend" folder as root (if prompted)
6. Deploy automatically starts
7. Copy the URL (e.g., `https://project-harvest.cyclic.app`)

8. **Update Your Flutter App**
   ```dart
   static const String baseUrl = 'https://project-harvest.cyclic.app/api';
   ```

---

## Option 4: Fly.io (Advanced - Free Tier)

**Why Fly.io?**
- Free tier includes 3 small VMs
- Full VM control (not serverless)
- Great for databases

### Deployment Steps

1. Install Fly CLI:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. Login and launch:
   ```bash
   cd /Users/shubh/Desktop/Project-Harvest/Backend
   fly launch
   ```

3. Follow prompts:
   - App name: `project-harvest-backend`
   - Region: Choose closest to you
   - PostgreSQL: No (we use SQLite)
   - Deploy: Yes

4. Copy URL (e.g., `https://project-harvest-backend.fly.dev`)

---

## Option 5: GitHub Pages + Cloudflare Workers (100% Free)

**Advanced Option**: Deploy backend as Cloudflare Workers (edge functions)

This requires rewriting your backend to work with Cloudflare Workers API, which is more complex but 100% free and incredibly fast.

---

## My Recommendation

### For You: **Vercel** (Option 1)

**Why?**
1. ✅ Completely free forever - no credit card, no limits (fair use)
2. ✅ I already configured your code to work with Vercel (`vercel.json` + `server.js` export)
3. ✅ Deploy in 30 seconds with one command: `vercel`
4. ✅ Auto-deploy on every git push
5. ✅ Global CDN + HTTPS included

**Only Caveat**: Database resets on each deploy (for permanent data, use Supabase free tier or Vercel KV)

For your use case (nutrition tracking app with scraped data), this is perfect because:
- Scraped data is in your GitHub repo (persists)
- User data can be stored in browser localStorage temporarily
- Or connect free Supabase PostgreSQL later (5 minutes setup)

---

## Quick Deploy with Vercel (Fastest)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd /Users/shubh/Desktop/Project-Harvest
vercel

# Follow prompts (press Enter for defaults)
# Copy the URL (e.g., https://project-harvest.vercel.app)

# Update Flutter app
# Edit: Frontend/flutter_easyeats/lib/config/api_config.dart
# Change baseUrl to your Vercel URL + /api

# Commit and push
git add .
git commit -m "Deploy backend to Vercel"
git push
```

**Your backend will be live in under 1 minute!**

---

## Need Help?

Let me know which option you prefer and I can help you deploy it!
