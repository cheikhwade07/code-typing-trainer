# Words mode: sidecar save (design)

Status: proposal, not implemented. Baseline: `HEAD` = `913c3b7` (live version).
"Current build" = the uncommitted combined design (`state.words` inside the main
save). Repo is referred to as `<repo>`. Line numbers are HEAD line numbers.

## 1. Goal and guarantee

Words gets its own save. Nothing the Words feature does can change what is
persisted for the main (symbol) tool, because:

1. Words never writes through a main code path. It has its own localStorage
   key, its own gist file and pusher, its own server field, its own folder file.
2. Every main persisted artifact (localStorage `ctt.v1` + `ctt.v1.prev`, gist
   files `code-typing-trainer-progress.json` and `code-typing-trainer-report.md`,
   server `data/progress.json` + `data/report.md`, folder `data/progress.json` +
   `data/report.md`, Export JSON) is produced by HEAD's code, with HEAD's inputs:
   the main `state` object is in HEAD format again (no `words`, `mainMode`,
   `wordsActive`, `settings.wordsTargetWpm`, no `toJSON`).
3. A Words lesson never calls main `persist()`, so main `savedAt` is not bumped
   by Words. This removes the cross-device race in which Words typing on device
   B made B's stale main save "newest" and overwrote symbol progress from A.

Reviewer check: section 9 lists the HEAD functions that must be textually
unchanged; most can be checked with `git diff` showing no removed lines.

## 2. Data shapes and names

### 2.1 Main (unchanged, HEAD)

`STORE.defaults()` of HEAD. Key `ctt.v1`, backup `ctt.v1.prev`, unreadable
copies `ctt.v1.unreadable-<ts>`. `state.mode` is only ever `adaptive`, `lines`,
`mycode` or `warmup`. While Words is active, `state.mode` keeps the last symbol
mode, so any old copy of the app opens a symbol mode.

### 2.2 Words sidecar (new)

```js
{
  kind: 'ctt-words',          // marker: import detection, sanity check on remote copies
  v: 1,                       // Words format version (kept if a newer remote has a higher v)
  savedAt: 0,                 // own clock; newest-wins applies to Words only
  prefs: { targetWpm: 35, lessonLen: 70 },   // Words-only settings
  unlocked: 10, sinceUnlock: 0,
  keys: {}, confusions: {}, pairs: {}, cooldown: {}, focusRun: null,
  lessons: []                 // capped at 1000, same as main
}
```

Field set of the progress part is exactly the current `wordsDefaults()`, so
`js/engine.js` runs on it unchanged. Unknown top-level fields from a newer
version are kept on load/save (forward compatibility), except `order` and
`settings`, which are always dropped (runtime-only, see 2.3).

| What | Name |
| --- | --- |
| localStorage | `ctt.words.v1`, backup `ctt.words.v1.prev`, one unreadable slot `ctt.words.v1.unreadable` (overwritten, never accumulates) |
| Active-mode flag | localStorage `ctt.words.active` = `'1'` or absent. Device-local, not synced, not in any save |
| Gist file | `code-typing-trainer-words.json` (same gist, same token) |
| Server | `data/words.json` (new server only) |
| Folder mode | `data/words.json` in the chosen folder |
| Export file | `code-typing-trainer-words-backup-YYYY-MM-DD.json` |

Why the active flag is device-local: switching modes then never bumps any
`savedAt`, never triggers a push, and a Words sync can never flip another
device into Words mode. Main mode syncs as in HEAD (it is in the main save).

### 2.3 Engine view (runtime only)

`js/engine.js` reads `state.order` (via `ord()`), `state.settings.targetWpm` and
`state.settings.focusStyle`, and mutates `unlocked`, `sinceUnlock`, `focusRun`,
`cooldown`, `keys`, `confusions`. So the engine must run on the sidecar object
itself (a prototype-based view would put the mutations on the view). Keep the
current approach, moved to the sidecar:

```js
// app.js
function wordsView() {                       // replaces wordsState()
  const W = words;
  if (!Object.prototype.hasOwnProperty.call(W, 'order')) {
    Object.defineProperty(W, 'order', { value: WORDS.ORDER, enumerable: false, configurable: true });
    Object.defineProperty(W, 'settings', {
      get() { return { ...state.settings, targetWpm: this.prefs.targetWpm }; },
      enumerable: false, configurable: true,
    });
  }
  return W;
}
```

