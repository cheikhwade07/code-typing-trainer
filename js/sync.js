// Sync progress across devices through a secret GitHub Gist.
// The token (gist scope only) is stored in this browser only, under its own
// key, so it is never part of Export or the progress data.
(function () {
  const CTT = (window.CTT = window.CTT || {});
  const API = 'https://api.github.com';
  const FILE = 'code-typing-trainer-progress.json';
  const REPORT = 'code-typing-trainer-report.md';
  const K_TOKEN = 'ctt.gist.token';
  const K_ID = 'ctt.gist.id';
  const K_LAST = 'ctt.gist.lastSync';

  const get = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* ignore */ } };

  let status = get(K_TOKEN) ? 'idle' : 'off'; // off | idle | syncing | ok | auth | error
  let listeners = [];
  function setStatus(s) {
    status = s;
    if (s === 'ok') set(K_LAST, String(Date.now()));
    listeners.forEach((f) => f(s));
  }

  async function gh(path, opts) {
    const token = get(K_TOKEN);
    const r = await fetch(API + path, {
      ...(opts || {}),
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + token,
        ...((opts && opts.body) ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    if (r.status === 401 || r.status === 403) {
      const e = new Error('auth');
      e.auth = true;
      throw e;
    }
    if (!r.ok) throw new Error('GitHub ' + r.status);
    return r.json();
  }

  async function fileContent(file) {
    if (!file) return null;
    if (!file.truncated) return file.content;
    const r = await fetch(file.raw_url);
    return r.ok ? r.text() : null;
  }

  // Find the trainer's gist, or create one. Returns the gist id.
  async function findOrCreate(progress, report) {
    for (let page = 1; page <= 5; page++) {
      const list = await gh('/gists?per_page=100&page=' + page);
      const hit = list.find((g) => g.files && g.files[FILE]);
      if (hit) return hit.id;
      if (list.length < 100) break;
    }
    const g = await gh('/gists', {
      method: 'POST',
      body: JSON.stringify({
        description: 'Code Typing Trainer progress (synced automatically)',
        public: false,
        files: { [FILE]: { content: JSON.stringify(progress) }, [REPORT]: { content: report || '# Report\n' } },
      }),
    });
    return g.id;
  }

  // Connect with a token. Returns { login, remote } where remote is the saved progress or null.
  async function connect(token, progress, report) {
    set(K_TOKEN, token.trim());
    setStatus('syncing');
    try {
      const user = await gh('/user');
      const id = await findOrCreate(progress, report);
      set(K_ID, id);
      const remote = await pull();
      setStatus('ok');
      return { login: user.login, remote };
    } catch (e) {
      set(K_TOKEN, null);
      set(K_ID, null);
      setStatus('off');
      throw e;
    }
  }

  function disconnect() {
    set(K_TOKEN, null);
    set(K_ID, null);
    set(K_LAST, null);
    setStatus('off');
  }

  // Remote progress object, or null.
  async function pull() {
    const id = get(K_ID);
    if (!get(K_TOKEN) || !id) return null;
    const g = await gh('/gists/' + id);
    const text = await fileContent(g.files && g.files[FILE]);
    if (!text) return null;
    try { return JSON.parse(text); } catch (e) { return null; }
  }

  // Pull on startup; marks status. Returns remote progress or null.
  async function startup() {
    if (!get(K_TOKEN) || !get(K_ID)) return null;
    setStatus('syncing');
    try {
      const remote = await pull();
      setStatus('ok');
      return remote;
    } catch (e) {
      setStatus(e.auth ? 'auth' : 'error');
      return null;
    }
  }

  // Debounced push: at most one upload every few seconds, always the latest state.
  let pending = null;
  let timer = null;
  let inflight = false;
  function push(progress, report, delay) {
    if (!get(K_TOKEN) || !get(K_ID)) return;
    pending = { progress, report };
    clearTimeout(timer);
    timer = setTimeout(flush, delay == null ? 4000 : delay);
  }
  async function flush() {
    if (!pending || inflight) return;
    const { progress, report } = pending;
    pending = null;
    inflight = true;
    setStatus('syncing');
    try {
      await gh('/gists/' + get(K_ID), {
        method: 'PATCH',
        body: JSON.stringify({ files: { [FILE]: { content: JSON.stringify(progress) }, [REPORT]: { content: report } } }),
      });
      setStatus('ok');
    } catch (e) {
      setStatus(e.auth ? 'auth' : 'error');
      if (!e.auth && !pending) pending = { progress, report }; // retry with the next lesson
    } finally {
      inflight = false;
      if (pending) timer = setTimeout(flush, 4000);
    }
  }

  // ---------- Words mode: its own file in the same gist ----------
  // Separate pull/push with its own status. A Words PATCH lists only the Words file,
  // and GitHub leaves files that are not listed untouched, so Words uploads can never
  // change the progress or report files. The main functions above are unchanged.
  const WFILE = 'code-typing-trainer-words.json';
  let wStatus = 'idle'; // idle | syncing | ok | auth | error
  const wListeners = [];
  function setWStatus(s) {
    wStatus = s;
    wListeners.forEach((f) => f(s));
  }

  // null (not connected) | { state: 'ok', data } | { state: 'missing' } | { state: 'bad' } | { state: 'unknown' }
  // Throws on network or auth errors, like pull().
  async function pullWords() {
    const id = get(K_ID);
    if (!get(K_TOKEN) || !id) return null;
    setWStatus('syncing');
    try {
      const g = await gh('/gists/' + id);
      const f = g.files && g.files[WFILE];
      if (!f) {
        setWStatus('ok');
        return { state: 'missing' };
      }
      const text = await fileContent(f);
      if (text == null) {
        setWStatus('error');
        return { state: 'unknown' }; // could not read it: never overwrite
      }
      let data = null;
      try { data = JSON.parse(text); } catch (e) { /* bad */ }
      setWStatus('ok');
      return data && typeof data === 'object' && !Array.isArray(data) && data.kind === 'ctt-words'
        ? { state: 'ok', data }
        : { state: 'bad' };
    } catch (e) {
      setWStatus(e.auth ? 'auth' : 'error');
      throw e;
    }
  }

  let wPending = null;
  let wTimer = null;
  let wInflight = false;
  let wGen = 0; // bumped by cancelWords: an upload already in flight is not retried
  function pushWords(words, delay) {
    if (!get(K_TOKEN) || !get(K_ID)) return;
    wPending = JSON.stringify(words); // snapshot now
    clearTimeout(wTimer);
    wTimer = setTimeout(flushWords, delay == null ? 4000 : delay);
  }
  function cancelWords() {
    wGen++;
    wPending = null;
    clearTimeout(wTimer);
  }
  async function flushWords() {
    if (!wPending || wInflight) return;
    if (!get(K_TOKEN) || !get(K_ID)) { wPending = null; return; }
    if (inflight || pending) { // main upload (in flight or queued) goes first
      clearTimeout(wTimer);
      wTimer = setTimeout(flushWords, 1000);
      return;
    }
    const content = wPending;
    const gen = wGen;
    wPending = null;
    wInflight = true;
    setWStatus('syncing');
    try {
      await gh('/gists/' + get(K_ID), {
        method: 'PATCH',
        body: JSON.stringify({ files: { [WFILE]: { content } } }),
      });
      setWStatus('ok');
    } catch (e) {
      setWStatus(e.auth ? 'auth' : 'error');
      // retry later, like main, unless a newer copy was adopted meanwhile
      if (!e.auth && !wPending && gen === wGen) wPending = content;
    } finally {
      wInflight = false;
      if (wPending) {
        clearTimeout(wTimer);
        wTimer = setTimeout(flushWords, 4000);
      }
    }
  }

  CTT.SYNC = {
    pullWords, pushWords, flushWords, cancelWords,
    wordsStatus: () => wStatus,
    onWordsStatus: (f) => wListeners.push(f),
    WORDS_FILE: WFILE,
    connect, disconnect, startup, push, flush,
    enabled: () => !!(get(K_TOKEN) && get(K_ID)),
    status: () => status,
    lastSync: () => Number(get(K_LAST) || 0),
    gistId: () => get(K_ID),
    onStatus: (f) => listeners.push(f),
    TOKEN_URL: 'https://github.com/settings/tokens/new?scopes=gist&description=Code%20Typing%20Trainer%20sync',
  };
})();
