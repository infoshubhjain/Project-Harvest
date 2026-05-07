"""
Remote smoke tests for eatsmart.housing.illinois.edu.

These tests perform a real HTTP GET against the live site and verify that the
CSS selectors the scraper depends on still exist in the page HTML.
They are automatically skipped if the site is unreachable (e.g. in offline CI).
"""
import requests
import pytest
from bs4 import BeautifulSoup


def fetch_remote_page_or_skip(url: str) -> requests.Response:
    """Fetch a URL and return the response, or skip the test if the site is unavailable."""
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response
    except requests.RequestException as exc:
        pytest.skip(f"Remote page unavailable: {exc}")


def test_remote_page_has_unit_selector():
    """The dining hall dropdown must expose either #nav-unit-selector or a[data-unitoid] links."""
    url = 'https://eatsmart.housing.illinois.edu/NetNutrition/1'
    r = fetch_remote_page_or_skip(url)
    soup = BeautifulSoup(r.text, 'html.parser')
    assert soup.find(id='nav-unit-selector') or soup.select('a[data-unitoid]'), \
        "Neither #nav-unit-selector nor a[data-unitoid] found — the site's HTML may have changed"


def test_remote_page_has_nav_date_selector():
    """The date picker must expose either #nav-date-selector or a[data-date] links."""
    url = 'https://eatsmart.housing.illinois.edu/NetNutrition/1'
    r = fetch_remote_page_or_skip(url)
    soup = BeautifulSoup(r.text, 'html.parser')
    assert soup.find(id='nav-date-selector') or soup.select("a[data-date]"), \
        "Neither #nav-date-selector nor a[data-date] found — the site's HTML may have changed"
