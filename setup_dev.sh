#!/bin/bash

# setup_dev.sh
# Standardizes development environment setup for Project-Harvest

set -e  # Exit on error

echo "================================================================================"
echo "🌽 Project-Harvest Development Setup"
echo "================================================================================"

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed or not in PATH."
    exit 1
fi

# Check for Node.js
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed or not in PATH."
    exit 1
fi

echo "✅ Prerequisites met (Python 3, npm)"

# 1. Setup Backend/Scrapers (Python)
echo ""
echo "--------------------------------------------------------------------------------"
echo "🐍 Setting up Scraper Environment..."
echo "--------------------------------------------------------------------------------"
cd Backend/scrapers
if [ ! -f "requirements.txt" ]; then
    echo "❌ requirements.txt not found in Backend/scrapers"
    exit 1
fi
python3 -m pip install -r requirements.txt
echo "✅ Scraper dependencies installed."
cd ../..

# 2. Setup Backend (Node.js)
echo ""
echo "--------------------------------------------------------------------------------"
echo "⚙️ Setting up Backend API..."
echo "--------------------------------------------------------------------------------"
cd Backend
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found in Backend"
    exit 1
fi
npm install
echo "✅ Backend dependencies installed."
if [ ! -f ".env" ]; then
    echo "⚠️  Note: No .env file found in Backend/. You may need to create one if the app requires secrets."
fi
cd ..

# 3. Setup Frontend Webapp (Node.js)
echo ""
echo "--------------------------------------------------------------------------------"
echo "⚛️ Setting up React Webapp..."
echo "--------------------------------------------------------------------------------"
cd webapp
npm install
echo "✅ Webapp dependencies installed."
echo "🔨 Building webapp..."
npm run build
echo "✅ Webapp built successfully."
cd ..

# 4. Summary
echo ""
echo "================================================================================"
echo "🎉 Setup Complete!"
echo "================================================================================"
echo "To run the project components:"
echo ""
echo "1. Run Scraper Tests:"
echo "   cd Backend/scrapers && pytest"
echo ""
echo "2. Run Backend API:"
echo "   cd Backend && npm start"
echo ""
echo "3. Run Webapp (Dev):"
echo "   cd webapp && npm run dev"
echo ""
echo "4. Run Scraper (Actual):"
echo "   cd Backend/scrapers && python3 nutrition_scraper.py --testing"
echo "================================================================================"
