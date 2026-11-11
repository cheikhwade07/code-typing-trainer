# Words sidecar save: test results

Plan: `sidecar-testplan.md` (with the corrections listed at the end). Design:
`sidecar-design.md`. Baseline `HEAD` = `913c3b7`. Repo `<repo>`, scratch
`<scratch>`. Run date 2026-11-11, Chromium (Claude desktop browser pane).

## Build under test (authoritative run: snapshot 3)

| Build | `git diff HEAD -- js index.html css server.py \| sha1sum` | Files (sha1, first 8) |
| --- | --- | --- |
| **snapshot 3 (reported)** | `faa1385a40ab4c7d61efc25d89e223252ecd1de5` | app.js `3a62a205`, store.js `dcbf7c54`, sync.js `4d207291`, files.js `7cab34f8`, report.js `9273ae74`, engine.js `179b82c8`, words.js `2fc92695`, index.html `12da0e31`, server.py `778ce6d4` |
| snapshot 2 | `7e3e26e6d8362f1c803e7263c11dcbb18d9c37e0` | app.js `c09cbd42`, others as above |
| snapshot 1 | (not recorded) | app.js `11736c41`, store.js `dac37885`, sync.js `d0013579` |

Snapshot 3 differs from snapshot 2 in one line, `js/app.js:1130`: the Settings
`change` listener selector became `'input:not([type=file]), select'`. The tree
was checked unchanged against snapshot 3 after the last test.

Every test ID was run again on snapshot 3: the full browser suite (106 runner
IDs in one pass), the server, folder, cross-version and swap tests, and the
static review.

### Earlier runs and how their failures were resolved

| Run | Failures | Resolution |
| --- | --- | --- |
| snapshot 1 | MG-3b: no toast when a legacy import's Words part was skipped | Code: toast added in snapshot 2 |
| snapshot 2 | EX-3, EX-5: a Words import in a symbol mode re-saved main (`ctt.v1` savedAt, `.prev` rotation, main push). Cause: HEAD's Settings `change` listener also fired on the hidden `#sImportFile` and called `persist()` | Code: listener now skips file inputs (snapshot 3) |
| snapshot 2 | MG-1: seeded Words `savedAt` was `1`, the plan expected the legacy savedAt | Plan: `savedAt = 1` is intended ("any real copy wins"); MG-1 row and design section 7 updated |
| both | Harness artifacts (async toast capture, missing dialog `close` event, stale origin/server state, EX-1 extra "export = stored" check) | Harness fixed; see Environment |

## Environment

- Scratch copies only. Static no-store servers: 8801 HEAD, 8802 new (device A),
  8803 new (device B), 8804 same-origin swap. `server.py` copies with only `PORT`
  changed: 8810 HEAD server + HEAD page, 8811 new + new, 8812 HEAD server + new
  page, 8813 new server + HEAD page. Each copy has its own scratch `data/`, cleared
  together with the origin's storage before each server test. The real server
  (8765) and the repo `data/` were never used. F_REAL is `git show HEAD:data/progress.json`
  copied to scratch (read only).
- Mock gist API: `sidecar-mock-gist.py` on 8898. `sidecar-pre.js` reroutes
  `https://api.github.com` to the mock and blocks every other external
  request; no real token or GitHub call was used.
- Test files: `sidecar-pre.js` (loaded before the app in a scratch copy of
  `index.html`), `sidecar-harness.js` (fixtures, helpers, a runner that keeps
  state in sessionStorage across reloads), `sidecar-tests.js` (one entry per
  test ID), `sidecar-mock-gist.py`; `cross-version.js` (existing) gives `XV()`.
- To rerun: copy a build into scratch, insert `t/sidecar-pre.js` before
  `js/layout.js` and `t/sidecar-harness.js`, `t/cross-version.js`,
  `t/sidecar-tests.js` after `js/app.js`, start the mock
  (`python sidecar-mock-gist.py 8898 <scratch>/out`) and a static server, then
  call `T.run([...ids], label)` in the page. Results and artifacts are written to
  `<scratch>/out`.
- Harness notes:
  - The browser pane never delivered the dialog `close` event after a scripted
    `dialog.close()`. `T.closeSettings()` dispatches one when none arrived, so
    `readSettings` runs as after a user close. Same harness on HEAD.
  - Toasts are captured synchronously through a `textContent` setter on `#toast`.
  - `Date.now` is frozen per test; `new Date()` is not patched (same on both builds).
  - A page's startup save happens before the runner can freeze the clock, so MI-11
    and MI-12 compare from the first frozen save.

