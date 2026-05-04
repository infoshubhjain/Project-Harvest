# Scrapers

Collects nutrition data from the UIUC dining systems via Selenium.

**Requirements:** Python 3.10+, Chrome or Chromium installed.

## Quick start

```bash
cd Backend/scrapers
pip install -r requirements.txt

# Run tests
pytest -q tests

# Test scrape (fast, limited items)
python3 nutrition_scraper.py --testing

# Full scrape — today + next 4 days
python3 nutrition_scraper.py --days 5

# Then load into DB and export JSON
python3 load_to_db.py
cd ..
python3 export_to_json.py
```

## Useful flags

| Flag | Description |
|---|---|
| `--days N` | Number of days to scrape starting from today (default: 5) |
| `--testing` | Limits to 5 items per meal for fast iteration |
| `--full` | Scrape all halls including cafes/catering (default: main 4 only) |
| `--no-headless` | Show Chrome window (useful for debugging selectors) |
| `--save-snapshots` | Save HTML pages to `snapshots/` when selectors fail |
| `--playback DIR` | Use saved snapshots instead of live browser |

## Debugging

If selectors break (site DOM changed), look at `get_available_dates_for_next_n_days` and `scrape_dining_structure` in `nutrition_scraper.py`. Run with `--no-headless --save-snapshots` to see exactly what the browser is seeing.

## CI

The daily scrape runs automatically via `.github/workflows/daily-scrape.yml` at 8am Chicago time.
