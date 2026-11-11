# Settings tabs and Words extras: test results

Baseline `HEAD` = `777f92f` (Words mode with a separate save). Build under test:
the uncommitted working tree, coordinator's **snapshot B**
(`git diff HEAD -- js index.html css server.py | sha1sum` =
`7255b1f2b89ce5c022b543b08ea10c182f1b0213`; app.js `d3f63c63`, words.js `b7ab6cf7`,
store.js `c255378d`, index.html `2b7260a3`, style.css `91920b5b`; sync, files, report,
engine and server.py unchanged from HEAD). The tree was checked unchanged after the last
test. Run date 2026-11-11, Chromium (Claude desktop browser pane).

## Summary

| Group | IDs | PASS | FAIL | SKIP |
| --- | --- | --- | --- | --- |
| Runner suite on the new build (one final pass, 108 regression + 25 new IDs) | 133 | 133 | 0 | 0 |
| MI comparisons with HEAD (gist, server, folder, variants A/B/C) | 12 | 12 | 0 | 0 |
| Server and swap tests outside the runner (SV-1..5, XV-1..4, XV-7) | 10 | 10 | 0 | 0 |
| Static review (RV-1..6) | 6 | 6 | 0 | 0 |
| Manual (FS-3, release-gate GitHub smoke) | 2 | 0 | 0 | 2 |

**No FAIL against the build under test.** All failures seen during the work were test
artifacts, fixed in the test files as legitimate UI/format changes (listed below), after
which every ID was re-run on the final tree.

## How to run

As in `sidecar-results.md`, plus `extras-tests.js`:

- Copy a build into scratch; in its `index.html` insert `t/sidecar-pre.js` before
  `js/layout.js` and `t/sidecar-harness.js`, `t/cross-version.js`, `t/sidecar-tests.js`,
  `t/extras-tests.js` after `js/app.js`.
- Point `TP.MOCK` in the scratch copy of `sidecar-pre.js` at the mock port (this run:
  static servers 8821 HEAD, 8822 new, 8824 swap, 8825 `913c3b7`; `server.py` copies with
  only `PORT` changed: 8830 HEAD, 8831 new, 8832 new page + `913c3b7` server; mock gist
  `python sidecar-mock-gist.py 8899 <out>`). The repo `server.py` (8765) and repo `data/`
  were never used; no real GitHub call was made.
- `T.run([...ids], label)` in the page; results land in `<out>/results-<label>.json`.
- `T.build` is `'new'` on builds with the tabbed dialog and `'head'` otherwise; artifacts
  (`mi-*`, `ex4-*`, `wc6-*`, ...) are named with it.

## Environment notes

- The browser pane was hidden during the run, so `requestAnimationFrame` never ran. Chromium
  dispatches a dialog's `close` event on the next animation frame, so it never arrived
  after `dialog.close()`, after a real **Esc** key, or after a real click on **Done**
  (checked: the dialog closed, `open === false`, but 0 `close` events after 2 s).
  `T.closeSettings()` dispatches one when none arrived, as before. This is an environment
  limit, not an app defect.
- `Date.now` is frozen per test; `new Date()` is not, so `Generated:` lines in reports and
  the page's startup save (before the runner freezes the clock) carry wall time.
- Canvas data URLs depend on the pane size; MI comparisons were made from runs in the same
  pane size (an earlier pair differed only in `chart` size, 704x260 vs 880x325).

## Expected difference from HEAD (coordinator item 2)

HEAD re-saves main whenever Settings closes in a symbol mode, even with no change. The new
build saves main only when a main setting changed. In the MI script this removes exactly
two HEAD saves: after `T.connect()` (dialog closed in Adaptive) and after the final
Export (dialog closed in Lines). Consequences, all checked:

- Every main request, server body and folder record the new build makes is byte-identical
  to HEAD's, in order; HEAD only has the extra no-change saves.
- Final `ctt.v1` differs from HEAD's only in `savedAt` (HEAD: `T0+9min`, the close; new:
  `T0+8min`, the last lesson). The new `ctt.v1` equals HEAD's `.prev` byte for byte
  (sha1 `27e090a701`), so `.prev` differs by one rotation.
- Persisted gist/server/folder main files differ only in `savedAt`; reports differ only in
  the `Generated:` line.

