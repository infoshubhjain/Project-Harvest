import os
from bs4 import BeautifulSoup


def load_html(path):
    with open(path, 'r', encoding='utf-8') as f:
        return BeautifulSoup(f.read(), 'html.parser')


def test_snapshot_has_unit_selector():
    soup = load_html(os.path.join(os.path.dirname(__file__), 'sample_snapshot.html'))
    assert soup.find(id='nav-unit-selector') is not None
    assert soup.select('a[data-unitoid]')


def test_snapshot_has_date_selector():
    soup = load_html(os.path.join(os.path.dirname(__file__), 'sample_snapshot.html'))
    assert soup.find(id='nav-date-selector') is not None
    assert soup.select('a[data-date]')


def test_snapshot_has_menu_items():
    soup = load_html(os.path.join(os.path.dirname(__file__), 'sample_snapshot.html'))
    assert soup.find(id='navBarResults') is not None
    assert soup.select('li.list-group-item') or soup.select('a.cbo_nn_itemHover')
