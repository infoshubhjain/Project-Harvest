#!/usr/bin/env python3
"""
Validate all JSON files in Docs/api/.

Checks:
  - Each file parses as valid JSON.
  - dining-halls.json has a non-empty dining_halls list.
  - All other files have either a non-empty foods list or a non-zero count.

Exits with code 1 if any file fails so the validate-api.yml workflow can detect
the failure and trigger the automatic repair scrape.
"""
import json
import glob
import os
import sys

# Resolve Docs/api/ relative to this script's location (Backend/scripts/).
API_DIR = os.path.join(os.path.dirname(__file__), os.pardir, 'Docs', 'api')

invalid = []

print('Validating JSON files in', API_DIR)

for path in glob.glob(os.path.join(API_DIR, '*.json')):
    name = os.path.basename(path)
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, dict):
                if name == 'dining-halls.json':
                    # Must have at least one hall listed.
                    if not data.get('dining_halls'):
                        invalid.append((name, 'Empty dining_halls'))
                else:
                    # Per-hall files must have foods data (count > 0 or foods list present).
                    if not data.get('foods') and not data.get('count'):
                        invalid.append((name, 'Missing foods/count'))
            else:
                # Top-level must be a JSON object, not an array or scalar.
                invalid.append((name, 'Top-level not an object'))
    except Exception as e:
        invalid.append((name, f'Exception: {e}'))

if invalid:
    print('Invalid JSON files detected:')
    for name, reason in invalid:
        print(' -', name, '-', reason)
    sys.exit(1)

print('All JSON files valid and non-empty')
sys.exit(0)
