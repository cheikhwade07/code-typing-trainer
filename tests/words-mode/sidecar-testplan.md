# Words sidecar save: test plan

Design: `sidecar-design.md`. Baseline: `HEAD` = `913c3b7`. Repo `<repo>`,
scratch directory `<scratch>`. Every test has an ID, steps, expected result
and an exact check. **[MUST]** blocks release; **[SHOULD]** = fix or accept
in writing.

---

## 0. Environment (protects real data; do first)

Never drive tests against `http://127.0.0.1:8765` (real `data/`), the real
GitHub API, or the real gist. Never copy anything back into `<repo>/data`.

### 0.1 Builds and static servers

```text
S=<scratch>; R=<repo>
mkdir -p $S/head $S/new $S/new2 $S/swap $S/srv-old $S/srv-new $S/fixtures
git -C "$R" archive --format=tar HEAD . | tar -x -C $S/head
cp -r "$R"/index.html "$R"/css "$R"/js $S/new/       # sidecar build (working tree)
cp -r $S/new/* $S/new2/                                # second "device" on another origin
```

Static server with `Cache-Control: no-store` (so version swaps are real), saved
as `$S/nostore.py`:

```python
import sys, functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
class H(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store"); super().end_headers()
port, root = int(sys.argv[1]), sys.argv[2]
ThreadingHTTPServer(("127.0.0.1", port), functools.partial(H, directory=root)).serve_forever()
```

| Port | Serves | Use |
| --- | --- | --- |
| 8801 | `$S/head` | HEAD reference (device "H") |
| 8802 | `$S/new` | new build, device A |
| 8803 | `$S/new2` | new build, device B (separate localStorage) |
| 8804 | `$S/swap` | same origin, files swapped between HEAD and new (old-page tests) |

### 0.2 Mock GitHub gist API (`$S/mock_gist.py`, port 8898; a second instance on 8897 for the HEAD reference run)

Implements, with CORS (`Access-Control-Allow-Origin: *`, allow headers
`Authorization, Content-Type, Accept`, methods `GET, POST, PATCH, OPTIONS`):

- `GET /user` → `{"login":"tester"}`.
- `GET /gists?per_page=&page=` → list of stored gists with `files` keys.
- `POST /gists` → create, store files, return `{id, files}`.
- `GET /gists/:id` → `{id, files: {name: {content, truncated:false, raw_url}}}`.
  `truncate=<name>` control makes that file `truncated:true, content:""` with
  `raw_url` = `/raw/:id/:name`.
- `PATCH /gists/:id` → **GitHub semantics**: only listed files change; `null`
  deletes (log it, tests assert it never happens).
- `GET /raw/:id/:name` → raw content.
- Control (`/__ctl`, POST JSON): `reset`, `set` (gist files), `auth` (401 for
  everything), `delay_ms` per method, `conflict_overlap` (a PATCH arriving
  while another PATCH is being handled gets 409), `fail_next` (status code).
- `GET /__log` → every request: `{seq, t_start, t_end, method, path, body,
  status, tag}`; `GET /__state` → stored gists.

### 0.3 Mock local server

Copy `server.py` (HEAD version into `$S/srv-old`, new version into
`$S/srv-new`), plus the page build to test, and in the copy only change
`PORT = 8765` to 8810 (old) / 8811 (new). `ROOT` is the copy's directory, so
`data/` is scratch. Run with `--no-browser`. Combinations used in SV tests are
built by copying the needed page build next to the needed server copy.

### 0.4 Harness additions (`t2.js`, loaded after the existing `harness.js`)

Load both into each page as in `testplan.md` section 0. `t2.js` adds:

