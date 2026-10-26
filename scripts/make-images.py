#!/usr/bin/env python3
"""Generate all app pictures with the Gemini API (no extra packages needed; Pillow optional for webp).

Setup (once):   export GEMINI_API_KEY="your key"        (Windows PowerShell: $env:GEMINI_API_KEY="your key")
Test 3 images:  python3 scripts/make-images.py --limit 3
Everything:     python3 scripts/make-images.py
Only one part:  python3 scripts/make-images.py --only deities       (abcd, akshar-gu, akshar-hi, numbers, deities, avatars, icons)
Safe to stop and run again: pictures that already exist are skipped.
"""
import os, sys, json, time, base64, argparse, io, urllib.request, urllib.error
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument('--only'); ap.add_argument('--limit', type=int, default=0)
ap.add_argument('--model', default=os.environ.get('GEMINI_IMAGE_MODEL', 'gemini-2.5-flash-image'))
ap.add_argument('--pause', type=float, default=2.0, help='seconds between calls')
a = ap.parse_args()
KEY = os.environ.get('GEMINI_API_KEY')
if not KEY: sys.exit('GEMINI_API_KEY set nathi. Pehla: export GEMINI_API_KEY="..."')
try:
    from PIL import Image
except ImportError:
    Image = None; print('Pillow nathi: PNG bytes webp naam sathe nahi, .png tarike save thase. (pip install pillow thi webp banshe)')

items = json.load(open(os.path.join(ROOT, 'art/images.json')))
ic = os.path.join(ROOT, 'art/icons.json')
if os.path.exists(ic): items += json.load(open(ic))
if a.only: items = [i for i in items if i['s'] == a.only]

def target(f):
    if f.endswith('.webp') and Image is None: return f[:-5] + '.png'
    return f

def call(prompt, ref=None, ratio='16:9'):
    parts = [{'text': prompt}]
    if ref:
        parts.insert(0, {'inline_data': {'mime_type': 'image/png', 'data': base64.b64encode(ref).decode()}})
        parts[1]['text'] = 'Use the first image as the character/style reference and keep the characters looking identical. ' + prompt
    body = {'contents': [{'parts': parts}],
            'generationConfig': {'responseModalities': ['IMAGE'], 'imageConfig': {'aspectRatio': ratio}}}
    req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{a.model}:generateContent',
        data=json.dumps(body).encode(), headers={'x-goog-api-key': KEY, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=180) as r: d = json.load(r)
    for c in d.get('candidates', []):
        for p in c.get('content', {}).get('parts', []):
            x = p.get('inlineData') or p.get('inline_data')
            if x: return base64.b64decode(x['data'])
    raise RuntimeError('no image in reply: ' + json.dumps(d)[:300])

def save(raw, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if Image is None: open(path, 'wb').write(raw); return
    im = Image.open(io.BytesIO(raw)); im.thumbnail((1600, 1600))
    if path.endswith('.webp'): im.save(path, 'WEBP', quality=86)
    else: im.save(path)

done = fail = 0
for n, it in enumerate(items, 1):
    if a.limit and done >= a.limit: break
    out = os.path.join(ROOT, target(it['f']))
    if os.path.exists(out): continue
    ref = None
    if it.get('r'):
        rp = os.path.join(ROOT, target(it['r']))
        if os.path.exists(rp):
            ref = open(rp, 'rb').read() if Image is None else None
            if Image is not None:
                b = io.BytesIO(); Image.open(rp).convert('RGB').save(b, 'PNG'); ref = b.getvalue()
    for attempt in range(4):
        try:
            save(call(it['p'], ref, it.get('ratio', '16:9')), out); done += 1
            print(f'[{n}/{len(items)}] OK  {it["f"]}', flush=True); break
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:300]
            print(f'[{n}] HTTP {e.code}: {msg}', flush=True)
            if e.code in (429, 500, 503): time.sleep(20 * (attempt + 1)); continue
            fail += 1; break
        except Exception as e:
            print(f'[{n}] error: {e}', flush=True); time.sleep(5)
    else: fail += 1
    time.sleep(a.pause)
print(f'Done: {done} new, {fail} failed. Run again to retry failures.')
