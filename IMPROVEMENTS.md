# Improvement log

Changes to how the trainer behaves, with the values before and after, why, and
how to roll back or tweak. Newest first. `IDEAS.md` is the backlog; this file
records what was actually changed.

To roll back a whole entry: `git revert <commit>`. To tweak, change the named
constants (all at the top of `js/engine.js` unless noted) and re-run the
simulation in `sim/` before and after.

---

## 2026-11-11: Words mode (side feature, separate save)

Commit: see `git log --grep "Words mode"`.

### Why

A keybr-style letter trainer with everyday and AI/ML words, for people who
want plain typing instead of code. It is a side feature: the symbol modes
(Adaptive, Lines, My code, Warmup) stay the main tool and must not change.

### Design: a separate save (sidecar)

A first version kept Words progress inside the main save (`state.words`).
It was tested but never released, because it still shared the main save:
a Words lesson bumped the main `savedAt`, so typing Words on device B could
make B's older symbol progress win the sync over device A, and Words data was
parsed on every main load. The released design keeps Words fully apart:

| Where | Main (unchanged) | Words |
|---|---|---|
| Browser | `ctt.v1` (+ `.prev`) | `ctt.words.v1` (+ `.prev`, `.unreadable`) |
| On-screen mode | `state.mode` (symbol modes only) | `ctt.words.active`, this device only, never synced |
| Gist | `code-typing-trainer-progress.json`, `-report.md` | `code-typing-trainer-words.json`; its PATCH lists only this file |
| Server | `data/progress.json`, `data/report.md` | `data/words.json` (git-ignored), only if the server knows it |
| Folder mode | same files | `data/words.json` |
| Export | Export progress (same file as before) | Export Words progress; Import detects either |
| Report | saved report unchanged | Words section only in Copy/Download report, once there is a Words lesson |

- The main save, load, sync, server and export code is the same as before
  Words (one added line in `merge`: `stripLegacy`, which returns the input
  unchanged for normal saves). Words code never calls them.
- Words sync (`js/sync.js`, `pullWords`/`pushWords`): newest `savedAt` wins
  for the Words file only, with its own status line in Settings; it waits
  while a main upload is queued or in flight; adopting a newer copy cancels
  older queued uploads.
- `js/store.js` `mergeWords` cleans every field the engine reads, and
  `guardWords` in `js/app.js` switches back to the symbols if Words data still
  cannot be shown, so bad Words data can never stop the app from starting.
- Settings: own target speed (10–150, default 35); Lesson length, Unlock and
  Reset act on the mode on screen.
- Engine: `js/engine.js` reads the key order from `state.order || TRAIN`
  (`ord()`), so it runs on the Words save; `order` and `settings` are
  attached as non-enumerable (never saved). Only a-z is recorded in Words, no
  pair timings, no weak-letter mixing. Sentence lessons (all 26 letters, about
  half the lessons) run the engine with mode `'sentences'`, so they do not
  move the focus rotation or the unlock counter.
- Content (`js/words.js`): letter order `etaoinsrhldcumfpgwybvkxjqz`, 10 to
  start (`ORDER`, `START`), about 700 common + ML words, 100 original ML
  sentences, about half the words contain the focus letter (0.5 / 0.8 split
  in `text()`).
- Also changed for both modes (display only): several "looks solid today"
  messages from one lesson are merged into one; the header shows "–" for a
  mode with no lessons yet.
- Migration: Words data left inside a main save by the unreleased first
  version is removed from main on load and copied once into an empty Words
  save, with `savedAt = 1` so any real synced Words copy wins.

### Process and tests (tests/words-mode/)

Design (`sidecar-design.md`) and test plan (`sidecar-testplan.md`) by a
planning agent, then implementation, then a full test run by a testing agent
and an independent code review in parallel; findings fixed and the full suite
re-run. Results with evidence: `sidecar-results.md`.

- Main byte-identity against the previous version: browser save, gist PATCH
  bodies, server POST bodies, export and saved report are identical for the
  same symbol lessons, with and without Words activity in between.
- Words gist PATCH bodies contain only the Words file; conflict matrix (local
  newer, remote newer, missing, corrupted, newer version, token revoked,
  offline, both uploads at once); connect with Words-only progress.
- The previous version opened after this one was used: opens a symbol mode,
  main intact.
- Corrupted Words storage, storage full, reset, import, export, migration,
  old page with new server and new page with old server.
- Review fixes: corrupted Words data could stop startup (now cleaned and
  guarded); Words upload could overlap a queued main upload; a failed older
  Words upload was retried after a newer copy was adopted; importing a Words
  file re-saved the main progress (the Settings change listener also caught
  the hidden import input; now `input:not([type=file])`).

### Rollback / tweak

- Remove the feature: `git revert` the commit. Main saves written by this
  version are in the previous format, so the old code reads them as its own;
  the Words keys and files are simply ignored and kept.
- Optional cleanup after a rollback: remove `ctt.words.*` from the browser
  storage, the Words file from the gist, `data/words.json`.
- Hide without reverting: remove the Words button in `index.html`; nothing
  in the main mode reads the Words save.
- Starting letters: `START` (js/words.js) and `unlocked: 10` in
  `wordsDefaults` / `mergeWords` (js/store.js).
- Words target speed: Settings, or the default in `wordsDefaults`.

---

## 2026-11-11: Mastery by confidence bound, two-day rule, natural unlocking

