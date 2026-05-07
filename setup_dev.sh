#!/bin/bash
# setup_dev.sh — install all dependencies for local development.
# Run once after cloning or whenever requirements change.
# Equivalent to: npm run setup

set -e  # Exit immediately on any error.

# Validate required tools before doing anything.
command -v python3 >/dev/null 2>&1 || { echo "Error: python3 not found"; exit 1; }
command -v npm >/dev/null 2>&1    || { echo "Error: npm not found"; exit 1; }

echo "Installing Python scraper dependencies..."
cd Backend/scrapers && python3 -m pip install -r requirements.txt && cd ../..

echo "Installing Backend Node dependencies..."
cd Backend && npm install && cd ..

echo "Installing webapp dependencies..."
cd webapp && npm install && cd ..

echo ""
echo "Setup complete. To start:"
echo "  npm start          — backend (:3000) + webapp (:5173)"
echo "  npm run scrape     — run scraper pipeline"
echo "  npm test           — run scraper tests"