```js
Object.assign(T, {
  MOCK: 'http://127.0.0.1:8898', offline: false, reqs: [],
  sw() { return JSON.parse(localStorage.getItem('ctt.words.v1')); },     // sidecar
  raw(k) { return localStorage.getItem(k); },
  dump() { return JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)]))); },
  installFetch() {                         // reroute GitHub API, tag caller, simulate offline
    const real = window.fetch.bind(window);
    window.fetch = (u, o) => {
      u = String(u);
      if (!u.startsWith('https://api.github.com') && !u.startsWith(T.MOCK)) return real(u, o);
      const tag = /pullWords|flushWords|wordsAfterConnect|pullWordsGist/.test(new Error().stack) ? 'words' : 'main';
      T.reqs.push({ tag, method: (o && o.method) || 'GET', url: u.replace('https://api.github.com', ''), body: o && o.body });
      if (T.offline) return Promise.reject(new TypeError('Failed to fetch'));
      return real(u.replace('https://api.github.com', T.MOCK), o);
    };
  },
  ctl(o) { return fetch(T.MOCK + '/__ctl', { method: 'POST', body: JSON.stringify(o) }); },
  async log() { return (await (await fetch(T.MOCK + '/__log')).json()); },
  async gist() { return (await (await fetch(T.MOCK + '/__state')).json()); },
  downloads: [],
  captureDownloads() {                     // exportJson uses a closure download(), so hook the Blob URL
    const cu = URL.createObjectURL;
    URL.createObjectURL = (b) => { T._blob = b; return cu.call(URL, b); };
    HTMLAnchorElement.prototype.click = function () { const n = this.download; T._blob.text().then((t) => T.downloads.push({ name: n, text: t })); };
  },
  clip: [],
  captureClipboard() { navigator.clipboard.writeText = (s) => { T.clip.push(s); return Promise.resolve(); }; },
  async connect(token) { document.getElementById('settingsBtn').click(); document.getElementById('sToken').value = token || 'test-token'; document.getElementById('sConnect').click(); await T.wait(300); document.getElementById('settings').close(); },
  noGen(s) { return s.replace(/^Generated: .*$/m, ''); },
});
```

`installFetch()`, `captureDownloads()`, `captureClipboard()` must run before
any sync action; for startup tests, install them from a tiny inline override
by adding `?t2` handling: serve a copy of `index.html` in each scratch build
that loads `t2.js` before `js/sync.js` (scratch copies only). Set
`window.confirm` per test (record calls in `T.confirms`).

### 0.5 Fixtures

Reuse `F_SYN`, `F_REAL` from `testplan.md`. New:

- `FW(n)`: a sidecar object: `wordsDefaults()` with `unlocked: n`,
  `sinceUnlock: 3`, keys for the first n letters (40 samples, 95%), 12
  lessons, `prefs: {targetWpm: 35, lessonLen: 70}`, `savedAt: T0 - 5000`.
- `F_LEGACY`: `F_SYN` plus `words: FW(12)` progress fields, `mainMode:
  'lines'`, `wordsActive: true`, `mode: 'lines'`, `settings.wordsTargetWpm:
  40` (the shape the current combined build writes).
- Seeding a sidecar: `localStorage.setItem('ctt.words.v1', JSON.stringify(x))`
  then reload.

Defaults unless stated: `T.freeze(T0)` (today 12:00), `stopOnError: true`,
`T.errors.length === 0` and no console errors at the end of each test.

---

## 1. Static review (RV) [MUST]

| ID | Check | Expected |
| --- | --- | --- |
| RV-1 | `git diff HEAD -U0 -- js/sync.js js/files.js js/report.js \| grep -E '^-[^-]'` | only the `CTT.SYNC = {` / `CTT.FILES = {` / `CTT.REPORT = {` export lines |
| RV-2 | same for `js/store.js` | only the `CTT.STORE` export line; `merge` diff is exactly `+    raw = stripLegacy(raw);` |
| RV-3 | `grep -n "wordsTargetWpm\|mainMode\|wordsActive\|withSaveShape\|toJSON\|state\.words" js/*.js` | matches only inside `stripLegacy` and its comment, plus the sidecar's own active-flag API (`STORE.wordsActive()` in app.js boot, `function wordsActive()` and the `CTT.STORE` export line in store.js), which is not a legacy field |
| RV-4 | `git diff HEAD -- js/app.js` and read the listed functions in design 9 | `persist`, `lessonCount`, `adoptRemote`, `pullGist`, HEAD `visibilitychange` listener, `renderSync`, `syncFromFile`, `sExport` identical |
| RV-5 | `git diff HEAD -- server.py` | `write_atomic` and the `progress.json`/`report.md` write lines unchanged |
| RV-6 | Every Words PATCH body literal in `sync.js` | lists only `WFILE`; no `null` file values anywhere |

---

## 2. Main byte-identity (MI) [MUST]

Script `SCRIPT_MAIN(variant)`, run on HEAD (8801, mock 8897) and new (8802,
mock 8898), each after `localStorage.clear()` and mock `reset`:

1. `installFetch`, `captureDownloads`, `captureClipboard`, `T.freeze(T0)`.
2. Import `F_SYN` (with `mycode.text` set). `T.connect()`.
3. For lesson i in 1..8 (modes: A A L A M A A L):
   `T.freeze(T0 + i*60000)`; `T.seedRandom(100+i)`; click the mode button;
   `T.seedRandom(200+i)`; `T.esc()`; type the lesson with `errAt` = every 9th
   char; `await CTT.SYNC.flush()`.
   - variant **B** (new build only): after lesson 3, `T.freeze(T0+3*60000+1)`,
     click Words, type 3 Words lessons (`T.tick(30000)` between, `await
     CTT.SYNC.flushWords()` after each), then continue with lesson 4.
     Note HEAD/new both click the lesson-4 mode button at `T0+4*60000`, so the
     main `setMode` persist happens in both runs at the same time.
