# EasyEats Web Deployment

This Flutter app is automatically deployed to GitHub Pages when code is pushed to the `master` branch.

## Live Website

Once deployed, the app will be available at:
**https://infoshubhjain.github.io/Project-Harvest/**

## How It Works

The deployment is fully automated using GitHub Actions:

1. **Workflow File**: [.github/workflows/flutter-gh-pages.yml](.github/workflows/flutter-gh-pages.yml)
2. **Trigger**: Automatically runs on every push to `master` branch
3. **Build Process**:
   - Installs Flutter SDK
   - Gets dependencies with `flutter pub get`
   - Builds web version with `flutter build web --release`
   - Sets correct base-href for GitHub Pages subdirectory
4. **Deployment**: Publishes to `gh-pages` branch

## Setup Instructions

### 1. Enable GitHub Pages

Go to your GitHub repository settings:

1. Navigate to: https://github.com/infoshubhjain/Project-Harvest/settings/pages
2. Under "Build and deployment":
   - **Source**: Select "Deploy from a branch"
   - **Branch**: Select `gh-pages` and `/ (root)`
3. Click "Save"

### 2. Trigger First Deployment

The workflow will automatically run when you push to master. To trigger it manually:

1. Go to: https://github.com/infoshubhjain/Project-Harvest/actions
2. Click on "Build and Deploy Flutter Web to GitHub Pages"
3. Click "Run workflow" → "Run workflow"

### 3. Monitor Deployment

- Check workflow status: https://github.com/infoshubhjain/Project-Harvest/actions
- Wait for the green checkmark (usually 2-5 minutes)
- Visit your site: https://infoshubhjain.github.io/Project-Harvest/

## Troubleshooting

### Site shows 404
- Ensure GitHub Pages is enabled and pointing to `gh-pages` branch
- Check that the workflow completed successfully in Actions tab
- Wait a few minutes after first deployment (GitHub Pages can take time to provision)

### Assets not loading
- The workflow automatically sets the correct `--base-href` for the repository
- Check browser console for any path errors

### Workflow fails
- Check the Actions tab for error messages
- Ensure `pubspec.yaml` has valid dependencies
- Verify Flutter code has no build errors

## Local Testing

To test the web build locally before deploying:

```bash
cd Frontend/flutter_easyeats
flutter pub get
flutter build web --release
# Serve the build folder with any web server
python3 -m http.server --directory build/web 8000
```

Then open: http://localhost:8000

## Manual Deployment

If you need to deploy manually without GitHub Actions:

```bash
cd Frontend/flutter_easyeats
flutter build web --release --base-href "/Project-Harvest/"
# Copy build/web contents to gh-pages branch
```