Non-enumerable properties are skipped by `JSON.stringify`, so they are never
persisted, pushed or exported. The getter reads main settings (focusStyle and
the rest) read-only; it returns a copy, so the engine cannot write into main
settings. Main engine outputs are unchanged because `state.order` is undefined
on the main state (`ord(state) === TRAIN`), already verified by the current
cross-version probe.

`REPORT.buildWords` builds its own read-only view (`Object.create(W)` plus
`order`/`settings` own properties), as the current `wordsSectionUnsafe` does.

## 3. Changes by file

### 3.1 `js/store.js`

Revert to HEAD, then:

- `merge(raw)`: insert exactly one line as the first statement:
  `raw = stripLegacy(raw);`. Body otherwise HEAD. For HEAD-format input
  `stripLegacy` returns the same object, so the output is HEAD's.
- `defaults`, `load`, `save`, `download`, `exportJson`: HEAD, textually.
- Remove `withSaveShape`, `wordsDefaults` inside main `defaults()`, the
  `wordsTargetWpm` default, `mainMode`, the Words lesson cap in `save`.
- Add (new functions, below the HEAD ones):
  - `wordsDefaults()` returns 2.2.
  - `mergeWords(raw)`: never throws (try/catch around `mergeWordsUnsafe`,
    fallback `wordsDefaults()`). Same sanitizing as the current `mergeWords`
    (unlocked integer 10..26, sinceUnlock finite >= 0, objects for maps,
    focusRun only a single a-z letter, lessons only with finite ts/wpm/acc, key
    hist filtered and ts-filled, level/due defaults). Plus: `savedAt` finite >= 0
    else 0; `prefs.targetWpm` clamp 10..150 default 35; `prefs.lessonLen` clamp
    30..200 default 70; `kind = 'ctt-words'`; `v = max(1, integer raw.v)`;
    unknown top-level keys copied through, `order`/`settings` deleted.
  - `loadWords()`: like HEAD `load()`: parse `ctt.words.v1`, else `.prev`; on a
    parse error copy the raw string to `ctt.words.v1.unreadable` and try
    `.prev`; else defaults. Never throws. Never reads or writes `ctt.v1*`.
  - `saveWords(w, keepSavedAt)`: `if (!keepSavedAt) w.savedAt = Date.now()`;
    cap `w.lessons` to 1000; write `.prev` then key in try/catch. On failure
    (quota): remove `ctt.words.v1.prev` and retry the key write once; then give
    up silently. Never touches `ctt.v1*`.
  - `wordsActive()` / `setWordsActive(on)`: read/write `ctt.words.active`,
    try/catch.
  - `exportWords(w)`: `download(name, JSON.stringify(w, null, 2), 'application/json')`.
  - `stripLegacy(raw)` and `takeLegacyWords()` (migration, section 7).
- Export: `CTT.STORE = { load, save, defaults, merge, exportJson, download,
  wordsDefaults, mergeWords, loadWords, saveWords, wordsActive, setWordsActive,
  exportWords, takeLegacyWords }` (HEAD keys first, unchanged; `defaults` is
  the plain HEAD function again).

### 3.2 `js/sync.js`

HEAD code textually unchanged. Append a Words section inside the same IIFE
(it needs `get`, `gh`, `fileContent`, `K_TOKEN`, `K_ID` and reads main
`inflight`), and append new keys to `CTT.SYNC`.

