# Deploy Backend Using GitHub Pages ONLY (Simplest!)

## The Simplest Free Solution - No External Service Needed!

Instead of deploying a backend server, serve your dining hall data as **static JSON files** directly from GitHub Pages. This is:

- ✅ **100% Free Forever**
- ✅ **No External Service** - Just GitHub
- ✅ **No Backend Server** needed
- ✅ **Fast** - GitHub CDN
- ✅ **Auto-Updates** - Scraper updates JSON files
- ✅ **Zero Configuration**

## How It Works

```
1. Python Scraper runs → Updates SQLite database
2. Export script converts database → JSON files in /docs/api/
3. GitHub Pages serves → https://YOUR-GITHUB-URL/api/dining-halls.json
4. Flutter app fetches → JSON directly from GitHub Pages
```

## Setup (5 Minutes)

### Step 1: Run the Scraper to Get Data

First, we need dining hall data:

```bash
cd Backend/scrapers
pip install selenium beautifulsoup4 pandas openpyxl

# Install ChromeDriver (Mac)
brew install chromedriver

# Run scraper (takes 30-60 minutes)
python3 nutrition_scraper.py
```

**OR** trigger the automated scraper:
1. Go to https://github.com/infoshubhjain/Project-Harvest/actions
2. Click "Daily Dining Hall Data Scrape"
3. Click "Run workflow"
4. Wait for it to complete

### Step 2: Export Database to JSON Files

```bash
cd /Users/shubh/Desktop/Project-Harvest/Backend
python3 export_to_json.py
```

This creates JSON files in `docs/api/`:
```
docs/api/
├── dining-halls.json
├── isr.json
├── par.json
├── lar.json
└── ... (one file per dining hall)
```

### Step 3: Enable GitHub Pages for /docs Folder

1. Go to your repository: https://github.com/infoshubhjain/Project-Harvest/settings/pages
2. Under "Build and deployment":
   - **Source**: Deploy from a branch
   - **Branch**: `master` branch, `/docs` folder
   - Click **Save**

3. Wait 2-3 minutes for deployment

### Step 4: Your API is Live!

Your endpoints are now:
```
https://infoshubhjain.github.io/Project-Harvest/api/dining-halls.json
https://infoshubhjain.github.io/Project-Harvest/api/isr.json
https://infoshubhjain.github.io/Project-Harvest/api/par.json
... etc
```

### Step 5: Update Flutter App to Use Static JSON

Edit `Frontend/flutter_easyeats/lib/config/api_config.dart`:

```dart
class ApiConfig {
  static const String baseUrl = 'https://infoshubhjain.github.io/Project-Harvest/api';

  static String get apiBaseUrl => baseUrl;
}
```

### Step 6: Update Services to Fetch JSON Directly

Currently your services expect a Node.js API. Update them to fetch static JSON:

Edit `Frontend/flutter_easyeats/lib/services/nutrition_service.dart`:

Replace the `getDiningHalls()` method:
```dart
static Future<List<String>> getDiningHalls() async {
  try {
    final response = await http.get(
      Uri.parse('$baseUrl/dining-halls.json'),
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return List<String>.from(data['dining_halls'] ?? []);
    } else {
      throw Exception('Failed to load dining halls');
    }
  } catch (e) {
    throw Exception('Network error: ${e.toString()}');
  }
}
```

Replace `getFoodsForDiningHall()`:
```dart
static Future<List<FoodItem>> getFoodsForDiningHall(
  String diningHall, {
  String? mealType,
  String? date,
}) async {
  try {
    // Convert dining hall name to filename
    final filename = diningHall.toLowerCase().replaceAll(' ', '-').replaceAll('/', '-');

    final response = await http.get(
      Uri.parse('$baseUrl/$filename.json'),
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      List<dynamic> foods = data['foods'] ?? [];

      // Filter by meal type if specified
      if (mealType != null) {
        foods = foods.where((f) => f['meal_type'] == mealType).toList();
      }

      // Filter by date if specified
      if (date != null) {
        foods = foods.where((f) => f['date'] == date).toList();
      }

      return foods.map((f) => FoodItem.fromJson(f)).toList();
    } else {
      throw Exception('Failed to load foods');
    }
  } catch (e) {
    throw Exception('Network error: ${e.toString()}');
  }
}
```

### Step 7: Commit and Push

```bash
git add docs/
git add Frontend/flutter_easyeats/lib/config/api_config.dart
git add Frontend/flutter_easyeats/lib/services/nutrition_service.dart
git commit -m "Add static JSON API served from GitHub Pages"
git push origin master
```

GitHub Actions will automatically:
1. Rebuild your Flutter web app
2. Deploy to GitHub Pages
3. Your app will load menu data from JSON files!

## Automated Updates

### Option A: Manual Update (When Menus Change)

```bash
cd /Users/shubh/Desktop/Project-Harvest/Backend
python3 export_to_json.py
git add ../docs/api/
git commit -m "Update dining hall data"
git push
```

### Option B: Automate with GitHub Actions

Update `.github/workflows/daily-scrape.yml` to also export JSON:

```yaml
- name: Run scraper
  run: |
    cd Backend/scrapers
    export PATH=$PATH:/usr/lib/chromium-browser/
    python3 nutrition_scraper.py

- name: Export to JSON
  run: |
    cd Backend
    python3 export_to_json.py

- name: Commit and push scraped data
  run: |
    git add Backend/data/ docs/api/
    git commit -m "🤖 Auto-update dining hall data - $(date +'%Y-%m-%d')"
    git push
```

## Advantages vs Backend Server

| Feature | Static JSON (GitHub Pages) | Backend Server (Render/Vercel) |
|---------|---------------------------|--------------------------------|
| **Cost** | Free forever | Free tier (with limits) |
| **Setup** | 5 minutes | 15-30 minutes |
| **Speed** | Very fast (CDN) | Fast |
| **Maintenance** | Zero | Occasional |
| **User Accounts** | ❌ No (read-only) | ✅ Yes |
| **Meal Tracking** | ❌ No | ✅ Yes |
| **Menu Display** | ✅ Yes | ✅ Yes |

## Limitations

This approach is **read-only**. You CAN:
- ✅ Display all dining hall menus
- ✅ Show nutrition information
- ✅ Filter by meal type, date, etc.
- ✅ Search foods

You CANNOT:
- ❌ User login/registration
- ❌ Save user preferences
- ❌ Log meals eaten
- ❌ Track nutrition over time

**Solution**: For user features, use browser localStorage or add Supabase (free PostgreSQL) later.

## When to Use This Approach

**Perfect for:**
- Just showing dining hall menus
- MVP/demo version
- No user accounts needed yet

**Not ideal for:**
- User authentication
- Personalized meal tracking
- Real-time data updates

## Next Step: Add User Features (Optional)

If you later want user accounts and meal tracking, add **Supabase** (free PostgreSQL):

1. Sign up at https://supabase.com
2. Create a project (free tier)
3. Use Supabase for user data (auth, profiles, meal logs)
4. Keep GitHub Pages for menu data (no backend needed!)

Best of both worlds:
- Menus: Static JSON on GitHub Pages (free, fast)
- Users: Supabase PostgreSQL (free, 500MB)

---

## Summary

**This is the simplest solution:**
1. ✅ Scraper runs → Updates database
2. ✅ Export script → Creates JSON files
3. ✅ GitHub Pages → Serves JSON
4. ✅ Flutter app → Fetches JSON
5. ✅ No backend server needed!

**Total cost: $0**
**Maintenance: ~5 minutes/week**

Ready to set this up? Just run the scraper and export script!
