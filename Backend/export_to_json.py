#!/usr/bin/env python3
# export_to_json.py — read nutrition_data.db and write static JSON files.
# Output goes to two directories:
#   Docs/api/          → committed to git, served by GitHub Pages
#   webapp/public/api/ → gitignored, used by the Vite dev server locally
import sqlite3
import json
import os
from pathlib import Path
from datetime import datetime

# Resolve paths relative to this file so the script works from any working directory.
db_path = Path(__file__).parent / 'data' / 'nutrition_data.db'
docs_api_dir = Path(__file__).parent.parent / 'Docs' / 'api'
webapp_api_dir = Path(__file__).parent.parent / 'webapp' / 'public' / 'api'
output_dirs = [docs_api_dir, webapp_api_dir]

for out_dir in output_dirs:
    out_dir.mkdir(parents=True, exist_ok=True)

print('Exporting database to JSON files...')

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row  # Allows dict(row) column-name access.
cursor = conn.cursor()

# --- dining-halls.json ---
# A simple index of all halls so the frontend can populate its hall list
# without fetching every per-hall file upfront.
cursor.execute('SELECT DISTINCT dining_hall FROM nutrition_data ORDER BY dining_hall')
halls = [row['dining_hall'] for row in cursor.fetchall()]

for out_dir in output_dirs:
    with open(out_dir / 'dining-halls.json', 'w') as f:
        json.dump({'dining_halls': halls, 'count': len(halls), 'last_updated': datetime.now().isoformat()}, f, indent=2)
print(f'✓ Exported {len(halls)} dining halls')

# --- <hall-name>.json (one file per dining hall) ---
# Filename is derived from the hall name: spaces/slashes → hyphens, lowercased.
# The frontend constructs the same filename to fetch the right file.
for hall in halls:
    filename = hall.replace(' ', '-').replace('/', '-').lower() + '.json'

    cursor.execute('''
        SELECT DISTINCT
            name, category, serving_size, calories, protein,
            total_fat, total_carbohydrate, dietary_fiber, sugars, sodium,
            meal_type, date
        FROM nutrition_data
        WHERE dining_hall = ?
        ORDER BY date DESC, meal_type, category, name
    ''', (hall,))

    foods = [dict(row) for row in cursor.fetchall()]

    output = {
        'dining_hall': hall,
        'foods': foods,
        'count': len(foods),
        'last_updated': datetime.now().isoformat()
    }

    for out_dir in output_dirs:
        with open(out_dir / filename, 'w') as f:
            json.dump(output, f, indent=2)
    print(f'✓ Exported {len(foods)} foods for {hall}')

# --- available-meals.json ---
# Lists every (meal_type, date) pair so the frontend can build date/station pickers
# without loading all per-hall data.
cursor.execute('SELECT DISTINCT meal_type, date FROM nutrition_data ORDER BY date DESC, meal_type')
meals = [dict(row) for row in cursor.fetchall()]

for out_dir in output_dirs:
    with open(out_dir / 'available-meals.json', 'w') as f:
        json.dump({'meals': meals, 'count': len(meals), 'last_updated': datetime.now().isoformat()}, f, indent=2)
print(f'✓ Exported {len(meals)} available meal times')

conn.close()

print('\n✅ All data exported successfully!')
print('📁 JSON files saved to:')
for out_dir in output_dirs:
    print(f'  - {out_dir}')
print('\nYour API endpoints will be:')
print('  https://infoshubhjain.github.io/Project-Harvest/api/dining-halls.json')
print('  https://infoshubhjain.github.io/Project-Harvest/api/[hall-name].json')
