
import os
import sys
sys.path.append(os.path.join(os.path.dirname('__file__'), 'Backend/scrapers'))

from nutrition_scraper import NutritionScraperComplete

class DebugScraper(NutritionScraperComplete):
    def scrape_dining_structure(self):
        # Call original to get structure
        all_halls = super().scrape_dining_structure()
        # Filter for PAR
        par = [h for h in all_halls if "PAR" in h['dining_hall']]
        if not par:
            print("Could not find PAR")
            return []
        
        # Just return PAR to focus debugging
        print(f"Debugging targeted hall: {par[0]['dining_hall']}")
        return par

if __name__ == "__main__":
    scraper = DebugScraper(headless=True)
    try:
        # Run for 1 day
        results = scraper.scrape_all_with_complete_data(days_to_scrape=1)
        
        # Check if we got dinner
        dinners = [r for r in results if r['meal_type'] == 'Dinner']
        print(f"\nTotal items: {len(results)}")
        print(f"Dinner items: {len(dinners)}")
        
        services_with_dinner = set(d['service'] for d in dinners)
        print(f"Services with Dinner: {services_with_dinner}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        scraper.close()
