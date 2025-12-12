# Project Harvest - Complete Setup Guide

## Overview

**Project Harvest** is a university dining hall nutrition tracking and meal planning application. It consists of:
- **Flutter Web App** - Deployed on GitHub Pages
- **Node.js Backend API** - Needs to be deployed (Render.com recommended)
- **Python Web Scraper** - Automated daily data collection

## Current Status

✅ **Flutter Frontend**: Deployed at https://infoshubhjain.github.io/Project-Harvest/
✅ **Rebranded**: App now shows "Project Harvest" instead of "EasyEats"
✅ **Responsive Design**: Optimized for desktop, tablet, and mobile
✅ **Daily Scraping**: GitHub Actions workflow configured (runs at 1 AM UTC)
⚠️ **Backend API**: Needs deployment (see instructions below)

## Quick Start

### 1. Deploy the Backend API

The Flutter app needs a backend API to load dining hall menus. Deploy it to Render.com (free tier):

**Option A: Deploy via Render Dashboard**

1. Go to https://render.com and sign up/login
2. Click "New +" → "Web Service"
3. Connect your GitHub repository: `infoshubhjain/Project-Harvest`
4. Configure:
   - **Name**: `project-harvest-backend`
   - **Region**: Oregon (US West)
   - **Branch**: `master`
   - **Root Directory**: `Backend`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Click "Create Web Service"
6. Wait for deployment (5-10 minutes)
7. Copy your backend URL (e.g., `https://project-harvest-backend.onrender.com`)

**Option B: Deploy via render.yaml (Automatic)**

1. Push this repository to GitHub (already done)
2. Go to https://render.com/dashboard
3. Click "New +" → "Blueprint"
4. Select your repository
5. Render will automatically detect `render.yaml` and deploy

### 2. Update Flutter to Use Your Backend

After deploying the backend, update the API URL:

1. Edit [Frontend/flutter_easyeats/lib/config/api_config.dart](Frontend/flutter_easyeats/lib/config/api_config.dart)
2. Change line 4:
   ```dart
   static const String baseUrl = 'YOUR_RENDER_URL/api';
   ```
   Replace with your actual Render URL (e.g., `https://project-harvest-backend.onrender.com/api`)
3. Commit and push:
   ```bash
   git add Frontend/flutter_easyeats/lib/config/api_config.dart
   git commit -m "Update backend URL to deployed Render service"
   git push origin master
   ```
4. GitHub Actions will automatically rebuild and redeploy the web app

### 3. Enable Backend Features in Flutter

Once the backend is working:

1. Edit [Frontend/flutter_easyeats/lib/pages/home_page.dart](Frontend/flutter_easyeats/lib/pages/home_page.dart)
2. Find the `_loadData()` method (around line 35)
3. Uncomment the backend API calls (lines 47-70)
4. Comment out the mock version (lines 41-45)
5. Commit and push

## Automated Scraping

The scraper is configured to run daily at 1:00 AM UTC via GitHub Actions.

**Manual Trigger:**
1. Go to https://github.com/infoshubhjain/Project-Harvest/actions
2. Click "Daily Dining Hall Data Scrape"
3. Click "Run workflow"

**Configuration:**
- Workflow file: [.github/workflows/daily-scrape.yml](.github/workflows/daily-scrape.yml)
- Scraper code: [Backend/scrapers/nutrition_scraper.py](Backend/scrapers/nutrition_scraper.py)
- Data storage: [Backend/data/nutrition_data.db](Backend/data/nutrition_data.db)

### Validation and Tests
 - A dedicated action `.github/workflows/validate-api.yml` runs on push and PR and validates that `Docs/api/*.json` are non-empty and valid JSON; it will run a quick test scrape + export when validation fails and commit updates.
 - The scraper includes a `playback` mode and a small test suite under `Backend/scrapers/tests/` which validates selector logic with local HTML snapshots. Use `pytest` to run these tests.

## Local Development

### Backend (Node.js)

```bash
cd Backend
npm install
npm start
# Server runs on http://localhost:3000
```

### Frontend (Flutter)

```bash
cd Frontend/flutter_easyeats

# Install dependencies
flutter pub get

# Run on Chrome (web)
flutter run -d chrome

# Build for web
flutter build web
```

### Scraper (Python)

```bash
cd Backend/scrapers

# Install dependencies
pip install selenium beautifulsoup4 pandas openpyxl webdriver-manager

# Install ChromeDriver (Mac)
# NOTE: This project uses webdriver-manager to automatically download a compatible ChromeDriver.
# You can still install ChromeDriver via Homebrew if you prefer:
# brew install chromedriver

# Run scraper
python3 nutrition_scraper.py
```

## Architecture

```
Project Harvest
├── Frontend (Flutter)
│   ├── Web App (GitHub Pages)
│   ├── Responsive Design (Desktop/Tablet/Mobile)
│   └── Connects to Backend API
│
├── Backend (Node.js + Express)
│   ├── REST API Endpoints
│   ├── SQLite Database
│   └── Needs deployment (Render.com)
│
└── Scraper (Python + Selenium)
    ├── Scrapes UIUC dining menus
    ├── Automated via GitHub Actions
    └── Updates SQLite database
```

## API Endpoints

Base URL: `https://YOUR_RENDER_URL.onrender.com/api`

- `GET /dining-halls` - List all dining halls
- `GET /dining-halls/:hall/foods` - Get foods for a dining hall
  - Query params: `meal_type`, `date`
- `GET /recommendations/:userId` - Get recommended foods for user
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `GET /user/:userId/profile` - Get user profile
- `POST /user/:userId/meals` - Log a meal
- `GET /user/:userId/today-totals` - Get today's nutrition totals

## Troubleshooting

### Frontend shows "Network error"
- Backend isn't deployed yet, or URL in `api_config.dart` is incorrect
- Check Render dashboard to ensure backend is running

### Scraper not running
- Check GitHub Actions tab for errors
- Ensure repository has write permissions for Actions
- Chrome/ChromeDriver compatibility issues - check workflow logs

### Menu data is outdated
- Manually trigger the scraper workflow
- Check if scraper encountered errors (Actions logs)
- Verify database file is being updated

### Web app looks broken on desktop
- Clear browser cache
- Check if latest deployment succeeded (GitHub Actions)
- Verify responsive design code is deployed

## Next Steps

1. ✅ Deploy backend to Render.com
2. ✅ Update `api_config.dart` with backend URL
3. ✅ Test the app at https://infoshubhjain.github.io/Project-Harvest/
4. ✅ Enable backend API calls in home_page.dart
5. ✅ Run the scraper to populate fresh data

## Support

- GitHub Issues: https://github.com/infoshubhjain/Project-Harvest/issues
- Repository: https://github.com/infoshubhjain/Project-Harvest