4. `T.freeze(T0+9*60000)`: open Stats, Copy report, Download report; Settings
   → Export; close.
5. Collect: `T.raw('ctt.v1')`, `T.raw('ctt.v1.prev')`, main gist requests
   (`T.reqs` with `tag === 'main'`), mock state of the main files,
   downloads, clipboard.

| ID | Steps | Expected / check |
| --- | --- | --- |
| MI-1 | HEAD vs new, variant A | `ctt.v1` and `ctt.v1.prev` strings `===` |
| MI-2 | HEAD vs new, variant B | same as MI-1 (Words activity in between changes nothing) |
| MI-3 | variant A and B: main requests | arrays of `{method, url, body}` `===` element-wise to HEAD's, including the `POST /gists` body from connect |
| MI-4 | variant B: Words requests | every `tag:'words'` PATCH body: `Object.keys(JSON.parse(body).files)` deep-equals `['code-typing-trainer-words.json']`; no main PATCH contains that key; no request contains `"content":null` or a `null` file |
| MI-5 | final mock gist | `progress.json` file content and `report.md` file content `===` HEAD's mock (variant A and B). In B the gist also has the Words file and nothing else extra |
| MI-6 | Export download | `name` and `text` `===` HEAD's (A and B); text has no `words`, `mainMode`, `wordsActive`, `wordsTargetWpm` |
| MI-7 | Copy report, variant A | `T.noGen(clip[0]) === T.noGen(HEADclip[0])`; Download report text likewise |
| MI-8 | Copy report, variant B | `T.noGen(clip).startsWith(T.noGen(HEADclip))`; remainder starts with `\n## Words mode (separate from the symbol stats)`; persisted report (mock gist report file) has no `## Words mode` |
| MI-9 | DOM, variant A/B | after step 3, in Adaptive: `T.dom()` and Stats `T.statsDom()` hashes `===` HEAD's (rerun the existing `XV` probe; all 26 hashes equal) |
| MI-10 | Words lessons do not touch main storage | variant B: snapshot `T.raw('ctt.v1')` and `T.raw('ctt.v1.prev')` right after clicking Words; after the 3 Words lessons, both strings `===` the snapshot; no `tag:'main'` request was issued during the Words lessons |
| MI-11 | Server bodies | Run SCRIPT_MAIN without gist on HEAD page + HEAD server (8810 copy) and new page + new server (8811 copy), variant A and B: capture `api/save` request bodies by wrapping fetch; the bodies that contain `progress` are `===` HEAD's; final `data/progress.json` and `data/report.md` files byte-equal (`cmp`). Clear the copy's `data/` and the origin's storage first, and compare from the first save made after `T.freeze(T0)`: a save made at page start, before the clock is frozen, carries a real-time savedAt on both builds. HEAD also writes one extra save of the unchanged pre-import state while importing `F_SYN` (its Settings `change` listener fires on the hidden import input); the new build no longer does this (EX-3 fix), so that single HEAD write is excluded and every later write must be equal |
| MI-12 | Folder mode bodies | Stub `CTT.FILES.connected = () => true`, `CTT.FILES.server = () => false`, spy `CTT.FILES.write` (record `[name, text]`, resolve true) on both builds before step 2: records for `progress.json` / `report.md` `===` HEAD's (A and B); in B, extra records only for `words.json`. Compare from the first record made after `T.freeze(T0)`; the startup save happens before the freeze and has a real-time savedAt on both builds. HEAD also writes one extra save of the unchanged pre-import state while importing `F_SYN` (its Settings `change` listener fires on the hidden import input); the new build no longer does this (EX-3 fix), so that single HEAD write is excluded and every later write must be equal |

---

## 3. Words gist sync: payloads and conflict matrix (WS) [MUST]

Setup for each: device A = 8802 with mock 8898, connected (set `ctt.gist.token`
and `ctt.gist.id` to a mock gist created with main + report files), sidecar
seeded as stated, then reload (startup runs `pullWordsGist`). Read results
after `await T.wait(300)` plus `flushWords()` if needed.

