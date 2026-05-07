"""
Load scraped nutrition data from Excel into SQLite database.

Usage:
    python load_to_db.py [excel_file.xlsx]

If no file is given, picks the most recently modified .xlsx in the current directory.
"""
import sqlite3
import pandas as pd
import os
from datetime import datetime


def create_nutrition_table(conn):
    """Create the nutrition_data table and its indexes if they don't already exist."""
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS nutrition_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dining_hall TEXT NOT NULL,
            service TEXT NOT NULL,
            date TEXT NOT NULL,
            meal_type TEXT NOT NULL,
            category TEXT,
            name TEXT NOT NULL,
            serving_size TEXT,
            calories REAL,
            total_fat REAL,
            saturated_fat REAL,
            trans_fat REAL,
            cholesterol REAL,
            sodium REAL,
            potassium REAL,
            total_carbohydrate REAL,
            dietary_fiber REAL,
            sugars REAL,
            protein REAL,
            scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Indexes speed up the per-hall and per-date queries used by export_to_json.py and server.js.
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_dining_hall ON nutrition_data(dining_hall)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_date_meal   ON nutrition_data(date, meal_type)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_name        ON nutrition_data(name)')

    conn.commit()
    print("✓ Table 'nutrition_data' created/verified")


def load_excel_to_database(excel_file, db_file='../data/nutrition_data.db'):
    """
    Load nutrition data from an Excel file into the SQLite database.

    Strategy: delete only the (dining_hall, date) pairs present in the incoming
    data, then re-insert. This preserves history for dates not covered by the
    current scrape (e.g. yesterday's data remains intact after a today-only run).

    Args:
        excel_file: Path to the Excel file produced by nutrition_scraper.py.
        db_file:    Path to SQLite DB (created if it doesn't exist).
    """
    if not os.path.exists(excel_file):
        print(f"Error: Excel file not found: {excel_file}")
        return False

    print(f"\nLoading data from: {excel_file}")
    print(f"Database: {db_file}\n")

    try:
        df = pd.read_excel(excel_file)
        print(f"✓ Read {len(df)} rows from Excel")
    except Exception as e:
        print(f"Error reading Excel file: {e}")
        return False

    conn = sqlite3.connect(db_file)
    create_nutrition_table(conn)
    cursor = conn.cursor()

    # Targeted delete: only remove rows for the (hall, date) combos we are about to replace,
    # leaving all other historical rows untouched.
    if 'dining_hall' in df.columns and 'date' in df.columns:
        hall_date_pairs = df[['dining_hall', 'date']].drop_duplicates().values.tolist()
        print(f"Replacing data for {len(hall_date_pairs)} (hall, date) combinations...")
        for hall, date in hall_date_pairs:
            cursor.execute(
                "DELETE FROM nutrition_data WHERE dining_hall = ? AND date = ?",
                (hall, date)
            )
        print(f"✓ Cleared stale rows for the scraped (hall, date) pairs only")
    elif 'dining_hall' in df.columns:
        # Older Excel files may lack a date column; fall back to clearing by hall only.
        halls_to_update = df['dining_hall'].unique()
        print(f"Warning: no date column — falling back to clearing all rows for: {', '.join(halls_to_update)}")
        placeholders = ','.join(['?'] * len(halls_to_update))
        cursor.execute(f"DELETE FROM nutrition_data WHERE dining_hall IN ({placeholders})", list(halls_to_update))
    else:
        print("Warning: No dining_hall column found, appending data without clearing old records.")

    inserted = 0
    failed = 0

    for idx, row in df.iterrows():
        try:
            cursor.execute('''
                INSERT INTO nutrition_data (
                    dining_hall, service, date, meal_type, category, name,
                    serving_size, calories, total_fat, saturated_fat, trans_fat,
                    cholesterol, sodium, potassium, total_carbohydrate,
                    dietary_fiber, sugars, protein
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                row.get('dining_hall', ''),
                row.get('service', ''),
                row.get('date', ''),
                row.get('meal_type', ''),
                row.get('category', ''),
                row.get('name', ''),
                row.get('serving_size', ''),
                # Use 0.0 instead of None/NaN so numeric queries don't break.
                float(row.get('calories', 0))           if pd.notna(row.get('calories'))           else 0.0,
                float(row.get('total_fat', 0))          if pd.notna(row.get('total_fat'))          else 0.0,
                float(row.get('saturated_fat', 0))      if pd.notna(row.get('saturated_fat'))      else 0.0,
                float(row.get('trans_fat', 0))          if pd.notna(row.get('trans_fat'))          else 0.0,
                float(row.get('cholesterol', 0))        if pd.notna(row.get('cholesterol'))        else 0.0,
                float(row.get('sodium', 0))             if pd.notna(row.get('sodium'))             else 0.0,
                float(row.get('potassium', 0))          if pd.notna(row.get('potassium'))          else 0.0,
                float(row.get('total_carbohydrate', 0)) if pd.notna(row.get('total_carbohydrate')) else 0.0,
                float(row.get('dietary_fiber', 0))      if pd.notna(row.get('dietary_fiber'))      else 0.0,
                float(row.get('sugars', 0))             if pd.notna(row.get('sugars'))             else 0.0,
                float(row.get('protein', 0))            if pd.notna(row.get('protein'))            else 0.0
            ))
            inserted += 1
        except Exception as e:
            print(f"Error inserting row {idx}: {e}")
            failed += 1

    conn.commit()

    print(f"\n✓ Inserted {inserted} rows")
    if failed > 0:
        print(f"✗ Failed to insert {failed} rows")

    # Summary stats so CI logs are easy to sanity-check.
    print("\n" + "="*60)
    print("DATABASE SUMMARY")
    print("="*60)

    cursor.execute("SELECT COUNT(*) FROM nutrition_data")
    print(f"Total items: {cursor.fetchone()[0]}")

    cursor.execute("SELECT COUNT(DISTINCT dining_hall) FROM nutrition_data")
    print(f"Dining halls: {cursor.fetchone()[0]}")

    cursor.execute("SELECT COUNT(DISTINCT date) FROM nutrition_data")
    print(f"Unique dates: {cursor.fetchone()[0]}")

    cursor.execute("SELECT COUNT(DISTINCT meal_type) FROM nutrition_data")
    print(f"Meal types: {cursor.fetchone()[0]}")

    print("\n" + "="*60)
    print("SAMPLE DATA (First 5 items)")
    print("="*60)

    cursor.execute("""
        SELECT dining_hall, date, meal_type, name, calories
        FROM nutrition_data
        LIMIT 5
    """)
    for row in cursor.fetchall():
        print(f"{row[0]} | {row[1]} | {row[2]} | {row[3]} | {row[4]} cal")

    conn.close()
    print(f"\n✓ Database saved to: {db_file}")

    return True


def query_database(db_file='nutrition_data.db'):
    """Run a handful of example queries for quick manual verification after a load."""
    if not os.path.exists(db_file):
        print(f"Database not found: {db_file}")
        return

    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()

    print("\n" + "="*60)
    print("EXAMPLE QUERIES")
    print("="*60)

    print("\n1. Items by dining hall:")
    cursor.execute("""
        SELECT dining_hall, COUNT(*) as item_count
        FROM nutrition_data
        GROUP BY dining_hall
        ORDER BY item_count DESC
    """)
    for row in cursor.fetchall():
        print(f"   {row[0]}: {row[1]} items")

    print("\n2. High protein items (>20g):")
    cursor.execute("""
        SELECT name, protein, dining_hall, meal_type
        FROM nutrition_data
        WHERE protein > 20
        ORDER BY protein DESC
        LIMIT 5
    """)
    for row in cursor.fetchall():
        print(f"   {row[0]} - {row[1]}g protein ({row[2]}, {row[3]})")

    print("\n3. Average calories by meal type:")
    cursor.execute("""
        SELECT meal_type, ROUND(AVG(calories), 1) as avg_calories
        FROM nutrition_data
        GROUP BY meal_type
        ORDER BY avg_calories DESC
    """)
    for row in cursor.fetchall():
        print(f"   {row[0]}: {row[1]} calories")

    conn.close()


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        excel_file = sys.argv[1]
    else:
        # Auto-discover: pick the newest .xlsx in the current directory.
        excel_files = [f for f in os.listdir('.') if f.endswith('.xlsx') and not f.startswith('~')]

        if not excel_files:
            print("No Excel files found in current directory")
            print("\nUsage: python load_to_db.py [excel_file.xlsx]")
            sys.exit(1)

        excel_files.sort(key=lambda x: os.path.getmtime(x), reverse=True)
        excel_file = excel_files[0]
        print(f"Using most recent Excel file: {excel_file}")

    success = load_excel_to_database(excel_file)

    if success:
        query_database()

        print("\n" + "="*60)
        print("Next steps:")
        print("  - Query database using SQLite tools or Python")
        print("  - Use for meal planning, nutrition tracking, etc.")
        print("  - Integrate with your app/website")
        print("="*60)