## Test-file changes (legitimate UI/format changes)

`sidecar-harness.js`
- `T.isNewTabs` (tabbed dialog present) and `T.build` (artifact label). Before, the label
  used `T.isNew`, which is also true on `777f92f`, so HEAD and new artifacts overwrote
  each other.
- `T.FW` fixture prefs include `caps: 0, nums: false, punct: false` on tabbed builds. Without
  them the stored fixture string differed from the merged copy the app pushes, which
  failed raw-string comparisons in WS-1, WS-3, WS-4.1-3, WS-14a, WC-1, WC-2, WC-5t, WC-8
  (the pushed Words file was the fixture plus the three default prefs, which is correct).

`sidecar-tests.js`
- `wBtn(id)`: Words reset/unlock use `#sResetWords` / `#sUnlockWords` when present (EX-6,
  EX-8, FX-5f).
- EX-6, FX-5b compare prefs including `caps/nums/punct` defaults.
- EX-7: new confirm text `Reset symbol progress and stats? Words mode progress is not
  affected. Export first if you want a backup.` on the new build.
- FX-5a rewritten for the tabs: opens on the Words tab, `#sWordsLen` = 85, `#sLen` = main
  length, `Unlock next letter`, `Reset Words progress`, symbol buttons keep their own
  labels, `#sLenLabel` gone. FX-5b uses `#sWordsLen` (extras off, so the length window
  still applies).
- MG-6: its "first save" trigger was a Settings open/close; that no longer writes main
  (item 2), so the first save is now a symbol lesson. Result unchanged: saved mode
  `adaptive`.
- SCRIPT_MAIN variant **C** (= B with Capitals Often, Numbers and Punctuation turned on in
  the Words tab before the three Words lessons); IDs `MI-run-C`, `MI-srv-C`, `MI-folder-C`.

New file `extras-tests.js`: ST-*, WX-*, WL-* below.

## A. Regression

### Main byte identity (MI)

New A/B/C against HEAD A (and HEAD B for B/C) from the final pass; sha1 first 10.

| ID | Result | Evidence |
| --- | --- | --- |
| MI-1 | PASS | `ctt.v1` new `27e090a701` = HEAD `5a86a212ef` except `savedAt`; new `ctt.v1` = HEAD `.prev` exactly (expected difference above) |
| MI-2 | PASS | B and C (3 Words lessons in between; C with all extras): same as A |
| MI-3 | PASS | main requests HEAD 15, new 13 (A, B, C); new list is an exact in-order subsequence of HEAD's; HEAD-only = PATCH #5 (after connect) and #14 (after the final close) |
| MI-4 | PASS | B, C: 3 Words PATCHes, each `files` = `[code-typing-trainer-words.json]`; no main body names it; no `null` |
| MI-5 | PASS | mock main = HEAD except `savedAt`; report = HEAD except `Generated:`; B/C gist files main, report, words |
| MI-6 | PASS | export text byte-equal to HEAD (A, B, C); no Words fields |
| MI-7 | PASS | A: Copy/Download report = HEAD |
| MI-8 | PASS | B, C: report = HEAD's + `## Words mode (separate from the symbol stats)` section; gist report has none |
| MI-9 | PASS | practice DOM and Stats DOM (incl. chart) equal to HEAD for A, B, C |
| MI-10 | PASS | B and C: `ctt.v1`/`.prev` unchanged across the Words-tab changes and 3 Words lessons; 0 main requests, server or folder main writes; C sidecar prefs `{35, 70, caps 2, nums, punct}`; C lesson texts had capitals, numbers, punctuation (`note Nearest title attention her Rent 1024 He, Noi...`) |
| MI-11 | PASS | HEAD page+server (8830) vs new+new (8831), clean data and storage per variant. `progress` POST bodies: A HEAD 18 / new 17, B HEAD 19 / new 18, C 18; the new bodies equal HEAD's in order except the startup body (wall time) and HEAD's final no-change re-save. `data/progress.json` equal except `savedAt`; `report.md` except `Generated:`. B/C add only `{"words":...}` POSTs (3 / 6) |
| MI-12 | PASS | folder stub: HEAD 38 records, new 36 (A, B, C). Records 0-1 startup (wall time); records 2-35 equal; HEAD 36-37 = final no-change re-save (only `savedAt` differs, +60000). B/C add only `words.json` (3 / 6) |