| ID | Local sidecar | Remote Words file | Expected | Check |
| --- | --- | --- | --- | --- |
| WS-1 local newer | `FW(12)` savedAt T0 | `FW(10)` savedAt T0-1h | one Words PATCH; remote becomes local | `JSON.parse(remote) ` deep-equals `T.sw()`; `ctt.v1` unchanged (string equal to before reload) |
| WS-2 remote newer | `FW(10)` savedAt T0-1h | `FW(14)` savedAt T0 | adopted, toast "Loaded synced Words progress"; no Words PATCH | `T.sw()` deep-equals `mergeWords(remote)`; `T.sw().savedAt === remote.savedAt` (not re-stamped); keystrip shows 14 unlocked if in Words |
| WS-3 remote missing | `FW(12)` | file absent (old gist) | Words PATCH creates it; main files untouched | mock state has 3 files; main contents unchanged byte-wise |
| WS-3b remote missing, local empty | defaults (savedAt 0) | absent | no Words PATCH | `T.reqs` has no Words PATCH after 6 s |
| WS-4 remote corrupted | `FW(12)` | `"{not json"`, then `"[]"`, then `{"kind":"other"}` (3 runs) | treated as bad: local pushed, no crash | remote Words content `===` `JSON.stringify(T.sw())`; `T.errors` empty |
| WS-4b corrupted, local empty | defaults | `"{not json"` | nothing written | remote unchanged |
| WS-4c raw fetch fails | `FW(12)` | truncated + raw endpoint returns 500 | `state:'unknown'`: no adopt, no push | sidecar and remote unchanged |
| WS-5 future version | `FW(10)` savedAt T0-1h | `FW(12)` with `v: 99`, `future: {x:1}`, savedAt T0 | adopted; after one Words lesson the pushed file still has `v: 99` and `future` | `JSON.parse(remote).future` deep-equals `{x:1}` |
| WS-6 both empty | defaults | absent | no PATCH, no adopt | no Words requests besides the GET |
| WS-7 token revoked | `FW(12)` | any | `ctl auth`; type 1 Words lesson | exactly 1 Words PATCH attempt in 10 s; `SYNC.wordsStatus() === 'auth'`; `SYNC.status()` equals its value before the lesson; `#wordsSyncInfo` non-empty; `ctt.v1` unchanged |
| WS-8 offline then online | `FW(12)` | `FW(12)` same savedAt | `T.offline = true`; type 1 Words lesson; wait 9 s; `T.offline = false`; wait 5 s | `wordsStatus` was `error`, then `ok`; >= 2 failed attempts logged in `T.reqs`; final remote `===` local snapshot of that lesson |
| WS-9 two pushers, main first | `FW(12)` | present | `ctl delay_ms PATCH 1500`; finish a symbol lesson, click Words, finish a Words lesson within 4 s; call `SYNC.flush()` then `SYNC.flushWords()` | mock log: the Words PATCH `t_start` >= main PATCH `t_end`; final mock has latest main and latest Words content |
| WS-10 two pushers, Words first + conflict | `FW(12)` | present | `ctl delay_ms PATCH 1500`, `conflict_overlap`; Words lesson, `flushWords()`, then symbol lesson, `flush()` while Words in flight | main gets 409 once, retries after 4 s, succeeds; within 10 s mock main content `===` `JSON.stringify` of the latest main state and Words content `===` the latest sidecar; `SYNC.status() === 'ok'` at the end |
| WS-11 queued snapshot vs adopt | `FW(12)` | — | finish Words lesson (push queued, 4 s); within 1 s, set remote Words to `FW(20)` with savedAt = now+10 s and click Sync now | adopted; no Words PATCH afterwards (cancelled); remote still `FW(20)` after 6 s |
| WS-12 refocus throttle | — | — | fire `visibilitychange` twice within 30 s | exactly one extra Words GET; main HEAD throttle behavior unchanged (one main GET) |
| WS-13 disconnect | `FW(12)` | — | finish Words lesson, click Disconnect within 4 s | no Words PATCH afterwards |
| WS-14 large file | sidecar with 1000 lessons and full hist | truncated with raw_url | read via raw_url; newest-wins works | WS-1 and WS-2 checks pass in truncated mode |

---

## 4. Connect flows (WC) [MUST]

`T.connect()` from Settings. Mock has the stated gists. Record `T.confirms`.

