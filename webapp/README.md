# Project Harvest - React Web App

A modern, responsive web application for tracking university dining hall nutrition information.

## 🚀 Technology Stack

- **React 18** - Modern UI library
- **Vite** - Lightning-fast build tool
- **Pure CSS** - No framework dependencies, fast loading
- **GitHub Pages** - Free hosting

## 📦 Features

- ✅ Browse all dining halls
- ✅ View menu items with full nutrition info
- ✅ Filter by meal type (Breakfast, Lunch, Dinner)
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ Fast loading with static JSON API
- ✅ Zero backend required

## 🏃 Development

```bash
cd webapp

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🌐 Live Site

https://infoshubhjain.github.io/Project-Harvest/

## 📂 Project Structure

```
webapp/
├── src/
│   ├── App.jsx          # Main app component
│   ├── main.jsx         # React entry point
│   └── index.css        # Global styles
├── index.html           # HTML template
├── vite.config.js       # Vite configuration
└── package.json         # Dependencies
```

## 🔄 Auto-Deployment

Every push to `master` branch automatically:
1. Builds the React app
2. Copies API JSON files
3. Deploys to GitHub Pages

See `.github/workflows/deploy-react.yml` for details.

## 🎨 Why React Instead of Flutter Web?

- **Simpler**: No complex SDK, just JavaScript
- **Faster builds**: ~1 minute vs 3+ minutes
- **Better web support**: Native web platform
- **Easier debugging**: Browser DevTools work perfectly
- **Smaller bundle**: ~200KB vs 2MB+ for Flutter
- **Better SEO**: Proper HTML structure
