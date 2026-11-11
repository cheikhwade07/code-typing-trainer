// Tests for the tabbed Settings dialog (ST), the Words extras (WX) and the larger word
// list (WL). Loaded after sidecar-tests.js in scratch copies of index.html (see
// extras-results.md). Uses the same runner (T.run) and fixtures as the sidecar suite.
(function () {
  const { T0, WFILE, wait } = T;
  const TP = T.TP;
  const C = window.CTT;
  const R = T.TESTS;
  const ok = T.result;
  const $ = (id) => document.getElementById(id);
  const ORDER = 'etaoinsrhldcumfpgwybvkxjqz';
  const PUNCT = ',.?;:';

  const F12 = (o) => T.FW(12, T0, Object.assign({ savedAt: T0 }, o || {}));
  const seed = (main, W, cfg) => async () => {
    localStorage.setItem('ctt.v1', JSON.stringify(main || T.fsyn()));
    if (W !== null) localStorage.setItem('ctt.words.v1', JSON.stringify(W || F12()));
    return T.RELOAD(Object.assign({ freeze: T0 }, cfg || {}));
  };
  // Gist with main = local main, Words file = remote (or local); reload frozen at T0.
  const gistSeed = (localW, remoteW) => async (ctx) => {
    const mainStr = JSON.stringify(T.fsyn());
    const id = await T.mkGist({ main: mainStr, report: '# r\n', words: JSON.stringify(remoteW || localW) });
    localStorage.setItem('ctt.v1', mainStr);
    localStorage.setItem('ctt.words.v1', JSON.stringify(localW));
    T.useGist(id);
    Object.assign(ctx, { id });
    return T.RELOAD({ freeze: T0 });
  };
  const change = (id, v) => {
    const el = $(id);
    if (el.type === 'checkbox') el.checked = v; else el.value = String(v);
    el.dispatchEvent(new Event('change'));
  };
  const tabOn = () => { const b = document.querySelector('#settings .seg button.on'); return b ? b.dataset.tab : null; };
  const clickTab = (t) => document.querySelector('#settings .seg button[data-tab="' + t + '"]').click();
  const visible = (el) => !!el && el.offsetParent !== null && !el.closest('[hidden]');
  const visIds = () => [...document.querySelectorAll('#settings [id]')]
    .filter((el) => /^(INPUT|SELECT|BUTTON)$/.test(el.tagName) && visible(el)).map((el) => el.id).sort();
  const snapMain = () => ({ v1: T.raw('ctt.v1'), prev: T.raw('ctt.v1.prev'), nreq: TP.reqs.length, nsrv: TP.srv.length });
  const mainUnchanged = (s) => T.raw('ctt.v1') === s.v1 && T.raw('ctt.v1.prev') === s.prev;
  const mainReqsSince = (s) => TP.reqs.slice(s.nreq).filter((r) => r.tag === 'main').length + TP.srv.slice(s.nsrv).filter((r) => r.method === 'POST' && /"progress"/.test(r.body || '')).length;
  async function toWords() { if (T.onMode() !== 'words') { T.mode('words'); await wait(30); } }
  async function toMode(m) { if (T.onMode() !== m) { T.mode(m); await wait(30); } }

  // ================= ST: tabbed Settings =================
  const TAB_IDS = {
    general: ['sStop', 'sSound', 'sVol', 'sKeymap', 'sNext', 'sFingers', 'sToken', 'sConnect', 'sImport'],
    symbols: ['sFocus', 'sTarget', 'sLen', 'sUnlock', 'sExport', 'sReset'],
    words: ['sWordsTarget', 'sWordsLen', 'sWordsCaps', 'sWordsNums', 'sWordsPunct', 'sUnlockWords', 'sExportWords', 'sResetWords'],
  };
  R['ST-1'] = [seed(), async () => {
    await T.openSettings();
    const res = {};
    let pass = true;
    for (const t of ['general', 'symbols', 'words']) {
      clickTab(t); await wait(20);
      const vis = visIds().filter((id) => id !== 'settingsBtn');
      // Done button has no id; the tab buttons have none either.
      const exp = TAB_IDS[t].slice().sort();
      const others = Object.entries(TAB_IDS).filter(([k]) => k !== t).flatMap(([, v]) => v);
      const leaked = vis.filter((id) => others.includes(id));
      const missing = exp.filter((id) => !vis.includes(id));
      const extra = vis.filter((id) => !exp.includes(id));
      const sections = [...document.querySelectorAll('#settings section.tab')].filter((s) => !s.hidden).map((s) => s.dataset.tab);
      res[t] = { vis, leaked, missing, extra, sections, on: tabOn() };
      pass = pass && !leaked.length && !missing.length && !extra.length && sections.length === 1 && sections[0] === t && tabOn() === t;
    }
    res.removedLenLabel = !$('sLenLabel');
    res.doneVisible = visible(document.querySelector('#settings button[value="close"]'));
    await T.closeSettings();
    return ok(pass && res.removedLenLabel && res.doneVisible, res);
  }];
  R['ST-2'] = [seed(), async () => {
    const res = {};
    for (const m of ['words', 'warmup', 'adaptive', 'lines', 'mycode']) {
      await toMode(m);
      await T.openSettings(); res[m] = tabOn();
      clickTab(m === 'words' ? 'general' : 'words'); await wait(10); // a different tab before closing
      await T.closeSettings();
      await T.openSettings(); res[m + '2'] = tabOn(); await T.closeSettings();
    }
    const exp = { words: 'words', warmup: 'general', adaptive: 'symbols', lines: 'symbols', mycode: 'symbols' };
    const pass = Object.entries(exp).every(([m, t]) => res[m] === t && res[m + '2'] === t);
    return ok(pass, res);
  }];

  // ST-3 / ST-4: every Words control persists only ctt.words.v1 (Words mode / Adaptive mode).
  const WCTRL = [['sWordsTarget', 47, (p) => p.targetWpm === 47], ['sWordsLen', 110, (p) => p.lessonLen === 110],
    ['sWordsCaps', 1, (p) => p.caps === 1], ['sWordsCaps', 2, (p) => p.caps === 2], ['sWordsNums', true, (p) => p.nums === true],
    ['sWordsPunct', true, (p) => p.punct === true], ['sWordsCaps', 0, (p) => p.caps === 0], ['sWordsNums', false, (p) => p.nums === false],
    ['sWordsPunct', false, (p) => p.punct === false]];
  const wordsCtrlTest = (mode) => [gistSeed(F12()), async () => {
    await wait(900);
    await toMode(mode);
    await SYNC_flush();
    const s0 = snapMain();
    const res = { steps: [] };
    let pass = true;
    for (const [id, v, chk] of WCTRL) {
      const before = T.raw('ctt.words.v1');
      await T.openSettings();
      change(id, v);
      await T.closeSettings();
      const p = T.sw().prefs;
      const st = { id, v, applied: chk(p), sidecarChanged: T.raw('ctt.words.v1') !== before, mainSame: mainUnchanged(s0) };
      res.steps.push(st);
      pass = pass && st.applied && st.sidecarChanged && st.mainSame;
    }
    await wait(4800); // past the push debounce
    res.mainReqs = mainReqsSince(s0);
    res.wordsPatches = TP.reqs.slice(s0.nreq).filter((r) => r.method === 'PATCH').map((r) => r.tag + ':' + Object.keys(JSON.parse(r.body).files).join('+'));
    res.mainSameEnd = mainUnchanged(s0);
    pass = pass && res.mainReqs === 0 && res.mainSameEnd && res.wordsPatches.length >= 1 && res.wordsPatches.every((x) => x === 'words:' + WFILE);
    return ok(pass, res);
  }];
  async function SYNC_flush() { try { await C.SYNC.flush(); await C.SYNC.flushWords(); } catch (e) { /* none */ } await wait(300); }
  R['ST-3'] = wordsCtrlTest('words');
  R['ST-4'] = wordsCtrlTest('adaptive');

  // ST-5: a main control changed in Words mode is saved to main (and only main).
  R['ST-5'] = [gistSeed(F12()), async () => {
    await wait(900);
    await toWords();
    await SYNC_flush();
    const res = {};
    const w0 = T.raw('ctt.words.v1');
    const n0 = TP.reqs.length;
    const cases = [['sStop', false, (s) => s.stopOnError === false], ['sTarget', 44, (s) => s.targetWpm === 44], ['sLen', 95, (s) => s.lessonLen === 95],
      ['sFocus', 'mixed', (s) => s.focusStyle === 'mixed'], ['sSound', false, (s) => s.sound === false], ['sFingers', false, (s) => s.fingerColors === false]];
    let pass = true;
    res.steps = [];
    for (const [id, v, chk] of cases) {
      const v1 = T.raw('ctt.v1');
      await T.openSettings(); change(id, v); await T.closeSettings();
      const st = { id, saved: chk(T.st().settings), v1Changed: T.raw('ctt.v1') !== v1 };
      res.steps.push(st);
      pass = pass && st.saved && st.v1Changed;
    }
    await wait(4800);
    res.sidecarSame = T.raw('ctt.words.v1') === w0;
    res.mainPatches = TP.reqs.slice(n0).filter((r) => r.tag === 'main' && r.method === 'PATCH').length;
    res.wordsPatches = TP.reqs.slice(n0).filter((r) => r.tag === 'words' && r.method === 'PATCH').length;
    res.wordsLen = T.sw().prefs.lessonLen;
    return ok(pass && res.sidecarSame && res.mainPatches >= 1 && res.wordsPatches === 0 && res.wordsLen === 70, res);
  }];
  // ST-5b: open/close and Words-only changes in a symbol mode write no main save (snapshot B rule:
  // main is saved only when a main setting changed, in every mode).
  R['ST-5b'] = [gistSeed(F12()), async () => {
    await wait(900);
    await toMode('lines');
    await SYNC_flush();
    const s0 = snapMain();
    await T.openSettings(); await T.closeSettings();
    await T.openSettings(); clickTab('general'); clickTab('symbols'); await T.closeSettings();
    await T.openSettings(); change('sLen', T.st().settings.lessonLen); await T.closeSettings(); // same value
    await wait(4800);
    const r = { mainSame: mainUnchanged(s0), mainReqs: mainReqsSince(s0) };
    return ok(r.mainSame && r.mainReqs === 0, r);
  }];

  // ST-6: sUnlock acts on symbols in Words mode; sUnlockWords acts on Words in a symbol mode.
  R['ST-6'] = [seed(), async () => {
    await toWords();
    const w0 = T.raw('ctt.words.v1'), u0 = T.st().unlocked;
    await T.openSettings(); $('sUnlock').click(); await wait(20); await T.closeSettings();
    const a = { mainUnlocked: [u0, T.st().unlocked], sidecarSame: T.raw('ctt.words.v1') === w0, toast: TP.toasts.slice(-1)[0] };
    await toMode('adaptive');
    const v1 = T.raw('ctt.v1'), wu = T.sw().unlocked;
    await T.openSettings(); $('sUnlockWords').click(); await wait(20); await T.closeSettings();
    const b = { wordsUnlocked: [wu, T.sw().unlocked], v1Same: T.raw('ctt.v1') === v1, toast: TP.toasts.slice(-1)[0], strip: T.strip().open };
    return ok(a.mainUnlocked[1] === u0 + 1 && a.sidecarSame && /^Unlocked: /.test(a.toast) && b.wordsUnlocked[1] === wu + 1 && b.v1Same && /^Words: unlocked /.test(b.toast), { a, b });
  }];

  // ST-7: sReset resets only symbols (any mode); sResetWords only Words, prefs kept.
  R['ST-7'] = [seed(null, F12({ prefs: { targetWpm: 44, lessonLen: 90, caps: 2, nums: true, punct: true } })), async () => {
    await toWords();
    const w0 = T.raw('ctt.words.v1');
    const set0 = JSON.stringify(T.st().settings);
    await T.openSettings(); $('sReset').click(); await wait(50); await T.closeSettings();
    const s = T.st();
    const a = { confirm: TP.confirms[0], mainLessons: s.lessons.length, mainUnlocked: s.unlocked, settingsKept: JSON.stringify(s.settings) === set0, sidecarSame: T.raw('ctt.words.v1') === w0, mode: T.onMode() };
    await toMode('adaptive');
    const v1 = T.raw('ctt.v1');
    await T.openSettings(); $('sResetWords').click(); await wait(50); await T.closeSettings();
    const W = T.sw();
    const b = { confirm: TP.confirms[1], lessons: W.lessons.length, unlocked: W.unlocked, keys: Object.keys(W.keys).length, prefs: W.prefs, v1Same: T.raw('ctt.v1') === v1 };
    const pass = a.confirm === 'Reset symbol progress and stats? Words mode progress is not affected. Export first if you want a backup.' &&
      a.mainLessons === 0 && a.settingsKept && a.sidecarSame &&
      /^Reset Words mode progress\? The symbol progress is not affected/.test(b.confirm) && b.lessons === 0 && b.unlocked === 10 && b.keys === 0 &&
      T.eq(b.prefs, { targetWpm: 44, lessonLen: 90, caps: 2, nums: true, punct: true }) && b.v1Same;
    return ok(pass, { a, b });
  }];

  // ST-8: Done button (form method=dialog) closes and saves; synthetic Esc is checked manually (see results).
  R['ST-8'] = [seed(), async () => {
    await toWords();
    await T.openSettings();
    $('sWordsLen').value = '150'; // no change event: only the close path reads it
    const d = $('settings');
    let closed = false;
    d.addEventListener('close', () => { closed = true; }, { once: true });
    document.querySelector('#settings button[value="close"]').click();
    await wait(80);
    const fired = closed;
    if (!fired) d.dispatchEvent(new Event('close')); // see harness note on the pane's close event
    await wait(30);
    const r = { open: d.open, closeEventFired: fired, wordsLen: T.sw().prefs.lessonLen };
    return ok(!r.open && r.wordsLen === 150, r);
  }];

  // ST-10: an old Words save (prefs without caps/nums/punct) loads with every extra off.
  R['ST-10'] = [seed(null, F12({ prefs: { targetWpm: 41, lessonLen: 80 } })), async () => {
    await toWords();
    const p = C.STORE.mergeWords(T.sw()).prefs;
    await T.openSettings();
    const ui = { caps: $('sWordsCaps').value, nums: $('sWordsNums').checked, punct: $('sWordsPunct').checked, len: $('sWordsLen').value };
    await T.closeSettings();
    let extras = 0;
    for (let i = 0; i < 50; i++) { T.seedRandom(900 + i); T.esc(); if (/[^a-z ]/.test(T.text())) extras++; }
    T.unseed();
    const note = /extras not counted/.test($('focusLine').textContent);
    const r = { merged: p, ui, extrasLessons: extras, note };
    return ok(T.eq(p, { targetWpm: 41, lessonLen: 80, caps: 0, nums: false, punct: false }) && ui.caps === '0' && !ui.nums && !ui.punct && ui.len === '80' && extras === 0 && !note, r);
  }];
  // ST-11: garbage prefs are sanitized (merge, local load, import).
  R['ST-11'] = [seed(null, F12({ prefs: { targetWpm: 41, lessonLen: 80, caps: 7, nums: 'yes', punct: 1 } })), async () => {
    const M = (p) => C.STORE.mergeWords(Object.assign(F12(), { prefs: p })).prefs;
    const cases = [[{ caps: 3 }, 0], [{ caps: -1 }, 0], [{ caps: '2' }, 0], [{ caps: 1.5 }, 0], [{ caps: null }, 0], [{ caps: true }, 0], [{ caps: 2 }, 2], [{ caps: 1 }, 1], [{}, 0]];
    const capsOk = cases.map(([p, e]) => M(p).caps === e);
    const boolCases = [['yes', false], [1, false], ['true', false], [null, false], [{}, false], [true, true], [false, false]];
    const numsOk = boolCases.map(([v, e]) => M({ nums: v }).nums === e && M({ punct: v }).punct === e);
    const loaded = T.sw() && C.STORE.mergeWords(T.sw()).prefs;
    await T.openSettings();
    const ui = { caps: $('sWordsCaps').value, nums: $('sWordsNums').checked, punct: $('sWordsPunct').checked };
    await T.closeSettings();
    // import of a Words file with garbage prefs
    await T.load(Object.assign(F12({ savedAt: T0 + 5 }), { prefs: { targetWpm: 'x', lessonLen: 9999, caps: 'often', nums: 'on', punct: [1] } }), 'w.json');
    const imp = T.sw().prefs;
    const r = { capsOk, numsOk, loaded, ui, imported: imp, storedLocal: T.sw().prefs };
    return ok(capsOk.every(Boolean) && numsOk.every(Boolean) && loaded.caps === 0 && loaded.nums === false && loaded.punct === false &&
      ui.caps === '0' && !ui.nums && !ui.punct && T.eq(imp, { targetWpm: 35, lessonLen: 200, caps: 0, nums: false, punct: false }), r);
  }];

  // ST-12 (coordinator item 1): Words adopt from the gist while Settings is open.
  const adoptTest = (mode) => [gistSeed(F12({ savedAt: T0 - 3600000 }), F12({ savedAt: T0 - 3600000 })), async (ctx) => {
    await wait(900);
    await toMode(mode);
    await SYNC_flush();
    const s0 = snapMain();
    const mainLen0 = T.st().settings.lessonLen;
    const newer = T.FW(15, T0, { savedAt: T0 + 70000, prefs: { targetWpm: 55, lessonLen: 150, caps: 2, nums: true, punct: true } });
    await T.ctl({ setfile: { id: ctx.id, name: WFILE, content: JSON.stringify(newer) } });
    await T.openSettings();
    clickTab('general');
    $('sSyncNow').click();
    await wait(2500);
    const ui = { wlen: $('sWordsLen').value, wt: $('sWordsTarget').value, caps: $('sWordsCaps').value, nums: $('sWordsNums').checked, punct: $('sWordsPunct').checked, len: $('sLen').value };
    await T.closeSettings();
    await wait(4800);
    const W = T.sw();
    const r = { mode, ui, prefs: W.prefs, unlocked: W.unlocked, savedAtKept: W.savedAt === T0 + 70000, mainSame: mainUnchanged(s0), mainLen: [mainLen0, T.st().settings.lessonLen],
      mainPatches: TP.reqs.slice(s0.nreq).filter((x) => x.tag === 'main' && x.method === 'PATCH').length, toast: T.toastHas(/Loaded synced Words progress/) };
    return ok(T.eq(W.prefs, newer.prefs) && W.unlocked === 15 && r.mainSame && r.mainPatches === 0 && ui.wlen === '150' && ui.caps === '2' && ui.nums && ui.punct && ui.len === String(mainLen0), r);
  }];
  R['ST-12'] = adoptTest('words');
  R['ST-12b'] = adoptTest('adaptive');

  // ST-13 (coordinator item 3): imports refresh the open dialog, so closing it keeps the imported values.
  R['ST-13'] = [seed(), async () => {
    await toMode('adaptive');
    await T.openSettings();
    const main = T.fsyn(); main.settings.lessonLen = 150; main.settings.targetWpm = 45; main.settings.focusStyle = 'mixed'; main.settings.stopOnError = false;
    await T.load(main, 'code-typing-trainer-backup-x.json');
    const uiMain = { len: $('sLen').value, target: $('sTarget').value, focus: $('sFocus').value, stop: $('sStop').checked };
    await T.closeSettings();
    const s = T.st().settings;
    const a = { uiMain, saved: { len: s.lessonLen, target: s.targetWpm, focus: s.focusStyle, stop: s.stopOnError } };
    await toWords();
    await T.openSettings();
    await T.load(F12({ savedAt: T0 + 9, prefs: { targetWpm: 60, lessonLen: 140, caps: 1, nums: true, punct: true } }), 'code-typing-trainer-words-backup-x.json');
    const uiW = { wlen: $('sWordsLen').value, caps: $('sWordsCaps').value, nums: $('sWordsNums').checked, punct: $('sWordsPunct').checked };
    await T.closeSettings();
    const b = { uiW, prefs: T.sw().prefs };
    const pass = a.saved.len === 150 && a.saved.target === 45 && a.saved.focus === 'mixed' && a.saved.stop === false &&
      T.eq(b.prefs, { targetWpm: 60, lessonLen: 140, caps: 1, nums: true, punct: true });
    return ok(pass, { a, b });
  }];

  // ================= WX: Words extras =================
  const NUM_RE = /^\d+(\.\d+)?$/;
  const WORD_RE = /^([A-Za-z])([a-z]*)([,.?;:]?)$/;
  function checkText(txt, letters, opts, wordSet) {
    const errs = [];
    const set = new Set(letters);
    for (const ch of txt) {
      if (/[a-z]/i.test(ch)) { if (!set.has(ch.toLowerCase())) errs.push('locked ' + ch); }
      else if (!(/[0-9]/.test(ch) || ch === ' ' || PUNCT.includes(ch))) errs.push('char ' + JSON.stringify(ch));
    }
    if (/^ | $|  /.test(txt)) errs.push('spaces');
    const toks = txt.split(' ');
    let prevNum = false;
    const st = { words: 0, caps: 0, nums: 0, punct: 0, starts: 0, startsCap: 0 };
    let afterStop = false;
    toks.forEach((t, i) => {
      if (NUM_RE.test(t)) {
        if (!opts.nums) errs.push('num while off');
        if (prevNum) errs.push('two numbers');
        if (i === toks.length - 1) errs.push('number last');
        prevNum = true; st.nums++; afterStop = false; return;
      }
      const m = WORD_RE.exec(t);
      if (!m) { errs.push('token ' + t); return; }
      prevNum = false;
      st.words++;
      const capd = m[1] !== m[1].toLowerCase();
      if (capd) st.caps++;
      if (capd && !opts.caps) errs.push('cap while off');
      if (m[3]) { st.punct++; if (!opts.punct) errs.push('punct while off'); }
      if (wordSet && !wordSet.has((m[1] + m[2]).toLowerCase())) errs.push('not a word ' + t);
      if (afterStop && i > 0 && NUM_RE.test(toks[i - 1]) === false) { st.starts++; if (capd) st.startsCap++; else if (opts.caps) errs.push('sentence start lower ' + t); }
      afterStop = !!m[3] && /[.?]/.test(m[3]);
    });
    if (opts.punct) { const last = toks[toks.length - 1]; if (!/^[A-Za-z]+[.?]$/.test(last)) errs.push('last ' + last); }
    return { errs, st };
  }
  const combos = [];
  for (const caps of [0, 1, 2]) for (const nums of [false, true]) for (const punct of [false, true]) combos.push({ caps, nums, punct });
  const planFor = (letters) => ({ focus: letters[Math.floor(Math.random() * letters.length)], secondary: [letters[0], letters[letters.length - 1]] });

  R['WX-1'] = [async () => {
    const W = C.WORDS, wordSet = new Set(W.WORDS);
    T.seedRandom(4242);
    let n = 0, bad = 0;
    const samples = [];
    const perCombo = {};
    for (let lvl = 10; lvl <= 26; lvl++) {
      const letters = ORDER.slice(0, lvl).split('');
      for (const o of combos) {
        for (let k = 0; k < 12; k++) {
          const len = [30, 70, 120, 200][k % 4];
          const txt = W.text(letters, planFor(letters), len, false, o);
          const { errs } = checkText(txt, letters, o, wordSet);
          n++;
          const key = o.caps + '' + (+o.nums) + (+o.punct);
          perCombo[key] = (perCombo[key] || 0) + 1;
          if (errs.length) { bad++; if (samples.length < 5) samples.push({ lvl, o, txt, errs: errs.slice(0, 4) }); }
        }
      }
    }
    T.unseed();
    return ok(n >= 2000 && bad === 0, { lessons: n, bad, combos: Object.keys(perCombo).length, perCombo, samples });
  }];
  R['WX-2'] = [async () => {
    const W = C.WORDS;
    let same = 0, lowerOnly = 0, n = 0;
    const diffs = [];
    for (let i = 0; i < 500; i++) {
      const lvl = 10 + (i % 17);
      const letters = ORDER.slice(0, lvl).split('');
      T.seedRandom(7000 + i); const plan = planFor(letters);
      const a = W.text(letters, plan, 70, false, { caps: 0, nums: false, punct: false });
      T.seedRandom(7000 + i); planFor(letters);
      const b = W.text(letters, plan, 70, false);
      T.seedRandom(7000 + i); planFor(letters);
      const c = W.text(letters, plan, 70, false, { targetWpm: 35, lessonLen: 70, caps: 0, nums: false, punct: false });
      n++;
      if (a === b && a === c) same++; else if (diffs.length < 3) diffs.push([a, b]);
      if (/^[a-z]+( [a-z]+)*$/.test(a)) lowerOnly++;
    }
    T.unseed();
    return ok(same === n && lowerOnly === n, { n, same, lowerOnly, diffs });
  }];
  R['WX-3'] = [async () => {
    const W = C.WORDS;
    const letters = ORDER.split('');
    const meas = {};
    const run = (o, seedv) => {
      T.seedRandom(seedv);
      const tot = { words: 0, caps: 0, nums: 0, punct: 0, starts: 0, startsCap: 0, nonLast: 0, lessons: 0 };
      for (let i = 0; i < 1500; i++) {
        const txt = W.text(letters, planFor(letters), 200, false, o);
        const { st } = checkText(txt, letters, o, null);
        for (const k of Object.keys(st)) tot[k] += st[k];
        tot.nonLast += st.words - 1; tot.lessons++;
      }
      T.unseed();
      return tot;
    };
    const c1 = run({ caps: 1, nums: false, punct: false }, 11);
    const c2 = run({ caps: 2, nums: false, punct: false }, 12);
    const nm = run({ caps: 0, nums: true, punct: false }, 13);
    const pu = run({ caps: 0, nums: false, punct: true }, 14);
    const cp = run({ caps: 1, nums: false, punct: true }, 15);
    meas.caps1 = c1.caps / c1.words; meas.caps2 = c2.caps / c2.words;
    meas.numsPerWord = nm.nums / nm.words;
    // forced final '.' excluded: punctuation after non-final words only
    meas.punctNonLast = (pu.punct - pu.lessons) / pu.nonLast;
    meas.startsCapped = cp.starts ? cp.startsCap / cp.starts : null;
    meas.sentenceStartsSeen = cp.starts;
    meas.wordsSampled = [c1.words, c2.words, nm.words, pu.words];
    const near = (x, e, tol) => Math.abs(x - e) <= tol;
    return ok(near(meas.caps1, 0.15, 0.015) && near(meas.caps2, 0.40, 0.02) && near(meas.numsPerWord, 0.12, 0.015) && near(meas.punctNonLast, 0.15, 0.015) && meas.startsCapped === 1, meas);
  }];

  // WX-4: typing a Words lesson with every extra on, with errors on capitals, digits and punctuation.
  const ALL = { targetWpm: 35, lessonLen: 120, caps: 2, nums: true, punct: true };
  R['WX-4'] = [seed(null, F12({ prefs: ALL })), async () => {
    await toWords();
    // find a lesson that contains capitals, digits and punctuation (word lessons; < 26 letters, so no sentences)
    let txt = '';
    for (let i = 0; i < 40; i++) { T.seedRandom(600 + i); T.esc(); txt = T.text(); if (/[A-Z]/.test(txt) && /\d/.test(txt) && /[,;:]/.test(txt)) break; }
    T.unseed();
    const s0 = snapMain();
    const before = JSON.parse(T.raw('ctt.words.v1'));
    const TS = T0 + 60000;
    T.freeze(TS);
    const isExtra = (ch) => /[A-Z0-9]/.test(ch) || PUNCT.includes(ch);
    const errPos = new Set();
    const typed = T.typeLesson({ ms: 150, errAt: (i, ch) => {
      if (isExtra(ch) || (/[a-z]/.test(ch) && i % 11 === 5)) { errPos.add(i); return ch === 'q' ? 'w' : /[a-z]/.test(ch) ? T.wrongFor(ch) : 'q'; }
      return null;
    } });
    await wait(50);
    const W = T.sw();
    const rec = W.lessons[W.lessons.length - 1];
    const newHist = {};
    for (const [k, v] of Object.entries(W.keys)) {
      const n = v.hist.filter((h) => h.ts === TS);
      if (n.length) newHist[k] = n;
    }
    const newKeys = Object.keys(newHist);
    const newConf = {};
    for (const [k, arr] of Object.entries(W.confusions)) { const n = arr.filter((c) => c.ts === TS); if (n.length) newConf[k] = n.map((c) => c.c); }
    const t = typed.text;
    // expected: one hist entry per lowercase a-z position; errors only where we erred on a letter
    const letterPos = [...t].map((c, i) => (/[a-z]/.test(c) ? i : -1)).filter((i) => i >= 0);
    const entries = Object.values(newHist).reduce((a, b) => a + b.length, 0);
    const failEntries = Object.values(newHist).reduce((a, b) => a + b.filter((h) => !h.ok).length, 0);
    const letterErrs = letterPos.filter((i) => errPos.has(i)).length;
    // timing: a letter is timed only after a lowercase letter or a space (never after a capital, digit, punctuation or a fresh start)
    const timedExp = letterPos.filter((i) => i > 0 && !errPos.has(i) && /[a-z ]/.test(t[i - 1])).length;
    const timed = Object.values(newHist).reduce((a, b) => a + b.filter((h) => h.ok && h.t != null).length, 0);
    const extrasErr = [...errPos].filter((i) => isExtra(t[i])).length;
    const r = {
      sample: t.slice(0, 80), chars: rec.chars, len: t.length, errors: rec.errors, errPositions: errPos.size, extrasErr, acc: rec.acc,
      accExp: 1 - errPos.size / t.length, wpmExp: t.length / 5 / (rec.dur / 60000), wpm: rec.wpm,
      newKeys, entries, letterPositions: letterPos.length, failEntries, letterErrs, newConf, timed, timedExp,
      nonLowerKeys: Object.keys(W.keys).filter((k) => !/^[a-z]$/.test(k)), confKeysBad: Object.keys(W.confusions).filter((k) => !/^[a-z]$/.test(k)),
      pairs: W.pairs, mainSame: mainUnchanged(s0), mainReqs: mainReqsSince(s0),
    };
    const pass = /[A-Z]/.test(t) && /\d/.test(t) && extrasErr > 3 && rec.chars === t.length && rec.errors === errPos.size &&
      Math.abs(rec.acc - r.accExp) < 1e-9 && Math.abs(rec.wpm - r.wpmExp) / r.wpmExp < 0.01 &&
      newKeys.every((k) => /^[a-z]$/.test(k)) && entries === letterPos.length && failEntries === letterErrs &&
      Object.keys(newConf).every((k) => /^[a-z]$/.test(k)) && Object.values(newConf).flat().length === letterErrs &&
      !r.nonLowerKeys.length && !r.confKeysBad.length && T.eq(W.pairs, before.pairs) && timed === timedExp && r.mainSame && r.mainReqs === 0;
    return ok(pass, r);
  }];
  // WX-4b: the same lesson text typed with timing: letters right after a capital are untimed, other letters timed.
  // WX-5: Shift same-hand counting on capitals (and ? :) in a Words lesson.
  const shiftLesson = (wrongHand) => [seed(null, F12({ prefs: { targetWpm: 35, lessonLen: 100, caps: 2, nums: false, punct: true } })), async () => {
    await toWords();
    T.seedRandom(77); T.esc(); T.unseed();
    const chars = [...document.querySelectorAll('#textbox > span')].map((s) => s.textContent);
    const need = chars.filter((ch) => C.LAYOUT.requiredShift(ch)).length;
    const caps = chars.filter((ch) => /[A-Z]/.test(ch)).length;
    T.freeze(T0 + 60000);
    let p = TP.real.perf();
    performance.now = () => (p += 150);
    if (document.activeElement) document.activeElement.blur();
    for (const ch of chars) {
      const req = C.LAYOUT.requiredShift(ch);
      const use = req ? (wrongHand ? (req === 'ShiftLeft' ? 'ShiftRight' : 'ShiftLeft') : req) : null;
      if (use) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', code: use, shiftKey: true, bubbles: true }));
      T.press(ch);
      if (use) document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', code: use, bubbles: true }));
    }
    performance.now = TP.real.perf;
    await wait(30);
    const W = T.sw(); const rec = W.lessons[W.lessons.length - 1];
    const r = { need, caps, shifted: rec.shifted, sameHand: rec.sameHand, mShift: $('mShift').textContent, lessons: W.lessons.length };
    return ok(caps > 0 && rec.shifted === need && rec.sameHand === (wrongHand ? need : 0) && W.lessons.length === 13, r);
  }];
  R['WX-5'] = shiftLesson(true);
  R['WX-5b'] = shiftLesson(false);

  // WX-6: focus line note.
  R['WX-6'] = [seed(null, F12({ prefs: { targetWpm: 35, lessonLen: 70, caps: 0, nums: true, punct: false } })), async () => {
    const res = {};
    await toWords(); res.numsOn = $('focusLine').textContent;
    await T.openSettings(); change('sWordsNums', false); await T.closeSettings(); res.allOff = $('focusLine').textContent;
    for (const [id, v] of [['sWordsCaps', 1], ['sWordsPunct', true]]) {
      await T.openSettings(); change(id, v); await T.closeSettings(); res[id] = $('focusLine').textContent;
      await T.openSettings(); change(id, id === 'sWordsCaps' ? 0 : false); await T.closeSettings();
    }
    await T.openSettings(); change('sWordsCaps', 2); await T.closeSettings();
    await toMode('adaptive'); res.adaptive = $('focusLine').textContent;
    const has = (s) => /extras not counted in letter stats/.test(s);
    return ok(has(res.numsOn) && !has(res.allOff) && has(res.sWordsCaps) && has(res.sWordsPunct) && !has(res.adaptive), res);
  }];

  // WX-7: changing text options regenerates an untouched lesson, never one under way.
  R['WX-7'] = [seed(null, F12({ prefs: { targetWpm: 35, lessonLen: 70, caps: 0, nums: false, punct: false } })), async () => {
    await toWords();
    const res = {};
    const t0 = T.text();
    await T.openSettings(); change('sWordsPunct', true); await T.closeSettings();
    const t1 = T.text();
    res.idleRegen = { changed: t1 !== t0, endsStop: /[.?]$/.test(t1) };
    await T.openSettings(); change('sWordsTarget', 50); await T.closeSettings();
    res.targetOnlyKeeps = T.text() === t1;
    // mid-lesson
    T.freeze(T0 + 60000);
    T.typeLesson({ upTo: 3 });
    const pos = document.querySelectorAll('#textbox > span.done').length;
    await T.openSettings(); change('sWordsCaps', 2); change('sWordsLen', 150); await T.closeSettings();
    res.midKeeps = { same: T.text() === t1, doneSpans: [pos, document.querySelectorAll('#textbox > span.done').length] };
    T.esc();
    const t3 = T.text();
    res.nextUses = { caps: /[A-Z]/.test(t3), endsStop: /[.?]$/.test(t3), len: t3.length };
    // symbol mode: Words options do not touch the Adaptive text
    await toMode('adaptive');
    const a0 = T.text();
    await T.openSettings(); change('sWordsNums', true); await T.closeSettings();
    res.adaptiveKeeps = T.text() === a0;
    const pass = res.idleRegen.changed && res.idleRegen.endsStop && res.targetOnlyKeeps && res.midKeeps.same && res.midKeeps.doneSpans[0] === 3 && res.midKeeps.doneSpans[1] === 3 &&
      res.nextUses.caps && res.nextUses.endsStop && res.nextUses.len >= 140 && res.adaptiveKeeps;
    return ok(pass, res);
  }];

  // ================= WL: word list =================
  R['WL-1'] = [async () => {
    const L = C.WORDS.WORDS;
    const r = { n: L.length, unique: new Set(L).size, allAz: L.every((w) => /^[a-z]+$/.test(w)), minLen: Math.min(...L.map((w) => w.length)), maxLen: Math.max(...L.map((w) => w.length)) };
    return ok(r.n === 2358 && r.unique === 2358 && r.allAz, r);
  }];
  R['WL-2'] = [async () => {
    const L = C.WORDS.WORDS;
    const per = {};
    for (let lvl = 10; lvl <= 26; lvl++) { const s = new Set(ORDER.slice(0, lvl)); per[lvl] = L.filter((w) => [...w].every((c) => s.has(c))).length; }
    const letter = {};
    for (const c of ORDER) letter[c] = L.filter((w) => w.includes(c)).length;
    const minLetter = Math.min(...Object.values(letter));
    // focus letter at each level: words with that letter usable at that level
    const focusAt = {};
    for (let lvl = 10; lvl <= 26; lvl++) { const s = new Set(ORDER.slice(0, lvl)); const c = ORDER[lvl - 1]; focusAt[c] = L.filter((w) => w.includes(c) && [...w].every((x) => s.has(x))).length; }
    return ok(per[10] >= 150 && minLetter >= 25, { usableAtLevel: per, perLetter: letter, minLetter, newestLetterUsable: focusAt });
  }];
  R['WL-3'] = [async () => {
    const W = C.WORDS, set = new Set(W.WORDS);
    const letters = ORDER.slice(0, 10).split('');
    let fake = 0, n = 0, toks = 0;
    const ex = [];
    T.seedRandom(31337);
    for (let i = 0; i < 500; i++) {
      const plan = { focus: letters[i % 10], secondary: [letters[(i + 3) % 10], letters[(i + 7) % 10]] };
      for (const w of W.text(letters, plan, 70, false).split(' ')) { toks++; if (!set.has(w)) { fake++; if (ex.length < 5) ex.push(w); } }
      n++;
    }
    // the same with every extra on (stripped back to the word)
    for (let i = 0; i < 500; i++) {
      const plan = { focus: letters[i % 10], secondary: [] };
      for (const t of W.text(letters, plan, 70, false, { caps: 2, nums: true, punct: true }).split(' ')) {
        if (NUM_RE.test(t)) continue;
        toks++; const w = t.replace(/[,.?;:]$/, '').toLowerCase(); if (!set.has(w)) { fake++; if (ex.length < 5) ex.push(t); }
      }
      n++;
    }
    T.unseed();
    return ok(fake === 0 && n === 1000, { lessons: n, tokens: toks, fake, examples: ex });
  }];
})();
