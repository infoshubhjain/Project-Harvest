"""
Selector validation tests against the local sample_snapshot.html fixture.

These tests run without network access or Selenium by parsing the saved HTML
snapshot directly with BeautifulSoup. They catch selector regressions introduced
by code changes before the next live scrape runs.
"""
import os
from bs4 import BeautifulSoup


def load_html(path):
    """Read an HTML file and return a parsed BeautifulSoup object."""
    with open(path, 'r', encoding='utf-8') as f:
        return BeautifulSoup(f.read(), 'html.parser')


def test_snapshot_has_unit_selector():
    """The fixture must have the dining hall dropdown and at least one unit link."""
    soup = load_html(os.path.join(os.path.dirname(__file__), 'sample_snapshot.html'))
    assert soup.find(id='nav-unit-selector') is not None, \
        "#nav-unit-selector missing from fixture"
    assert soup.select('a[data-unitoid]'), \
        "No a[data-unitoid] links found in fixture"


def test_snapshot_has_date_selector():
    """The fixture must have the date picker and at least one date link."""
    soup = load_html(os.path.join(os.path.dirname(__file__), 'sample_snapshot.html'))
    assert soup.find(id='nav-date-selector') is not None, \
        "#nav-date-selector missing from fixture"
    assert soup.select('a[data-date]'), \
        "No a[data-date] links found in fixture"


def test_snapshot_has_menu_items():
    """The fixture must have the results panel and at least one menu item or food link."""
    soup = load_html(os.path.join(os.path.dirname(__file__), 'sample_snapshot.html'))
    assert soup.find(id='navBarResults') is not None, \
        "#navBarResults missing from fixture"
    assert soup.select('li.list-group-item') or soup.select('a.cbo_nn_itemHover'), \
        "No list items or food links found in fixture"