```js
const WFILE = 'code-typing-trainer-words.json';
let wStatus = 'idle';                  // idle | syncing | ok | auth | error (Words only)
const wListeners = [];
function setWStatus(s) { wStatus = s; wListeners.forEach((f) => f(s)); }

// { state: 'ok', data } | { state: 'missing' } | { state: 'bad' } | { state: 'unknown' } | null (not connected)
// Throws on network / auth errors from the GET, like pull().
async function pullWords() {
  const id = get(K_ID);
  if (!get(K_TOKEN) || !id) return null;
  setWStatus('syncing');
  try {
    const g = await gh('/gists/' + id);
    const f = g.files && g.files[WFILE];
    if (!f) { setWStatus('ok'); return { state: 'missing' }; }
    const text = await fileContent(f);           // raw_url when truncated
    if (text == null) { setWStatus('error'); return { state: 'unknown' }; } // never overwrite on this
    let data = null;
    try { data = JSON.parse(text); } catch (e) { /* bad */ }
    setWStatus('ok');
    return data && typeof data === 'object' && !Array.isArray(data) && data.kind === 'ctt-words'
      ? { state: 'ok', data } : { state: 'bad' };
  } catch (e) {
    setWStatus(e.auth ? 'auth' : 'error');
    throw e;
  }
}

let wPending = null, wTimer = null, wInflight = false;
function pushWords(words, delay) {
  if (!get(K_TOKEN) || !get(K_ID)) return;
  wPending = JSON.stringify(words);              // snapshot now; later replacement of `words` cannot leak in
  clearTimeout(wTimer);
  wTimer = setTimeout(flushWords, delay == null ? 4000 : delay);
}
function cancelWords() { wPending = null; clearTimeout(wTimer); }
async function flushWords() {
  if (!wPending || wInflight) return;
  if (!get(K_TOKEN) || !get(K_ID)) { wPending = null; return; }
  if (inflight) { clearTimeout(wTimer); wTimer = setTimeout(flushWords, 1000); return; } // main PATCH first
  const content = wPending;
  wPending = null;
  wInflight = true;
  setWStatus('syncing');
  try {
    await gh('/gists/' + get(K_ID), {
      method: 'PATCH',
      body: JSON.stringify({ files: { [WFILE]: { content } } }),   // only the Words file
    });
    setWStatus('ok');
  } catch (e) {
    setWStatus(e.auth ? 'auth' : 'error');
    if (!e.auth && !wPending) wPending = content;   // retry, like main
  } finally {
    wInflight = false;
    if (wPending) { clearTimeout(wTimer); wTimer = setTimeout(flushWords, 4000); }
  }
}
```

Appended to `CTT.SYNC`: `pullWords, pushWords, flushWords, cancelWords,
wordsStatus: () => wStatus, onWordsStatus: (f) => wListeners.push(f),
WORDS_FILE: WFILE`.

Decisions:

- PATCH semantics: GitHub only changes listed files; unlisted files are kept.
  Main PATCH lists main + report, so it never touches the Words file; Words
  PATCH lists only the Words file. Neither ever sends `null` for a file.
- Two pushers: Words defers while a main PATCH is in flight (reads main
  `inflight`, no change to main code). A main PATCH may still start while a
  Words PATCH is in flight. If GitHub rejects the overlap (409/5xx), HEAD's
  main `flush` already keeps `pending` and retries after 4 s, so main heals
  itself. Tests WS-9/WS-10 cover both orders.
- Words status is separate from main status: Words never calls main
  `setStatus`, never sets `ctt.gist.lastSync`. The header button keeps showing
  main sync status as in HEAD; Words sync problems are shown in a new line in
  Settings (`#wordsSyncInfo`) and as a toast on the first auth failure.
- `findOrCreate` and `connect` unchanged: a newly created gist has main +
  report only; the Words file appears on the first Words push. A gist without
  the Words file is the normal case for old gists (`state: 'missing'`).
- Offline: same as main, the snapshot is kept and retried every 4 s.
- Token revoked: Words stops (no retry), `wStatus = 'auth'`. Main detects it
  on its own next request, as in HEAD.
- Extra cost: one more GET per startup/refocus/Sync now, one more PATCH per
  Words lesson. Far under API limits.

### 3.3 `js/files.js`

HEAD code textually unchanged. Add one function with its own queue (so a slow
Words request can never delay a main save):

```js
let wordsQueue = Promise.resolve(true);
function serverSaveWords(words) {
  wordsQueue = wordsQueue.then(async () => {
    try {
      const r = await fetch('api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words }) });
      return r.ok;
    } catch (e) { return false; }
  });
  return wordsQueue;
}
```

Append `serverSaveWords` to `CTT.FILES`. Folder mode reuses `readJson` and
`write` (`words.json`); the shared folder write queue is acceptable because
`write` catches all errors and a folder write cannot hang in practice. Words
ignores the write result (never changes `fileState`).