## Summary

111 test IDs: **109 PASS, 0 FAIL, 2 SKIPPED**.

| ID | Result | Reason |
| --- | --- | --- |
| FS-3 | SKIPPED | Manual check with a real folder picker; this environment cannot automate it |
| Release-gate GitHub smoke | SKIPPED | Needs a real throwaway GitHub account and token; real GitHub calls were not allowed |

One expected consequence of the snapshot 3 fix, accepted under the corrected
MI-11/MI-12 rows: while importing, HEAD wrote one extra save of the unchanged
pre-import state. The new build no longer writes it. Every later write is
byte-equal, and the final files and `ctt.v1` / `.prev` are equal (details in
MI-11, MI-12, EX-4).

## 1. Static review (RV)

| ID | Result | Evidence |
| --- | --- | --- |
| RV-1 | PASS | Removed lines in sync/files/report: only `-  CTT.REPORT = { build };`. `CTT.SYNC` / `CTT.FILES` only gained lines |
| RV-2 | PASS | store.js removed lines: only the `CTT.STORE = {...}` export; `merge` gains exactly `raw = stripLegacy(raw);` |
| RV-3 | PASS | Matches: `stripLegacy` (store.js:278-298) and its comment (273-274), `app.js:10 STORE.wordsActive()`, `store.js:252 function wordsActive()`, the `CTT.STORE` export (311). No other use |
| RV-4 | PASS | No removed lines in `persist`, `lessonCount`, `adoptRemote`, `pullGist`, HEAD `visibilitychange`, `renderSync`, `syncFromFile`, `sExport`. The folder-startup `if (s === 'granted') await syncFromFile();` removal is allowed by design 3.7. The listener selector change at app.js:1130 is outside these regions |
| RV-5 | PASS | server.py: removed lines are the docstring line and the `/api/load` return; write lines unchanged |
| RV-6 | PASS | The only Words PATCH body is `{ files: { [WFILE]: { content } } }` (sync.js:223); no `null` file values |

## 2. Main byte identity (MI)

HEAD 8801 against new 8802 with the mock gist, unless noted. sha1, first 10 hex digits.

| ID | Result | Evidence |
| --- | --- | --- |
| MI-1 | PASS | A: `ctt.v1` 5a86a212ef = HEAD; `.prev` 27e090a701 = HEAD |
| MI-2 | PASS | B (3 Words lessons in between): same hashes as HEAD |
| MI-3 | PASS | main requests 15 = 15, `{method,url,body}` hash 26a4c569e4 for HEAD, A and B (the debounced push hides the import re-save) |
| MI-4 | PASS | B: Words requests GET + 3 PATCH, each `files` = `["code-typing-trainer-words.json"]`; no main PATCH lists it; no `null`; mock deletes `[]` |
| MI-5 | PASS | mock main 5a86a212ef and report 1455e20c6f = HEAD (A and B); B gist files = main, report, words |
| MI-6 | PASS | export `code-typing-trainer-backup-2026-11-11.json`, text ae1ccc56eb = HEAD (A and B); no Words fields |
| MI-7 | PASS | A: Copy report and Download report 1455e20c6f = HEAD |
| MI-8 | PASS | B: clipboard = HEAD report + `\n## Words mode (separate from the symbol stats)...`; persisted gist report has no Words section |
| MI-9 | PASS | DOM 8dacdd1c72, Stats DOM bf3453bc4f = HEAD (A and B); XV-5 probe all equal |
| MI-10 | PASS | B: `ctt.v1`/`.prev` unchanged across 3 Words lessons; 0 main requests, server or folder main writes during them |
| MI-11 | PASS | HEAD page + HEAD server (8810) against new + new (8811), clean data and storage. `progress` POST bodies: HEAD 19, new 18; the only difference is HEAD's first frozen POST (pre-import state, 0 lessons, savedAt T0), absent after the fix; the remaining 18 equal in order. `data/progress.json`, `data/report.md` equal by `cmp` for A and for B. B adds only 3 `{"words":...}` POSTs |
| MI-12 | PASS | Folder stub: HEAD 40 records, new 38 (`progress.json`/`report.md`). HEAD records 0-1 (startup, unfrozen) and 2-3 (pre-import re-save, 0 lessons) against new 0-1 (startup); from HEAD record 4 / new record 2 on, all 36 are equal. B adds only `words.json` (3 records) |

## 3. Words gist sync (WS)

