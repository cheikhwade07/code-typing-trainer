# Words mode: test plan

Spec: `spec.md`. Baseline code: trainer repo `HEAD` = `913c3b7`
(all file:line references below are to HEAD). The trainer is its own git repo at
`<repo>`.

Legend: **[MUST]** = must pass before release. **[SHOULD]** = fix or explicitly accept.

---

## 0. Test environment (do this first; protects the user's real data)

The real server (`server.py`, fixed port 8765) auto-saves to the repo's
`data/progress.json`, which holds the user's real progress. **Never drive tests
against http://127.0.0.1:8765.**

1. Make two isolated copies (no repo changes):
   ```
   S=<scratch dir>
   R=<repo>
   mkdir -p $S/head $S/new $S/fixtures
   git -C "$R" archive --format=tar HEAD . | tar -x -C $S/head
   cp -r "$R"/index.html "$R"/css "$R"/js $S/new/          # feature build (working tree)
   cp "$R"/data/progress.json $S/fixtures/real-main.json   # realistic main fixture, has no `words`
   ```
2. Serve each with a plain static server (no `/api/*`, so `FILES.detectServer()`
   returns null and nothing is auto-saved to disk):
   `python -m http.server 8801 --bind 127.0.0.1 -d $S/head` and
   `python -m http.server 8802 --bind 127.0.0.1 -d $S/new`.
   Different ports = different origins = separate localStorage.
3. Ensure no gist token on either origin: `localStorage.removeItem('ctt.gist.token'); localStorage.removeItem('ctt.gist.id')`.
4. Save the harness below as `$S/head/t.js` and `$S/new/t.js` (copies only), and
   after every page load run:
   `await new Promise(r => { const s = document.createElement('script'); s.src = '/t.js?' + Date.now(); s.onload = r; document.head.appendChild(s); })`
5. Step 0 discovery on the new build, record the output in the run log:
   `Object.keys(CTT)`, `Object.keys(CTT.ENGINE)`, `Object.keys(CTT.CONTENT)`,
   `Object.keys(CTT).filter(k => /word/i.test(k))`, the id of the words-target
   input in the settings dialog (`[...document.querySelectorAll('#settings input')].map(i => i.id)`),
   and the Stats toggle buttons (`document.querySelectorAll('#statsView button')`).
   Tests below are written black-box (UI + localStorage) so they do not depend on
   the internal words API.

Note: app state (`let state`, app.js:6) is not on `window`. Read it from
localStorage `ctt.v1`, which `persist()` (app.js:190) writes after every lesson,
`setMode`, settings change, unlock, import and reset.

### Harness `t.js`

