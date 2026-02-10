# Project Harvest 🧺

Project Harvest is a comprehensive dining hall nutrition tracking ecosystem designed for university students. It provides real-time access to dining hall menus, full nutritional breakdowns, and automated data collection from campus dining services.

## 🚀 Overview

The project consists of three main components:
1.  **Web Dashboard**: A modern, responsive React-based web application for browsing daily menus and tracking nutritional intake.
2.  **Robust Scraper Engine**: A Python-based automation suite that extracts daily menu and nutrition data from university dining portals.
3.  **Unified API Layer**: A collection of static JSON endpoints and a Node.js companion for efficient data delivery.

## ✨ Key Features

- **Real-Time Menus**: View what's being served at all university dining halls (ISR, PAR, LAR, Ikenberry, etc.).
- **Detailed Nutrition**: Access calories, protein, fats, carbohydrates, and allergen information for every dish.
- **Smart Filtering**: Filter menus by meal type (Breakfast, Lunch, Dinner) and category.
- **Automated Collection**: Daily scrapers ensure the data is always fresh without manual intervention.
- **Mobile-First Design**: Fully responsive web interface optimized for students on the go.

## 🛠️ Technology Stack

### Frontend
- **React 18** & **Vite**: Powering the modern, fast user interface.
- **Pure CSS**: Handcrafted styles for a sleek, glassmorphic aesthetic.
- **GitHub Pages**: Automated CI/CD deployment.

### Backend & Automation
- **Python**: Core scraping logic using `webdriver-manager` and `Selenium`.
- **Node.js & Express**: API utility layer for data management.
- **SQLite**: Local data storage before export to front-end JSON.
- **GitHub Actions**: Automated daily scraping and deployment pipeline.

## 🏃 Getting Started

### Prerequisites
- Node.js (v16+)
- Python (v3.9+)
- Chrome Browser (for scrapers)

### Quick Setup

1. **Initialize the project**:
   ```bash
   npm run setup
   ```

2. **Run the web application**:
   ```bash
   cd webapp
   npm install
   npm run dev
   ```

3. **Run a test scrape**:
   ```bash
   npm run scrape:today
   ```

## 📂 Repository Structure

- `webapp/`: The React-based frontend dashboard.
- `Backend/`: The scraper engine and API management logic.
  - `scrapers/`: Python scripts for data collection.
  - `data/`: Local SQLite database and JSON exports.
- `Docs/`: API documentation and static JSON endpoints.
- `.github/workflows/`: Automation pipelines for scraping and deployment.

## 🔄 Development Workflow

- **Scraping**: Run `npm run scrape` to update local data.
- **API Validation**: The `validate-api.yml` workflow ensures all exported JSON data is compliant with the frontend schema.
- **Deployment**: Any push to the `master` branch triggers the `deploy-react.yml` workflow, rebuilding the webapp and updating the live site.

---

*Part of the EasyEats initiative - Project Harvest.*
