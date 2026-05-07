from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException, WebDriverException
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time
import os

# Module-level retry decorator used on methods defined before the class (workaround for
# Python's lack of method decorators that reference self at decoration time).
def retry_on_exception(max_attempts=3, backoff=2):
    def decorator(func):
        @wraps(func)
        def wrapper(self, *args, **kwargs):
            for attempt in range(1, max_attempts + 1):
                try:
                    return func(self, *args, **kwargs)
                except Exception as e:
                    print(f"Attempt {attempt}/{max_attempts} for {func.__name__} failed: {e}")
                    if attempt == max_attempts:
                        task = {'func': func.__name__, 'args': args, 'kwargs': kwargs}
                        if hasattr(self, 'missed_tasks'):
                            self.missed_tasks.append(task)
                            print(f"Queued missed task: {func.__name__}")
                        raise
                    time.sleep(backoff * attempt)
        return wrapper
    return decorator

from functools import wraps
from bs4 import BeautifulSoup
import pandas as pd
from datetime import datetime, timedelta
import json
import re
from functools import wraps

# Only the four main dining halls are scraped in fast mode (default).
# The full list (including cafes and retail) is fetched when --full is passed.
MAIN_DINING_HALLS = [
    "Pennsylvania Avenue Dining Hall (PAR)",
    "Lincoln Avenue Dining Hall (LAR)",
    "Ikenberry Dining Center (Ike)",
    "Illinois Street Dining Center (ISR)",
]