```js
window.T = (function () {
  const C = window.CTT;
  const realNow = Date.now.bind(Date), realPerf = performance.now.bind(performance), realRandom = Math.random;
  let clock = null, perf = 0;
  const ORDER = 'etaoinsrhldcumfpgwybvkxjqz';
  const T = {
    ORDER,
    freeze(ts) { clock = ts; Date.now = () => clock; },          // NB: new Date() with no arg is NOT patched
    tick(ms) { clock += ms; },
    thaw() { Date.now = realNow; clock = null; },
    keyMs(ms) { perf = realPerf(); performance.now = () => (perf += ms); }, // each call advances: t per key = ms
    seedRandom(seed) { let a = seed >>> 0; Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; },
    unseed() { Math.random = realRandom; },
    st() { return JSON.parse(localStorage.getItem('ctt.v1')); },
    seed(obj) { localStorage.setItem('ctt.v1', JSON.stringify(obj)); localStorage.removeItem('ctt.v1.prev'); location.reload(); },
    mainSnap(s) {                         // every main-state field, as JSON
      s = JSON.parse(JSON.stringify(s));
      delete s.savedAt; delete s.mode; delete s.words; delete s.warm;
      if (s.settings) delete s.settings.wordsTargetWpm;
      return JSON.stringify(s);
    },
    wordsSnap(s) { return JSON.stringify(s.words); },
    mainDerived(state) {                  // every main engine output
      const E = C.ENGINE, TR = C.CONTENT.TRAIN, now = Date.now();
      return JSON.stringify({
        plan: E.plan(state), focus: E.focusKey(state), unl: E.unlockedList(state),
        unlock: E.unlockStatus(state, now), unlockText: CTT.unlockText(E.unlockStatus(state, now), TR[state.unlocked]),
        weak: E.weakLetters(state, now), weakness: TR.map((c) => E.weakness(state, c)),
        statsT: TR.map((c) => E.stats(state, c, now)), statsL: E.LETTERS.map((c) => E.stats(state, c, now)),
        statsSpace: E.stats(state, ' ', now), conf: E.allConfusions(state, 50), pairs: E.slowPairs(state, 50),
      });
    },
    mainReport(state) {                   // report without the appended Words section and the Generated line
      const r = C.REPORT.build(state);
      return r.split('\n## Words mode (separate from the symbol stats)')[0].replace(/^Generated: .*$/m, '');
    },
    mode(m) { document.querySelector('.modes button[data-mode="' + m + '"]').click(); },
    esc() { T.press('Escape'); },
    text() {
      return [...document.querySelectorAll('#textbox > span')]
        .filter((s) => !s.classList.contains('muted'))
        .map((s) => (s.classList.contains('nl') ? '\n' : s.textContent)).join('');
    },
    press(ch, extra) {
      const m = C.LAYOUT.charMap[ch] || {};
      const key = ch === '\n' ? 'Enter' : ch;
      const code = ch === 'Escape' ? 'Escape' : ch === 'Backspace' ? 'Backspace' : m.code || '';
      document.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key, code, shiftKey: !!C.LAYOUT.requiredShift(ch), bubbles: true, cancelable: true }, extra || {})));
    },
    // Types the whole current lesson. errAt(i, ch) -> wrong char to press before char i, or null.
    typeLesson({ ms = 200, errAt = null, upTo = Infinity } = {}) {
      if (document.activeElement) document.activeElement.blur();
      const spans = [...document.querySelectorAll('#textbox > span')];
      if (!spans.length || spans[0].classList.contains('muted')) throw new Error('no lesson');
      const chars = spans.map((s) => (s.classList.contains('auto') ? null : s.classList.contains('nl') ? '\n' : s.textContent));
      const stop = T.st().settings.stopOnError;
      T.keyMs(ms);
      let typed = 0;
      for (let i = 0; i < chars.length && typed < upTo; i++) {
        const ch = chars[i];
        if (ch === null) continue;
        const w = errAt && errAt(i, ch);
        if (w && w !== ch) { T.press(w); if (!stop) { typed++; continue; } }
        T.press(ch); typed++;
      }
      return chars.filter((c) => c !== null).join('');
    },
    wrongFor(ch) { return ch === 'x' ? 'z' : 'x'; },
    dom() {                               // main-mode visible output
      const h = (id) => (document.getElementById(id) || {}).innerHTML;
      return JSON.stringify({ strip: h('keystrip'), focus: h('focusLine'), wpm: h('mWpm'), acc: h('mAcc'), shift: h('mShift'), today: h('mToday'), wpmD: h('mWpmD'), accD: h('mAccD') });
    },
    statsDom() {
      const h = (id) => document.getElementById(id).innerHTML;
      return JSON.stringify({ summary: h('summary'), rows: h('keyRows'), mix: h('mixList'), pairs: h('pairList'), letters: h('letterList'), chart: document.getElementById('chart').toDataURL() });
    },
    errors: [],
  };
  window.addEventListener('error', (e) => T.errors.push(String(e.message)));
  window.addEventListener('unhandledrejection', (e) => T.errors.push(String(e.reason)));
  return T;
})();
```

Fixtures (build in console, keep as JSON files in `$S/fixtures`):
- **F_REAL**: `real-main.json` (real user progress, no `words`).
- **F_SYN**: `STORE.defaults()` with `unlocked: 14`, `sinceUnlock: 4`,
  `focusRun: {ch:'=', lessons:2, startConf:0.3}`, `cooldown: {'[':2}`, 20
  main lessons (mixed modes, 5 with `ts` = today), and for keys `( ) [ ] _ : = " ' , . { } +`
  plus letters `e r t a s` and `' '`: 60 hist samples each spread over the last
  10 days, with letter `r` at 70% accuracy (so main `weakLetters` = `['r', ...]`),
  confusions on `_`->`-` and `r`->`t`, pairs `s(`, `(e` with 8 samples each,
  one key with `level: 2, due` in the past. No `words`.
- **F_W(n)**: F_SYN plus a populated `words`: `unlocked: n`, `sinceUnlock: 3`,
  `keys` for the first n letters with 40 samples each, `confusions: {e:[{c:'r',ts}]}`,
  `pairs: {}`, `cooldown: {}`, `focusRun: null`, 12 `lessons` (`mode:'words'`), and
  `settings.wordsTargetWpm: 35`. Build `n = 10, 25, 26`.

Unless a test says otherwise: freeze `T.freeze(T0)` where `T0` = today 12:00
local, `settings.stopOnError: true`, run `T.errors` check at the end (pass needs
`T.errors.length === 0` and no console errors).

---

## 1. Isolation and non-regression of the main symbol mode

### ISO-1 [MUST] Deep main-state snapshot unchanged by Words practice
- Setup: new build, `T.seed(F_SYN)`, load harness, `T.freeze(T0)`.
- Steps: `A = T.mainSnap(T.st())` after `T.mode('adaptive')` (forces a persist).
  `T.mode('words')`. Type 15 Words lessons with `T.typeLesson({ms:180, errAt:(i,c)=> i%7===3 ? T.wrongFor(c) : null})`
  (advance `T.tick(60000)` between lessons). Then `T.mode('adaptive')`; `B = T.mainSnap(T.st())`.
