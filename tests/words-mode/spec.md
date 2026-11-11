# Words mode spec (side feature)

Repo: <repo>
(plain JS, non-module scripts under window.CTT; js/engine.js, js/content.js, js/app.js,
js/store.js, js/report.js, js/chart.js; local server: python server.py on 127.0.0.1:8765).

## Goal
A keybr-style letter trainer with AI/ML flavored words, as a side feature. The main
symbol mode (Adaptive / Lines / My code) is the user's primary tool and must not be
affected in any way: not its stats, unlocks, focus, weak-letter mixing, report, chart,
or behavior.

## Behavior
1. New mode button "Words" (data-mode="words"), after "My code", before "Warmup".
2. Trained keys: lowercase a-z in frequency order
   `e t a o i n s r h l d c u m f p g w y b v k x j q z`. Starts with 10 unlocked
   (`e t a o i n s r h l`) so real words work from lesson one.
3. Same engine rules as the main mode (js/engine.js: confidence-bound mastery,
   2-day rule, demotion, reviews, stall unlock after 10 lessons with at most 3 weak
   keys and none below 70%, focus/learn phase, rotation, mix-up tracking).
4. Words target speed: separate setting `wordsTargetWpm`, default 35. Other settings
   (stop on error, sounds, keyboard, lesson length...) are shared.
5. Lesson text: real lowercase words (common English + ML vocabulary) using only
   unlocked letters; about half contain the focus letter; others favor weak letters.
   Length about the lesson length setting. No identical consecutive words.
6. Sentence phase: once all 26 letters are unlocked, about half of words lessons are
   original ML sentences (written for the app, not copied from papers) with capitals
   and punctuation.
7. What gets recorded in words mode: only lowercase a-z keystrokes go to the words
   stats (capitals, spaces, punctuation are typed but not recorded). No pair timings.
   Same-hand Shift is counted in the lesson record as usual.

## Separation (hard requirements)
- Persisted under `state.words = { unlocked, sinceUnlock, keys, confusions, pairs,
  cooldown, focusRun, lessons }`. Nothing from a words lesson is written to
  state.keys, state.confusions, state.pairs, state.cooldown, state.focusRun,
  state.unlocked, state.sinceUnlock, or state.lessons.
- Main-mode code paths (plan, weakLetters, unlockStatus, report sections, chart,
  metrics, keystrip) read only main state and produce identical output before and
  after any amount of words practice.
- Main report: unchanged except one appended section at the very end
  "## Words mode (separate from the symbol stats)".
- Stats view: toggle "Symbols | Words"; each shows its own chart, summary, key table,
  mix-ups. Default view is Symbols.
- Header metrics (WPM, accuracy, Today) show the current mode's own lessons.
- Keystrip, focus line, unlock text show words letters while in Words mode.
- Settings → "Unlock next symbol" acts on the current mode (main unless Words active).
- Export/Import/Gist sync/server save carry state.words automatically (same object).
- Reset progress resets everything (both), with the confirm text saying so.
- Old saves without `words` load fine (defaults created). Old code loading a new save
  ignores `words` (no crash).
- Warmup mode unchanged and still records nothing.

## Out of scope
- Copying text from research papers (licensing). Paste-your-own-text mode.