| ID | Result | Evidence |
| --- | --- | --- |
| WS-1 | PASS | 1 Words PATCH; remote = local sidecar; `ctt.v1` unchanged |
| WS-2 | PASS | 0 PATCH; adopted, savedAt kept; toast "Loaded synced Words progress"; strip 14 |
| WS-3 | PASS | gist 3 files; main and report byte-unchanged; Words file = local |
| WS-3b | PASS | after 6 s: only a Words GET |
| WS-4 | PASS | `{not json`, `[]`, `{"kind":"other"}`: 1 PATCH each; remote = local |
| WS-4b | PASS | remote stays `{not json`; 0 PATCH |
| WS-4c | PASS | truncated + raw 500: `wordsStatus` `error`; no adopt, no PATCH |
| WS-5 | PASS | `v:99`, `future:{x:1}` preserved through a lesson and push; 13 lessons |
| WS-6 | PASS | only `GET /gists/1`; no sidecar written |
| WS-7 | PASS | 1 PATCH; `wordsStatus` `auth`; main status `ok` before and after; info "Words mode sync: GitHub refused the token."; `ctt.v1` unchanged |
| WS-8 | PASS | statuses syncing, error, syncing, error, syncing, ok; final remote = snapshot |
| WS-9 | PASS | Words PATCH starts after the main PATCH ends; both final contents latest |
| WS-10 | PASS | main PATCH `[409, 200]`; contents latest; status `ok` |
| WS-11 | PASS | remote FW(20) adopted; 0 Words PATCH after 6.5 s |
| WS-12 | PASS | two `visibilitychange` 10 s apart: 1 Words GET, 1 main GET |
| WS-13 | PASS | disconnect within 4 s: 0 Words PATCH afterwards |
| WS-14 | PASS | ~257 KB truncated file: 14a local newer, 1 raw fetch, 1 PATCH; 14b remote newer, adopted (26), 0 PATCH |

## 4. Connect flows (WC)

| ID | Result | Evidence |
| --- | --- | --- |
| WC-1 | PASS | POST files `[progress, report]`, main = HEAD `defaults()`; 1 Words PATCH; mock 3 files; 0 confirms |
| WC-2 | PASS | main adopted (20 lessons); sidecar unchanged and pushed; 0 confirms |
| WC-3 | PASS | both adopted, savedAt preserved; 0 confirms (remote Words written into the mock directly, as the corrected row allows) |
| WC-4 | PASS | unlocked 14, 0 confirms |
| WC-5 | PASS | one Words confirm; OK keeps local (14) and pushes; Cancel adopts remote (10) |
| WC-6 | PASS | TT/TF/FT/FF: main then Words confirm; results as answered; `ctt.v1` = HEAD's for the same main answer (TT, FT checked against HEAD artifacts) |
| WC-7 | PASS | token cleared; toast "GitHub refused that token"; 0 Words requests |
| WC-8 | PASS | Words file `{bad`: local pushed; 0 confirms |

## 5. Old page and cross-version (XV)

| ID | Result | Evidence |
| --- | --- | --- |
| XV-1 | PASS | 8804, new build: F_SYN, 2 Adaptive, Lines, Words, 5 Words lessons (main 22, Words 5). Swapped to HEAD: Lines button and `state.mode` `lines`, symbol strip `()[]_:="',.{}+-<>!#*`, `ctt.v1` = d0, no errors |
| XV-2 | PASS | 2 HEAD Adaptive lessons: `ctt.words.v1`, `.prev`, `ctt.words.active` = d0 |
| XV-3 | PASS | swapped back: opens Words; sidecar = d0; main 22 -> 24 |
| XV-4 | PASS | HEAD device on a gist with a Words file: 3 PATCHes list only `[progress, report]`; Words file unchanged |
| XV-5 | PASS | `XV()` on 8801 and 8802: all 27 keys equal |
| XV-6 | PASS | `ctt.v1` saved by the new build (MG-1 + 1 lesson) loaded into HEAD, 1 lesson: keys and settings keys = HEAD `defaults()`; mode `lines`; 21 -> 22 lessons; no errors |

## 6. Local storage (LS)