- Pass: `A === B` (byte-identical, includes `keys`, `confusions`, `pairs`,
  `cooldown`, `focusRun`, `unlocked`, `sinceUnlock`, `lessons`, `mycode`,
  `settings` minus `wordsTargetWpm`, `v`). Also `T.st().words.lessons.length === 15`.

### ISO-2 [MUST] Main engine outputs unchanged
- Same run as ISO-1. Before Words lessons: `D1 = T.mainDerived(CTT.STORE.merge(T.st()))`;
  after: `D2 = ...` (both with `Date.now` frozen at the same `T0`).
- Pass: `D1 === D2` (plan incl. `letters`, focusKey, unlockStatus, unlockText,
  weakLetters, weakness, stats for all TRAIN symbols, all 26 letters and space,
  confusions, slow pairs).

### ISO-3 [MUST] Main report unchanged except the appended section
- Same run, `T0` frozen. `R1 = CTT.REPORT.build(merge(before))`, `R2 = ...(after)`.
- Pass, all of:
  - `T.mainReport(state_before) === T.mainReport(state_after)`.
  - `R2` contains `'## Words mode (separate from the symbol stats)'` exactly once,
    and it is the last `## ` heading: `R2.lastIndexOf('\n## ') === R2.indexOf('\n## Words mode (separate from the symbol stats)')`.
  - Main sections (`## Summary`, `## Trend by mode`, `## Recent lessons`) contain no
    row with mode `words`, and `## Letters` rows are identical to before.
- Caveat: report "min today" uses real `new Date()` (report.js:24); do not run across midnight.

### ISO-4 [MUST] Cross-version: new build's main output equals HEAD's
- Setup: same fixture seeded in both `:8801` (HEAD) and `:8802` (new); same frozen `T0`.
  Run with F_REAL and F_SYN, and with F_W(10) (HEAD ignores `words`).
- Steps on each page: `T.mainDerived(CTT.STORE.merge(T.st()))`, `T.mainReport(CTT.STORE.merge(T.st()))`,
  and after `T.mode('adaptive')`: `T.dom()`; open Stats (Symbols view): `T.statsDom()`.
  Use the same browser window size for both (canvas data URL depends on size).
- Pass: all four strings identical between HEAD and new. (Mode button bar and
  the stats toggle are outside the compared nodes.) The `Settings:` line of the
  report must also be identical (no words target added to it).

### ISO-5 [MUST] Cross-version main content generation (shared content.js state)
- Purpose: words generation must not perturb main text generation (e.g. via the
  module-level `weakLetters` in content.js:149, or changes to TEMPLATES/LINES).
- Steps, on both builds, F_SYN, `T0` frozen. On new build first generate 50
  Words lessons (`T.mode('words')`, 50x `T.esc()`), then `T.mode('adaptive')`. Then:
  `T.seedRandom(42); const s = CTT.STORE.merge(T.st()); const p = CTT.ENGINE.plan(s);`
  `out = [0,1,2,3,4].map(()=>CTT.CONTENT.adaptive(CTT.ENGINE.unlockedList(s), p, 70)).concat([0,1,2].map(()=>CTT.CONTENT.lines(c=>CTT.ENGINE.weakness(s,c),3,CTT.ENGINE.weakLetters(s))))`; `T.unseed()`.
  Repeat with `p.phase='learn'`.
- Pass: `JSON.stringify(out)` identical HEAD vs new. If it differs, the diff must be
  shown to be a pure refactor; otherwise fail.

### ISO-6 [MUST] Letters typed in Words do not reach main weak-letter mixing
- Setup: F_SYN (main `weakLetters` contains `r`, not `e` or `a`).
- Steps: Words mode, 10 lessons with every `e` and `a` mistyped once
  (`errAt:(i,c)=> 'ea'.includes(c) ? T.wrongFor(c) : null`).
- Pass: main `state.keys.e`, `state.keys.a` and `state.confusions.e/a` byte-identical
  to before; `ENGINE.weakLetters(main)` unchanged; main Adaptive focus line text
  (`#focusLine` "letters" part) unchanged; `T.st().words.keys.e.hist` contains the
  failures (proves recording went to words).

### ISO-7 [MUST] Main practice does not write to words state
- Setup: F_W(10) on new build.
- Steps: `W = T.wordsSnap(T.st())`; type 3 Adaptive lessons, 2 Lines lessons,
  1 My-code lesson (save some code first), each with errors on letters.
- Pass: `T.wordsSnap(T.st()) === W`; main `keys`/`lessons` did change (sanity).

