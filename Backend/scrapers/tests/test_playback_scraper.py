"""
Playback test for scrape_dining_structure.

Loads the sample_snapshot.html fixture from this directory (without Selenium or Chrome)
and verifies that the scraper can parse at least one dining hall with services from it.
fast_mode=False is required so the filter against MAIN_DINING_HALLS doesn't drop the
fixture hall names (which may not match the production list).
"""
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from nutrition_scraper import NutritionScraperComplete


def test_scrape_dining_structure_playback():
    test_dir = os.path.dirname(__file__)
    # fast_mode=False so fixture hall names aren't filtered against MAIN_DINING_HALLS.
    scraper = NutritionScraperComplete(testing_mode=True, headless=True, playback_mode=True, fast_mode=False)
    scraper.snapshots_dir = test_dir
    halls = scraper.scrape_dining_structure()
    assert isinstance(halls, list)
    assert len(halls) > 0, "Expected at least one dining hall parsed from the snapshot"
    assert 'dining_hall' in halls[0]
    assert 'dining_services' in halls[0]
