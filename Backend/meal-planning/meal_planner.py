"""
Meal Planning Algorithm
Generates optimized meal plans based on calorie targets and nutritional goals.

Algorithm overview:
  1. Filter the DB to items available for the requested hall / meal period / date.
  2. Categorize items into protein, carbs, vegetables, other.
  3. Generate an initial population of 20 random meals (greedy random search).
  4. Iteratively improve the top 5 candidates via Smart Repair (swap-based hill climbing).
  5. Return the best-scoring meal after formatting serving sizes.
"""
import sqlite3
import pandas as pd
import random
import numpy as np
from datetime import datetime
from collections import defaultdict


class MealPlanner:
    def __init__(self, db_file='nutrition_data.db', excel_file=None):
        """
        Initialize meal planner.

        Args:
            db_file: Path to SQLite database (optional)
            excel_file: Path to Excel file to use instead of database
        """
        self.db_file = db_file
        self.excel_file = excel_file
        self.data = None

        # Macro split ratios (protein/fat/carb) for each supported goal.
        self.GOALS = {
            'balanced':    {'p': 0.30, 'f': 0.30, 'c': 0.40, 'desc': 'Balanced Diet (30/30/40)'},
            'weight_loss': {'p': 0.40, 'f': 0.25, 'c': 0.35, 'desc': 'Weight Loss (High Protein)'},
            'bulking':     {'p': 0.30, 'f': 0.20, 'c': 0.50, 'desc': 'Bulking (High Carb/Calorie)'},
            'keto':        {'p': 0.25, 'f': 0.70, 'c': 0.05, 'desc': 'Keto (High Fat, Low Carb)'},
        }

    def load_data(self):
        """Load nutrition data from Excel or database."""
        if self.excel_file:
            self.data = pd.read_excel(self.excel_file)
        else:
            conn = sqlite3.connect(self.db_file)
            self.data = pd.read_sql_query("SELECT * FROM nutrition_data", conn)
            conn.close()

    def get_current_meal_type(self):
        """Automatically determine meal type based on current time of day."""
        current_hour = datetime.now().hour

        if 6 <= current_hour < 10:
            return "Breakfast"
        elif 10 <= current_hour < 15:
            return "Lunch"
        elif 15 <= current_hour < 21:
            return "Dinner"
        else:
            # Late night / early morning defaults to next Breakfast.
            if current_hour >= 21 or current_hour < 6:
                return "Breakfast"
            return "Lunch"

    def filter_available_items(self, dining_hall, meal_type, date=None):
        """Filter the dataset to items available for a specific dining hall and meal."""
        if self.data is None:
            self.load_data()

        # Partial match so "ISR" matches "Illinois Street Dining Center (ISR)".
        filtered = self.data[self.data['dining_hall'].str.contains(dining_hall, case=False, na=False, regex=False)]
        filtered = filtered[filtered['meal_type'] == meal_type]

        if date:
            filtered = filtered[filtered['date'].str.contains(date, case=False, na=False)]

        # Drop items with no calorie data — they cannot be scored or portioned.
        filtered = filtered[
            (filtered['calories'].notna()) &
            (filtered['calories'] > 0) &
            (filtered['protein'].notna()) &
            (filtered['total_fat'].notna())
        ]

        return filtered.copy()

    def categorize_items(self, items_df):
        """Bucket items into protein / carbs / vegetables / other by category name and item name."""
        categories = {
            'protein': items_df[items_df['category'].str.contains(
                'entree|protein|chicken|beef|fish|pork|turkey|tofu|egg',
                case=False, na=False
            )],
            'carbs': items_df[items_df['category'].str.contains(
                'grain|rice|pasta|bread|potato|starch|cereal',
                case=False, na=False
            )],
            'vegetables': items_df[items_df['category'].str.contains(
                'vegetable|veggie|salad|greens',
                case=False, na=False
            )],
            'other': items_df  # Catch-all so we always have a non-empty pool.
        }

        # Supplement category-based classification with name-based keywords for items
        # that have generic/missing category strings.
        for idx, row in items_df.iterrows():
            name_lower = str(row['name']).lower()

            if any(word in name_lower for word in ['chicken', 'beef', 'pork', 'fish', 'salmon',
                                                     'turkey', 'egg', 'tofu', 'bean', 'lentil']):
                if idx not in categories['protein'].index:
                    categories['protein'] = pd.concat([categories['protein'], items_df.loc[[idx]]])

            if any(word in name_lower for word in ['rice', 'pasta', 'bread', 'potato', 'noodle',
                                                     'tortilla', 'quinoa', 'oat']):
                if idx not in categories['carbs'].index:
                    categories['carbs'] = pd.concat([categories['carbs'], items_df.loc[[idx]]])

            if any(word in name_lower for word in ['broccoli', 'carrot', 'spinach', 'lettuce',
                                                     'tomato', 'pepper', 'green', 'salad', 'veggie']):
                if idx not in categories['vegetables'].index:
                    categories['vegetables'] = pd.concat([categories['vegetables'], items_df.loc[[idx]]])

        return categories

    def filter_by_dietary_restrictions(self, items_df, vegetarian=False, vegan=False):
        """
        Remove items that don't meet the requested dietary restrictions.
        Filters by name keywords and category strings; not a guaranteed allergen check.
        """
        if not vegetarian and not vegan:
            return items_df

        meat_keywords = [
            'chicken', 'beef', 'pork', 'turkey', 'fish', 'salmon', 'tuna',
            'shrimp', 'crab', 'lobster', 'lamb', 'veal', 'bacon', 'ham',
            'sausage', 'pepperoni', 'salami', 'steak', 'burger', 'meatball',
            'wings', 'clams', 'oyster'
        ]

        # Dairy/egg keywords are only excluded for vegan.
        dairy_egg_keywords = [
            'milk', 'cheese', 'cream', 'yogurt', 'butter', 'egg', 'whey',
            'casein', 'honey', 'mayonnaise', 'gelato', 'custard', 'alfredo',
            'ranch', 'caesar'
        ]

        filtered = items_df.copy()

        # Remove meat items for both vegetarian and vegan.
        pattern = '|'.join(meat_keywords)
        filtered = filtered[~filtered['name'].str.contains(pattern, case=False, na=False)]
        filtered = filtered[~filtered['category'].str.contains('Meat|Fish|Poultry', case=False, na=False)]

        if vegan:
            pattern_vegan = '|'.join(dairy_egg_keywords)
            filtered = filtered[~filtered['name'].str.contains(pattern_vegan, case=False, na=False)]
            filtered = filtered[~filtered['category'].str.contains('Dairy|Egg', case=False, na=False)]

        return filtered

    def score_item(self, item, goal_config):
        """
        Score a single food item based on how well its macro density matches the goal.
        Returns a numeric score; higher is better.
        """
        score = 0.0
        calories = float(item['calories'])
        protein = float(item['protein'])
        fat = float(item['total_fat'])
        carbs = float(item['total_carbohydrate'])
        fiber = float(item['dietary_fiber']) if pd.notna(item['dietary_fiber']) else 0

        if calories <= 0:
            return 0

        # Express macros as a fraction of total calories (density per calorie).
        p_density = (protein * 4) / calories
        f_density = (fat * 9) / calories
        c_density = (carbs * 4) / calories

        # Protein score: reward items that meet or exceed the goal's protein ratio.
        if p_density >= goal_config['p']:
            score += 30
        elif p_density >= goal_config['p'] * 0.5:
            score += 15

        # Fat score: keto wants high fat; other goals prefer moderate fat.
        if goal_config['f'] > 0.5:  # Keto
            if f_density >= 0.5:
                score += 20
        else:
            if f_density <= 0.35:
                score += 20

        # Carb score: penalize high-carb items on low-carb goals; reward moderate carbs otherwise.
        if goal_config['c'] < 0.1:  # Keto / low-carb
            if c_density < 0.1:
                score += 30
            elif c_density > 0.3:
                score -= 20
        else:
            if 0.3 <= c_density <= 0.6:
                score += 10

        # Fiber is universally beneficial; cap bonus at 15 pts.
        score += min(fiber * 3, 15)

        return score

    def generate_random_meal(self, categories, target_calories, goal_config, max_items=5):
        """
        Build a single random meal combination by:
          1. Selecting a protein source (if available).
          2. Adding a vegetable (if available and not a duplicate).
          3. Filling remaining slots with random items until the calorie budget is ~90% met.
        """
        selected_items = []
        current_cals = 0

        if not categories['protein'].empty:
            main = categories['protein'].sample(n=1).iloc[0]
            selected_items.append(main)
            current_cals += main['calories']

        if not categories['vegetables'].empty:
            veg = categories['vegetables'].sample(n=1).iloc[0]
            if not selected_items or veg['name'] != selected_items[0]['name']:
                selected_items.append(veg)
                current_cals += veg['calories']

        attempts = 0
        while len(selected_items) < max_items and attempts < 10:
            attempts += 1
            cat_name = random.choice(['protein', 'carbs', 'vegetables', 'other'])
            if categories[cat_name].empty:
                continue

            item = categories[cat_name].sample(n=1).iloc[0]

            if any(s['name'] == item['name'] for s in selected_items):
                continue

            # Allow up to 20% over target during random generation; portioning will fix it later.
            if current_cals + item['calories'] > target_calories * 1.2:
                continue

            selected_items.append(item)
            current_cals += item['calories']

            if current_cals >= target_calories * 0.9:
                break

        return selected_items

    def is_discrete_item(self, name):
        """
        Return True if the item should be portioned in 0.5-unit increments
        (e.g. "1 egg", "0.5 burger buns") rather than as a continuous quantity.
        """
        name_lower = str(name).lower()
        discrete_keywords = [
            'bun', 'bread', 'roll', 'slice', 'cookie', 'egg', 'patty',
            'burger', 'sandwich', 'apple', 'banana', 'orange', 'pear',
            'muffin', 'bagel', 'toast', 'wrap', 'taco', 'burrito', 'pizza',
            'donut', 'pancake', 'waffle', 'sausage'
        ]
        return any(keyword in name_lower for keyword in discrete_keywords)

    def optimize_servings(self, items, target_calories):
        """
        Scale serving sizes so the total calories hit the target:
          - Discrete items are rounded to the nearest 0.5 serving first.
          - Continuous items absorb the remaining calorie gap with a linear scale.
        """
        if not items:
            return items

        total_cals_initial = sum(item['calories'] for item in items)
        if total_cals_initial == 0:
            return items

        # Global scale factor clipped to a sensible range.
        global_scale = target_calories / total_cals_initial
        global_scale = max(0.5, min(global_scale, 2.0))

        discrete_items = []
        continuous_items = []
        current_cals = 0

        # Pass 1: round discrete items to nearest 0.5 serving.
        for item in items:
            if self.is_discrete_item(item['name']):
                ideal_servings = item['servings'] * global_scale
                rounded_servings = max(0.5, round(ideal_servings * 2) / 2)

                new_item = item.copy()
                new_item['servings'] = rounded_servings
                # Scale all macros proportionally with the new serving count.
                ratio = rounded_servings / item['servings']
                new_item['calories']          = round(item['calories']          * ratio, 1)
                new_item['protein']           = round(item['protein']           * ratio, 1)
                new_item['total_fat']         = round(item['total_fat']         * ratio, 1)
                new_item['total_carbohydrate']= round(item['total_carbohydrate']* ratio, 1)

                fiber_val = item.get('dietary_fiber', 0)
                if pd.isna(fiber_val): fiber_val = 0
                new_item['dietary_fiber'] = round(float(fiber_val) * ratio, 1)

                discrete_items.append(new_item)
                current_cals += new_item['calories']
            else:
                continuous_items.append(item)

        # Pass 2: scale continuous items to fill the remaining calorie budget.
        remaining_cals = target_calories - current_cals
        continuous_initial_cals = sum(i['calories'] for i in continuous_items)

        final_items = discrete_items.copy()

        if continuous_items:
            if continuous_initial_cals > 0 and remaining_cals > 0:
                cont_scale = remaining_cals / continuous_initial_cals
                # Clamp so we don't produce absurdly large or tiny portions.
                cont_scale = max(0.2, min(cont_scale, 3.0))
            else:
                cont_scale = global_scale

            for item in continuous_items:
                new_item = item.copy()
                new_item['servings']           = round(item['servings']           * cont_scale, 2)
                new_item['calories']           = round(item['calories']           * cont_scale, 1)
                new_item['protein']            = round(item['protein']            * cont_scale, 1)
                new_item['total_fat']          = round(item['total_fat']          * cont_scale, 1)
                new_item['total_carbohydrate'] = round(item['total_carbohydrate'] * cont_scale, 1)

                fiber_val = item.get('dietary_fiber', 0)
                if pd.isna(fiber_val): fiber_val = 0
                new_item['dietary_fiber'] = round(float(fiber_val) * cont_scale, 1)

                final_items.append(new_item)

        return final_items

    def evaluate_meal(self, items, target_calories, goal_config, target_protein=None):
        """
        Score a complete meal on four weighted dimensions:
          - Calorie closeness  (100 pts if exact, 0 if >50% off)
          - Protein closeness  (only when target_protein is set)
          - Macro ratio distance from goal vector (Euclidean in P/F/C space)
          - Category diversity bonus

        Returns a single scalar score; higher is better.
        """
        total_cals = sum(item['calories'] for item in items)
        total_p    = sum(item['protein'] for item in items)
        total_f    = sum(item['total_fat'] for item in items)
        total_c    = sum(item['total_carbohydrate'] for item in items)

        if total_cals == 0:
            return -1000

        cal_diff_percent = abs(total_cals - target_calories) / target_calories
        cal_score = max(0, 100 - (cal_diff_percent * 200))

        protein_score = 0
        if target_protein and target_protein > 0:
            protein_diff_percent = abs(total_p - target_protein) / target_protein
            protein_score = max(0, 100 - (protein_diff_percent * 200))

        # Macro balance: measure Euclidean distance from the goal's P/F/C ratios.
        p_ratio = (total_p * 4) / total_cals
        f_ratio = (total_f * 9) / total_cals
        c_ratio = (total_c * 4) / total_cals

        dist = np.sqrt(
            (p_ratio - goal_config['p'])**2 +
            (f_ratio - goal_config['f'])**2 +
            (c_ratio - goal_config['c'])**2
        )
        macro_score = max(0, 100 - (dist * 200))

        # Reward diversity: one point per unique category, up to ~40 pts.
        cats = set(str(item['category']) for item in items)
        div_score = len(cats) * 10

        if target_protein and target_protein > 0:
            return (cal_score * 0.30) + (protein_score * 0.25) + (macro_score * 0.35) + (div_score * 0.1)
        else:
            return (cal_score * 0.4) + (macro_score * 0.5) + (div_score * 0.1)

    def smart_repair(self, items, target_calories, goal_config, target_protein=None):
        """
        Attempt to improve a meal by swapping one item for a better candidate:
          - If over calories: remove the highest-calorie item.
          - If under protein target: remove the lowest-protein item.
          - Otherwise: remove a random item.
        Then try 5 random replacements from each category and keep the best swap
        only if it improves the overall meal score.
        """
        current_items = items.copy()

        total_cals = sum(i['calories'] for i in current_items)
        total_prot = sum(i['protein'] for i in current_items)

        # Pick which item to remove.
        if total_cals > target_calories * 1.1:
            worst_item_idx = max(range(len(current_items)), key=lambda i: current_items[i]['calories'])
        elif target_protein and total_prot < target_protein * 0.9:
            worst_item_idx = min(range(len(current_items)), key=lambda i: current_items[i]['protein'])
        else:
            worst_item_idx = random.randint(0, len(current_items) - 1)

        removed_item = current_items.pop(worst_item_idx)

        # Sample replacement candidates from all categories.
        candidates = []
        for cat in ['protein', 'carbs', 'vegetables', 'other']:
            if not self.categories[cat].empty:
                sample = self.categories[cat].sample(n=min(5, len(self.categories[cat])))
                for idx, row in sample.iterrows():
                    item = row.to_dict()
                    item['servings'] = 1.0
                    candidates.append(item)

        best_replacement = None
        best_new_score = -float('inf')

        for cand in candidates:
            if any(i['name'] == cand['name'] for i in current_items):
                continue

            test_meal = self.optimize_servings(current_items + [cand], target_calories)
            score = self.evaluate_meal(test_meal, target_calories, goal_config, target_protein)

            if score > best_new_score:
                best_new_score = score
                best_replacement = cand

        # Only accept the swap if it actually improves the meal.
        if best_replacement and best_new_score > self.evaluate_meal(items, target_calories, goal_config, target_protein):
            current_items.append(best_replacement)
            return self.optimize_servings(current_items, target_calories)

        return items  # No improvement found; return the original.

    def create_meal_plan(self, target_calories, dining_hall, meal_type=None, goal='balanced', target_protein=None, date=None, vegetarian=False, vegan=False):
        """
        Create an optimized meal plan using a two-phase approach:
          Phase 1 — Random Search: generate 20 random meals and score each.
          Phase 2 — Smart Repair:  take the top 5, run 50 swap iterations on each.
        Returns a dict with the best meal and its nutrition totals.
        """
        if meal_type is None:
            meal_type = self.get_current_meal_type()

        goal_config = self.GOALS.get(goal, self.GOALS['balanced'])

        available_items = self.filter_available_items(dining_hall, meal_type, date)
        available_items = self.filter_by_dietary_restrictions(available_items, vegetarian, vegan)

        if len(available_items) == 0:
            diet_msg = " (Vegan)" if vegan else (" (Vegetarian)" if vegetarian else "")
            return {'error': f'No items found for {dining_hall} - {meal_type} on {date if date else "any date"}{diet_msg}'}

        # Store categories as an instance variable so smart_repair can access them.
        self.categories = self.categorize_items(available_items)
        categories = self.categories

        best_meal = None
        best_score = -float('inf')

        # Phase 1: generate initial population of 20 random meals.
        population = []
        for _ in range(20):
            items_df = self.generate_random_meal(categories, target_calories, goal_config)
            items_list = []
            for row in items_df:
                item_dict = row.to_dict()
                item_dict['servings'] = 1.0
                items_list.append(item_dict)

            optimized = self.optimize_servings(items_list, target_calories)
            score = self.evaluate_meal(optimized, target_calories, goal_config, target_protein)
            population.append({'items': optimized, 'score': score})

            if score > best_score:
                best_score = score
                best_meal = optimized

        # Phase 2: improve the top 5 via Smart Repair hill climbing (50 iterations each).
        population.sort(key=lambda x: x['score'], reverse=True)
        top_candidates = [m['items'] for m in population[:5]]

        for candidate in top_candidates:
            current_meal = candidate
            for _ in range(50):
                new_meal = self.smart_repair(current_meal, target_calories, goal_config, target_protein)
                new_score = self.evaluate_meal(new_meal, target_calories, goal_config, target_protein)

                if new_score > self.evaluate_meal(current_meal, target_calories, goal_config, target_protein):
                    current_meal = new_meal

                if new_score > best_score:
                    best_score = new_score
                    best_meal = new_meal

        # Compute final totals from the best meal.
        total_calories = sum(i['calories'] for i in best_meal)
        total_protein  = sum(i['protein'] for i in best_meal)
        total_fat      = sum(i['total_fat'] for i in best_meal)
        total_carbs    = sum(i['total_carbohydrate'] for i in best_meal)

        fat_percent     = (total_fat     * 9 / total_calories * 100) if total_calories > 0 else 0
        protein_percent = (total_protein * 4 / total_calories * 100) if total_calories > 0 else 0
        carb_percent    = (total_carbs   * 4 / total_calories * 100) if total_calories > 0 else 0

        # Strip internal fields before returning; keep only what the frontend needs.
        final_items_clean = []
        for item in best_meal:
            final_items_clean.append({
                'name':     item['name'],
                'category': item['category'],
                'servings': item['servings'],
                'calories': item['calories'],
                'protein':  item['protein'],
                'fat':      item['total_fat'],
                'carbs':    item['total_carbohydrate'],
                'score': 0  # Legacy field kept for API compatibility.
            })

        result = {
            'dining_hall':     dining_hall,
            'meal_type':       meal_type,
            'date':            date,
            'dietary':         'Vegan' if vegan else ('Vegetarian' if vegetarian else 'Standard'),
            'target_calories': target_calories,
            'goal':            goal_config['desc'],
            'actual_calories': round(total_calories, 1),
            'items':           final_items_clean,
            'totals': {
                'calories':        round(total_calories, 1),
                'protein':         round(total_protein, 1),
                'fat':             round(total_fat, 1),
                'carbs':           round(total_carbs, 1),
                'fat_percent':     round(fat_percent, 1),
                'protein_percent': round(protein_percent, 1),
                'carb_percent':    round(carb_percent, 1)
            },
            # Within 10% of target is considered a match.
            'meets_target': abs(total_calories - target_calories) < (target_calories * 0.1)
        }

        if target_protein:
            result['target_protein'] = target_protein
            # Stricter 10% tolerance for protein since it's a hard goal.
            result['meets_protein_target'] = abs(total_protein - target_protein) < (target_protein * 0.1)

        return result


