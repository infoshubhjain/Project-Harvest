#!/usr/bin/env python3
"""Create sample dining hall data for testing"""
import sqlite3
from pathlib import Path

db_path = Path(__file__).parent / 'data' / 'nutrition_data.db'

# Create connection
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Create table if it doesn't exist
cursor.execute('''
CREATE TABLE IF NOT EXISTS nutrition_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dining_hall TEXT,
    service TEXT,
    date TEXT,
    meal_type TEXT,
    category TEXT,
    name TEXT,
    serving_size TEXT,
    calories REAL,
    protein REAL,
    total_fat REAL,
    total_carbohydrate REAL,
    dietary_fiber REAL,
    sugars REAL,
    sodium REAL
)
''')

# Sample data for a few dining halls
sample_foods = [
    # ISR - Breakfast
    ('ISR', 'Main Dining', '2025-12-12', 'Breakfast', 'Entrees', 'Scrambled Eggs', '1 serving', 140, 12, 10, 2, 0, 1, 180),
    ('ISR', 'Main Dining', '2025-12-12', 'Breakfast', 'Entrees', 'Pancakes', '2 pancakes', 220, 6, 4, 42, 2, 8, 450),
    ('ISR', 'Main Dining', '2025-12-12', 'Breakfast', 'Sides', 'Hash Browns', '1 serving', 160, 2, 8, 20, 2, 0, 280),
    ('ISR', 'Main Dining', '2025-12-12', 'Breakfast', 'Beverages', 'Orange Juice', '8 oz', 110, 2, 0, 26, 0, 22, 0),

    # ISR - Lunch
    ('ISR', 'Main Dining', '2025-12-12', 'Lunch', 'Entrees', 'Grilled Chicken Breast', '4 oz', 180, 35, 4, 0, 0, 0, 380),
    ('ISR', 'Main Dining', '2025-12-12', 'Lunch', 'Entrees', 'Vegetable Stir Fry', '1 cup', 120, 4, 5, 18, 4, 6, 420),
    ('ISR', 'Main Dining', '2025-12-12', 'Lunch', 'Sides', 'Brown Rice', '1 cup', 215, 5, 2, 45, 4, 1, 10),
    ('ISR', 'Main Dining', '2025-12-12', 'Lunch', 'Sides', 'Garden Salad', '1 cup', 25, 1, 0, 5, 2, 3, 15),

    # ISR - Dinner
    ('ISR', 'Main Dining', '2025-12-12', 'Dinner', 'Entrees', 'Baked Salmon', '5 oz', 280, 39, 13, 0, 0, 0, 95),
    ('ISR', 'Main Dining', '2025-12-12', 'Dinner', 'Entrees', 'Spaghetti with Marinara', '1.5 cups', 310, 11, 4, 58, 6, 8, 480),
    ('ISR', 'Main Dining', '2025-12-12', 'Dinner', 'Sides', 'Steamed Broccoli', '1 cup', 55, 4, 0.5, 11, 5, 2, 30),
    ('ISR', 'Main Dining', '2025-12-12', 'Dinner', 'Desserts', 'Chocolate Chip Cookie', '1 cookie', 160, 2, 8, 21, 1, 12, 110),

    # PAR - Breakfast
    ('PAR', 'Main Dining', '2025-12-12', 'Breakfast', 'Entrees', 'Belgian Waffles', '2 waffles', 340, 8, 10, 54, 2, 10, 520),
    ('PAR', 'Main Dining', '2025-12-12', 'Breakfast', 'Entrees', 'Turkey Sausage', '2 links', 120, 14, 6, 2, 0, 0, 480),
    ('PAR', 'Main Dining', '2025-12-12', 'Breakfast', 'Sides', 'Fresh Fruit Salad', '1 cup', 80, 1, 0, 20, 3, 16, 5),

    # PAR - Lunch
    ('PAR', 'Main Dining', '2025-12-12', 'Lunch', 'Entrees', 'Turkey Burger', '1 burger', 290, 28, 12, 22, 2, 3, 580),
    ('PAR', 'Main Dining', '2025-12-12', 'Lunch', 'Entrees', 'Veggie Wrap', '1 wrap', 250, 8, 9, 36, 6, 4, 520),
    ('PAR', 'Main Dining', '2025-12-12', 'Lunch', 'Sides', 'Sweet Potato Fries', '1 serving', 180, 2, 7, 28, 4, 8, 210),

    # LAR - Breakfast
    ('LAR', 'Main Dining', '2025-12-12', 'Breakfast', 'Entrees', 'Oatmeal Bar', '1 bar', 150, 3, 5, 24, 3, 10, 95),
    ('LAR', 'Main Dining', '2025-12-12', 'Breakfast', 'Entrees', 'Yogurt Parfait', '1 cup', 180, 8, 3, 30, 2, 22, 80),
    ('LAR', 'Main Dining', '2025-12-12', 'Breakfast', 'Beverages', 'Coffee', '12 oz', 5, 0, 0, 1, 0, 0, 5),

    # LAR - Lunch
    ('LAR', 'Main Dining', '2025-12-12', 'Lunch', 'Entrees', 'BBQ Chicken Pizza', '2 slices', 420, 24, 14, 48, 2, 6, 980),
    ('LAR', 'Main Dining', '2025-12-12', 'Lunch', 'Entrees', 'Caesar Salad with Chicken', '1 salad', 380, 32, 20, 18, 3, 3, 820),
    ('LAR', 'Main Dining', '2025-12-12', 'Lunch', 'Sides', 'Garlic Breadsticks', '2 sticks', 200, 6, 7, 28, 2, 2, 380),

    # Ikenberry - Breakfast
    ('Ikenberry Dining Center', 'Main Dining', '2025-12-12', 'Breakfast', 'Entrees', 'Breakfast Burrito', '1 burrito', 380, 18, 16, 38, 4, 2, 720),
    ('Ikenberry Dining Center', 'Main Dining', '2025-12-12', 'Breakfast', 'Entrees', 'French Toast', '2 slices', 280, 8, 8, 44, 2, 12, 420),
    ('Ikenberry Dining Center', 'Main Dining', '2025-12-12', 'Breakfast', 'Sides', 'Bacon Strips', '3 strips', 130, 9, 10, 0, 0, 0, 480),

    # Ikenberry - Lunch
    ('Ikenberry Dining Center', 'Main Dining', '2025-12-12', 'Lunch', 'Entrees', 'Teriyaki Chicken Bowl', '1 bowl', 450, 32, 8, 62, 3, 14, 890),
    ('Ikenberry Dining Center', 'Main Dining', '2025-12-12', 'Lunch', 'Entrees', 'Black Bean Burger', '1 burger', 240, 12, 6, 35, 8, 4, 520),
    ('Ikenberry Dining Center', 'Main Dining', '2025-12-12', 'Lunch', 'Sides', 'Coleslaw', '0.5 cup', 90, 1, 5, 11, 2, 8, 180),
]

# Insert sample data
cursor.executemany('''
    INSERT INTO nutrition_data (
        dining_hall, service, date, meal_type, category, name,
        serving_size, calories, protein, total_fat, total_carbohydrate,
        dietary_fiber, sugars, sodium
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
''', sample_foods)

conn.commit()
conn.close()

print(f'✅ Created {len(sample_foods)} sample food items in the database!')
print(f'📁 Database location: {db_path}')
print('\nDining halls:')
print('  - ISR (12 items)')
print('  - PAR (6 items)')
print('  - LAR (6 items)')
print('  - Ikenberry Dining Center (6 items)')
print('\nYou can now run: python3 export_to_json.py')