| ID | Result | Evidence |
| --- | --- | --- |
| LS-1 | PASS | 12 values: no errors; `ctt.v1` unchanged after load and a Words lesson; invariants hold; unparsable values copied to `.unreadable` |
| LS-2 | PASS | `.prev` FW(14): 14 at load; after 1 lesson 13 lessons, unlocked 15 (corrected row: `>= 14`) |
| LS-3 | PASS | one `ctt.words.v1.unreadable` key |
| LS-4 | PASS | `setItem` throws for `ctt.words*`: no errors; `ctt.v1` updated; removed only `ctt.words.v1.prev`, `ctt.words.active` |
| LS-5 | PASS | quota: first failing write `ctt.words.v1`; removed only `ctt.words.v1.prev` |
| LS-6 | PASS | localStorage getter throws: a symbol and a Words lesson complete; no errors |
| LS-7 | PASS | 1000 kept; newest last; oldest dropped |
| LS-8 | PASS | Words: flag `'1'`, reload opens Words; Adaptive: flag removed, reload opens Adaptive; `ctt.v1` unchanged by the Words click |

## 7. Server and folder (SV, FS)

| ID | Result | Evidence |
| --- | --- | --- |
| SV-1 | PASS | 8812 (new page + HEAD server): `/api/load` keys `ok, progress`; POSTs only `progress+report` (200); Words lessons kept locally; no `data/words.json`; button "Auto-saving" |
| SV-2 | PASS | 8813 (HEAD page + new server): `/api/load` has `words: null`; same seeded script as 8810 (HEAD + HEAD): `data/progress.json`, `report.md` equal by `cmp` |
| SV-3 | PASS | 8811 B: Words POSTs are exactly `{"words":{...}}`; `data/words.json` === `json.dumps(last posted sidecar, indent=1)` |
| SV-4 | PASS | `words.json` savedAt +1e9, unlocked 20: adopted on reload (savedAt 1795416460000, unlocked 20); no Words POST; file hash unchanged |
| SV-5 | PASS | `{bad` + local savedAt > 0: startup Words POST (200), file rewritten. `{bad` + empty local sidecar: no Words POST, file stays `{bad` |
| SV-6 | PASS | Words POST stubbed to 500: button "Auto-saving" after the Words and the symbol lesson; main POSTs 200 |
| SV-7 | PASS | 1,021,884-byte Words POST: 200 |
| FS-1 | PASS | 2 Words lessons, 2 `words.json` writes = `JSON.stringify(sidecar, null, 1)` |
| FS-2 | PASS | newer `words.json` at startup: adopted (16, savedAt kept); no `words.json` write |
| FS-3 | SKIPPED | manual real-folder check |

## 8. Export, import, reset, migration (EX, MG)

| ID | Result | Evidence |
| --- | --- | --- |
| EX-1 | PASS | `code-typing-trainer-backup-2026-11-11.json`, no Words fields; byte identity in MI-6 |
| EX-2 | PASS | `code-typing-trainer-words-backup-2026-11-11.json`; text = `JSON.stringify(T.sw(), null, 2)`; no `order`/`settings` |
| EX-3 | PASS | Adaptive mode, main F_SYN present: sidecar = `mergeWords(file)` except savedAt (re-stamped, +5000), toast; `ctt.v1` and `.prev` unchanged; 0 main requests |
| EX-3f | PASS | same on a fresh origin: `ctt.v1` and `.prev` unchanged; 0 main requests |
| EX-4 | PASS | main import: `ctt.v1` = HEAD's after the same import (2edde7f3ce); sidecar unchanged |
| EX-5 | PASS | garbage: toast "Could not read that file"; junk Words file sanitized (0 lessons, keys `{}`, focusRun null, cooldown `{}`); `ctt.v1` unchanged by the junk Words file (also unchanged by the garbage file now) |
| EX-6 | PASS | Words reset confirm "... The symbol progress is not affected ..."; 0 lessons, prefs `{44, 90}` kept; `ctt.v1` unchanged |
| EX-7 | PASS | HEAD confirm text; `ctt.v1` = HEAD's (3f3a66967e); sidecar unchanged |
| EX-8 | PASS | after Words reset: exactly 1 PATCH, Words file only |
| MG-1 | PASS | `ctt.v1` unchanged by load; mode `lines`; seeded 12 lessons, target 40, savedAt 1; no legacy fields after a symbol lesson |
| MG-2 | PASS | existing sidecar unchanged |
| MG-3 | PASS | 3a: main imported clean (mode lines), sidecar seeded (12, 40). 3b: non-empty sidecar kept, toast "Progress imported. Words progress in this file was not imported; use a Words export" |
| MG-4 | PASS | legacy main from the gist adopted; next main push has no legacy fields; Words seeded and pushed |
| MG-5 | PASS | `merge` output for F_SYN and F_REAL identical on HEAD and new (59985a0fce) |
| MG-6 | PASS | `mode`/`mainMode` `words`: shown Adaptive; first save `mode: 'adaptive'` |