### ISO-8 [MUST] Per-mode counters: sinceUnlock / cooldown / focusRun
- Setup: F_W(10).
- Steps & pass:
  - 1 Words lesson: `words.sinceUnlock` +1; main `sinceUnlock` unchanged; main
    `cooldown`, `focusRun` unchanged; `words.focusRun.ch` equals the focus letter
    shown in `#focusLine` before the lesson.
  - 1 Adaptive lesson: main `sinceUnlock` +1, main `cooldown['[']` decremented;
    `words.sinceUnlock`, `words.cooldown`, `words.focusRun` unchanged.
  - 1 Lines lesson: neither `sinceUnlock` changes.

### ISO-9 [MUST] Mode switch mid-lesson
- (a) Words -> Adaptive: in Words, `T.typeLesson({upTo: 15, errAt:(i,c)=>i===4?T.wrongFor(c):null})`,
  then `T.mode('adaptive')`. Pass: main snapshot unchanged; no new lesson in
  `lessons` or `words.lessons`; `words.sinceUnlock` unchanged; any new samples
  are in `words.keys` only and only under a-z keys (HEAD records per keystroke,
  app.js:534, so partial samples are expected and must land in words).
- (b) Adaptive -> Words: type 15 chars of an Adaptive lesson, switch to Words.
  Pass: `words` snapshot unchanged; main gains the partial samples exactly as HEAD
  does (compare with the same sequence on HEAD using `T.seedRandom(7)` before the
  first lesson is built, i.e. seed then `T.mode('adaptive')`).
- (c) Words -> Warmup -> Words, Words -> Lines -> Words: same pass conditions.

### ISO-10 [MUST] Esc and Backspace in Words mode
- Esc: type 10 chars in Words then `T.esc()`. Pass: no lesson record anywhere,
  `words.sinceUnlock` unchanged, main snapshot unchanged, new text shown.
- Backspace: set `stopOnError:false` (seed). In Words, press a wrong key at
  position 3, `T.press('Backspace')`, then the correct key, finish the lesson.
  Pass: that letter has exactly one extra failed sample in `words.keys` and the
  retyped correct key at that position added no ok sample (same as HEAD
  `errorsAt` rule, app.js:531); lesson `errors === 1`; main snapshot unchanged.

### ISO-11 [MUST] Settings "Unlock next symbol" acts on the current mode
- Setup: F_W(10). Patch nothing; read toast from `#toast`.
- For each mode in `adaptive, lines, mycode, warmup`: select it, open Settings
  (`settingsBtn.click()`), click `#sUnlock`, close dialog (`settings.close()`).
  Pass: main `unlocked` +1 each time, `words.unlocked` stays 10.
- In `words`: click `#sUnlock` 3x. Pass: `words.unlocked` 10 -> 13, unlocked
  letters are `d c u` in that order (toast shows each), `words.sinceUnlock === 0`,
  main `unlocked`/`sinceUnlock` unchanged, keystrip shows 13 unlocked letters.
- With F_W(26) in Words: click once. Pass: toast says all are unlocked, no
  change, no error. With main at 26 in Adaptive: same for main.

### ISO-12 [MUST] Settings dialog open/close does not alter other mode's settings
- Setup: F_W(10) with `targetWpm: 42`, `wordsTargetWpm: 35`.
- Steps: in Words, open and close Settings; in Adaptive, open and close.
  Change only the words target input to 50, close. Change only `#sTarget` to 44, close.
- Pass: after the open/close cycles `targetWpm === 42`, `wordsTargetWpm === 35`;
  after edits `wordsTargetWpm === 50` with `targetWpm === 42`, then `targetWpm === 44`
  with `wordsTargetWpm === 50`. Main snapshot otherwise unchanged.

### ISO-13 [MUST] Export / import round trip
- Setup: F_W(25), then 2 Words and 2 Adaptive lessons. `S0 = T.st()`.
- Export: `let blob; URL.createObjectURL = (b) => (blob = b, 'blob:x'); HTMLAnchorElement.prototype.click = () => {};`
  then `document.getElementById('sExport').click(); E = JSON.parse(await blob.text())`.
  Pass: `T.mainSnap(E) === T.mainSnap(S0)` and `JSON.stringify(E.words) === JSON.stringify(S0.words)`.
- Reset (ISO-14 steps), then import: `const dt = new DataTransfer(); dt.items.add(new File([JSON.stringify(E)], 'b.json', {type:'application/json'})); const inp = document.getElementById('sImportFile'); inp.files = dt.files; inp.dispatchEvent(new Event('change'));` (await a tick).
  Pass: main and words snapshots equal `S0`'s; Words keystrip shows 25 unlocked.

