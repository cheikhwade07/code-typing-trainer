# Code Typing Trainer

An offline typing trainer for programming symbols, built around keybr's adaptive
idea (track every key, drill the weakest, unlock new keys once the current set
is solid) but aimed at Python code instead of letters.

Open `index.html` in a browser. No install, no server, no network.

## Modes

- **Adaptive**: drills built from Python tokens (`nums[i]`, `__init__`,
  `d.get(k, 0)`). It starts with `( ) [ ] _ :` and unlocks one new symbol
  once every unlocked symbol is at 96%+ accuracy and the target speed over at
  least 15 samples. The weakest unlocked symbol is the focus and appears most
  often.
- **Lines**: real Python idiom lines, weighted toward your weak symbols. Press
  Enter at each line break.
- **My code**: paste code you have already written and retype it in chunks of
  4 lines. Indentation fills in automatically.

## Features

- Stop on error (default): you must type the right key before moving on.
- Same-hand Shift detection: flags Shift held on the same hand as the symbol.
- On-screen US QWERTY keyboard with next-key and Shift highlighting, plus
  optional finger colors.
- Synthesized key, error, and unlock sounds (Web Audio, no audio files).
- Per-symbol accuracy, speed, and confidence; progress chart; practice time
  today.
- Progress saved in the browser (localStorage). Use Settings → Export to back
  it up; storage is per browser.

## Files

```
index.html
css/style.css
js/layout.js    US QWERTY geometry, fingers, char -> key
js/content.js   symbol order, token templates, idiom lines, generators
js/engine.js    per-key stats, confidence, focus, unlocking
js/store.js     localStorage load/save, export
js/sound.js     Web Audio sounds
js/chart.js     canvas progress chart
js/app.js       typing loop, rendering, settings, stats view
```

Scripts are plain (non-module) so the page works from `file://`.
