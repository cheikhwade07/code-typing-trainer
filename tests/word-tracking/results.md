# Per-word tracking: test results

The build under test is the uncommitted tree on HEAD `f3a3da5`, final snapshot
**`d9fe9d5fba50e75e76cf005ca299382b74f3d248`** (`git diff -- index.html js | sha1sum`).
It includes the review fixes:

- `[ms, ts]` samples
- caps of 10 samples per word and 200 words
- `__proto__` and names over 60 characters are skipped
- `drillWords(state, now, allowed)`
- keywords stay bare
- Backspace truncates `tAt`
- "No trouble words" stats text
- O-1: one trouble-word roll per template chunk that was pushed
- O-2: a match right after a digit is skipped

The tree was checked unchanged after the last test. Run date 2026-11-11, Chromium (Claude
desktop browser pane).

## Environment

- Everything ran in scratch copies under `<scratch>`. The repo `<repo>`, port 8765, the repo
  `data/` folder and the live site were not used, and no real GitHub call was made.
- `<scratch>/wordtest/` holds the build under test, served by `python -m http.server 8791`, with
  the mock gist `t/sidecar-mock-gist.py` on 8798.
- Reference runs, made on the previous snapshot `f808fa6`:
  - `<scratch>/wordtest-head/`: `git archive HEAD`, port 8792, mock 8797.
  - `<scratch>/wordtest-mix/`: the build with HEAD's `js/content.js`, port 8793, mock 8796.
- Each scratch `index.html` loads `t/sidecar-pre.js` before the app. After `js/app.js` it loads
  `t/sidecar-harness.js`, `t/cross-version.js`, `t/sidecar-tests.js`, `t/extras-tests.js` and
  `t/wt-tests.js`.
- To rerun, call `T.run([...ids], label)` in the page. Results land in `out/results-<label>.json`.
- `t/wt-tests.js` holds the WT-* tests on the existing runner. It drives lessons with keydown
  events and a controlled `performance.now`, so per-character deltas are exact.
- `Math.random` is seeded for the generation tests.

## Summary (final snapshot d9fe9d5, one pass of 158 IDs)

| Group | IDs | PASS | FAIL |
| --- | --- | --- | --- |
| WT-* (word tracking) | 24 | 24 | 0 |
| Regression: `sidecar-tests.js` + `extras-tests.js` | 134 | 134 | 0 |
| Not run (need a `server.py` copy): SV-run, SV-load, SV-4, SV-6, SV-7, MI-srv-A/B/C | 8 | – | – |

There are no open failures. O-1 and O-2 from the previous snapshot are fixed and verified (WT-22,
WT-23). On the earlier snapshot, WT-8 and WT-20 failed once. Both failures came from test code
(a `constructor` key in the test's own expectation map, and expecting `0%` where the report
prints `0.0%`), and both tests were fixed.

## WT-* results

### Recording

| ID | Area | Result | Evidence |
| --- | --- | --- | --- |
| WT-1 | Word spans | PASS | `def __init__(self, val=0): return True if x else None` yields `def __init__ self val return True if else None`. Excluded: single letters, digits, `_`, `__`, `__proto__`, names of 61+ characters. Kept: case (`true True TRUE`), `_a1`, `x2`, `__proto__x`, 60 characters. Offsets are exact. |
| WT-2 | Perfect Adaptive lesson | PASS | 11 words, each sample `[150, T0]`, one per occurrence |
| WT-3 | Stop-on-error on | PASS | An error inside `next_node` makes that occurrence `[0, ts]`. An error on the character after `min` leaves `min` clean. |
| WT-4 | Stop-on-error off, wrong key left | PASS | Same pattern (`int`, `max`) |
| WT-5 | Stop-on-error off, wrong key, Backspace, retype | PASS | `add` is a miss; the words around it are clean |
| WT-5b | Clean double Backspace inside a word, then retype | PASS | `word_count` is `[217, ts]`: clean and timed |
| WT-6 | Untimed and averaged speed | PASS | A 3001 ms gap inside a word gives `-1`. Increasing deltas give their mean (250). |
| WT-7 | Lines records | PASS | Exact match with expected samples |
| WT-8 | My code records | PASS | Two chunks match. `__proto__` is not recorded; `constructor` and `toString` are normal words. |
| WT-9 | Warmup | PASS | `tokens` unchanged |
| WT-10 | Words mode | PASS | `ctt.v1` is byte-identical after 2 Words lessons. `ctt.words.v1` has no `tokens`, and the Words focus line has no words. |

### Caps, ranking and lesson content

