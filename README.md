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
  as described under "How the model avoids getting stuck".
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
- **Words** (side mode): keybr-style letter training with about 2,350 words:
  common everyday words and words from AI/ML papers (*attention, gradient,
  tensor...*). Starts with 10 letters
  (`e t a o i n s r h l`) and unlocks the rest by frequency, using the same
  mastery and unlock rules as the symbols, with its own target speed
  (default 35 WPM) and lesson length. Optional extras (Settings → Words):
  capital letters (off / sometimes / often), numbers, punctuation; they
  count in the lesson's speed and accuracy but not in the letter stats or
  unlocking. Once all 26 letters are unlocked, about half
  the lessons are short original ML sentences. Its progress is a separate
  save (browser, gist file, `data/words.json`), so Words typing never changes
  the symbol progress or its saves. Stats has a *Symbols | Words* toggle;
  Copy/Download report add a Words section once you have a Words lesson.
  Settings has three tabs: General (shared), Symbols and Words, each with
  its own Unlock, Export and Reset.
- **Warmup**: pick a finger and a round (tour, home row, top row, bottom row,
  number row, mix). Rounds reach from the home key to each of its keys
  and back (`;p ;p p;`), row by row: home row, top row, bottom row, number
  row, then a mix. The keyboard dims every other finger's keys. Nothing is
  recorded: no stats, no mix-ups, no progress changes.

## How the model avoids getting stuck

- **Memory**: each key keeps its last 150 attempts. An attempt counts half
  after 100 newer attempts, its weight also halves every 10 days, and it drops
  out after 21 days, so old green keys fade and come back into practice.
- **Mastery by confidence**: a key is mastered when the trainer is 90% sure
  its accuracy is at least 93% (a Wilson lower bound, so more attempts and
  higher accuracy both help), it is at target speed, and that happened on 2
  different days, each with 95%+ accuracy that day. One cram day cannot
  master a key.
- **Spaced review**: mastered keys come back after 1, 3, 7, 14, then 30
  days. A review passes or fails by the same kind of bound (decided at 40
  attempts at the latest). A mastered key is demoted only when the trainer is
  80% sure it dropped below 90%, so one bad lesson does not demote it.
- **Unlocking**: the next symbol unlocks when every unlocked key has reached
  92% accuracy and 70% of target speed, or after 10 adaptive lessons without
  an unlock if no key is below 70% and at most 3 keys are still weak. Weak
  keys keep the focus. Stats shows what the next unlock is waiting for.
- **Rotation**: if the focus key has not improved after 5 lessons, it rests
  for 3 lessons and the next-weakest key takes over.
- **Mix-ups**: wrong keys are recorded (for example `-` typed for `_`), and
  the top mix-up partner is drilled next to the focus key, even if it is not
  unlocked yet.
- **Weak letters**: letters are tracked too. Up to 3 letters below 90%
  accuracy (with enough recent samples) get mixed in: about half of the
  names in Adaptive drills contain one, and Lines leans toward lines that use
  them. Symbols stay the focus. Stats and the report list the weakest letters.
- **Trouble words**: every identifier and keyword you type in Adaptive, Lines
  and My code (`return`, `ListNode`, `True`, `max_len`; case counts) is
  recorded as typed cleanly or not, and how fast. Words with 3+ recent
  samples are ranked by misses and slowness; up to 5 of the worst get mixed
  into Adaptive (about 15% of chunks) and Lines. Stats ("Trouble words") and
  the report list them. Adaptive and Lines include Python keywords and
  LeetCode names (`None`, `Optional[TreeNode]`, `defaultdict`, `nonlocal`...).
- **Slow transitions**: timing between consecutive keys involving a symbol
  (for example `](`) is recorded and listed in Stats and the report.

## Saving and the report

When opened through `start-trainer.bat`, the page saves automatically after
every lesson (the header shows "✓ Auto-saving"):

- `data/progress.json`: full progress (the durable copy)
- `data/report.md`: a readable metrics report to share for analysis
- `data/words.json`: Words mode progress (not tracked by git)

`server.py` only listens on 127.0.0.1 and only writes those files. The
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
(`code-typing-trainer-progress.json` and `code-typing-trainer-report.md`, plus
`code-typing-trainer-words.json` once you use Words mode),
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
- Progress saved to `data/` (see above) and in the browser; Export in the
  Symbols and Words tabs of Settings makes an extra backup; Import (General
  tab) accepts either file.

## Files

```
start-trainer.bat  launcher (starts server.py in the background)
server.py       local server: serves the page, auto-saves data/
index.html
css/style.css
js/layout.js    US QWERTY geometry, fingers, char -> key
js/content.js   symbol order, token templates, idiom lines, generators
js/words.js     Words mode: letter order, word list, original ML sentences
js/engine.js    decayed per-key stats, reviews, rotation, mix-ups, pairs
js/store.js     browser copy, version migration, export
js/sound.js     Web Audio sounds
js/chart.js     canvas progress chart
js/files.js     auto-save via server.py, or folder access fallback
js/report.js    markdown metrics report
js/sync.js      optional GitHub Gist sync across devices
js/app.js       typing loop, rendering, settings, stats view
sim/            Python simulations of the mastery and unlock rules
IMPROVEMENTS.md log of behavior changes, with old values and rollback notes
```

Scripts are plain (non-module) so the page also works from `file://`.
