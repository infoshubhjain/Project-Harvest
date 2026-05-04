# Project Harvest — Complete Technical Reference

A UIUC dining hall nutrition tracker. Students visit the GitHub Pages site to browse today's dining hall menus and generate personalized meal plans. Data is scraped nightly and served as static JSON files — there is no live server in production.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Repository Structure](#repository-structure)
3. [Data Pipeline — End to End](#data-pipeline--end-to-end)
4. [Python Scraper — `nutrition_scraper.py`](#python-scraper--nutrition_scraperpy)
5. [Database Loader — `load_to_db.py`](#database-loader--load_to_dbpy)
6. [JSON Exporter — `export_to_json.py`](#json-exporter--export_to_jsonpy)
7. [Meal Planning Algorithm — `meal_planner.py`](#meal-planning-algorithm--meal_plannerpy)
8. [Express Backend — `server.js`](#express-backend--serverjs)
9. [Authentication Module — `auth.js`](#authentication-module--authjs)
10. [React Frontend — `App.jsx`](#react-frontend--appjsx)
11. [Vite Configuration — `vite.config.js`](#vite-configuration--viteconfigjs)
12. [GitHub Actions Workflows](#github-actions-workflows)
    - `daily-scrape.yml`
    - `deploy-react.yml`
    - `validate-api.yml`
    - `scraper-tests.yml`
13. [Scraper Tests](#scraper-tests)
    - `test_playback_scraper.py`
    - `test_selectors_playback.py`
    - `test_remote_page_structure.py`
    - `sample_snapshot.html`
14. [API Validator — `validate_docs_api.py`](#api-validator--validate_docs_apipy)
15. [Local Development Scripts](#local-development-scripts)
16. [Key Architectural Decisions](#key-architectural-decisions)

---

## Architecture Overview

```
                        ┌──────────────────────────────────────┐
                        │  eatsmart.housing.illinois.edu       │
                        │  (UIUC EatSmart nutrition portal)    │
                        └────────────────┬─────────────────────┘
                                         │ Selenium headless Chrome
                                         ▼
                        ┌──────────────────────────────────────┐
                        │  nutrition_scraper.py                │
                        │  Scrapes: hall → service → date →    │
                        │  meal → item → nutrition modal       │
                        └────────────────┬─────────────────────┘
                                         │ .xlsx (intermediate, gitignored)
                                         ▼
                        ┌──────────────────────────────────────┐
                        │  load_to_db.py                       │
                        │  Excel → SQLite (nutrition_data.db)  │
                        └────────────────┬─────────────────────┘
                                         │ SQLite queries
                                         ▼
                        ┌──────────────────────────────────────┐
                        │  export_to_json.py                   │
                        │  DB → Docs/api/*.json                │
                        │     → webapp/public/api/*.json       │
                        └────────────────┬─────────────────────┘
                                         │ git commit + push
                                         ▼
                        ┌──────────────────────────────────────┐
                        │  GitHub Pages                        │
                        │  Serves static JSON + React bundle   │
                        └────────────────┬─────────────────────┘
                                         │ fetch() at runtime
                                         ▼
                        ┌──────────────────────────────────────┐
                        │  App.jsx (React, runs in browser)    │
                        │  Browse menus + build meal plans     │
                        └──────────────────────────────────────┘
```

**Production is 100% static.** The React app fetches JSON files committed to git and served by GitHub Pages. The Express server (`server.js`) and meal planner Python script (`meal_planner.py`) only run during local development.

---

## Repository Structure

```
Project-Harvest/
├── .github/
│   └── workflows/
│       ├── daily-scrape.yml       # Runs scraper at 8am Chicago time daily
│       ├── deploy-react.yml       # Builds + deploys React to GitHub Pages
│       ├── validate-api.yml       # Validates Docs/api JSON on every push; auto-repairs
│       └── scraper-tests.yml      # Runs pytest suite on every push/PR
├── Backend/
│   ├── scrapers/
│   │   ├── nutrition_scraper.py   # Main Selenium scraper (1308 lines)
│   │   ├── load_to_db.py          # Excel → SQLite loader
│   │   ├── requirements.txt       # Python deps (selenium, pandas, requests, etc.)
│   │   └── tests/
│   │       ├── test_playback_scraper.py    # Tests scraper class in playback mode
│   │       ├── test_selectors_playback.py  # Tests CSS selectors against saved snapshot
│   │       ├── test_remote_page_structure.py  # Tests live EatSmart page (skips if offline)
│   │       └── sample_snapshot.html        # Committed HTML fixture for offline tests
│   ├── meal-planning/
│   │   └── meal_planner.py        # Optimization algorithm (local dev only)
│   ├── scripts/
│   │   └── validate_docs_api.py   # Validates Docs/api JSON structure
│   ├── data/
│   │   └── nutrition_data.db      # SQLite — single source of truth
│   ├── export_to_json.py          # DB → JSON API files
│   ├── auth.js                    # File-based user auth (local dev only)
│   ├── server.js                  # Express API server (local dev only)
│   └── package.json               # Backend Node deps + start/dev scripts
├── Docs/
│   ├── api/                       # Static JSON served by GitHub Pages
│   │   ├── dining-halls.json      # List of all dining halls
│   │   ├── available-meals.json   # All (meal_type, date) pairs in DB
│   │   ├── ikenberry-dining-center-(ike).json
│   │   ├── illinois-street-dining-center-(isr).json
│   │   ├── pennsylvania-avenue-dining-hall-(par).json
│   │   ├── lincoln-avenue-dining-hall-(lar).json
│   │   └── everybody-eats.json
│   └── images/                    # Dining hall photos
│       ├── ISR.jpg
│       ├── Ikenberry.jpg
│       ├── Allen.jpg
│       ├── PAR.webp
│       └── Logo.png
├── webapp/
│   ├── src/
│   │   ├── App.jsx                # Entire React frontend (915 lines, one file)
│   │   ├── main.jsx               # React entry point — mounts App into #root
│   │   └── index.css              # All styles (global, no CSS modules)
│   ├── public/api/                # Mirror of Docs/api/ for local dev (gitignored)
│   ├── index.html                 # Vite HTML entry point
│   ├── vite.config.js             # base: '/Project-Harvest/' for GH Pages
│   └── package.json               # React + Vite deps
├── package.json                   # Root script runner (npm start, npm run scrape, etc.)
├── setup_dev.sh                   # One-command local dev setup
└── start.sh                       # Starts backend (:3000) + webapp (:5173)
```

---

## Data Pipeline — End to End

### Step 1 — Scraper (`nutrition_scraper.py`)

Selenium opens a headless Chrome browser and navigates to `https://eatsmart.housing.illinois.edu/NetNutrition/1`. It reads the dropdown navigation to discover all dining halls and their sub-services (e.g. ISR has "ISR — Breakfast Service", "ISR — Lunch Service", etc.). For each service, it clicks through up to 5 days of date dropdowns, then for each date clicks each meal period (Breakfast/Lunch/Dinner) to load the food list, and finally clicks every individual food item to open its nutrition modal and extract the data. Results are saved to an `.xlsx` file.

### Step 2 — Load to DB (`load_to_db.py`)

Reads the newest `.xlsx` file and inserts rows into `Backend/data/nutrition_data.db`. Before inserting, it **deletes only the specific (dining_hall, date) pairs** it is about to re-write — this preserves historical data from prior scrapes.

### Step 3 — Export to JSON (`export_to_json.py`)

Queries SQLite and writes static JSON files into two directories:
- `Docs/api/` — committed to git, what GitHub Pages serves
- `webapp/public/api/` — gitignored, used by Vite dev server locally

### Step 4 — Git Push

The CI workflow runs `git add Docs/api/ ... && git commit && git push`. This push triggers `deploy-react.yml` via `workflow_run`, which rebuilds the React app and redeploys to the `gh-pages` branch.

### Step 5 — GitHub Pages

GitHub Pages serves the `gh-pages` branch. All JSON files are available at `https://infoshubhjain.github.io/Project-Harvest/api/*.json`.

### Step 6 — App.jsx (browser)

When a user opens the site, React fetches the JSON files at runtime. No server is involved. The meal builder algorithm runs entirely in the browser.

---

## Python Scraper — `nutrition_scraper.py`

**File:** `Backend/scrapers/nutrition_scraper.py` (1308 lines)

### Python dependencies — `requirements.txt`

```
selenium>=4.15.0       # Browser automation
beautifulsoup4>=4.9.0  # HTML parsing in playback mode and category extraction
pandas>=1.3.0          # DataFrame for building/exporting the Excel file
openpyxl>=3.0.0        # Excel read/write engine used by pandas
webdriver-manager>=4.0.0  # Auto-downloads the correct ChromeDriver
pytest>=7.0.0          # Test runner for the scraper tests
requests>=2.28.0       # Used by test_remote_page_structure.py to fetch the live EatSmart page
```

### Module-level constants

```python
MAIN_DINING_HALLS = [
    "Pennsylvania Avenue Dining Hall (PAR)",
    "Lincoln Avenue Dining Hall (LAR)",
    "Ikenberry Dining Center (Ike)",
    "Illinois Street Dining Center (ISR)",
]
```

Used by `fast_mode=True` (the default) to filter scraped halls down to only the four main residential dining halls, skipping specialty venues like "Everybody Eats" or cafes. In CI the default is fast mode. The `--full` flag disables it.

### `retry_on_exception(max_attempts, backoff)` — module-level decorator

A decorator factory that wraps any method with retry logic. On failure it sleeps `backoff * attempt` seconds before retrying (exponential-ish back-off). After all attempts are exhausted it appends the failed call to `self.missed_tasks` (a list on the scraper instance) for a final re-try pass at the end of the run, then re-raises the exception. Used on all major navigation methods.

---

### `class NutritionScraperComplete`

The entire scraper is one class. All state lives on `self`.

#### `__init__(testing_mode, headless, playback_mode, fast_mode)`

Sets up Chrome via `webdriver-manager`, which auto-downloads the correct ChromeDriver version for the installed Chrome. Options set:
- `--headless=new` — modern headless mode (used in CI, optional locally)
- `--no-sandbox`, `--disable-dev-shm-usage` — required for Linux/Docker
- `--disable-blink-features=AutomationControlled` + fake user-agent — reduces bot-detection signals
- `--disable-gpu`, `--window-size=1920,1080` — headless stability

If `playback_mode=True`, **no browser is launched** (`self.driver = None`). The scraper reads saved HTML snapshots from disk instead, which is only used by the test suite.

Key instance attributes:
- `self.testing_mode` — limits to 1 hall, 1 service, 5 items per meal
- `self.fast_mode` — filters halls to `MAIN_DINING_HALLS`
- `self.max_items_per_meal` — `5` in testing, `None` (unlimited) in production
- `self.missed_tasks` — list of failed method calls for end-of-run retry
- `self.debug_dir` — `Backend/scrapers/debug_fragments/` (gitignored)
- `self.snapshots_dir` — `Backend/scrapers/snapshots/` (gitignored)
- `self.save_snapshots` — saves full page HTML on failure when `True`

---

#### `scrape_dining_structure()`

Navigates to the main page and reads the `#nav-unit-selector` dropdown. Each `<a data-unitoid="...">` element in the dropdown represents either a dining hall (marked with CSS class `text-primary`) or a sub-service under it. The method loops through all anchors, building a list:

```python
[
  {
    'dining_hall': 'Ikenberry Dining Center (Ike)',
    'unit_id': '7',
    'dining_services': [
      {'service_name': 'Ike – Breakfast', 'service_id': '8'},
      {'service_name': 'Ike – Lunch', 'service_id': '9'},
      ...
    ]
  },
  ...
]
```

In **playback mode**, instead of navigating with Selenium, it reads a saved HTML file from `snapshots_dir` and parses it with BeautifulSoup. This is how the test suite works without a real browser.

If `self.fast_mode`, the result is filtered to `MAIN_DINING_HALLS` before returning.

---

#### `navigate_to_service(unit_id, service_name)`

Navigates to the base URL, finds the dropdown, and clicks the link with the given `data-unitoid`. Waits for `#nav-date-selector` to appear (confirming the page loaded) instead of using a fixed sleep. Decorated with `@retry_on_exception(max_attempts=3, backoff=3)`.

---

#### `get_available_dates_for_next_n_days(n_days=5)`

Reads `#nav-date-selector` dropdown. Each link has a `data-date` attribute: either `"Today"` or a date string like `"05/04/2026"`. The method:
1. Computes `target_dates` = today + next n-1 days as `date` objects
2. Parses each dropdown item's `data-date`
3. Includes only items whose parsed date falls within `target_dates`
4. Sorts by date and returns a list of dicts including the original Selenium element

**Why this matters:** The site shows dates for the whole week. We only want the next N days. Filtering by `target_dates` ensures we don't accidentally scrape stale past dates.

---

#### `select_date(date_element)`

Clicks a date element using JavaScript (more reliable than `.click()` in headless mode). Waits for `#navBarResults` to appear, confirming the date was applied. Decorated with `@retry_on_exception`.

---

#### `get_all_meals_structured()`

After a date is selected, the `#navBarResults` panel lists all meal periods (e.g. "Thursday, May 05, 2026-Breakfast"). Each `<li class="list-group-item">` element contains the text in `"Date-MealType"` format. The method:
1. Reads `textContent` (not `.text`, which can be empty in headless mode)
2. Splits on the last `-` to separate date from meal type
3. Normalises the meal type against known types: `['Breakfast', 'Lunch', 'Dinner', 'Brunch', 'Late Night']`
4. Returns a list of dicts including the live Selenium `element` reference

**Important:** These element references go stale after any page navigation. The main scrape loop re-fetches them fresh before each meal click.

---

#### `click_meal(meal_element)`

Executes the element's `onclick` attribute directly via JavaScript, or falls back to clicking the element. Waits for food items (`a.cbo_nn_itemHover`) or group headers to appear before returning.

---

#### `extract_category_map()`

Before extracting individual food items, this method reads the `<tr class="cbo_nn_itemGroupRow">` category header rows. Each header is followed by food rows with a `data-categoryid` attribute. The method builds a dict `{category_id: category_name}` by reading each header's text and correlating it with the `data-categoryid` of the next sibling row via JavaScript.

---

#### `extract_nutrition_info(max_items=None)`

The main item-extraction loop:
1. Calls `extract_category_map()` to know which category each food belongs to
2. Finds all `a.cbo_nn_itemHover` elements (one per food item on the current menu)
3. For each item:
   - Gets the food name from `.text` or `.innerHTML` via BeautifulSoup fallback
   - Finds the item's parent `<tr>` and reads its `data-categoryid` to look up the category
   - Scrolls the element into view and clicks it to open the nutrition modal
   - Waits for the modal (`div[class*='modal'][class*='show']`) to appear
   - Calls `extract_nutrition_from_modal(food_name)` to read the nutrition data
   - Calls `close_modal()` to dismiss and move to the next item

If `max_items` is set (testing mode), only the first N items are processed.

---

#### `close_modal()`

Tries multiple CSS selectors to find a close button (`button[class*='close']`, `button[data-dismiss='modal']`, etc.). Falls back to dispatching an Escape key event. Does not fail hard — if it can't close, scraping continues.

---

#### `extract_nutrition_from_modal(food_name)`

Reads the entire modal text, splits it into lines, and searches for known nutrition keywords: `calories`, `total fat`, `saturated fat`, `trans fat`, `cholesterol`, `sodium`, `potassium`, `total carbohydrate`, `dietary fiber`, `sugars`, `protein`. For each line matching a keyword, calls `extract_nutrition_value()` to pull out the number.

Returns:
```python
{
  'name': 'Grilled Chicken Breast',
  'serving_size': '4 oz',
  'nutrition': {
    'calories': '180',
    'protein': '28',
    'total_fat': '4',
    ...
  }
}
```

---

#### `normalize_date(date_str)`

Converts any date format the site produces to `YYYY-MM-DD`:
- `"Monday, May 04, 2026"` → `"2026-05-04"`
- `"Today, May 04, 2026"` → `"2026-05-04"`
- `"2026-05-04"` → passthrough (already normalized)

The key step: strip the leading weekday/label using `re.sub(r'^[^,]+,\s*', '', ...)`, then try `datetime.strptime` with three format strings (`%B %d, %Y`, `%b %d, %Y`, `%m/%d/%Y`). Falls back to returning the original string unchanged.

**Why this matters:** `App.jsx`'s `parseMenuDate()` only parses `YYYY-MM-DD`. If dates are stored in the old "Tuesday, March 10, 2026" format, the frontend silently discards them and shows nothing.

---

#### `parse_nutrition_value(value_str)`

Converts a raw nutrition string to a standardized number string (grams, no units):
- `"500mg"` → `"0.5"` (converts mg to g)
- `"2.5g"` → `"2.5"`
- `"N/A"` / `""` / `"-"` → `"0"`
- Trailing zeros stripped: `"2.000"` → `"2"`

Uses regex `r'^\s*([0-9.]+)\s*(MG|G|GRAMS?|MILLIGRAMS?)?\s*$'` to extract value and unit.

---

#### `extract_nutrition_value(line, keyword)`

Finds the keyword position in a text line, takes the text immediately after it, and strips everything from the first space or `%` character onward. Passes the result to `parse_nutrition_value()`.

---

#### `_save_debug_fragment(name, reason)` / `_append_debug_log(message)` / `_save_snapshot(filename)`

Debug helpers. When a selector fails or an exception is caught, these save the raw page HTML to `debug_fragments/` or `snapshots/` (both gitignored). `_append_debug_log` writes to a plaintext log in the same directory. These are only written when an exception occurs (or when `save_snapshots=True`).

---

#### `scrape_all_with_complete_data(days_to_scrape=5)`

The main orchestration method. The full algorithm:

```
for each dining_hall:
  for each service in dining_hall:
    navigate_to_service(service_id)
    available_dates = get_available_dates_for_next_n_days(days_to_scrape)
    
    for each (data_date, date_str) in available_dates:
      
      # Pass 1: get the list of meal names for this date
      navigate_to_service(service_id)
      click date via JS
      meal_definitions = get_all_meals_structured()
      deduplicate meal_definitions by (date, meal_type)
      
      # Pass 2: for each meal, start fresh and scrape items
      for each meal_def:
        navigate_to_service(service_id)   # fresh state every time
        click date via JS
        current_meals = get_all_meals_structured()   # fresh elements
        target = current_meals[meal_def.index]
        click_meal(target.element)
        nutrition_items = extract_nutrition_info()
        
        for each item in nutrition_items:
          append result dict to all_results
          (includes dining_hall, service, date=normalize_date(...), meal_type, 
           category, name, serving_size, calories, protein, fat, carbs, ...)
```

**Why re-navigate for every meal?** Selenium elements go stale after any page navigation. Rather than trying to track and refresh references, the scraper resets to a known state (service home page) before each meal. Slower but far more robust.

After all scraping, any `missed_tasks` from the retry decorator are re-attempted.

---

#### `export_to_excel(all_results, filename=None)`

Creates a pandas DataFrame from `all_results`, sorts it, reorders columns, and writes to an `.xlsx` file using `openpyxl`. Applies blue header formatting and auto-column widths. Filename includes a timestamp: `complete_dining_data_YYYYMMDD_HHMMSS.xlsx`.

---

#### `__main__` block

Command-line interface:
- `--testing` — fast mode (1 hall, 1 service, 5 items/meal)
- `--days N` — how many days to scrape (default: 5)
- `--full` — disables fast_mode, scrapes all halls
- `--headless` / `--no-headless` — toggle Chrome UI
- `--save-snapshots` — save HTML on failure
- `--playback DIR` — parse snapshots instead of live scraping

---

## Database Loader — `load_to_db.py`

**File:** `Backend/scrapers/load_to_db.py` (280 lines)

### `create_nutrition_table(conn)`

Creates the `nutrition_data` table if it doesn't exist:

```sql
CREATE TABLE IF NOT EXISTS nutrition_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dining_hall TEXT NOT NULL,
    service TEXT NOT NULL,
    date TEXT NOT NULL,           -- always YYYY-MM-DD
    meal_type TEXT NOT NULL,      -- Breakfast / Lunch / Dinner
    category TEXT,
    name TEXT NOT NULL,
    serving_size TEXT,
    calories REAL,
    total_fat REAL,
    saturated_fat REAL,
    trans_fat REAL,
    cholesterol REAL,
    sodium REAL,
    potassium REAL,
    total_carbohydrate REAL,
    dietary_fiber REAL,
    sugars REAL,
    protein REAL,
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

Also creates three indexes for fast querying: `idx_dining_hall`, `idx_date_meal`, and `idx_name`.

---

### `load_excel_to_database(excel_file, db_file)`

1. Reads the `.xlsx` with `pd.read_excel()`
2. Connects to SQLite and calls `create_nutrition_table()`
3. **Targeted deletion:** extracts all unique `(dining_hall, date)` pairs from the DataFrame and issues a `DELETE WHERE dining_hall = ? AND date = ?` for each pair. This means:
   - Re-scraping today only → today's rows replaced, yesterday's rows preserved
   - Re-scraping all 5 days → all 5 days replaced
   - Historical dates not in the Excel file → untouched
4. Inserts all rows with `pd.notna()` guards on every numeric column (SQLite doesn't accept `NaN`)
5. Prints a summary: total items, halls, dates, meal types

Fallback behavior: if there's no `date` column, clears all rows for the hall (old behavior). If there's no `dining_hall` column at all, just appends without clearing.

---

### `query_database(db_file)` — example queries

Demonstrates three SQL queries for documentation/dev purposes: item count by hall, high-protein items (>20g), and average calories by meal type. Only runs if you call the script directly.

---

## JSON Exporter — `export_to_json.py`

**File:** `Backend/export_to_json.py` (79 lines)

Reads from `Backend/data/nutrition_data.db` and writes to **both** output directories simultaneously:
- `Docs/api/` — committed to git
- `webapp/public/api/` — local dev only (gitignored)

### Files produced

**`dining-halls.json`**
```json
{
  "dining_halls": ["Ikenberry...", "Illinois Street...", ...],
  "count": 5,
  "last_updated": "2026-05-04T10:32:15.123456"
}
```

**`<hall-name>.json`** (one per hall, filename is lowercase with spaces → hyphens)
```json
{
  "dining_hall": "Ikenberry Dining Center (Ike)",
  "foods": [
    {
      "name": "Grilled Chicken",
      "category": "Entrée",
      "serving_size": "4 oz",
      "calories": 180,
      "protein": 28,
      "total_fat": 4,
      "total_carbohydrate": 0,
      "dietary_fiber": 0,
      "sugars": 0,
      "sodium": 65,
      "meal_type": "Lunch",
      "date": "2026-05-04"
    },
    ...
  ],
  "count": 450,
  "last_updated": "2026-05-04T10:32:15.123456"
}
```

The query uses `SELECT DISTINCT ... ORDER BY date DESC, meal_type, category, name` — so newer dates appear first.

**`available-meals.json`**
```json
{
  "meals": [
    {"meal_type": "Breakfast", "date": "2026-05-05"},
    {"meal_type": "Lunch",     "date": "2026-05-05"},
    ...
  ],
  "count": 80,
  "last_updated": "..."
}
```

Currently not used by the frontend but useful for tools or debugging.

---

## Meal Planning Algorithm — `meal_planner.py`

**File:** `Backend/meal-planning/meal_planner.py` (626 lines)

**Important:** This is a local-dev-only utility. It is called by `server.js` but `server.js` is never deployed. The production React app has its own built-in meal planning logic (see `generateBest()` in App.jsx).

### `class MealPlanner`

#### `__init__(db_file, excel_file)`

Optionally loads from a SQLite DB or Excel file. Defines four nutritional goals as macro ratio dictionaries:

| Goal | Protein | Fat | Carbs | Description |
|------|---------|-----|-------|-------------|
| `balanced` | 30% | 30% | 40% | Even macros |
| `weight_loss` | 40% | 25% | 35% | High protein |
| `bulking` | 30% | 20% | 50% | High carb/calorie |
| `keto` | 25% | 70% | 5% | High fat, low carb |

#### `load_data()`

Reads all rows from SQLite into a pandas DataFrame (or from Excel if provided).

#### `get_current_meal_type()`

Auto-detects meal period from current time: 6–10am = Breakfast, 10am–3pm = Lunch, 3–9pm = Dinner, otherwise Breakfast.

#### `filter_available_items(dining_hall, meal_type, date)`

Filters the DataFrame to rows matching the hall (partial string match), meal type, and optional date. Also removes rows with missing or zero calories/protein/fat.

#### `categorize_items(items_df)`

Classifies items into food groups using keyword matching on both `category` and `name` columns:
- `protein` — entrée, chicken, beef, fish, tofu, egg, etc.
- `carbs` — grain, rice, pasta, bread, potato, noodle, etc.
- `vegetables` — broccoli, spinach, salad, greens, etc.
- `other` — everything else (fallback)

Returns a dict of DataFrames keyed by group name.

#### `filter_by_dietary_restrictions(items_df, vegetarian, vegan)`

Removes items whose name contains meat keywords (for vegetarian or vegan) or dairy/egg keywords (for vegan only). Also checks the `category` column for "Meat", "Fish", "Poultry" (vegetarian) and "Dairy", "Egg" (vegan).

#### `score_item(item, goal_config)`

Scores a single food item based on its macro density (macros per 100 calories):
- Protein density vs. goal protein ratio — up to 30 pts
- Fat density — up to 20 pts (penalizes high fat for non-keto; rewards high fat for keto)
- Carb density — up to 30 pts for keto (low carb = good), 10 pts for others (moderate carbs = good)
- Fiber — always adds up to 15 pts

#### `generate_random_meal(categories, target_calories, goal_config, max_items=5)`

Random baseline generation:
1. Pick one random protein item
2. Pick one random vegetable
3. Fill remaining slots (up to `max_items`) by picking randomly from any category, skipping duplicates and items that would push total calories >120% of target

Used to generate the initial population for optimization.

#### `is_discrete_item(name)`

Returns `True` for items that come in discrete units (buns, eggs, cookies, apples, etc.) — these get servings rounded to nearest 0.5 rather than continuously scaled.

#### `optimize_servings(items, target_calories)`

Adjusts serving sizes to hit the calorie target:
1. Computes a global scale factor = `target_calories / total_current_calories`
2. Discrete items: rounds servings to nearest 0.5, min 0.5
3. Continuous items: scales to fill the calorie gap left by the discrete items
4. Clamps scales to sensible ranges (0.2x – 3.0x)

#### `evaluate_meal(items, target_calories, goal_config, target_protein)`

Scores a complete meal on four axes:
1. **Calorie score** (100 pts max) — how close total is to target (0 pts if >50% off)
2. **Protein score** (100 pts max) — how close total protein is to target (only if `target_protein` specified)
3. **Macro balance score** (100 pts max) — Euclidean distance from goal macro ratios in 3D (protein%, carb%, fat% space)
4. **Diversity score** (bonus) — 10 pts per unique food category present

Weights: `0.30 * cal + 0.25 * protein + 0.35 * macro + 0.10 * diversity` (when protein target is set).

#### `smart_repair(items, target_calories, goal_config, target_protein)`

Iterative improvement step:
1. Identifies which item to remove ("worst" — either highest-calorie if over budget, lowest-protein if under protein target, or random otherwise)
2. Samples up to 5 candidates from each food category
3. For each candidate, tries swapping it in, optimizes servings, scores the result
4. Keeps the swap if it improves the score

#### `create_meal_plan(target_calories, dining_hall, meal_type, goal, target_protein, date, vegetarian, vegan)`

Full optimization pipeline:
1. Filter available items, apply dietary restrictions
2. Categorize items
3. Generate 20 random initial meals (`generate_random_meal`)
4. Score all 20 with `evaluate_meal`
5. Take the top 5 and apply 50 iterations of `smart_repair` on each
6. Return the best-scoring meal found anywhere in the process

Returns a dict with: `dining_hall`, `meal_type`, `date`, `dietary`, `goal`, `target_calories`, `actual_calories`, `items` (list), `totals` (calories/protein/fat/carbs + percentages), `meets_target`.

---

## Express Backend — `server.js`

**File:** `Backend/server.js` (519 lines)

**Local dev only.** Runs on `http://localhost:3000`.

### npm dependencies — `Backend/package.json`

```json
"dependencies": {
  "cors":    "^2.8.6",    // Cross-Origin headers — allows the Vite dev server (port 5173) to call this server (port 3000)
  "dotenv":  "^16.6.1",  // Loads .env file; currently unused in code but available for PORT or DB_PATH overrides
  "express": "^4.22.1",  // HTTP server framework
  "sqlite3": "^6.0.1"    // Native SQLite bindings for Node.js
}
```

`npm start` runs `node server.js`. `npm run dev` uses `node --watch server.js` (Node.js built-in file watcher, no nodemon needed).

### Setup

- `express`, `cors`, `sqlite3`, `dotenv` (npm packages)
- Connects to `Backend/data/nutrition_data.db`
- Serves `Docs/api/` as static files at `/api/*` — this means when the Express server is running locally, `GET /api/dining-halls.json` serves the committed JSON file, matching the production GitHub Pages structure

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/dining-halls` | Lists all halls from SQLite |
| `GET` | `/api/dining-halls/:hall/foods` | Foods for a hall, with optional `?meal_type=&date=` filters |
| `GET` | `/api/recommendations/:userId` | Top-20 high-protein foods for a user's calorie target |
| `POST` | `/api/auth/register` | Register new user (email + password) |
| `POST` | `/api/auth/login` | Login and return user profile |
| `PUT` | `/api/user/:userId/profile` | Update goal, age, sex, calories, dietary restrictions |
| `GET` | `/api/user/:userId/profile` | Get full user profile |
| `POST` | `/api/user/:userId/change-password` | Change password |
| `POST` | `/api/user/:userId/favorites` | Add a food item to favorites |
| `DELETE` | `/api/user/:userId/favorites/:index` | Remove a favorite by index |
| `POST` | `/api/user/:userId/meals` | Log a consumed meal |
| `GET` | `/api/user/:userId/meals` | Get meal history (filterable by date) |
| `GET` | `/api/user/:userId/today-totals` | Today's macro totals for a user |
| `DELETE` | `/api/user/:userId/meals/:mealId` | Delete a logged meal |
| `GET` | `/api/meal-plan` | Calls `meal_planner.py` as a subprocess |
| `GET` | `/health` | Health check |

### `/api/meal-plan` — Python subprocess

Spawns `python3 Backend/meal-planning/meal_planner.py --json ...` with query params translated to CLI args. Collects stdout, then searches backwards through the output lines for the last valid JSON object (robust against any Python print statements appearing before the JSON). Returns the parsed meal plan or a 500 with the stderr output.

### Meal tracking

`meal_tracking.json` is a simple JSON array of meal log entries. `readMealTracking()` / `writeMealTracking()` are plain synchronous file I/O helpers (`fs.readFileSync` / `fs.writeFileSync`). This is intentionally simple — it's only used locally.

---

## Authentication Module — `auth.js`

**File:** `Backend/auth.js` (264 lines)

**Local dev only.** Uses Node.js built-in `crypto` — no external dependency.

### Password hashing — `hashPassword(password)` / `verifyPassword(password, storedHash)`

```
hash = PBKDF2-SHA512(password, randomSalt, 1000 iterations, 64 bytes)
stored as: "<hex-salt>:<hex-hash>"
```

`verifyPassword` splits on `:`, re-derives the hash with the same salt, and compares with `===`.

### Storage

Users are stored in `Backend/data/users.json` (gitignored):
```json
{
  "users": [
    {
      "id": 1,
      "email": "student@illinois.edu",
      "password_hash": "abc123...:def456...",
      "created_at": "...",
      "goal": "balanced",
      "age": 20,
      "sex": "M",
      "calories": 2200,
      "dietary_restrictions": [],
      "favorites": [],
      "notifications_enabled": true
    }
  ]
}
```

### Functions

- `initializeDatabase()` — creates `data/` dir and empty `users.json` if missing; runs on `require('./auth')`
- `registerUser(email, password, cb)` — checks for duplicate email, hashes password, assigns incrementing `id`
- `loginUser(email, password, cb)` — looks up user, verifies password, returns profile (without hash)
- `updateUserProfile(userId, profileData, cb)` — updates whichever fields are present in `profileData`
- `getUserProfile(userId, cb)` — returns full profile including favorites list
- `changePassword(userId, oldPassword, newPassword, cb)` — verifies old password before updating
- `addFavorite(userId, foodItem, cb)` — appends to `user.favorites` array
- `removeFavorite(userId, foodItemIndex, cb)` — splices by index from `user.favorites`

---

## React Frontend — `App.jsx`

**File:** `webapp/src/App.jsx` (915 lines, single file)

### `main.jsx` — React entry point

**File:** `webapp/src/main.jsx`

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

The entry point for the React app. `ReactDOM.createRoot` mounts the app into the `<div id="root">` in `index.html`. `<React.StrictMode>` is a development-only wrapper that catches common mistakes (double-invoked effects, deprecated APIs) but has no effect in the production build. `index.css` is imported here so all styles load globally before any component renders.

---

### `index.html`

The Vite entry HTML. Contains `<div id="root"></div>` (the React mount point) and a `<script type="module" src="/src/main.jsx">` that Vite rewrites at build time. The `base` path in `vite.config.js` is automatically applied to all asset URLs in this file during build.

---

The entire frontend lives in one file (`App.jsx`). No routing library — page state is controlled by React `useState` (which "page" is shown).

### API URL resolution

```js
const API_BASE = import.meta.env.DEV
  ? '/api'
  : `${import.meta.env.BASE_URL}api`
```

- In dev (`npm run dev`): `API_BASE = '/api'` → Vite serves the files from `webapp/public/api/` as static assets (no proxy needed — Vite's dev server automatically serves everything in `public/` at the root)
- In production (GitHub Pages): `API_BASE = '/Project-Harvest/api'` → fetches static JSON from the deployed `gh-pages` branch

### Module-level constants

| Constant | Purpose |
|----------|---------|
| `MAIN_DINING_HALLS` | The 4 main halls — used to filter `dining-halls.json` and order the cards |
| `DINING_HALL_IMAGES` | Maps hall name → image URL (served from `Docs/images/` via GitHub Pages) |
| `DINING_HALL_INFO` | Short description shown on each dining hall card |
| `GOALS` | The 4 nutrition goals with labels, emoji, and macro ratio configs (`cfg: {p, f, c}`) |
| `MEAL_PERIOD_MAP` | Maps Breakfast/Lunch/Dinner → list of `meal_type` strings that belong to that period |
| `UPCOMING_DAYS` | `5` — how many days of dates to show in filters |
| `FAVORITES_KEY` | `'ph_favorites_v1'` — localStorage key for persisted favorites |
| `MEAT_KEYWORDS`, `DAIRY_EGG_KEYWORDS`, `SWEET_KEYWORDS` | Used for dietary flag detection and category classification |

---

### Utility functions

#### `parseMenuDate(dateStr)`

```js
function parseMenuDate(dateStr) {
  const parsed = new Date(`${dateStr} 00:00:00`)
  ...
}
```

The space before `00:00:00` forces JavaScript to parse in **local time** rather than UTC. Without it, `new Date('2026-05-04')` is parsed as midnight UTC, which shifts to the previous day in timezones west of UTC. This is the critical fix that makes date filtering work correctly.

Returns a `Date` with hours set to midnight local time, or `null` if unparseable.

#### `getUpcomingDates(items, days=5)`

Extracts unique dates from the food items list, filters to only those between today and today+4 days, sorts chronologically, returns the raw date strings. Used to populate date dropdowns — you only see today and the next 4 days.

#### `getSortedDates(items)`

Fallback: returns all unique dates sorted chronologically (no date range filter). Used when `getUpcomingDates` returns nothing (e.g. looking at old historical data).

#### `formatDateLabel(dateStr)`

Converts `"2026-05-04"` → `"Today — 2026-05-04"` or `"Tomorrow — 2026-05-05"` based on the diff from today. Used in date dropdowns.

#### `getDietFlags(item)`

```js
function getDietFlags(item) {
  const hasMeat     = MEAT_KEYWORDS.some(k => name.includes(k)) || /meat|fish|poultry/.test(cat)
  const hasDairyEgg = DAIRY_EGG_KEYWORDS.some(k => name.includes(k)) || /dairy|egg/.test(cat)
  return { vegetarian: !hasMeat, vegan: !hasMeat && !hasDairyEgg }
}
```

Keyword-based detection using both the food name and category string. Returns `{vegetarian, vegan}` booleans.

#### `getItemKey(hall, item)`

Returns `"hall::name::meal_type::date"` — a unique string key used as the localStorage favorites identifier. Scoped to hall so the same dish at different halls is tracked separately.

#### `getCategoryGroup(item)`

Groups items into 5 visual categories using regex on name + category: `protein`, `carb`, `veg`, `sweet`, `drink`, `other`. Used by the meal builder to score variety.

#### `clampNumber(value, min, max)`

Clamps a number to [min, max], returning `min` if `NaN`. Used to sanitize calorie/protein inputs.

#### `getFavorites()` / `saveFavorites(set)`

Read/write a `Set` of item keys from localStorage. Wrapped in try/catch for private browsing environments.

---

### `MealBuilder` component

A self-contained React component for the meal building flow. Receives `diningHall` (string) and `onBack` (callback) as props.

**State:**
- `calories`, `protein` — target numbers (strings, validated on submit)
- `mealPeriod` — `'Breakfast'` / `'Lunch'` / `'Dinner'` (auto-set from current hour on mount)
- `goal` — one of the `GOALS` keys
- `isVegetarian`, `isVegan` — boolean diet filters
- `selectedDate`, `availableDates` — date dropdown
- `menuItems` — all foods for this hall, fetched from JSON on mount
- `mealPlan` — the generated result object, `null` until generated
- `loading`, `error` — UI state

**`buildPool(items, period, dateStr)`**

Filters `menuItems` to only foods matching the chosen date and whose `meal_type` is in `MEAL_PERIOD_MAP[period]`. E.g. for `Dinner`, includes "Dinner", "Salad Bar", "Ice Cream", "Beverages", "Condiments". Also filters out items with zero calories.

**`filterDiet(items)`**

Applies vegetarian/vegan filtering using `getDietFlags()`.

**`scoreCombo(combo, targetCals, targetProt, goalKey)`**

Scores a combination of food items:
1. **Calorie score** — how close total is to target; hard-returns `-9999` if over by >20%
2. **Protein score** — closeness to `targetProt`
3. **Macro ratio score** — Euclidean distance from goal `cfg` in (protein%, carb%, fat%) space
4. **Variety score** — bonus for using multiple `getCategoryGroup` categories

Weights: `0.45 * calScore + 0.30 * protScore + 0.15 * macroScore + 0.10 * varietyScore`

**`generateBest(pool, targetCals, targetProt, goalKey)`**

Runs 120 random restarts ("greedy + random"):
1. Seeds each attempt with a random non-drink item
2. Shuffles remaining pool and greedily adds items until `MAX_ITEMS=6` or calories would exceed 120% of target
3. Scores with `scoreCombo`
4. Keeps the highest-scoring combination

Entirely client-side — no server call needed.

**`generateMealPlan()`**

Orchestrates the full flow: validates inputs → builds pool → applies diet filter → runs `generateBest` → maps results to display format → computes macro percentages → sets `mealPlan` state.

---

### `App` component (main)

Three "pages" controlled by state:
1. **Hall list** — default view; shows cards for each dining hall
2. **Menu explorer** — shown when `selectedHall` is set
3. **Meal builder** — shown when `mealBuilderHall` is set (renders `<MealBuilder />` instead of `<App />`'s main content)

**State:**
- `diningHalls` — list of hall names from `dining-halls.json`
- `selectedHall` — currently viewing this hall's menu
- `mealBuilderHall` — currently in meal builder for this hall
- `menuItems` — all foods for the selected hall
- `filteredItems` — `menuItems` after all filter/sort logic applied
- `availableDates` — upcoming dates for the date dropdown
- `selectedDate`, `selectedMealType` — active filter values
- `searchQuery` — text search input
- `dietFilter` — `'any'` / `'vegetarian'` / `'vegan'`
- `minProtein`, `maxCalories` — range slider filters
- `sortBy` — `'recommended'` / `'protein'` / `'calories'` / `'name'`
- `favorites` — `Set` of item keys (loaded from localStorage on mount)
- `showFavoritesOnly` — toggle to show only favorited items
- `stats` — `{ lastUpdated, hallCount }` from the JSON index

**`loadDiningHalls()`**

Fetches `dining-halls.json`, filters to `MAIN_DINING_HALLS` (preserving the fixed order), and stores in state.

**`loadMenu(hallName)`**

Fetches the hall-specific JSON file. Filename is derived as `hallName.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')`. Sets `availableDates` to upcoming dates (falling back to all sorted dates if none are upcoming). Auto-selects the first available date.

**Filter + sort effect**

A `useEffect` with 10 dependencies applies all active filters to `menuItems` in sequence and stores the result in `filteredItems`. Runs every time any filter changes.

**`getMealTypes()`**

Returns `['All', ...unique meal_types sorted alphabetically]` for the Station dropdown.

**`toggleFavorite(item)`**

Computes the item key, toggles it in the `favorites` Set, and calls `saveFavorites` to persist to localStorage immediately.

**`hallStats` (useMemo)**

Computes `{totalItems, mealTypes, dates}` from `menuItems`. Only recomputes when `menuItems` changes.

---

## Vite Configuration — `vite.config.js`

**File:** `webapp/vite.config.js`

```js
export default defineConfig({
  plugins: [react()],
  base: '/Project-Harvest/',
})
```

`base: '/Project-Harvest/'` is required because GitHub Pages serves the site at `https://infoshubhjain.github.io/Project-Harvest/`, not at the root. Without this, all asset URLs and `import.meta.env.BASE_URL` would be wrong and the site would load with broken links.

In dev mode, `import.meta.env.BASE_URL` = `'/'` so `API_BASE` becomes `/api`. Vite's dev server automatically serves files from `webapp/public/` at the root, so `fetch('/api/dining-halls.json')` reads `webapp/public/api/dining-halls.json` directly — no proxy and no Express server involvement. The Express server (`server.js`) is still useful locally for the meal-plan endpoint and auth endpoints, but it is not needed for menu browsing.

---

## GitHub Actions Workflows

### `daily-scrape.yml`

**Trigger:** Scheduled cron (two entries to handle CST/CDT timezone shift):
- `0 14 * 1,2,11,12 *` — 14:00 UTC ≈ 8:00 AM CST (Nov–Feb)
- `0 13 * 3-10 *` — 13:00 UTC ≈ 8:00 AM CDT (Mar–Oct)

Also triggered manually via `workflow_dispatch` with optional `testing` and `save_snapshots` inputs.

**Steps:**
1. Checkout repo
2. Set up Python 3.11
3. `pip install -r Backend/scrapers/requirements.txt`
4. Run `nutrition_scraper.py --days 5` (with optional `--testing` and `--save-snapshots` flags from dispatch inputs). **Timeout: 150 minutes** — the full scrape can take 2+ hours.
5. Run `load_to_db.py` — loads the Excel output into SQLite
6. Run `export_to_json.py` — exports DB to JSON files
7. `git add Docs/api/ webapp/public/api/ Backend/data/nutrition_data.db && git commit && git push` — commits updated data. The `continue-on-error: true` means the workflow doesn't fail if there's nothing new to commit.

**After this push**, `deploy-react.yml` fires automatically via `workflow_run`.

---

### `deploy-react.yml`

**Triggers:**
- Push to `master` or `main`
- `workflow_run` from "Daily Dining Hall Data Scrape" completing on `master`
- Manual `workflow_dispatch`

**Steps:**
1. Checkout repo
2. Set up Node.js 20 with npm cache keyed to `webapp/package.json`
3. `cd webapp && npm install`
4. `cd webapp && npm run build` — Vite bundles the app to `webapp/dist/`
5. Copy `Docs/api/*` into `webapp/dist/api/` — the built app needs the JSON files co-located in the output
6. Copy `Docs/images/*` into `webapp/dist/images/`
7. Deploy `webapp/dist/` to the `gh-pages` branch using `peaceiris/actions-gh-pages@v3`

The `gh-pages` branch is what GitHub Pages serves.

---

### `validate-api.yml`

**Triggers:** Push to `master`, PRs against `master`

**Steps:**
1. Checkout, install Python 3.11 + scraper deps
2. Run `validate_docs_api.py` — set step output `valid=true` on success, `continue-on-error: true` so the step doesn't fail the workflow
3. **Repair step** (only if `steps.validate.outputs.valid != 'true'`): runs a test scrape, loads to DB, exports JSON, commits and pushes the repaired files

This provides a safety net: if somehow `Docs/api/` gets corrupted (malformed JSON, empty files), the workflow automatically re-scrapes and fixes it on the next push.

---

### `scraper-tests.yml`

**Triggers:** Push to `master`, PRs against `master`

**Steps:**
1. Checkout repo
2. Set up Python 3.11
3. `pip install -r Backend/scrapers/requirements.txt`
4. `cd Backend/scrapers && pytest -q tests` — runs the entire `tests/` directory

This runs all three test files: `test_playback_scraper.py`, `test_selectors_playback.py`, and `test_remote_page_structure.py`. No browser is needed — playback and selector tests parse static HTML, and the remote test skips itself if the EatSmart site is unreachable.

---

## Scraper Tests

**File:** `Backend/scrapers/tests/test_playback_scraper.py`

```python
def test_scrape_dining_structure_playback():
    scraper = NutritionScraperComplete(
        testing_mode=True, headless=True,
        playback_mode=True, fast_mode=False   # fast_mode=False is critical
    )
    scraper.snapshots_dir = test_dir   # points to the tests/ directory itself
    halls = scraper.scrape_dining_structure()
    assert isinstance(halls, list)
    assert len(halls) > 0
    assert 'dining_hall' in halls[0]
    assert 'dining_services' in halls[0]
```

`playback_mode=True` — no browser launched, reads HTML snapshots from `snapshots_dir` instead.

`fast_mode=False` — **critical**. In fast mode the scraper filters results against `MAIN_DINING_HALLS`. The test fixture HTML uses fake hall names like "Dining Hall A" that don't match those names, so all halls would be filtered out and `len(halls) == 0` would fail the assertion.

The test directory itself (`Backend/scrapers/tests/`) contains `sample_snapshot.html` — a saved real-page HTML snapshot from the EatSmart site, committed to the repo. This fixture is used by both `test_playback_scraper.py` and `test_selectors_playback.py`.

---

### `test_selectors_playback.py`

**File:** `Backend/scrapers/tests/test_selectors_playback.py`

Three tests that parse `sample_snapshot.html` directly with BeautifulSoup (no scraper class involved):

```python
def test_snapshot_has_unit_selector():
    # Checks #nav-unit-selector exists and has at least one a[data-unitoid]
    assert soup.find(id='nav-unit-selector') is not None
    assert soup.select('a[data-unitoid]')

def test_snapshot_has_date_selector():
    # Checks #nav-date-selector exists and has at least one a[data-date]
    assert soup.find(id='nav-date-selector') is not None
    assert soup.select('a[data-date]')

def test_snapshot_has_menu_items():
    # Checks #navBarResults exists and contains either li.list-group-item or a.cbo_nn_itemHover
    assert soup.find(id='navBarResults') is not None
    assert soup.select('li.list-group-item') or soup.select('a.cbo_nn_itemHover')
```

**Purpose:** These tests verify that the CSS selectors the scraper relies on actually exist in real EatSmart HTML. If the website ever redesigns and renames these IDs/classes, these tests catch it immediately. They run offline against the committed snapshot, so they always run even without network access in CI.

---

### `test_remote_page_structure.py`

**File:** `Backend/scrapers/tests/test_remote_page_structure.py`

Two tests that make a real HTTP GET to `https://eatsmart.housing.illinois.edu/NetNutrition/1` and check the live page structure:

```python
def test_remote_page_has_unit_selector():
    # GET the live page, parse it, assert #nav-unit-selector or a[data-unitoid] exists

def test_remote_page_has_nav_date_selector():
    # GET the live page, parse it, assert #nav-date-selector or a[data-date] exists
```

The helper `fetch_remote_page_or_skip(url)` calls `requests.get(url, timeout=10)`. If the request fails for any reason (network unavailable, site down, timeout), the test calls `pytest.skip()` rather than failing — so CI passes even if the EatSmart site is unreachable. These tests only fail if the site responds but is missing the expected structure (which would be the important signal — the site was redesigned and the scraper will break).

---

### `sample_snapshot.html`

**File:** `Backend/scrapers/tests/sample_snapshot.html`

A committed copy of the real EatSmart page HTML, captured at a point when all selectors were working. Used as the fixture for `test_playback_scraper.py` (via `scraper.snapshots_dir = test_dir`) and `test_selectors_playback.py`. Committing the snapshot means:
- Tests run offline, no network required
- The snapshot documents exactly what the site looked like when tests last passed
- If tests fail but the snapshot is old, you can update it by saving a fresh page from the live site

---

## API Validator — `validate_docs_api.py`

**File:** `Backend/scripts/validate_docs_api.py`

Globs all `*.json` in `Docs/api/` and for each:
- Checks it's valid JSON (parseable)
- Checks the top-level structure is a dict
- For `dining-halls.json`: checks `dining_halls` key is non-empty
- For all other files: checks at least one of `foods` or `count` is present

Exits 0 on success, 1 on any failure. Called by `validate-api.yml` in CI.

---

## Local Development Scripts

### `setup_dev.sh`

```bash
#!/bin/bash
set -e
command -v python3 >/dev/null 2>&1 || { echo "Error: python3 not found"; exit 1; }
command -v npm >/dev/null 2>&1    || { echo "Error: npm not found"; exit 1; }

echo "Installing Python scraper dependencies..."
cd Backend/scrapers && python3 -m pip install -r requirements.txt && cd ../..

echo "Installing Backend Node dependencies..."
cd Backend && npm install && cd ..

echo "Installing webapp dependencies..."
cd webapp && npm install && cd ..
```

`set -e` makes the script abort on any error. Checks that `python3` and `npm` are available before starting. Installs all three dependency sets in sequence.

### `start.sh`

```bash
#!/bin/bash
cleanup() { kill $(jobs -p) 2>/dev/null; exit; }
trap cleanup SIGINT SIGTERM

if [ ! -d "Backend/node_modules" ] || [ ! -d "webapp/node_modules" ]; then
    ./setup_dev.sh
fi

cd Backend && npm start &
cd webapp && npm run dev -- --host &

sleep 2
open http://localhost:5173 2>/dev/null || true
wait
```

Starts both servers as background jobs (`&`). The `trap` ensures both are killed when you press Ctrl+C. `--host` makes the Vite dev server accessible on the local network (useful for testing on mobile). The `sleep 2` gives the servers time to start before trying to open the browser.

### Root `package.json` scripts

| Script | What it runs |
|--------|-------------|
| `npm start` | `./start.sh` — both servers |
| `npm run setup` | `./setup_dev.sh` — install all deps |
| `npm run scrape` | Full 5-day scrape pipeline (scraper → DB → JSON) |
| `npm run scrape:today` | Same but `--days 1` |
| `npm run scrape:test` | Same but `--testing` flag (fast, limited items) |
| `npm test` | `cd Backend/scrapers && pytest` |

---

## Key Architectural Decisions

### Why static JSON instead of a live API?

GitHub Pages only serves static files. Building the data pipeline as "scraper → SQLite → JSON → git push → Pages" means:
- Zero server costs
- No uptime requirements
- Data is always available even if the source site is down
- Version history of menu data is in git

### Why is `App.jsx` one file?

The frontend is intentionally simple — one page with three views. Splitting it into multiple files would add complexity with no benefit. The entire frontend is ~900 lines and easy to read end-to-end.

### Why does the scraper re-navigate to the service page before every meal?

Selenium elements go stale whenever the page navigates. Rather than trying to carefully manage element references and handle `StaleElementReferenceException` everywhere, the scraper resets to a clean state before each meal. This means more HTTP round-trips but far fewer mysterious failures.

### Why are all dates stored as YYYY-MM-DD?

JavaScript's `new Date('2026-05-04 00:00:00')` (with the space) parses in local time. `new Date('2026-05-04')` (ISO format without time) parses in UTC, causing a timezone offset bug where users in the US see the previous day. Storing as `YYYY-MM-DD` and always appending ` 00:00:00` when parsing in JS ensures correct local-time behavior. The `normalize_date()` function in the scraper guarantees all dates reach the DB in this format.

### Why does `load_to_db.py` delete only (hall, date) pairs?

The original implementation deleted ALL rows for a dining hall before inserting. This meant re-scraping just today would wipe all historical data for that hall. The fix uses targeted deletion: only the (hall, date) combinations present in the new Excel file are cleared. Historical data accumulates safely in the DB.

### Why two API directories (`Docs/api/` and `webapp/public/api/`)?

- `Docs/api/` is committed to git and served by GitHub Pages in production
- `webapp/public/api/` is gitignored and used by Vite's dev server locally

Vite's dev server automatically serves everything in `webapp/public/` at the root, so `fetch('/api/dining-halls.json')` resolves to `webapp/public/api/dining-halls.json` with zero configuration. The `export_to_json.py` script writes to both directories simultaneously, keeping them in sync. This means you can run `npm run scrape` and then `npm run dev` without touching Express at all for menu browsing.

### Why `workflow_run` to chain scrape → deploy?

The scraper commit to `master` triggers `deploy-react.yml` via a `push` event normally. But the scraper runs as a workflow on its own checkout, so its `git push` creates a new commit that triggers the deploy — the `workflow_run` trigger ensures the deploy fires even when the workflow pushes from within a workflow context.
