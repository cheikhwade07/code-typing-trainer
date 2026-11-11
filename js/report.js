// Markdown metrics report, written to data/report.md and copyable for analysis.
(function () {
  const CTT = (window.CTT = window.CTT || {});
  const { ENGINE, CONTENT, LAYOUT } = CTT;
  const DAY = 86400000;

  const pct = (x) => (x == null || !isFinite(x) ? '–' : (x * 100).toFixed(1) + '%');
  const num = (x, d) => (x == null || !isFinite(x) ? '–' : x.toFixed(d == null ? 0 : d));
  const fmtDate = (ts) => {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  };
  const show = (ch) => (ch === ' ' ? 'space' : ch === '\n' ? 'enter' : ch === '|' ? '\\|' : ch === '`' ? "'`'" : ch);

  function avg(list, key) {
    return list.length ? list.reduce((a, x) => a + x[key], 0) / list.length : null;
  }

  function build(state) {
    const now = Date.now();
    const L = state.lessons;
    const in7 = L.filter((x) => now - x.ts < 7 * DAY);
    const prev7 = L.filter((x) => now - x.ts >= 7 * DAY && now - x.ts < 14 * DAY);
    const today = new Date().toDateString();
    const mins = (list) => list.reduce((a, x) => a + (x.dur || 0), 0) / 60000;
    const C = ENGINE.CONST;
    const out = [];

    out.push('# Code Typing Trainer report', '');
    out.push('Generated: ' + fmtDate(now));
    out.push('Data window: last ' + C.HIST + ' attempts per key, dropped after ' + C.MAX_AGE_D + ' days; weight halves every ' + C.HALF_LIFE_D + ' days and after ' + C.ATTEMPT_HALF + ' newer attempts.');
    out.push('Mastery: 90% sure accuracy is at least ' + Math.round(C.MASTER_BAR * 100) + '% (and target speed), on ' + C.PASS_DAYS + ' different days with ' + Math.round(C.DAY_ACC * 100) + '%+ that day. Demoted when 80% sure accuracy is below ' + Math.round(C.DEMOTE_BAR * 100) + '%.');
    out.push('Settings: target ' + state.settings.targetWpm + ' WPM per key, stop on error ' + (state.settings.stopOnError ? 'on' : 'off') + '.');
    out.push('');

    out.push('## Summary', '');
    out.push('- Lessons: ' + L.length + ' total, ' + in7.length + ' in the last 7 days');
    out.push('- Practice time: ' + num(mins(L.filter((x) => new Date(x.ts).toDateString() === today)), 1) + ' min today, ' + num(mins(in7), 1) + ' min last 7 days, ' + num(mins(L), 1) + ' min total');
    out.push('- Symbols unlocked: ' + state.unlocked + '/' + CONTENT.TRAIN.length);
    out.push('- Next unlock: ' + CTT.unlockText(ENGINE.unlockStatus(state, now), CONTENT.TRAIN[state.unlocked]));
    const sh = in7.reduce((a, x) => a + (x.sameHand || 0), 0);
    const shifted = in7.reduce((a, x) => a + (x.shifted || 0), 0);
    out.push('- Same-hand Shift (7 days): ' + sh + (shifted ? ' of ' + shifted + ' shifted characters (' + pct(sh / shifted) + ')' : ''));
    out.push('');

    out.push('## Trend by mode', '');
    out.push('| Mode | Lessons 7d | WPM 7d | WPM prev 7d | Accuracy 7d | Accuracy prev 7d | Best WPM |');
    out.push('|---|---|---|---|---|---|---|');
    for (const m of ['adaptive', 'lines', 'mycode']) {
      const a = in7.filter((x) => x.mode === m);
      const b = prev7.filter((x) => x.mode === m);
      const all = L.filter((x) => x.mode === m);
      if (!all.length) continue;
      out.push('| ' + m + ' | ' + a.length + ' | ' + num(avg(a, 'wpm'), 1) + ' | ' + num(avg(b, 'wpm'), 1) + ' | ' + pct(avg(a, 'acc')) + ' | ' + pct(avg(b, 'acc')) + ' | ' + num(Math.max(...all.map((x) => x.wpm)), 1) + ' |');
    }
    out.push('');

    out.push('## Symbols', '');
    out.push('| Key | Status | Samples (21d) | Weighted | Accuracy | Speed (WPM) | Review level | Next review | Top mix-up | Finger |');
    out.push('|---|---|---|---|---|---|---|---|---|---|');
    for (const ch of CONTENT.TRAIN) {
      const st = ENGINE.stats(state, ch, now);
      if (st.status === 'locked' && !st.n) continue;
      const mix = ENGINE.topConfusions(state, ch, 1)[0];
      const due = st.due ? (st.due <= now ? 'due now' : 'in ' + Math.ceil((st.due - now) / DAY) + 'd') : st.passDays ? st.passDays + '/' + C.PASS_DAYS + ' days passed' : '–';
      out.push('| `' + show(ch) + '` | ' + st.status + ' | ' + st.n + ' | ' + num(st.eff, 1) + ' | ' + pct(st.acc) + ' | ' + num(st.wpm) + ' | ' + st.level + ' | ' + due + ' | ' + (mix ? '`' + show(mix.typed) + '` ×' + mix.count : '–') + ' | ' + LAYOUT.describe(ch) + ' |');
    }
    out.push('');

    const weakL = new Set(ENGINE.weakLetters(state, now));
    const lets = ENGINE.LETTERS.map((ch) => ({ ch, st: ENGINE.stats(state, ch, now) }))
      .filter((x) => x.st.n > 0)
      .sort((a, b) => a.st.acc - b.st.acc);
    out.push('## Letters (weakest first; below ' + Math.round(ENGINE.CONST.LETTER_ACC * 100) + '% with ' + ENGINE.CONST.LETTER_MIN + '+ weighted samples get mixed into drills)', '');
    if (lets.length) {
      out.push('| Key | Samples (21d) | Accuracy | Speed (WPM) | Top mix-up | In drills | Finger |', '|---|---|---|---|---|---|---|');
      lets.forEach(({ ch, st }) => {
        const mix = ENGINE.topConfusions(state, ch, 1)[0];
        out.push('| `' + ch + '` | ' + st.n + ' | ' + pct(st.acc) + ' | ' + num(st.wpm) + ' | ' + (mix ? '`' + show(mix.typed) + '` ×' + mix.count : '–') + ' | ' + (weakL.has(ch) ? 'yes' : '–') + ' | ' + LAYOUT.describe(ch) + ' |');
      });
    } else out.push('None recorded yet.');
    out.push('');

    const conf = ENGINE.allConfusions(state, 12);
    out.push('## Top mix-ups (expected → typed, last 21 days)', '');
    if (conf.length) {
      out.push('| Expected | Typed | Count |', '|---|---|---|');
      conf.forEach((c) => out.push('| `' + show(c.expected) + '` | `' + show(c.typed) + '` | ' + c.count + ' |'));
    } else out.push('None recorded yet.');
    out.push('');

    const pairs = ENGINE.slowPairs(state, 10);
    out.push('## Slowest transitions (pairs with a symbol, median ms from previous key)', '');
    if (pairs.length) {
      out.push('| Pair | Median ms | Samples |', '|---|---|---|');
      pairs.forEach((p) => out.push('| `' + p.pair.replace(/\|/g, '\\|').replace(/ /g, '␣') + '` | ' + p.median + ' | ' + p.n + ' |'));
    } else out.push('Not enough data yet (needs 5+ samples per pair).');
    out.push('');

    out.push('## Recent lessons', '');
    out.push('| When | Mode | WPM | Accuracy | Errors | Chars | Same-hand Shift |', '|---|---|---|---|---|---|---|');
    L.slice(-15).reverse().forEach((x) =>
      out.push('| ' + fmtDate(x.ts) + ' | ' + x.mode + ' | ' + num(x.wpm, 1) + ' | ' + pct(x.acc) + ' | ' + x.errors + ' | ' + x.chars + ' | ' + (x.sameHand || 0) + ' |')
    );
    out.push('');
    return out.join('\n');
  }

  // Words mode section, kept out of the saved report (data/report.md, gist): only
  // Copy report and Download report append it, and only once there is a Words lesson.
  // W: the Words save; settings: main settings (read only).
  function buildWords(W, settings, now) {
    try {
      return buildWordsUnsafe(W, settings, now || Date.now());
    } catch (e) {
      return '\n## Words mode (separate from the symbol stats)\n\nWords section unavailable.\n';
    }
  }

  function buildWordsUnsafe(W, settings, now) {
    const L = (W && Array.isArray(W.lessons) ? W.lessons : []).filter((x) => x && Number.isFinite(x.ts));
    if (!L.length || !CTT.WORDS) return '';
    const order = CTT.WORDS.ORDER;
    const target = (W.prefs && W.prefs.targetWpm) || 35;
    // Read-only view: the engine sees Words keys and the Words target speed.
    const view = Object.create(W);
    Object.defineProperty(view, 'order', { value: order });
    Object.defineProperty(view, 'settings', { value: { ...settings, targetWpm: target } });
    const out = ['## Words mode (separate from the symbol stats)', ''];
    const in7 = L.filter((x) => now - x.ts < 7 * DAY);
    const avg = (xs, k) => (xs.length ? xs.reduce((a, x) => a + x[k], 0) / xs.length : null);
    out.push('- Lessons: ' + L.length + ' total, ' + in7.length + ' in the last 7 days; ' + num(L.reduce((a, x) => a + (x.dur || 0), 0) / 60000, 1) + ' min total');
    out.push('- Last 7 days: ' + num(avg(in7, 'wpm'), 1) + ' WPM, ' + pct(avg(in7, 'acc')) + ' accuracy');
    out.push('- Letters unlocked: ' + W.unlocked + '/' + order.length + ' (target ' + target + ' WPM per letter)');
    out.push('- Next unlock: ' + CTT.unlockText(ENGINE.unlockStatus(view, now), order[W.unlocked], 'letter', 'Words lesson'));
    const weak = order.slice(0, W.unlocked)
      .map((ch) => ({ ch, st: ENGINE.stats(view, ch, now) }))
      .filter((x) => x.st.n >= 5)
      .sort((a, b) => a.st.conf - b.st.conf)
      .slice(0, 5);
    if (weak.length) out.push('- Weakest letters: ' + weak.map((x) => '`' + x.ch + '` ' + pct(x.st.acc) + ' / ' + num(x.st.wpm) + ' WPM').join(', '));
    out.push('');
    return '\n' + out.join('\n');
  }

  CTT.REPORT = { build, buildWords };
})();
