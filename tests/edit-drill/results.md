# Edit drill: test results

Build under test: the uncommitted tree on HEAD `a619550` after the review fixes.

- Snapshot: `git diff -- index.html css js | sha1sum` = **`560b53b303eb7d69274433632a08b0d0525d8c44`**
- `sha1sum js/edit.js` = **`10ed5f7d5c57e2bcba38fd370e193f9edde85e5d`**
- An earlier snapshot (`81dba1bb…`, `edit.js` `704ce55c…`) was tested first. Every test below was
  re-run on the snapshot above. Findings that the review fixes resolved are listed at the end.

Run date 2026-11-16, Chromium (Claude desktop browser pane).

## Environment

- Scratch copies only: `<scratch>/edittest/` (the page: `index.html`, `css/`, `js/` copied from
  `<repo>`) and `<scratch>/edittest/reg/` (the same build, with the regression harness injected as
  `tests/word-tracking/results.md` describes). Served by `python -m http.server 8792`; mock gist
  `sidecar-mock-gist.py 8899 <scratch>/edittest/out`. Port 8765, the repo `data/` folder and the
  live site were not used, nothing in `<repo>` was modified, and no real GitHub call was made.
- E1/E2/E5/E6/E7 ran as scripts in the page. E3/E4 used real keys from the pane (`computer` key
  actions: `ctrl+Left`, `Home`, `Delete`, `ctrl+BackSpace`, …) and real clicks; known rounds were
  queued by wrapping `CTT.EDIT.round` (the app calls it through the same object).
- Pane automation notes (not app defects): a lone `shift` or `ctrl` key action sends a keydown
  with `key === ''`, `shift+minus` sends no character, the `type` action inserts text without a
  keydown, and the pane does not act on a real F5. Counting tests therefore used `key` actions
  for characters, and modifier-only and F-key behaviour was checked with dispatched events.

## Summary

| Area | Result | Notes |
| --- | --- | --- |
| E1 `plant()` | **FAIL (2)** | F1 typo past 85%; F2 swap replaces a space when a player mix-up has expected `' '`. Everything else passes. |
| E2 `navPar()` / `wordStops()` | PASS | Matches a BFS over the key model at all 2,401 positions; Chrome real Ctrl+arrows match except decimals (O6, no current line affected) |
| E2b `par` (best over valid positions on the shown line) | PASS | Equals an independent optimum in 19,020 rounds; never above arrows-only; achieved by real keys |
| E3 real-key rounds | PASS | arrows only, Ctrl+arrows, Home+Ctrl+Right, Ctrl+Backspace, Backspace×7, mouse, Esc, blocked keys |
| E4 mode switching | PASS | all 5 modes, Stats, Settings, reload; one minor (O2) |
| E5 isolation | PASS | |
| E6 store | PASS | |
| E7 report / panel / layout | **FAIL (2)** | F3 link colour; F4 375 px page wider than the screen (mode bar) |
| E8 regression | 157/158 | LS-5 fails on an outdated test expectation (`ctt.edit.active` removal), not an app regression |
| `extras/caps-arrows.ahk` | PASS (by reading) | valid AutoHotkey v2 |

## Failures

### F1: a typo can be planted in the last 15% of the line

`plant(line, 'typo')` only checks that the *name* starts before `limit`, so a long name that
starts before the limit can have its swapped pair after it.

- Repro: `for (let k = 0; k < 200; k++) { const r = CTT.EDIT.plant('import heapq', 'typo', []); if (r.pos >= 10) { console.log(r); break; } }`
  gives `pos 10` of 12 (`heapq` → `heaqp`). Seen live: `lo, hi = 0, len(nums)` shown as
  `lo, hi = 0, len(nusm)` (pos 17 of 20, limit 17).
- Rate over all 88 lines × 200 runs: 336 of 16,400 typo plants have `pos ≥ 0.85·len`; in 916 the
  second letter is past the limit.
- Fix: in the typo loop, stop at the limit:
  `for (let i = m.index; i < Math.min(m.index + m[0].length - 1, limit - 1); i++)`.

### F2: a swap can replace a space