Commit: see `git log --grep "confidence-bound mastery"`.

### Why

- The old mastery rule ("96% over the last 60 attempts, 10+ weighted
  samples") was far looser than it looked. In simulation a 94% typist
  mastered a key in one 25-attempt lesson 72% of the time, and a 92% typist
  mastered it in a single cram day 84% of the time.
- Unlocking waited for every key to be mastered. Starting from the real
  2026-11-10 stats, the old rule stayed on the same 6 keys for all 14
  simulated days, matching 117 real lessons stuck on `( ) [ ] _ :`.
- One bad lesson could demote a mastered key (75% over 30 attempts demoted
  it 88% of the time).

### What changed

| Area | Before | After | Constant(s) |
|---|---|---|---|
| Memory per key | last 60 attempts, 21-day fade (halves every 10 days) | last 150 attempts; each attempt also counts half after 100 newer attempts; same 21-day fade | `HIST` 60 → 150, new `ATTEMPT_HALF` = 100 |
| Mastery | weighted accuracy ≥ 96%, speed ≥ target, ≥ 10 weighted samples | 90% sure accuracy ≥ 93% (Wilson lower bound), speed ≥ target, ≥ 10 weighted samples, passed on **2 different days**, each with that day's own accuracy ≥ 95% (10+ attempts that day) | `ACC_TARGET` 0.96 → `MASTER_BAR` 0.93, `Z_MASTER` 1.2816, `PASS_DAYS` 2, `DAY_ACC` 0.95, `DAY_MIN` 10 |
| Demotion | weighted accuracy < 90% | 80% sure accuracy < 90% (Wilson upper bound) | `DEMOTE_BAR` 0.90, `Z_DEMOTE` 0.8416 |
| Reviews | 6 attempts at ≥ 96% and ≥ 90% of target speed | passes when the review attempts give 90% sure ≥ 93% (and ≥ 90% of target speed); fails when 80% sure < 90%; decided by point accuracy ≥ 93% at 40 attempts if still unclear | `REVIEW_MAX` 40 |
| Confidence bar | speed × (accuracy / 96%) × samples | speed × (lower bound / 93%) × samples, 100% only when mastered | in `stats()` |
| Unlocking | next key only when every unlocked key is mastered | next key when every unlocked key is "good enough" (has reached ≥ 92% and ≥ 70% of target speed; resets below 80%), **or** after 10 adaptive lessons without an unlock if no key is below 70% and at most 3 keys are not good enough | `GOOD_RESET` 0.80, `STALL_LESSONS` 10, `STALL_FLOOR` 0.70, `MAX_NOT_GOOD` 3 (reuses `LEARN_ACC` 0.92, `LEARN_SPEED` 0.7) |
| Saved state | — | new per-key `passDays`, `good`; top-level `sinceUnlock` | `js/store.js` defaults |

### Simulation results (sim/, 300–400 runs each)

Time to mastery, 4 lessons/day, 25 attempts on the key per lesson:

| True accuracy | Before | After |
|---|---|---|
| 97% | 1 lesson | day 2 |
| 96% | 1 lesson | day 3 |
| 95% | 1 lesson | day 4 |
| 94% | 1 lesson (72% on day 1) | day 7 |
| 93% | 2 lessons | about day 13 (86% ever) |

- Cram day (400 attempts, one day): before, mastered up to 100%; after, never.
- One bad lesson on a 97% key: 75% × 30 attempts demotes 88% → 10%.
- Real slump: to 85% demotes after about 40 → 100 attempts; to 80% about
  30 → 70.
- Unlocking from the real stats, 10 lessons/day: keys after 1/3/7/14 days
  went from 6/6/6/6 to 6/7/9/14, with about 4 weak keys at once. The first
  6 keys reached the same accuracy either way (about 92–93%).

### Tweaking guide

- Unlocks too fast or too many weak keys: lower `MAX_NOT_GOOD` to 2 (12 keys
  in 14 days) or raise `STALL_LESSONS`.
- Mastery too slow: lower `MASTER_BAR` to 0.92 (a 94% typist masters by
  about day 4) or set `PASS_DAYS` to 1 (loses the cram protection).
- Slumps caught too slowly: lower `Z_DEMOTE` (0 = point estimate: 85% slump
  in about 70 attempts, but one 75% lesson then demotes 46% of the time).
- Full rollback to the old model: `git revert` this commit. Saved progress
  stays compatible both ways (new fields are ignored by the old code).

---

## 2026-11-10: Weak letters mixed into drills (commit 2c2c60b)

- Letters were already recorded but ignored. Now up to 3 letters below 90%
  accuracy with 8+ weighted samples bias identifier picks in Adaptive (about
  half of names contain one) and Lines; shown in Stats and the report.
- Constants: `LETTER_ACC` 0.9, `LETTER_MIN` 8, `LETTER_MAX` 3 (engine.js);
  0.5 bias in `pickId` (content.js); 0.25 line weight in `lines()`.
- Rollback: `git revert 2c2c60b`.

## 2026-11-09: Warmup mode (commits 90c5b39, 961c6ff)

- Per-finger warmup, not recorded in stats. Rounds: tour, home, top, bottom,
  number row, mix; starts at the home row. 961c6ff restored the fixed row
  drills after a randomized version was rejected, and added the round menu.

## 2026-11-09: GitHub Gist sync (commit 95eb659)

- Optional cross-device sync through a secret gist; newest `savedAt` wins.