| ID | Device state | Mock | Expected | Check |
| --- | --- | --- | --- | --- |
| WC-1 Words-only, no gist | main defaults (0 lessons), sidecar `FW(12)` | empty | `POST /gists` with main + report only (body `===` HEAD's POST body for a defaults main state with the same savedAt), then one Words PATCH | mock has 3 files; Words content deep-equals `T.sw()`; 0 confirms |
| WC-2 Words-only, gist has main | main defaults, sidecar `FW(12)` | gist with `F_SYN` main, no Words file | main adopted silently (HEAD); Words pushed | `T.st()` main fields equal `F_SYN` merged; `T.sw()` deep-equals the pre-connect sidecar; mock Words file = local; 0 confirms |
| WC-3 fresh device | everything empty | gist with main + Words (`FW(14)`), written into the mock directly (or from device B, 8803) | both adopted | `T.sw()` deep-equals remote Words, savedAt preserved; 0 confirms |
| WC-4 local Words older | sidecar `FW(10)`, savedAt T0-1h | Words `FW(14)` savedAt T0 | adopt remote, no confirm | `T.sw().unlocked === 14` |
| WC-5 local Words newer, remote has lessons | `FW(14)` savedAt T0 | `FW(10)` savedAt T0-1h | Words confirm shown once; `confirm → true`: keep local and push; rerun with `false`: adopt remote | confirm text starts "Words mode:"; resulting `T.sw()` and mock match the choice |
| WC-6 main and Words both conflict | main 20 lessons newer locally, Words newer locally | both remote older with lessons | two confirms in order (main, then Words); each choice applied independently | 4 combinations of answers; main result equals HEAD's result for the same main answer (compare `ctt.v1` against a HEAD run) |
| WC-7 bad token | any | `auth` | HEAD behavior (token cleared, toast); no Words request | `T.reqs.filter(r => r.tag === 'words').length === 0` |
| WC-8 Words file corrupted at connect | `FW(12)` | Words file `"{bad"` | local pushed, no confirm | mock Words = local |

---

## 5. Old page and cross-version (XV) [MUST]

| ID | Steps | Expected | Check |
| --- | --- | --- | --- |
| XV-1 swap new → HEAD, same origin | Serve new build at 8804. Import `F_SYN`, 2 Adaptive lessons, click Lines, then Words, 5 Words lessons, stay in Words. Save `d0 = T.dump()`. Copy HEAD files over `$S/swap`, reload | HEAD opens in **Lines** (button highlighted, Lines lesson shown), symbol keystrip, no errors | `state.mode` read from `T.st().mode === 'lines'`; `T.raw('ctt.v1') === JSON.parse(d0)['ctt.v1']` right after load |
| XV-2 HEAD keeps Words data | continue XV-1: 2 Adaptive lessons on HEAD | main progresses as HEAD; Words keys untouched | `ctt.words.v1`, `.prev`, `ctt.words.active` strings `===` `d0` values |
| XV-3 swap back | copy new build over, reload | opens in Words (active flag), Words progress and main progress (incl. HEAD's 2 lessons) intact | `T.sw()` deep-equals `d0` sidecar; `T.st().lessons.length` = before + 2 |
| XV-4 HEAD on another device with gist | device H (8801) connected to mock 8898 gist that has a Words file; 3 symbol lessons, flush | HEAD PATCH bodies list only main + report; Words file byte-unchanged | compare mock Words content before/after |
| XV-5 cross-version derived outputs | run existing `XV()` probe on 8801 and 8802 (new build adapted: probe uses `T.mode('words')` + Esc) | all hashes equal | object deep-equal |
| XV-6 HEAD page with a cleaned-up save | Save written by new build after a legacy migration (MG-1) loaded in HEAD | no `words`/`mainMode`/`wordsActive` in what HEAD reads | keys of `T.st()` equal HEAD `defaults()` keys (plus `warm` if used) |

---

## 6. Local storage robustness (LS) [MUST]

| ID | Steps | Expected | Check |
| --- | --- | --- | --- |
| LS-1 corrupted Words key | For each value: `'not json'`, `'{"a":'`, `'null'`, `'[]'`, `'42'`, `'{"lessons":"x"}'`, `'{"keys":{"e":5}}'`, `'{"unlocked":99}'`, `'{"focusRun":{"ch":"("}}'`, `'{"prefs":{"targetWpm":"fast","lessonLen":-5}}'`, `'{"lessons":[{"ts":"x"}]}'`, a 4 MB string: set `ctt.words.v1`, reload, click Words, type 1 lesson | no error; Words starts from sanitized/default state; main untouched | `T.errors` empty; `T.raw('ctt.v1')` unchanged by load + Words lesson; unparsable values copied to `ctt.words.v1.unreadable`; `T.sw()` passes `mergeWords` invariants (unlocked 10..26, prefs clamped) |
| LS-2 corrupted key, good `.prev` | `ctt.words.v1 = 'x'`, `.prev` = `FW(14)` | loads `.prev` | `T.sw().unlocked === 14` right after load; after one lesson `T.sw().lessons.length === 13` and `unlocked >= 14` (`FW(14)` is all-good, so the lesson may unlock a 15th letter) |
| LS-3 unreadable slot does not accumulate | repeat LS-1 three times | only one `ctt.words.v1.unreadable` key | `Object.keys(localStorage).filter(k => k.startsWith('ctt.words.v1.unreadable')).length === 1` |
| LS-4 Words-only quota failure | Wrap `Storage.prototype.setItem` to throw `QuotaExceededError` for keys starting `ctt.words`; type 2 Words lessons then 1 symbol lesson | Words lessons complete (in memory), no error; main save works | `T.errors` empty; `ctt.v1` updated after the symbol lesson; main keys never removed |
| LS-5 global quota | Wrap `setItem` to throw when the total stored length + new value > (current total + 20 KB); type Words lessons until a Words write fails | Words removes only `ctt.words.v1.prev` and retries; never removes `ctt.v1*` | spy `removeItem`: only `ctt.words.v1.prev` ever removed |
| LS-6 localStorage unavailable | `Object.defineProperty(window, 'localStorage', { get() { throw new Error() } })` in a page copy before scripts | page loads, both modes work in memory | `T.errors` empty |
| LS-7 Words lesson cap | sidecar with 1000 lessons, type 1 | 1000 lessons kept, oldest dropped | `T.sw().lessons.length === 1000`, last `ts` is new |
| LS-8 active flag | click Words, reload | opens in Words; click Adaptive, reload: opens Adaptive | `T.raw('ctt.words.active')` `'1'` then `null`; `ctt.v1` unchanged by the Words click |

---

## 7. Server and folder (SV, FS) [MUST unless marked]

| ID | Combination | Steps | Expected | Check |
| --- | --- | --- | --- | --- |
| SV-1 | new page + old server (8810) | 2 symbol + 2 Words lessons | no POST contains `words`; `data/progress.json` / `report.md` written; no `data/words.json`; file button "Auto-saving" | wrapped fetch log; `ls data` |
| SV-2 | old page + new server (8811) | 2 symbol lessons | `/api/load` JSON has `words: null`; old page works; `data/progress.json` byte-equal to the SV-1 equivalent HEAD-page + HEAD-server run | `cmp` |
| SV-3 | new page + new server | 2 symbol + 2 Words lessons | Words POST bodies are exactly `{"words":{...}}`; `data/words.json` = `json.dumps(sidecar, indent=1)`; main POST bodies `===` HEAD's | parse file, deep-equal `T.sw()` |
| SV-4 | new + new | stop page; edit `data/words.json` to a newer savedAt (scratch copy only); reload | adopted from server, savedAt preserved | `T.sw().savedAt` |
| SV-5 | new + new | `data/words.json` = `"{bad"` | treated as missing; with local savedAt > 0 the file is overwritten at startup (`wordsFromCopy`, design 3.7); with an empty local sidecar (savedAt 0) it is left as `{bad` and no Words POST is sent | file content, Words POST bodies |
| SV-6 | new + new | Words POST returns 500 (stub fetch for `api/save` with a `words` body) | `fileState` unchanged (button not "Save failed"); main saves unaffected | DOM `#fileBtn` text |
| SV-7 | new + new | 1 MB sidecar | POST accepted (< `MAX_BODY`) | 200 |
| FS-1 | folder mode (stubbed `FILES` as MI-12) | 2 Words lessons | `write('words.json', JSON.stringify(sidecar, null, 1))`; nothing else written for Words | spy log |
| FS-2 | folder mode | `readJson('words.json')` stub returns a newer copy at startup | adopted | `T.sw()` |
| FS-3 [SHOULD] | real Chrome, real temp folder (manual) | pick folder, 1 Words + 1 symbol lesson | `data/words.json`, `data/progress.json`, `data/report.md` present; `progress.json` has no `words` | inspect files |

---

## 8. Export, import, reset, migration (EX, MG) [MUST]

| ID | Steps | Expected | Check |
| --- | --- | --- | --- |
| EX-1 | Export (main) with Words progress present | file `code-typing-trainer-backup-<date>.json`, no Words fields | MI-6 checks |
| EX-2 | Export Words | file `code-typing-trainer-words-backup-<date>.json`; content = `JSON.stringify(sidecar, null, 2)`; no `order`/`settings` keys | parse; keys |
| EX-3 | Import Words export on a fresh origin | sidecar replaced, main untouched | `T.sw()` deep-equals `mergeWords(file)` except `savedAt` (re-stamped on save); `ctt.v1` string unchanged, no main request; also run once from a symbol mode (the import input sits in the Settings dialog) |
| EX-4 | Import main export | HEAD behavior, sidecar untouched | `ctt.v1` equals HEAD's after the same import; `ctt.words.v1` string unchanged |
| EX-5 | Import garbage / Words file with `kind` but junk fields | toast "Could not read that file" or sanitized Words; main untouched by the Words file | `ctt.v1` unchanged after the junk Words file. For the garbage file, `ctt.v1` is not part of the check: HEAD re-saved main on every import through the Settings change listener |
| EX-6 | Reset in Words mode | confirm text mentions Words only; sidecar reset to defaults with the old `prefs`; main untouched | `T.sw().lessons.length === 0`, `prefs` equal; `ctt.v1` unchanged |
| EX-7 | Reset in a symbol mode | HEAD text and behavior; sidecar untouched | `ctt.v1` equals HEAD's after reset; `ctt.words.v1` unchanged |
| EX-8 | Reset in Words with gist | Words reset pushed (newest wins), main not pushed | only a Words PATCH in `T.reqs` |
| MG-1 | `ctt.v1 = F_LEGACY`, no sidecar, reload | main in memory has no legacy fields; mode `lines`; sidecar seeded from legacy (12 lessons, `prefs.targetWpm === 40`, savedAt = 1 so any real copy wins); `ctt.v1` string **unchanged by load** (no write) | `T.raw('ctt.v1') === JSON.stringify(F_LEGACY)` after load; after 1 symbol lesson `T.st()` has no `words`/`mainMode`/`wordsActive`/`settings.wordsTargetWpm` |
| MG-2 | as MG-1 but a sidecar with 3 lessons exists | legacy Words discarded, sidecar kept | `T.sw()` equal to the existing sidecar |
| MG-3 | Import `F_LEGACY` via Import button | main imported clean; seeding rule as MG-1/MG-2; toast about Words when discarded | as above |
| MG-4 | gist main file is `F_LEGACY` (remote newer) | adopted clean; next main push has no legacy fields | mock main content parse |
| MG-5 | HEAD-format input | `stripLegacy(raw) === raw` (same object) | identity check in console: `CTT.STORE.merge` output deep-equals HEAD `merge` output for `F_SYN`, `F_REAL` |
| MG-6 | `F_LEGACY` with `mode: 'words'`, `mainMode: 'words'` | mode becomes `adaptive` | `T.st().mode` after first save |

---

## 9. Agreed small fixes (FX) [MUST]

| ID | Steps | Expected | Check |
| --- | --- | --- | --- |
| FX-3a | 0 Words lessons (sidecar savedAt > 0 from a prefs change) | Copy/Download report has no Words section | `!clip.includes('## Words mode')`; equals HEAD report (no Generated line) |
| FX-3b | 1 Words lesson | section present at the end once | count of `## Words mode` = 1; persisted reports still without it |
| FX-3c | sidecar with malformed lesson injected in memory (`words.lessons.push({})` via console after load is impossible; use LS-1 values) | report never throws; symbol part intact | `REPORT.build` prefix equal |
| FX-4a | in Words, click Stats | Words tab active (`#statsWords.on`), Words data shown | `keysTitle` text `Letters (Words mode)` |
| FX-4b | in Adaptive/Lines/My code/Warmup, click Stats | Symbols tab | `#statsSym.on` |
| FX-4c | in Words, open Stats, switch to Symbols, back to Practice, Stats again | opens on Words again | class check |
| FX-5a | open Settings in Words | `sLen` label "Words lesson length (characters)", value = `prefs.lessonLen`; Unlock button "Unlock next letter (Words)"; Reset "Reset Words progress"; both target inputs present with mode names | DOM text |
| FX-5b | in Words: set Lesson length 120 and Words target 50, close | sidecar prefs updated; main `lessonLen`/`targetWpm` unchanged; `ctt.v1` string unchanged; next Words lesson about 120 chars | `T.sw().prefs`; `T.raw('ctt.v1')` equal |
| FX-5c | in Words: open and close Settings without changes | no main write, no main request | `ctt.v1` equal; no `tag:'main'` request |
| FX-5d | in Words: toggle Sounds | main settings change and main persists (shared setting) | `T.st().settings.sound` flipped |
| FX-5e | in Adaptive: open/close Settings, change lesson length | HEAD behavior (main persisted); sidecar unchanged | compare with HEAD run; `ctt.words.v1` equal |
| FX-5f | Unlock next letter in Words | `T.sw().unlocked` +1; `ctt.v1` unchanged | strings |
| FX-6a | sidecar `FW(26)`, `focusRun: {ch:'q', lessons:3, startConf:0.2}`, `cooldown: {z:2}`, `sinceUnlock: 7`; force a sentence lesson (`Math.random` stub returning 0.1 for the sentence draw, then seeded); type it | `focusRun`, `cooldown`, `sinceUnlock` deep-equal before; letter hist grew for typed letters; focus line says Sentences | deep-equal; `keys.e.hist.length` increased |
| FX-6b | same fixture, force a word lesson | `focusRun.lessons` 4 (or rotation event), `cooldown.z === 1`, `sinceUnlock === 8` | values |
| FX-6c | 5 sentence lessons in a row | no "Rotating off" toast | toast log |

---

## 10. Words engine on the sidecar (WE) [MUST]

All run in Words mode on 8802 with a seeded sidecar; after each, `ctt.v1`
string must be unchanged and no `tag:'main'` request issued. Keystroke timing
via `T.keyMs(ms)`: 200 ms per key = 60 WPM, 600 ms = 20 WPM.

| ID | Setup | Action | Expected |
| --- | --- | --- | --- |
| WE-1 start | defaults | click Words | keystrip `e t a o i n s r h l` unlocked, 16 locked; lesson uses only those letters (fuzz 200 lessons with seeds) |
| WE-2 unlock all good | `FW(10)` all 10 keys good (`k.good = true`, 95%, fast) | 1 lesson at 200 ms, no errors | toast "New letter unlocked: d"; `T.sw().unlocked === 11`, `sinceUnlock === 0` |
| WE-3 stall unlock | `FW(12)` with 2 keys at 85% (not good, above 70%), `sinceUnlock: 9` | 1 lesson | unlock to 13 |
| WE-3n negative | as WE-3 but one key at 60% | 1 lesson | no unlock; unlock text names that key |
| WE-4 rotation | `FW(12)`, focus letter `d` with low conf; `focusRun: {ch:'d', lessons:4, startConf: <current conf>}`; type with errors on `d` so conf does not rise by 0.05 | 1 word lesson | toast "Rotating off d for 3 lessons"; `cooldown.d === 3`; `focusRun === null`; next plan focus is not `d` |
| WE-4b still improving | same but conf improves >= 0.05 | 1 lesson | `focusRun = {ch:'d', lessons:0, ...}`, no cooldown |
| WE-5 review pass | key `e`: `level: 1`, `due: T0 - 1h`, 40 good samples | lessons giving enough `e` attempts, all correct at 200 ms, for the review to pass (about 22 attempts: the Wilson lower bound must reach 0.93, so about 3 lessons) | toast "Review passed: e (next in 3d)"; `level === 2`; `due === T0 + 3*DAY` |
| WE-6 review fail | as WE-5 | `e` attempts mostly wrong | "Review missed: e is back to learning"; `level 0`, `due null` |
| WE-7 demotion | key `t`: `level: 2`, `due` in future, hist with 30 recent samples at 70% | 1 lesson | "t has dropped below 90%, back to learning"; `level 0` |
| WE-8 mastery uses Words target | key `a` passing at 60 WPM; `prefs.targetWpm` 100 vs 20 | lesson each | at 100: no "looks solid"; at 20: "a looks solid today"; main `targetWpm` irrelevant (set main to 10 and 120, same result) |
| WE-9 two-day rule | WE-8 at 20, then `T.freeze(T0 + DAY)` and repeat | "Mastered: a (review tomorrow)", `level 1` |
| WE-10 only a-z recorded | sentence lesson | capitals, spaces, punctuation not in `keys`; `pairs` stays `{}` |
| WE-11 focusStyle shared | main `focusStyle: 'mixed'` | plan on sidecar has `phase !== 'learn'` | as main semantics |
| WE-12 mid-lesson switch | half a Words lesson, click Adaptive | keystrokes so far in sidecar keys only; no Words lesson record; `ctt.v1` equals HEAD after an equivalent Adaptive click |
| WE-13 engine does not persist runtime props | after any Words lesson | `'order' in T.sw() === false`, `'settings' in T.sw() === false` |

---

## 11. Release gate

All [MUST] pass on Chrome (current) with `T.errors` empty. Record in a run
log: build hashes (`git stash`-free: `git diff HEAD | sha1sum`), mock logs for
MI-3/MI-4/WS-9/WS-10, and the RV command outputs. Then a 2-minute manual smoke
on the real GitHub API with a throwaway account and token (never the owner's
real gist): connect, 1 symbol + 1 Words lesson, check the gist has 3 files
and the main file has no Words fields.
