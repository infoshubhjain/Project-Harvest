# Deploying `easyeats` Flutter Web to GitHub Pages

This document explains how the included GitHub Actions workflow builds the Flutter web app and deploys it to GitHub Pages.

## What we added
- `.github/workflows/flutter-gh-pages.yml` — builds the Flutter web app and publishes `build/web/` to the `gh-pages` branch.

## How it works
1. The workflow runs on push to `master`/`main` (and can be manually triggered).
2. It installs Flutter and runs `flutter pub get` in `Frontend/flutter_easyeats`.
3. It builds the web target (release) with a base href set to `/Project-Harvest/` automatically (using your repository name).
4. The resulting `build/web` directory is deployed to the `gh-pages` branch using `peaceiris/actions-gh-pages`.

## Site URL
Your published site will be available at:

`https://<OWNER>.github.io/Project-Harvest/`

Replace `<OWNER>` with your GitHub username or organization name.

## Notes
- If you prefer to use a custom path or a different branch, update the workflow accordingly.
- If your repo will be published as a user/organization page (username.github.io), change `--base-href` to `/` in the build step.
- To set up a custom domain, add a `CNAME` file to `Frontend/flutter_easyeats/build/web/` (the action will publish it), or configure it in the `gh-pages` branch root.

## Local testing
To build and test locally:

```bash
# 1) Ensure flutter is installed (https://flutter.dev)
cd Frontend/flutter_easyeats
flutter pub get
flutter build web --release --base-href "/Project-Harvest/"
# 2) Serve the built site using a local static server:
python3 -m http.server --directory build/web 8080
# Open http://localhost:8080/ in your browser.
```

## Troubleshooting
- If the base href is wrong and assets 404, try deleting `build` and rebuild.
- If build fails, ensure the workflow machine's OS is compatible for your dependencies. Web build should be fine on `ubuntu-latest`.
- The workflow uses `GITHUB_TOKEN` to push to `gh-pages`; this works for public and private repos, but for more permissions use a personal or deploy token.

---
