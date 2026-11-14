// Main controller: lessons, typing loop, rendering, settings, stats view.
(function () {
  const { LAYOUT, CONTENT, ENGINE, STORE, SOUND, CHART, FILES, REPORT, SYNC, WORDS } = window.CTT;
  const $ = (id) => document.getElementById(id);

  let state = STORE.load();
  // Words mode has its own save (STORE.loadWords); `state` above is only the symbol
  // progress, in exactly the format it had before Words existed.
  let words = STORE.loadWords();
  let wordsOn = STORE.wordsActive(); // device-local: which mode is on screen
  let serverWords = false; // server.py knows data/words.json
  const curMode = () => (wordsOn ? 'words' : state.mode);
  let lesson = null;
  let spans = [];
  const shiftsDown = new Set();
  let view = 'practice';

  // ---------- helpers ----------
  function confColor(c) {
    return 'hsl(' + Math.round(c * 130) + ', 65%, 48%)';
  }
  function pct(x) {
    return x == null ? '–' : Math.round(x * 100) + '%';
  }
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.hidden = true), 2600);
  }
  function showChar(ch) {
    if (ch === ' ') return 'space';
    if (ch === '\n') return 'enter';
    return ch;
  }

  // ---------- warmup (not recorded) ----------
  const WARM_FINGERS = ['lp', 'lr', 'lm', 'li', 'ri', 'rm', 'rr', 'rp'];
  const WARM_HOME = { lp: 'a', lr: 's', lm: 'd', li: 'f', ri: 'j', rm: 'k', rr: 'l', rp: ';' };
  // Rounds, pickable from the menu. The default flow starts on the home row,
  // then the closest reaches, the number row last, then a mix, and loops.
  // "Tour" (every key once from home) is only played when picked.
  const WARM_STAGES = [['tour', 'tour'], ['home row', 2], ['top row', 1], ['bottom row', 3], ['number row', 0], ['mix', -1]];
  const WARM_START = 1;
  function warm() {
    if (!state.warm || !WARM_HOME[state.warm.finger]) state.warm = { finger: 'rp', stage: WARM_START };
    if (!(state.warm.stage >= 0 && state.warm.stage < WARM_STAGES.length)) state.warm.stage = WARM_START;
    return state.warm;
  }
  function warmChars(finger, rowIdx) {
    const out = [];
    LAYOUT.ROWS[rowIdx].forEach(([code]) => {
      const k = LAYOUT.keys[code];
      if (k.finger !== finger || !k.base) return;
      out.push(k.base);
      if (k.shifted && !/[A-Z]/.test(k.shifted)) out.push(k.shifted);
    });
    return out;
  }
  function warmupText() {
    const w = warm();
    const H = WARM_HOME[w.finger];
    const [, row] = WARM_STAGES[w.stage];
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const all = [2, 1, 3, 0].flatMap((r) => warmChars(w.finger, r));
    const toks = [];
    if (row === 'tour') {
      // Every key of the finger once, in keyboard order, leaving from home: twice.
      const keys = all.filter((c) => c !== H);
      for (let i = 0; i < 2; i++) keys.forEach((c) => toks.push(H + c + H));
      return toks.join(' ');
    }
    if (row === -1) {
      for (let i = 0; i < 14; i++) toks.push(pick(all) + pick(all));
      return toks.join(' ');
    }
    const chars = warmChars(w.finger, row);
    // Reach out from the home key and come back: ";p ;p ;p" then "p; p;".
    chars.forEach((c) => {
      if (c === H) { toks.push(H + H, H + H); return; }
      toks.push(H + c, H + c, H + c, c + H, c + H);
    });
    for (let i = 0; i < 6; i++) toks.push(pick(chars) + pick(chars));
    return toks.join(' ');
  }
  function renderWarmupPanel() {
    const p = $('warmupPanel');
    p.hidden = curMode() !== 'warmup';
    if (p.hidden) return;
    const w = warm();
    p.innerHTML = '';
    WARM_FINGERS.forEach((f, i) => {
      if (i === 4) { const g = document.createElement('span'); g.className = 'gap'; p.appendChild(g); }
      const b = document.createElement('button');
      b.className = 'ghost' + (f === w.finger ? ' on' : '');
      b.dataset.f = f;
      b.innerHTML = '<i></i>' + LAYOUT.FINGER_NAMES[f];
      b.addEventListener('click', () => {
        b.blur();
        state.warm = { finger: f, stage: WARM_START };
        STORE.save(state);
        renderWarmupPanel();
        newLesson();
      });
      p.appendChild(b);
    });
    const br = document.createElement('span');
    br.className = 'break';
    p.appendChild(br);
    WARM_STAGES.forEach(([name], i) => {
      const b = document.createElement('button');
      b.className = 'ghost round' + (i === w.stage ? ' on' : '');
      b.textContent = name;
      b.addEventListener('click', () => {
        b.blur();
        w.stage = i;
        STORE.save(state);
        renderWarmupPanel();
        newLesson();
      });
      p.appendChild(b);
    });
  }
  function renderWarmKeys() {
    const kb = $('keymap');
    const on = curMode() === 'warmup';
    kb.classList.toggle('warm', on);
    const f = on ? warm().finger : null;
    kb.querySelectorAll('.key').forEach((k) => k.classList.toggle('wf', on && k.dataset.f === f));
  }

  // ---------- lesson creation ----------
  // ---------- tracked state: main (symbols) or Words mode ----------
  // Words mode trains on `words`, its own save, which the engine treats like the main
  // state. `order` and `settings` are added as non-enumerable properties so they are
  // never saved, exported or synced; `settings` is a copy, so the engine cannot write
  // into the main settings.
  function wordsState() {
    const w = words;
    if (!Object.prototype.hasOwnProperty.call(w, 'order')) {
      Object.defineProperty(w, 'order', { value: WORDS.ORDER, enumerable: false, configurable: true });
      Object.defineProperty(w, 'settings', {
        get() { return { ...state.settings, targetWpm: this.prefs.targetWpm }; },
        enumerable: false,
        configurable: true,
      });
    }
    return w;
  }
  const isWords = (mode) => (mode || curMode()) === 'words';
  // State that the current mode reads and records into.
  function trk(mode) {
    return isWords(mode) ? wordsState() : state;
  }
  function keyOrder(S) {
    return S.order || CONTENT.TRAIN;
  }

  function buildText() {
    const mode = curMode();
    if (mode === 'warmup') return warmupText();
    if (mode === 'words') {
      const W = wordsState();
      const plan = ENGINE.plan(W);
      const all = W.unlocked >= WORDS.ORDER.length;
      buildText.sentences = all && Math.random() < 0.5;
      buildText.focus = buildText.sentences ? null : plan.focus;
      return WORDS.text(ENGINE.unlockedList(W), plan, W.prefs.lessonLen, buildText.sentences, W.prefs);
    }
    if (mode === 'adaptive') {
      const plan = ENGINE.plan(state);
      buildText.focus = plan.focus;
      return CONTENT.adaptive(ENGINE.unlockedList(state), plan, state.settings.lessonLen);
    }
    if (mode === 'lines') {
      return CONTENT.lines((ch) => ENGINE.weakness(state, ch), 3, ENGINE.weakLetters(state), ENGINE.drillWords(state));
    }
    const lines = CONTENT.normalizeCode(state.mycode.text || '');
    if (!lines.length) return null;
    const size = 4;
    let pos = state.mycode.pos || 0;
    if (pos >= lines.length) pos = 0;
    const chunk = lines.slice(pos, pos + size);
    state.mycode.next = pos + size >= lines.length ? 0 : pos + size;
    state.mycode.shown = { from: pos + 1, to: pos + chunk.length, total: lines.length };
    // dedent the chunk so the first line starts at column 0
    const minIndent = Math.min(...chunk.map((l) => l.match(/^ */)[0].length));
    return chunk.map((l) => l.slice(minIndent)).join('\n');
  }

  function newLesson() {
    buildText.focus = null;
    buildText.sentences = false;
    const text = buildText();
    $('mycodePanel').hidden = !(curMode() === 'mycode' && (!text || $('mycodePanel').dataset.open === '1'));
    if (curMode() === 'mycode') updateMycodeInfo();
    renderWarmupPanel();
    renderWarmKeys();
    if (!text) {
      lesson = null;
      $('textbox').innerHTML = '<span class="muted">Paste some of your own code above to start.</span>';
      renderFocus();
      renderKeymapHighlight();
      return;
    }
    // indentation after a newline (and at the very start) is filled in automatically
    const auto = new Set();
    let lineStart = true;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '\n') { lineStart = true; continue; }
      if (lineStart && text[i] === ' ') auto.add(i);
      else lineStart = false;
    }
    lesson = {
      text, mode: curMode(), pos: 0, auto, errorsAt: new Set(), start: null, lastT: null, active: 0, lastKey: null,
      sameHand: 0, shifted: 0, done: false, typed: 0, perKey: {}, prevCh: null, focus: buildText.focus,
      sentences: buildText.sentences,
      // Words in code (Adaptive, Lines, My code): spans and when each character was typed.
      wordSpans: tracksWords(curMode()) ? ENGINE.wordSpans(text) : [], tAt: [],
    };
    skipAuto();
    renderText();
    renderFocus();
    renderKeymapHighlight();
  }

  function skipAuto() {
    while (lesson.pos < lesson.text.length && lesson.auto.has(lesson.pos)) lesson.pos++;
  }

  // ---------- persistence ----------
  let fileState = 'none';
  function persist() {
    STORE.save(state);
    if (SYNC.enabled()) SYNC.push(state, REPORT.build(state));
    if (FILES.server()) {
      FILES.serverSave(state, REPORT.build(state)).then((ok) => {
        const next = ok ? 'auto' : 'autofail';
        if (next !== fileState) { fileState = next; renderFileBtn(); }
      });
      return;
    }
    if (FILES.connected()) {
      FILES.write('progress.json', JSON.stringify(state, null, 1)).then((ok) => {
        if (!ok) { fileState = 'prompt'; renderFileBtn(); }
      });
      FILES.write('report.md', REPORT.build(state));
    }
  }

  // ---------- Gist sync ----------
  const lessonCount = (s) => (s && Array.isArray(s.lessons) ? s.lessons.length : 0);
  function adoptRemote(remote, msg) {
    state = STORE.merge(remote);
    STORE.save(state);
    boot();
    if (msg) toast(msg);
  }
  // Startup / tab refocus: newest copy wins.
  async function pullGist() {
    const remote = await SYNC.startup();
    if (remote && (remote.savedAt || 0) > (state.savedAt || 0)) {
      adoptRemote(remote, 'Loaded synced progress');
    } else if (SYNC.enabled() && (!remote || (state.savedAt || 0) > (remote.savedAt || 0))) {
      SYNC.push(state, REPORT.build(state), 0);
    }
  }
  let lastPull = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !SYNC.enabled()) return;
    if (Date.now() - lastPull < 30000) return;
    lastPull = Date.now();
    pullGist();
  });

  // ---------- Words mode persistence (separate from everything above) ----------
  // Words lessons never call persist(), so they never change the main save or its
  // savedAt, and the main save never contains Words data.
  function persistWords() {
    STORE.saveWords(words);
    if (SYNC.enabled()) SYNC.pushWords(words);
    if (FILES.server()) {
      if (serverWords) FILES.serverSaveWords(words);
      return;
    }
    if (FILES.connected()) FILES.write('words.json', JSON.stringify(words, null, 1));
  }
  function refreshWords() {
    if (!isWords()) return;
    renderStrip();
    renderMetrics();
    newLesson();
  }
  // A newer copy from the gist, server or folder replaces this browser's Words progress.
  function adoptWords(raw, msg) {
    SYNC.cancelWords(); // an older queued upload must not overwrite it
    words = STORE.mergeWords(raw);
    STORE.saveWords(words, true); // keep its savedAt
    // An open Settings dialog must not write its old Words values back on close.
    if ($('settings').open) fillWordsFields();
    guardWords(refreshWords);
    if (msg) toast(msg);
  }
  // savedAt of a copy from elsewhere, read the same way it will be stored.
  const savedAtOf = (raw) => STORE.mergeWords(raw).savedAt;
  // Newest copy wins (server and folder): adopt it, or write ours if ours is newer.
  function wordsFromCopy(remote, save) {
    const valid = remote && typeof remote === 'object' && remote.kind === 'ctt-words';
    const R = valid ? savedAtOf(remote) : 0;
    if (valid && R > (words.savedAt || 0)) adoptWords(remote);
    else if ((words.savedAt || 0) > 0 && R !== (words.savedAt || 0)) save();
  }
  // Startup, tab refocus and Sync now: newest Words copy wins.
  async function pullWordsGist() {
    if (!SYNC.enabled()) return;
    let r;
    try {
      r = await SYNC.pullWords();
    } catch (e) {
      return; // status is shown in Settings; nothing changes locally
    }
    if (!r || r.state === 'unknown') return;
    const L = words.savedAt || 0;
    if (r.state === 'ok') {
      const R = savedAtOf(r.data);
      if (R > L) adoptWords(r.data, 'Loaded synced Words progress');
      else if (L > R) SYNC.pushWords(words, 0);
    } else if (L > 0) {
      SYNC.pushWords(words, 0); // missing or unreadable copy: replace it (gist history keeps the old one)
    }
  }
  // After connecting: same choice as for the symbols, for the Words file.
  async function wordsAfterConnect() {
    let r;
    try {
      r = await SYNC.pullWords();
    } catch (e) {
      return;
    }
    if (!r || r.state === 'unknown') return;
    if (r.state === 'ok') {
      const nL = words.lessons.length;
      const nR = Array.isArray(r.data.lessons) ? r.data.lessons.length : 0;
      const R = savedAtOf(r.data);
      if (nR > 0 && R !== words.savedAt) {
        let useRemote = nL === 0 || R > (words.savedAt || 0);
        if (!useRemote) {
          useRemote = !confirm('Words mode: this browser has ' + nL + ' Words lessons; the synced copy has ' + nR +
            '. OK keeps this browser\'s Words progress and overwrites the synced copy. Cancel loads the synced copy instead.');
        }
        if (useRemote) {
          adoptWords(r.data, 'Loaded synced Words progress');
          return;
        }
      }
    }
    if ((words.savedAt || 0) > 0) SYNC.pushWords(words, 0);
  }
  let lastPullW = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !SYNC.enabled()) return;
    if (Date.now() - lastPullW < 30000) return;
    lastPullW = Date.now();
    pullWordsGist();
  });
  // Words only reaches the gist if a test build left it inside the main save: copy it
  // once into an empty Words save.
  function seedWordsFromLegacy() {
    const legacy = STORE.takeLegacyWords();
    if (!legacy || words.lessons.length) return;
    const w = STORE.mergeWords(legacy.words);
    if (!w.lessons.length) return;
    if (Number.isFinite(legacy.targetWpm)) w.prefs.targetWpm = Math.min(150, Math.max(10, legacy.targetWpm));
    w.savedAt = 1; // oldest possible: any real synced Words copy wins over it
    words = w;
    STORE.saveWords(words, true);
  }
  // Runs Words rendering; if bad Words data still throws, switch to the symbol mode
  // so startup (sync, server detection) and the main tool keep working.
  function guardWords(fn) {
    try {
      fn();
    } catch (e) {
      if (!wordsOn) throw e;
      wordsOn = false;
      STORE.setWordsActive(false);
      document.querySelectorAll('.modes button').forEach((b) => b.classList.toggle('on', b.dataset.mode === curMode()));
      renderStrip();
      renderMetrics();
      newLesson();
      toast('Words mode data could not be shown; switched back to the symbols');
    }
  }
  function combinedReport() {
    return REPORT.build(state) + REPORT.buildWords(words, state.settings, Date.now());
  }

  function renderSync() {
    const on = SYNC.enabled();
    $('syncConnectRow').hidden = on;
    $('syncOnRow').hidden = !on;
    $('sTokenLink').href = SYNC.TOKEN_URL;
    if (on) $('sGistLink').href = 'https://gist.github.com/' + SYNC.gistId();
    const st = SYNC.status();
    const last = SYNC.lastSync();
    $('syncInfo').textContent = !on
      ? 'Keeps progress in a secret gist on your GitHub account, so any browser with the same token continues where you left off. The token is stored in this browser only.'
      : st === 'auth'
        ? 'GitHub refused the token (expired or revoked). Disconnect, then connect with a new token. Progress is still saved in this browser.'
        : st === 'error'
          ? 'Could not reach GitHub. Progress is saved in this browser and will upload after the next lesson.'
          : 'Connected. Uploads a few seconds after each lesson and checks for newer progress when the page opens.' +
            (last ? ' Last sync: ' + new Date(last).toLocaleString() + '.' : '');
    renderFileBtn();
  }
  SYNC.onStatus(renderSync);

  $('sConnect').addEventListener('click', async () => {
    const token = $('sToken').value.trim();
    if (!token) { $('sToken').focus(); return; }
    $('sConnect').disabled = true;
    try {
      const { login, remote } = await SYNC.connect(token, state, REPORT.build(state));
      $('sToken').value = '';
      const nRemote = lessonCount(remote);
      const nLocal = lessonCount(state);
      const remoteNewer = remote && (remote.savedAt || 0) > (state.savedAt || 0);
      let useRemote = false;
      if (remote && nRemote > 0 && remote.savedAt !== state.savedAt) {
        if (nLocal === 0 || remoteNewer) useRemote = true;
        else useRemote = !confirm('This browser has ' + nLocal + ' lessons; the synced copy has ' + nRemote +
          '. OK keeps this browser\'s progress and overwrites the synced copy. Cancel loads the synced copy instead.');
      }
      if (useRemote) adoptRemote(remote, 'Connected as ' + login + ', loaded synced progress');
      else { SYNC.push(state, REPORT.build(state), 0); toast('Connected as ' + login); }
      await wordsAfterConnect();
    } catch (e) {
      toast(e.auth ? 'GitHub refused that token (needs the gist scope)' : 'Could not reach GitHub');
    } finally {
      $('sConnect').disabled = false;
      renderSync();
    }
  });
  $('sSyncNow').addEventListener('click', () => { lastPull = Date.now(); pullGist(); });
  $('sDisconnect').addEventListener('click', () => {
    SYNC.disconnect();
    toast('Sync off. The gist stays on GitHub; progress stays in this browser.');
  });
  $('sSyncNow').addEventListener('click', () => { lastPullW = Date.now(); pullWordsGist(); });
  $('sDisconnect').addEventListener('click', () => SYNC.cancelWords());
  function renderWordsSync(st) {
    const el = $('wordsSyncInfo');
    st = st || SYNC.wordsStatus();
    el.textContent = !SYNC.enabled() ? ''
      : st === 'auth' ? 'Words mode sync: GitHub refused the token.'
        : st === 'error' ? 'Words mode sync: could not reach GitHub; it will retry.'
          : '';
    el.hidden = !el.textContent;
  }
  let wordsAuthShown = false;
  SYNC.onWordsStatus((st) => {
    renderWordsSync(st);
    if (st === 'auth' && !wordsAuthShown) {
      wordsAuthShown = true;
      toast('Words sync: GitHub refused the token');
    }
  });

  function renderFileBtn() {
    const b = $('fileBtn');
    if (SYNC.enabled()) {
      const st = SYNC.status();
      b.textContent = { syncing: '☁ Syncing…', auth: '☁ Token expired', error: '☁ Offline, retrying' }[st] || '☁ Synced';
      b.className = st === 'auth' || st === 'error' ? 'ghost warn' : 'ghost ok';
      b.disabled = false;
      b.title = 'Progress syncs to your GitHub gist. Click for sync settings.';
      return;
    }
    const label = {
      unsupported: 'Browser storage only',
      none: 'Save to folder…',
      prompt: 'Reconnect folder',
      granted: '✓ ' + (FILES.folder() || '') + '/data',
      auto: '✓ Auto-saving',
      autofail: 'Save failed, retrying',
    }[fileState];
    b.textContent = label;
    b.className = fileState === 'granted' || fileState === 'auto' ? 'ghost ok' : fileState === 'prompt' || fileState === 'autofail' ? 'ghost warn' : 'ghost';
    b.disabled = fileState === 'unsupported' || fileState === 'auto' || fileState === 'autofail';
    b.title = {
      auto: 'Progress and report.md are saved to data/ automatically after every lesson.',
      autofail: 'The local server did not answer. Start it again with start-trainer.bat; progress is kept in the browser meanwhile.',
      unsupported: 'This browser cannot write files. Use Chrome or Edge, or Export in Settings.',
      none: 'Progress is already saved in this browser automatically. Optional: pick a folder to also keep data/progress.json and data/report.md on disk.',
      prompt: 'Click to allow saving to ' + (FILES.folder() || 'the folder') + ' again.',
      granted: 'Saving progress.json and report.md after every lesson.',
    }[fileState];
  }

  // Use whichever copy (browser or file) was saved most recently.
  async function syncFromFile() {
    const fromFile = await FILES.readJson('progress.json');
    if (fromFile && (fromFile.savedAt || 0) > (state.savedAt || 0)) {
      state = STORE.merge(fromFile);
      STORE.save(state);
      boot();
      toast('Loaded progress from ' + FILES.folder() + '/data');
    } else {
      persist();
    }
  }

  async function wordsFromFolder() {
    wordsFromCopy(await FILES.readJson('words.json'), () => FILES.write('words.json', JSON.stringify(words, null, 1)));
  }

  $('fileBtn').addEventListener('click', async () => {
    $('fileBtn').blur();
    if (SYNC.enabled()) { $('settingsBtn').click(); return; }
    try {
      if (fileState === 'prompt') {
        if (!(await FILES.reconnect())) return;
      } else {
        await FILES.choose();
      }
      fileState = 'granted';
      renderFileBtn();
      await syncFromFile();
      await wordsFromFolder();
    } catch (e) {
      /* picker cancelled */
    }
  });

  // ---------- rendering ----------
  function renderText() {
    const box = $('textbox');
    box.innerHTML = '';
    spans = [];
    const frag = document.createDocumentFragment();
    for (let i = 0; i < lesson.text.length; i++) {
      const ch = lesson.text[i];
      const s = document.createElement('span');
      if (ch === '\n') {
        s.textContent = '↵';
        s.className = 'nl';
        frag.appendChild(s);
        frag.appendChild(document.createTextNode('\n'));
      } else {
        s.textContent = ch;
        if (lesson.auto.has(i)) s.className = 'auto';
        frag.appendChild(s);
      }
      spans.push(s);
    }
    box.appendChild(frag);
    updateCursor();
  }

  function updateCursor() {
    spans.forEach((s) => s.classList.remove('cur', 'bad'));
    if (lesson && !lesson.done && spans[lesson.pos]) spans[lesson.pos].classList.add('cur');
  }

  function renderStrip() {
    const strip = $('keystrip');
    strip.innerHTML = '';
    const S = trk();
    const focus = ENGINE.focusKey(S);
    keyOrder(S).forEach((ch, i) => {
      const d = document.createElement('div');
      const st = ENGINE.stats(S, ch);
      const locked = i >= S.unlocked;
      const cls = { mastered: ' learned', 'review due': ' due', stale: ' stale' }[st.status] || '';
      d.className = 'sym' + (locked ? ' locked' : '') + (ch === focus && !locked ? ' focus' : '') + cls;
      d.textContent = ch;
      if (!locked) {
        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.innerHTML = '<i style="width:' + Math.round(st.conf * 100) + '%;background:' + confColor(st.conf) + '"></i>';
        d.appendChild(bar);
      }
      d.title = locked
        ? ch + ' (locked)'
        : ch + '  ·  ' + st.status + '  ·  ' + LAYOUT.describe(ch) + '\naccuracy ' + pct(st.acc) + ', speed ' + (st.wpm ? Math.round(st.wpm) + ' wpm' : '–') + ', ' + st.n + ' samples (21 days)';
      strip.appendChild(d);
    });
  }

  function renderFocus(extra) {
    const el = $('focusLine');
    let html = '';
    if (isWords() && lesson && lesson.sentences) {
      html = 'Sentences · all letters unlocked · capitals and punctuation are not counted';
    } else if (curMode() === 'adaptive' || isWords()) {
      const p = ENGINE.plan(trk());
      const esc = (c) => c.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      if (p.focus) {
        html = (p.phase === 'learn' ? 'Learning <b>' : 'Focus <b>') + esc(p.focus) + '</b> · ' + LAYOUT.describe(p.focus);
        if (p.partner) html += ' · mix-up: you often type <b>' + esc(p.partner) + '</b>';
        const also = p.secondary.filter((c) => c !== p.partner).slice(0, 4);
        if (p.phase !== 'learn' && also.length) html += ' · also <b>' + also.map(esc).join(' ') + '</b>';
      }
      if (p.letters.length) html += (html ? ' · ' : '') + 'letters <b>' + p.letters.join(' ') + '</b>';
      if (p.words.length) html += (html ? ' · ' : '') + 'words <b>' + p.words.slice(0, 3).join(' ') + '</b>';
      const wp = isWords() && words.prefs;
      if (wp && (wp.caps || wp.nums || wp.punct)) html += (html ? ' · ' : '') + 'extras not counted in letter stats';
    } else if (curMode() === 'warmup') {
      const w = warm();
      html = 'Warmup · <b>' + LAYOUT.FINGER_NAMES[w.finger] + '</b> · ' + WARM_STAGES[w.stage][0] +
        ' · not counted in stats';
    } else if (curMode() === 'mycode' && state.mycode.shown && lesson) {
      const s = state.mycode.shown;
      html = 'Lines ' + s.from + '–' + s.to + ' of ' + s.total + ' · <u style="cursor:pointer">edit code</u>';
    }
    if (extra) html += (html ? ' · ' : '') + '<span class="warn">' + extra + '</span>';
    el.innerHTML = html;
  }

  function buildKeymap() {
    const kb = $('keymap');
    kb.innerHTML = '';
    LAYOUT.ROWS.forEach((row) => {
      const r = document.createElement('div');
      r.className = 'krow';
      row.forEach(([code]) => {
        const k = LAYOUT.keys[code];
        const d = document.createElement('div');
        d.className = 'key';
        d.id = 'k-' + code;
        d.dataset.f = k.finger;
        if (code === 'KeyF' || code === 'KeyJ') d.classList.add('home');
        d.style.width = 'calc(var(--u) * ' + k.w + ' - 4px)';
        if (k.label != null) {
          d.innerHTML = '<span class="name">' + k.label + '</span>';
        } else if (/^[a-z]$/.test(k.base)) {
          d.innerHTML = '<span class="one">' + k.base.toUpperCase() + '</span>';
        } else {
          d.innerHTML = '<span class="s"></span><span class="b"></span>';
          d.querySelector('.s').textContent = k.shifted;
          d.querySelector('.b').textContent = k.base;
        }
        r.appendChild(d);
      });
      kb.appendChild(r);
    });
    const legend = document.createElement('div');
    legend.className = 'legend';
    [['p', 'pinky'], ['r', 'ring'], ['m', 'middle'], ['li', 'left index'], ['ri', 'right index'], ['th', 'thumb']].forEach(([g, name]) => {
      const s = document.createElement('span');
      s.dataset.g = g;
      s.innerHTML = '<i></i>' + name;
      legend.appendChild(s);
    });
    kb.appendChild(legend);
  }

  const FINGER_GROUP = { lp: 'p', rp: 'p', lr: 'r', rr: 'r', lm: 'm', rm: 'm', li: 'li', ri: 'ri', th: 'th' };

  function renderKeymapHighlight() {
    document.querySelectorAll('.key.next, .key.nextshift').forEach((k) => k.classList.remove('next', 'nextshift'));
    document.querySelectorAll('.legend span.on').forEach((s) => s.classList.remove('on'));
    if (!state.settings.highlightNext || !lesson || lesson.done) return;
    const ch = lesson.text[lesson.pos];
    const m = LAYOUT.charMap[ch];
    if (!m) return;
    const el = $('k-' + m.code);
    if (el) el.classList.add('next');
    const g = document.querySelector('.legend span[data-g="' + FINGER_GROUP[LAYOUT.keys[m.code].finger] + '"]');
    if (g) g.classList.add('on');
    const sh = LAYOUT.requiredShift(ch);
    if (sh && $('k-' + sh)) $('k-' + sh).classList.add('nextshift');
  }

  function applySettings() {
    const s = state.settings;
    $('keymap').hidden = !s.showKeymap;
    $('keymap').classList.toggle('fingers', !!s.fingerColors);
    SOUND.configure(s.sound, s.volume);
    renderKeymapHighlight();
  }

  function renderMetrics(last) {
    const all = trk().lessons;
    const L = last || all[all.length - 1];
    const today = new Date().toDateString();
    // Today's typing time across every mode (symbol and Words saves).
    const isToday = (x) => x && new Date(x.ts).toDateString() === today;
    const mins = ENGINE.lessonMin(state.lessons.filter(isToday)) + ENGINE.lessonMin(words.lessons.filter(isToday));
    $('mToday').textContent = mins < 1 ? Math.round(mins * 60) + 's' : Math.round(mins) + 'm';
    if (!L) {
      $('mWpm').textContent = '–';
      $('mAcc').textContent = '–';
      $('mShift').textContent = '–';
      $('mWpmD').textContent = '';
      $('mWpmD').className = 'delta';
      $('mAccD').textContent = '';
      $('mAccD').className = 'delta';
      return;
    }
    $('mWpm').textContent = Math.round(L.wpm);
    $('mAcc').textContent = pct(L.acc);
    $('mShift').textContent = L.sameHand;
    const prev = all.filter((x) => x.mode === L.mode && x !== L).slice(-10);
    const setD = (id, d, fmt) => {
      const el = $(id);
      if (!prev.length || !isFinite(d)) { el.textContent = ''; el.className = 'delta'; return; }
      el.textContent = (d >= 0 ? '+' : '') + fmt(d);
      el.className = 'delta ' + (d >= 0 ? 'up' : 'down');
    };
    const avg = (k) => prev.reduce((a, x) => a + x[k], 0) / prev.length;
    setD('mWpmD', L.wpm - avg('wpm'), (d) => d.toFixed(1));
    setD('mAccD', (L.acc - avg('acc')) * 100, (d) => d.toFixed(1) + '%');
  }

  function updateMycodeInfo() {
    const n = CONTENT.normalizeCode(state.mycode.text || '').length;
    $('mycodeInfo').textContent = n ? n + ' lines saved' : 'Nothing saved yet';
  }

  // ---------- typing ----------
  // Warmup records nothing; Words mode records only lowercase letters.
  const tracksWords = (mode) => mode === 'adaptive' || mode === 'lines' || mode === 'mycode';

  // At the end of a symbol lesson: one sample per word typed. A word is a miss if any
  // of its characters had a mistake; its speed is ms per character from its first to
  // its last letter (pauses over 3 s make it untimed).
  function recordLessonWords(L) {
    if (!L.wordSpans || !L.wordSpans.length) return;
    for (const sp of L.wordSpans) {
      let ok = true;
      for (let i = sp.start; i < sp.end; i++) if (L.errorsAt.has(i)) { ok = false; break; }
      let ms = null;
      if (ok) {
        let timed = true;
        for (let i = sp.start + 1; i < sp.end; i++) {
          if (L.tAt[i] == null || L.tAt[i - 1] == null || L.tAt[i] - L.tAt[i - 1] > 3000) { timed = false; break; }
        }
        if (timed) ms = (L.tAt[sp.end - 1] - L.tAt[sp.start]) / (sp.end - sp.start - 1);
      }
      ENGINE.recordWord(state, sp.word, ok, ms);
    }
    ENGINE.pruneWords(state);
  }

  function recordable(L, exp) {
    if (L.mode === 'warmup') return false;
    if (isWords(L.mode)) return exp >= 'a' && exp <= 'z' && exp.length === 1;
    return true;
  }

  function onChar(ch, e) {
    const L = lesson;
    if (!L || L.done) return;
    SOUND.init();
    const now = performance.now();
    if (L.start === null) L.start = now;
    tick(L, now);
    const exp = L.text[L.pos];

    const pk = (L.perKey[exp] = L.perKey[exp] || { n: 0, ok: 0, tSum: 0, tN: 0 });
    if (ch === exp) {
      const req = LAYOUT.requiredShift(ch);
      if (req) L.shifted++;
      if (e.shiftKey && req && shiftsDown.size && !shiftsDown.has(req)) {
        L.sameHand++;
        renderFocus('use ' + (req === 'ShiftLeft' ? 'LEFT' : 'RIGHT') + ' Shift for ' + showChar(ch));
      }
      if (!L.errorsAt.has(L.pos) && recordable(L, exp)) {
        let t = L.lastT === null ? null : now - L.lastT;
        if (t != null && t > 3000) t = null;
        ENGINE.record(trk(L.mode), exp, true, t);
        pk.n++;
        pk.ok++;
        if (t != null) {
          pk.tSum += t;
          pk.tN++;
          const pair = (L.prevCh || '') + exp;
          if (!isWords(L.mode) && L.prevCh && L.prevCh !== '\n' && (CONTENT.symbolsIn(pair).size)) ENGINE.recordPair(state, pair, t);
        }
      }
      L.prevCh = exp;
      L.tAt[L.pos] = now;
      spans[L.pos].classList.add('done');
      if (L.errorsAt.has(L.pos)) spans[L.pos].classList.add('err');
      // In Words, the letter after a capital, digit or punctuation mark is not timed
      // (the gap includes Shift or a reach outside the letters).
      L.lastT = isWords(L.mode) && exp !== ' ' && !recordable(L, exp) ? null : now;
      L.typed++;
      L.pos++;
      skipAuto();
      SOUND.click();
      if (L.pos >= L.text.length) return finish();
    } else {
      if (!L.errorsAt.has(L.pos)) {
        L.errorsAt.add(L.pos);
        if (recordable(L, exp)) ENGINE.record(trk(L.mode), exp, false, null, ch);
        pk.n++;
      }
      L.prevCh = null; // timing after a mistake is not a clean transition
      SOUND.error();
      const wk = $('k-' + e.code);
      if (wk) {
        wk.classList.add('wrong');
        clearTimeout(wk._t);
        wk._t = setTimeout(() => wk.classList.remove('wrong'), 220);
      }
      if (state.settings.stopOnError) {
        spans[L.pos].classList.add('bad');
        return;
      }
      spans[L.pos].classList.add('done', 'err');
      L.typed++;
      L.pos++;
      skipAuto();
      if (L.pos >= L.text.length) return finish();
    }
    updateCursor();
    renderKeymapHighlight();
  }

  // Active typing time: each gap between keystrokes counts up to ENGINE IDLE_CAP.
  function tick(L, now) {
    if (L.lastKey != null) L.active += Math.min(Math.max(0, now - L.lastKey), ENGINE.CONST.IDLE_CAP);
    L.lastKey = now;
  }

  function onBackspace() {
    const L = lesson;
    if (!L || L.done || state.settings.stopOnError || L.pos === 0) return;
    if (L.start !== null) tick(L, performance.now());
    let p = L.pos - 1;
    while (p > 0 && L.auto.has(p)) p--;
    if (L.auto.has(p)) return;
    spans[p].classList.remove('done', 'err');
    L.pos = p;
    L.tAt.length = Math.min(L.tAt.length, p); // a retyped word is timed only if fully retyped
    L.typed = Math.max(0, L.typed - 1);
    updateCursor();
    renderKeymapHighlight();
  }

  function finish() {
    const L = lesson;
    L.done = true;
    const now = performance.now();
    // Active typing time, not wall-clock: a lesson left open does not count.
    const dur = Math.max(1, L.active);
    const chars = L.text.length - L.auto.size;
    if (L.mode === 'warmup') {
      // Nothing recorded: just move on to the next row of this finger.
      const w = warm();
      const acc = Math.round(Math.max(0, 1 - L.errorsAt.size / chars) * 100);
      const wasLast = w.stage === WARM_STAGES.length - 1;
      w.stage = wasLast ? WARM_START : w.stage + 1;
      STORE.save(state);
      SOUND.complete();
      renderWarmupPanel();
      toast((wasLast ? 'Warmup round done' : 'Next: ' + WARM_STAGES[w.stage][0]) + ' · ' + acc + '% accurate');
      newLesson();
      return;
    }
    const rec = {
      ts: Date.now(),
      mode: L.mode,
      wpm: chars / 5 / (dur / 60000),
      acc: Math.max(0, 1 - L.errorsAt.size / chars),
      chars,
      errors: L.errorsAt.size,
      sameHand: L.sameHand,
      shifted: L.shifted,
      dur: Math.round(dur),
    };
    const S = trk(L.mode);
    S.lessons.push(rec);
    if (L.mode === 'mycode') state.mycode.pos = state.mycode.next || 0;
    if (tracksWords(L.mode)) recordLessonWords(L);
    // Words lessons use the engine's 'adaptive' bookkeeping (rotation, stall counter),
    // except sentence lessons, which drill no single letter.
    const W = isWords(L.mode);
    const events = ENGINE.afterLesson(S, L.perKey, W ? (L.sentences ? 'sentences' : 'adaptive') : L.mode, L.focus);
    if (W) persistWords();
    else persist();
    SOUND.complete();
    if (events.length) {
      if (events.some((x) => /unlocked|Mastered|passed/.test(x))) SOUND.unlock();
      toast(compactEvents(events).join(' · '));
    }
    renderMetrics(rec);
    renderStrip();
    newLesson();
  }

  // Several keys clearing the bar on the same lesson become one message.
  function compactEvents(events) {
    const solid = [];
    const rest = events.filter((x) => {
      const m = /^(.+) looks solid today: confirm it on another day to master it$/.exec(x);
      if (m) solid.push(m[1]);
      return !m;
    });
    if (solid.length > 1) rest.unshift(solid.join(' ') + ' look solid today: confirm them on another day to master them');
    else if (solid.length) rest.unshift(solid[0] + ' looks solid today: confirm it on another day to master it');
    return rest;
  }

  // ---------- events ----------
  document.addEventListener('keydown', (e) => {
    const k = $('k-' + e.code);
    if (k) k.classList.add('down');
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') shiftsDown.add(e.code);
    if ($('settings').open || view !== 'practice') return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'TEXTAREA' || tag === 'INPUT') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') { e.preventDefault(); newLesson(); return; }
    if (e.key === 'Backspace') { e.preventDefault(); onBackspace(); return; }
    let ch = null;
    if (e.key === 'Enter') ch = '\n';
    else if (e.key.length === 1) ch = e.key;
    if (ch === null) return;
    e.preventDefault();
    if (tag === 'BUTTON') document.activeElement.blur();
    onChar(ch, e);
  });
  document.addEventListener('keyup', (e) => {
    const k = $('k-' + e.code);
    if (k) k.classList.remove('down');
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') shiftsDown.delete(e.code);
  });
  window.addEventListener('blur', () => {
    shiftsDown.clear();
    document.querySelectorAll('.key.down').forEach((k) => k.classList.remove('down'));
  });

  function setMode(mode) {
    if (mode === 'words') {
      // Device-local switch: no save, so the symbol progress is untouched.
      wordsOn = true;
      STORE.setWordsActive(true);
    } else {
      wordsOn = false;
      STORE.setWordsActive(false);
      state.mode = mode;
      persist();
    }
    document.querySelectorAll('.modes button').forEach((b) => b.classList.toggle('on', b.dataset.mode === curMode()));
    $('mycodePanel').dataset.open = '0';
    guardWords(() => {
      showView('practice');
      renderStrip();
      renderMetrics();
      newLesson();
    });
  }
  document.querySelectorAll('.modes button').forEach((b) =>
    b.addEventListener('click', () => { b.blur(); setMode(b.dataset.mode); })
  );

  $('mycodeSave').addEventListener('click', () => {
    state.mycode.text = $('mycodeText').value;
    state.mycode.pos = 0;
    $('mycodePanel').dataset.open = '0';
    persist();
    $('mycodeSave').blur();
    newLesson();
  });
  $('focusLine').addEventListener('click', () => {
    if (curMode() !== 'mycode') return;
    $('mycodePanel').dataset.open = '1';
    $('mycodeText').value = state.mycode.text || '';
    $('mycodePanel').hidden = false;
  });

  function showView(v) {
    view = v;
    $('practice').hidden = v !== 'practice';
    $('statsView').hidden = v !== 'stats';
    $('statsBtn').textContent = v === 'stats' ? 'Practice' : 'Stats';
    if (v === 'stats') {
      // Stats open on the current mode's stats; the other is one click away.
      statsFor = isWords() ? 'words' : 'symbols';
      $('statsSym').classList.toggle('on', statsFor === 'symbols');
      $('statsWords').classList.toggle('on', statsFor === 'words');
      renderStats();
    }
  }
  $('statsBtn').addEventListener('click', () => {
    $('statsBtn').blur();
    showView(view === 'stats' ? 'practice' : 'stats');
  });

  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  let statsFor = 'symbols';
  function setStatsFor(which) {
    statsFor = which;
    $('statsSym').classList.toggle('on', which === 'symbols');
    $('statsWords').classList.toggle('on', which === 'words');
    renderStats();
  }
  $('statsSym').addEventListener('click', () => setStatsFor('symbols'));
  $('statsWords').addEventListener('click', () => setStatsFor('words'));

  function renderStats() {
    if (statsFor === 'words') return renderWordsStats();
    $('keysTitle').textContent = 'Symbols';
    $('letterBlock').hidden = false;
    CHART.draw($('chart'), state.lessons);
    const all = state.lessons;
    const totalMin = ENGINE.lessonMin(all);
    const best = (m) => {
      const xs = all.filter((x) => x.mode === m);
      return xs.length ? Math.round(Math.max(...xs.map((x) => x.wpm))) : '–';
    };
    const recent = all.slice(-20);
    const recentAcc = recent.length ? recent.reduce((a, x) => a + x.acc, 0) / recent.length : null;
    $('summary').innerHTML =
      '<div><b>' + all.length + '</b>lessons</div>' +
      '<div><b>' + Math.round(totalMin) + 'm</b>total practice</div>' +
      '<div><b>' + pct(recentAcc) + '</b>accuracy, last 20</div>' +
      '<div><b>' + best('adaptive') + '</b>best adaptive WPM</div>' +
      '<div><b>' + best('lines') + '</b>best lines WPM</div>' +
      '<div><b>' + state.unlocked + '/' + CONTENT.TRAIN.length + '</b>symbols unlocked</div>' +
      '<div class="wide"><b>Next symbol</b>' + escHtml(CTT.unlockText(ENGINE.unlockStatus(state), CONTENT.TRAIN[state.unlocked])) + '</div>';
    const now = Date.now();
    const rows = CONTENT.TRAIN.map((ch) => {
      const st = ENGINE.stats(state, ch, now);
      const review = st.level
        ? 'L' + st.level + (st.due ? (st.due <= now ? ', due' : ', ' + Math.ceil((st.due - now) / 86400000) + 'd') : '')
        : st.passDays ? st.passDays + '/' + ENGINE.CONST.PASS_DAYS + ' days' : '–';
      return (
        '<tr><td class="k"></td><td>' + st.status + '</td><td>' + st.n + '</td><td>' + pct(st.acc) +
        '</td><td>' + (st.wpm ? Math.round(st.wpm) + ' wpm' : '–') +
        '</td><td><div class="confbar"><i style="width:' + Math.round(st.conf * 100) + '%;background:' + confColor(st.conf) +
        '"></i></div></td><td>' + review + '</td><td>' + LAYOUT.describe(ch) + '</td></tr>'
      );
    });
    $('keyRows').innerHTML = rows.join('');
    $('keyRows').querySelectorAll('td.k').forEach((td, i) => (td.textContent = CONTENT.TRAIN[i]));

    const fill = (id, items, empty) => {
      const el = $(id);
      el.innerHTML = '';
      if (!items.length) { el.innerHTML = '<li class="muted">' + empty + '</li>'; return; }
      items.forEach((t) => { const li = document.createElement('li'); li.textContent = t; el.appendChild(li); });
    };
    fill('mixList', ENGINE.allConfusions(state, 8).map((c) => showChar(c.expected) + '  →  ' + showChar(c.typed) + '   ×' + c.count), 'No mix-ups recorded yet.');
    const LA = ENGINE.CONST.LETTER_ACC;
    const weakL = new Set(ENGINE.weakLetters(state, now));
    const letters = ENGINE.LETTERS.map((ch) => ({ ch, st: ENGINE.stats(state, ch, now) }))
      .filter((x) => x.st.n >= 5)
      .sort((a, b) => a.st.acc - b.st.acc)
      .slice(0, 8);
    fill('letterList', letters.map((x) => x.ch + '   ' + pct(x.st.acc) + '   (' + x.st.n + ')' +
      (weakL.has(x.ch) ? '   ← in drills' : x.st.acc < LA ? '   needs more samples' : '')), 'Needs 5+ samples per letter.');
    const drillW = new Set(ENGINE.drillWords(state, now));
    fill('wordList', ENGINE.troubleWords(state, 10, now).map((x) => x.word + '   ' + pct(1 - x.miss) + '   ' +
      (x.wpm ? Math.round(x.wpm) + ' wpm' : '–') + '   (' + x.n + ')' + (drillW.has(x.word) ? '   ← in drills' : '')),
    Object.keys(state.tokens || {}).some((w) => ENGINE.wordStats(state, w, now).n >= ENGINE.CONST.WORD_MIN)
      ? 'No trouble words: every word is clean and at target speed.'
      : 'Needs ' + ENGINE.CONST.WORD_MIN + '+ samples per word.');
    fill('pairList', ENGINE.slowPairs(state, 8).map((p) => p.pair.replace(/ /g, '␣') + '   ' + p.median + ' ms   (' + p.n + ')'), 'Needs 5+ samples per pair.');
    $('fileInfo').textContent = FILES.server()
      ? 'Auto-saving after every lesson to data/progress.json and data/report.md.'
      : FILES.connected()
        ? 'Saved after every lesson to ' + FILES.folder() + '/data/progress.json and report.md.'
        : 'Progress is saved in this browser automatically. Use Copy report to share your stats, or Save to folder to also keep files on disk.';
  }

  $('copyReport').addEventListener('click', async () => {
    const md = combinedReport();
    try {
      await navigator.clipboard.writeText(md);
      toast('Report copied');
    } catch (e) {
      STORE.download('typing-report.md', md, 'text/markdown');
    }
  });
  $('downloadReport').addEventListener('click', () => STORE.download('typing-report.md', combinedReport(), 'text/markdown'));
  window.addEventListener('resize', () => { if (view === 'stats') CHART.draw($('chart'), (statsFor === 'words' ? wordsState() : state).lessons); });

  // Words mode stats: same layout, its own data only.
  function renderWordsStats() {
    const W = wordsState();
    $('keysTitle').textContent = 'Letters (Words mode)';
    $('letterBlock').hidden = true;
    CHART.draw($('chart'), W.lessons);
    const all = W.lessons;
    const totalMin = ENGINE.lessonMin(all);
    const best = all.length ? Math.round(Math.max(...all.map((x) => x.wpm))) : '–';
    const recent = all.slice(-20);
    const recentAcc = recent.length ? recent.reduce((a, x) => a + x.acc, 0) / recent.length : null;
    $('summary').innerHTML =
      '<div><b>' + all.length + '</b>lessons</div>' +
      '<div><b>' + Math.round(totalMin) + 'm</b>total practice</div>' +
      '<div><b>' + pct(recentAcc) + '</b>accuracy, last 20</div>' +
      '<div><b>' + best + '</b>best words WPM</div>' +
      '<div><b>' + W.unlocked + '/' + WORDS.ORDER.length + '</b>letters unlocked</div>' +
      '<div class="wide"><b>Next letter</b>' + escHtml(CTT.unlockText(ENGINE.unlockStatus(W), WORDS.ORDER[W.unlocked], 'letter', 'Words lesson')) + '</div>';
    const now = Date.now();
    $('keyRows').innerHTML = WORDS.ORDER.map((ch) => keyRow(W, ch, now)).join('');
    $('keyRows').querySelectorAll('td.k').forEach((td, i) => (td.textContent = WORDS.ORDER[i]));
    fillList('mixList', ENGINE.allConfusions(W, 8).map((c) => showChar(c.expected) + '  →  ' + showChar(c.typed) + '   ×' + c.count), 'No mix-ups recorded yet.');
    fillList('pairList', [], 'Not tracked in Words mode.');
    $('fileInfo').textContent = 'Words mode progress is kept separately from the symbol stats.';
  }

  function keyRow(S, ch, now) {
    const st = ENGINE.stats(S, ch, now);
    const review = st.level
      ? 'L' + st.level + (st.due ? (st.due <= now ? ', due' : ', ' + Math.ceil((st.due - now) / 86400000) + 'd') : '')
      : st.passDays ? st.passDays + '/' + ENGINE.CONST.PASS_DAYS + ' days' : '–';
    return (
      '<tr><td class="k"></td><td>' + st.status + '</td><td>' + st.n + '</td><td>' + pct(st.acc) +
      '</td><td>' + (st.wpm ? Math.round(st.wpm) + ' wpm' : '–') +
      '</td><td><div class="confbar"><i style="width:' + Math.round(st.conf * 100) + '%;background:' + confColor(st.conf) +
      '"></i></div></td><td>' + review + '</td><td>' + LAYOUT.describe(ch) + '</td></tr>'
    );
  }

  function fillList(id, items, empty) {
    const el = $(id);
    el.innerHTML = '';
    if (!items.length) { el.innerHTML = '<li class="muted">' + empty + '</li>'; return; }
    items.forEach((t) => { const li = document.createElement('li'); li.textContent = t; el.appendChild(li); });
  }

  // ---------- settings ----------
  // Three tabs: General (shared), Symbols (main progress), Words (Words save only).
  const dlg = $('settings');
  function setSettingsTab(tab) {
    dlg.querySelectorAll('.seg button[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    dlg.querySelectorAll('section.tab').forEach((sec) => (sec.hidden = sec.dataset.tab !== tab));
  }
  dlg.querySelectorAll('.seg button[data-tab]').forEach((b) =>
    b.addEventListener('click', () => setSettingsTab(b.dataset.tab))
  );
  function fillWordsFields() {
    const wp = words.prefs;
    $('sWordsTarget').value = wp.targetWpm;
    $('sWordsLen').value = wp.lessonLen;
    $('sWordsCaps').value = String(wp.caps);
    $('sWordsNums').checked = wp.nums;
    $('sWordsPunct').checked = wp.punct;
  }
  function fillMainFields() {
    const s = state.settings;
    $('sTarget').value = s.targetWpm;
    $('sLen').value = s.lessonLen;
    $('sFocus').value = s.focusStyle || 'single';
    $('sStop').checked = s.stopOnError;
    $('sSound').checked = s.sound;
    $('sVol').value = s.volume;
    $('sKeymap').checked = s.showKeymap;
    $('sNext').checked = s.highlightNext;
    $('sFingers').checked = s.fingerColors;
  }
  $('settingsBtn').addEventListener('click', () => {
    fillMainFields();
    fillWordsFields();
    renderSync();
    renderWordsSync();
    // Opens on the tab of the mode on screen; General from Warmup.
    setSettingsTab(wordsOn ? 'words' : curMode() === 'warmup' ? 'general' : 'symbols');
    dlg.showModal();
  });
  function readSettings() {
    const s = state.settings;
    const before = JSON.stringify(s);
    const clamp = (v, lo, hi, d) => (isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
    s.targetWpm = clamp(parseFloat($('sTarget').value), 10, 120, 30);
    s.lessonLen = clamp(parseFloat($('sLen').value), 30, 200, 70);
    s.stopOnError = $('sStop').checked;
    s.sound = $('sSound').checked;
    s.volume = parseFloat($('sVol').value);
    s.showKeymap = $('sKeymap').checked;
    s.highlightNext = $('sNext').checked;
    s.fingerColors = $('sFingers').checked;
    s.focusStyle = $('sFocus').value === 'mixed' ? 'mixed' : 'single';
    const wp = words.prefs;
    const wBefore = JSON.stringify(wp);
    const textBefore = JSON.stringify([wp.lessonLen, wp.caps, wp.nums, wp.punct]);
    wp.targetWpm = clamp(parseFloat($('sWordsTarget').value), 10, 150, 35);
    wp.lessonLen = clamp(parseFloat($('sWordsLen').value), 30, 200, 70);
    wp.caps = clamp(parseInt($('sWordsCaps').value, 10), 0, 2, 0);
    wp.nums = $('sWordsNums').checked;
    wp.punct = $('sWordsPunct').checked;
    if (JSON.stringify(wp) !== wBefore) persistWords();
    // The main save is written only when a main setting changed, so Words settings
    // (and opening/closing the dialog) never touch it.
    if (JSON.stringify(s) !== before) persist();
    applySettings();
    renderStrip();
    // New Words text options apply at once if no Words lesson is under way.
    if (wordsOn && textBefore !== JSON.stringify([wp.lessonLen, wp.caps, wp.nums, wp.punct]) && lesson && lesson.start === null) {
      newLesson();
    }
  }
  dlg.querySelectorAll('input:not([type=file]), select').forEach((i) => i.addEventListener('change', readSettings));
  dlg.addEventListener('close', () => { readSettings(); renderFocus(); });
  $('sUnlock').addEventListener('click', () => {
    const ch = ENGINE.forceUnlock(state);
    persist();
    renderStrip();
    toast(ch ? 'Unlocked: ' + ch : 'All symbols are unlocked');
  });
  $('sUnlockWords').addEventListener('click', () => {
    const ch = ENGINE.forceUnlock(wordsState());
    persistWords();
    renderStrip();
    toast(ch ? 'Words: unlocked ' + ch : 'All letters are unlocked');
  });
  $('sExport').addEventListener('click', () => STORE.exportJson(state));
  $('sExportWords').addEventListener('click', () => STORE.exportWords(words));
  $('sImport').addEventListener('click', () => $('sImportFile').click());
  $('sImportFile').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const obj = JSON.parse(await f.text());
      if (obj && obj.kind === 'ctt-words') {
        // A Words export: only the Words progress changes.
        SYNC.cancelWords();
        words = STORE.mergeWords(obj);
        persistWords();
        boot();
        fillWordsFields();
        toast('Words progress imported');
      } else {
        const skipped = obj && obj.words && Array.isArray(obj.words.lessons) && obj.words.lessons.length > 0 && words.lessons.length > 0;
        state = STORE.merge(obj);
        persist();
        boot();
        fillMainFields();
        toast(skipped ? 'Progress imported. Words progress in this file was not imported; use a Words export' : 'Progress imported');
      }
    } catch (err) {
      toast('Could not read that file');
    }
    e.target.value = '';
  });
  $('sResetWords').addEventListener('click', () => {
    if (!confirm('Reset Words mode progress? The symbol progress is not affected. Export Words first if you want a backup.')) return;
    const prefs = words.prefs;
    SYNC.cancelWords();
    words = STORE.wordsDefaults();
    words.prefs = prefs;
    persistWords();
    boot();
    toast('Words progress reset');
  });
  $('sReset').addEventListener('click', () => {
    if (!confirm('Reset symbol progress and stats? Words mode progress is not affected. Export first if you want a backup.')) return;
    const settings = state.settings;
    state = STORE.defaults();
    state.settings = settings;
    persist();
    boot();
    toast('Progress reset');
  });

  // ---------- boot ----------
  function boot() {
    seedWordsFromLegacy();
    buildKeymap();
    applySettings();
    guardWords(() => {
      document.querySelectorAll('.modes button').forEach((b) => b.classList.toggle('on', b.dataset.mode === curMode()));
      renderStrip();
      renderMetrics();
      newLesson();
    });
    renderFileBtn();
  }
  boot();
  // Ask the browser to keep this site's storage (not evicted under disk pressure).
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  } catch (e) {
    /* not supported */
  }
  (async () => {
    // Synced copy first, so a newer gist is not overwritten by the local save below.
    if (SYNC.enabled()) await pullGist();
    if (SYNC.enabled()) pullWordsGist(); // Words file: separate request, not awaited
    // Preferred: auto-save through server.py (start-trainer.bat). No clicks needed.
    const srv = await FILES.detectServer();
    if (srv) {
      fileState = 'auto';
      const fromServer = srv.progress;
      if (fromServer && (fromServer.savedAt || 0) > (state.savedAt || 0)) {
        state = STORE.merge(fromServer);
        STORE.save(state);
        boot();
      } else {
        persist();
      }
      serverWords = 'words' in srv;
      if (serverWords) wordsFromCopy(srv.words, () => FILES.serverSaveWords(words));
      renderFileBtn();
      return;
    }
    // Fallback (page opened as a file): optional folder access.
    const s = await FILES.restore();
    fileState = s;
    renderFileBtn();
    if (s === 'granted') {
      await syncFromFile();
      await wordsFromFolder();
    }
  })();
})();
