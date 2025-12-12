# Enable GitHub Pages for API (Final Step!)

Your code is ready! Now you just need to enable GitHub Pages to serve the JSON files.

## Step-by-Step Instructions

### 1. Go to Repository Settings

Open this link in your browser:
**https://github.com/infoshubhjain/Project-Harvest/settings/pages**

OR:
1. Go to https://github.com/infoshubhjain/Project-Harvest
2. Click "Settings" tab
3. Click "Pages" in the left sidebar

### 2. Configure GitHub Pages

You'll see "Build and deployment" section:

**IMPORTANT**: You currently have TWO GitHub Pages deployments:
- One for Flutter app (from `gh-pages` branch)
- One we need for API (from `master` branch `/docs` folder)

#### Current Setup:
- **Source**: Deploy from a branch
- **Branch**: `gh-pages` branch, `/ (root)` folder
- **This serves**: Your Flutter web app

#### What We Need to Add:
GitHub Pages can only serve ONE source per repository. So we need to combine both!

### 3. Solution: Merge Everything

We have two options:

#### Option A: Keep Current Setup + Copy API to gh-pages branch

The Flutter GitHub Actions workflow already deploys to `gh-pages`. We just need to include the API files:

**Easy fix**: Update the GitHub Actions workflow to copy API files during deployment.

I'll do this for you now...

#### Option B: Change to Deploy from /docs

Change GitHub Pages to serve from `master` branch `/docs` folder, then move Flutter build there too.

**I recommend Option A** (keep current setup, add API files to it).

Let me update the workflow now...
