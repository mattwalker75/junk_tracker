# Craving Crusher's app icon

One drawing makes every icon: **`icon.svg`** here, a full 512 × 512 square with no rounded corners and no
transparency (each phone cuts its own shape: iPhone a rounded square, many Androids a circle). Keep the
picture inside the middle circle 80% across, so nothing important is cut off.

```bash
node scripts/make_icons.mjs                                   # remake every file from Docs/icon/icon.svg
node scripts/make_icons.mjs Docs/icon/options/07-hero-shield.svg   # use another drawing (it becomes icon.svg)
```

It draws with the Mac's Google Chrome (headless) — no packages — and writes:

| File | Size | For |
|---|---|---|
| `web/public/apple-touch-icon.png` | 180 | iPhone / iPad: Share → Add to Home Screen |
| `web/public/icon-192.png`, `icon-512.png` | 192, 512 | Android home screen and splash (from `manifest.webmanifest`) |
| `web/public/icon-maskable-512.png` | 512 | Android launchers that cut icons to a shape: the drawing shrunk into the safe zone |
| `web/public/icon.svg` | any | the browser tab (rounded corners) |
| `Docs/icon/icon-1024.png` | 1024 | the master for a future iPhone / Android app |

Every file is committed, so updating stays stop → git pull → start.

The name under the icon is **Craving Crusher**: `apple-mobile-web-app-title` in `web/index.html` (iPhone) and
`name` / `short_name` in `web/public/manifest.webmanifest` (Android). A phone may shorten it with "…" when it
doesn't fit under the icon.

## The options (Nov 21 2026)

`options/` holds the 14 drawings shown on the mockups canvas, Round 8
(https://claude.ai/artifact/JaQKDBbcdYyzDybDBx2eXS): 1–9 drawn like Calorie Crusher's monsters (dark plum
outlines, the game's colours), 10–14 in the tracker's look (white on the tracker's blue). Matt picked
**9, `09-cc-game.svg`** (Nov 21 2026), so `icon.svg` is a copy of it.

## For a real iPhone or Android app later

- **iPhone (App Store):** Xcode takes one 1024 × 1024 PNG with no transparency — `icon-1024.png` is that.
- **Android (Play Store):** a 512 × 512 PNG (`web/public/icon-512.png`), and an *adaptive icon* — two layers,
  108 dp square, the picture inside the middle 66 dp. Make the layers from `icon.svg` at that time: the first
  full-size `<rect>` is the background layer, the rest is the foreground (shrink it to fit the 66 dp).
  Android 13's themed icons want a one-colour version too.
