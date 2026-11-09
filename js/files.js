// Durable storage in a real folder (File System Access API, Chrome/Edge).
// You pick the trainer folder once; the page writes data/progress.json and
// data/report.md there. The folder handle is remembered in IndexedDB.
(function () {
  const CTT = (window.CTT = window.CTT || {});
  const supported = typeof window.showDirectoryPicker === 'function';
  let root = null;
  let dir = null;
  let queue = Promise.resolve();

  function idb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('ctt-files', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('h');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function idbGet(k) {
    const db = await idb();
    return new Promise((res, rej) => {
      const q = db.transaction('h').objectStore('h').get(k);
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
  }
  async function idbSet(k, v) {
    const db = await idb();
    return new Promise((res, rej) => {
      const tx = db.transaction('h', 'readwrite');
      tx.objectStore('h').put(v, k);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  // 'unsupported' | 'none' | 'prompt' | 'granted'
  async function restore() {
    if (!supported) return 'unsupported';
    try {
      root = await idbGet('root');
      if (!root) return 'none';
      const p = await root.queryPermission({ mode: 'readwrite' });
      if (p !== 'granted') return 'prompt';
      dir = await root.getDirectoryHandle('data', { create: true });
      return 'granted';
    } catch (e) {
      return 'none';
    }
  }

  // Must be called from a click.
  async function reconnect() {
    if (!root) return false;
    const p = await root.requestPermission({ mode: 'readwrite' });
    if (p !== 'granted') return false;
    dir = await root.getDirectoryHandle('data', { create: true });
    return true;
  }

  // Must be called from a click.
  async function choose() {
    root = await window.showDirectoryPicker({ id: 'ctt', mode: 'readwrite' });
    await idbSet('root', root);
    dir = await root.getDirectoryHandle('data', { create: true });
    return root.name;
  }

  async function readJson(name) {
    if (!dir) return null;
    try {
      const f = await (await dir.getFileHandle(name)).getFile();
      return JSON.parse(await f.text());
    } catch (e) {
      return null;
    }
  }

  // Writes are queued so two saves never overlap.
  function write(name, text) {
    if (!dir) return Promise.resolve(false);
    queue = queue.then(async () => {
      try {
        const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
        await w.write(text);
        await w.close();
        return true;
      } catch (e) {
        return false;
      }
    });
    return queue;
  }

  // ---- Auto-save mode: page served by server.py, which writes data/ itself ----
  let server = false;
  let serverQueue = Promise.resolve(true);

  // Returns { progress } when server.py is running, otherwise null.
  async function detectServer() {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return null;
    try {
      const r = await fetch('api/load', { cache: 'no-store' });
      if (!r.ok) return null;
      const j = await r.json();
      if (!j || !j.ok) return null;
      server = true;
      return j;
    } catch (e) {
      return null;
    }
  }

  function serverSave(progress, report) {
    serverQueue = serverQueue.then(async () => {
      try {
        const r = await fetch('api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ progress, report }),
        });
        return r.ok;
      } catch (e) {
        return false;
      }
    });
    return serverQueue;
  }

  CTT.FILES = {
    supported, restore, reconnect, choose, readJson, write, detectServer, serverSave,
    server: () => server,
    connected: () => !!dir,
    folder: () => (root ? root.name : null),
  };
})();