### ISO-14 [MUST] Reset clears both, confirm text says so
- `window.confirm = (m) => (T.lastConfirm = m, false)`; click `#sReset`. Pass: state unchanged.
- `window.confirm = (m) => (T.lastConfirm = m, true)`; click `#sReset`.
  Pass: `T.lastConfirm` mentions both (matches `/word/i` and symbol/progress);
  main fields equal `STORE.defaults()` main fields; `words` equals default words
  (`unlocked: 10`, empty `keys/confusions/pairs/cooldown/lessons`, `focusRun: null`,
  `sinceUnlock: 0`); `settings` preserved including `wordsTargetWpm`.

### ISO-15 [MUST] Old save without `words` loads
- Seed F_REAL and F_SYN on new build.
- Pass: no errors; no `ctt.v1.unreadable-*` key created; after `T.mode('adaptive')`
  the stored state has `words` equal to defaults and `settings.wordsTargetWpm === 35`;
  `T.mainSnap` equals HEAD's `T.mainSnap(CTT.STORE.merge(fixture))` (cross-version,
  same frozen clock because merge stamps missing `ts` with `Date.now()`, store.js merge v1->v2 loop).

### ISO-16 [MUST] Old code (HEAD) loading a new save
- Seed F_W(25) (after a few real Words lessons on new build, exported via ISO-13) into HEAD `:8801`.
- Pass: page boots with `T.errors.length === 0`; Adaptive/Lines lessons work; HEAD
  report builds. [SHOULD] after one Adaptive lesson on HEAD,
  `JSON.stringify(T.st().words)` is unchanged (HEAD `merge` keeps unknown keys via `...raw`, store.js:41).

### ISO-17 [MUST] Corrupted `words` never costs main progress
- Purpose: an exception inside `STORE.merge` makes `load()` treat the whole save
  as unreadable and fall back to `.prev` or defaults (store.js:67-83), which would
  drop main progress.
- For each `words` value: `null`, `'x'`, `42`, `[]`, `{}`, `{unlocked:'7'}`, `{unlocked:NaN}`
  (stored as null), `{unlocked:-3}`, `{unlocked:99}`, `{keys:null}`, `{keys:{e:{hist:'bad'}}}`,
  `{keys:{e:{hist:[{ok:1,t:200}]}}}` (no ts), `{keys:{E:{hist:[]},'(':{hist:[]}}}`,
  `{lessons:{}}`, `{confusions:[]}`, `{focusRun:{ch:'#'}}`, `{cooldown:{e:'x'}}`:
  seed F_SYN + that `words`, reload.
- Pass: no `ctt.v1.unreadable-*` key; `T.mainSnap(T.st())` (after `T.mode('adaptive')`)
  equals F_SYN's main snapshot; Words mode builds a non-empty lesson and one lesson
  can be typed with no errors thrown; after it, `words.unlocked` is an integer in
  [1, 26] (expected 10 for invalid values), `keys/confusions/pairs/cooldown` are
  plain objects, `lessons` is an array, and Stats -> Words renders.

### ISO-18 [MUST] Sync / server payloads carry `words`
- Server save: `const orig = fetch; let body; window.fetch = async (u, o) => { if (String(u).includes('api/load')) return new Response(JSON.stringify({ok:true, progress:null})); if (String(u).includes('api/save')) { body = JSON.parse(o.body); return new Response('{"ok":true}'); } return orig(u, o); }; await CTT.FILES.detectServer();`
  Type one Words lesson. Pass: `body.progress.words` deep-equals `T.st().words`,
  `body.report` ends with the Words section, main part of `body.progress` equals `T.st()` main.
- Gist push: with the same fetch mock also answering `api.github.com` PATCH (capture
  body), set dummy `ctt.gist.token='dummy'`, `ctt.gist.id='g'` (fetch is mocked, nothing leaves), call
  `CTT.SYNC.push(T.st(), CTT.REPORT.build(CTT.STORE.merge(T.st())), 0)`; await 50 ms.
  Pass: parsed `files['code-typing-trainer-progress.json'].content` has `words`.
  Remove both dummy keys afterwards.
- Size [MUST]: build a max state (F_REAL + `words.keys` for 26 letters x 150 hist,
  26 x 50 confusions, `words.lessons` x 1000). Pass: `JSON.stringify({progress, report}).length < 5_000_000`
  (server.py `MAX_BODY`), and `localStorage` save succeeds (`T.st().words.lessons.length` matches).

### ISO-19 [MUST] Warmup unchanged and records nothing
- Setup: F_W(10). `S = T.st()`.
- Steps: `T.mode('warmup')`; type 2 warmup lessons with errors.
- Pass: `T.mainSnap(T.st()) === T.mainSnap(S)` and `T.wordsSnap(...)` equal;
  only `warm` changed. Warmup `#focusLine` and panel identical to HEAD.

---

## 2. Words engine correctness

Text sampling: `T.mode('words')`, then for k in 1..N: `T.esc(); texts.push({t: T.text(), focus: document.querySelector('#focusLine b')?.textContent})`.
Use `lessonLen` 70 unless stated.

