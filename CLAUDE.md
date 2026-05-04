# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project Overview

Project Harvest is a UIUC dining hall nutrition tracker. Students visit the GitHub Pages site to browse today's menus and generate personalized meal plans. Data is scraped nightly and served as static JSON — there is no live server in production.

## Repository Structure

```
Project-Harvest/
├── .github/workflows/        # CI/CD: daily scrape, GH Pages deploy, tests
├── Backend/
│   ├── scrapers/             # Python scraper (the data engine)
│   │   ├── nutrition_scraper.py   # Selenium scraper — main class
│   │   ├── load_to_db.py          # Excel → SQLite
│   │   ├── requirements.txt
│   │   └── tests/                 # pytest suite
│   ├── meal-planning/
│   │   └── meal_planner.py        # Optimization algorithm (local dev only)
│   ├── scripts/
│   │   └── validate_docs_api.py   # Validates Docs/api/ JSON on CI
│   ├── data/
│   │   └── nutrition_data.db      # SQLite — source of truth
│   ├── export_to_json.py     # DB → Docs/api/ + webapp/public/api/ JSON
│   ├── auth.js               # File-based user auth (local dev only)
│   ├── server.js             # Express API server (local dev only)
│   └── package.json
├── Docs/
│   ├── api/                  # Static JSON served by GitHub Pages
│   └── images/               # Dining hall photos (ISR, Ikenberry, Allen, PAR, Logo)
├── webapp/
│   ├── src/
│   │   ├── App.jsx           # Entire frontend (one file)
│   │   ├── main.jsx          # React entry point
│   │   └── index.css         # All styles
│   ├── public/api/           # Mirror of Docs/api/ for local dev (gitignored)
│   ├── index.html
│   ├── vite.config.js        # base: '/Project-Harvest/' for GH Pages
│   └── package.json
├── package.json              # Root script runner (npm run scrape etc.)
├── setup_dev.sh              # One-command local environment setup
└── start.sh                  # Start backend + webapp locally
```

## Data Pipeline

```
eatsmart.housing.illinois.edu
  → nutrition_scraper.py  (Selenium, headless Chrome)
  → Excel file (.xlsx, intermediate, gitignored)
  → load_to_db.py  → Backend/data/nutrition_data.db
  → export_to_json.py  → Docs/api/*.json + webapp/public/api/*.json
  → git push  → GitHub Pages serves the JSON
  → App.jsx fetches JSON at runtime
```

The daily scrape runs via `.github/workflows/daily-scrape.yml` at 8am Chicago time. After it completes, `deploy-react.yml` automatically rebuilds and redeploys the site.

## Key Commands

```bash
# Local setup (installs all deps, builds webapp)
npm run setup

# Run the full pipeline locally (scrape → DB → JSON)
npm run scrape           # 5 days
npm run scrape:today     # today only
npm run scrape:test      # fast, limited items

# Tests
npm test                 # runs pytest on scraper tests

# Local dev servers (backend on :3000, webapp on :5173)
npm start

# Webapp only
cd webapp && npm run dev
```

## Important Details

**Frontend is fully static in production.** `App.jsx` only fetches JSON files from `Docs/api/` — it never calls the Express server or meal planner. `auth.js`, `server.js`, and `meal_planner.py` are local-dev-only utilities.

**Date format:** All dates are stored as `YYYY-MM-DD` in the DB and JSON. The scraper normalizes page text like `"Monday, May 04, 2026"` via `normalize_date()` before storing.

**API files live in two places:**
- `Docs/api/` — committed to git, served by GitHub Pages
- `webapp/public/api/` — gitignored, used by Vite dev server locally

**Vite base path** is `/Project-Harvest/` — required for GH Pages subpath routing.

**`scrape` and `scrape:full`** do the same thing (5-day full scrape). `scrape:test` adds `--testing` flag.