### Runner IDs (final pass on the new build, 133/133)

All IDs from `sidecar-results.md` were re-run: WS-1..14b, WC-1..8 (incl. WC-6-TT/TF/FT/FF),
XV-5, XV-6a, LS-1.1..12, LS-2..8, FS-1, FS-2, EX-1..8, MG-1..6, FX-3a..6c, WE-1..13
(incl. WE-8 x4, WE-11ref), MI-run-A/B/C, MI-folder-A/B/C. Evidence matches the previous
run except where noted:

| ID | Result | Note |
| --- | --- | --- |
| WS-1..WS-14b | PASS | WS-7: main status `ok` before and after; WS-14a 256,786 bytes |
| WC-1..WC-8 | PASS | WC-6: `ctt.v1` equals HEAD's for FT/FF; for TT/TF it differs only in `savedAt` (HEAD re-saved at close after connect, T0; new keeps the local T0-1000) |
| XV-5 | PASS | `XV()` probe equal on HEAD and new (2d9efd1dad) |
| LS-* | PASS | as before |
| EX-4, EX-7, WE-12 | PASS | `ctt.v1` byte-equal to HEAD (2edde7f3ce, 3f3a66967e, e38336fead) |
| EX-6, EX-8 | PASS | via `#sResetWords`; prefs kept incl. extras defaults; EX-8 one Words-only PATCH |
| EX-7 | PASS | new confirm text; sidecar unchanged |
| MG-5 | PASS | merge output equal to HEAD (59985a0fce) |
| MG-6 | PASS | `closeSaved: false` (item 2), first lesson saves `mode: 'adaptive'` |
| FX-5a..f | PASS | rewritten for tabs (above) |
| FX-6a..c, WE-* | PASS | as before |

### Outside the runner

| ID | Result | Evidence |
| --- | --- | --- |
| SV-1 | PASS | new page + `913c3b7` server (8832): `/api/load` keys `ok, progress`; POSTs only `progress+report` 200; button "Auto-saving" |
| SV-2 | PASS | `server.py` is unchanged from HEAD (only line endings differ in the archive), so old page + new server is the HEAD case already covered; `SV-load` on 8831 returns `words: null` |
| SV-3 | PASS | 8831 B/C: every Words POST is exactly `{"words":...}` (3 / 6); `data/words.json` === `json.dumps(last posted sidecar, indent=1)` |
| SV-4 | PASS | `words.json` savedAt T0+1e9, unlocked 20, prefs `caps 1, nums`: adopted (20, savedAt kept, extras prefs kept); 0 Words POST; file unchanged |
| SV-5 | PASS | `{bad` + local savedAt > 0: one startup Words POST (200), file rewritten; `{bad` + empty local: 0 POST, file stays `{bad` |
| SV-6, SV-7 | PASS | SV-6 "Auto-saving" after a stubbed 500. SV-7 1,019,403 / 1,021,956-byte POSTs 200 (first attempt in a shared run used a `words.json` left by SV-6, which was newer and adopted; re-run alone with clean data) |
| XV-1 | PASS | 8824 new: F_SYN, 2 Adaptive, Lines, Words, 5 Words lessons (main 22, Words 5). Swapped to `913c3b7`: opens Lines, `ctt.v1` = d0, no errors |
| XV-2 | PASS | 2 old-page lessons: `ctt.words.v1`, `.prev`, `ctt.words.active` = d0 |
| XV-3 | PASS | swapped back: opens Words; sidecar = d0; main 22 -> 24 |
| XV-4 | PASS | `913c3b7` page on a gist with a Words file: 3 PATCHes list only progress+report; Words file unchanged |
| XV-7 (new) | PASS | new -> HEAD `777f92f` -> new on one origin. New: all extras on, 1 lesson. HEAD: loads the sidecar unchanged, opens Words, 0 of 30 HEAD texts have extras (HEAD ignores them), a HEAD lesson + HEAD Settings change (Words target 40) keep `caps 2, nums, punct`. Back on new: sidecar byte-equal to HEAD's last write, dialog shows the extras on, 10/10 texts have extras, focus note shown, no errors |
| FS-3 | SKIP | manual real-folder check |
| GitHub smoke | SKIP | needs a real throwaway account; real GitHub calls not allowed |