### ENG-1 [MUST] Starting state and unlock order
- Fresh origin (`localStorage.clear()`, reload), `T.mode('words')`.
- Pass: keystrip shows 26 letters in order `etaoinsrhldcumfpgwybvkxjqz`; first 10
  unlocked, 16 have class `locked`; after `#sUnlock` x16 in Words, the unlock
  sequence (toasts / keystrip) is exactly `dcumfpgwybvkxjqz`.

### ENG-2 [MUST] Lesson text uses only unlocked letters (fuzz)
- For `n` in {10, 11, 15, 20, 25}: seed F_W(n), sample 300 lessons.
- Pass: every char of every text is in `new Set(ORDER.slice(0, n) + ' ')`;
  no empty text; no leading/trailing/double spaces.

### ENG-3 [MUST] Every generated character is typeable
- Over all texts from ENG-2 and ENG-7: every char `c` satisfies
  `c === ' ' || c === '\n' || CTT.LAYOUT.charMap[c]`. (Catches curly quotes,
  em dashes, accented letters in sentences.)

### ENG-4 [MUST] Focus letter share about half
- F_W(15), 300 lessons. Per lesson split tokens on spaces; share = tokens
  containing the focus letter / tokens.
- Pass: focus shown for every lesson; focus is an unlocked letter; mean share
  in [0.35, 0.75] over lessons in mix phase (`#focusLine` starts with "Focus").
  For learn-phase lessons (starts with "Learning"), mean share >= 0.35.

### ENG-5 [MUST] No identical consecutive words
- All texts from ENG-2/ENG-4/ENG-7 (sentence lessons included): `toks[i] !== toks[i-1]` for all i.

### ENG-6 [MUST] Lesson length tracks the setting
- For `lessonLen` 30, 70, 200 (via Settings): 100 lessons each, word phase.
- Pass: `lessonLen - 1 <= text.length <= lessonLen + 25` for every word-phase lesson.
  Sentence-phase lessons: `text.length >= 0.5 * lessonLen` and `<= max(2*lessonLen, longest single sentence + lessonLen)`.

### ENG-7 [MUST] Sentence phase only when all 26 unlocked
- F_W(25): 300 lessons. Pass: zero lessons with any char outside `[a-z ]`.
- F_W(26): 400 lessons. Sentence lesson = contains `[A-Z]` or punctuation.
  Pass: sentence share in [0.35, 0.65]; sentence lessons contain at least one
  capital and one of `. ,`; non-sentence lessons are `[a-z ]` only.
- [SHOULD] Originality: grep the sentence list in source; no sentence longer
  than 12 words matches a quick web search verbatim (manual spot check of 5).

### ENG-8 [MUST] Only a-z are recorded; no pair timings
- F_W(26), Words. Type 4 sentence lessons (Esc until a sentence appears), mistyping
  every capital, space and punctuation once and every 10th letter.
- Pass: `Object.keys(words.keys)` and `Object.keys(words.confusions)` all match `/^[a-z]$/`;
  `words.pairs` is `{}`; letter failures equal the number of mistyped letters;
  main `keys[' ']`, `keys['.']`, `keys[',']`, `pairs`, `confusions` unchanged
  (punctuation pairs would otherwise be recorded, app.js:540-541);
  `words.lessons.at(-1).errors` counts all mistyped positions (lesson accuracy
  still includes non-letters).

### ENG-9 [MUST] Same-hand Shift counted in Words lesson record
- F_W(26), get a sentence lesson. For each capital `C`, let `req = CTT.LAYOUT.requiredShift(C)`
  and `wrong = req === 'ShiftLeft' ? 'ShiftRight' : 'ShiftLeft'` (the same-hand Shift).
  Dispatch `keydown {key:'Shift', code: wrong}`, then `T.press(C)` (sends `shiftKey:true`),
  then `keyup {key:'Shift', code: wrong}`. Type all other chars normally.
- Pass: `words.lessons.at(-1).sameHand === number of capitals` and `shifted` >= that;
  header `#mShift` shows it; main lessons unchanged.

### ENG-10 [MUST] Mastery uses `wordsTargetWpm`, not `targetWpm`
- Case A: seed F_W(10) with `targetWpm: 80`, `wordsTargetWpm: 35`, empty `words.keys`.
  Day 1 (`T.freeze(D1 10:00)`): type 6 Words lessons with `ms: 200` (60 WPM), no errors.
  Pass: `words.keys.e.passDays.length === 1`, `level === 0`.
  Day 2 (`T.freeze(D1 + 1 day 10:00)`): 3 lessons, same speed. Pass: `words.keys.e.level === 1`,
  `due === Date.now()+1 day` (within the lesson), toast "Mastered: e".
