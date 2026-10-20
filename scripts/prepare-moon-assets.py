"""Prepare compact NASA Moon assets; source originals remain in the OS temp cache.
Requires Pillow. No synthetic documentary imagery.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image
import hashlib
import json
import tempfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/moon-trial'
CACHE = Path(tempfile.gettempdir()) / 'spaceninja-moon-sources'
OUT.mkdir(parents=True, exist_ok=True)
CACHE.mkdir(exist_ok=True)
SOURCES = {
    'color.tif': 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_8k.tif',
    'height.tif': 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_16_uint.tif',
    'tycho.tif': 'https://svs.gsfc.nasa.gov/vis/a000000/a004200/a004220/tycho_central_peak_wide_16x9.tif',
}

def download(item):
    name, url = item
    path = CACHE / name
    if not path.exists():
        partial = path.with_suffix('.part')
        urllib.request.urlretrieve(url, partial)
        partial.replace(path)

with ThreadPoolExecutor(max_workers=3) as pool:
    list(pool.map(download, SOURCES.items()))

color = Image.open(CACHE / 'color.tif').convert('RGB')
color.resize((4096, 2048), Image.Resampling.LANCZOS).save(OUT / 'moon-color.jpg', quality=90, optimize=True)
height = Image.open(CACHE / 'height.tif')
height.point(lambda p: p * 255 / 40000).convert('L').resize((2048, 1024), Image.Resampling.BILINEAR).save(OUT / 'moon-relief.png')
Image.open(CACHE / 'tycho.tif').convert('RGB').resize((2560, 1440), Image.Resampling.LANCZOS).save(OUT / 'tycho-mountains.jpg', quality=91, optimize=True)
manifest = {name: {'url': url, 'sha256': hashlib.sha256((CACHE / name).read_bytes()).hexdigest()} for name, url in SOURCES.items()}
(OUT / 'sources.json').write_text(json.dumps(manifest, indent=2))
print('Prepared Moon map, relief and Tycho photograph.')
