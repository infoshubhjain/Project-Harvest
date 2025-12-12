# Scrapers (Backend)

This folder contains the Python scrapers that collect nutrition data from the UIUC dining systems.

Requirements:
- Python 3.10+
- pip packages listed in requirements.txt

Quick start (local):

1. Install dependencies

```bash
cd Backend/scrapers
pip install -r requirements.txt
```

2. (Optional) Validate driver & page selectors

```bash
python3 check_scraper_setup.py  # --no-headless to run with UI for debugging

4. Run tests and playback checks

```bash
cd Backend/scrapers
pip install -r requirements.txt
pytest -q tests
```

5. Save snapshots for debugging

You can enable automatic snapshot saving with `--save-snapshots` so that the scraper saves HTML pages to `Backend/scrapers/snapshots` when selectors fail. Use `--playback` to load these saved snapshots for fast testing with playback mode.

```bash
# Save snapshots during a run
python3 nutrition_scraper.py --save-snapshots --testing

# Playback from previously saved snapshots
python3 nutrition_scraper.py --playback Backend/scrapers/snapshots --testing
```
```

3. Run the full scraper (day-long run, takes time):

```bash
python3 nutrition_scraper.py --testing     # run with testing mode (faster)
python3 nutrition_scraper.py               # full scrape
```

Note:
- Chrome/Chromium should be installed on your machine. The project uses `webdriver-manager` to fetch and manage the correct ChromeDriver automatically.
- If you prefer to install chromedriver manually on macOS (Homebrew): `brew install chromedriver`
- The CI workflow includes steps to install Chromium in the GitHub Actions environment, but we still use `webdriver-manager` for convenience.

CI:
- See `.github/workflows/daily-scrape.yml` to understand how the daily scraping runs and pushes updated data to the repository.

Troubleshooting:
- If the `check_scraper_setup.py` script fails to initialize the driver, check that your installed Chrome/Chromium version is present and that you have proper permissions.
- If the site DOM changes significantly, the scraper may need updated selectors; take a look at `nutrition_scraper.py` and the `get_available_dates_for_next_n_days`, `scrape_dining_structure` function fallbacks.

*** End of README ***
