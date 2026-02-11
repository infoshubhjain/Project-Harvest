
import os
import sys
# Add the directory containing nutrition_scraper.py to the Python path
sys.path.append(os.path.join(os.path.dirname('__file__'), 'Backend/scrapers'))

from nutrition_scraper import NutritionScraperComplete
import time

def reproduce_issue():
    scraper = NutritionScraperComplete(headless=True)
    try:
        print("Getting dining structure...")
        dining_halls = scraper.scrape_dining_structure()
        
        target_halls = ["PAR", "LAR", "Ikenberry"]
        
        for hall in dining_halls:
            name = hall['dining_hall']
            # efficient matching
            is_target = False
            for target in target_halls:
                if target.lower() in name.lower():
                    is_target = True
                    break
            
            if not is_target:
                continue
                
            print(f"\n{'='*40}")
            print(f"Checking {name}...")
            print(f"{'='*40}")
            
            if not hall['dining_services']:
                print("  No services found.")
                continue
                
            for service in hall['dining_services']:
                print(f"\n  Service: {service['service_name']} (ID: {service['service_id']})")
                
                if scraper.navigate_to_service(service['service_id'], service['service_name']):
                    # Get available dates
                    available_dates = scraper.get_available_dates_for_next_n_days(1)
                    if not available_dates:
                        print("    No dates available.")
                        continue
                        
                    # Select today
                    today_item = available_dates[0]
                    print(f"    Checking Date: {today_item['date_str']}")
                    
                    if scraper.select_date(today_item['element']):
                        meals = scraper.get_all_meals_structured()
                        print(f"    Meals found: {[m['meal_type'] for m in meals]}")
                        
                        dinner_meal = next((m for m in meals if m['meal_type'] == "Dinner"), None)
                        
                        if not dinner_meal:
                            print(f"    ⚠️  DINNER MISSING for {service['service_name']}")
                        else:
                            print(f"    ✅ Dinner found. Checking items...")
                            if scraper.click_meal(dinner_meal['element']):
                                # Count items
                                items = scraper.extract_nutrition_info(max_items=3) # Limit to 3 just to check existence
                                if items:
                                    print(f"      ✅ Found {len(items)} items in Dinner.")
                                else:
                                    print(f"      ⚠️  DINNER EMPTY (0 items) for {service['service_name']}")
                            else:
                                print("      Failed to click Dinner.")
                    else:
                        print("    Failed to select date.")
                else:
                    print("    Failed to navigate to service.")
                
    except Exception as e:
        print(f"An error occurred: {e}")
        import traceback
        traceback.print_exc()
    finally:
        scraper.close()

if __name__ == "__main__":
    reproduce_issue()
