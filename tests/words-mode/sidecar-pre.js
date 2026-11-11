// Loaded before the app scripts in scratch copies of index.html only (never in the repo page).
// Routes every GitHub API call to the local mock, records requests, captures clipboard,
// downloads, confirms and toasts, and applies per-test config from sessionStorage 't.cfg'.
(function () {
  const cfg = JSON.parse(sessionStorage.getItem('t.cfg') || '{}');
  const real = {
    now: Date.now.bind(Date), fetch: window.fetch.bind(window), random: Math.random,
    perf: performance.now.bind(performance),
  };
  const TP = (window.TP = {
    cfg, real, clock: cfg.freeze || null, reqs: [], srv: [], offline: false, stub: null,
    MOCK: cfg.mock || 'http://127.0.0.1:8898', confirms: [], confirmAnswers: cfg.confirmAnswers || [],
    clip: [], downloads: [], errors: [], toasts: [], blob: null,
  });
  Date.now = () => (TP.clock == null ? real.now() : TP.clock);

  window.fetch = (u, o) => {
    const s = String(u);
    const gh = s.startsWith('https://api.github.com') || (s.startsWith(TP.MOCK) && !s.includes('/__'));
    if (!gh && /^https?:\/\//.test(s) && !s.startsWith(location.origin) && !s.startsWith(TP.MOCK)) {
      return Promise.reject(new TypeError('blocked external ' + s)); // never leave localhost
    }
    if (gh) {
      const st = new Error().stack || '';
      const tag = /pullWords|flushWords|wordsAfterConnect|pullWordsGist/.test(st) ? 'words' : 'main';
      const rec = { tag, method: (o && o.method) || 'GET', url: s.replace('https://api.github.com', '').replace(TP.MOCK, ''), body: o && o.body, t: real.now() };
      TP.reqs.push(rec);
      if (TP.offline) { rec.failed = true; return Promise.reject(new TypeError('Failed to fetch')); }
      const opts = Object.assign({}, o || {});
      return real.fetch(s.replace('https://api.github.com', TP.MOCK), opts).then((r) => { rec.status = r.status; return r; });
    }
    if (s.includes('api/save') || s.includes('api/load')) {
      const rec = { url: s, method: (o && o.method) || 'GET', body: o && o.body };
      TP.srv.push(rec);
      if (TP.stub) { const r = TP.stub(s, o); if (r) return Promise.resolve(r); }
      return real.fetch(u, o).then((r) => { rec.status = r.status; return r; });
    }
    return real.fetch(u, o);
  };

  window.confirm = (m) => { TP.confirms.push(m); return TP.confirmAnswers.length ? TP.confirmAnswers.shift() : true; };
  try { navigator.clipboard.writeText = (s) => { TP.clip.push(s); return Promise.resolve(); }; } catch (e) { /* none */ }
  const cu = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (b) => { TP.blob = b; return cu(b); };
  HTMLAnchorElement.prototype.click = function () {
    const n = this.download, b = TP.blob, rec = { name: n, text: null };
    TP.downloads.push(rec);
    if (b && b.text) b.text().then((t) => { rec.text = t; });
  };
  window.addEventListener('error', (e) => TP.errors.push('error: ' + e.message));
  window.addEventListener('unhandledrejection', (e) => TP.errors.push('rejection: ' + String(e.reason && (e.reason.stack || e.reason))));
  const ce = console.error.bind(console);
  console.error = (...a) => { TP.errors.push('console: ' + a.map(String).join(' ')); ce(...a); };

  // Optional hooks that must exist before the app loads.
  if (cfg.noLS) {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('localStorage disabled'); } });
  }
  if (cfg.quotaWords) {
    const si = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (this === window.localStorage && String(k).startsWith('ctt.words')) throw new DOMException('quota', 'QuotaExceededError');
      return si.call(this, k, v);
    };
  }
  if (cfg.visible) Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
  if (cfg.folder) {
    // Folder mode stub: FILES.connected/server/restore/readJson/write replaced as soon as files.js defines FILES.
    const C = (window.CTT = window.CTT || {});
    let F = null;
    TP.fwrites = [];
    TP.folderFiles = cfg.folderFiles || {};
    Object.defineProperty(C, 'FILES', {
      configurable: true, enumerable: true,
      get() { return F; },
      set(v) {
        F = v;
        F.connected = () => true;
        F.server = () => false;
        F.detectServer = async () => null;
        F.restore = async () => 'granted';
        F.folder = () => 'tmp';
        F.readJson = async (name) => (name in TP.folderFiles ? JSON.parse(TP.folderFiles[name]) : null);
        F.write = (name, text) => { TP.fwrites.push([name, text]); return Promise.resolve(true); };
      },
    });
  }
  // Toast log
  document.addEventListener('DOMContentLoaded', () => {
    const t = document.getElementById('toast');
    if (!t) return;
    // Synchronous capture: every assignment to the toast text is recorded.
    const d = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
    Object.defineProperty(t, 'textContent', {
      configurable: true,
      get() { return d.get.call(this); },
      set(v) { if (v) TP.toasts.push(String(v)); d.set.call(this, v); },
    });
  });
})();