The pair filter rejects `typed` space or newline but not `expected`. A player mix-up with
expected `' '` (real saves can hold these: a space typed as `_` or a letter) makes every space in
the line a candidate, so swaps land on spaces most of the time.

- Repro: `CTT.EDIT.plant('total = count_items(nums)', 'swap', [{ expected: ' ', typed: 'q' }])`
  often returns `total=q…`-style lines with a space replaced. With that mix-up, 4,700 of 8,800
  swap plants replaced a space.
- Fix: `if (a.length !== 1 || b.length !== 1 || a === b || /\s/.test(a) || /\s/.test(b)) continue;`

### F3: the "Caps Lock + IJKL" link is browser-default blue on the dark panel

`#editPanel a` computes to `rgb(0, 0, 238)` on `rgb(29, 32, 39)`; other links in the app use the
accent colour (`rgb(79, 209, 197)`).

- Fix: `.edit a { color: var(--accent); }` (or reuse the rule the Settings links use).

### F4: at 375 px the page is wider than the screen

The mode bar is one row of 6 buttons: it ends at 477 px, so the layout viewport becomes 478 px
and a phone zooms the page out. Without the Edit button it ends at 419 px, so the overflow existed
before (5 buttons) and the new button makes it 60 px worse. The Edit panel itself stacks
correctly at 375 px (labels above boxes, 14 px font, no inner overflow).

- Repro: mobile preset (375×812), reload: `innerWidth === 478`,
  `document.querySelector('nav.modes').getBoundingClientRect().right === 477`.
- Fix: in the `max-width: 640px` block, `.modes { flex-wrap: wrap; }` (or
  `overflow-x: auto; max-width: 100%`).

## Observations (not failures)