if __name__ == "__main__":
    import argparse
    import json
    import os
    import sys

    # Resolve default DB path relative to this script's location.
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(current_dir)
    default_db = os.path.join(backend_dir, 'data', 'nutrition_data.db')

    # Fall back to local directory if the resolved path doesn't exist.
    if not os.path.exists(default_db):
        default_db = 'nutrition_data.db'

    parser = argparse.ArgumentParser(description='UIUC Dining Meal Planner')
    parser.add_argument('--calories',    type=int, default=600)
    parser.add_argument('--protein',     type=int, default=None, help='Target protein in grams')
    parser.add_argument('--hall',        type=str, default='ISR')
    parser.add_argument('--meal',        type=str)
    parser.add_argument('--goal',        type=str, default='balanced', choices=['balanced', 'weight_loss', 'bulking', 'keto'])
    parser.add_argument('--date',        type=str, help='Filter by date (YYYY-MM-DD or site format)')
    parser.add_argument('--vegetarian',  action='store_true', help='Vegetarian only')
    parser.add_argument('--vegan',       action='store_true', help='Vegan only')
    parser.add_argument('--db',          type=str, default=default_db)
    parser.add_argument('--json',        action='store_true', help='Output single-line JSON (used by server.js)')

    args = parser.parse_args()

    planner = MealPlanner(db_file=args.db)
    meal_plan = planner.create_meal_plan(
        target_calories=args.calories,
        dining_hall=args.hall,
        meal_type=args.meal,
        goal=args.goal,
        target_protein=args.protein,
        date=args.date,
        vegetarian=args.vegetarian,
        vegan=args.vegan
    )

    # --json outputs compact single-line JSON; server.js parses the last line of stdout.
    if args.json:
        print(json.dumps(meal_plan))
    else:
        print(json.dumps(meal_plan, indent=2))
