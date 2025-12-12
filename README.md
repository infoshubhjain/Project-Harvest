# Group 16
Group Name: EasyEats

[MVP Link](https://docs.google.com/document/d/1n2sEw29xoNncvHaEHSYoNxiD-2LiDbUD/edit?usp=sharing&ouid=113213851535479613252&rtpof=true&sd=true)

Team Members: cicizhu2, jaylonw2, warrenh2, sdiaz66, mihirsd2

Project Manager: speru4

## Deploying the Flutter web app
The repo contains a Flutter app at `Frontend/flutter_easyeats` that can be built for web and deployed to GitHub Pages via a GitHub Actions workflow. See `Frontend/flutter_easyeats/GH-PAGES-DEPLOY.md` for details.

Note: The React webapp now loads dining hall images from repository-hosted assets by default and includes a fallback to avoid external hotlinking issues. The Python scraper uses `webdriver-manager` to simplify ChromeDriver setup.

Testing and CI:
- Use `pytest` in `Backend/scrapers` to run selector playback tests and simple remote checks:
	```bash
	cd Backend/scrapers
	pip install -r requirements.txt
	pytest -q
	```
- The new workflow `validate-api.yml` will validate `Docs/api` JSON files on every push/PR and will attempt a quick test scrape + export if invalid files are detected.
