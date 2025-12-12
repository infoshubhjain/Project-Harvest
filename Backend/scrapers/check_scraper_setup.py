#!/usr/bin/env python3
"""A quick check helper: initialize ChromeDriver via webdriver-manager and verify the page has expected elements.
Usage: python3 check_scraper_setup.py [--no-headless]
"""
import argparse
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.common.exceptions import WebDriverException
from webdriver_manager.chrome import ChromeDriverManager


def main(headless=True):
    options = webdriver.ChromeOptions()
    if headless:
        options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    try:
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        driver.get('https://eatsmart.housing.illinois.edu/NetNutrition/1')
        print('Page title:', driver.title)
        try:
            unit = driver.find_element(By.ID, 'nav-unit-selector')
            print('Found nav-unit-selector with', len(unit.find_elements(By.CSS_SELECTOR, '.dropdown-item')), 'items')
        except Exception:
            print('Could not find nav-unit-selector; falling back to a[data-unitoid] lookup')
            try:
                alt = driver.find_elements(By.CSS_SELECTOR, 'a[data-unitoid]')
                print('Found', len(alt), 'a[data-unitoid] links')
            except Exception:
                print('Could not find a[data-unitoid] either')
        driver.quit()
        return 0
    except WebDriverException as e:
        print('WebDriver initialization error:', e)
        print('Please ensure Chrome/Chromium is installed or use webdriver-manager to download driver automatically')
        return 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--no-headless', dest='headless', action='store_false', help='Disable headless mode')
    parser.set_defaults(headless=True)
    args = parser.parse_args()
    exit(main(headless=args.headless))