| ID | Observation | Suggestion |
| --- | --- | --- |
| O1 | Player mix-ups are added to the pair pool, not used first: with mix-up `s→d`, a swap in a line containing `s` used it 42% of the time; through `round()`, 22% of swap rounds | When the line has a character from the player's mix-ups, pick among those positions first (e.g. 60%) |
| O2 | Leaving Edit for a symbol mode calls `persist()` twice (setMode's own save, then `flushEdit`) | In setMode, call `flushEdit()` only for the Words branch, or zero `editUnsynced` before the symbol-mode `persist()` |
| O3 | The previous round's feedback stays under the next round until it is solved | Clear or dim `#editFeedback` in `newEditRound` |
| O4 | "1 keys" | `keys === 1 ? 'key' : 'keys'` |
| O5 | While a round is open, keys like F12 or Ctrl+C count as keys | Count only editing keys (printable, arrows, Home/End, Backspace/Delete) |
| O6 | `wordStops` differs from Chrome on decimals: Chrome treats `2.5e3` as one word (model: stops at `2`, `.`, `5e3`). No line in `CONTENT.LINES` has a digit-dot-digit | None needed now; revisit if numeric lines are added |
| O7 | `pagehide` flushes the in-memory state, so a `localStorage.clear()` followed by a reload while Edit had unsynced rounds writes the save back | Expected behaviour; only affects manual devtools clearing |

## E1: `plant()`

88 lines × 4 kinds × 200 runs, half with player mix-ups `x→z`, `' '→q`, `e→\n`, `a→' '`:

| Check | Result |
| --- | --- |
| Non-null rounds: swap 16,300, missing 14,400, extra 17,600, typo 16,400 (nulls: swap 1,300, missing 3,200, typo 1,200; `round()` retries) | – |
| `target === line`, `shown !== target`, kind kept, `par ≥ 0` | PASS |
| Levenshtein 1 (swap, missing, extra) | PASS |
| Typo = adjacent transposition of two different letters | PASS |
| Typo inside a name with 4+ letters | PASS (0 violations) |
| Error index < 85% (swap, missing, extra) | PASS |
| Error index < 85% (typo) | **FAIL** (F1) |
| Swap never inserts a space or newline | PASS |
| Swap never replaces a space | **FAIL** (F2) |
| Swap uses the player's mix-ups | PASS (used); not first (O1) |
| `round()`: pool 65 lines of 18–64 chars; 3,000 rounds 18–55 chars, all `shown !== target` | PASS |

## E2: `navPar()`, `wordStops()` and `par`

- Hand cases: `return self.val` stops `0,7,11,12,15`; p=0 → 1 (Home), p=13 → 2 (Ctrl+Left, Right),
  p=8 → 3 (Home, Ctrl+Right, Right), p=15 → 0; `    if not root:` p=4 → 2 (Home, Ctrl+Right),
  p=14 → 2 (Ctrl+Left ×2). PASS.
- All 88 lines, every position (2,401): `navPar` equals a breadth-first search over Left, Right,
  Ctrl+Left, Ctrl+Right, Home, End on the `wordStops` model; never negative, never above
  arrows-only. PASS.
- `par` (new `best()` over valid positions on the shown line): equal to an independent optimum
  (swap: Delete at i or Backspace at i+1, +2; missing: i, +1; extra: i, i+1, i+2, +1; typo: 3 keys
  between the letters, 4 at either side) for 19,020 random rounds, and never above arrows-only
  plus the fix. PASS.
- Real Chrome Ctrl+Left/Right in `#editInput` (left to 0 and right to the end):

| Line | Chrome stops | Model | Result |
| --- | --- | --- | --- |
| `nums[i] = nums[i-1] + 1` | 0 4 5 6 8 10 14 15 16 17 18 20 22 23 | same | match |
| `self.val, self.next = val, None    if not root: d = {'a': 1}` | 0 4 5 8 10 14 15 20 22 25 27 35 38 42 46 48 50 52 54 55 58 59 60 | same | match (`self.val`: stops at `.` and `val`, as modelled) |
| `res = float("-inf")  # x_y, 2.5e3` | 0 4 6 11 14 17 21 23 26 28 33 | adds 29, 30 | mismatch on `2.5e3` only (O6) |

## E3: real-key rounds (current snapshot)

| Case | Keys pressed | Saved record | Feedback | Result |
| --- | --- | --- | --- | --- |
| (b) Ctrl+arrows, swap `count-items` → `count_items` (par 6) | Ctrl+Left ×4, Backspace, `_` | keys 6, word 4, del 1 | `0.1 s · 6 keys (best about 6)`, no tip; par reached | PASS |
| (c) Home+Ctrl+Right, typo `amximum` (par 7) | Home, Ctrl+Right ×2, Right, Backspace, Right, `a` | keys 7, homeEnd 1, word 2, arrows 2, del 1 | `best about 7`; par reached | PASS |
| (a) arrows only + Alt+Left | Alt+Left, Left ×11, Backspace, `_` | keys 13, arrows 11 (Alt+Left not counted, page did not navigate) | tip `11 arrow presses: Ctrl+Left/Right jumps a word at a time`; next round after 1.6 s | PASS |
| (d) Ctrl+Backspace retype | Ctrl+Left ×5, Ctrl+Backspace, `maximum` | keys 13, word 5, del 1 | no tip; next round after 0.7 s | PASS |
| (d2) Backspace retype (earlier snapshot, same code path) | Ctrl+Left ×5, Backspace ×7, `maximum` | keys 19, del 7 | tip `Ctrl+Backspace deletes the whole word` | PASS |
| (e) mouse | blur, click (focuses: caret goes to the end 35/35, not counted), click inside (caret moves to 24, counted), End, … | mouse 1 | tip `Try it without the mouse…` | PASS |
| Esc during the solved delay | Esc right after solving | no extra record, new round at once | – | PASS |
| Esc skip | Left ×3, Esc | nothing recorded, new round | – | PASS |
| Enter / Up / Down | real keys and dispatched | prevented, not counted, caret unchanged | – | PASS |
| Modifier-only, Tab, composition, `Process` | dispatched `Shift Control Alt Meta CapsLock Tab`, `isComposing`, `Process` | not counted | – | PASS |
| Meta+Left, Ctrl+Right, Alt+Backspace | dispatched | word 2, del 1 | – | PASS |
| Paste / drop | dispatched | both `defaultPrevented` | – | PASS |
| After solving | `a` prevented; Tab, Ctrl+C, F5 not prevented | – | – | PASS |
| Tip rules (`EDIT.tip`, 12 cases) | mouse first; 6 arrows without a word jump; near start (pos < len/3) with > 6 moves and no Home/End; typo with ≥ 4 deletes and no word delete; otherwise none | – | – | PASS |

## E4: mode switching

| Check | Result |
| --- | --- |
| Edit ↔ Adaptive, Lines, My code, Words, Warmup: in Edit the panel shows and the textbox and typing help hide; after leaving, the panel hides and the textbox and help show (My code panel as before) | PASS |
| `ctt.edit.active` is `1` only in Edit; Words and Edit flags never both set; the main save keeps a symbol mode (`lines`, `adaptive`, …) while in Edit | PASS |
| Adaptive typing after leaving Edit: real keys `l e n (` mark 4 characters done | PASS |
| Stray timer: solve, switch to Lines at once, wait 2 s: no new round, Lines text unchanged | PASS |
| Stats with an open round: back restores focus and caret (3); with a solved round: back starts a new round (caret at the end) | PASS |
| Settings open in Edit: real `x`, Backspace, Left do not change the line; Esc closes the dialog, focus returns to the line, the round is kept | PASS |
| Global keys with focus outside the line: F5, Ctrl+R, Ctrl+F, Alt+Left, Meta+L, Tab, F12 not prevented; `a` and Left prevented, focus to the line with the caret at the end | PASS |
| Reload in Edit boots into Edit with focus and the caret at the end | PASS |
| Save with `mode: 'edit'`, `'words'`, `'bogus'`, `null`, `'__proto__'` merges to `adaptive`; symbol modes kept | PASS |
| Persist count (via a counter on `SYNC.enabled`, called once per `persist()`): 4 rounds → 0 persists and 4 `ctt.v1` writes; 5th round → 1 persist; `pagehide` → 1; leaving Edit for Words after 2 rounds → 1 (rounds in `ctt.v1`) | PASS |
| Leaving Edit for Adaptive after 3 rounds → 2 persists (O2); rounds in `ctt.v1` | PASS (minor) |

## E5: isolation

A state with 2 symbol lessons (Adaptive, Lines, one error each), 32 keys, 2 mix-up keys, 33 pairs,
17 tokens and 1 Words lesson; then 6 Edit rounds:

| Check | Result |
| --- | --- |
| `ctt.v1` without `savedAt`, `edit`, `mode` byte-identical before and after (lessons, keys, confusions, pairs, tokens) | PASS |
| `ctt.words.v1` byte-identical | PASS |
| WPM, accuracy, same-hand shift identical in Adaptive before and after, and in Edit | PASS |
| Today: rounds today of 120,000 ms and 10,000 ms, no lessons → `1m` (70 s; uncapped would be `2m`) | PASS |

## E6: store

| Check | Result |
| --- | --- |
| `EDIT.clean` and `STORE.merge({edit: x})` for `null`, `undefined`, an array, a string, a number, `{rounds: null}`, `{rounds: {}}`, `{}`: no throw, `{rounds: []}` | PASS |
| Mixed rounds (null, 5, `'x'`, `[]`, NaN ts, kind `bogus`/`__proto__`, ms NaN/Infinity, string ts, ts > now + 1 day): 4 kept; negative ms → 0; bad counters → 0; ts now + 1 h kept | PASS |
| 450 unsorted rounds → 300 newest, sorted | PASS |
| Old save without `edit` → `{rounds: []}`; `merge('x')`, `merge(5)`, `merge([])` → no throw | PASS |
| Boot with a malformed `edit` and `mode: 'edit'`: Edit panel, 2 valid rounds in the summary, no console errors; the next save holds `mode: 'adaptive'` and only clean rounds | PASS |
| Export → import round trip: exported 3 rounds; after one more local round (4), importing the file restores the same 3 rounds byte for byte, toast `Progress imported`, panel summary updates | PASS |

## E7: report, panel, layout

| Check | Result |
| --- | --- |
| Report has `## Edit drill (last 3 rounds; 3 kept)` with median time, keys vs best, word-jump and mouse share, median by kind; no section without rounds | PASS |
| Panel summary: empty state `Your last 50 rounds will show here.`; populated (rounds, median, keys vs best, shares, slowest kind when a kind has 3+) | PASS |
| Target line: colour `var(--text)` (`rgb(217, 220, 227)`), `user-select: none`, same font, size (20 px at 1280 px, 14 px at 375 px) and padding as the input | PASS |
| Desktop 1280 px screenshot: panel, highlight, feedback and summary laid out; no horizontal scroll | PASS |
| 375 px screenshot: panel stacks correctly | PASS |
| 375 px page width | **FAIL** (F4) |
| Help link colour | **FAIL** (F3) |
| Console: no errors except the expected `api/load` 404 from the static server | PASS |

## E8: regression

One runner pass (`T.run`, label `edit-reg`) of the 158 IDs the earlier results files ran: every
ID in `sidecar-tests.js`, `extras-tests.js` and `wt-tests.js` except the 8 that need a `server.py`
copy (SV-run, SV-load, SV-4, SV-6, SV-7, MI-srv-A/B/C). `fixtures/real-main.json` was not
provided (the test that reads it falls back as written), so no real progress file was used.

| Group | IDs | PASS | FAIL |
| --- | --- | --- | --- |
| WT-* (word tracking) | 24 | 24 | 0 |
| `sidecar-tests.js` + `extras-tests.js` | 134 | 133 | 1 |
| Not run (need `server.py`) | 8 | – | – |

LS-5 (Words save under a storage quota) is a test expectation, not an app regression. It checks
that the only key removed while typing Words lessons is `ctt.words.v1.prev`. Switching to Words
now also clears the device-local Edit flag (`removeItem('ctt.edit.active')`, a key that did not
exist when the test was written). Evidence: `removed: ["ctt.edit.active", "ctt.words.v1.prev"]`,
`failed: ["ctt.words.v1"]` (the quota was hit as intended), 13 sidecar lessons kept. Everything
the test is meant to protect holds. Update the test to allow `ctt.edit.active`. Alternatively,
`setEditActive(false)` could skip `removeItem` when the key is absent.

## `extras/caps-arrows.ahk`

Read only (AutoHotkey not installed). Valid v2: `#Requires AutoHotkey v2.0`, `#SingleInstance Force`,
`SetCapsLockState "AlwaysOff"` (function-call syntax), custom combinations `CapsLock & i::` with
`Send "{Blind}{Up}"` (Blind keeps Ctrl/Shift held, so Ctrl+Caps+J is a word jump and the drill
counts it as one), the semicolon escaped as `` CapsLock & `;:: ``. Comments match the mappings.

## Resolved by the review fixes (seen on the earlier snapshot)

- `par` was computed on the target line for swaps (16% of swap rounds differed from the shown
  line), always 1 too high for extra characters, and assumed 4 keys for a typo (3 suffice).
  Now `best()` on the shown line; verified above.
- `state.mode` became `'edit'` in the synced save; now device-local.

## Fixes after this run (final build)

The four failures above were fixed after this run, plus three observations:

| ID | Fix | Checked |
|---|---|---|
| F1 | typo: both swapped letters before the 85% limit | 265,797 plants over every pool line and kind: 0 errors at or past the limit |
| F2 | swap: whitespace rejected on either side of a pair | same run, with an expected-space mix-up supplied: 0 swaps touch a space |
| F3 | `.edit a` uses `--accent` | computed colour `rgb(79, 209, 197)` |
| F4 | mode bar wraps at 640 px or less | 375 px viewport: page width 375 px, no horizontal scroll (screenshot) |
| O1 | player's own mix-ups used first (60% when the line has one) | own pairs 31% of all swaps in the run above (only some lines contain `_` or `p`) |
| O3 / O4 | feedback cleared on the first key of the next round; "1 key" singular | real-key round: feedback empty after the first key |
| LS-5 | `setEditActive(false)` writes nothing when the flag is already off | not re-run; the flag is only removed when it is present, which is what LS-5 expects |

A real-key round on the final build (`Ctrl+Left` ×3, `Delete`, `,`) recorded
3 word jumps and 1 delete, finished, and saved; no console errors except the
expected `api/load` 404 from the static server.
