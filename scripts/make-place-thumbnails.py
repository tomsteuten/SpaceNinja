"""Square thumbnails of the real place photographs, for the explorer's place badges and journal.

Each thumbnail is a centre crop of the same photograph the place's postcard opens, so its
provenance is that photograph's (see public/assets/discoveries/README.txt and
public/assets/moon-trial/README.txt). Nothing is drawn or invented. Requires Pillow.
Re-run after replacing or adding a place photograph.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / 'public/assets/discoveries'
OUT = PHOTOS / 'thumbs'
SIZE = 160
# Places whose postcard opens a photograph kept outside the discoveries folder.
OVERRIDES = {'moon-tycho': ROOT / 'public/assets/moon-trial/tycho-mountains.jpg'}

OUT.mkdir(exist_ok=True)
for photo in sorted(PHOTOS.glob('*.jpg')):
    source = OVERRIDES.get(photo.stem, photo)
    image = Image.open(source).convert('RGB')
    side = min(image.size)
    left, top = (image.width - side) // 2, (image.height - side) // 2
    image = image.crop((left, top, left + side, top + side)).resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    image.save(OUT / photo.name, quality=82, optimize=True)
    print(photo.stem, (OUT / photo.name).stat().st_size)
