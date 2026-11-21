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
| `Docs/icon/icon-1024.png` | 1024 | the master for the iPhone / Android apps and their stores |
| `app_ports/ios/CravingCrusher/Assets.xcassets/AppIcon.appiconset/icon-1024.png` | 1024 | the iPhone app's icon (a copy) |
| `app_ports/android/app/src/main/res/drawable-nodpi/cc_icon.png` | 512 | the Android app's launcher picture (a copy) |

Every file is committed, so updating stays stop → git pull → start.

The name under the icon is **Craving Crusher**: `apple-mobile-web-app-title` in `web/index.html` (iPhone) and
`name` / `short_name` in `web/public/manifest.webmanifest` (Android). A phone may shorten it with "…" when it
doesn't fit under the icon.

## The options (Nov 21 2026)

`options/` holds the 14 drawings shown on the mockups canvas, Round 8
(https://claude.ai/artifact/JaQKDBbcdYyzDybDBx2eXS): 1–9 drawn like Calorie Crusher's monsters (dark plum
outlines, the game's colours), 10–14 in the tracker's look (white on the tracker's blue). Matt picked
**9, `09-cc-game.svg`** (Nov 21 2026), so `icon.svg` is a copy of it.

## In the iPhone and Android apps (app_ports/)

The iPhone app's icon is the 1024 copy; Xcode makes every size from it. The Android app's icon is an
*adaptive icon* (`res/mipmap-anydpi-v26/ic_launcher.xml`): the background layer is the colour `cc_icon_bg`
(`res/values/colors.xml` — keep it the same as the drawing's first `<rect>`), the foreground is the 512 copy
shrunk into the middle of the layer, so the phone can cut it to a circle or a rounded square.

## For the stores

- **iPhone (App Store):** Xcode takes one 1024 × 1024 PNG with no transparency — `icon-1024.png` is that.
- **Android (Play Store):** a 512 × 512 PNG, `web/public/icon-512.png`. Android 13's themed icons want a
  one-colour version too (not made yet: without it the phone shows the icon in its own colours).
