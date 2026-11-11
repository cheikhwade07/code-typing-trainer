// localStorage persistence (fast local copy), version migration, and JSON export.
// The durable copy lives in data/progress.json via files.js.
(function () {
  const CTT = (window.CTT = window.CTT || {});
  const KEY = 'ctt.v1';
  const VERSION = 3;

  function defaults() {
    return {
      v: VERSION,
      savedAt: 0,
      settings: {
        targetWpm: 30,
        lessonLen: 70,
        stopOnError: true,
        sound: true,
        volume: 0.6,
        showKeymap: true,
        highlightNext: true,
        fingerColors: true,
        focusStyle: 'single', // 'single' (keybr-style learn phase) | 'mixed'
      },
      mode: 'adaptive',
      unlocked: 6,
      sinceUnlock: 0, // adaptive lessons since the last unlock
      keys: {}, // ch -> { hist: [{ok, t, ts}], level, due, passDays: [{day, ts}], good }
      confusions: {}, // expected ch -> [{c: typed, ts}]
      pairs: {}, // "ab" -> [{t, ts}]
      cooldown: {}, // ch -> lessons left resting
      focusRun: null, // { ch, lessons, startConf }
      lessons: [],
      mycode: { text: '', pos: 0 },
    };
  }

  function merge(raw) {
    raw = stripLegacy(raw);
    const d = defaults();
    if (!raw || typeof raw !== 'object') return d;
    const s = {
      ...d,
      ...raw,
      settings: { ...d.settings, ...(raw.settings || {}) },
      mycode: { ...d.mycode, ...(raw.mycode || {}) },
      keys: raw.keys || {},
      confusions: raw.confusions || {},
      pairs: raw.pairs || {},
      cooldown: raw.cooldown || {},
      lessons: Array.isArray(raw.lessons) ? raw.lessons : [],
    };
    // v1 -> v2: samples had no timestamp; treat them as recent.
    const now = Date.now();
    for (const k of Object.values(s.keys)) {
      k.hist = (k.hist || []).map((x) => (x.ts ? x : { ...x, ts: now }));
      if (k.level == null) k.level = 0;
      if (k.due === undefined) k.due = null;
    }
    // v3: finger colors became the default.
    if ((raw.v || 1) < 3) s.settings.fingerColors = true;
    s.v = VERSION;
    return s;
  }

  // Progress survives code updates: the storage key never changes, and merge()
  // migrates older saves forward. Two safeguards against losing it anyway:
  // - unreadable data is copied aside instead of being overwritten;
  // - the previous save is kept under KEY + '.prev'.
  function load() {
    let raw = null;
    try {
      raw = localStorage.getItem(KEY);
      if (raw == null) raw = localStorage.getItem(KEY + '.prev');
      return merge(raw ? JSON.parse(raw) : null);
    } catch (e) {
      try {
        if (raw) localStorage.setItem(KEY + '.unreadable-' + Date.now(), raw);
        const prev = localStorage.getItem(KEY + '.prev');
        if (prev) return merge(JSON.parse(prev));
      } catch (e2) {
        /* fall through to a fresh start */
      }
      return defaults();
    }
  }

  function save(state) {
    state.savedAt = Date.now();
    if (state.lessons.length > 1000) state.lessons.splice(0, state.lessons.length - 1000);
    try {
      const current = localStorage.getItem(KEY);
      if (current) localStorage.setItem(KEY + '.prev', current);
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      /* storage unavailable: the file copy (if connected) still saves */
    }
  }

  function download(name, text, type) {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function exportJson(state) {
    download('code-typing-trainer-backup-' + new Date().toISOString().slice(0, 10) + '.json',
      JSON.stringify(state, null, 2), 'application/json');
  }

  // ---------- Words mode: a separate save (sidecar) ----------
  // Words progress never lives in the main save above. It has its own localStorage
  // key, gist file, server file and export, so nothing Words does can change the
  // symbol progress. The functions above are the same as before Words existed.
  const WKEY = 'ctt.words.v1';
  const WACTIVE = 'ctt.words.active';
  const WVERSION = 1;
  const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
  const SYMBOL_MODES = ['adaptive', 'lines', 'mycode', 'warmup'];
  const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
  const clampNum = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

  function wordsDefaults() {
    return {
      kind: 'ctt-words',
      v: WVERSION,
      savedAt: 0,
      prefs: { targetWpm: 35, lessonLen: 70 },
      unlocked: 10,
      sinceUnlock: 0,
      keys: {},
      confusions: {},
      pairs: {},
      cooldown: {},
      focusRun: null,
      lessons: [],
    };
  }

  // Never throws: bad Words data falls back to defaults.
  function mergeWords(raw) {
    try {
      return mergeWordsUnsafe(raw);
    } catch (e) {
      return wordsDefaults();
    }
  }

  function mergeWordsUnsafe(raw) {
    const d = wordsDefaults();
    const r = isObj(raw) ? raw : {};
    const p = isObj(r.prefs) ? r.prefs : {};
    const w = {
      ...r, // unknown fields from a newer version are kept
      kind: 'ctt-words',
      v: Number.isInteger(r.v) && r.v > WVERSION ? r.v : WVERSION,
      savedAt: Number.isFinite(r.savedAt) && r.savedAt >= 0 ? r.savedAt : 0,
      prefs: {
        ...p,
        targetWpm: clampNum(p.targetWpm, 10, 150, d.prefs.targetWpm),
        lessonLen: clampNum(p.lessonLen, 30, 200, d.prefs.lessonLen),
      },
      unlocked: Number.isInteger(r.unlocked) && r.unlocked >= 10 && r.unlocked <= 26 ? r.unlocked : d.unlocked,
      sinceUnlock: Number.isFinite(r.sinceUnlock) && r.sinceUnlock >= 0 ? r.sinceUnlock : 0,
      keys: isObj(r.keys) ? r.keys : {},
      confusions: isObj(r.confusions) ? r.confusions : {},
      pairs: isObj(r.pairs) ? r.pairs : {},
      cooldown: isObj(r.cooldown) ? r.cooldown : {},
      focusRun:
        isObj(r.focusRun) && typeof r.focusRun.ch === 'string' && r.focusRun.ch.length === 1 && LETTERS.includes(r.focusRun.ch)
          ? r.focusRun
          : null,
      // Only well-formed lesson records: the report and metrics read these fields.
      lessons: (Array.isArray(r.lessons) ? r.lessons : []).filter(
        (x) => isObj(x) && Number.isFinite(x.ts) && Number.isFinite(x.wpm) && Number.isFinite(x.acc)
      ),
    };
    delete w.order; // runtime-only (engine view), never saved
    delete w.settings;
    const now = Date.now();
    for (const ch of Object.keys(w.keys)) {
      if (ch.length !== 1 || !LETTERS.includes(ch) || !isObj(w.keys[ch])) {
        delete w.keys[ch];
        continue;
      }
      // Every field the engine reads gets a shape it can use, so bad data cannot
      // throw later while rendering or recording.
      const k = w.keys[ch];
      k.hist = (Array.isArray(k.hist) ? k.hist : []).filter(isObj).map((x) => (Number.isFinite(x.ts) && x.ts ? x : { ...x, ts: now }));
      k.level = Number.isInteger(k.level) && k.level >= 0 && k.level <= 5 ? k.level : 0;
      k.due = Number.isFinite(k.due) ? k.due : null;
      if ('passDays' in k) k.passDays = (Array.isArray(k.passDays) ? k.passDays : []).filter((d) => isObj(d) && Number.isFinite(d.ts));
      if ('rev' in k) k.rev = isObj(k.rev) ? k.rev : null;
      if ('good' in k) k.good = k.good === true;
    }
    for (const m of [w.confusions, w.pairs]) {
      for (const ch of Object.keys(m)) {
        if (!Array.isArray(m[ch])) delete m[ch];
        else m[ch] = m[ch].filter((e) => isObj(e) && Number.isFinite(e.ts));
      }
    }
    for (const ch of Object.keys(w.cooldown)) if (!Number.isFinite(w.cooldown[ch])) delete w.cooldown[ch];
    return w;
  }

  // Same safeguards as load(): unreadable data is copied aside, .prev is the fallback.
  function loadWords() {
    let raw = null;
    try {
      raw = localStorage.getItem(WKEY);
      if (raw == null) raw = localStorage.getItem(WKEY + '.prev');
      return mergeWords(raw ? JSON.parse(raw) : null);
    } catch (e) {
      try {
        if (raw) localStorage.setItem(WKEY + '.unreadable', raw);
        const prev = localStorage.getItem(WKEY + '.prev');
        if (prev) return mergeWords(JSON.parse(prev));
      } catch (e2) {
        /* fall through to a fresh start */
      }
      return wordsDefaults();
    }
  }

  // keepSavedAt: when adopting a newer copy from elsewhere, keep its time.
  function saveWords(w, keepSavedAt) {
    if (!keepSavedAt) w.savedAt = Date.now();
    if (w.lessons.length > 1000) w.lessons.splice(0, w.lessons.length - 1000);
    let text;
    try {
      text = JSON.stringify(w);
    } catch (e) {
      return;
    }
    try {
      const current = localStorage.getItem(WKEY);
      if (current) localStorage.setItem(WKEY + '.prev', current);
      localStorage.setItem(WKEY, text);
    } catch (e) {
      // Storage full: drop the Words backup and try once more. Never touches ctt.v1.
      try {
        localStorage.removeItem(WKEY + '.prev');
        localStorage.setItem(WKEY, text);
      } catch (e2) {
        /* give up quietly: gist / server copies (if any) still save */
      }
    }
  }

  // Which mode is on screen is per device: not synced, never part of any save.
  function wordsActive() {
    try {
      return localStorage.getItem(WACTIVE) === '1';
    } catch (e) {
      return false;
    }
  }
  function setWordsActive(on) {
    try {
      if (on) localStorage.setItem(WACTIVE, '1');
      else localStorage.removeItem(WACTIVE);
    } catch (e) {
      /* ignore */
    }
  }

  function exportWords(w) {
    download('code-typing-trainer-words-backup-' + new Date().toISOString().slice(0, 10) + '.json',
      JSON.stringify(w, null, 2), 'application/json');
  }

  // A test build kept Words inside the main save (`words`, `mainMode`,
  // `wordsActive`, `settings.wordsTargetWpm`). Those fields are removed before the
  // main merge; the Words part is offered once to seed an empty Words save.
  // For saves without those fields, the input is returned as is.
  let legacyWords = null;
  function stripLegacy(raw) {
    if (!isObj(raw)) return raw;
    const hasSetting = isObj(raw.settings) && 'wordsTargetWpm' in raw.settings;
    if (!('words' in raw) && !('mainMode' in raw) && !('wordsActive' in raw) && !hasSetting && raw.mode !== 'words') return raw;
    const out = { ...raw };
    if (isObj(raw.words)) {
      legacyWords = {
        words: raw.words,
        targetWpm: hasSetting ? raw.settings.wordsTargetWpm : undefined,
        savedAt: raw.savedAt,
      };
    }
    if (out.mode === 'words' || out.wordsActive === true) {
      out.mode = SYMBOL_MODES.includes(raw.mainMode) ? raw.mainMode : 'adaptive';
    }
    delete out.words;
    delete out.mainMode;
    delete out.wordsActive;
    if (hasSetting) {
      out.settings = { ...raw.settings };
      delete out.settings.wordsTargetWpm;
    }
    return out;
  }
  // Returns the stashed legacy Words part once (or null).
  function takeLegacyWords() {
    const x = legacyWords;
    legacyWords = null;
    return x;
  }

  CTT.STORE = {
    load, save, defaults, merge, exportJson, download,
    wordsDefaults, mergeWords, loadWords, saveWords, wordsActive, setWordsActive, exportWords, takeLegacyWords,
  };
})();
