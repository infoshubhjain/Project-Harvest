import requests
import pytest
from bs4 import BeautifulSoup


def fetch_remote_page_or_skip(url: str) -> requests.Response:
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response
    except requests.RequestException as exc:
        pytest.skip(f"Remote page unavailable: {exc}")


def test_remote_page_has_unit_selector():
    url = 'https://eatsmart.housing.illinois.edu/NetNutrition/1'
    r = fetch_remote_page_or_skip(url)
    soup = BeautifulSoup(r.text, 'html.parser')
    assert soup.find(id='nav-unit-selector') or soup.select('a[data-unitoid]')


def test_remote_page_has_nav_date_selector():
    url = 'https://eatsmart.housing.illinois.edu/NetNutrition/1'
    r = fetch_remote_page_or_skip(url)
    soup = BeautifulSoup(r.text, 'html.parser')
    assert soup.find(id='nav-date-selector') or soup.select("a[data-date]")
