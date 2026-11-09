// Synthesized sounds (Web Audio): soft key click, error tone, lesson and unlock chimes.
(function () {
  const CTT = (window.CTT = window.CTT || {});
  let ctx = null;
  let master = null;
  let noise = null;
  let enabled = true;

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate * 0.05);
      noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) {
      ctx = null;
    }
  }

  function configure(on, volume) {
    enabled = on;
    if (master) master.gain.value = volume;
    CTT.SOUND._vol = volume;
  }

  function ready() {
    if (!enabled) return false;
    init();
    if (!ctx) return false;
    master.gain.value = CTT.SOUND._vol == null ? 0.6 : CTT.SOUND._vol;
    return true;
  }

  function env(g, t, peak, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  }

  function click() {
    if (!ready()) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1700 + Math.random() * 900;
    bp.Q.value = 1.4;
    const g = ctx.createGain();
    env(g, t, 0.35, 0.03);
    src.connect(bp).connect(g).connect(master);
    src.start(t);
    src.stop(t + 0.05);
    // low "thock" body
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(170, t);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.04);
    const g2 = ctx.createGain();
    env(g2, t, 0.18, 0.045);
    o.connect(g2).connect(master);
    o.start(t);
    o.stop(t + 0.06);
  }

  function tone(freq, delay, dur, type, peak) {
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freq;
    const g = ctx.createGain();
    env(g, t, peak || 0.15, dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function error() {
    if (!ready()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(230, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.12);
    const g = ctx.createGain();
    env(g, t, 0.22, 0.14);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.16);
  }

  function complete() {
    if (!ready()) return;
    tone(660, 0, 0.14, 'sine', 0.12);
    tone(880, 0.07, 0.2, 'sine', 0.12);
  }

  function unlock() {
    if (!ready()) return;
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25 + i * 0.08, 0.25, 'sine', 0.1));
  }

  CTT.SOUND = { init, configure, click, error, complete, unlock, _vol: 0.6 };
})();