| ID | Area | Result | Evidence |
| --- | --- | --- | --- |
| WT-11 | Caps and prune (engine) | PASS | Per word: 20 records keep 10. A miss is `0`; `null`/`NaN` speeds are `-1`; 0.3 ms becomes `1`. Not recorded: 61 characters, `__proto__`, `a`. Word cap: 212 live words become 200, dropping the oldest. Expired words and samples go, non-arrays are removed. The sample at exactly 21 days is kept; 1 ms older is dropped. |
| WT-12 | Caps through the app | PASS | Fixture: 200 words, a 40-sample word, an expired word. After load, 200 words. After a lesson, still 200: all lesson words present, the oldest dropped, the 40-sample word cut to 10. |
| WT-13 | `troubleWords` / `drillWords` | PASS | Ranking: exact order and scores; 0.2 counts as drilled; at most 5 drills; default limit 8. Empty results: `[]` for a Words state; inherited `toString` gives n=0. Locked `_`: `allowed` without `_` gives `['Blorpy']`. `plan()` gives `['Blorpy']` at 4 unlocked and all 3 words at 6. |
| WT-14 | Adaptive mixing and locked symbols | PASS | 200 lessons each at 6, 12 and 26 unlocked, learn and review: no locked symbol, no placeholder, keywords (`None`, `self`, `return`) never wrapped. With `_` locked (4 unlocked) and trouble words `max_len __init__ is_valid Blorpy`: plan.words is `['Blorpy']` and 0 of 200 lessons contain `_`. |
| WT-15 | Templates and Lines weighting | PASS | 171 templates and 88 lines, each template filled 40 times: no leftover § ¤ ¶. The 4 changed templates are present, `nonlocal §; § += 1` is gone, `WORD_WRAP` matches the spec, and there are no duplicates. Lines with `nonlocal` rise from 3.3% to 12.3% of lessons when it is a trouble word; `ListNode` lines from 10.0% to 34.3%. A wrong-case word gives no boost. |
| WT-21 | The app mixes in a trouble word | PASS | `Blorpy` (3 misses) appeared in 17 of 40 Adaptive lessons; the focus line shows `words <b>Blorpy</b>` |
| WT-22 | O-1 re-measure | PASS | Trouble-word share of pushed chunks (table below). No locked symbols and no placeholders. |
| WT-23 | O-2: numbers next to letters | PASS | `x = 1e5`, `n = 0x1f` and `z = 2j` give no words (no `e5`, `x1f`, `j`). `x1 = 10` gives `x1`. `abc = 1e5 + x1 + 0xff + val2` gives `abc x1 val2`. `nums[0]` gives `nums`. `a1b2 3c4d` gives `a1b2`. Offsets are exact. |

WT-22 measured shares, 200 lessons per cell:

| Unlocked | Learn (target ~7.4%) | Review (target ~13%) |
| --- | --- | --- |
| 6 | 7.5% | 13.1% |
| 12 | 9.4% | 12.9% |
| 26 | 8.7% | 14.1% |

The targets follow from one roll per pushed chunk: p/(1+p) = 0.08/1.08 ≈ 7.4% in learn and
0.15/1.15 ≈ 13% in review. Before the O-1 fix, 6-unlocked review measured 41.6% and 12-unlocked
review measured 20.8%.

### Saves, stats and report

| ID | Area | Result | Evidence |
| --- | --- | --- | --- |
| WT-16 | `store.merge` with malformed tokens | PASS | Bad `tokens` values (null, [], 'x', 5, true, {}, undefined) all give `{}`. Bad keys are dropped, including a 200,000-character key and `__proto__`. Bad samples are dropped: old `{ok,ms,ts}` objects, non-pairs, strings, `-5`, and ts more than 1 day ahead. Extra elements are trimmed. Samples are sorted by ts, and the caps apply (10 samples per word, the newest 200 words). The prototype is untouched. Ranking and the report do not throw. |
| WT-17 | `__proto__` | PASS | Never recorded, never merged; the prototype stays `Object.prototype` |
| WT-18 | Boot with the WT-16 save | PASS | No console errors; Stats renders; a lesson saves cleaned tokens (6.1 KB `ctt.v1`) |
| WT-19 | Old save; export then import | PASS | A save with no `tokens` loads as `{}`. A lesson adds 8 words. The export contains all 8. Clear, then import: tokens are byte-identical. |
| WT-20 | Stats, report, focus line | PASS | Stats empty states: "Needs 3+ samples per word." and "No trouble words: every word is clean and at target speed." Populated: 5 rows, worst first, with `← in drills` at score ≥ 0.2. The list is hidden in Words stats. The report section has a table, or "Not enough data yet." The Adaptive focus line shows the top 3 words. |

## Remaining observation (informational, already at HEAD)

O-3: some templates contain no trained symbol, so Adaptive never emits them (`if (!syms.size)
continue`): `return §`, `not §`, `§ and §`, `§ or §`, `§ ^ §` and `§ is None`. This is unchanged
from HEAD.

## Regression

On the final snapshot, all 134 runner IDs from `sidecar-tests.js` and `extras-tests.js` passed
(134/134). On the previous snapshot `f808fa6`, the same 134 IDs passed on both the build and HEAD
(134/134 each).

Artifacts were compared against HEAD on snapshot `f808fa6`. The changes since then are only the
O-1 roll in `content.js` and the O-2 check in `wordSpans`.

- **Equal to HEAD once `tokens` is removed:** `ex4`, `ex7`, `we12`, and `wc6-TT/TF/FT/FF`. The only
  difference is the new main-save field, which is expected.
- **MG-5 and XV-5 hashes:** they differ only by:
  - `"tokens":{}` (+12 bytes),
  - `,"words":[]` in `plan` (+11 bytes),
  - the new report section.
- **MI-run-A/B/C and MI-folder-A/B/C:** they differ because the new templates and Lines change
  random lesson content. With HEAD's `content.js` on the new build, they equal HEAD except for
  `tokens`, the report section, a blank chart image from the hidden pane, and the startup
  `savedAt` (wall time).
- **EX-2 and XV-6a:** they type unseeded random lessons, so their artifacts differ between any
  two runs. They are informational only.

Conclusion: no real regression. Every difference from HEAD comes from the new `tokens` field, the
new report section, `plan.words`, or the new template and line content.
