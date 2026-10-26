#!/usr/bin/env python3
"""Make the voice files for every story scene, in all three languages.

Run this on a computer that has internet (it uses Microsoft's free neural voices through the `edge-tts` package):

    pip install edge-tts
    python scripts/make-audio.py --list-voices      # first time: confirm the three voice names below exist
    python scripts/make-audio.py                    # makes only the files that are missing
    python scripts/make-audio.py --force            # remake everything
    python scripts/make-audio.py --only A           # only letter A

Output: audio/<gu|hi|en>/<LETTER>-<scene>.mp3 and audio/<lang>/<LETTER>-lesson.mp3
        (24 kHz mono mp3, the same kind of file the app already uses)
Then run:  node scripts/build-data.mjs   to check nothing is missing.
"""
import argparse, asyncio, json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
VOICES = {"gu": "gu-IN-DhwaniNeural", "hi": "hi-IN-SwaraNeural", "en": "en-IN-NeerjaNeural"}
RATE = {"gu": "-12%", "hi": "-10%", "en": "-8%"}   # slightly slower: this is for children

ap = argparse.ArgumentParser()
ap.add_argument("--force", action="store_true")
ap.add_argument("--only", help="letter, e.g. A")
ap.add_argument("--list-voices", action="store_true")
args = ap.parse_args()

try:
    import edge_tts
except ImportError:
    sys.exit("Install it first:  pip install edge-tts")

async def main():
    if args.list_voices:
        vs = await edge_tts.list_voices()
        for lang, name in VOICES.items():
            ok = any(v["ShortName"] == name for v in vs)
            print(f"{lang}: {name} -> {'OK' if ok else 'NOT FOUND, pick one of:'}")
            if not ok:
                for v in vs:
                    if v["Locale"].lower().startswith(lang):
                        print("    ", v["ShortName"], v["Gender"])
        return
    jobs = []
    for f in sorted((ROOT / "data/stories").glob("*.json")):
        s = json.loads(f.read_text(encoding="utf-8"))
        letter = s["id"].split("-")[1]
        if args.only and args.only.upper() != letter:
            continue
        for lang in VOICES:
            for sc in s["scenes"]:
                jobs.append((lang, f"{letter}-{sc['id']}", sc["text"][lang]))
            jobs.append((lang, f"{letter}-lesson", s["lesson"][lang]))
    made = 0
    for lang, name, text in jobs:
        out = ROOT / "audio" / lang / f"{name}.mp3"
        if out.exists() and not args.force:
            continue
        out.parent.mkdir(parents=True, exist_ok=True)
        await edge_tts.Communicate(text, VOICES[lang], rate=RATE[lang]).save(str(out))
        made += 1
        print("made", out.relative_to(ROOT))
    print(f"done: {made} new file(s), {len(jobs) - made} already there")

asyncio.run(main())
