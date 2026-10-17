"""Fetch explicitly selected source files, make deterministic size-only derivatives,
and build a local, offline review sheet. Requires Pillow; never synthesises imagery.

  python prepare_pack.py --download   # fill missing originals only, then prepare
  python prepare_pack.py              # rebuild and verify entirely offline
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
from html import escape
import json
from pathlib import Path
import subprocess

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent
PACK = json.loads((ROOT / 'assets.json').read_text(encoding='utf-8'))
LABELS = {
    'jupiter-map': 'Dated cloud mosaic', 'europa-map': 'Cleaned grayscale mosaic',
    'jupiter-red-spot': 'Archive colour image', 'jupiter-cloud-bands': 'Visible-colour mosaic',
    'jupiter-polar-storms': 'Infrared / false colour', 'jupiter-aurora': 'UV + optical composite',
    'jupiter-io-shadow': 'Enhanced colour', 'jupiter-rotation': 'Time sequence',
    'jupiter-io-shadow-backup': 'UV/violet false-colour sequence',
    'europa-pwyll': 'Monochrome mosaic', 'europa-conamara': 'Mixed-date / mixed-resolution mosaic',
    'europa-ridges': 'Monochrome', 'europa-tyre': 'False-colour mosaic',
    'europa-agenor': 'Monochrome', 'europa-freckles': 'Mixed-date colour composite',
}


def local(path):
    target = (ROOT / path).resolve()
    if not target.is_relative_to(ROOT):
        raise ValueError(f'Path escapes reference pack: {path}')
    return target


def download(asset):
    path = local(asset.get('original_file', asset.get('file')))
    if path.exists():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.download')
    subprocess.run(['curl', '--fail', '--location', '--silent', '--show-error',
                    '--proto', '=https', '--proto-redir', '=https',
                    '--max-time', '90', '--max-filesize', '25000000',
                    asset['download_url'], '--output', str(temporary)], check=True)
    with Image.open(temporary) as image:
        image.verify()
    temporary.replace(path)


def fingerprint(path):
    data = path.read_bytes()
    with Image.open(path) as image:
        return {'file': path.relative_to(ROOT).as_posix(), 'bytes': len(data),
                'width': image.width, 'height': image.height,
                'sha256': hashlib.sha256(data).hexdigest()}


def prepare(asset):
    source = local(asset['original_file'])
    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original).convert('RGB')
    records = [fingerprint(source)]
    if asset['role'] == 'texture':
        # NASA's Jupiter source has one extra endpoint row/column. Resample the entire
        # extent to exactly 2:1, retaining every edge; never crop away map coverage.
        width = min(2048, image.width)
        if abs(image.width / image.height - 2) > .002:
            raise ValueError(f"{asset['id']}: map is not a full-extent 2:1 candidate")
        image = image.resize((width, width // 2), Image.Resampling.LANCZOS)
        folder = 'prepared/maps'
    else:
        image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
        folder = 'prepared/photos'
    output = local(f"{folder}/{asset['id']}.jpg")
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, quality=88, optimize=True)
    records.append(fingerprint(output))
    # Preserve the entire image in review thumbnails. Future in-game badges need
    # subject-specific crops after content/interaction approval, not a blind centre crop.
    thumb = image.copy()
    thumb.thumbnail((320, 220), Image.Resampling.LANCZOS)
    output = local(f"prepared/thumbs/{asset['id']}.jpg")
    output.parent.mkdir(parents=True, exist_ok=True)
    thumb.save(output, quality=82, optimize=True)
    records.append(fingerprint(output))
    return {'id': asset['id'], 'files': records}


def review(inventory):
    by_id = {item['id']: item for item in inventory}
    html = ['<!doctype html><html lang="en"><meta charset="utf-8">',
            '<meta name="viewport" content="width=device-width, initial-scale=1">',
            '<title>Jupiter &amp; Europa — image reference pack</title>',
            '''<style>
            *{box-sizing:border-box}body{margin:0;background:#101820;color:#ecf0f3;font:16px/1.5 system-ui,sans-serif}
            header,main,footer{max-width:1280px;margin:auto;padding:28px}h1{font-size:34px;line-height:1.2;margin:8px 0 14px}
            h2{margin:40px 0 16px}h3{margin:12px 0 4px;font-size:21px}a{color:#a4d9f2}p{margin:8px 0}
            .note{padding:16px 20px;background:#213442;border-left:4px solid #edc074;border-radius:8px}
            .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr));gap:20px}
            article{background:#1c2832;border:1px solid #344653;border-radius:12px;padding:16px;overflow-wrap:anywhere}
            article img{display:block;width:100%;height:245px;object-fit:contain;background:#090e14;border-radius:6px}
            .kind{font-size:13px;color:#d8bd7b;letter-spacing:.02em}.credit{font-size:13px;color:#c5d2dc}
            details{font-size:14px;margin:12px 0}summary{cursor:pointer;color:#a4d9f2}code{font-size:12px}
            </style>''',
            '<header><div class="kind">SPACE NINJA / REFERENCE RESEARCH / 17 OCTOBER 2026</div>',
            '<h1>Jupiter &amp; Europa</h1><p>Two globe-map candidates, twelve documentary image candidates and one backup.</p>',
            '<p class="note">Supplemental unshipped references. The current content/worlds.md defines exactly three places per new world; these six-image selections do not replace it. Jupiter shows moving clouds and archive phenomena; Europa shows solid ice. No assets are installed in the game.</p>',
            '<p>All images below load locally. Open a picture for the untouched source file. '
            '<a href="README.md">Read the handover</a> · <a href="assets.json">Source manifest</a> · '
            '<a href="inventory.json">Dimensions and checksums</a></p></header><main>']
    for heading, selected in [
        ('Globe maps', [a for a in PACK['assets'] if a['role'] == 'texture']),
        ('Jupiter — storms, light and motion', [a for a in PACK['assets'] if a['body'] == 'jupiter' and a['role'] == 'discovery']),
        ('Europa — ice, impacts and ridges', [a for a in PACK['assets'] if a['body'] == 'europa' and a['role'] == 'discovery']),
        ('Backup for the moon-shadow subject', [a for a in PACK['assets'] if a['role'] == 'alternate']),
    ]:
        html.append(f'<h2>{escape(heading)}</h2><div class="grid">')
        for asset in selected:
            record = by_id[asset['id']]
            prepared = record['files'][1]
            html.append(f'<article id="{asset["id"]}"><a href="{asset["original_file"]}">'
                        f'<img src="{prepared["file"]}" alt="{escape(asset["title"])}"></a>'
                        f'<h3>{escape(asset["title"])}</h3><div class="kind">{escape(asset["archive_id"])} · {escape(LABELS[asset["id"]])}</div>'
                        f'<p>{escape(asset["caption_draft"])}</p>'
                        f'<p class="credit">{escape(asset["credit"])}</p>'
                        f'<p><a href="{asset["source_page"]}">Official source and caption</a></p>'
                        f'<details><summary>Processing, placement and reuse</summary>'
                        f'<p><b>Imaging:</b> {escape(asset["processing"])}</p>'
                        f'<p><b>Observed:</b> {escape(str(asset["observation_date"] or "Not specified by caption"))}</p>'
                        f'<p><b>Use:</b> {escape(asset["use_notes"])}</p>'
                        f'<p><b>Reuse:</b> {escape(PACK["policies"][asset["policy"]]["terms"])}</p>'
                        + ''.join(f'<p><a href="{url}">Reuse policy / licence</a></p>' for url in PACK['policies'][asset['policy']]['urls'])
                        + f'<p>Prepared: {prepared["width"]} × {prepared["height"]}; {prepared["bytes"]:,} bytes. '
                        f'<a href="{prepared["file"]}">Prepared JPEG</a></p></details></article>')
        html.append('</div>')
    html.append('</main><footer>Real spacecraft/telescope imagery only. Derivatives use resizing and JPEG recompression; no AI image generation, recolouring, inpainting or invented terrain. Credits remain attached to each image.</footer></html>')
    (ROOT / 'index.html').write_text('\n'.join(html), encoding='utf-8')

    # Static contact sheets are review artefacts; originals and prepared photos remain
    # unaltered. Full images are fitted, never cropped. Credits remain on every tile.
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 22) if Path('C:/Windows/Fonts/arial.ttf').exists() else ImageFont.load_default(size=22)
    small = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 13) if Path('C:/Windows/Fonts/arial.ttf').exists() else ImageFont.load_default(size=13)
    for body in ('jupiter', 'europa'):
        assets = [a for a in PACK['assets'] if a['body'] == body and a['role'] == 'discovery']
        canvas = Image.new('RGB', (1320, 900), '#101820')
        draw = ImageDraw.Draw(canvas)
        draw.text((24, 18), f'{body.title()} | Six image candidates | Unshipped references', fill='#ecf0f3', font=font)
        for index, asset in enumerate(assets):
            x = 20 + index % 3 * 440
            y = 66 + index // 3 * 410
            draw.rounded_rectangle((x, y, x + 420, y + 390), radius=12, fill='#1c2832')
            image = Image.open(local(f"prepared/photos/{asset['id']}.jpg"))
            image.thumbnail((396, 258), Image.Resampling.LANCZOS)
            canvas.paste(image, (x + (420 - image.width) // 2, y + 10 + (258 - image.height) // 2))
            draw.text((x + 12, y + 278), asset['title'], fill='#ecf0f3', font=font)
            draw.text((x + 12, y + 309), f"{asset['archive_id']} | {LABELS[asset['id']]}", fill='#edc074', font=small)
            # Wrap credits without truncation.
            words, line, lines = asset['credit'].split(), '', []
            for word in words:
                candidate = f'{line} {word}'.strip()
                if draw.textlength(candidate, font=small) > 392:
                    lines.append(line)
                    line = word
                else:
                    line = candidate
            lines.append(line)
            for n, line in enumerate(lines):
                draw.text((x + 12, y + 333 + n * 17), line, fill='#c5d2dc', font=small)
        canvas.save(ROOT / f'{body}-contact-sheet.jpg', quality=90, optimize=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--download', action='store_true')
    parser.add_argument('--verify', action='store_true', help='verify pinned inventory without rewriting any files')
    args = parser.parse_args()
    if args.verify:
        inventory = json.loads((ROOT / 'inventory.json').read_text(encoding='utf-8'))
        records = [f for a in inventory['assets'] for f in a['files']] + inventory['supporting_references']
        for expected in records:
            actual = fingerprint(local(expected['file']))
            if actual != expected:
                raise ValueError(f"Inventory mismatch: {expected['file']}")
        print(f'Verified {len(records)} pinned image files: dimensions, byte lengths and SHA-256.')
        raise SystemExit(0)
    if args.download:
        with ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(download, PACK['assets'] + PACK['supporting_references']))
    assets = PACK['assets']
    assert len({a['id'] for a in assets}) == len(assets) == 15
    for asset in assets:
        assert asset['credit'] and asset['source_page'] and asset['download_url']
        assert asset['policy'] in PACK['policies']
        placement = asset['placement']
        if 'longitude_west' in placement:
            assert placement['longitude_east_derived'] == (-placement['longitude_west']) % 360
    inventory = [prepare(asset) for asset in assets]
    result = {'verified_on': PACK['verified_on'], 'assets': inventory,
              'supporting_references': [fingerprint(local(r['file'])) for r in PACK['supporting_references']]}
    (ROOT / 'inventory.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    review(inventory)
    print(json.dumps({'assets': len(assets), 'files': sum(len(a['files']) for a in inventory),
                      'original_bytes': sum(a['files'][0]['bytes'] for a in inventory),
                      'prepared_bytes': sum(a['files'][1]['bytes'] for a in inventory),
                      'thumb_bytes': sum(a['files'][2]['bytes'] for a in inventory)}))
