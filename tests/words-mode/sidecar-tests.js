// Test definitions for sidecar-testplan.md. Loaded after sidecar-harness.js.
// Each test is a list of steps; a step returns T.RELOAD(cfg), T.result(pass, evidence) or nothing.
(function () {
  const { T0, DAY, WFILE, MFILE, RFILE, wait } = T;
  const TP = T.TP;
  const C = window.CTT;
  const R = T.TESTS;
  const ok = T.result;
  const SYNC = () => C.SYNC;

  // ---------- shared setups ----------
  // Gist with main (= local main) + report (+ Words file); local sidecar; reload frozen at T0.
  function wsSetup(localW, remoteW, cfg, mainOverride) {
    return async (ctx) => {
      const mainStr = JSON.stringify(mainOverride || T.fsyn());
      const files = { main: mainStr, report: '# r\n' };
      if (remoteW !== undefined) files.words = typeof remoteW === 'string' ? remoteW : JSON.stringify(remoteW);
      const id = await T.mkGist(files);
      localStorage.setItem('ctt.v1', mainStr);
      if (localW) localStorage.setItem('ctt.words.v1', typeof localW === 'string' ? localW : JSON.stringify(localW));
      T.useGist(id);
      Object.assign(ctx, { id, v1: mainStr, remote: files.words, mainStr });
      return T.RELOAD(Object.assign({ freeze: T0 }, cfg || {}));
    };
  }
  async function wordsLesson(o) {
    if (T.onMode() !== 'words') { T.mode('words'); await wait(20); }
    return T.typeLesson(o || {});
  }
  async function symLesson(m, o) {
    if (T.onMode() !== (m || 'adaptive')) { T.mode(m || 'adaptive'); await wait(20); }
    return T.typeLesson(o || {});
  }
  // Words-only buttons: the tabbed dialog has its own; HEAD (777f92f) used the shared ones in Words mode.
  const wBtn = (id) => document.getElementById(id + 'Words') || document.getElementById(id);
  const PREFS0 = { caps: 0, nums: false, punct: false };
  const remoteWords = async (ctx) => { const g = await T.gist(ctx.id); return g.files[WFILE]; };
  const wordsRes = (W) => !!W && W.kind === 'ctt-words' && Number.isInteger(W.unlocked) && W.unlocked >= 10 && W.unlocked <= 26 &&
    W.prefs.targetWpm >= 10 && W.prefs.targetWpm <= 150 && W.prefs.lessonLen >= 30 && W.prefs.lessonLen <= 200;

  // ---------- MI: main byte identity script (runs on HEAD and new) ----------
  T.SCRIPT_MAIN = async function (o) {
    const out = { variant: o.variant, build: T.build };
    T.freeze(T0);
    await T.load(T.fsyn());
    if (o.gist) { await T.connect(); await wait(50); await SYNC().flush(); }
    const modes = ['adaptive', 'adaptive', 'lines', 'adaptive', 'mycode', 'adaptive', 'adaptive', 'lines'];
    for (let i = 1; i <= 8; i++) {
      if ((o.variant === 'B' || o.variant === 'C') && i === 4) {
        T.freeze(T0 + 3 * 60000 + 1);
        T.mode('words'); await wait(20);
        const snap = { v1: T.raw('ctt.v1'), prev: T.raw('ctt.v1.prev'), nreq: TP.reqs.length, nsrv: TP.srv.length, nfw: (TP.fwrites || []).length };
        if (o.variant === 'C') {
          // C = B with all three Words extras turned on in the Words tab (tabbed builds only).
          await T.openSettings();
          const $ = (id) => document.getElementById(id);
          $('sWordsCaps').value = '2'; $('sWordsCaps').dispatchEvent(new Event('change'));
          $('sWordsNums').checked = true; $('sWordsNums').dispatchEvent(new Event('change'));
          $('sWordsPunct').checked = true; $('sWordsPunct').dispatchEvent(new Event('change'));
          await T.closeSettings();
          out.extrasPrefs = T.sw().prefs;
          out.extrasTexts = [];
        }
        for (let k = 0; k < 3; k++) {
          T.seedRandom(300 + k); T.esc();
          if (out.extrasTexts) out.extrasTexts.push(T.text());
          T.typeLesson({ errAt: T.err9 });
          T.tick(30000);
          if (o.gist) await SYNC().flushWords();
          await wait(30);
        }
        await wait(300);
        const during = TP.reqs.slice(snap.nreq);
        out.mi10 = {
          v1Same: T.raw('ctt.v1') === snap.v1, prevSame: T.raw('ctt.v1.prev') === snap.prev,
          mainReqsDuring: during.filter((r) => r.tag === 'main').length,
          srvDuring: TP.srv.slice(snap.nsrv).map((r) => r.body ? Object.keys(JSON.parse(r.body)) : r.url),
          fwDuring: (TP.fwrites || []).slice(snap.nfw).map((x) => x[0]),
          wordsLessons: (T.sw() || {}).lessons ? T.sw().lessons.length : null,
        };
      }
      T.freeze(T0 + i * 60000);
      T.seedRandom(100 + i);
      T.mode(modes[i - 1]); await wait(20);
      T.seedRandom(200 + i);
      T.esc();
      T.typeLesson({ errAt: T.err9 });
      if (o.gist) await SYNC().flush();
      await wait(60);
    }
    out.domAfter3 = T.dom();
    T.freeze(T0 + 9 * 60000);
    document.getElementById('statsBtn').click(); await wait(50);
    out.statsDom = T.statsDom();
    document.getElementById('copyReport').click(); await wait(50);
    document.getElementById('downloadReport').click(); await wait(50);
    document.getElementById('statsBtn').click(); await wait(30);
    await T.openSettings();
    document.getElementById('sExport').click(); await wait(50);
    await T.closeSettings();
    if (o.gist) { await wait(30); await SYNC().flush(); }
    await wait(1500); // server queue / blob text
    out.v1 = T.raw('ctt.v1');
    out.prev = T.raw('ctt.v1.prev');
    out.mainReqs = TP.reqs.filter((r) => r.tag === 'main').map((r) => ({ method: r.method, url: r.url, body: r.body || null }));
    out.wordsReqs = TP.reqs.filter((r) => r.tag === 'words').map((r) => ({ method: r.method, url: r.url, body: r.body || null }));
    out.srv = TP.srv.filter((r) => r.method === 'POST').map((r) => r.body);
    out.fwrites = TP.fwrites || null;
    out.mock = o.gist ? await T.gist() : null;
    out.downloads = TP.downloads;
    out.clip = TP.clip;
    out.sw = T.raw('ctt.words.v1');
    out.errors = TP.errors.slice();
    T.thaw();
    return out;
  };
  for (const [id, variant, gist] of [['MI-run-A', 'A', true], ['MI-run-B', 'B', true], ['MI-run-C', 'C', true], ['MI-srv-A', 'A', false], ['MI-srv-B', 'B', false], ['MI-srv-C', 'C', false]]) {
    R[id] = [async (ctx) => {
      const out = await T.SCRIPT_MAIN({ variant, gist });
      await T.save('mi-' + id + '-' + out.build + '-' + location.port + '.json', out);
      ctx.allowErr = '.';
      return ok(true, 'artifact saved');
    }];
  }
  R['MI-folder-A'] = [async () => T.RELOAD({ folder: true }), async (ctx) => {
    const out = await T.SCRIPT_MAIN({ variant: 'A', gist: false });
    await T.save('mi-folder-A-' + out.build + '.json', out); ctx.allowErr = '.'; return ok(true, 'saved');
  }];
  for (const v of ['B', 'C']) {
    R['MI-folder-' + v] = [async () => T.RELOAD({ folder: true }), async (ctx) => {
      const out = await T.SCRIPT_MAIN({ variant: v, gist: false });
      await T.save('mi-folder-' + v + '-' + out.build + '.json', out); ctx.allowErr = '.'; return ok(true, 'saved');
    }];
  }

  // ---------- WS ----------
  const F12 = () => T.FW(12, T0, { savedAt: T0 });
  const F10old = () => T.FW(10, T0, { savedAt: T0 - 3600000 });
  R['WS-1'] = [wsSetup(F12(), F10old()), async (ctx) => {
    await wait(800);
    const p = T.wordsPatches();
    const rem = await remoteWords(ctx);
    return ok(p.length === 1 && rem === T.raw('ctt.words.v1') && T.raw('ctt.v1') === ctx.v1, { patches: p.length, remoteEqLocal: rem === T.raw('ctt.words.v1'), v1Same: T.raw('ctt.v1') === ctx.v1 });
  }];
  R['WS-2'] = [wsSetup(F10old(), T.FW(14, T0, { savedAt: T0 })), async (ctx) => {
    await wait(800);
    const remote = JSON.parse(ctx.remote);
    T.mode('words'); await wait(30);
    const exp = C.STORE.mergeWords(JSON.parse(ctx.remote));
    const r = { patches: T.wordsPatches().length, eq: T.eq(T.sw(), exp), savedAt: T.sw().savedAt === remote.savedAt, toast: T.toastHas(/Loaded synced Words progress/), strip: T.strip().open.length };
    return ok(r.patches === 0 && r.eq && r.savedAt && r.toast && r.strip === 14, r);
  }];
  R['WS-3'] = [wsSetup(F12(), undefined), async (ctx) => {
    await wait(800);
    const g = await T.gist(ctx.id);
    const r = { files: Object.keys(g.files).length, mainSame: g.files[MFILE] === ctx.mainStr, report: g.files[RFILE] === '# r\n', wordsEq: g.files[WFILE] === T.raw('ctt.words.v1') };
    return ok(r.files === 3 && r.mainSame && r.report && r.wordsEq, r);
  }];
  R['WS-3b'] = [wsSetup(null, undefined), async () => {
    await wait(6000);
    return ok(T.wordsPatches().length === 0, { patches: T.wordsPatches().length, wreqs: T.wreqs().map((x) => x.method) });
  }];
  for (const [i, bad] of [['1', '{not json'], ['2', '[]'], ['3', '{"kind":"other"}']]) {
    R['WS-4.' + i] = [wsSetup(F12(), bad), async (ctx) => {
      await wait(800);
      const rem = await remoteWords(ctx);
      return ok(rem === T.raw('ctt.words.v1'), { remoteEqLocal: rem === T.raw('ctt.words.v1'), patches: T.wordsPatches().length });
    }];
  }
  R['WS-4b'] = [wsSetup(null, '{not json'), async (ctx) => {
    await wait(1500);
    const rem = await remoteWords(ctx);
    return ok(rem === '{not json' && T.wordsPatches().length === 0, { remote: rem, patches: T.wordsPatches().length });
  }];
  R['WS-4c'] = [async (ctx) => { await T.ctl({ truncate: [WFILE], raw_fail: true }); return wsSetup(F12(), F10old())(ctx); }, async (ctx) => {
    await wait(1500);
    const rem = await remoteWords(ctx);
    const r = { remoteSame: rem === ctx.remote, localSame: T.eq(T.sw(), F12()), patches: T.wordsPatches().length, wstatus: SYNC().wordsStatus() };
    return ok(r.remoteSame && r.localSame && r.patches === 0, r);
  }];
  R['WS-4c'][0].noReset = true;
  R['WS-5'] = [wsSetup(F10old(), T.FW(12, T0, { savedAt: T0, v: 99, future: { x: 1 } })), async (ctx) => {
    await wait(800);
    const adopted = T.sw().v === 99 && T.eq(T.sw().future, { x: 1 });
    T.freeze(T0 + 60000);
    await wordsLesson();
    await SYNC().flushWords(); await wait(400);
    const rem = JSON.parse(await remoteWords(ctx));
    const r = { adopted, remoteV: rem.v, remoteFuture: rem.future, lessons: rem.lessons.length };
    return ok(adopted && rem.v === 99 && T.eq(rem.future, { x: 1 }) && rem.lessons.length === 13, r);
  }];
  R['WS-6'] = [wsSetup(null, undefined), async () => {
    await wait(1500);
    const w = T.wreqs();
    return ok(w.length === 1 && w[0].method === 'GET' && T.raw('ctt.words.v1') === null, { wreqs: w.map((x) => x.method + ' ' + x.url), sidecar: T.raw('ctt.words.v1') });
  }];
  R['WS-7'] = [wsSetup(F12(), F12()), async (ctx) => {
    await wait(800);
    await T.ctl({ auth: true });
    const before = SYNC().status();
    const n0 = T.wordsPatches().length;
    T.freeze(T0 + 60000);
    await wordsLesson();
    await wait(10000);
    await T.openSettings();
    const info = document.getElementById('wordsSyncInfo').textContent;
    await T.closeSettings();
    const r = { patches: T.wordsPatches().length - n0, wstatus: SYNC().wordsStatus(), statusBefore: before, statusAfter: SYNC().status(), info, v1Same: T.raw('ctt.v1') === ctx.v1, toast: T.toastHas(/Words sync: GitHub refused/) };
    return ok(r.patches === 1 && r.wstatus === 'auth' && r.statusAfter === before && !!info && r.v1Same, r);
  }];
  R['WS-8'] = [wsSetup(F12(), F12()), async (ctx) => {
    await wait(800);
    const seen = [];
    SYNC().onWordsStatus((s) => seen.push(s));
    TP.offline = true;
    T.freeze(T0 + 60000);
    await wordsLesson();
    const snap = T.raw('ctt.words.v1');
    await wait(9000);
    TP.offline = false;
    await wait(5000);
    const failed = TP.reqs.filter((x) => x.failed && x.tag === 'words').length;
    const rem = await remoteWords(ctx);
    const r = { seen, failed, remoteEqSnap: rem === snap, final: SYNC().wordsStatus() };
    return ok(seen.includes('error') && r.final === 'ok' && failed >= 2 && r.remoteEqSnap && seen.indexOf('error') < seen.lastIndexOf('ok'), r);
  }];
  R['WS-9'] = [wsSetup(F12(), F12()), async (ctx) => {
    await wait(800);
    await T.ctl({ delay_ms: { PATCH: 1500 } });
    T.freeze(T0 + 60000);
    await symLesson('adaptive');
    T.mode('words'); await wait(20);
    T.freeze(T0 + 61000);
    await wordsLesson();
    const pm = SYNC().flush();
    SYNC().flushWords();
    await pm;
    await wait(5000);
    const log = await T.mlog();
    const mp = log.filter((x) => x.method === 'PATCH' && x.body.includes(MFILE));
    const wp = log.filter((x) => x.method === 'PATCH' && x.body.includes(WFILE));
    const g = await T.gist(ctx.id);
    const r = { mainPatches: mp.map((x) => [x.t_start, x.t_end, x.status]), wordsPatches: wp.map((x) => [x.t_start, x.t_end, x.status]), mainLatest: g.files[MFILE] === T.raw('ctt.v1'), wordsLatest: g.files[WFILE] === T.raw('ctt.words.v1') };
    const order = mp.length && wp.length && wp[wp.length - 1].t_start >= mp[mp.length - 1].t_end;
    return ok(order && r.mainLatest && r.wordsLatest, r);
  }];
  R['WS-10'] = [wsSetup(F12(), F12()), async (ctx) => {
    await wait(800);
    await T.ctl({ delay_ms: { PATCH: 1500 }, conflict_overlap: true });
    T.freeze(T0 + 60000);
    await wordsLesson();
    SYNC().flushWords();
    await wait(100);
    T.freeze(T0 + 61000);
    await symLesson('adaptive');
    SYNC().flush();
    await wait(10000);
    const log = await T.mlog();
    const g = await T.gist(ctx.id);
    const mp = log.filter((x) => x.method === 'PATCH' && x.body.includes(MFILE)).map((x) => x.status);
    const r = { mainPatchStatuses: mp, mainLatest: g.files[MFILE] === T.raw('ctt.v1'), wordsLatest: g.files[WFILE] === T.raw('ctt.words.v1'), status: SYNC().status() };
    return ok(mp[0] === 409 && mp[mp.length - 1] === 200 && r.mainLatest && r.wordsLatest && r.status === 'ok', r);
  }];
  R['WS-11'] = [wsSetup(F12(), F12()), async (ctx) => {
    await wait(800);
    T.freeze(T0 + 60000);
    await wordsLesson();
    const f20 = T.FW(20, T0, { savedAt: T0 + 70000 });
    await T.ctl({ setfile: { id: ctx.id, name: WFILE, content: JSON.stringify(f20) } });
    const n0 = T.wordsPatches().length;
    document.getElementById('sSyncNow').click();
    await wait(6500);
    const rem = await remoteWords(ctx);
    const r = { adopted: T.sw().unlocked === 20 && T.sw().savedAt === T0 + 70000, patchesAfter: T.wordsPatches().length - n0, remoteStill20: JSON.parse(rem).unlocked === 20 };
    return ok(r.adopted && r.patchesAfter === 0 && r.remoteStill20, r);
  }];
  R['WS-12'] = [wsSetup(F12(), F12(), { visible: true }), async () => {
    await wait(800);
    const w0 = T.wreqs('GET').length, m0 = T.mreqs('GET').length;
    T.freeze(T0 + 31000);
    document.dispatchEvent(new Event('visibilitychange'));
    await wait(300);
    T.freeze(T0 + 41000);
    document.dispatchEvent(new Event('visibilitychange'));
    await wait(500);
    const r = { wordsGets: T.wreqs('GET').length - w0, mainGets: T.mreqs('GET').length - m0 };
    return ok(r.wordsGets === 1 && r.mainGets === 1, r);
  }];
  R['WS-13'] = [wsSetup(F12(), F12()), async () => {
    await wait(800);
    T.freeze(T0 + 60000);
    await wordsLesson();
    const n0 = T.wordsPatches().length;
    document.getElementById('sDisconnect').click();
    await wait(6000);
    return ok(T.wordsPatches().length === n0, { patchesAfter: T.wordsPatches().length - n0 });
  }];
  function big(savedAt, n) {
    const W = T.FW(n || 26, T0, { savedAt });
    for (const ch of Object.keys(W.keys)) W.keys[ch].hist = T.hist(150, 0.95, T0, 15);
    W.lessons = Array.from({ length: 1000 }, (_, i) => ({ ts: T0 - (1000 - i) * 600000, mode: 'words', wpm: 40, acc: 0.95, chars: 70, errors: 3, sameHand: 0, shifted: 0, dur: 60000 }));
    return W;
  }
  R['WS-14a'] = [async (ctx) => { await T.ctl({ truncate: [WFILE] }); return wsSetup(big(T0, 26), big(T0 - 3600000, 20))(ctx); }, async (ctx) => {
    await wait(1500);
    const rem = await remoteWords(ctx);
    const raws = TP.reqs.filter((x) => x.url.includes('/raw/')).length;
    return ok(rem === T.raw('ctt.words.v1') && T.wordsPatches().length === 1 && raws >= 1, { remoteEqLocal: rem === T.raw('ctt.words.v1'), patches: T.wordsPatches().length, rawFetches: raws, size: rem.length });
  }];
  R['WS-14b'] = [async (ctx) => { await T.ctl({ truncate: [WFILE] }); return wsSetup(big(T0 - 3600000, 20), big(T0, 26))(ctx); }, async (ctx) => {
    await wait(1500);
    const raws = TP.reqs.filter((x) => x.url.includes('/raw/')).length;
    const r = { unlocked: T.sw().unlocked, savedAt: T.sw().savedAt === T0, patches: T.wordsPatches().length, rawFetches: raws };
    return ok(r.unlocked === 26 && r.savedAt && r.patches === 0 && raws >= 1, r);
  }];

  // ---------- WC ----------
  R['WC-1'] = [async () => { localStorage.setItem('ctt.words.v1', JSON.stringify(F12())); return T.RELOAD({ freeze: T0 }); }, async () => {
    const pre = T.raw('ctt.words.v1');
    await T.connect();
    await wait(800);
    const post = TP.reqs.find((x) => x.method === 'POST');
    const pb = JSON.parse(post.body);
    const s = await T.gist();
    const g = Object.values(s.gists)[0];
    const r = {
      postFiles: Object.keys(pb.files), postMainIsDefaults: T.eq(JSON.parse(pb.files[MFILE].content), C.STORE.defaults()),
      mockFiles: Object.keys(g.files), wordsEq: g.files[WFILE] === T.raw('ctt.words.v1'), sidecarSame: pre === T.raw('ctt.words.v1'),
      wordsPatches: T.wordsPatches().length, confirms: TP.confirms.length,
    };
    return ok(T.eq(r.postFiles, [MFILE, RFILE]) && r.postMainIsDefaults && r.mockFiles.length === 3 && r.wordsEq && r.wordsPatches === 1 && r.confirms === 0, r);
  }];
  R['WC-2'] = [async (ctx) => {
    ctx.syn = T.fsyn();
    await T.mkGist({ main: JSON.stringify(ctx.syn), report: '# r\n' });
    localStorage.setItem('ctt.words.v1', JSON.stringify(F12()));
    return T.RELOAD({ freeze: T0 });
  }, async (ctx) => {
    const pre = T.raw('ctt.words.v1');
    await T.connect(); await wait(800);
    const g = Object.values((await T.gist()).gists)[0];
    const st = T.st();
    const r = { mainLessons: st.lessons.length, mainUnlocked: st.unlocked, sidecarSame: T.raw('ctt.words.v1') === pre, mockWords: g.files[WFILE] === pre, confirms: TP.confirms.length };
    return ok(r.mainLessons === 20 && r.mainUnlocked === 14 && r.sidecarSame && r.mockWords && r.confirms === 0, r);
  }];
  function wcRemote(remoteW, localW, answers, mainLocal, mainRemote) {
    return [async (ctx) => {
      await T.mkGist({ main: JSON.stringify(mainRemote || T.fsyn()), report: '# r\n', words: JSON.stringify(remoteW) });
      if (localW) localStorage.setItem('ctt.words.v1', JSON.stringify(localW));
      if (mainLocal) localStorage.setItem('ctt.v1', JSON.stringify(mainLocal));
      return T.RELOAD({ freeze: T0, confirmAnswers: answers || [] });
    }, async (ctx) => {
      await T.connect(); await wait(800);
      ctx.g = Object.values((await T.gist()).gists)[0];
    }];
  }
  R['WC-3'] = wcRemote(T.FW(14, T0, { savedAt: T0 - 7 }), null).concat([async (ctx) => {
    const exp = C.STORE.mergeWords(JSON.parse(ctx.g.files[WFILE]));
    const r = { eq: T.eq(T.sw(), exp), savedAt: T.sw().savedAt, mainLessons: T.st().lessons.length, confirms: TP.confirms.length };
    return ok(r.eq && r.savedAt === T0 - 7 && r.mainLessons === 20 && r.confirms === 0, r);
  }]);
  R['WC-4'] = wcRemote(T.FW(14, T0, { savedAt: T0 }), F10old()).concat([async () => {
    const r = { unlocked: T.sw().unlocked, confirms: TP.confirms.length };
    return ok(r.unlocked === 14 && r.confirms === 0, r);
  }]);
  R['WC-5t'] = wcRemote(F10old(), T.FW(14, T0, { savedAt: T0 }), [true], T.fsyn()).concat([async (ctx) => {
    const r = { confirms: TP.confirms, unlocked: T.sw().unlocked, mockWordsEqLocal: ctx.g.files[WFILE] === T.raw('ctt.words.v1') };
    return ok(TP.confirms.length === 1 && /^Words mode:/.test(TP.confirms[0]) && r.unlocked === 14 && r.mockWordsEqLocal, r);
  }]);
  R['WC-5f'] = wcRemote(F10old(), T.FW(14, T0, { savedAt: T0 }), [false], T.fsyn()).concat([async (ctx) => {
    const r = { confirms: TP.confirms, unlocked: T.sw().unlocked, mockUnlocked: JSON.parse(ctx.g.files[WFILE]).unlocked, savedAt: T.sw().savedAt };
    return ok(TP.confirms.length === 1 && /^Words mode:/.test(TP.confirms[0]) && r.unlocked === 10 && r.mockUnlocked === 10, r);
  }]);
  // WC-6: main 20 lessons newer locally, remote main older with 18 lessons; same for Words.
  const mainRemote18 = () => { const s = T.fsyn(); s.lessons = s.lessons.slice(0, 18); s.savedAt = T0 - 3600000; return s; };
  for (const [a, b] of [[true, true], [true, false], [false, true], [false, false]]) {
    const id = 'WC-6-' + (a ? 'T' : 'F') + (b ? 'T' : 'F');
    const answers = T.isNew ? [a, b] : [a];
    R[id] = wcRemote(F10old(), T.FW(14, T0, { savedAt: T0 }), answers, T.fsyn(), mainRemote18()).concat([async (ctx) => {
      const r = { confirms: TP.confirms.map((x) => x.slice(0, 20)), mainLessons: T.st().lessons.length, unlocked: T.sw() && T.sw().unlocked };
      await T.save('wc6-' + id + '-' + T.build + '.json', { v1: T.raw('ctt.v1'), r });
      if (!T.isNew) return ok(true, r);
      const pass = TP.confirms.length === 2 && !/^Words/.test(TP.confirms[0]) && /^Words mode:/.test(TP.confirms[1]) &&
        r.mainLessons === (a ? 20 : 18) && r.unlocked === (b ? 14 : 10);
      return ok(pass, r);
    }]);
  }
  R['WC-7'] = [async () => { await T.ctl({ auth: true }); localStorage.setItem('ctt.words.v1', JSON.stringify(F12())); return T.RELOAD({ freeze: T0 }); }, async () => {
    await T.connect(); await wait(500);
    const r = { token: T.raw('ctt.gist.token'), wreqs: T.wreqs().length, toast: T.toastHas(/GitHub refused that token/) };
    return ok(r.token === null && r.wreqs === 0 && r.toast, r);
  }];
  R['WC-7'][0].noReset = false;
  R['WC-8'] = wcRemote('{bad', F12()).concat([async (ctx) => {
    const r = { mockEqLocal: ctx.g.files[WFILE] === T.raw('ctt.words.v1'), confirms: TP.confirms.length };
    return ok(r.mockEqLocal && r.confirms === 0, r);
  }]);
  // wcRemote stringifies; '{bad' must stay raw
  R['WC-8'][0] = async () => {
    await T.ctl({ set: { [MFILE]: JSON.stringify(T.fsyn()), [RFILE]: '# r\n', [WFILE]: '{bad' } });
    localStorage.setItem('ctt.words.v1', JSON.stringify(F12()));
    return T.RELOAD({ freeze: T0 });
  };

  // ---------- XV ----------
  R['XV-4'] = [async (ctx) => {
    const id = await T.mkGist({ main: JSON.stringify(T.fsyn()), report: '# r\n', words: JSON.stringify(F12()) });
    localStorage.setItem('ctt.v1', JSON.stringify(T.fsyn()));
    T.useGist(id); ctx.id = id; ctx.w = JSON.stringify(F12());
    return T.RELOAD({ freeze: T0 });
  }, async (ctx) => {
    await wait(500);
    for (let i = 0; i < 3; i++) { T.freeze(T0 + (i + 1) * 60000); await symLesson('adaptive'); await SYNC().flush(); }
    await wait(300);
    const log = await T.mlog();
    const keys = log.filter((x) => x.method === 'PATCH').map((x) => Object.keys(JSON.parse(x.body).files));
    const g = await T.gist(ctx.id);
    const r = { patchFiles: keys, wordsSame: g.files[WFILE] === ctx.w, files: Object.keys(g.files) };
    return ok(keys.length >= 3 && keys.every((k) => T.eq(k, [MFILE, RFILE])) && r.wordsSame, r);
  }];
  R['XV-5'] = [async (ctx) => {
    const out = await window.XV();
    await T.save('xv5-' + T.build + '.json', out);
    ctx.allowErr = '.';
    return ok(true, out.errors);
  }];
  R['XV-6a'] = [async () => { localStorage.setItem('ctt.v1', JSON.stringify(T.FLEGACY())); return T.RELOAD({ freeze: T0 }); }, async () => {
    T.freeze(T0 + 60000);
    await symLesson('lines');
    await T.save('xv6-v1.json', T.raw('ctt.v1'));
    return ok(true, 'saved');
  }];

  // ---------- LS ----------
  const LS1 = ['not json', '{"a":', 'null', '[]', '42', '{"lessons":"x"}', '{"keys":{"e":5}}', '{"unlocked":99}', '{"focusRun":{"ch":"("}}',
    '{"prefs":{"targetWpm":"fast","lessonLen":-5}}', '{"lessons":[{"ts":"x"}]}', 'BIG'];
  LS1.forEach((v, i) => {
    R['LS-1.' + (i + 1)] = [async (ctx) => {
      const val = v === 'BIG' ? 'x'.repeat(4 * 1024 * 1024) : v;
      localStorage.setItem('ctt.v1', JSON.stringify(T.fsyn()));
      try { localStorage.setItem('ctt.words.v1', val); ctx.stored = true; } catch (e) { ctx.stored = 'quota: ' + e.name; }
      ctx.v1 = T.raw('ctt.v1');
      return T.RELOAD({ freeze: T0 });
    }, async (ctx) => {
      const afterLoad = T.raw('ctt.v1') === ctx.v1;
      const unread = T.raw('ctt.words.v1.unreadable');
      T.freeze(T0 + 60000);
      await wordsLesson();
      const W = T.sw();
      const parseable = (() => { try { JSON.parse(v === 'BIG' ? 'x' : v); return true; } catch (e) { return false; } })();
      const r = { stored: ctx.stored, v1AfterLoad: afterLoad, v1AfterLesson: T.raw('ctt.v1') === ctx.v1, unreadable: unread == null ? null : unread.length, invariants: wordsRes(W), unlocked: W.unlocked, prefs: W.prefs, lessons: W.lessons.length };
      const unreadOk = parseable ? unread == null : (unread != null || v === 'BIG');
      return ok(afterLoad && r.v1AfterLesson && r.invariants && unreadOk, r);
    }];
  });
  R['LS-2'] = [async () => {
    localStorage.setItem('ctt.words.v1', 'x');
    localStorage.setItem('ctt.words.v1.prev', JSON.stringify(T.FW(14)));
    return T.RELOAD({ freeze: T0 });
  }, async () => {
    const atLoad = C.STORE.loadWords().unlocked;
    T.freeze(T0 + 60000);
    await wordsLesson();
    const r = { atLoad, afterLesson: T.sw().unlocked, lessons: T.sw().lessons.length };
    return ok(atLoad === 14 && r.lessons === 13 && r.afterLesson >= 14, r);
  }];
  R['LS-3'] = [async () => { localStorage.setItem('ctt.words.v1', 'not json'); return T.RELOAD(); },
    async () => { localStorage.setItem('ctt.words.v1', '{"a":'); return T.RELOAD(); },
    async () => { localStorage.setItem('ctt.words.v1', 'not json'); return T.RELOAD(); },
    async () => {
      const k = Object.keys(localStorage).filter((x) => x.startsWith('ctt.words.v1.unreadable'));
      return ok(k.length === 1, { keys: k });
    }];
  R['LS-4'] = [async () => { localStorage.setItem('ctt.v1', JSON.stringify(T.fsyn())); return T.RELOAD({ freeze: T0, quotaWords: true }); }, async () => {
    const removed = [];
    const ri = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (k) { removed.push(k); return ri.call(this, k); };
    const v1 = T.raw('ctt.v1');
    T.freeze(T0 + 60000); await wordsLesson();
    T.freeze(T0 + 120000); await wordsLesson();
    T.freeze(T0 + 180000); await symLesson('adaptive');
    const r = { removed, v1Updated: T.raw('ctt.v1') !== v1 && T.st().lessons.length === 21, sidecar: T.raw('ctt.words.v1') };
    return ok(r.v1Updated && !removed.some((k) => k.startsWith('ctt.v1')) && r.sidecar === null, r);
  }];
  R['LS-5'] = [async () => { localStorage.setItem('ctt.v1', JSON.stringify(T.fsyn())); localStorage.setItem('ctt.words.v1', JSON.stringify(F12())); return T.RELOAD({ freeze: T0 }); }, async () => {
    const total = () => Object.keys(localStorage).reduce((a, k) => a + k.length + localStorage.getItem(k).length, 0);
    const cap = total() + 20000;
    const si = Storage.prototype.setItem, ri = Storage.prototype.removeItem;
    const removed = [], failed = [];
    Storage.prototype.setItem = function (k, v) {
      const cur = localStorage.getItem(k);
      if (total() - (cur ? cur.length + k.length : 0) + k.length + String(v).length > cap) { failed.push(k); throw new DOMException('quota', 'QuotaExceededError'); }
      return si.call(this, k, v);
    };
    Storage.prototype.removeItem = function (k) { removed.push(k); return ri.call(this, k); };
    let n = 0;
    for (; n < 40 && !failed.some((k) => k.startsWith('ctt.words')); n++) { T.freeze(T0 + (n + 1) * 60000); await wordsLesson(); }
    Storage.prototype.setItem = si; Storage.prototype.removeItem = ri;
    const r = { lessonsTyped: n, failed, removed, sidecarLessons: T.sw().lessons.length };
    return ok(failed.length > 0 && removed.every((k) => k === 'ctt.words.v1.prev'), r);
  }];
  R['LS-6'] = [async () => T.RELOAD({ freeze: T0, noLS: true }), async (ctx) => {
    ctx.allowErr = 'NOMATCH';
    const errs0 = TP.errors.slice();
    let main = null, words = null;
    try { T.freeze(T0 + 60000); await symLesson('adaptive'); main = 'ok'; } catch (e) { main = String(e); }
    try { T.freeze(T0 + 120000); if (T.isNew) { await wordsLesson(); words = 'ok'; } } catch (e) { words = String(e); }
    const lessons = document.getElementById('mWpm').textContent;
    return ok(main === 'ok' && (!T.isNew || words === 'ok'), { main, words, loadErrors: errs0, mWpm: lessons });
  }];
  R['LS-7'] = [async () => {
    const W = F12();
    W.lessons = Array.from({ length: 1000 }, (_, i) => ({ ts: T0 - (1000 - i) * 600000, mode: 'words', wpm: 40, acc: 0.95, chars: 70, errors: 3, sameHand: 0, shifted: 0, dur: 60000 }));
    localStorage.setItem('ctt.words.v1', JSON.stringify(W));
    return T.RELOAD({ freeze: T0 });
  }, async () => {
    T.freeze(T0 + 60000); await wordsLesson();
    const L = T.sw().lessons;
    return ok(L.length === 1000 && L[L.length - 1].ts === T0 + 60000 && L[0].ts === T0 - 999 * 600000, { n: L.length, lastTs: L[L.length - 1].ts - T0, firstTs: L[0].ts - T0 });
  }];
  R['LS-8'] = [async (ctx) => { localStorage.setItem('ctt.v1', JSON.stringify(T.fsyn())); return T.RELOAD({ freeze: T0 }); }, async (ctx) => {
    ctx.v1 = T.raw('ctt.v1');
    T.mode('words'); await wait(20);
    ctx.flag1 = T.raw('ctt.words.active'); ctx.v1same = T.raw('ctt.v1') === ctx.v1;
    return T.RELOAD({ freeze: T0 });
  }, async (ctx) => {
    ctx.open1 = T.onMode(); ctx.strip1 = T.strip().open;
    T.mode('adaptive'); await wait(20);
    ctx.flag2 = T.raw('ctt.words.active');
    return T.RELOAD({ freeze: T0 });
  }, async (ctx) => {
    const r = { flag1: ctx.flag1, v1same: ctx.v1same, open1: ctx.open1, strip1: ctx.strip1, flag2: ctx.flag2, open2: T.onMode() };
    return ok(r.flag1 === '1' && r.v1same && r.open1 === 'words' && r.flag2 === null && r.open2 === 'adaptive', r);
  }];

  // ---------- SV (run on server-backed origins) ----------
  R['SV-run'] = [async (ctx) => { await wait(800); ctx.v1 = T.raw('ctt.v1'); }, async (ctx) => {
    T.freeze(T0 + 60000); T.seedRandom(101); T.esc(); await symLesson('adaptive', { errAt: T.err9 });
    T.freeze(T0 + 120000); T.seedRandom(102); T.esc(); await symLesson('adaptive', { errAt: T.err9 });
    T.unseed();
    if (T.isNew) { T.freeze(T0 + 180000); await wordsLesson(); T.freeze(T0 + 240000); await wordsLesson(); }
    await wait(1500);
    const srv = TP.srv.filter((x) => x.method === 'POST').map((x) => ({ keys: Object.keys(JSON.parse(x.body)), status: x.status, body: x.body }));
    const load = TP.srv.find((x) => x.url.includes('api/load'));
    const r = { posts: srv.map((x) => x.keys.join('+') + ':' + x.status), fileBtn: document.getElementById('fileBtn').textContent, sw: T.raw('ctt.words.v1') };
    await T.save('sv-run-' + location.port + '.json', { r, srv });
    return ok(true, r);
  }];
  R['SV-load'] = [async () => {
    const j = await (await TP.real.fetch('api/load')).json();
    return ok(true, { keys: Object.keys(j), words: j.words === undefined ? 'absent' : j.words === null ? null : 'object savedAt=' + j.words.savedAt });
  }];
  R['SV-4'] = [async () => { await wait(800); return ok(true, { savedAt: T.sw() && T.sw().savedAt, unlocked: T.sw() && T.sw().unlocked }); }];
  R['SV-6'] = [async () => { localStorage.setItem('ctt.words.v1', JSON.stringify(F12())); return T.RELOAD({ freeze: T0 }); }, async () => {
    await wait(800);
    TP.stub = (u, o) => (o && o.body && o.body.startsWith('{"words"') ? new Response('{"ok":false}', { status: 500 }) : null);
    T.freeze(T0 + 60000); await wordsLesson(); await wait(500);
    const b1 = document.getElementById('fileBtn').textContent;
    T.freeze(T0 + 120000); await symLesson('adaptive'); await wait(800);
    const b2 = document.getElementById('fileBtn').textContent;
    TP.stub = null;
    const posts = TP.srv.filter((x) => x.method === 'POST').map((x) => Object.keys(JSON.parse(x.body)).join('+') + ':' + (x.status || 'stub'));
    return ok(!/fail/i.test(b1) && !/fail/i.test(b2), { afterWords: b1, afterMain: b2, posts });
  }];
  R['SV-7'] = [async () => { localStorage.setItem('ctt.words.v1', JSON.stringify(Object.assign(F12(), { pad: 'x'.repeat(1000000) }))); return T.RELOAD({ freeze: T0 }); }, async () => {
    await wait(1500);
    T.freeze(T0 + 60000); await wordsLesson(); await wait(1500);
    const posts = TP.srv.filter((x) => x.method === 'POST' && x.body.startsWith('{"words"')).map((x) => [x.body.length, x.status]);
    return ok(posts.length >= 1 && posts.every((p) => p[1] === 200 && p[0] > 1000000), { posts });
  }];

  // ---------- FS ----------
  R['FS-1'] = [async () => { localStorage.setItem('ctt.v1', JSON.stringify(T.fsyn())); return T.RELOAD({ freeze: T0, folder: true }); }, async () => {
    await wait(300);
    const n0 = TP.fwrites.length;
    T.freeze(T0 + 60000); await wordsLesson();
    const t1 = T.raw('ctt.words.v1');
    const w1 = TP.fwrites.slice(n0);
    T.freeze(T0 + 120000); await wordsLesson();
    const w2 = TP.fwrites.slice(n0);
    const last = w2[w2.length - 1];
    const r = { names: w2.map((x) => x[0]), firstEq: w1.length === 1 && w1[0][1] === JSON.stringify(JSON.parse(t1), null, 1), lastEq: last[1] === JSON.stringify(T.sw(), null, 1) };
    return ok(r.names.length === 2 && r.names.every((n) => n === 'words.json') && r.firstEq && r.lastEq, r);
  }];
  R['FS-2'] = [async () => {
    localStorage.setItem('ctt.words.v1', JSON.stringify(F10old()));
    return T.RELOAD({ freeze: T0, folder: true, folderFiles: { 'words.json': JSON.stringify(T.FW(16, T0, { savedAt: T0 })) } });
  }, async () => {
    await wait(300);
    const r = { unlocked: T.sw().unlocked, savedAt: T.sw().savedAt === T0, writes: TP.fwrites.map((x) => x[0]) };
    return ok(r.unlocked === 16 && r.savedAt && !r.writes.includes('words.json'), r);
  }];

  // ---------- EX / MG ----------
  const seedBoth = (cfg, W) => async (ctx) => {
    localStorage.setItem('ctt.v1', JSON.stringify(T.fsyn()));
    localStorage.setItem('ctt.words.v1', JSON.stringify(W || F12()));
    return T.RELOAD(Object.assign({ freeze: T0 }, cfg || {}));
  };
  R['EX-1'] = [seedBoth(), async () => {
    await T.openSettings(); document.getElementById('sExport').click(); await wait(100); await T.closeSettings();
    const d = TP.downloads[0];
    const o = JSON.parse(d.text);
    const bad = ['words', 'mainMode', 'wordsActive'].filter((k) => k in o).concat('wordsTargetWpm' in o.settings ? ['wordsTargetWpm'] : []);
    // Byte identity with HEAD's export is checked in MI-6; eqStored is informational.
    return ok(/^code-typing-trainer-backup-\d{4}-\d\d-\d\d\.json$/.test(d.name) && !bad.length, { name: d.name, bad, eqStored: d.text === JSON.stringify(JSON.parse(T.raw('ctt.v1')), null, 2) });
  }];
  R['EX-2'] = [seedBoth(), async () => {
    T.freeze(T0 + 60000); await wordsLesson();
    await T.openSettings(); document.getElementById('sExportWords').click(); await wait(100); await T.closeSettings();
    const d = TP.downloads[0];
    const o = JSON.parse(d.text);
    const r = { name: d.name, eq: d.text === JSON.stringify(T.sw(), null, 2), hasOrder: 'order' in o, hasSettings: 'settings' in o };
    await T.save('ex2-words-export.json', d.text);
    return ok(/^code-typing-trainer-words-backup-\d{4}-\d\d-\d\d\.json$/.test(d.name) && r.eq && !r.hasOrder && !r.hasSettings, r);
  }];
  // EX-3: Words import from a symbol mode (Adaptive) with main progress present, and
  // EX-3f: on a fresh origin. The import input lives inside the Settings dialog.
  const ex3 = (seedMain) => [async () => { if (seedMain) localStorage.setItem('ctt.v1', JSON.stringify(T.fsyn())); return T.RELOAD({ freeze: T0 }); }, async () => {
    const v1 = T.raw('ctt.v1'), prev = T.raw('ctt.v1.prev');
    const file = JSON.stringify(T.FW(15, T0, { savedAt: T0 - 99 }), null, 2);
    T.freeze(T0 + 5000);
    const n0 = TP.reqs.length + TP.srv.length;
    await T.load(file, 'code-typing-trainer-words-backup-x.json');
    await wait(50);
    const exp = C.STORE.mergeWords(JSON.parse(file));
    const got = T.sw();
    const r = { mode: T.onMode(), v1Same: T.raw('ctt.v1') === v1, prevSame: T.raw('ctt.v1.prev') === prev, mainReqs: TP.reqs.length + TP.srv.length - n0, eqExceptSavedAt: T.eq(Object.assign({}, got, { savedAt: 0 }), Object.assign({}, exp, { savedAt: 0 })), savedAt: got.savedAt - T0, toast: T.toastHas(/Words progress imported/) };
    return ok(r.v1Same && r.prevSame && r.mainReqs === 0 && r.eqExceptSavedAt && r.toast, r);
  }];
  R['EX-3'] = ex3(true);
  R['EX-3f'] = ex3(false);
  R['EX-4'] = [async () => { if (T.isNew) localStorage.setItem('ctt.words.v1', JSON.stringify(F12())); return T.RELOAD({ freeze: T0 }); }, async () => {
    const w = T.raw('ctt.words.v1');
    await T.load(T.fsyn());
    await T.save('ex4-' + T.build + '.json', { v1: T.raw('ctt.v1') });
    return ok(T.raw('ctt.words.v1') === w, { sidecarSame: T.raw('ctt.words.v1') === w });
  }];
  R['EX-5'] = [seedBoth(), async () => {
    await T.load('this is not json');
    const t1 = T.toastHas(/Could not read that file/);
    const v1 = T.raw('ctt.v1'); // garbage import: main is not part of the check (HEAD re-saved here)
    await T.load({ kind: 'ctt-words', unlocked: 'x', keys: [1, 2], lessons: { a: 1 }, prefs: 5, focusRun: 'q', cooldown: { a: 'x' } });
    const W = T.sw();
    const r = { toastBad: t1, v1Same: T.raw('ctt.v1') === v1, junkSanitized: wordsRes(W) && W.lessons.length === 0 && T.eq(W.keys, {}) && W.focusRun === null && T.eq(W.cooldown, {}) };
    return ok(r.toastBad && r.v1Same && r.junkSanitized, r);
  }];
  R['EX-6'] = [seedBoth({}, T.FW(12, T0, { savedAt: T0, prefs: { targetWpm: 44, lessonLen: 90 } })), async () => {
    T.mode('words'); await wait(20);
    const v1 = T.raw('ctt.v1');
    await T.openSettings(); wBtn('sReset').click(); await wait(50); await T.closeSettings();
    const W = T.sw();
    const r = { confirm: TP.confirms[0], lessons: W.lessons.length, unlocked: W.unlocked, prefs: W.prefs, v1Same: T.raw('ctt.v1') === v1 };
    return ok(/Words/.test(r.confirm) && /not affected/.test(r.confirm) && r.lessons === 0 && T.eq(r.prefs, Object.assign({ targetWpm: 44, lessonLen: 90 }, T.isNewTabs ? PREFS0 : {})) && r.v1Same, r);
  }];
  R['EX-7'] = [async () => { localStorage.setItem('ctt.v1', JSON.stringify(T.fsyn())); if (T.isNew) localStorage.setItem('ctt.words.v1', JSON.stringify(F12())); return T.RELOAD({ freeze: T0 }); }, async () => {
    const w = T.raw('ctt.words.v1');
    await T.openSettings(); document.getElementById('sReset').click(); await wait(50); await T.closeSettings();
    await T.save('ex7-' + T.build + '.json', { v1: T.raw('ctt.v1'), confirm: TP.confirms[0] });
    return ok(T.raw('ctt.words.v1') === w && TP.confirms[0] === (T.isNewTabs ? 'Reset symbol progress and stats? Words mode progress is not affected. Export first if you want a backup.' : 'Reset all progress and stats? Export first if you want a backup.'), { confirm: TP.confirms[0], sidecarSame: T.raw('ctt.words.v1') === w });
  }];
  R['EX-8'] = [wsSetup(F12(), F12()), async () => {
    await wait(800);
    T.mode('words'); await wait(20);
    const n0 = TP.reqs.length;
    await T.openSettings(); wBtn('sReset').click(); await wait(50); await T.closeSettings();
    await wait(5000);
    const after = TP.reqs.slice(n0).filter((x) => x.method === 'PATCH').map((x) => x.tag + ':' + Object.keys(JSON.parse(x.body).files).join('+'));
    return ok(after.length === 1 && after[0] === 'words:' + WFILE, { patches: after });
  }];
  R['MG-1'] = [async (ctx) => { ctx.leg = JSON.stringify(T.FLEGACY()); localStorage.setItem('ctt.v1', ctx.leg); return T.RELOAD({ freeze: T0 }); }, async (ctx) => {
    const unchanged = T.raw('ctt.v1') === ctx.leg;
    const W = T.sw();
    const r1 = { unchanged, mode: T.onMode(), sidecarLessons: W && W.lessons.length, target: W && W.prefs.targetWpm, savedAt: W && W.savedAt === 1 }; // seeded copy is oldest possible, so any real copy wins
    T.freeze(T0 + 60000); await symLesson('lines');
    const s = T.st();
    const left = ['words', 'mainMode', 'wordsActive'].filter((k) => k in s).concat('wordsTargetWpm' in s.settings ? ['wordsTargetWpm'] : []);
    const r = Object.assign(r1, { legacyLeftAfterSave: left, modeSaved: s.mode });
    return ok(unchanged && r.mode === 'lines' && r.sidecarLessons === 12 && r.target === 40 && r.savedAt && !left.length, r);
  }];
  R['MG-2'] = [async (ctx) => {
    localStorage.setItem('ctt.v1', JSON.stringify(T.FLEGACY()));
    const W = T.FW(11, T0, { savedAt: T0 - 50 }); W.lessons = W.lessons.slice(0, 3);
    ctx.w = JSON.stringify(W); localStorage.setItem('ctt.words.v1', ctx.w);
    return T.RELOAD({ freeze: T0 });
  }, async (ctx) => ok(T.raw('ctt.words.v1') === ctx.w, { sidecarSame: T.raw('ctt.words.v1') === ctx.w, lessons: T.sw().lessons.length })];
  R['MG-3a'] = [async () => T.RELOAD({ freeze: T0 }), async () => {
    await T.load(T.FLEGACY());
    const s = T.st(); const W = T.sw();
    const left = ['words', 'mainMode', 'wordsActive'].filter((k) => k in s).concat('wordsTargetWpm' in s.settings ? ['wordsTargetWpm'] : []);
    const r = { left, mode: s.mode, sidecarLessons: W && W.lessons.length, target: W && W.prefs.targetWpm };
    return ok(!left.length && r.mode === 'lines' && r.sidecarLessons === 12 && r.target === 40, r);
  }];
  R['MG-3b'] = [async (ctx) => {
    const W = T.FW(11, T0, { savedAt: T0 - 50 }); W.lessons = W.lessons.slice(0, 3);
    ctx.w = JSON.stringify(W); localStorage.setItem('ctt.words.v1', ctx.w);
    return T.RELOAD({ freeze: T0 });
  }, async (ctx) => {
    await T.load(T.FLEGACY());
    const s = T.st();
    const left = ['words', 'mainMode', 'wordsActive'].filter((k) => k in s);
    const r = { left, sidecarSame: T.raw('ctt.words.v1') === ctx.w, toasts: TP.toasts.slice() };
    return ok(!left.length && r.sidecarSame && T.toastHas(/not imported/i), r);
  }];
  R['MG-4'] = [async (ctx) => {
    const leg = T.FLEGACY(); leg.savedAt = T0 + 1000;
    const id = await T.mkGist({ main: JSON.stringify(leg), report: '# r\n' });
    T.useGist(id); ctx.id = id;
    return T.RELOAD({ freeze: T0 });
  }, async (ctx) => {
    await wait(500);
    T.freeze(T0 + 60000); await symLesson('lines'); await SYNC().flush(); await wait(300);
    const g = await T.gist(ctx.id);
    const m = JSON.parse(g.files[MFILE]);
    const left = ['words', 'mainMode', 'wordsActive'].filter((k) => k in m).concat('wordsTargetWpm' in m.settings ? ['wordsTargetWpm'] : []);
    const r = { left, lessons: m.lessons.length, sidecarSeeded: T.sw() && T.sw().lessons.length, gistFiles: Object.keys(g.files) };
    return ok(!left.length && r.lessons === 21, r);
  }];
  R['MG-5'] = [async () => {
    const out = {};
    let real = null;
    try { real = await (await TP.real.fetch('fixtures/real-main.json')).json(); } catch (e) { /* none */ }
    for (const [n, fx] of [['syn', T.fsyn()], ['real', real]]) {
      if (!fx) continue;
      const m = C.STORE.merge(JSON.parse(JSON.stringify(fx)));
      out[n] = T.hash(JSON.stringify(m));
    }
    await T.save('mg5-' + T.build + '.json', out);
    return ok(true, out);
  }];
  R['MG-6'] = [async () => {
    const leg = T.FLEGACY(); leg.mode = 'words'; leg.mainMode = 'words';
    localStorage.setItem('ctt.v1', JSON.stringify(leg));
    return T.RELOAD({ freeze: T0 });
  }, async () => {
    const shown = T.onMode();
    // First save: a symbol lesson. (Tabbed builds no longer re-save main when Settings closes
    // without a main change, so the old open/close trigger writes nothing there.)
    const before = T.raw('ctt.v1');
    document.getElementById('settingsBtn').click(); await wait(20); await T.closeSettings();
    const closeSaved = T.raw('ctt.v1') !== before;
    if (!closeSaved) { T.freeze(T0 + 60000); T.typeLesson(); }
    return ok(T.st().mode === 'adaptive' && shown === 'adaptive', { saved: T.st().mode, shown, closeSaved });
  }];

  // ---------- FX ----------
  R['FX-3a'] = [async () => {
    localStorage.setItem('ctt.v1', JSON.stringify(T.fsyn()));
    localStorage.setItem('ctt.words.v1', JSON.stringify(Object.assign(C.STORE.wordsDefaults(), { savedAt: T0 - 10, prefs: { targetWpm: 50, lessonLen: 70 } })));
    return T.RELOAD({ freeze: T0 });
  }, async () => {
    document.getElementById('statsBtn').click(); await wait(30);
    document.getElementById('copyReport').click(); await wait(50);
    document.getElementById('downloadReport').click(); await wait(100);
    const expect = T.noGen(C.REPORT.build(C.STORE.merge(T.st())));
    const r = { noWords: !TP.clip[0].includes('## Words mode'), clipEq: T.noGen(TP.clip[0]) === expect, dlEq: T.noGen(TP.downloads[0].text) === expect };
    return ok(r.noWords && r.clipEq && r.dlEq, r);
  }];
  R['FX-3b'] = [wsSetup(F12(), F12()), async (ctx) => {
    await wait(800);
    T.freeze(T0 + 60000); await wordsLesson();
    T.freeze(T0 + 120000); await symLesson('adaptive'); await SYNC().flush(); await wait(300);
    document.getElementById('statsBtn').click(); await wait(30);
    document.getElementById('copyReport').click(); await wait(50);
    const g = await T.gist(ctx.id);
    const n = (TP.clip[0].match(/## Words mode/g) || []).length;
    const r = { count: n, atEnd: /## Words mode \(separate from the symbol stats\)[\s\S]*$/.test(TP.clip[0]) && !/## Words mode[\s\S]*\n## (?!Words)/.test(TP.clip[0]), persisted: g.files[RFILE].includes('## Words mode') };
    return ok(n === 1 && r.atEnd && !r.persisted, r);
  }];
  R['FX-3c'] = [async () => {
    localStorage.setItem('ctt.v1', JSON.stringify(T.fsyn()));
    localStorage.setItem('ctt.words.v1', '{"lessons":[{"ts":1,"wpm":1,"acc":1},{"ts":"x"}],"keys":{"e":5,"t":{"hist":"x"}},"unlocked":99}');
    return T.RELOAD({ freeze: T0 });
  }, async () => {
    document.getElementById('statsBtn').click(); await wait(30);
    document.getElementById('copyReport').click(); await wait(50);
    const base = T.noGen(C.REPORT.build(C.STORE.merge(T.st())));
    const c = T.noGen(TP.clip[0] || '');
    return ok(c.startsWith(base) && /## Words mode/.test(c), { prefixEq: c.startsWith(base), tail: c.slice(base.length, base.length + 400) });
  }];
  R['FX-4'] = [seedBoth(), async () => {
    const res = {};
    const stats = () => document.getElementById('statsBtn').click();
    T.mode('words'); await wait(20); stats(); await wait(30);
    res.a = { words: document.getElementById('statsWords').classList.contains('on'), title: document.getElementById('keysTitle').textContent };
    stats(); await wait(20);
    res.b = {};
    for (const m of ['adaptive', 'lines', 'mycode', 'warmup']) { T.mode(m); await wait(20); stats(); await wait(30); res.b[m] = document.getElementById('statsSym').classList.contains('on'); stats(); await wait(20); }
    T.mode('words'); await wait(20); stats(); await wait(30);
    document.getElementById('statsSym').click(); await wait(20);
    stats(); await wait(20); stats(); await wait(30);
    res.c = document.getElementById('statsWords').classList.contains('on');
    stats();
    return ok(res.a.words && res.a.title === 'Letters (Words mode)' && Object.values(res.b).every(Boolean) && res.c, res);
  }];
  // FX-5a / FX-5b: Words-only fields live on the Words tab (sWordsLen, sUnlockWords, sResetWords);
  // sLen is always the main lesson length.
  R['FX-5a'] = [seedBoth({}, T.FW(12, T0, { prefs: { targetWpm: 41, lessonLen: 85 } })), async () => {
    T.mode('words'); await wait(20);
    await T.openSettings();
    const $ = (id) => document.getElementById(id);
    const tab = (document.querySelector('#settings .seg button.on') || {}).dataset;
    const r = { tab: tab && tab.tab, wlen: $('sWordsLen').value, len: $('sLen').value, unlock: $('sUnlockWords').textContent, reset: $('sResetWords').textContent,
      symUnlock: $('sUnlock').textContent, symReset: $('sReset').textContent, target: !!$('sTarget'), wtarget: $('sWordsTarget').value, oldLabel: !!$('sLenLabel'),
      labels: [...document.querySelectorAll('#settings label')].map((l) => l.textContent.trim()).filter((t) => /Target|length/.test(t)) };
    await T.closeSettings();
    return ok(r.tab === 'words' && r.wlen === '85' && r.len === String(T.st().settings.lessonLen) && r.unlock === 'Unlock next letter' && r.reset === 'Reset Words progress' &&
      r.symUnlock === 'Unlock next symbol' && r.symReset === 'Reset symbol progress' && r.target && r.wtarget === '41' && !r.oldLabel, r);
  }];
  R['FX-5b'] = [seedBoth(), async () => {
    T.mode('words'); await wait(20);
    const v1 = T.raw('ctt.v1');
    await T.openSettings();
    const $ = (id) => document.getElementById(id);
    $('sWordsLen').value = '120'; $('sWordsLen').dispatchEvent(new Event('change'));
    $('sWordsTarget').value = '50'; $('sWordsTarget').dispatchEvent(new Event('change'));
    await T.closeSettings();
    T.esc(); const len = T.text().length;
    const s = T.st();
    const r = { prefs: T.sw().prefs, v1Same: T.raw('ctt.v1') === v1, mainLen: s.settings.lessonLen, mainTarget: s.settings.targetWpm, nextLen: len };
    // extras are off here, so the length window of the plain word text applies
    return ok(T.eq(r.prefs, Object.assign({ targetWpm: 50, lessonLen: 120 }, PREFS0)) && r.v1Same && r.mainLen === 70 && r.mainTarget === 30 && len >= 110 && len <= 140, r);
  }];
  R['FX-5c'] = [wsSetup(F12(), F12()), async () => {
    await wait(800);
    T.mode('words'); await wait(20);
    const v1 = T.raw('ctt.v1'), n0 = TP.reqs.length;
    await T.openSettings(); await T.closeSettings(); await wait(4500);
    const after = TP.reqs.slice(n0).filter((x) => x.tag === 'main');
    return ok(T.raw('ctt.v1') === v1 && after.length === 0, { v1Same: T.raw('ctt.v1') === v1, mainReqs: after.length });
  }];
  R['FX-5d'] = [seedBoth(), async () => {
    T.mode('words'); await wait(20);
    const before = T.st().settings.sound;
    await T.openSettings();
    const el = document.getElementById('sSound'); el.checked = !el.checked; el.dispatchEvent(new Event('change'));
    await T.closeSettings();
    return ok(T.st().settings.sound === !before, { before, after: T.st().settings.sound });
  }];
  R['FX-5e'] = [seedBoth(), async () => {
    const w = T.raw('ctt.words.v1');
    await T.openSettings();
    const el = document.getElementById('sLen'); el.value = '100'; el.dispatchEvent(new Event('change'));
    await T.closeSettings();
    return ok(T.st().settings.lessonLen === 100 && T.raw('ctt.words.v1') === w, { mainLen: T.st().settings.lessonLen, sidecarSame: T.raw('ctt.words.v1') === w });
  }];
  R['FX-5f'] = [seedBoth(), async () => {
    T.mode('words'); await wait(20);
    const v1 = T.raw('ctt.v1'), u = T.sw().unlocked;
    await T.openSettings(); wBtn('sUnlock').click(); await wait(20); await T.closeSettings();
    return ok(T.sw().unlocked === u + 1 && T.raw('ctt.v1') === v1, { before: u, after: T.sw().unlocked, v1Same: T.raw('ctt.v1') === v1 });
  }];
  const F26 = () => {
    const W = T.FW(26, T0, { savedAt: T0, focusRun: { ch: 'q', lessons: 3, startConf: 0.2 }, cooldown: { z: 2 }, sinceUnlock: 7 });
    W.keys.q.hist = T.hist(40, 0.8, T0, 5); // q stays in the learn phase, so it remains the focus
    return W;
  };
  async function untilSentences(want) {
    for (let i = 0; i < 80; i++) {
      T.seedRandom(1000 + i); T.esc();
      const s = /Sentences/.test(document.getElementById('focusLine').textContent);
      if (s === want) { T.unseed(); return true; }
    }
    T.unseed(); return false;
  }
  R['FX-6a'] = [seedBoth({}, F26()), async () => {
    T.mode('words'); await wait(20);
    const got = await untilSentences(true);
    const b = T.sw();
    T.freeze(T0 + 60000);
    const typed = T.typeLesson();
    const a = T.sw();
    const nonLetter = Object.keys(a.keys).filter((k) => !/^[a-z]$/.test(k));
    const grew = Object.keys(a.keys).filter((k) => a.keys[k].hist.some((h) => h.ts === T0 + 60000));
    const r = { got, focusRun: [b.focusRun, a.focusRun], cooldown: [b.cooldown, a.cooldown], since: [b.sinceUnlock, a.sinceUnlock], nonLetterKeys: nonLetter, pairs: a.pairs, lettersRecorded: grew.length, lessons: a.lessons.length, sample: typed.text.slice(0, 60) };
    return ok(got && T.eq(b.focusRun, a.focusRun) && T.eq(b.cooldown, a.cooldown) && b.sinceUnlock === a.sinceUnlock && !nonLetter.length && T.eq(a.pairs, {}) && grew.length > 5, r);
  }];
  R['FX-6b'] = [seedBoth({}, F26()), async () => {
    T.mode('words'); await wait(20);
    const got = await untilSentences(false);
    const focus = T.focusLetter();
    T.freeze(T0 + 60000); T.typeLesson();
    const a = T.sw();
    const r = { got, focus, focusRun: a.focusRun, cooldown: a.cooldown, since: a.sinceUnlock, toasts: TP.toasts };
    return ok(got && focus === 'q' && (a.focusRun ? a.focusRun.lessons === 4 : T.toastHas(/Rotating off q/)) && a.cooldown.z === 1 && a.sinceUnlock === 8, r);
  }];
  R['FX-6c'] = [seedBoth({}, F26()), async () => {
    T.mode('words'); await wait(20);
    let n = 0;
    for (let i = 0; i < 5; i++) { if (await untilSentences(true)) { T.freeze(T0 + (i + 1) * 60000); T.typeLesson(); n++; } }
    return ok(n === 5 && !T.toastHas(/Rotating off/), { sentenceLessons: n, toasts: TP.toasts, focusRun: T.sw().focusRun });
  }];
  T.focusLetter = () => { const b = document.querySelector('#focusLine b'); return b ? b.textContent : null; };

  // ---------- WE ----------
  R['WE-1'] = [async () => {
    T.mode('words'); await wait(20);
    const s = T.strip();
    const allowed = new Set('etaoinsrhl');
    let bad = 0;
    for (let i = 0; i < 200; i++) { T.seedRandom(5000 + i); T.esc(); for (const c of T.text()) if (/[a-z]/i.test(c) && !allowed.has(c)) bad++; }
    T.unseed();
    return ok(s.open === 'etaoinsrhl' && s.locked === 16 && bad === 0, { open: s.open, locked: s.locked, badChars: bad });
  }];
  const weSetup = (W, cfg, main) => async () => {
    if (main) localStorage.setItem('ctt.v1', JSON.stringify(main));
    localStorage.setItem('ctt.words.v1', JSON.stringify(W));
    localStorage.setItem('ctt.words.active', '1');
    return T.RELOAD(Object.assign({ freeze: T0 }, cfg || {}));
  };
  const keysAt = (W, chs, acc, n) => { for (const ch of chs) W.keys[ch].hist = T.hist(n || 40, acc, T0, 5); return W; };
  const v1Guard = (fn) => async (ctx) => {
    const v1 = T.raw('ctt.v1');
    const n0 = TP.reqs.length;
    const out = await fn(ctx);
    const mainReq = TP.reqs.slice(n0).filter((x) => x.tag === 'main').length;
    out.ev = Object.assign({}, out.ev, { v1Same: T.raw('ctt.v1') === v1, mainReq });
    out.pass = out.pass && T.raw('ctt.v1') === v1 && mainReq === 0;
    return out;
  };
  R['WE-2'] = [weSetup((() => { const W = T.FW(10); for (const k of Object.values(W.keys)) k.good = true; return W; })()), v1Guard(async () => {
    T.freeze(T0 + 60000); T.typeLesson({ ms: 200 });
    return ok(T.toastHas(/New letter unlocked: d/) && T.sw().unlocked === 11 && T.sw().sinceUnlock === 0, { toasts: TP.toasts, unlocked: T.sw().unlocked, since: T.sw().sinceUnlock });
  })];
  R['WE-3'] = [weSetup(keysAt(T.FW(12, T0, { sinceUnlock: 9 }), 'ad', 0.85)), v1Guard(async () => {
    T.freeze(T0 + 60000); T.typeLesson({ ms: 200 });
    return ok(T.sw().unlocked === 13, { unlocked: T.sw().unlocked, toasts: TP.toasts });
  })];
  R['WE-3n'] = [weSetup(keysAt(keysAt(T.FW(12, T0, { sinceUnlock: 9 }), 'a', 0.85), 'd', 0.6)), v1Guard(async () => {
    T.freeze(T0 + 60000); T.typeLesson({ ms: 200, errAt: (i, ch) => (ch === 'd' ? T.wrongFor(ch) : null) });
    document.getElementById('statsBtn').click(); await wait(30);
    const next = document.getElementById('summary').textContent;
    document.getElementById('statsBtn').click();
    return ok(T.sw().unlocked === 12 && /waits until d /.test(next), { unlocked: T.sw().unlocked, next: next.slice(next.indexOf('Next letter')) });
  })];
  function rotFixture() {
    const W = keysAt(T.FW(12, T0, { sinceUnlock: 2 }), 'd', 0.6);
    const conf = C.ENGINE.stats(T.view(W), 'd', T0).conf;
    W.focusRun = { ch: 'd', lessons: 4, startConf: conf };
    return W;
  }
  R['WE-4'] = [async (ctx) => weSetup(rotFixture())(ctx), v1Guard(async () => {
    T.freeze(T0 + 60000);
    const f = T.focusLetter();
    T.typeLesson({ ms: 200, errAt: (i, ch) => (ch === 'd' ? T.wrongFor(ch) : null) });
    const W = T.sw();
    const next = T.focusLetter();
    return ok(f === 'd' && T.toastHas(/Rotating off d for 3 lessons/) && W.cooldown.d === 3 && W.focusRun === null && next !== 'd', { focusBefore: f, toasts: TP.toasts, cooldown: W.cooldown, focusRun: W.focusRun, nextFocus: next });
  })];
  R['WE-4b'] = [async (ctx) => weSetup(rotFixture())(ctx), v1Guard(async () => {
    T.freeze(T0 + 60000);
    const f = T.focusLetter();
    T.typeLesson({ ms: 200 });
    const W = T.sw();
    return ok(f === 'd' && W.focusRun && W.focusRun.ch === 'd' && W.focusRun.lessons === 0 && !W.cooldown.d, { focusBefore: f, focusRun: W.focusRun, cooldown: W.cooldown, toasts: TP.toasts });
  })];
  const revFixture = () => { const W = T.FW(12); W.keys.e.level = 1; W.keys.e.due = T0 - 3600000; return W; };
  R['WE-5'] = [weSetup(revFixture()), v1Guard(async () => {
    let n = 0;
    for (; n < 15 && !T.toastHas(/Review passed: e/); n++) { T.freeze(T0); T.esc(); T.typeLesson({ ms: 200 }); }
    const e = T.sw().keys.e;
    return ok(T.toastHas(/Review passed: e \(next in 3d\)/) && e.level === 2 && e.due === T0 + 3 * DAY, { lessons: n, level: e.level, dueDays: (e.due - T0) / DAY, toasts: TP.toasts.filter((t) => /Review/.test(t)) });
  })];
  R['WE-6'] = [weSetup(revFixture()), v1Guard(async () => {
    let n = 0;
    for (; n < 10 && !T.toastHas(/Review missed: e/); n++) { T.freeze(T0); T.esc(); T.typeLesson({ ms: 200, errAt: (i, ch) => (ch === 'e' ? T.wrongFor(ch) : null) }); }
    const e = T.sw().keys.e;
    return ok(T.toastHas(/Review missed: e is back to learning/) && e.level === 0 && e.due === null, { lessons: n, level: e.level, due: e.due, toasts: TP.toasts.filter((t) => /Review/.test(t)) });
  })];
  R['WE-7'] = [weSetup((() => { const W = T.FW(12); W.keys.t = { hist: T.hist(30, 0.7, T0, 2), level: 2, due: T0 + 3 * DAY }; return W; })()), v1Guard(async () => {
    T.freeze(T0 + 60000); T.typeLesson({ ms: 200 });
    return ok(T.toastHas(/t has dropped below 90%, back to learning/) && T.sw().keys.t.level === 0, { level: T.sw().keys.t.level, toasts: TP.toasts });
  })];
  const masteryFixture = (target) => {
    const W = T.FW(12, T0, { prefs: { targetWpm: target, lessonLen: 70 } });
    W.keys.a.hist = Array.from({ length: 60 }, (_, i) => ({ ok: 1, t: 200, ts: T0 - (60 - i) * 60000 }));
    return W;
  };
  for (const [wt, mt] of [[100, 10], [100, 120], [20, 10], [20, 120]]) {
    const main = T.fsyn(); main.settings.targetWpm = mt;
    R['WE-8-' + wt + '-' + mt] = [weSetup(masteryFixture(wt), {}, main), v1Guard(async () => {
      T.freeze(T0 + 60000); T.typeLesson({ ms: 200 });
      const solid = TP.toasts.some((t) => /(^|[ ·])a( [a-z])* looks? solid today/.test(t) || /\ba\b.*look solid today/.test(t));
      return ok(wt === 100 ? !solid : solid, { solid, toasts: TP.toasts, passDays: T.sw().keys.a.passDays });
    })];
  }
  R['WE-9'] = [weSetup(masteryFixture(20)), v1Guard(async () => {
    T.freeze(T0 + 60000); T.typeLesson({ ms: 200 });
    let n = 0;
    for (; n < 8 && !T.toastHas(/Mastered: a \(review tomorrow\)/); n++) { T.freeze(T0 + DAY + n * 60000); T.esc(); T.typeLesson({ ms: 200 }); }
    return ok(T.toastHas(/Mastered: a \(review tomorrow\)/) && T.sw().keys.a.level === 1, { day2Lessons: n, level: T.sw().keys.a.level, toasts: TP.toasts.filter((t) => /a /.test(t)) });
  })];
  R['WE-11'] = [weSetup(keysAt(T.FW(12), 'd', 0.6), {}, (() => { const m = T.fsyn(); m.settings.focusStyle = 'mixed'; return m; })()), async () => {
    const txt = document.getElementById('focusLine').textContent;
    return ok(/^Focus /.test(txt) && !/Learning/.test(txt), { focusLine: txt.slice(0, 80) });
  }];
  R['WE-11ref'] = [weSetup(keysAt(T.FW(12), 'd', 0.6), {}, T.fsyn()), async () => {
    const txt = document.getElementById('focusLine').textContent;
    return ok(/^Learning d/.test(txt), { focusLine: txt.slice(0, 80) });
  }];
  R['WE-12'] = [async () => {
    localStorage.setItem('ctt.v1', JSON.stringify(T.fsyn()));
    if (T.isNew) localStorage.setItem('ctt.words.v1', JSON.stringify(F12()));
    return T.RELOAD({ freeze: T0 });
  }, async () => {
    const w = T.raw('ctt.words.v1');
    T.freeze(T0 + 60000);
    if (T.isNew) { T.mode('words'); await wait(20); T.typeLesson({ upTo: 30 }); }
    T.freeze(T0 + 70000);
    T.mode('adaptive'); await wait(20);
    await T.save('we12-' + T.build + '.json', { v1: T.raw('ctt.v1') });
    return ok(T.raw('ctt.words.v1') === w, { sidecarSame: T.raw('ctt.words.v1') === w });
  }];
  R['WE-13'] = [weSetup(F12()), async () => {
    T.freeze(T0 + 60000); T.typeLesson();
    document.getElementById('statsBtn').click(); await wait(30); document.getElementById('statsBtn').click();
    const W = T.sw();
    return ok(!('order' in W) && !('settings' in W), { keys: Object.keys(W) });
  }];

  // ---------- auto-resume ----------
  window.addEventListener('load', () => { if (sessionStorage.getItem('t.run')) T.resume(); });
})();
