// Words sidecar test harness (sidecar-testplan.md). Loaded after js/app.js in scratch copies
// of index.html, together with sidecar-pre.js (loaded first). Works on HEAD and on the new build.
// A small runner executes tests that span reloads: state lives in sessionStorage 't.run'.
window.T = (function () {
  const C = window.CTT;
  const TP = window.TP;
  const realPerf = TP.real.perf;
  const ORDER = 'etaoinsrhldcumfpgwybvkxjqz';
  const DAY = 86400000;
  const WFILE = 'code-typing-trainer-words.json';
  const MFILE = 'code-typing-trainer-progress.json';
  const RFILE = 'code-typing-trainer-report.md';
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const d0 = new Date(); d0.setHours(12, 0, 0, 0);
  const T0 = d0.getTime();
  const isNew = !!C.WORDS;
  // Tabbed Settings dialog (General | Symbols | Words) with Words-only controls.
  const isNewTabs = !!document.getElementById('sWordsLen');

  const T = {
    ORDER, DAY, T0, WFILE, MFILE, RFILE, wait, isNew, isNewTabs, TP,
    // Artifact label for build comparisons: the build under test vs the baseline (HEAD).
    build: isNewTabs ? 'new' : 'head',
    get errors() { return TP.errors; },
    freeze(ts) { TP.clock = ts; },
    tick(ms) { TP.clock += ms; },
    thaw() { TP.clock = null; },
    keyMs(ms) { let p = realPerf(); performance.now = () => (p += ms); },
    seedRandom(seed) { let a = seed >>> 0; Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; },
    unseed() { Math.random = TP.real.random; },
    st() { return JSON.parse(localStorage.getItem('ctt.v1')); },
    sw() { return JSON.parse(localStorage.getItem('ctt.words.v1')); },
    raw(k) { return localStorage.getItem(k); },
    dump() { return JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)]))); },
    eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); },
    hash(s) { s = String(s); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16) + ':' + s.length; },
    noGen(s) { return String(s).replace(/^Generated: .*$/m, ''); },
    // ---------- UI ----------
    async load(obj, name) {
      const dt = new DataTransfer();
      dt.items.add(new File([typeof obj === 'string' ? obj : JSON.stringify(obj)], name || 'f.json', { type: 'application/json' }));
      const inp = document.getElementById('sImportFile');
      inp.files = dt.files;
      inp.dispatchEvent(new Event('change'));
      await wait(120);
    },
    mode(m) { document.querySelector('.modes button[data-mode="' + m + '"]').click(); },
    onMode() { const b = document.querySelector('.modes button.on'); return b ? b.dataset.mode : null; },
    esc() { T.press('Escape'); },
    text() {
      return [...document.querySelectorAll('#textbox > span')].filter((s) => !s.classList.contains('muted'))
        .map((s) => (s.classList.contains('nl') ? '\n' : s.textContent)).join('');
    },
    strip() {
      const all = [...document.querySelectorAll('#keystrip > div')];
      return { open: all.filter((d) => !d.classList.contains('locked')).map((d) => d.textContent).join(''), locked: all.filter((d) => d.classList.contains('locked')).length };
    },
    press(ch, extra) {
      const m = (C.LAYOUT.charMap && C.LAYOUT.charMap[ch]) || {};
      const key = ch === '\n' ? 'Enter' : ch;
      const code = ch === 'Escape' ? 'Escape' : ch === 'Backspace' ? 'Backspace' : m.code || '';
      const sh = ch.length === 1 && C.LAYOUT.requiredShift ? !!C.LAYOUT.requiredShift(ch) : false;
      document.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key, code, shiftKey: sh, bubbles: true, cancelable: true }, extra || {})));
    },
    typeLesson({ ms = 200, errAt = null, upTo = Infinity } = {}) {
      if (document.activeElement) document.activeElement.blur();
      const spans = [...document.querySelectorAll('#textbox > span')];
      if (!spans.length || spans[0].classList.contains('muted')) throw new Error('no lesson');
      const chars = spans.map((s) => (s.classList.contains('auto') ? null : s.classList.contains('nl') ? '\n' : s.textContent));
      let stop = true;
      try { const s = T.st(); if (s && s.settings) stop = s.settings.stopOnError; } catch (e) { /* no storage */ }
      T.keyMs(ms);
      let typed = 0, errs = 0;
      for (let i = 0; i < chars.length && typed < upTo; i++) {
        const ch = chars[i];
        if (ch === null) continue;
        const w = errAt && errAt(i, ch);
        if (w && w !== ch) { T.press(w); errs++; if (!stop) { typed++; continue; } }
        T.press(ch); typed++;
      }
      performance.now = realPerf;
      return { text: chars.filter((c) => c !== null).join(''), errs };
    },
    wrongFor(ch) { return ch === 'x' ? 'z' : 'x'; },
    err9(i, ch) { return i % 9 === 8 ? T.wrongFor(ch) : null; },
    dom() {
      const h = (id) => (document.getElementById(id) || {}).innerHTML;
      return JSON.stringify({ strip: h('keystrip'), focus: h('focusLine'), wpm: h('mWpm'), acc: h('mAcc'), shift: h('mShift'), today: h('mToday'), wpmD: h('mWpmD'), accD: h('mAccD') });
    },
    statsDom() {
      const h = (id) => document.getElementById(id).innerHTML;
      return JSON.stringify({ summary: h('summary'), rows: h('keyRows'), mix: h('mixList'), pairs: h('pairList'), letters: h('letterList'), chart: document.getElementById('chart').toDataURL() });
    },
    async openSettings() { document.getElementById('settingsBtn').click(); await wait(20); },
    // The browser pane used for these runs never delivers the dialog 'close' event after a
    // scripted close(), so dispatch it ourselves when it did not arrive (the app's handler
    // runs readSettings exactly as after a user close).
    async closeSettings() {
      const d = document.getElementById('settings');
      let fired = false;
      const h = () => { fired = true; };
      d.addEventListener('close', h);
      d.close();
      await wait(40);
      d.removeEventListener('close', h);
      if (!fired) { TP.syntheticClose = (TP.syntheticClose || 0) + 1; d.dispatchEvent(new Event('close')); }
      await wait(30);
    },
    async connect(token) {
      await T.openSettings();
      document.getElementById('sToken').value = token || 'test-token';
      document.getElementById('sConnect').click();
      for (let i = 0; i < 40 && document.getElementById('sConnect').disabled; i++) await wait(50);
      await wait(150);
      await T.closeSettings();
    },
    // ---------- mock gist ----------
    ctl(o) { return TP.real.fetch(TP.MOCK + '/__ctl', { method: 'POST', body: JSON.stringify(o) }).then((r) => r.json()); },
    async mlog() { return (await TP.real.fetch(TP.MOCK + '/__log')).json(); },
    async gist(id) { const s = await (await TP.real.fetch(TP.MOCK + '/__state')).json(); return id ? s.gists[id] : s; },
    async mkGist(files) {
      const f = {};
      if (files.main !== undefined) f[MFILE] = files.main;
      if (files.report !== undefined) f[RFILE] = files.report;
      if (files.words !== undefined) f[WFILE] = files.words;
      const r = await T.ctl({ set: f });
      return r.gists[r.gists.length - 1];
    },
    useGist(id) { localStorage.setItem('ctt.gist.token', 'test-token'); localStorage.setItem('ctt.gist.id', id); },
    wreqs(m) { return TP.reqs.filter((r) => r.tag === 'words' && (!m || r.method === m)); },
    mreqs(m) { return TP.reqs.filter((r) => r.tag === 'main' && (!m || r.method === m)); },
    wordsPatches() { return TP.reqs.filter((r) => r.method === 'PATCH' && r.body && r.body.includes(WFILE)); },
    save(name, obj) { return TP.real.fetch(TP.MOCK + '/__save?name=' + encodeURIComponent(name), { method: 'POST', body: typeof obj === 'string' ? obj : JSON.stringify(obj) }); },
    // ---------- fixtures ----------
    hist(n, acc, now, spanDays, t) {
      const out = [];
      for (let i = 0; i < n; i++) {
        const ok = (i * (1 - acc)) % 1 + (1 - acc) < 1 ? 1 : 0;
        out.push({ ok, t: ok ? (t || 220) : null, ts: now - Math.round(((n - i) / n) * spanDays * DAY) });
      }
      return out;
    },
    fsyn(now) {
      now = now || T0;
      const s = C.STORE.defaults();
      s.unlocked = 14; s.sinceUnlock = 4; s.focusRun = { ch: '=', lessons: 2, startConf: 0.3 }; s.cooldown = { '[': 2 };
      s.lessons = Array.from({ length: 20 }, (_, i) => ({
        ts: i >= 15 ? now - (20 - i) * 60000 : now - (20 - i) * DAY / 2, mode: ['adaptive', 'lines', 'mycode'][i % 3],
        wpm: 30 + i, acc: 0.9 + (i % 5) / 100, chars: 70, errors: 3, sameHand: 0, shifted: 5, dur: 60000,
      }));
      s.keys = {};
      for (const ch of '()[]_:="\',.{}+ertas ') s.keys[ch] = { hist: T.hist(60, ch === 'r' ? 0.7 : 0.95, now, 10), level: 0, due: null };
      s.keys['('].level = 2; s.keys['('].due = now - 3600000;
      s.confusions = { _: [{ c: '-', ts: now - 3600000 }], r: [{ c: 't', ts: now - 3600000 }] };
      s.pairs = { 's(': Array.from({ length: 8 }, (_, i) => ({ t: 300 + i, ts: now - i * 1000 })), '(e': Array.from({ length: 8 }, (_, i) => ({ t: 400 + i, ts: now - i * 1000 })) };
      s.mode = 'adaptive';
      s.mycode = { text: 'def f(x):\n    return [x * 2 for x in range(10)]\n\nprint(f(3), {"a": 1})\n', pos: 0 };
      s.savedAt = now - 1000;
      return s;
    },
    FW(n, now, o) {
      now = now || T0;
      const keys = {};
      for (const ch of ORDER.slice(0, n)) keys[ch] = { hist: T.hist(40, 0.95, now, 5), level: 0, due: null };
      return Object.assign({
        kind: 'ctt-words', v: 1, savedAt: now - 5000,
        // Builds with Words extras store caps/nums/punct; a fixture without them would differ from
        // the stored (merged) copy only by these defaults.
        prefs: Object.assign({ targetWpm: 35, lessonLen: 70 }, isNewTabs ? { caps: 0, nums: false, punct: false } : {}),
        unlocked: n, sinceUnlock: 3, keys, confusions: { e: [{ c: 'r', ts: now - 3600000 }] }, pairs: {}, cooldown: {}, focusRun: null,
        lessons: Array.from({ length: 12 }, (_, i) => ({ ts: now - (12 - i) * 3600000, mode: 'words', wpm: 40, acc: 0.95, chars: 70, errors: 3, sameHand: 0, shifted: 0, dur: 60000 })),
      }, o || {});
    },
    FLEGACY(now) {
      now = now || T0;
      const s = T.fsyn(now);
      const w = T.FW(12, now);
      delete w.kind; delete w.v; delete w.savedAt; delete w.prefs;
      s.words = w; s.mainMode = 'lines'; s.wordsActive = true; s.mode = 'lines'; s.settings.wordsTargetWpm = 40;
      return s;
    },
    view(W) { // engine view of a sidecar copy (like app.js wordsState)
      const v = JSON.parse(JSON.stringify(W));
      Object.defineProperty(v, 'order', { value: C.WORDS.ORDER });
      Object.defineProperty(v, 'settings', { value: Object.assign(C.STORE.defaults().settings, { targetWpm: v.prefs.targetWpm }) });
      return v;
    },
    toastHas(re) { return TP.toasts.some((t) => re.test(t)); },
    // ---------- old-harness compatible helpers for the XV probe ----------
    mainDerived(state) {
      const E = C.ENGINE, TR = C.CONTENT.TRAIN, now = Date.now();
      return JSON.stringify({
        plan: E.plan(state), focus: E.focusKey(state), unl: E.unlockedList(state),
        unlock: E.unlockStatus(state, now), unlockText: CTT.unlockText(E.unlockStatus(state, now), TR[state.unlocked]),
        weak: E.weakLetters(state, now), weakness: TR.map((c) => E.weakness(state, c)),
        statsT: TR.map((c) => E.stats(state, c, now)), statsL: E.LETTERS.map((c) => E.stats(state, c, now)),
        statsSpace: E.stats(state, ' ', now), conf: E.allConfusions(state, 50), pairs: E.slowPairs(state, 50),
      });
    },
    mainReport(state) { return T.noGen(C.REPORT.build(state)); },
    mainSnap(s) { // as in harness.js: legacy Words fields are ignored (HEAD keeps them, the sidecar build strips them)
      s = JSON.parse(JSON.stringify(s));
      delete s.savedAt; delete s.mode; delete s.words; delete s.warm; delete s.wordsActive; delete s.mainMode;
      if (s.settings) delete s.settings.wordsTargetWpm;
      return JSON.stringify(s);
    },
    fw(n, now) { return T.FLEGACY(now); },
  };

  // ---------- runner ----------
  const RKEY = 't.run';
  const getRun = () => JSON.parse(sessionStorage.getItem(RKEY) || 'null');
  const putRun = (r) => sessionStorage.setItem(RKEY, JSON.stringify(r));
  T.TESTS = {};
  T.RELOAD = (cfg) => ({ __reload: true, cfg });
  T.result = (pass, ev) => ({ __result: true, pass: !!pass, ev });
  T.run = function (ids, label) {
    putRun({ label: label || location.port, queue: ids, idx: 0, step: -1, ctx: {}, results: {}, done: false });
    return T.resume();
  };
  T.results = () => (getRun() || {}).results;
  T.resume = async function () {
    let r = getRun();
    if (!r || r.done) return;
    for (;;) {
      if (r.idx >= r.queue.length) {
        r.done = true; putRun(r);
        await T.save('results-' + r.label + '.json', r.results);
        return;
      }
      const id = r.queue[r.idx];
      const steps = T.TESTS[id];
      if (r.step === -1) {
        // prepare: clean origin, clean mock, reload
        sessionStorage.removeItem('t.cfg');
        if (TP.cfg && Object.keys(TP.cfg).length) { location.reload(); return; } // drop per-test hooks first
        localStorage.clear();
        await T.ctl({ reset: true });
        r.step = 0; r.ctx = { errors: [] }; putRun(r);
        location.reload();
        return;
      }
      if (!steps) { r.results[id] = { pass: false, ev: 'no such test' }; r.idx++; r.step = -1; putRun(r); continue; }
      await wait(r.ctx.loadWait || 500);
      let out;
      try {
        out = await steps[r.step](r.ctx);
      } catch (e) {
        out = T.result(false, 'exception: ' + (e && (e.stack || e.message || e)));
      }
      r.ctx.errors = (r.ctx.errors || []).concat(TP.errors.splice(0));
      if (out && out.__reload) {
        r.step++; putRun(r);
        if (out.cfg) sessionStorage.setItem('t.cfg', JSON.stringify(out.cfg)); else sessionStorage.removeItem('t.cfg');
        location.reload();
        return;
      }
      if (out && out.__result) {
        const errs = r.ctx.errors.filter((e) => !(r.ctx.allowErr && new RegExp(r.ctx.allowErr).test(e)));
        r.results[id] = { pass: out.pass && !errs.length, ev: out.ev, errors: errs.length ? errs : undefined };
        r.idx++; r.step = -1; putRun(r);
        continue;
      }
      r.step++; putRun(r);
    }
  };
  return T;
})();