- Case B: same with `targetWpm: 30`, `wordsTargetWpm: 80`. Pass: after both days,
  `words.keys.e.level === 0` and no `passDays`.
- Case C: day 2 repeated on the same calendar day as day 1 (D1 + 3h). Pass: still level 0.
- All cases: main snapshot unchanged.

### ENG-11 [MUST] Stall unlock in Words
- Seed F_W(10) where 7 letters have `good: true` and solid hist, 3 letters (`h l r`)
  are not good (acc 85%, slow) and none below 70%; `words.sinceUnlock: 9`.
- Steps: type 1 Words lesson at `ms: 600`, no errors.
- Pass: `words.unlocked === 11`, `words.sinceUnlock === 0`, toast contains `d`;
  main `unlocked`, `sinceUnlock` unchanged.
- Negative: same but one letter at 60% accuracy (`low`). Pass: no unlock, Stats ->
  Words "next" text names that letter.
- Negative: 4 letters not good. Pass: no unlock after the lesson.

### ENG-12 [SHOULD] Unlock when all good
- Seed 10 letters all good. One Words lesson -> `words.unlocked === 11` and toast
  without "(keep drilling ...)".

### ENG-13 [SHOULD] Focus rotation on words sub-state
- Seed F_W(10) with `focusStyle: 'mixed'`. Type 5 Words lessons at constant slow
  speed (`ms: 700`) with errors on the focus letter so confidence does not rise.
- Pass: after lesson 5, `words.cooldown[f] === 3`, `words.focusRun === null`, toast
  "Rotating off f"; next lesson focus differs; main `cooldown`/`focusRun` unchanged.

### ENG-14 [SHOULD] Review and demotion on words sub-state
- Seed `words.keys.e` with `level: 2, due: T0 - 1h`, good hist. Type Words lessons
  mistyping `e` ~50% until `rev.n >= 6`. Pass: `level === 0`, toast "Review missed: e".
- Seed `level: 1, due` in future, then 40 samples at 70% acc. Pass: demoted with
  "has dropped below 90%" toast.

### ENG-15 [SHOULD] Non-focus words favor weak letters
- F_W(15) with words letter `c` at 60% (eff >= 8). 300 lessons; rate of tokens
  containing `c` among tokens without the focus letter, vs the same with `c` at 100%.
- Pass: weak rate >= 1.3x the baseline rate.

---

## 3. UI

### UI-1 [MUST] Mode button
- Pass: `.modes button[data-mode]` order is `adaptive, lines, mycode, words, warmup`;
  clicking Words sets `on` on it only; `T.st().mode === 'words'`; reload keeps Words.

### UI-2 [MUST] Stats toggle
- F_W(10) with main and words lessons. Open Stats.
- Pass: Symbols active by default (also after reload while in Words mode); Symbols
  view `T.statsDom()` equals HEAD's for the same fixture (ISO-4). Switch to Words:
  `#keyRows` has 26 rows in `ORDER` with 16 `locked`; summary shows `10/26` and
  words lesson count 12; chart differs from Symbols chart (`toDataURL` differs);
  mix-ups list shows `e -> r`. Switch back: `T.statsDom()` byte-equal to first render.
- Resize while in Words view: `window.dispatchEvent(new Event('resize'))`; pass:
  chart `toDataURL()` unchanged (HEAD resize handler redraws `state.lessons`, app.js:777).

### UI-3 [MUST] Keystrip, focus line, unlock text per mode
- Words: `#keystrip` children text = ORDER, focus class on the letter named in
  `#focusLine`; focus line mentions a letter, not a symbol; any unlock text names
  the next letter (`d`) and does not say "symbol" or "adaptive lesson".
- Switch to Adaptive: `T.dom()` strip and focus equal the pre-Words values.
- Changing a setting (`readSettings` re-renders the strip, app.js:809) while in Words:
  strip still shows letters.

### UI-4 [MUST] Header metrics per mode
- Seed main lessons today totalling 120000 ms (last: wpm 40, acc 0.95) and words
  lessons today totalling 300000 ms (last: wpm 25, acc 0.9), `ts` = real now.
- Pass: Adaptive shows `40`, `95%`, Today `2m`; Words shows `25`, `90%`, Today `5m`;
  after a Words lesson the delta compares only with prior words lessons; switching
  back to Adaptive restores `40`/`95%`/`2m` exactly (`T.dom()` equal to before).
- Lines and My code show the same as HEAD for the same fixture.

### UI-5 [MUST] Warmup UI unchanged
- Warmup panel, focus line, keymap highlight identical to HEAD (DOM compare).

### UI-6 [SHOULD] Words-target setting control
- Present, labelled, shows 35 on a fresh save; invalid input (empty, 3, 999) leaves
  a finite value in a sane range (never `null`/`NaN` in `T.st().settings.wordsTargetWpm`).

---

## 4. Edge cases

