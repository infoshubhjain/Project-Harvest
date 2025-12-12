#!/usr/bin/env python3
import os
import shutil
from pathlib import Path

root = Path(__file__).resolve().parents[2]
src_dir = root / 'Frontend' / 'flutter_easyeats' / 'assets' / 'images'
dst_dir = root / 'Docs' / 'images'

dst_dir.mkdir(parents=True, exist_ok=True)

print('Copying images from', src_dir, 'to', dst_dir)
for item in src_dir.glob('*'):
    if item.is_file():
        shutil.copy(item, dst_dir / item.name)
        print('Copied', item.name)

print('Done')
