"""
Meal Planning Algorithm
Generates optimized meal plans based on calorie targets and nutritional goals
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
        Initialize meal planner

        Args:
            db_file: Path to SQLite database (optional)
            excel_file: Path to Excel file to use instead of database
        """
        self.db_file = db_file
        self.excel_file = excel_file
        self.data = None
        
        # Define nutritional goals (Protein/Fat/Carb splits)
        self.GOALS = {
            'balanced': {'p': 0.30, 'f': 0.30, 'c': 0.40, 'desc': 'Balanced Diet (30/30/40)'},
            'weight_loss': {'p': 0.40, 'f': 0.25, 'c': 0.35, 'desc': 'Weight Loss (High Protein)'},
            'bulking': {'p': 0.30, 'f': 0.20, 'c': 0.50, 'desc': 'Bulking (High Carb/Calorie)'},
            'keto': {'p': 0.25, 'f': 0.70, 'c': 0.05, 'desc': 'Keto (High Fat, Low Carb)'},
        }

    def load_data(self):
        """Load nutrition data from Excel or database"""
        if self.excel_file:
            # print(f"Loading data from Excel: {self.excel_file}")
            self.data = pd.read_excel(self.excel_file)
        else:
            # print(f"Loading data from database: {self.db_file}")
            conn = sqlite3.connect(self.db_file)
            self.data = pd.read_sql_query("SELECT * FROM nutrition_data", conn)
            conn.close()

    def get_current_meal_type(self):
        """Automatically determine meal type based on current time"""
        current_hour = datetime.now().hour

        if 6 <= current_hour < 10:
            return "Breakfast"
        elif 10 <= current_hour < 15:
            return "Lunch"
        elif 15 <= current_hour < 21:
            return "Dinner"
        else:
            if current_hour >= 21 or current_hour < 6:
                return "Breakfast"
            return "Lunch"

    def filter_available_items(self, dining_hall, meal_type, date=None):
        """Filter items available for specific dining hall and meal"""
        if self.data is None:
            self.load_data()

        # Filter by dining hall (partial match)
        filtered = self.data[self.data['dining_hall'].str.contains(dining_hall, case=False, na=False, regex=False)]

        # Filter by meal type
        filtered = filtered[filtered['meal_type'] == meal_type]

        # Filter by date if provided
        if date:
            filtered = filtered[filtered['date'].str.contains(date, case=False, na=False)]

        # Remove items with missing critical nutrition data
        filtered = filtered[
            (filtered['calories'].notna()) &
            (filtered['calories'] > 0) &
            (filtered['protein'].notna()) &
            (filtered['total_fat'].notna())
        ]

        return filtered.copy()

    def categorize_items(self, items_df):
        """Categorize items into food groups"""
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
            'other': items_df  # All items as fallback
        }

        # Also categorize by name if category is missing
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
        Filter items based on dietary restrictions
        """
        if not vegetarian and not vegan:
            return items_df

        # Keywords to exclude
        meat_keywords = [
            'chicken', 'beef', 'pork', 'turkey', 'fish', 'salmon', 'tuna', 
            'shrimp', 'crab', 'lobster', 'lamb', 'veal', 'bacon', 'ham', 
            'sausage', 'pepperoni', 'salami', 'steak', 'burger', 'meatball', 
            'wings', 'clams', 'oyster'
        ]
        
        # Additional dairy/egg keywords for vegan
        dairy_egg_keywords = [
            'milk', 'cheese', 'cream', 'yogurt', 'butter', 'egg', 'whey', 
            'casein', 'honey', 'mayonnaise', 'gelato', 'custard', 'alfredo',
            'ranch', 'caesar'
        ]
        
        filtered = items_df.copy()
        
        # 1. Filter out meat (for both Veg and Vegan)
        pattern = '|'.join(meat_keywords)
        filtered = filtered[~filtered['name'].str.contains(pattern, case=False, na=False)]
        filtered = filtered[~filtered['category'].str.contains('Meat|Fish|Poultry', case=False, na=False)]
        
        # 2. Filter out dairy/eggs (for Vegan only)
        if vegan:
            pattern_vegan = '|'.join(dairy_egg_keywords)
            filtered = filtered[~filtered['name'].str.contains(pattern_vegan, case=False, na=False)]
            filtered = filtered[~filtered['category'].str.contains('Dairy|Egg', case=False, na=False)]
            
        return filtered

    def score_item(self, item, goal_config):
        """
        Score an item based on nutritional value and current goal
        """
        score = 0.0
        calories = float(item['calories'])
        protein = float(item['protein'])
        fat = float(item['total_fat'])
        carbs = float(item['total_carbohydrate'])
        fiber = float(item['dietary_fiber']) if pd.notna(item['dietary_fiber']) else 0

        if calories <= 0: return 0

        # Calculate density (per 100 cal)
        p_density = (protein * 4) / calories
        f_density = (fat * 9) / calories
        c_density = (carbs * 4) / calories

        # Score based on proximity to goal ratios
        # We reward items that help us hit the target ratio
        
        # Protein Score
        if p_density >= goal_config['p']:
            score += 30  # Excellent protein source
        elif p_density >= goal_config['p'] * 0.5:
            score += 15  # Decent protein source

        # Fat Score
        # For Keto, we want high fat. For others, we usually want moderate fat.
        if goal_config['f'] > 0.5: # Keto
            if f_density >= 0.5: score += 20
        else: # Normal
            if f_density <= 0.35: score += 20 # Low saturated fat usually preferred
            
        # Carb Score
        if goal_config['c'] < 0.1: # Keto/Low Carb
            if c_density < 0.1: score += 30 # Low carb is good
            elif c_density > 0.3: score -= 20 # High carb is bad
        else:
            if 0.3 <= c_density <= 0.6: score += 10 # Moderate carbs good for energy

        # Fiber is always good
        score += min(fiber * 3, 15)

        return score

    def generate_random_meal(self, categories, target_calories, goal_config, max_items=5):
        """
        Generate a single valid random meal combination
        """
        selected_items = []
        current_cals = 0
        
        # Ensure we get a main protein
        if not categories['protein'].empty:
            main = categories['protein'].sample(n=1).iloc[0]
            selected_items.append(main)
            current_cals += main['calories']
            
        # Ensure we get a vegetable
        if not categories['vegetables'].empty:
            veg = categories['vegetables'].sample(n=1).iloc[0]
            # Avoid duplicates
            if veg['name'] != selected_items[0]['name']:
                selected_items.append(veg)
                current_cals += veg['calories']
                
        # Fill rest with random items from any category until close to target
        attempts = 0
        while len(selected_items) < max_items and attempts < 10:
            attempts += 1
            
            # Pick a random category based on what we might need
            # Simple logic: just pick random for now
            cat_name = random.choice(['protein', 'carbs', 'vegetables', 'other'])
            if categories[cat_name].empty: continue
            
            item = categories[cat_name].sample(n=1).iloc[0]
            
            # Skip duplicates
            if any(s['name'] == item['name'] for s in selected_items):
                continue
                
            # Check if it fits
            if current_cals + item['calories'] > target_calories * 1.2:
                continue
                
            selected_items.append(item)
            current_cals += item['calories']
            
            if current_cals >= target_calories * 0.9:
                break
                
        return selected_items

    def is_discrete_item(self, name):
        """Check if item should be counted in discrete units (0.5, 1.0, etc.)"""
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
        Adjust servings to hit calorie target exactly, respecting discrete items
        """
        if not items: return items
        
        total_cals_initial = sum(item['calories'] for item in items)
        if total_cals_initial == 0: return items
        
        # Initial global scale
        global_scale = target_calories / total_cals_initial
        global_scale = max(0.5, min(global_scale, 2.0))
        
        discrete_items = []
        continuous_items = []
        
        current_cals = 0
        
        # Step 1: Process discrete items first
        for item in items:
            if self.is_discrete_item(item['name']):
                # Scale and round to nearest 0.5
                ideal_servings = item['servings'] * global_scale
                rounded_servings = round(ideal_servings * 2) / 2
                rounded_servings = max(0.5, rounded_servings) # Min 0.5
                
                new_item = item.copy()
                new_item['servings'] = rounded_servings
                new_item['calories'] = round(item['calories'] / item['servings'] * rounded_servings, 1)
                new_item['protein'] = round(item['protein'] / item['servings'] * rounded_servings, 1)
                new_item['total_fat'] = round(item['total_fat'] / item['servings'] * rounded_servings, 1)
                new_item['total_carbohydrate'] = round(item['total_carbohydrate'] / item['servings'] * rounded_servings, 1)
                
                # Handle fiber safely
                fiber_val = item.get('dietary_fiber', 0)
                if pd.isna(fiber_val): fiber_val = 0
                new_item['dietary_fiber'] = round(float(fiber_val) / item['servings'] * rounded_servings, 1)
                
                discrete_items.append(new_item)
                current_cals += new_item['calories']
            else:
                continuous_items.append(item)

        # Step 2: Adjust continuous items to fill the gap
        remaining_cals = target_calories - current_cals
        continuous_initial_cals = sum(i['calories'] for i in continuous_items)
        
        final_items = discrete_items.copy()
        
        if continuous_items:
            # If we have continuous items, scale them to fit remaining calories
            # But don't let them go negative or too crazy
            if continuous_initial_cals > 0 and remaining_cals > 0:
                cont_scale = remaining_cals / continuous_initial_cals
                # Clamp scale to avoid huge portions just to fill calories
                cont_scale = max(0.2, min(cont_scale, 3.0))
            else:
                cont_scale = global_scale # Fallback if math gets weird
                
            for item in continuous_items:
                new_item = item.copy()
                new_item['servings'] = round(item['servings'] * cont_scale, 2)
                new_item['calories'] = round(item['calories'] * cont_scale, 1)
                new_item['protein'] = round(item['protein'] * cont_scale, 1)
                new_item['total_fat'] = round(item['total_fat'] * cont_scale, 1)
                new_item['total_carbohydrate'] = round(item['total_carbohydrate'] * cont_scale, 1)
                
                fiber_val = item.get('dietary_fiber', 0)
                if pd.isna(fiber_val): fiber_val = 0
                new_item['dietary_fiber'] = round(float(fiber_val) * cont_scale, 1)
                
                final_items.append(new_item)
        else:
            # If no continuous items, we just have to live with the discrete rounding
            # Maybe add the original continuous items back scaled globally if logic failed?
            # But here continuous_items is empty, so we are done.
            pass
            
        return final_items

    def evaluate_meal(self, items, target_calories, goal_config, target_protein=None):
        """
        Calculate a total score for a complete meal
        """
        total_cals = sum(item['calories'] for item in items)
        total_p = sum(item['protein'] for item in items)
        total_f = sum(item['total_fat'] for item in items)
        total_c = sum(item['total_carbohydrate'] for item in items)
        
        if total_cals == 0: return -1000
        
        # 1. Calorie Score (how close to target)
        cal_diff_percent = abs(total_cals - target_calories) / target_calories
        cal_score = max(0, 100 - (cal_diff_percent * 200)) # 100 pts if exact, 0 if >50% off
        
        # 2. Protein Score (if target specified)
        protein_score = 0
        if target_protein and target_protein > 0:
            protein_diff_percent = abs(total_p - target_protein) / target_protein
            protein_score = max(0, 100 - (protein_diff_percent * 200))
        
        # 3. Macro Balance Score
        p_ratio = (total_p * 4) / total_cals
        f_ratio = (total_f * 9) / total_cals
        c_ratio = (total_c * 4) / total_cals
        
        # Euclidean distance from goal vector
        dist = np.sqrt(
            (p_ratio - goal_config['p'])**2 +
            (f_ratio - goal_config['f'])**2 +
            (c_ratio - goal_config['c'])**2
        )
        macro_score = max(0, 100 - (dist * 200))
        
        # 4. Diversity Score (bonus for using multiple categories)
        cats = set()
        for item in items:
            cats.add(str(item['category']))
        div_score = len(cats) * 10
        
        # Weight the scores - if protein target specified, give it significant weight
        if target_protein and target_protein > 0:
            return (cal_score * 0.30) + (protein_score * 0.25) + (macro_score * 0.35) + (div_score * 0.1)
        else:
            return (cal_score * 0.4) + (macro_score * 0.5) + (div_score * 0.1)

    def smart_repair(self, items, target_calories, goal_config, target_protein=None):
        """
        Iteratively improve a meal by swapping the 'worst' item for a better one
        """
        current_items = items.copy()
        
        # calculate current state
        total_cals = sum(i['calories'] for i in current_items)
        total_prot = sum(i['protein'] for i in current_items)
        
        # Identify what we need
        cal_diff = target_calories - total_cals
        prot_diff = (target_protein - total_prot) if target_protein else 0
        
        # Decide what to swap out (worst item)
        # If we have too many calories, remove high cal item
        # If we have too few, remove low cal item (to replace with bigger one)
        # If we need protein, remove low protein item
        
        worst_item_idx = -1
        best_swap_score = -float('inf')
        
        # Heuristic to pick item to remove
        if total_cals > target_calories * 1.1:
            # Remove highest calorie item
            worst_item_idx = max(range(len(current_items)), key=lambda i: current_items[i]['calories'])
        elif target_protein and total_prot < target_protein * 0.9:
            # Remove lowest protein item
            worst_item_idx = min(range(len(current_items)), key=lambda i: current_items[i]['protein'])
        else:
            # Randomly pick one to change
            worst_item_idx = random.randint(0, len(current_items) - 1)
            
        removed_item = current_items.pop(worst_item_idx)
        
        # Find best replacement from available categories
        # We can try adding an item from any category
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
        
        # Try swaps
        for cand in candidates:
            # Skip if already in meal
            if any(i['name'] == cand['name'] for i in current_items):
                continue
                
            test_meal = current_items + [cand]
            
            # Quick optimize servings for test
            test_meal = self.optimize_servings(test_meal, target_calories)
            
            score = self.evaluate_meal(test_meal, target_calories, goal_config, target_protein)
            
            if score > best_new_score:
                best_new_score = score
                best_replacement = cand
                
        if best_replacement and best_new_score > self.evaluate_meal(items, target_calories, goal_config, target_protein):
            current_items.append(best_replacement)
            return self.optimize_servings(current_items, target_calories)
            
        return items # Return original if no improvement

    def create_meal_plan(self, target_calories, dining_hall, meal_type=None, goal='balanced', target_protein=None, date=None, vegetarian=False, vegan=False):
        """
        Create an optimized meal plan using Smart Repair algorithm
        """
        if meal_type is None:
            meal_type = self.get_current_meal_type()
            
        goal_config = self.GOALS.get(goal, self.GOALS['balanced'])
        
        # Get available items
        available_items = self.filter_available_items(dining_hall, meal_type, date)
        
        # Apply dietary filters
        available_items = self.filter_by_dietary_restrictions(available_items, vegetarian, vegan)
        
        if len(available_items) == 0:
            diet_msg = ""
            if vegan: diet_msg = " (Vegan)"
            elif vegetarian: diet_msg = " (Vegetarian)"
            return {'error': f'No items found for {dining_hall} - {meal_type} on {date if date else "any date"}{diet_msg}'}

        # Categorize (save as class member for smart_repair to use)
        self.categories = self.categorize_items(available_items)
        categories = self.categories # local ref for generate_random_meal
        
        best_meal = None
        best_score = -float('inf')
        
        # 1. Generate initial population (Random Search)
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

        # 2. Smart Repair (Evolutionary Improvement)
        # Take the top 5 meals and try to improve them iteratively
        population.sort(key=lambda x: x['score'], reverse=True)
        top_candidates = [m['items'] for m in population[:5]]
        
        for candidate in top_candidates:
            current_meal = candidate
            # 50 iterations of improvement per candidate
            for _ in range(50):
                new_meal = self.smart_repair(current_meal, target_calories, goal_config, target_protein)
                new_score = self.evaluate_meal(new_meal, target_calories, goal_config, target_protein)
                
                if new_score > self.evaluate_meal(current_meal, target_calories, goal_config, target_protein):
                    current_meal = new_meal
                
                if new_score > best_score:
                    best_score = new_score
                    best_meal = new_meal

        # Final formatting
        total_calories = sum(i['calories'] for i in best_meal)
        total_protein = sum(i['protein'] for i in best_meal)
        total_fat = sum(i['total_fat'] for i in best_meal)
        total_carbs = sum(i['total_carbohydrate'] for i in best_meal)
        
        # Calculate percentages
        fat_percent = (total_fat * 9 / total_calories * 100) if total_calories > 0 else 0
        protein_percent = (total_protein * 4 / total_calories * 100) if total_calories > 0 else 0
        carb_percent = (total_carbs * 4 / total_calories * 100) if total_calories > 0 else 0

        # Clean up items for JSON output
        final_items_clean = []
        for item in best_meal:
            final_items_clean.append({
                'name': item['name'],
                'category': item['category'],
                'servings': item['servings'],
                'calories': item['calories'],
                'protein': item['protein'],
                'fat': item['total_fat'],
                'carbs': item['total_carbohydrate'],
                'score': 0 # Legacy field
            })

        result = {
            'dining_hall': dining_hall,
            'meal_type': meal_type,
            'date': date,
            'dietary': 'Vegan' if vegan else ('Vegetarian' if vegetarian else 'Standard'),
            'target_calories': target_calories,
            'goal': goal_config['desc'],
            'actual_calories': round(total_calories, 1),
            'items': final_items_clean,
            'totals': {
                'calories': round(total_calories, 1),
                'protein': round(total_protein, 1),
                'fat': round(total_fat, 1),
                'carbs': round(total_carbs, 1),
                'fat_percent': round(fat_percent, 1),
                'protein_percent': round(protein_percent, 1),
                'carb_percent': round(carb_percent, 1)
            },
            'meets_target': abs(total_calories - target_calories) < (target_calories * 0.1)
        }
        
        # Add protein target info if specified
        if target_protein:
            result['target_protein'] = target_protein
            result['meets_protein_target'] = abs(total_protein - target_protein) < (target_protein * 0.1) # Stricter check
        
        return result

if __name__ == "__main__":
    import argparse
    import json
    import os
    import sys

    # Default paths
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(current_dir)
    default_db = os.path.join(backend_dir, 'data', 'nutrition_data.db')
    
    if not os.path.exists(default_db):
        default_db = 'nutrition_data.db'

    parser = argparse.ArgumentParser()
    parser.add_argument('--calories', type=int, default=600)
    parser.add_argument('--protein', type=int, default=None, help='Target protein in grams')
    parser.add_argument('--hall', type=str, default='ISR')
    parser.add_argument('--meal', type=str)
    parser.add_argument('--goal', type=str, default='balanced', choices=['balanced', 'weight_loss', 'bulking', 'keto'])
    parser.add_argument('--date', type=str, help='Filter by date (e.g. "Friday, February 13, 2026")')
    parser.add_argument('--vegetarian', action='store_true', help='Vegetarian only')
    parser.add_argument('--vegan', action='store_true', help='Vegan only')
    parser.add_argument('--db', type=str, default=default_db)
    parser.add_argument('--json', action='store_true')
    
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

    if args.json:
        print(json.dumps(meal_plan))
    else:
        print(json.dumps(meal_plan, indent=2))
