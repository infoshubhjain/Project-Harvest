#!/usr/bin/env python3
import sqlite3
import json
import os
from pathlib import Path
from datetime import datetime

# Paths
db_path = Path(__file__).parent / 'data' / 'nutrition_data.db'
output_dir = Path(__file__).parent.parent / 'Docs' / 'api'

# Create output directory
output_dir.mkdir(parents=True, exist_ok=True)

print('Exporting database to JSON files...')

# Connect to database
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row  # This enables column access by name
cursor = conn.cursor()

# Export dining halls list
cursor.execute('SELECT DISTINCT dining_hall FROM nutrition_data ORDER BY dining_hall')
halls = [row['dining_hall'] for row in cursor.fetchall()]

with open(output_dir / 'dining-halls.json', 'w') as f:
    json.dump({'dining_halls': halls, 'count': len(halls), 'last_updated': datetime.now().isoformat()}, f, indent=2)
print(f'✓ Exported {len(halls)} dining halls')

# Export foods for each dining hall
for hall in halls:
    filename = hall.replace(' ', '-').replace('/', '-').lower() + '.json'

    cursor.execute('''
        SELECT DISTINCT
            name, category, serving_size, calories, protein,
            total_fat, total_carbohydrate, dietary_fiber, sugars, sodium,
            meal_type, date
        FROM nutrition_data
        WHERE dining_hall = ?
        ORDER BY meal_type, category, name
    ''', (hall,))

    foods = [dict(row) for row in cursor.fetchall()]

    output = {
        'dining_hall': hall,
        'foods': foods,
        'count': len(foods),
        'last_updated': datetime.now().isoformat()  # Set at export time
    }

    with open(output_dir / filename, 'w') as f:
        json.dump(output, f, indent=2)
    print(f'✓ Exported {len(foods)} foods for {hall}')

# Export all available meal types and dates
cursor.execute('SELECT DISTINCT meal_type, date FROM nutrition_data ORDER BY date DESC, meal_type')
meals = [dict(row) for row in cursor.fetchall()]

with open(output_dir / 'available-meals.json', 'w') as f:
    json.dump({'meals': meals, 'count': len(meals), 'last_updated': datetime.now().isoformat()}, f, indent=2)
print(f'✓ Exported {len(meals)} available meal times')

conn.close()

print('\n✅ All data exported successfully!')
print(f'📁 JSON files saved to: {output_dir}')
print('\nYour API endpoints will be:')
print('  https://infoshubhjain.github.io/Project-Harvest/api/dining-halls.json')
print('  https://infoshubhjain.github.io/Project-Harvest/api/[hall-name].json')
