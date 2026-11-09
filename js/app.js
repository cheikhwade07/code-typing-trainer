// Main controller: lessons, typing loop, rendering, settings, stats view.
(function () {
  const { LAYOUT, CONTENT, ENGINE, STORE, SOUND, CHART, FILES, REPORT } = window.CTT;
  const $ = (id) => document.getElementById(id);

  let state = STORE.load();
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

  // ---------- lesson creation ----------
  function buildText() {
    const mode = state.mode;
    if (mode === 'adaptive') {
      const plan = ENGINE.plan(state);
      buildText.focus = plan.focus;
      return CONTENT.adaptive(ENGINE.unlockedList(state), plan, state.settings.lessonLen);
    }
    if (mode === 'lines') {
      return CONTENT.lines((ch) => ENGINE.weakness(state, ch), 3);
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
    const text = buildText();
    $('mycodePanel').hidden = !(state.mode === 'mycode' && (!text || $('mycodePanel').dataset.open === '1'));
    if (state.mode === 'mycode') updateMycodeInfo();
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
      text, mode: state.mode, pos: 0, auto, errorsAt: new Set(), start: null, lastT: null,
      sameHand: 0, shifted: 0, done: false, typed: 0, perKey: {}, prevCh: null, focus: buildText.focus,
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

  function renderFileBtn() {
    const b = $('fileBtn');
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

  $('fileBtn').addEventListener('click', async () => {
    $('fileBtn').blur();
    try {
      if (fileState === 'prompt') {
        if (!(await FILES.reconnect())) return;
      } else {
        await FILES.choose();
      }
      fileState = 'granted';
      renderFileBtn();
      await syncFromFile();
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
    const focus = ENGINE.focusKey(state);
    CONTENT.TRAIN.forEach((ch, i) => {
      const d = document.createElement('div');
      const st = ENGINE.stats(state, ch);
      const locked = i >= state.unlocked;
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
    if (state.mode === 'adaptive') {
      const p = ENGINE.plan(state);
      const esc = (c) => c.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      if (p.focus) {
        html = (p.phase === 'learn' ? 'Learning <b>' : 'Focus <b>') + esc(p.focus) + '</b> · ' + LAYOUT.describe(p.focus);
        if (p.partner) html += ' · mix-up: you often type <b>' + esc(p.partner) + '</b>';
        const also = p.secondary.filter((c) => c !== p.partner).slice(0, 4);
        if (p.phase !== 'learn' && also.length) html += ' · also <b>' + also.map(esc).join(' ') + '</b>';
      }
    } else if (state.mode === 'mycode' && state.mycode.shown && lesson) {
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
    const all = state.lessons;
    const L = last || all[all.length - 1];
    const today = new Date().toDateString();
    const mins = all.filter((x) => new Date(x.ts).toDateString() === today).reduce((a, x) => a + (x.dur || 0), 0) / 60000;
    $('mToday').textContent = mins < 1 ? Math.round(mins * 60) + 's' : Math.round(mins) + 'm';
    if (!L) return;
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
  function onChar(ch, e) {
    const L = lesson;
    if (!L || L.done) return;
    SOUND.init();
    const now = performance.now();
    if (L.start === null) L.start = now;
    const exp = L.text[L.pos];

    const pk = (L.perKey[exp] = L.perKey[exp] || { n: 0, ok: 0, tSum: 0, tN: 0 });
    if (ch === exp) {
      const req = LAYOUT.requiredShift(ch);
      if (req) L.shifted++;
      if (e.shiftKey && req && shiftsDown.size && !shiftsDown.has(req)) {
        L.sameHand++;
        renderFocus('use ' + (req === 'ShiftLeft' ? 'LEFT' : 'RIGHT') + ' Shift for ' + showChar(ch));
      }
      if (!L.errorsAt.has(L.pos)) {
        let t = L.lastT === null ? null : now - L.lastT;
        if (t != null && t > 3000) t = null;
        ENGINE.record(state, exp, true, t);
        pk.n++;
        pk.ok++;
        if (t != null) {
          pk.tSum += t;
          pk.tN++;
          const pair = (L.prevCh || '') + exp;
          if (L.prevCh && L.prevCh !== '\n' && (CONTENT.symbolsIn(pair).size)) ENGINE.recordPair(state, pair, t);
        }
      }
      L.prevCh = exp;
      spans[L.pos].classList.add('done');
      if (L.errorsAt.has(L.pos)) spans[L.pos].classList.add('err');
      L.lastT = now;
      L.typed++;
      L.pos++;
      skipAuto();
      SOUND.click();
      if (L.pos >= L.text.length) return finish();
    } else {
      if (!L.errorsAt.has(L.pos)) {
        L.errorsAt.add(L.pos);
        ENGINE.record(state, exp, false, null, ch);
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

  function onBackspace() {
    const L = lesson;
    if (!L || L.done || state.settings.stopOnError || L.pos === 0) return;
    let p = L.pos - 1;
    while (p > 0 && L.auto.has(p)) p--;
    if (L.auto.has(p)) return;
    spans[p].classList.remove('done', 'err');
    L.pos = p;
    L.typed = Math.max(0, L.typed - 1);
    updateCursor();
    renderKeymapHighlight();
  }

  function finish() {
    const L = lesson;
    L.done = true;
    const now = performance.now();
    const dur = Math.max(1, now - L.start);
    const chars = L.text.length - L.auto.size;
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
    state.lessons.push(rec);
    if (L.mode === 'mycode') state.mycode.pos = state.mycode.next || 0;
    const events = ENGINE.afterLesson(state, L.perKey, L.mode, L.focus);
    persist();
    SOUND.complete();
    if (events.length) {
      if (events.some((x) => /unlocked|Mastered|passed/.test(x))) SOUND.unlock();
      toast(events.join(' · '));
    }
    renderMetrics(rec);
    renderStrip();
    newLesson();
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
    state.mode = mode;
    persist();
    document.querySelectorAll('.modes button').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
    $('mycodePanel').dataset.open = '0';
    showView('practice');
    newLesson();
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
    if (state.mode !== 'mycode') return;
    $('mycodePanel').dataset.open = '1';
    $('mycodeText').value = state.mycode.text || '';
    $('mycodePanel').hidden = false;
  });

  function showView(v) {
    view = v;
    $('practice').hidden = v !== 'practice';
    $('statsView').hidden = v !== 'stats';
    $('statsBtn').textContent = v === 'stats' ? 'Practice' : 'Stats';
    if (v === 'stats') renderStats();
  }
  $('statsBtn').addEventListener('click', () => {
    $('statsBtn').blur();
    showView(view === 'stats' ? 'practice' : 'stats');
  });

  function renderStats() {
    CHART.draw($('chart'), state.lessons);
    const all = state.lessons;
    const totalMin = all.reduce((a, x) => a + (x.dur || 0), 0) / 60000;
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
      '<div><b>' + state.unlocked + '/' + CONTENT.TRAIN.length + '</b>symbols unlocked</div>';
    const now = Date.now();
    const rows = CONTENT.TRAIN.map((ch) => {
      const st = ENGINE.stats(state, ch, now);
      const review = st.level ? 'L' + st.level + (st.due ? (st.due <= now ? ', due' : ', ' + Math.ceil((st.due - now) / 86400000) + 'd') : '') : '–';
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
    fill('pairList', ENGINE.slowPairs(state, 8).map((p) => p.pair.replace(/ /g, '␣') + '   ' + p.median + ' ms   (' + p.n + ')'), 'Needs 5+ samples per pair.');
    $('fileInfo').textContent = FILES.server()
      ? 'Auto-saving after every lesson to data/progress.json and data/report.md.'
      : FILES.connected()
        ? 'Saved after every lesson to ' + FILES.folder() + '/data/progress.json and report.md.'
        : 'Progress is saved in this browser automatically. Use Copy report to share your stats, or Save to folder to also keep files on disk.';
  }

  $('copyReport').addEventListener('click', async () => {
    const md = REPORT.build(state);
    try {
      await navigator.clipboard.writeText(md);
      toast('Report copied');
    } catch (e) {
      STORE.download('typing-report.md', md, 'text/markdown');
    }
  });
  $('downloadReport').addEventListener('click', () => STORE.download('typing-report.md', REPORT.build(state), 'text/markdown'));
  window.addEventListener('resize', () => { if (view === 'stats') CHART.draw($('chart'), state.lessons); });

  // ---------- settings ----------
  const dlg = $('settings');
  $('settingsBtn').addEventListener('click', () => {
    const s = state.settings;
    $('sTarget').value = s.targetWpm;
    $('sLen').value = s.lessonLen;
    $('sStop').checked = s.stopOnError;
    $('sSound').checked = s.sound;
    $('sVol').value = s.volume;
    $('sKeymap').checked = s.showKeymap;
    $('sNext').checked = s.highlightNext;
    $('sFingers').checked = s.fingerColors;
    $('sFocus').value = s.focusStyle || 'single';
    dlg.showModal();
  });
  function readSettings() {
    const s = state.settings;
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
    persist();
    applySettings();
    renderStrip();
  }
  dlg.querySelectorAll('input, select').forEach((i) => i.addEventListener('change', readSettings));
  dlg.addEventListener('close', () => { readSettings(); renderFocus(); });
  $('sUnlock').addEventListener('click', () => {
    const ch = ENGINE.forceUnlock(state);
    persist();
    renderStrip();
    toast(ch ? 'Unlocked: ' + ch : 'All symbols are unlocked');
  });
  $('sExport').addEventListener('click', () => STORE.exportJson(state));
  $('sImport').addEventListener('click', () => $('sImportFile').click());
  $('sImportFile').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      state = STORE.merge(JSON.parse(await f.text()));
      persist();
      boot();
      toast('Progress imported');
    } catch (err) {
      toast('Could not read that file');
    }
    e.target.value = '';
  });
  $('sReset').addEventListener('click', () => {
    if (!confirm('Reset all progress and stats? Export first if you want a backup.')) return;
    const settings = state.settings;
    state = STORE.defaults();
    state.settings = settings;
    persist();
    boot();
    toast('Progress reset');
  });

  // ---------- boot ----------
  function boot() {
    buildKeymap();
    applySettings();
    document.querySelectorAll('.modes button').forEach((b) => b.classList.toggle('on', b.dataset.mode === state.mode));
    renderStrip();
    renderMetrics();
    newLesson();
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
      renderFileBtn();
      return;
    }
    // Fallback (page opened as a file): optional folder access.
    const s = await FILES.restore();
    fileState = s;
    renderFileBtn();
    if (s === 'granted') await syncFromFile();
  })();
})();