### 3.4 `server.py`

Backward compatible in both directions; main writes byte-identical:

```python
def do_GET(self):
    if self.path == "/api/load":
        progress = read_json("progress.json")          # same try/except as HEAD
        words = read_json("words.json")
        return self._json(200, {"ok": True, "progress": progress, "words": words})
...
# do_POST, after the two HEAD write blocks (unchanged):
        if isinstance(body.get("words"), dict):
            write_atomic(os.path.join(DATA, "words.json"), json.dumps(body["words"], indent=1))
```

(`read_json` can be inlined twice to keep the HEAD lines; either way the
`progress.json` and `report.md` write lines stay textually identical.)

| Page / server | Result |
| --- | --- |
| old page, new server | `/api/load` has an extra `words` key the old page ignores; old POST bodies have no `words`; `progress.json`/`report.md` written as before. |
| new page, old server | `/api/load` has no `words` key, so the new page sets `serverWords = false` and never POSTs Words (no useless requests). Words still saves to localStorage and gist. |
| new page, new server | main POST `{progress, report}` exactly as HEAD; Words POST `{words}` only; separate request, so the 5 MB `MAX_BODY` is per file. |

`data/words.json`: decide whether it is committed like `data/progress.json`
(open question).

### 3.5 `js/report.js`

`build(state)`: HEAD, textually (remove the `wordsSection` call). Add
`buildWords(W, mainSettings, now)`: returns `''` when `W` has no valid
lessons, otherwise `'\n' + lines.join('\n')` with the current section text
(heading `## Words mode (separate from the symbol stats)`), wrapped in
try/catch returning `'\n## Words mode (separate from the symbol stats)\n\nWords section unavailable.\n'`.
Append `buildWords` to `CTT.REPORT`.

Where reports go:

- Persisted reports (gist report file, server `report.md`, folder `report.md`):
  `REPORT.build(state)` only, always byte-identical to HEAD. Words is never in
  a persisted report.
- Copy report / Download report (Stats): `combinedReport()` =
  `REPORT.build(state) + REPORT.buildWords(words, state.settings, Date.now())`.
  With 0 Words lessons this is exactly HEAD's report (fix #3).

Trade-off: putting the Words section in the persisted `report.md` would make
main persisted bytes depend on Words, and a Words lesson would then need to
rewrite the main report (main write path). Not worth it for a side feature;
the user-facing Copy/Download report still shows it.

### 3.6 `js/engine.js`

Keep the current uncommitted diff (`ord()`, `letters: state.order ? [] : ...`,
unlock noun, `unlockText(u, next, noun, lessonNoun)`). No new changes. Fix #6
is done in app.js by the `mode` argument (3.7, `finish`).

### 3.7 `js/app.js`

New module-level variables after `let state = STORE.load();`:

```js
let words = STORE.loadWords();
let wordsOn = STORE.wordsActive();
let serverWords = false;          // server.py answered with a `words` key
const curMode = () => (wordsOn ? 'words' : state.mode);
const isWords = (mode) => (mode || curMode()) === 'words';
function trk(mode) { return isWords(mode) ? wordsView() : state; }
```

Revert to HEAD: `lessonCount`, `persist`, `adoptRemote`, `pullGist`, the HEAD
`visibilitychange` listener, `syncFromFile`, `renderSync`, Export handler,
Reset confirm text.

New functions:

```js
function persistWords() {
  STORE.saveWords(words);
  if (SYNC.enabled()) SYNC.pushWords(words);
  if (FILES.server()) { if (serverWords) FILES.serverSaveWords(words); return; }
  if (FILES.connected()) FILES.write('words.json', JSON.stringify(words, null, 1));
}
function adoptWords(raw, msg) {          // remote/server/file copy is newer
  SYNC.cancelWords();                     // a queued older local snapshot must not overwrite it
  words = STORE.mergeWords(raw);
  STORE.saveWords(words, true);           // keep the remote savedAt (see 5)
  if (wordsOn) { renderStrip(); renderMetrics(); newLesson(); }
  if (msg) toast(msg);
}
function combinedReport() { return REPORT.build(state) + REPORT.buildWords(words, state.settings, Date.now()); }
async function pullWordsGist() { ... }    // section 5
async function wordsAfterConnect() { ... }// section 5
function wordsFromCopy(remote, save) {    // server and folder: newest wins
  if (remote && typeof remote === 'object' && (remote.savedAt || 0) > (words.savedAt || 0)) adoptWords(remote);
  else if ((words.savedAt || 0) > 0) save();
}
function seedWordsFromLegacy() { ... }    // section 7
```

