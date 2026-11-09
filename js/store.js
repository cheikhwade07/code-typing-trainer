// localStorage persistence with safe fallbacks, plus JSON export/import.
(function () {
  const CTT = (window.CTT = window.CTT || {});
  const KEY = 'ctt.v1';

  function defaults() {
    return {
      v: 1,
      settings: {
        targetWpm: 30,
        lessonLen: 70,
        stopOnError: true,
        sound: true,
        volume: 0.6,
        showKeymap: true,
        highlightNext: true,
        fingerColors: false,
      },
      mode: 'adaptive',
      unlocked: 6,
      keys: {},
      lessons: [],
      mycode: { text: '', pos: 0 },
    };
  }

  function merge(raw) {
    const d = defaults();
    if (!raw || typeof raw !== 'object') return d;
    return {
      ...d,
      ...raw,
      settings: { ...d.settings, ...(raw.settings || {}) },
      mycode: { ...d.mycode, ...(raw.mycode || {}) },
      keys: raw.keys || {},
      lessons: Array.isArray(raw.lessons) ? raw.lessons : [],
    };
  }

  function load() {
    try {
      return merge(JSON.parse(localStorage.getItem(KEY)));
    } catch (e) {
      return defaults();
    }
  }

  function save(state) {
    if (state.lessons.length > 1000) state.lessons.splice(0, state.lessons.length - 1000);
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      /* storage unavailable: progress lives in memory for this tab */
    }
  }

  function exportJson(state) {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'code-typing-trainer-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  CTT.STORE = { load, save, defaults, merge, exportJson };
})();
