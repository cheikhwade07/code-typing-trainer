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

  CTT.STORE = { load, save, defaults, merge, exportJson, download };
})();