Call sites (HEAD line numbers):

| Where | Change |
| --- | --- |
| top (6) | add `words`, `wordsOn`, `serverWords`, helpers above |
| `renderWarmupPanel` (81), `renderWarmKeys` (119) | `state.mode` → `curMode()` (else Warmup UI shows in Words when `state.mode === 'warmup'`) |
| `buildText` (128) | `const mode = curMode()`; Words branch uses `wordsView()`, `words.prefs.lessonLen`; sentence lessons set `buildText.focus = null` |
| `newLesson` (152) | `state.mode` → `curMode()` for mycode panel and `lesson.mode`; keep `sentences` |
| `persist` (190) | HEAD, unchanged |
| `lessonCount`, `adoptRemote`, `pullGist` (209-224) | HEAD, unchanged |
| `visibilitychange` (226) | HEAD listener unchanged; add a second listener with its own `lastPullW` and 30 s throttle calling `pullWordsGist()` |
| `sConnect` (253) | one added line inside `try`, after the HEAD `if (useRemote) ... else ...`: `await wordsAfterConnect();` |
| `sSyncNow` (278) | HEAD listener unchanged; add a second listener: `lastPullW = Date.now(); pullWordsGist();` |
| `sDisconnect` (279) | HEAD unchanged; add a second listener: `SYNC.cancelWords()` |
| `syncFromFile` (316) | HEAD unchanged; folder startup and `fileBtn` call `wordsFromCopy(await FILES.readJson('words.json'), () => FILES.write('words.json', JSON.stringify(words, null, 1)))` right after it |
| `renderStrip`, `renderFocus`, `renderMetrics` | via `trk()` / `isWords()` as in the current build; `renderFocus` uses `curMode()` instead of `state.mode` |
| `onChar` / `onBackspace` | as current build (`recordable`, `trk(L.mode)`, no pairs in Words) |
| `finish` (594) | `S = trk(L.mode)`; `S.lessons.push(rec)`; engine mode arg = `isWords(L.mode) ? (L.sentences ? 'sentences' : 'adaptive') : L.mode` (fix #6); then `isWords(L.mode) ? persistWords() : persist()` |
| `setMode` (667) | `if (mode === 'words') { wordsOn = true; STORE.setWordsActive(true); }` and no main persist; else `wordsOn = false; STORE.setWordsActive(false);` then HEAD body (`state.mode = mode; persist(); ...`). Both: button highlight by `curMode()`, `renderStrip(); renderMetrics(); newLesson()` |
| `focusLine` click (687) | `state.mode !== 'mycode'` → `curMode() !== 'mycode'` |
| `showView` (694) | stats open on `wordsOn ? 'words' : 'symbols'` (fix #4) |
| `renderStats` / `renderWordsStats` / resize (710-777) | as current build, reading `words` instead of `state.words` |
| Copy / Download report (767, 776) | `combinedReport()` |
| settings open (781) | `sTarget` = main target; new `sWordsTarget` = `words.prefs.targetWpm`; `sLen` = `wordsOn ? words.prefs.lessonLen : s.lessonLen`; set labels (fix #5) |
| `readSettings` (795) | main fields as HEAD except `lessonLen` goes to `words.prefs` when `wordsOn`; Words prefs changed → `persistWords()`; main: in symbol modes `persist()` as HEAD; in Words mode `persist()` only if `JSON.stringify(state.settings)` changed |
| `sUnlock` (813) | `wordsOn ? (forceUnlock(wordsView()), persistWords()) : HEAD` |
| `sExport` (819) | HEAD unchanged; new button `sExportWords` → `STORE.exportWords(words)` |
| `sImportFile` (821) | parse once; `obj.kind === 'ctt-words'` → `words = STORE.mergeWords(obj); persistWords();` re-render, toast "Words progress imported"; else HEAD lines (`state = STORE.merge(obj); persist(); boot();`) |
| `sReset` (834) | `wordsOn`: confirm "Reset Words progress? Symbol progress is not affected.", `words = STORE.wordsDefaults()` with old `prefs`, `persistWords()`, re-render. Else HEAD (text back to HEAD's "Reset all progress and stats? ..."; it resets symbols only) |
| `boot` (845) | first line `seedWordsFromLegacy();`; highlight by `curMode()` |
| startup IIFE (861) | after `if (SYNC.enabled()) await pullGist();` add `if (SYNC.enabled()) pullWordsGist();` (not awaited, so main startup timing is HEAD's). In the server branch, before `renderFileBtn(); return;`: `serverWords = 'words' in srv; if (serverWords) wordsFromCopy(srv.words, () => FILES.serverSaveWords(words));`. Folder branch: after `await syncFromFile()`, the `wordsFromCopy` folder call |
| `SYNC.onWordsStatus` | updates `#wordsSyncInfo`; first transition to `auth` toasts "Words sync: GitHub refused the token" |

Remove: `mainMode` handling, `withSaveShape` reliance, `lessonCount` Words
term, `state.settings.wordsTargetWpm`.

### 3.8 `index.html` / `css`

Keep the Words button, Stats toggle, `keysTitle`, `letterBlock`. Settings:

- `Target speed per key, symbols (WPM)` (`sTarget`) and
  `Target speed per letter, Words (WPM)` (`sWordsTarget`), both always visible.
- `sLen` label set at dialog open: `Adaptive lesson length (chars)` (HEAD) or
  `Words lesson length (chars)`.
- `sUnlock`: `Unlock next symbol` / `Unlock next letter (Words)`.
- `sReset`: `Reset progress` (HEAD) / `Reset Words progress`.
- New `sExportWords` "Export Words progress"; `sImport` label "Import progress"
  (detects either file type).
- New `<p id="wordsSyncInfo" class="muted small">` under the sync row, empty
  unless Words sync is `auth` or `error`.

## 4. Fixes folded in

| # | Fix | Where |
| --- | --- | --- |
| 3 | Words report section only with >= 1 Words lesson | `REPORT.buildWords` returns `''`; persisted reports never include it |
| 4 | Stats opens on the current mode's tab | `showView` |
| 5 | Labels say which mode a setting applies to; Lesson length, Unlock, Reset act on the current mode | settings open / `readSettings` / `sUnlock` / `sReset` |
| 6 | Sentence lessons do not advance focus rotation | `finish` passes mode `'sentences'`; `afterLesson`'s adaptive block (sinceUnlock, cooldown tick, focusRun) is skipped, per-key mastery/review/demotion still runs. `buildText.focus = null` for sentences. At 26/26 letters `sinceUnlock` is irrelevant |
| 8 | Tests: connect with Words-only progress; Words rotation/review/demotion | test plan WC-*, WE-* |

Current `afterLesson` behavior (the reason for #6): `finish` passes mode
`'adaptive'` for every Words lesson and `L.focus = plan.focus` even for
sentences, so a sentence lesson increments `focusRun.lessons` for a letter that
was not drilled and can rotate it to cooldown after 5 sentence lessons; it
also ticks cooldowns.

## 5. Words sync algorithm

All comparisons use the live `words` object at the time the response arrives.

```text
pullWordsGist():                       # startup (not awaited), refocus (30 s throttle), Sync now
  if not SYNC.enabled(): return
  try r = SYNC.pullWords() except: return          # status set inside; no local change
  if r is null or r.state == 'unknown': return     # never overwrite when we could not read
  L = words.savedAt or 0
  if r.state == 'ok':
     R = r.data.savedAt or 0
     if R > L: adoptWords(r.data, 'Loaded synced Words progress')
     elif L > R: SYNC.pushWords(words, 0)
     # equal: nothing
  else:                                             # 'missing' or 'bad'
     if L > 0: SYNC.pushWords(words, 0)            # bad copy is replaced; gist revisions keep it

wordsAfterConnect():                    # after HEAD's main connect decision
  try r = SYNC.pullWords() except: return
  nL = len(words.lessons)
  if r.state == 'ok':
     nR = len(r.data.lessons) if list else 0
     if nR > 0 and r.data.savedAt != words.savedAt:
        useRemote = nL == 0 or r.data.savedAt > words.savedAt
        if not useRemote:
           useRemote = not confirm('Words mode: this browser has nL Words lessons; the synced copy has nR.
                                    OK keeps this browser\'s Words progress and overwrites the synced copy.
                                    Cancel loads the synced copy instead.')
        if useRemote: adoptWords(r.data, 'Loaded synced Words progress'); return
  elif r.state == 'unknown': return
  if (words.savedAt or 0) > 0: SYNC.pushWords(words, 0)
```

`adoptWords` keeps the remote `savedAt` (main's `adoptRemote` re-stamps to
now, which can make a just-adopted stale copy look newest; Words does not copy
that). It cancels any queued Words snapshot.

Remote from a newer version (`v` > 1, unknown fields): accepted through
`mergeWords`, unknown fields are kept, so this build does not strip them when
it pushes back. Anything that fails the `kind` check is `bad`.

Known limit (same as main): two devices typing Words at the same time, last
pusher wins. Acceptable for a side feature.

## 6. Server and folder decisions

- Server: extend (3.4). Words disk save is cheap, keeps the "data/ has
  everything" property for server users, and is gated by `serverWords` so an
  old server never sees Words requests.
- Folder mode: support (`data/words.json`) with existing `readJson`/`write`;
  about six lines, no `files.js` change.
- Export: main Export unchanged (HEAD bytes); separate "Export Words progress".
- Import: one button, detects `kind === 'ctt-words'`. A main file goes through
  HEAD's path. A legacy combined file (from the current build) is a main file
  with `words` inside: main is imported (legacy fields stripped), its Words part
  seeds the sidecar only if the sidecar has 0 lessons (section 7); otherwise it
  is ignored with a toast "Words progress in this file was not imported; use a
  Words export".
- Reset: acts on the current mode only (symbols: HEAD behavior and text;
  Words: Words only, keeps Words prefs). Owner said Words is separate; a
  cross-mode reset would be the only place where one tool's button changes the
  other's progress.

Residual risk (cannot be fixed, HEAD code): the old page's Import accepts any
JSON, so importing a Words export there would replace main progress (it is
still in `ctt.v1.prev`). The distinct filename makes this unlikely.

## 7. Migration (legacy combined format)

The combined build was never deployed; only dev tests produced `words`,
`mainMode`, `wordsActive`, `settings.wordsTargetWpm` inside a main save. If the
owner ever connected the real gist or ran the real server with that build,
those fields may exist in the real gist or `data/progress.json`, and HEAD's
`merge` would keep them forever (`{...d, ...raw}`). So:

- Strip always (required for the guarantee "no Words fields in main"), in one
  funnel: `stripLegacy` as the first line of `merge`, which every main entry
  path uses (load, gist adopt, server, folder, import).
  - Returns `raw` itself when none of the legacy keys exist (HEAD output).
  - Otherwise a shallow copy without `words`, `wordsActive`, `mainMode`,
    `settings.wordsTargetWpm` (settings copied, not mutated); `mode: 'words'`
    becomes `mainMode` if it is a valid symbol mode, else `adaptive`.
  - Stashes `{ words, savedAt: raw.savedAt }` for `takeLegacyWords()`.
- Seed once: `boot()` calls `seedWordsFromLegacy()`, which takes the stash and,
  only if the sidecar has 0 lessons and the legacy Words has >= 1 valid lesson,
  sets `words = mergeWords(legacy.words)`, `prefs.targetWpm` from the legacy
  setting, `savedAt = 1` (oldest possible, so any real synced Words copy wins; changed after review), and `saveWords(words, true)`. Otherwise
  discard. `wordsActive` is ignored (start in a symbol mode).
- No main write at migration time: the cleaned main state is written by the
  next ordinary main save. Writing at load would re-stamp main `savedAt` and,
  at startup, could make this device's copy beat newer remote symbol progress.

Alternative (simpler): strip and discard, no seeding. Saves about 10 lines;
only loses dev-test Words data. Recommendation: seed, since it is cheap and
covers the "owner tried it on real data" case.

## 8. Rollback

- `git revert` the commit. HEAD ignores `ctt.words.*`, the Words gist file and
  `data/words.json`; HEAD's PATCH never lists the Words file, so it survives
  untouched and a later re-release finds it.
- Main saves written by the new build are HEAD format, so HEAD loads them
  exactly as its own.
- Optional cleanup: remove `ctt.words.v1`, `.prev`, `.unreadable`,
  `ctt.words.active` from localStorage; delete the Words file in the gist UI;
  delete `data/words.json`.
- Partial rollback without code revert: hiding the Words button is enough;
  nothing in main reads the sidecar.

## 9. Textual-identity list for review

Must be identical to HEAD (check with `git diff HEAD -U0 -- <file>` and look
for removed lines `^-[^-]`):

| File | Unchanged | Allowed diff |
| --- | --- | --- |
| `js/sync.js` | `get`, `set`, `setStatus`, `gh`, `fileContent`, `findOrCreate`, `connect`, `disconnect`, `pull`, `startup`, `push`, `flush`, constants | appended Words block; `CTT.SYNC` gains keys (that object literal is the only edited lines) |
| `js/files.js` | everything | appended `serverSaveWords`, `CTT.FILES` gains a key |
| `js/store.js` | `defaults`, `load`, `save`, `download`, `exportJson` | `merge` +1 line (`raw = stripLegacy(raw);`); appended Words functions; export object |
| `js/report.js` | `build` and all helpers | appended `buildWords`; export object |
| `js/engine.js` | everything except the `ord()` substitutions, `letters`, unlock noun, `unlockText` params | already-reviewed current diff |
| `js/app.js` | `persist`, `lessonCount`, `adoptRemote`, `pullGist`, HEAD `visibilitychange` listener, `renderSync`, `renderFileBtn`, `syncFromFile`, `fileBtn` handler body up to the added Words line, `sExport`, `sDisconnect` and `sSyncNow` HEAD listeners, `warm*` helpers | call sites in 3.7 |
| `server.py` | `write_atomic`, `progress.json`/`report.md` write lines, origin/size checks | `/api/load` response adds `words`; one new `if` in `do_POST` |

Quick reviewer commands:

```text
git diff HEAD -U0 -- js/sync.js js/files.js js/report.js | grep -E '^-[^-]'   # only the CTT.* export lines
git diff HEAD -U0 -- js/store.js | grep -E '^-[^-]'                           # only the export line
grep -n "wordsTargetWpm\|mainMode\|wordsActive\|withSaveShape\|state\.words" js/*.js   # only stripLegacy
```

## 10. Trade-offs vs the current combined design

| Aspect | Combined (`state.words`) | Sidecar |
| --- | --- | --- |
| Main persisted bytes | change (`words`, `mainMode`, `wordsActive`, `wordsTargetWpm`, toJSON) | HEAD bytes |
| Words lesson bumps main `savedAt` / pushes main | yes (cross-device overwrite race) | no |
| Corrupt Words data | sanitized inside main merge (main load path depends on it) | separate key and file; main never parses it |
| Size | Words adds to main blob and main POST/PATCH | separate blob, separate request |
| Old app copies | need `withSaveShape` hack | never see Words |
| Sync code | none extra | ~60 lines (pull/push/flush Words) + ~40 in app |
| Requests | 1 GET/PATCH | +1 GET at startup/refocus, +1 PATCH per Words lesson |
| Atomic backup | one Export has everything | two exports |
| Reset | one button resets both | per-mode reset |
| Report | appended to persisted report | only in Copy/Download report |
| Rollback | Words data stays inside main save | Words data stays in its own key/file |

## 11. Observations outside scope (not changed)

- HEAD `pullGist`/`adoptRemote`: a main push queued in the last 4 s keeps a
  reference to the old `state` object and can still flush after a newer remote
  was adopted, overwriting it. Rare; main code is intentionally left as HEAD.
  Words avoids it with `cancelWords()` and string snapshots.
- HEAD `adoptRemote` re-stamps `savedAt` to now (see section 5).
- The current build's `compactEvents` toast merge also changes main toast text
  when several keys look solid in one lesson, and `renderMetrics` now shows
  "–" when the current mode has no lessons (affects main only with 0 lessons).
  Both are display-only; keep or restrict to Words (open question).
