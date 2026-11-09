# Code Typing Trainer

An offline typing trainer for programming symbols, built around keybr's adaptive
idea (track every key, drill the weakest, unlock new keys once the current set
is solid) but aimed at Python code instead of letters.

**Online:** https://cheikhwade07.github.io/code-typing-trainer/ (GitHub
Pages). Progress saves in your browser automatically; use the same browser
each time. Stats → **Copy report** gives a shareable metrics report.
Optionally click **Save to folder…** once (Chrome or Edge) to also keep
`data/progress.json` and `data/report.md` on disk.

**Offline alternative: `start-trainer.bat`** (double-click; make a desktop shortcut
to it). It starts a tiny local server in the background and opens the page at
http://127.0.0.1:8765/. Progress saves automatically, no clicks. Double-clicking
again while it runs just opens the page. Opening `index.html` directly also
works, without automatic saving.

## Modes

- **Adaptive**: drills built from Python tokens (`nums[i]`, `__init__`,
  `d.get(k, 0)`). It starts with `( ) [ ] _ :` and unlocks one new symbol
  once every unlocked symbol has been mastered.
  - **Learn phase (one key at a time, keybr-style)**: a new or weak focus key
    stays the focus until it reaches 92% accuracy and 70% of the target
    speed. Lessons are mostly that key: short drills (`i(`, `(dp`, `x(j`)
    and short real tokens, plus a little mix-up contrast.
  - **Mix phase**: about 50% focus key, 30% other weak, review-due, or stale
    keys plus your most common mix-up partner, and 20% any unlocked key.
  - Settings → Focus style switches between one key at a time (default) and
    a balanced mix.
- **Lines**: real Python idiom lines, weighted toward your weak symbols. Press
  Enter at each line break.
- **My code**: paste code you have already written and retype it in chunks of
  4 lines. Indentation fills in automatically.

## How the model avoids getting stuck

- **Time decay**: each key keeps its last 60 attempts; an attempt's weight
  halves every 10 days and drops out after 21 days, so old green keys fade
  and come back into practice.
- **Spaced review**: a key that reaches 96% accuracy and the target speed is
  mastered and scheduled for review after 1, 3, 7, 14, then 30 days. Review
  attempts accumulate across lessons (6 needed); passing extends the gap,
  missing sends the key back to learning. A mastered key that drops below 90%
  is demoted.
- **Rotation**: if the focus key has not improved after 5 lessons, it rests
  for 3 lessons and the next-weakest key takes over.
- **Mix-ups**: wrong keys are recorded (for example `-` typed for `_`), and
  the top mix-up partner is drilled next to the focus key, even if it is not
  unlocked yet.
- **Slow transitions**: timing between consecutive keys involving a symbol
  (for example `](`) is recorded and listed in Stats and the report.

## Saving and the report

When opened through `start-trainer.bat`, the page saves automatically after
every lesson (the header shows "✓ Auto-saving"):

- `data/progress.json`: full progress (the durable copy)
- `data/report.md`: a readable metrics report to share for analysis

`server.py` only listens on 127.0.0.1 and only writes those two files. The
browser keeps a local copy too; on open, whichever copy is newer wins.
Stats → **Copy report** copies the report to the clipboard.

Fallback when the page is opened as a file: **Save to folder…** lets Chrome or
Edge write the same files after you pick this folder (it may ask to reconnect
after a restart).

### Sync across devices (GitHub Gist)

1. Create a classic token with only the **gist** scope (Settings → *Create a
   token* opens the pre-filled GitHub page). Pick an expiration you are happy
   with; "No expiration" means you never have to redo this.
2. Paste it in Settings → **Sync across devices** → Connect, once per browser.

The trainer then finds or creates one secret gist
(`code-typing-trainer-progress.json` and `code-typing-trainer-report.md`),
uploads a few seconds after each lesson, and loads the newer copy when the page
opens or the tab regains focus. The header shows "☁ Synced". The token stays
in that browser's storage only (never in exports or the gist). A secret gist is
unlisted, not encrypted: anyone with its URL can read it, which is fine for
typing stats. If the token expires or is revoked, the header shows
"☁ Token expired"; disconnect and connect with a new one, no progress is lost.

## Features

- Stop on error (default): you must type the right key before moving on.
- Same-hand Shift detection: flags Shift held on the same hand as the symbol.
- On-screen US QWERTY keyboard colored by finger (on by default), with a
  legend that highlights the finger for the next key, next-key and Shift
  highlighting, and home-row bumps on F and J.
- Synthesized key, error, and unlock sounds (Web Audio, no audio files).
- Per-symbol accuracy, speed, and confidence; progress chart; practice time
  today.
- Progress saved to `data/` (see above) and in the browser; Settings → Export
  makes an extra backup.

## Files

```
start-trainer.bat  launcher (starts server.py in the background)
server.py       local server: serves the page, auto-saves data/
index.html
css/style.css
js/layout.js    US QWERTY geometry, fingers, char -> key
js/content.js   symbol order, token templates, idiom lines, generators
js/engine.js    decayed per-key stats, reviews, rotation, mix-ups, pairs
js/store.js     browser copy, version migration, export
js/sound.js     Web Audio sounds
js/chart.js     canvas progress chart
js/files.js     auto-save via server.py, or folder access fallback
js/report.js    markdown metrics report
js/sync.js      optional GitHub Gist sync across devices
js/app.js       typing loop, rendering, settings, stats view
```

Scripts are plain (non-module) so the page also works from `file://`.
