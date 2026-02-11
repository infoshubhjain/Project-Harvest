
import os
import sys
# Add correct path to find nutrition_scraper
sys.path.append(os.path.join(os.getcwd(), 'Backend/scrapers'))

from nutrition_scraper import NutritionScraperComplete
from datetime import datetime

class FastScraper(NutritionScraperComplete):
    def scrape_dining_structure(self):
        # Call original to get structure
        all_halls = super().scrape_dining_structure()
        
        # Filter for relevant halls that user complained about
        targets = ["Pennsylvania Avenue Dining Hall (PAR)", "Lincoln Avenue Dining Hall (LAR)", "Ikenberry Dining Center (Ike)"]
        
        filtered = [h for h in all_halls if h['dining_hall'] in targets]
        
        print(f"\n[FAST MODE] Filtered to {len(filtered)} halls: {[h['dining_hall'] for h in filtered]}")
        return filtered

if __name__ == "__main__":
    # Run headless
    scraper = FastScraper(headless=True)
    try:
        # 1 Day is enough for verification
        days = 1
        print(f"Starting Fast Scraper for {days} day(s)...")
        results = scraper.scrape_all_with_complete_data(days_to_scrape=days)
        
        if results:
             print("Exporting results...")
             filename = scraper.export_to_excel(results)
             print(f"Saved to {filename}")
        else:
             print("No results found.")
             
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        scraper.close()
