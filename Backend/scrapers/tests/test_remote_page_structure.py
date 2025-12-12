import requests
from bs4 import BeautifulSoup


def test_remote_page_has_unit_selector():
    url = 'https://eatsmart.housing.illinois.edu/NetNutrition/1'
    r = requests.get(url, timeout=10)
    assert r.status_code == 200
    soup = BeautifulSoup(r.text, 'html.parser')
    assert soup.find(id='nav-unit-selector') or soup.select('a[data-unitoid]')


def test_remote_page_has_nav_date_selector():
    url = 'https://eatsmart.housing.illinois.edu/NetNutrition/1'
    r = requests.get(url, timeout=10)
    soup = BeautifulSoup(r.text, 'html.parser')
    assert soup.find(id='nav-date-selector') or soup.select("a[data-date]")
