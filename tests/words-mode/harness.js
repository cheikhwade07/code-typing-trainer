// Test harness for the Words mode test plan (scratchpad copy only, never in the repo).
window.T = (function () {
  const C = window.CTT;
  const realNow = Date.now.bind(Date), realPerf = performance.now.bind(performance), realRandom = Math.random;
  let clock = null, perf = 0;
  const ORDER = 'etaoinsrhldcumfpgwybvkxjqz';
  const DAY = 86400000;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const T = {
    ORDER, DAY, wait,
    freeze(ts) { clock = ts; Date.now = () => clock; },
    tick(ms) { clock += ms; },
    thaw() { Date.now = realNow; clock = null; },
    keyMs(ms) { perf = realPerf(); performance.now = () => (perf += ms); },
    seedRandom(seed) { let a = seed >>> 0; Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; },
    unseed() { Math.random = realRandom; },
    st() { return JSON.parse(localStorage.getItem('ctt.v1')); },
    async load(obj) {
      // In-page seeding through the app's own Import path (merge + persist + boot).
      const dt = new DataTransfer();
      dt.items.add(new File([JSON.stringify(obj)], 'f.json', { type: 'application/json' }));
      const inp = document.getElementById('sImportFile');
      inp.files = dt.files;
      inp.dispatchEvent(new Event('change'));
      await wait(80);
    },
    mainSnap(s) {
      s = JSON.parse(JSON.stringify(s));
      delete s.savedAt; delete s.mode; delete s.words; delete s.warm; delete s.wordsActive; delete s.mainMode;
      if (s.settings) delete s.settings.wordsTargetWpm;
      return JSON.stringify(s);
    },
    wordsSnap(s) { return JSON.stringify(s.words); },
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
    mainReport(state) {
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
    focusLetter() { const b = document.querySelector('#focusLine b'); return b ? b.textContent : null; },
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
      const stop = T.st().settings.stopOnError;
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
    dom() {
      const h = (id) => (document.getElementById(id) || {}).innerHTML;
      return JSON.stringify({ strip: h('keystrip'), focus: h('focusLine'), wpm: h('mWpm'), acc: h('mAcc'), shift: h('mShift'), today: h('mToday'), wpmD: h('mWpmD'), accD: h('mAccD') });
    },
    statsDom() {
      const h = (id) => document.getElementById(id).innerHTML;
      return JSON.stringify({ summary: h('summary'), rows: h('keyRows'), mix: h('mixList'), pairs: h('pairList'), letters: h('letterList'), chart: document.getElementById('chart').toDataURL() });
    },
    hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16) + ':' + s.length; },
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
      const s = C.STORE.defaults();
      delete s.words;
      if (s.settings) delete s.settings.wordsTargetWpm;
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
      s.savedAt = now - 1000;
      return s;
    },
    fw(n, now) {
      const s = T.fsyn(now);
      s.settings.wordsTargetWpm = 35;
      const keys = {};
      for (const ch of ORDER.slice(0, n)) keys[ch] = { hist: T.hist(40, 0.95, now, 5), level: 0, due: null };
      s.words = {
        unlocked: n, sinceUnlock: 3, keys, confusions: { e: [{ c: 'r', ts: now - 3600000 }] }, pairs: {}, cooldown: {}, focusRun: null,
        lessons: Array.from({ length: 12 }, (_, i) => ({ ts: now - (12 - i) * 3600000, mode: 'words', wpm: 40, acc: 0.95, chars: 70, errors: 3, sameHand: 0, shifted: 0, dur: 60000 })),
      };
      return s;
    },
    errors: [],
  };
  window.addEventListener('error', (e) => T.errors.push(String(e.message)));
  window.addEventListener('unhandledrejection', (e) => T.errors.push(String(e.reason)));
  window.confirm = () => true;
  return T;
})();
