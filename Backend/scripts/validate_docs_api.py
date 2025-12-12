#!/usr/bin/env python3
import json
import glob
import os
import sys

# Validates JSON files in Docs/api
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
                    if not data.get('dining_halls'):
                        invalid.append((name, 'Empty dining_halls'))
                else:
                    if not data.get('foods') and not data.get('count'):
                        invalid.append((name, 'Missing foods/count'))
            else:
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
