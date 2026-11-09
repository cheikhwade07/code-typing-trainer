// Main controller: lessons, typing loop, rendering, settings, stats view.
(function () {
  const { LAYOUT, CONTENT, ENGINE, STORE, SOUND, CHART } = window.CTT;
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
      return CONTENT.adaptive(ENGINE.unlockedList(state), ENGINE.focusKey(state), state.settings.lessonLen);
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
      sameHand: 0, done: false, typed: 0,
    };
    skipAuto();
    renderText();
    renderFocus();
    renderKeymapHighlight();
  }

  function skipAuto() {
    while (lesson.pos < lesson.text.length && lesson.auto.has(lesson.pos)) lesson.pos++;
  }

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
      d.className = 'sym' + (locked ? ' locked' : '') + (ch === focus && !locked ? ' focus' : '') + (st.learned ? ' learned' : '');
      d.textContent = ch;
      if (!locked) {
        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.innerHTML = '<i style="width:' + Math.round(st.conf * 100) + '%;background:' + confColor(st.conf) + '"></i>';
        d.appendChild(bar);
      }
      d.title = locked
        ? ch + ' (locked)'
        : ch + '  ·  ' + LAYOUT.describe(ch) + '\naccuracy ' + pct(st.acc) + ', speed ' + (st.wpm ? Math.round(st.wpm) + ' wpm' : '–') + ', ' + st.n + ' samples';
      strip.appendChild(d);
    });
  }

  function renderFocus(extra) {
    const el = $('focusLine');
    let html = '';
    if (state.mode === 'adaptive') {
      const f = ENGINE.focusKey(state);
      if (f) html = 'Focus <b>' + f + '</b> · ' + LAYOUT.describe(f);
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
  }

  function renderKeymapHighlight() {
    document.querySelectorAll('.key.next, .key.nextshift').forEach((k) => k.classList.remove('next', 'nextshift'));
    if (!state.settings.highlightNext || !lesson || lesson.done) return;
    const ch = lesson.text[lesson.pos];
    const m = LAYOUT.charMap[ch];
    if (!m) return;
    const el = $('k-' + m.code);
    if (el) el.classList.add('next');
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

    if (ch === exp) {
      if (e.shiftKey) {
        const req = LAYOUT.requiredShift(ch);
        if (req && shiftsDown.size && !shiftsDown.has(req)) {
          L.sameHand++;
          renderFocus('use ' + (req === 'ShiftLeft' ? 'LEFT' : 'RIGHT') + ' Shift for ' + showChar(ch));
        }
      }
      if (!L.errorsAt.has(L.pos)) {
        const t = L.lastT === null ? null : now - L.lastT;
        ENGINE.record(state, exp, true, t != null && t > 3000 ? null : t);
      }
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
        ENGINE.record(state, exp, false, null);
      }
      SOUND.error();
      if (state.settings.stopOnError) {
        const s = spans[L.pos];
        s.classList.remove('bad');
        void s.offsetWidth; // restart the shake animation
        s.classList.add('bad');
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
      dur: Math.round(dur),
    };
    state.lessons.push(rec);
    if (L.mode === 'mycode') state.mycode.pos = state.mycode.next || 0;
    const unlocked = ENGINE.maybeUnlock(state);
    STORE.save(state);
    SOUND.complete();
    if (unlocked) {
      SOUND.unlock();
      toast('New symbol unlocked: ' + unlocked);
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
    STORE.save(state);
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
    STORE.save(state);
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
    const rows = CONTENT.TRAIN.map((ch, i) => {
      const st = ENGINE.stats(state, ch);
      const status = i >= state.unlocked ? 'locked' : st.learned ? 'learned' : 'learning';
      return (
        '<tr><td class="k"></td><td>' + status + '</td><td>' + st.n + '</td><td>' + pct(st.acc) +
        '</td><td>' + (st.wpm ? Math.round(st.wpm) + ' wpm' : '–') +
        '</td><td><div class="confbar"><i style="width:' + Math.round(st.conf * 100) + '%;background:' + confColor(st.conf) +
        '"></i></div></td><td>' + LAYOUT.describe(ch) + '</td></tr>'
      );
    });
    $('keyRows').innerHTML = rows.join('');
    $('keyRows').querySelectorAll('td.k').forEach((td, i) => (td.textContent = CONTENT.TRAIN[i]));
  }
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
    STORE.save(state);
    applySettings();
    renderStrip();
  }
  dlg.querySelectorAll('input').forEach((i) => i.addEventListener('change', readSettings));
  dlg.addEventListener('close', () => { readSettings(); renderFocus(); });
  $('sUnlock').addEventListener('click', () => {
    const ch = ENGINE.forceUnlock(state);
    STORE.save(state);
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
      STORE.save(state);
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
    STORE.save(state);
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
  }
  boot();
})();
