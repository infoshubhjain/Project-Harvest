# Deploy Backend Using GitHub + Cloudflare (100% Free)

## Why This is The Best Free Option

- ✅ **100% Free Forever** - Cloudflare Pages is completely free
- ✅ **No Credit Card Required**
- ✅ **Connects Directly to GitHub** - Auto-deploys on push
- ✅ **Unlimited Requests** (100k/day free tier)
- ✅ **Global CDN** - Fast worldwide
- ✅ **Works with Your Current Code**

## Architecture

```
GitHub Repo (Project-Harvest)
    ├── Frontend (Flutter) → GitHub Pages ✅ Already deployed
    └── Backend (Node.js) → Cloudflare Pages Functions (we'll deploy this)
```

---

## Option A: Cloudflare Pages Functions (Easiest)

Cloudflare Pages can host both static sites AND serverless functions (like your API).

### Step 1: Install Wrangler (Cloudflare CLI)

```bash
npm install -g wrangler
```

### Step 2: Login to Cloudflare

```bash
wrangler login
```
This opens a browser - authorize with your GitHub account.

### Step 3: Create Cloudflare Pages Project

1. Go to https://dash.cloudflare.com
2. Click "Workers & Pages"
3. Click "Create" → "Pages" → "Connect to Git"
4. Select your repository: `infoshubhjain/Project-Harvest`
5. Configure:
   - **Framework preset**: None
   - **Build command**: `cd Backend && npm install`
   - **Build output directory**: `Backend`
6. Click "Save and Deploy"

### Step 4: Your Backend URL

Cloudflare gives you a URL like:
```
https://project-harvest.pages.dev
```

Your API endpoints will be:
```
https://project-harvest.pages.dev/api/dining-halls
https://project-harvest.pages.dev/api/auth/login
etc.
```

### Step 5: Update Flutter App

Edit `Frontend/flutter_easyeats/lib/config/api_config.dart`:
```dart
static const String baseUrl = 'https://project-harvest.pages.dev/api';
```

Commit and push - your app auto-updates!

---

## Option B: Simple GitHub Pages API (Static JSON)

If you don't need dynamic backend (just menu data), serve it as static JSON files from GitHub Pages:

### How It Works:
1. Scraper updates JSON files → commits to GitHub
2. GitHub Pages serves JSON files
3. Flutter app fetches JSON directly (no backend server needed!)

### Setup:

1. **Create API directory in your repo:**
```bash
mkdir -p docs/api
```

2. **Export database to JSON:**

Create a script: `Backend/export_to_json.js`

```javascript
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'data', 'nutrition_data.db'));

// Export dining halls
db.all('SELECT DISTINCT dining_hall FROM nutrition_data ORDER BY dining_hall', [], (err, rows) => {
    const halls = rows.map(row => row.dining_hall);
    fs.writeFileSync('docs/api/dining-halls.json', JSON.stringify({ dining_halls: halls }));
});

// Export all foods by dining hall
db.all('SELECT * FROM nutrition_data', [], (err, rows) => {
    const byHall = {};
    rows.forEach(row => {
        if (!byHall[row.dining_hall]) {
            byHall[row.dining_hall] = [];
        }
        byHall[row.dining_hall].push(row);
    });

    // Save each dining hall as separate file
    Object.keys(byHall).forEach(hall => {
        const filename = hall.replace(/[^a-z0-9]/gi, '-').toLowerCase();
        fs.writeFileSync(
            `docs/api/${filename}.json`,
            JSON.stringify({ foods: byHall[hall] })
        );
    });

    console.log('API JSON files exported to docs/api/');
});

db.close();
```

3. **Run export script:**
```bash
cd Backend
node export_to_json.js
```

4. **Update GitHub Pages to serve from docs:**
- Go to your repo Settings → Pages
- Change source from `gh-pages` to `master` branch, `/docs` folder
- Save

5. **Your API is now:**
```
https://infoshubhjain.github.io/Project-Harvest/api/dining-halls.json
https://infoshubhjain.github.io/Project-Harvest/api/isr.json
https://infoshubhjain.github.io/Project-Harvest/api/par.json
```

6. **Update Flutter to use JSON directly:**

Modify services to fetch JSON instead of calling backend API.

**Pros:**
- 100% free
- No backend needed
- Fast (CDN)
- Simple

**Cons:**
- No authentication
- Read-only (no user data storage)
- Manual export needed

---

## Option C: GitHub Actions as Backend (Advanced)

Use GitHub Actions to run your backend on-demand via workflow_dispatch or scheduled triggers.

**Not recommended** - GitHub Actions isn't meant for this, and you'd need to keep it running 24/7.

---

## My Recommendation for You

### Go with **Cloudflare Pages** (Option A)

**Why?**
1. Free forever, no limits
2. Works with your current backend code
3. Auto-deploys from GitHub
4. Supports your database and APIs
5. 5-minute setup

### Alternative: **Static JSON** (Option B)

If you only need to display menus (no user accounts):
- Even simpler
- Pure GitHub Pages
- No external service
- Perfect for read-only data

---

## Which Should You Choose?

**Need user accounts, login, meal tracking?**
→ Use **Cloudflare Pages** (Option A)

**Just displaying dining hall menus?**
→ Use **Static JSON on GitHub Pages** (Option B) - simplest!

---

## Quick Setup - Cloudflare Pages

```bash
# Install Wrangler
npm install -g wrangler

# Login
wrangler login

# From your project root
cd /Users/shubh/Desktop/Project-Harvest

# Deploy
wrangler pages project create project-harvest
wrangler pages publish Backend --project-name=project-harvest

# Copy the URL and update api_config.dart
```

---

Let me know which approach you prefer and I'll help you set it up!