class NutritionScraperComplete:
    def __init__(self, testing_mode=False, headless=True, playback_mode=False, fast_mode=True):
        """Initialize the scraper with Chrome options.

        Args:
            testing_mode (bool): Limits scraping to 1 hall / 1 service / 5 items for fast CI runs.
            headless (bool): Run Chrome without a UI window (required in CI).
            playback_mode (bool): Parse saved HTML snapshots instead of navigating the live site.
            fast_mode (bool): Restrict to MAIN_DINING_HALLS; set False for --full scrapes.
        """
        options = webdriver.ChromeOptions()
        if headless:
            options.add_argument('--headless=new')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        # Suppress bot-detection signals that can break the eatsmart page load.
        options.add_argument('--disable-blink-features=AutomationControlled')
        options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        options.add_argument('--disable-gpu')
        options.add_argument('--window-size=1920,1080')
        options.add_experimental_option('useAutomationExtension', False)
        options.add_experimental_option('excludeSwitches', ['enable-automation'])

        self.playback_mode = playback_mode
        if not self.playback_mode:
            try:
                # webdriver-manager downloads and caches the correct ChromeDriver version automatically.
                service = Service(ChromeDriverManager().install())
                self.driver = webdriver.Chrome(service=service, options=options)
            except WebDriverException as e:
                print("Error initializing Chrome driver:", str(e))
                print("Make sure you have a compatible Chrome/Chromium installed or set CHROME_DRIVER_PATH environment variable.")
                raise
            self.wait = WebDriverWait(self.driver, 15)
        else:
            self.driver = None
            self.wait = None

        self.base_url = "https://eatsmart.housing.illinois.edu"
        self.testing_mode = testing_mode
        self.headless = headless
        self.fast_mode = fast_mode
        # In testing mode limit items per meal so a full scrape isn't triggered.
        self.max_items_per_meal = 5 if testing_mode else None
        self.missed_tasks = []  # Holds tasks that failed all retries for a final re-run attempt.
        self.debug_dir = os.path.join(os.path.dirname(__file__), 'debug_fragments')
        os.makedirs(self.debug_dir, exist_ok=True)
        self.snapshots_dir = os.path.join(os.path.dirname(__file__), 'snapshots')
        os.makedirs(self.snapshots_dir, exist_ok=True)
        self.playback_mode = getattr(self, 'playback_mode', False)
        self.save_snapshots = False
        self._retry_attempts = 3
        self._retry_backoff = 2  # seconds

    def _retry_on_exception(self, max_attempts=None, backoff=None):
        """Instance-level retry decorator factory (alternative to the module-level one)."""
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                attempts = max_attempts or self._retry_attempts
                sleep_base = backoff or self._retry_backoff
                for attempt in range(1, attempts + 1):
                    try:
                        return func(*args, **kwargs)
                    except Exception as e:
                        print(f"Attempt {attempt}/{attempts} for {func.__name__} failed: {e}")
                        if attempt == attempts:
                            try:
                                task = {'func': func.__name__, 'args': args, 'kwargs': kwargs}
                                if hasattr(self, 'missed_tasks'):
                                    self.missed_tasks.append(task)
                                    print(f"Queued missed task: {func.__name__}")
                            except Exception:
                                pass
                            raise
                        time.sleep(sleep_base * attempt)
            return wrapper
        return decorator

    def scrape_dining_structure(self):
        """Scrape the list of dining halls and their sub-services from the site's nav dropdown.

        In playback mode, parses the first HTML snapshot in snapshots_dir instead of
        navigating the live site.
        """
        try:
            print("Loading main page to extract dining hall structure...")
            if not getattr(self, 'playback_mode', False):
                self.driver.get(self.base_url + "/NetNutrition/1")
                time.sleep(4)

            print("Extracting dining halls and services from navigation dropdown...")

            if getattr(self, 'playback_mode', False) and os.path.isdir(self.snapshots_dir):
                snapshots = [p for p in os.listdir(self.snapshots_dir) if p.endswith('.html')]
                if not snapshots:
                    print('Playback mode enabled but no snapshot files found')
                else:
                    path = os.path.join(self.snapshots_dir, snapshots[0])
                    print('Parsing playback snapshot:', path)
                    with open(path, 'r', encoding='utf-8') as f:
                        soup = BeautifulSoup(f.read(), 'html.parser')
                        anchors = soup.select('a[data-unitoid]')
                        dropdown_items = anchors
                        print(f'  → Found {len(anchors)} anchors in snapshot')

            if not getattr(self, 'playback_mode', False):
                dropdown_items = []
                try:
                    dropdown = self.wait.until(EC.presence_of_element_located((By.ID, "nav-unit-selector")))
                    dropdown_items = dropdown.find_elements(By.CSS_SELECTOR, ".dropdown-item")
                except Exception:
                    try:
                        dropdown_items = self.driver.find_elements(By.CSS_SELECTOR, "a[data-unitoid]")
                    except Exception:
                        dropdown_items = self.driver.find_elements(By.CSS_SELECTOR, "a[href*='NetNutrition']")

            dining_halls = []
            current_hall = None

            for idx, item in enumerate(dropdown_items):
                try:
                    # Support both bs4 Tags (playback) and Selenium WebElements (live scraping).
                    from bs4.element import Tag as BS4Tag
                    if isinstance(item, BS4Tag):
                        link = item
                        name = link.get('title') or link.get_text().strip()
                        unit_id = link.get('data-unitoid') or link.get('data-unitid')
                        link_class = ' '.join(link.get('class', [])) if link.get('class') else ''
                    elif hasattr(item, 'get_attribute'):
                        link = item
                        if link.tag_name.lower() != 'a':
                            try:
                                link = item.find_element(By.TAG_NAME, 'a')
                            except Exception:
                                continue
                        name = link.get_attribute('title') or link.text.strip()
                        unit_id = link.get_attribute('data-unitoid') or link.get_attribute('data-unitid')
                        link_class = (link.get_attribute('class') or '')

                    if not name or not unit_id or unit_id == '-1':
                        continue

                    # Primary items (dining hall names) have the text-primary CSS class;
                    # secondary items (sub-services like "ISR Buffet") do not.
                    is_primary = 'text-primary' in link_class or 'primary' in link_class
                    if getattr(self, 'playback_mode', False) and getattr(self, 'testing_mode', False):
                        print(f"Playback parsing: name='{name}', unit_id='{unit_id}', link_class='{link_class}', is_primary={is_primary}")

                    if is_primary:
                        if current_hall and current_hall['dining_services']:
                            dining_halls.append(current_hall)

                        current_hall = {
                            'dining_hall': name,
                            'unit_id': unit_id,
                            'dining_services': []
                        }
                    else:
                        if current_hall:
                            current_hall['dining_services'].append({
                                'service_name': name,
                                'service_id': unit_id
                            })

                except Exception as e:
                    if getattr(self, 'testing_mode', False):
                        print(f"Exception parsing dropdown item: {e} (item repr={repr(item)[:160]})")
                        import traceback
                        traceback.print_exc()
                    self._save_debug_fragment('scrape_dining_structure', str(e))
                    if getattr(self, 'save_snapshots', False):
                        self._save_snapshot(f"scrape_dining_structure_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html")
                    continue

            if current_hall and current_hall['dining_services']:
                dining_halls.append(current_hall)

            if self.fast_mode:
                # Filter to only the four main halls to avoid scraping retail / grab-and-go units.
                filtered = [h for h in dining_halls if h['dining_hall'] in MAIN_DINING_HALLS]
                print(f"\n[FAST MODE] Filtered to {len(filtered)} halls: {[h['dining_hall'] for h in filtered]}")
                return filtered

            return dining_halls

        except Exception as e:
            print(f"Error scraping dining structure: {str(e)}")
            return []

    @retry_on_exception(max_attempts=3, backoff=3)
    def navigate_to_service(self, unit_id, service_name):
        """Navigate to a specific dining service by clicking its dropdown link."""
        try:
            print(f"\nNavigating to {service_name} (ID: {unit_id})...")

            self.driver.get(f"{self.base_url}/NetNutrition/1")
            time.sleep(4)

            dropdown = self.driver.find_element(By.ID, "nav-unit-selector")
            service_link = dropdown.find_element(By.CSS_SELECTOR, f"a[data-unitoid='{unit_id}']")

            # JS click is more reliable than Selenium .click() for dropdown items.
            self.driver.execute_script("arguments[0].click();", service_link)

            # Wait for the date selector to appear rather than a fixed sleep.
            self.wait.until(EC.presence_of_element_located((By.ID, "nav-date-selector")))
            time.sleep(1)  # Small buffer to let the page settle after navigation.

            print("Service loaded")
            return True

        except Exception as e:
            print(f"Error navigating to service {service_name} ({unit_id}): {str(e)}")
            self._save_debug_fragment(f"navigate_{service_name}_{unit_id}", str(e))
            self._append_debug_log(f"navigate_to_service failed for {service_name} ({unit_id}): {e}")
            if getattr(self, 'save_snapshots', False):
                self._save_snapshot(f"navigate_{service_name}_{unit_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html")
            return False

    @retry_on_exception(max_attempts=3, backoff=2)
    def get_available_dates_for_next_n_days(self, n_days=5):
        """Read the date selector dropdown and return only dates within the next n_days window."""
        try:
            print(f"\nGetting available dates for next {n_days} days...")

            date_items = []
            try:
                date_selector = self.driver.find_element(By.ID, "nav-date-selector")
                date_items = date_selector.find_elements(By.CSS_SELECTOR, "a.dropdown-item")
            except Exception:
                try:
                    date_items = self.driver.find_elements(By.CSS_SELECTOR, "a[data-date]")
                except Exception:
                    date_items = []

            today = datetime.now().date()
            # Build a set of target dates for fast membership testing.
            target_dates = [today + timedelta(days=i) for i in range(n_days)]

            available_dates = []

            for item in date_items:
                try:
                    data_date = item.get_attribute('data-date')
                    title = item.get_attribute('title')

                    if data_date == "Today":
                        available_dates.append({
                            'element': item,
                            'data_date': data_date,
                            'date': today,
                            'date_str': today.strftime('%A, %B %d, %Y'),
                            'title': title
                        })
                        print(f"  ✓ Found: Today ({today.strftime('%m/%d/%Y')})")

                    elif data_date and data_date not in ["Show All Dates"]:
                        try:
                            # The site uses MM/DD/YYYY in the data-date attribute.
                            date_obj = datetime.strptime(data_date, '%m/%d/%Y').date()

                            if date_obj in target_dates:
                                available_dates.append({
                                    'element': item,
                                    'data_date': data_date,
                                    'date': date_obj,
                                    'date_str': title,
                                    'title': title
                                })
                                print(f"  ✓ Found: {title}")
                        except ValueError:
                            pass  # Unrecognised date format; skip silently.

                except Exception:
                    continue

            available_dates.sort(key=lambda x: x['date'])

            print(f"\nFound {len(available_dates)} dates out of {n_days} requested days")
            return available_dates

        except Exception as e:
            print(f"Error getting available dates: {str(e)}")
            import traceback
            traceback.print_exc()
            return []

    @retry_on_exception(max_attempts=3, backoff=2)
    def select_date(self, date_element):
        """Click a date item in the dropdown and wait for the results panel to refresh."""
        try:
            self.driver.execute_script("arguments[0].click();", date_element)
            self.wait.until(EC.presence_of_element_located((By.ID, "navBarResults")))
            time.sleep(1)
            return True
        except Exception as e:
            print(f"Error selecting date: {str(e)}")
            self._save_debug_fragment(f"select_date", str(e))
            self._append_debug_log(f"select_date failed: {e}")
            if getattr(self, 'save_snapshots', False):
                self._save_snapshot(f"select_date_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html")
            return False

    @retry_on_exception(max_attempts=3, backoff=2)
    def get_all_meals_structured(self):
        """Parse the navBarResults panel and return a list of {element, date, meal_type} dicts."""
        try:
            print("Extracting meal structure...")
            time.sleep(3)

            menu_items = []
            try:
                results_panel = self.wait.until(EC.presence_of_element_located((By.ID, "navBarResults")))
                self.wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, "#navBarResults li.list-group-item")))
                menu_items = results_panel.find_elements(By.CSS_SELECTOR, "li.list-group-item")
            except Exception:
                try:
                    menu_items = self.driver.find_elements(By.CSS_SELECTOR, "li[data-date], a.cbo_nn_itemHover, tr.cbo_nn_itemGroupRow")
                except Exception:
                    menu_items = []
            print(f"Found {len(menu_items)} menu items")

            structured_meals = []

            for menu_item in menu_items:
                try:
                    # textContent is more reliable than .text in headless Chrome.
                    date_meal_text = menu_item.get_attribute('textContent')

                    if not date_meal_text or not date_meal_text.strip():
                        date_meal_text = menu_item.get_attribute('innerText')

                    if not date_meal_text or not date_meal_text.strip():
                        print(f"  Warning: Could not extract text from menu item")
                        continue

                    date_meal_text = date_meal_text.strip()

                    # The site formats items as "Day, Month DD, YYYY-MealType".
                    # rsplit with maxsplit=1 safely handles hyphens in the date part.
                    if '-' in date_meal_text:
                        parts = date_meal_text.rsplit('-', 1)
                        if len(parts) == 2:
                            date_part = parts[0].strip()
                            meal_part = parts[1].strip()

                            meal_types = ['Breakfast', 'Lunch', 'Dinner', 'Brunch', 'Late Night']
                            meal_type = None
                            for meal in meal_types:
                                if meal.lower() in meal_part.lower():
                                    meal_type = meal
                                    break

                            if not meal_type:
                                meal_type = meal_part  # Use verbatim if not a known type.

                            structured_meals.append({
                                'element': menu_item,
                                'date': date_part,
                                'meal_type': meal_type,
                                'onclick': menu_item.get_attribute('onclick')
                            })
                            print(f"  Parsed: {date_part} - {meal_type}")
                    else:
                        print(f"  Warning: Could not parse date/meal from: {date_meal_text}")

                except Exception as e:
                    print(f"  Error processing menu item: {str(e)}")
                    self._save_debug_fragment('get_all_meals_structured', str(e))
                    self._append_debug_log(f"get_all_meals_structured error: {e}")
                    if getattr(self, 'save_snapshots', False):
                        self._save_snapshot(f"get_all_meals_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html")
                    continue

            print(f"\nStructured {len(structured_meals)} meal periods")
            return structured_meals

        except Exception as e:
            print(f"Error getting meal structure: {str(e)}")
            import traceback
            traceback.print_exc()
            return []

    @retry_on_exception(max_attempts=3, backoff=2)
    def click_meal(self, meal_element):
        """Click a meal list item to load its food items into the nutrition table."""
        try:
            print("Clicking meal...")

            onclick = meal_element.get_attribute('onclick')
            if onclick:
                print(f"  Using onclick: {onclick}")
                self.driver.execute_script(onclick)
            else:
                self.driver.execute_script("arguments[0].click();", meal_element)

            # Wait until either food item links or category rows appear.
            try:
                self.wait.until(lambda d:
                    len(d.find_elements(By.CSS_SELECTOR, "a.cbo_nn_itemHover")) > 0 or
                    len(d.find_elements(By.CSS_SELECTOR, "tr.cbo_nn_itemGroupRow")) > 0
                )
            except Exception:
                time.sleep(2)  # Fallback sleep if the wait condition times out.

            print("Meal loaded")
            return True
        except Exception as e:
            print(f"Error clicking meal: {str(e)}")
            self._save_debug_fragment('click_meal', str(e))
            self._append_debug_log(f"click_meal failed: {e}")
            if getattr(self, 'save_snapshots', False):
                self._save_snapshot(f"click_meal_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html")
            return False

    def extract_category_map(self):
        """Build a {category_id: category_name} dict from the visible category header rows."""
        try:
            category_map = {}
            category_rows = self.driver.find_elements(By.CSS_SELECTOR, "tr.cbo_nn_itemGroupRow")

            for row in category_rows:
                try:
                    category_name = ""
                    try:
                        category_div = row.find_element(By.CSS_SELECTOR, "div[role='button']")
                        innerHTML = category_div.get_attribute('innerHTML')
                        if innerHTML:
                            # Strip the expand/collapse icon tag; keep only text.
                            from bs4 import BeautifulSoup
                            soup = BeautifulSoup(innerHTML, 'html.parser')
                            category_name = soup.get_text().strip().split('\n')[0].strip()
                    except Exception:
                        category_name = row.text.strip()

                    # The category ID lives on the next sibling <tr>, not the header row itself.
                    next_row = self.driver.execute_script(
                        "return arguments[0].nextElementSibling;", row
                    )
                    if next_row:
                        cat_id = next_row.get_attribute('data-categoryid')
                        if cat_id and category_name:
                            category_map[cat_id] = category_name
                            print(f"     Found category: ID {cat_id} = '{category_name}'")

                except Exception:
                    continue

            return category_map

        except Exception as e:
            print(f"     Error extracting categories: {str(e)}")
            return {}

    @retry_on_exception(max_attempts=3, backoff=2)
    def extract_nutrition_info(self, max_items=None):
        """
        Click each food item link to open its nutrition modal, parse the data, then close.
        Returns a list of nutrition dicts with 'name', 'serving_size', 'nutrition', 'category'.
        """
        try:
            print("Extracting nutrition information...")

            print("  Extracting categories...")
            category_map = self.extract_category_map()

            items_data = []
            items = self.driver.find_elements(By.CSS_SELECTOR, "a.cbo_nn_itemHover")
            print(f"Found {len(items)} clickable items")

            if len(items) == 0:
                print("No clickable items found!")
                return items_data

            items_to_process = items[:max_items] if max_items else items
            print(f"Processing {'first ' + str(len(items_to_process)) + ' items (testing mode)' if max_items else 'all ' + str(len(items_to_process)) + ' items'}\n")

            for i, item in enumerate(items_to_process, 1):
                try:
                    # Extract food name from the link text; fall back to innerHTML parsing.
                    food_name = ""
                    try:
                        food_name = item.text.strip()
                    except Exception:
                        pass

                    if not food_name:
                        try:
                            inner_html = item.get_attribute('innerHTML')
                            soup = BeautifulSoup(inner_html, 'html.parser')
                            food_name = soup.get_text().strip()
                        except Exception:
                            pass

                    # Walk up the DOM to the parent <tr> to get its data-categoryid attribute.
                    category = "Unknown"
                    try:
                        tr_element = self.driver.execute_script("return arguments[0].closest('tr');", item)
                        cat_id = tr_element.get_attribute('data-categoryid')
                        if cat_id and cat_id in category_map:
                            category = category_map[cat_id]
                    except Exception:
                        pass

                    print(f"  {i}. {food_name} [{category}]")

                    if not food_name:
                        continue

                    print(f"     → Clicking...")
                    try:
                        self.driver.execute_script("arguments[0].scrollIntoView(true);", item)
                        self.driver.execute_script("arguments[0].click();", item)
                    except Exception:
                        item.click()

                    # Wait for the nutrition modal to appear; short sleep ensures text renders fully.
                    try:
                        self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "div[class*='modal'][class*='show'], div[role='dialog']")))
                        time.sleep(0.5)
                    except Exception:
                        time.sleep(1)

                    nutrition_info = self.extract_nutrition_from_modal(food_name)
                    nutrition_info['category'] = category
                    items_data.append(nutrition_info)

                    if nutrition_info.get('nutrition'):
                        print(f"     ✓ Extracted {len(nutrition_info['nutrition'])} nutrition fields")
                    else:
                        print(f"     ✗ No nutrition data found")

                    self.close_modal()

                except Exception as e:
                    print(f"    ERROR extracting item: {str(e)}")
                    self._save_debug_fragment(f"extract_item_{i}", str(e))
                    self._append_debug_log(f"extract_item_{i} failed: {e}")
                    if getattr(self, 'save_snapshots', False):
                        self._save_snapshot(f"extract_item_{i}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html")
                    continue

            print(f"\n✓ Extracted nutrition info for {len(items_data)} items")
            return items_data

        except Exception as e:
            print(f"Error: {str(e)}")
            return []

    def close_modal(self):
        """Close any open nutrition modal by trying several common button selectors, then Escape."""
        try:
            close_selectors = [
                "button[class*='close']",
                "button[aria-label*='close']",
                ".modal button.close",
                "button[data-dismiss='modal']"
            ]

            for selector in close_selectors:
                try:
                    close_button = self.driver.find_element(By.CSS_SELECTOR, selector)
                    self.driver.execute_script("arguments[0].click();", close_button)
                    return
                except Exception:
                    pass

            # Last resort: dispatch a keyboard Escape event.
            try:
                self.driver.execute_script("document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}))")
            except Exception:
                pass

        except Exception as e:
            print(f"     Error closing modal: {str(e)}")
            self._save_debug_fragment('close_modal', str(e))

    def extract_nutrition_from_modal(self, food_name):
        """Parse the nutrition facts modal text into a structured dict."""
        nutrition_info = {
            'name': food_name,
            'serving_size': None,
            'nutrition': {}
        }

        try:
            modal_body = None
            modal_selectors = [
                "div[class*='modal'][class*='show']",
                "div[role='dialog']",
                "div[class*='popup']"
            ]

            for selector in modal_selectors:
                try:
                    modal_body = self.driver.find_element(By.CSS_SELECTOR, selector)
                    break
                except Exception:
                    pass

            if not modal_body:
                modal_body = self.driver.find_element(By.TAG_NAME, "body")

            modal_text = modal_body.text

            # If the modal didn't load or is empty, return an empty result.
            if not modal_text or len(modal_text) < 20:
                return nutrition_info

            lines = modal_text.split('\n')

            # Map internal field names to the plain-text keywords that appear in the modal.
            nutrition_keywords = {
                'calories':           ['calories'],
                'total_fat':          ['total fat'],
                'saturated_fat':      ['saturated fat'],
                'trans_fat':          ['trans fat'],
                'cholesterol':        ['cholesterol'],
                'sodium':             ['sodium'],
                'potassium':          ['potassium'],
                'total_carbohydrate': ['total carbohydrate', 'carbohydrate'],
                'dietary_fiber':      ['dietary fiber'],
                'sugars':             ['sugars'],
                'protein':            ['protein']
            }

            for line in lines:
                line_lower = line.lower().strip()

                if 'serving size' in line_lower:
                    nutrition_info['serving_size'] = line.split(':', 1)[-1].strip() if ':' in line else line

                for key, keywords in nutrition_keywords.items():
                    for keyword in keywords:
                        if keyword in line_lower and key not in nutrition_info['nutrition']:
                            value = self.extract_nutrition_value(line, keyword)
                            if value:
                                nutrition_info['nutrition'][key] = value
                            break

        except Exception as e:
            print(f"       ERROR extracting nutrition: {str(e)}")
            self._save_debug_fragment(f"extract_nutrition_{food_name}", str(e))

        return nutrition_info

    def normalize_date(self, date_str):
        """Convert any date string the site produces to YYYY-MM-DD for consistent DB storage.

        Handles:
        - "Monday, May 04, 2026"  -> "2026-05-04"
        - "Today, May 04, 2026"   -> "2026-05-04"
        - Already-normalised "2026-05-04" passthrough
        """
        if not date_str:
            return date_str
        # Already in ISO format — pass through unchanged.
        if re.match(r'^\d{4}-\d{2}-\d{2}$', date_str.strip()):
            return date_str.strip()
        # Strip the leading weekday / "Today" token before the first comma+space.
        cleaned = re.sub(r'^[^,]+,\s*', '', date_str.strip())
        for fmt in ('%B %d, %Y', '%b %d, %Y', '%m/%d/%Y'):
            try:
                return datetime.strptime(cleaned, fmt).strftime('%Y-%m-%d')
            except ValueError:
                continue
        return date_str  # Fallback: return original so nothing is silently discarded.

    def parse_nutrition_value(self, value_str):
        """Parse a nutrition value string and return a standardised gram-based string.

        Handles:
        - mg → g conversion  (500mg → "0.5")
        - Unit stripping       ("2.5g" → "2.5")
        - N/A / empty          → "0"
        - Trailing zero removal ("2.500" → "2.5")
        """
        if not value_str or value_str.strip() == "":
            return "0"

        value_str = str(value_str).strip().upper()

        if value_str in ["N/A", "NA", "NONE", "-", ""]:
            return "0"

        try:
            match = re.match(r'^\s*([0-9.]+)\s*(MG|G|GRAMS?|MILLIGRAMS?)?\s*$', value_str, re.IGNORECASE)

            if match:
                numeric_value = float(match.group(1))
                unit = match.group(2)

                if unit and unit.upper() in ['MG', 'MILLIGRAM', 'MILLIGRAMS']:
                    numeric_value = numeric_value / 1000.0

                if numeric_value == 0:
                    return "0"

                if numeric_value == int(numeric_value):
                    return str(int(numeric_value))
                else:
                    return f"{numeric_value:.3f}".rstrip('0').rstrip('.')
            else:
                # No unit recognised; extract the first number sequence found.
                numbers = re.findall(r'[0-9.]+', value_str)
                if numbers:
                    numeric_value = float(numbers[0])
                    if numeric_value == 0:
                        return "0"
                    if numeric_value == int(numeric_value):
                        return str(int(numeric_value))
                    else:
                        return f"{numeric_value:.3f}".rstrip('0').rstrip('.')
                return "0"
        except Exception:
            return "0"

    def _save_debug_fragment(self, name, reason=None):
        """Save the current page HTML to debug_fragments/ for post-hoc selector debugging."""
        try:
            ts = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"{ts}_{name}.html"
            path = os.path.join(self.debug_dir, filename)
            content = self.driver.page_source if (hasattr(self, 'driver') and self.driver is not None) else '<no driver>'
            with open(path, 'w', encoding='utf-8') as f:
                f.write("<!-- Reason: %s -->\n" % (reason or ''))
                f.write(content)
            print(f"Saved debug fragment: {path}")
            try:
                self._append_debug_log(f"Saved debug fragment: {path}")
            except Exception:
                pass
        except Exception as e:
            print(f"Failed to save debug fragment: {e}")

    def _append_debug_log(self, message):
        """Append a timestamped message to debug_fragments/debug.log."""
        try:
            logpath = os.path.join(self.debug_dir, 'debug.log')
            with open(logpath, 'a', encoding='utf-8') as f:
                f.write(f"{datetime.now().isoformat()} - {message}\n")
        except Exception as e:
            print(f"Failed to append debug log: {e}")

    def _save_snapshot(self, filename=None):
        """Save the full current page source to snapshots/ (only when save_snapshots is True)."""
        try:
            if not getattr(self, 'save_snapshots', False):
                return None
            if not filename:
                filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
            path = os.path.join(self.snapshots_dir, filename)
            with open(path, 'w', encoding='utf-8') as f:
                f.write(self.driver.page_source if (hasattr(self, 'driver') and self.driver is not None) else '')
            print(f"Saved snapshot: {path}")
            return path
        except Exception as e:
            print(f"Failed to save snapshot: {e}")
            return None

    def extract_nutrition_value(self, line, keyword):
        """Pull the numeric value that follows a keyword on a modal text line."""
        try:
            keyword_pos = line.lower().find(keyword)
            if keyword_pos == -1:
                return "0"

            after_keyword = line[keyword_pos + len(keyword):].strip()

            value = ""
            for char in after_keyword:
                if char.isspace() and value:
                    break
                if char == '%':
                    break
                value += char

            value = value.strip()
            return self.parse_nutrition_value(value) if value else "0"

        except Exception:
            return "0"

    def scrape_all_with_complete_data(self, days_to_scrape=5):
        """Orchestrate the full scrape: all halls → all services → n days → all meals.

        Strategy: for each (service, date, meal) triple, navigate to a clean state
        before scraping. This is slower but avoids stale-element errors from
        re-using DOM references across navigations.

        Args:
            days_to_scrape: Number of days to include (today + the next n-1 days).
        """
        all_results = []

        print("="*80)
        print(f"Illinois Dining Complete Scraper - {days_to_scrape} Days")
        print("="*80)

        dining_halls = self.scrape_dining_structure()

        if not dining_halls:
            print("Failed to get dining structure")
            return all_results

        if self.testing_mode:
            print("\n[TESTING MODE] Limiting to first dining hall, first service, and first 5 days")
            dining_halls = dining_halls[:1]
            if dining_halls and dining_halls[0]['dining_services']:
                dining_halls[0]['dining_services'] = dining_halls[0]['dining_services'][:1]
            days_to_scrape = min(days_to_scrape, 5)

        for hall in dining_halls:
            hall_name = hall['dining_hall']

            print(f"\n{'='*80}")
            print(f"Processing: {hall_name}")
            print(f"{'='*80}")

            if not hall['dining_services']:
                continue

            for service in hall['dining_services']:
                service_name = service['service_name']
                service_id   = service['service_id']

                if not self.navigate_to_service(service_id, service_name):
                    continue

                available_dates = self.get_available_dates_for_next_n_days(days_to_scrape)

                if not available_dates:
                    print(f"No dates available for scraping")
                    continue

                # Store (data_date, date_str) tuples; elements become stale after navigation.
                target_dates = [(d['data_date'], d['date_str']) for d in available_dates]

                print(f"\n{'='*80}")
                print(f"Scraping {len(target_dates)} days for {service_name}")
                print(f"{'='*80}")

                for date_idx, (data_date, date_str) in enumerate(target_dates, 1):
                    print(f"\n{'='*60}")
                    print(f"Date {date_idx}/{len(target_dates)}: {date_str}")
                    print(f"{'='*60}")

                    # Pass 1: navigate and get the meal list for this date so we know
                    # what to scrape. We don't keep the element references.
                    if not self.navigate_to_service(service_id, service_name):
                        continue

                    try:
                        self.wait.until(EC.presence_of_element_located((By.ID, "nav-date-selector")))
                        # JS click is more reliable than find+click for dropdown items.
                        date_script = f"""
                        var items = document.querySelectorAll('a.dropdown-item[data-date="{data_date}"]');
                        if (items.length > 0) {{
                            items[0].click();
                            return true;
                        }}
                        return false;
                        """
                        found_date = self.driver.execute_script(date_script)

                        if not found_date:
                            print(f"Could not find/select date: {date_str}")
                            continue

                        self.wait.until(EC.presence_of_element_located((By.ID, "navBarResults")))
                        time.sleep(1)

                        structured_meals_metadata = self.get_all_meals_structured()

                        if not structured_meals_metadata:
                            print(f"No meals found for {date_str}")
                            continue

                        # Deduplicate meal entries: some "build your own" stations repeat
                        # the same (date, meal_type) multiple times in the panel.
                        meal_definitions = []
                        seen_meals = set()
                        for idx, m in enumerate(structured_meals_metadata):
                            meal_key = (m.get('date', ''), m.get('meal_type', ''))
                            if meal_key in seen_meals:
                                continue
                            seen_meals.add(meal_key)
                            meal_definitions.append({
                                'index': idx,
                                'type': m['meal_type'],
                                'date_text': m['date']
                            })

                    except Exception as e:
                        print(f"Error preparing meal list for {date_str}: {e}")
                        continue

                    if self.testing_mode:
                        print(f"[TESTING MODE] Limiting to first meal period only")
                        meal_definitions = meal_definitions[:1]

                    # Pass 2: for each meal, start from a clean state to avoid stale elements.
                    for meal_def in meal_definitions:
                        meal_idx  = meal_def['index']
                        meal_name = meal_def['type']

                        print(f"\n[Meal {meal_idx + 1}/{len(meal_definitions)}]")
                        print(f"Date: {date_str}, Meal: {meal_name}")

                        # Reset to service root before every meal to ensure fresh DOM.
                        if not self.navigate_to_service(service_id, service_name):
                            print(f"Failed to navigate to service for {meal_name}")
                            break

                        try:
                            found_date = self.driver.execute_script(date_script)
                            if not found_date:
                                print(f"Could not re-select date for {meal_name}")
                                continue

                            self.wait.until(EC.presence_of_element_located((By.ID, "navBarResults")))
                            time.sleep(1)

                        except Exception as e:
                            print(f"Error selecting date for {meal_name}: {e}")
                            continue

                        # Fetch fresh element references for this navigation.
                        current_meals = self.get_all_meals_structured()

                        if meal_idx >= len(current_meals):
                            print(f"Meal index {meal_idx} out of range (found {len(current_meals)} meals)")
                            continue

                        target_meal_info = current_meals[meal_idx]

                        # Sanity check: warn if the meal type shifted (can happen if the
                        # site re-orders the panel), but proceed anyway — index is usually stable.
                        if target_meal_info['meal_type'] != meal_name:
                            print(f"Warning: Meal type mismatch. Expected {meal_name}, found {target_meal_info['meal_type']}")

                        if not target_meal_info['element']:
                            print("No element for meal")
                            continue

                        if not self.click_meal(target_meal_info['element']):
                            print(f"Failed to click {meal_name}")
                            continue

                        nutrition_items = self.extract_nutrition_info(max_items=self.max_items_per_meal)

                        for item_data in nutrition_items:
                            result = {
                                'dining_hall':        hall_name,
                                'service':            service_name,
                                'date':               self.normalize_date(target_meal_info['date']),
                                'meal_type':          target_meal_info['meal_type'],
                                'category':           item_data.get('category', 'Unknown'),
                                'name':               item_data['name'],
                                'serving_size':       item_data.get('serving_size'),
                                'calories':           self.parse_nutrition_value(item_data.get('nutrition', {}).get('calories', '0')),
                                'total_fat':          self.parse_nutrition_value(item_data.get('nutrition', {}).get('total_fat', '0')),
                                'saturated_fat':      self.parse_nutrition_value(item_data.get('nutrition', {}).get('saturated_fat', '0')),
                                'trans_fat':          self.parse_nutrition_value(item_data.get('nutrition', {}).get('trans_fat', '0')),
                                'cholesterol':        self.parse_nutrition_value(item_data.get('nutrition', {}).get('cholesterol', '0')),
                                'sodium':             self.parse_nutrition_value(item_data.get('nutrition', {}).get('sodium', '0')),
                                'potassium':          self.parse_nutrition_value(item_data.get('nutrition', {}).get('potassium', '0')),
                                'total_carbohydrate': self.parse_nutrition_value(item_data.get('nutrition', {}).get('total_carbohydrate', '0')),
                                'dietary_fiber':      self.parse_nutrition_value(item_data.get('nutrition', {}).get('dietary_fiber', '0')),
                                'sugars':             self.parse_nutrition_value(item_data.get('nutrition', {}).get('sugars', '0')),
                                'protein':            self.parse_nutrition_value(item_data.get('nutrition', {}).get('protein', '0'))
                            }
                            all_results.append(result)

                        print(f"Stored nutrition for {len(nutrition_items)} items")

        print(f"\n{'='*80}")
        print("Complete scraping finished!")
        print(f"{'='*80}")
        print(f"Total items scraped: {len(all_results)}")

        # Attempt to re-run any tasks that exhausted all retries during the main loop.
        if self.missed_tasks:
            print(f"Found {len(self.missed_tasks)} missed tasks. Attempting re-tries...")
            tasks_copy = list(self.missed_tasks)
            self.missed_tasks = []
            for task in tasks_copy:
                try:
                    func_name = task.get('func')
                    args = task.get('args', ())
                    kwargs = task.get('kwargs', {})
                    print(f"Re-running missed task: {func_name}")
                    method = getattr(self, func_name, None)
                    if method:
                        result = method(*args, **kwargs)
                        print(f"  Result: {result}")
                except Exception as e:
                    print(f"Re-run of missed task {func_name} failed: {e}")
            print("Finished missed tasks re-run")

        return all_results

    def export_to_excel(self, all_results, filename=None):
        """Export scraped results to a formatted Excel file.

        The file is then consumed by load_to_db.py to update the SQLite database.
        """
        if not all_results:
            print("No data to export")
            return None

        try:
            if not filename:
                filename = f"complete_dining_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"

            df = pd.DataFrame(all_results)

            df = df.sort_values(['dining_hall', 'service', 'date', 'meal_type', 'name'],
                                ascending=[True, True, True, True, True])

            # Enforce a fixed column order; skip any that are absent from this particular scrape.
            column_order = [
                'dining_hall', 'service', 'date', 'meal_type', 'category', 'name', 'serving_size',
                'calories', 'total_fat', 'saturated_fat', 'trans_fat', 'cholesterol',
                'sodium', 'potassium', 'total_carbohydrate', 'dietary_fiber', 'sugars', 'protein'
            ]
            column_order = [c for c in column_order if c in df.columns]
            df = df[column_order]

            with pd.ExcelWriter(filename, engine='openpyxl') as writer:
                df.to_excel(writer, sheet_name='Complete Data', index=False)

                workbook  = writer.book
                worksheet = writer.sheets['Complete Data']

                # Auto-size columns based on content, capped at 50 chars wide.
                for column in worksheet.columns:
                    max_length = 0
                    column_letter = column[0].column_letter
                    for cell in column:
                        try:
                            if len(str(cell.value)) > max_length:
                                max_length = len(str(cell.value))
                        except Exception:
                            pass
                    worksheet.column_dimensions[column_letter].width = min(max_length + 2, 50)

                # Style the header row for readability.
                from openpyxl.styles import Font, PatternFill, Alignment
                header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
                header_font = Font(bold=True, color="FFFFFF")

                for cell in worksheet[1]:
                    cell.fill      = header_fill
                    cell.font      = header_font
                    cell.alignment = Alignment(horizontal="center", vertical="center")

            print(f"Exported to {filename}")
            print(f"Total rows: {len(df)}")

            print("\nData Summary:")
            print(f"  Unique dining halls: {df['dining_hall'].nunique()}")
            if 'date' in df.columns:
                print(f"  Unique dates: {df['date'].nunique()}")
            if 'meal_type' in df.columns:
                print(f"  Unique meal types: {df['meal_type'].nunique()}")
            if 'category' in df.columns:
                print(f"  Unique categories: {df['category'].nunique()}")

            return filename

        except Exception as e:
            print(f"Error exporting to Excel: {str(e)}")
            import traceback
            traceback.print_exc()
            return None

    def close(self):
        """Quit the Chrome browser and release the WebDriver process."""
        self.driver.quit()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='UIUC Dining Nutrition Scraper')
    parser.add_argument('--testing',      action='store_true',  help='Enable testing mode (limits items/days)')
    parser.add_argument('--headless',     action='store_true',  help='Run Chrome in headless mode (default)')
    parser.add_argument('--no-headless',  dest='headless', action='store_false', help='Run Chrome with UI (for debugging)')
    parser.add_argument('--save-snapshots', action='store_true', help='Save page snapshots for debugging when selectors fail')
    parser.add_argument('--playback',     type=str, help='Playback mode: directory of HTML snapshots to use instead of live scraping')
    parser.add_argument('--days',         type=int, default=5, help='Number of days to scrape (default: 5, including today)')
    parser.add_argument('--full',         action='store_true', help='Full scrape (all dining halls/services, not just main four)')
    parser.set_defaults(headless=True)
    args = parser.parse_args()

    TESTING_MODE  = args.testing
    HEADLESS_MODE = args.headless
    SAVE_SNAPSHOTS = args.save_snapshots
    PLAYBACK_DIR  = args.playback
    # fast_mode=True restricts to MAIN_DINING_HALLS; --full disables this filter.
    FAST_MODE     = not args.full
    DAYS_TO_SCRAPE = args.days

    scraper = NutritionScraperComplete(testing_mode=TESTING_MODE, headless=HEADLESS_MODE, fast_mode=FAST_MODE)
    if SAVE_SNAPSHOTS:
        scraper.save_snapshots = True
    if PLAYBACK_DIR:
        scraper.playback_mode = True
        scraper.snapshots_dir = PLAYBACK_DIR

    try:
        print("\n" + "="*80)
        if TESTING_MODE:
            print("RUNNING IN TESTING MODE")
            print("- Will scrape only 5 items per meal")
            print("- Consider limiting dining halls and meals for faster testing")
        else:
            mode_label = "FAST SCRAPE (main halls only)" if FAST_MODE else "FULL SCRAPE (all halls)"
            print(f"{mode_label} - {DAYS_TO_SCRAPE} Days")
            if FAST_MODE:
                print("- Will scrape only main dining halls")
            else:
                print("- Will scrape all dining halls and services")
            print("- Will scrape all menu items")
            print(f"- Will scrape menus for the next {DAYS_TO_SCRAPE} days (including today)")
        print("="*80 + "\n")

        all_results = scraper.scrape_all_with_complete_data(days_to_scrape=DAYS_TO_SCRAPE)

        if all_results:
            print(f"\n{'='*80}")
            print("Final Results Summary")
            print(f"{'='*80}")

            unique_halls      = set(r['dining_hall'] for r in all_results)
            unique_dates      = set(r['date'] for r in all_results if r.get('date'))
            unique_meals      = set(r['meal_type'] for r in all_results if r.get('meal_type'))
            unique_categories = set(r['category'] for r in all_results if r.get('category'))

            print(f"Total items: {len(all_results)}")
            print(f"Dining halls: {len(unique_halls)}")
            print(f"Dates covered: {', '.join(sorted(unique_dates))}")
            print(f"Meal types: {', '.join(sorted(unique_meals))}")
            print(f"Categories: {len(unique_categories)}")

            print(f"\nExporting complete data...")
            excel_file = scraper.export_to_excel(all_results)

            if excel_file:
                print(f"\n✓ Success! Excel file: {excel_file}")

            print(f"\nSample items:")
            for r in all_results[:5]:
                print(f"  • {r['name']} [{r['category']}] ({r['meal_type']}) - {r['calories']} cal")

        else:
            print("No data scraped")

    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
    except Exception as e:
        print(f"\nError: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        scraper.close()
        print("Browser closed.")
