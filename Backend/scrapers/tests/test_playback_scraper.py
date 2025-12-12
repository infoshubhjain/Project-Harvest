import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from nutrition_scraper import NutritionScraperComplete


def test_scrape_dining_structure_playback():
    test_dir = os.path.dirname(__file__)
    scraper = NutritionScraperComplete(testing_mode=True, headless=True, playback_mode=True)
    scraper.snapshots_dir = test_dir
    halls = scraper.scrape_dining_structure()
    assert isinstance(halls, list)
    assert len(halls) > 0
    assert 'dining_hall' in halls[0]
    assert 'dining_services' in halls[0]