## 9. Agreed fixes (FX)

| ID | Result | Evidence |
| --- | --- | --- |
| FX-3a | PASS | savedAt > 0, 0 Words lessons: Copy and Download report = `REPORT.build`, no Words section |
| FX-3b | PASS | 1 Words lesson: one `## Words mode` at the end; gist report has none |
| FX-3c | PASS | malformed sidecar: no throw; symbol report + Words section |
| FX-4 | PASS | Words opens `#statsWords` ("Letters (Words mode)"); symbol modes open `#statsSym`; reopen keeps Words |
| FX-5a | PASS | "Words lesson length (characters)" = 85, "Unlock next letter (Words)", "Reset Words progress", both target inputs |
| FX-5b | PASS | prefs `{50, 120}`; main unchanged; next lesson 120 chars |
| FX-5c | PASS | open/close in Words: `ctt.v1` unchanged, 0 main requests in 4.5 s |
| FX-5d | PASS | Sounds in Words: main `settings.sound` true -> false |
| FX-5e | PASS | Adaptive: lessonLen 100 saved to main; sidecar unchanged |
| FX-5f | PASS | Unlock in Words: 12 -> 13; `ctt.v1` unchanged |
| FX-6a | PASS | sentence lesson: `focusRun`, `cooldown`, `sinceUnlock` unchanged; only a-z keys; `pairs {}` |
| FX-6b | PASS | word lesson: `focusRun.lessons 4`, `cooldown.z 1`, `sinceUnlock 8` |
| FX-6c | PASS | 5 sentence lessons: no "Rotating off" toast |

## 10. Words engine on the sidecar (WE)

In every WE test: `ctt.v1` unchanged and 0 main requests.

| ID | Result | Evidence |
| --- | --- | --- |
| WE-1 | PASS | strip `etaoinsrhl` + 16 locked; 200 lessons with no letter outside the set |
| WE-2 | PASS | "New letter unlocked: d"; 11, sinceUnlock 0 |
| WE-3 | PASS | stall unlock to 13 |
| WE-3n | PASS | stays 12; Stats "u waits until d is back above 70%" |
| WE-4 | PASS | "Rotating off d for 3 lessons ..."; `cooldown.d 3`; next focus `h` |
| WE-4b | PASS | `focusRun {ch:'d', lessons:0}`, no cooldown |
| WE-5 | PASS | "Review passed: e (next in 3d)" after 4 lessons; level 2; due = T0 + 3 days |
| WE-6 | PASS | "Review missed: e is back to learning"; level 0, due null |
| WE-7 | PASS | "t has dropped below 90%, back to learning"; level 0 |
| WE-8 | PASS | Words target 100: no "solid"; 20: "a looks solid today" (main target 10 and 120 each) |
| WE-9 | PASS | next day: "Mastered: a (review tomorrow)", level 1 |
| WE-10 | PASS | covered by FX-6a |
| WE-11 | PASS | main focusStyle `mixed`: "Focus d ..."; `single`: "Learning d" |
| WE-12 | PASS | half Words lesson then Adaptive: sidecar unchanged; `ctt.v1` = HEAD's (e38336fead) |
| WE-13 | PASS | sidecar keys: kind, v, savedAt, prefs, unlocked, sinceUnlock, keys, confusions, pairs, cooldown, focusRun, lessons |

## Plan corrections applied to `sidecar-testplan.md`

- RV-3: the sidecar's own `wordsActive` API and the export line are allowed matches.
- EX-3: compare `mergeWords(file)` except `savedAt`; `ctt.v1` unchanged and no main request; run from a symbol mode. EX-5: `ctt.v1` checked only for the junk Words file.
- SV-5: a bad `words.json` is overwritten at startup when local savedAt > 0, left alone when the local sidecar is empty.
- LS-2: `unlocked === 14` at load; after a lesson `>= 14` (FW(14) is all-good).
- WE-5: a review pass needs about 22 correct attempts, about 3 lessons.
- FX-5a: label text "(characters)".
- MI-11 / MI-12: clear data and storage first; compare from the first frozen save; exclude HEAD's single pre-import re-save, which the EX-3 fix removed.
- WC-3: the remote Words copy may be written into the mock directly.
- MG-1 (coordinator's change): seeded `savedAt = 1`.
