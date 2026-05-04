import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from nutrition_scraper import NutritionScraperComplete


def test_scrape_dining_structure_playback():
    test_dir = os.path.dirname(__file__)
    # fast_mode=False so fixture hall names aren't filtered against MAIN_DINING_HALLS
    scraper = NutritionScraperComplete(testing_mode=True, headless=True, playback_mode=True, fast_mode=False)
    scraper.snapshots_dir = test_dir
    halls = scraper.scrape_dining_structure()
    assert isinstance(halls, list)
    assert len(halls) > 0
    assert 'dining_hall' in halls[0]
    assert 'dining_services' in halls[0]