### Static review (RV)

| ID | Result | Evidence |
| --- | --- | --- |
| RV-1, RV-6 | PASS | `sync.js`, `files.js`, `report.js`, `engine.js`, `content.js`, `layout.js` unchanged from HEAD; Words PATCH body code unchanged |
| RV-2 | PASS | `store.js`: only the Words prefs defaults and their sanitizing (`caps` in {0,1,2}, `nums/punct === true`) |
| RV-3 | PASS | no new main-save path: `persist()` appears 12 times in app.js, as in HEAD; the only changed calls are in `readSettings` (now only when a main setting changed) and `sUnlock` (now always main, never the Words save) |
| RV-4 | PASS | removed app.js lines are only in `buildText` (extra arg), `adoptWords` dialog refresh, the `lastT` line, the Settings section and the Words branch of `sReset`; no removed lines in `persist`, `adoptRemote`, `pullGist`, `renderSync`, `syncFromFile`, `sExport` |
| RV-5 | PASS | `server.py` content unchanged |

## B. New tests

### ST: tabbed Settings

| ID | Result | Evidence |
| --- | --- | --- |
| ST-1 | PASS | each tab shows only its controls: General `sStop sSound sVol sKeymap sNext sFingers sToken sConnect sImport` (Sync now/Disconnect hidden while not connected; `sImportFile` hidden); Symbols `sFocus sTarget sLen sUnlock sExport sReset`; Words `sWordsTarget sWordsLen sWordsCaps sWordsNums sWordsPunct sUnlockWords sExportWords sResetWords`; no leaks, one section visible, `#sLenLabel` removed, Done visible |
| ST-2 | PASS | opening tab: Words -> words, Warmup -> general, Adaptive/Lines/My code -> symbols; also after switching to another tab and closing |
| ST-3 | PASS | Words mode, gist connected: 9 changes (target 47, length 110, caps 1/2/0, nums on/off, punct on/off) each applied to `ctt.words.v1` only; `ctt.v1`/`.prev` byte-unchanged; 0 main gist/server requests after 4.8 s; Words PATCHes list only the Words file |
| ST-4 | PASS | same in Adaptive mode |
| ST-5 | PASS | Words mode: Stop on error, target, length, focus style, sounds, finger colors each change `ctt.v1`; sidecar unchanged; main PATCH 1 (debounced), Words PATCH 0 |
| ST-5b | PASS | Lines mode: open/close, tab switching and an unchanged `sLen` change write nothing to main; 0 main requests |
| ST-6 | PASS | `sUnlock` in Words: main 14 -> 15, toast "Unlocked: -", sidecar unchanged. `sUnlockWords` in Adaptive: Words 12 -> 13, toast "Words: unlocked u", `ctt.v1` unchanged |
| ST-7 | PASS | `sReset` in Words: confirm "Reset symbol progress and stats? Words mode progress is not affected...", main 0 lessons, settings kept, sidecar unchanged, stays in Words. `sResetWords` in Adaptive: 0 lessons, unlocked 10, keys {}, prefs `{44, 90, caps 2, nums, punct}` kept, `ctt.v1` unchanged |
| ST-8 | PASS | Done button closes the dialog and the (unchanged-event) `sWordsLen` 150 is saved by the close path. Manual: real Esc key closes the dialog; with the close handler run, Words length 160 and punctuation saved, text regenerated ending in `.`/`?`, `ctt.v1` unchanged, no errors. (Close event delivery: see Environment notes) |
| ST-9 | PASS | no console errors, `error` events or rejections in any ST/WX/WL test (runner collects them per test) |
| ST-10 | PASS | old prefs `{41, 80}`: merged `{41, 80, caps 0, nums false, punct false}`; dialog Off/unchecked; 0 of 50 lessons with extras; no focus note |
| ST-11 | PASS | `caps` 3, -1, '2', 1.5, null, true, missing -> 0; 1 and 2 kept. `nums/punct` 'yes', 1, 'true', null, {} -> false. Stored garbage `{caps 7, nums 'yes', punct 1}` loads off; garbage Words import -> `{35, 200, 0, false, false}` |
| ST-12 | PASS | coordinator item 1. Words mode, dialog open, Sync now adopts a newer gist copy `{55, 150, caps 2, nums, punct}`, unlocked 15: dialog fields refreshed (`sWordsLen` 150, caps 2, both checked), `sLen` stays 70; after close the sidecar keeps the adopted prefs and savedAt; `ctt.v1` and `.prev` byte-unchanged; 0 main PATCH; toast "Loaded synced Words progress" |
| ST-12b | PASS | same from Adaptive mode |
| ST-13 | PASS | coordinator item 3. Main import with the dialog open (length 150, target 45, mixed, stop off): fields refreshed, saved values kept after close. Words import with the dialog open (`{60, 140, caps 1, nums, punct}`): fields refreshed, prefs kept after close |