### EDGE-1 [MUST] Empty or tiny pools
- `words.unlocked` forced to 1 and 2 via seed (if the implementation clamps to 10,
  verify the clamp instead). Pass: generation returns within 200 ms, no throw, text
  non-empty or a clear message, typing it records only unlocked letters.
- Focus letter with few/no matching words: seed `words.unlocked: 11` and make `d`
  the weakest so it is focus. Pass: lesson builds, contains `d` in >= 1 token, no hang.
- Generation time: `performance` measurement of 100x `T.esc()` in Words < 2 s total.

### EDGE-2 [MUST] Extreme lesson lengths (not clamped by merge)
- Seed `lessonLen` 1, 5, 1000, 100000. Pass: each Words lesson builds within 500 ms,
  non-empty, length < 5000 chars; main Adaptive behaves as HEAD for the same values.

### EDGE-3 [MUST] All 26 unlocked
- F_W(26): Words strip has no locked letter; unlock text "all ... unlocked";
  Settings unlock is a no-op with a message; a Words lesson completes with no
  `undefined` in any toast (`TRAIN[26]` style bug, engine.js:292).

### EDGE-4 [SHOULD] Words lessons history cap
- Seed 1500 `words.lessons`; type one. Pass: `words.lessons.length <= 1000`
  (main is capped in `STORE.save`, store.js:87; words has no cap unless added).

### EDGE-5 [SHOULD] Gist connect with words-only local progress
- Local: `lessons: []`, `words.lessons` x 5. Remote (mocked `/gists/<id>` content):
  3 main lessons, older `savedAt`. Mock `/user`, `/gists` list. Connect.
- Pass: local words progress is not silently replaced (either kept or the user is
  asked). HEAD logic counts only `state.lessons` (app.js:209, 264-265), so it would
  adopt the remote copy without asking.

---

## 5. Release gate

All [MUST] tests pass on the new build at `:8802`, cross-version tests (ISO-4,
ISO-5, ISO-15, ISO-16) pass against HEAD at `:8801`, and `T.errors` is empty for
every run. Finally, before shipping, start the real app once and confirm it loads
the user's real `data/progress.json` with identical main stats (compare
`T.mainReport` against HEAD with the same file, read-only, no lessons typed).

---

## 6. Highest-risk areas in the current code (HEAD line numbers)

1. **Recording in the typing loop** app.js:531-543, 554-557: every keystroke is
   recorded straight into `state` (keys, confusions) and punctuation pairs into
   `state.pairs` (app.js:540-541). Words mode must route to `state.words`, filter
   to a-z, skip pairs, and key off `L.mode` (captured per lesson), not `state.mode`.
2. **Engine reads main fields by name** engine.js:41, 46, 77, 85, 115, 129,
   141-142, 154, 213, 265-286, 290, 307-321: `state.keys/confusions/pairs/cooldown/focusRun/unlocked/sinceUnlock`,
   `settings.targetWpm`, and the symbol `TRAIN` list for "locked". A words view
   must swap all of them, including `targetWpm` -> `wordsTargetWpm`. `afterLesson` only
   advances `sinceUnlock`/cooldown/focusRun when `mode === 'adaptive'` (engine.js:265),
   so passing `'words'` silently disables stall unlock and rotation. Event text
   says "symbol" (engine.js:292) and `unlockText` says "adaptive lesson" (engine.js:354-359).
3. **`STORE.merge` / `load` failure path** store.js:36-61, 67-83: `...raw` passes a
   raw `words` through un-normalized, and any exception in merge makes `load()`
   discard the whole save (main progress included) for `.prev`/defaults.
   `save()` caps only `state.lessons` (store.js:87).
4. **Shared mutable generator state** content.js:149-156, 193-196: module-level
   `weakLetters` used by `pickId`; a words generator that sets it without the
   try/finally reset biases later main lessons.
5. **Main-only renderers that must branch on mode/view** app.js:375-397 (strip,
   called after every lesson and every settings change, app.js:634, 809),
   app.js:399-422 (focus line), app.js:487-507 (metrics read `state.lessons`,
   "Today" sums all), app.js:710-765 (stats) and app.js:777 (resize redraws
   `state.lessons` regardless of the toggle), app.js:813-818 (`sUnlock` always
   calls `forceUnlock(state)`), app.js:795-812 (`readSettings` runs on every dialog
   close and clamps fields; a missing words input would reset `wordsTargetWpm`).
6. **Report** report.js:34 (Settings line), 50 (mode loop), 107: the Words section
   must be appended after line 106 only, leaving every earlier byte identical.
7. **Sync conflict heuristic** app.js:209, 264-267: lesson counting ignores
   `words.lessons`, so words-only progress can be overwritten on connect.
8. **Payload size** server.py `MAX_BODY = 5_000_000`: words keys/lessons add to
   every `api/save` and gist PATCH.