### WX: Words extras

| ID | Result | Evidence |
| --- | --- | --- |
| WX-1 | PASS | 2,448 lessons (levels 10..26 x 12 combos x 12, lengths 30/70/120/200): 0 violations. Checked: letters only from the unlocked set (any case), digits, `.`, `, . ? ; :`, single spaces, no leading/trailing space; every token a number (`\d+(\.\d+)?`) or a real word (from the list) with an optional capital first letter and one trailing mark; no two numbers in a row, never a number last; no capitals/numbers/punctuation when off; with punct on the last token is a word ending in `.` or `?`; with caps on every word after `.`/`?` (no number between) is capitalized |
| WX-2 | PASS | 500 seeds: `text(..., {caps 0, nums false, punct false})` = `text(...)` without options = with full prefs object; all lowercase words and single spaces. (Comparison with `777f92f` output is not meaningful: the word list changed) |
| WX-3 | PASS | ~40,000 words per setting: caps Sometimes 0.149, Often 0.400; numbers per word 0.120; punctuation after non-final words 0.152; with caps + punct, 2,159/2,159 sentence starts capitalized |
| WX-4 | PASS | all extras, 131-char lesson with 22 errors (11 on capitals/digits/punctuation, 11 on letters): new hist entries only for a-z (101 = lowercase positions), 11 failed = letter errors; confusions only for lowercase keys (11); no uppercase/digit/punctuation keys or confusions; pairs unchanged; lesson `chars` 131 = text length, `errors` 22 = all error positions, `acc` = 1-22/131, `wpm` = chars/5/min; timed entries 84 = letters after a lowercase letter or a space (letters right after a capital, digit or mark untimed, item 4); `ctt.v1` unchanged, 0 main requests |
| WX-5 | PASS | capitals Often + punctuation, wrong-hand Shift held for each of 9 shifted characters (8 capitals + `?`/`:`): `shifted` 9, `sameHand` 9, metric shows 9 |
| WX-5b | PASS | correct-hand Shift: `shifted` 9, `sameHand` 0 |
| WX-6 | PASS | focus line ends with "extras not counted in letter stats" with numbers, capitals or punctuation on; absent with all off and in Adaptive |
| WX-7 | PASS | no lesson under way: punct on regenerates (ends `.`/`?`); target-only change keeps the text. Mid-lesson (3 keys typed): caps + length 150 keep the text and position; next lesson (Esc) has capitals, ends `.`/`?`, 158 chars. In Adaptive, a Words option leaves the Adaptive text alone |

### WL: word list

| ID | Result | Evidence |
| --- | --- | --- |
| WL-1 | PASS | 2,358 words, 2,358 unique, all `^[a-z]+$` (length 2..16) |
| WL-2 | PASS | usable at 10 letters: 219 (>= 150); per level 219, 314, 472, ... 2,358; every letter >= 25 (min `j` 40, `q` 44); newest letter usable at its unlock level: min 38 (`q`) |
| WL-3 | PASS | 10 letters: 500 plain + 500 all-extras lessons, 12,116 word tokens, 0 not in the list (no `fakeWord` fallback) |

## Findings for the coordinator

- No defects in snapshot B.
- The snapshot-A defect (Words adopt with the dialog open wrote Words `lessonLen` into
  `#sLen` and so into main) is covered by ST-12/ST-12b and does not occur in snapshot B.
- HEAD baseline note: on `777f92f`, WC-1 and WC-5t fail repeatably in this harness (no
  Words PATCH within 800 ms after connect). HEAD's no-change main re-save on dialog close
  queues a main PATCH, and the Words push waits behind it (WS-9 ordering). The new build no
  longer re-saves, so both pass. Not a regression.
