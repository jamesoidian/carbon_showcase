// 6-Movement Synchronized WebAudio Film Score Synthesizer ("THE HANDPRINT", 86.0s)

function midiToHz(m) {
  return 440.0 * Math.pow(2.0, (m - 69.0) / 12.0);
}

class StoryScoreEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.unlocked = false;
    this.events = [];
    this.nextIdx = 0;
    this.lastStoryTime = -1;

    // Analytic + real-time FFT reactive envelopes for GPU shader sync (works even when muted!)
    this.envLow = 0;
    this.envMid = 0;
    this.envHigh = 0;

    this._composeScore();
  }

  _composeScore() {
    const ev = [];
    const add = (t, kind, data) => ev.push({ t, kind, ...data });

    // =======================================================================
    // ACT I (0..14s): THE CAVE — Heartbeat + Sparse Intimate Felt Piano (Dm)
    // =======================================================================
    [0.4, 4.2, 8.0, 11.6].forEach((t) => add(t, 'heartbeat', { amp: 0.72 }));

    const act1Piano = [
      [0.8, 38, 4.2, 0.55, -0.2], [1.6, 45, 3.6, 0.45, 0.15], [2.5, 52, 3.4, 0.50, 0.25], [3.3, 53, 3.8, 0.58, -0.1],
      [4.8, 34, 4.2, 0.56, -0.3], [5.6, 41, 3.5, 0.46, 0.1],  [6.4, 50, 3.5, 0.52, 0.3],  [7.3, 52, 3.2, 0.48, -0.15],
      [8.6, 43, 4.0, 0.54, -0.2], [9.5, 50, 3.4, 0.48, 0.2],  [10.4, 58, 3.4, 0.52, 0.35],
      [11.8, 45, 3.5, 0.55, -0.1], [12.6, 52, 3.0, 0.48, 0.2], [13.2, 61, 2.8, 0.44, 0.3]
    ];
    act1Piano.forEach(([t, m, dur, vel, pan]) => add(t, 'piano', { midi: m, dur, vel, pan }));
    add(0.2, 'wind', { dur: 13.5, amp: 0.16 });

    // =======================================================================
    // ACT II (14..28s): THE BOTTLENECK — Ticking Clock Pulse + Solo Cello
    // =======================================================================
    const clockPattern = [69, 74, 76, 77, 69, 74, 79, 76]; // A4 D5 E5 F5...
    for (let i = 0; i < 54; i++) {
      const t = 14.0 + i * 0.25;
      const m = clockPattern[i % clockPattern.length] - (i > 28 ? 2 : 0);
      add(t, 'pulse', { midi: m, vel: 0.28 + (i / 54) * 0.24, pan: ((i % 4) - 1.5) * 0.32 });
    }
    // Deep bowed solo cello phrases
    add(14.0, 'strings', { midis: [38, 50], dur: 3.6, amp: 0.34, bright: 580 });
    add(17.5, 'strings', { midis: [34, 46, 53], dur: 3.6, amp: 0.38, bright: 680 });
    add(21.0, 'strings', { midis: [43, 50, 58], dur: 3.6, amp: 0.42, bright: 780 });
    add(24.5, 'strings', { midis: [45, 52, 57, 64], dur: 3.5, amp: 0.48, bright: 920 });

    // =======================================================================
    // ACT III (28..43s): HIDDEN GEOMETRY — Time-Freeze Bloom + Latent Arpeggios
    // =======================================================================
    add(28.0, 'subdrop', { amp: 0.78 });
    add(28.05, 'choir', { midis: [41, 48, 55, 57, 64, 71], dur: 5.5, amp: 0.34 }); // Fmaj9#11
    add(33.4,  'choir', { midis: [48, 55, 60, 64, 67, 74], dur: 5.0, amp: 0.38 }); // Cmaj9
    add(38.2,  'choir', { midis: [45, 52, 57, 61, 64, 69], dur: 4.8, amp: 0.44 }); // A major lift!

    const arpChords = [
      [65, 69, 72, 76, 79, 83], // Fmaj9#11
      [60, 64, 67, 71, 74, 79], // Cmaj9
      [57, 61, 64, 69, 73, 76]  // A6/9
    ];
    for (let i = 0; i < 86; i++) {
      const t = 28.6 + i * (14.2 / 86);
      const chordIdx = t < 33.4 ? 0 : (t < 38.2 ? 1 : 2);
      const ch = arpChords[chordIdx];
      const note = ch[i % ch.length] + (i % 12 === 11 ? 12 : 0);
      add(t, 'bell', { midi: note, dur: 1.35, vel: 0.25 + (i / 86) * 0.22, pan: Math.sin(i * 0.9) * 0.65 });
    }

    // =======================================================================
    // ACT IV (43..60s): WHAT CHANGES NOW — Driving Ostinato + Soaring Ensemble
    // =======================================================================
    const act4Prog = [
      { t0: 43.0, dur: 5.8, bass: 26, midis: [38, 50, 57, 60, 64, 69], arp: [50, 57, 62, 65, 69, 72] }, // 4A: Protein Fold (Dm9)
      { t0: 48.8, dur: 5.7, bass: 34, midis: [34, 46, 53, 58, 62, 69], arp: [58, 62, 65, 69, 72, 76] }, // 4B: Stellarator Star (Bbmaj9#11)
      { t0: 54.5, dur: 5.5, bass: 29, midis: [41, 48, 57, 60, 65, 72], arp: [60, 65, 69, 72, 76, 79] }  // 4C: Planetary Tapestry (Fmaj9 -> C)
    ];
    act4Prog.forEach((seg) => {
      add(seg.t0, 'subdrop', { amp: 0.72 });
      add(seg.t0, 'strings', { midis: seg.midis, dur: seg.dur, amp: 0.62, bright: 1850 });
      add(seg.t0, 'choir', { midis: seg.midis.slice(1), dur: seg.dur, amp: 0.36 });
      const steps = Math.floor(seg.dur / 0.18);
      for (let s = 0; s < steps; s++) {
        const ts = seg.t0 + s * 0.18;
        const m = seg.arp[s % seg.arp.length];
        add(ts, 'pulse', { midi: m, vel: 0.42, pan: ((s % 2) ? 0.48 : -0.48) });
        if (s % 4 === 0) {
          add(ts, 'piano', { midi: seg.bass + 12, dur: 0.85, vel: 0.58, pan: 0 });
        }
      }
    });

    // =======================================================================
    // ACT V (60..73s): THE WEIGHT OF THE FIRE — Sudden Hush, Heartbeat & Solo
    // =======================================================================
    add(60.0, 'subdrop', { amp: 0.95 });
    [61.2, 64.4, 67.6, 70.8].forEach((t) => add(t, 'heartbeat', { amp: 0.82 }));
    // High fragile exposed violin harmonic + single quiet felt piano tones
    add(60.6, 'strings', { midis: [69, 81], dur: 4.2, amp: 0.22, bright: 900 });
    add(64.8, 'strings', { midis: [67, 79], dur: 4.0, amp: 0.22, bright: 850 });
    add(68.8, 'strings', { midis: [64, 76], dur: 4.1, amp: 0.26, bright: 950 });

    [
      [61.8, 50, 3.8, 0.42, -0.15],
      [65.4, 46, 3.8, 0.40, 0.20],
      [69.2, 45, 3.8, 0.46, 0.0],
      [71.6, 57, 2.2, 0.42, 0.15]
    ].forEach(([t, m, d, v, p]) => add(t, 'piano', { midi: m, dur: d, vel: v, pan: p }));

    // =======================================================================
    // ACT VI (73..86s): CHAPTER ONE — Radiant D-Major Picardy Sunrise!
    // =======================================================================
    add(73.0, 'subdrop', { amp: 0.88 });
    // D Major Add9 (D2 A2 E3 F#3 A3 D4 F#4 A4 E5)
    add(73.0, 'strings', { midis: [38, 45, 52, 54, 62, 66, 69], dur: 4.5, amp: 0.68, bright: 2100 });
    add(73.0, 'choir',   { midis: [50, 57, 62, 66, 69, 76], dur: 4.6, amp: 0.52 });

    // Gmaj7#11 / D (77.4s)
    add(77.4, 'strings', { midis: [38, 43, 50, 54, 59, 66, 73], dur: 3.8, amp: 0.68, bright: 2200 });
    add(77.4, 'choir',   { midis: [50, 55, 59, 66, 74], dur: 3.8, amp: 0.50 });

    // Final Resolved Dmaj9 Cathedral Hold (81.0..86.0s)
    add(81.0, 'strings', { midis: [26, 38, 45, 54, 57, 62, 66, 76], dur: 5.2, amp: 0.72, bright: 1900 });
    add(81.0, 'choir',   { midis: [50, 57, 62, 66, 74, 78], dur: 5.2, amp: 0.56 });

    // Sparkling dawn felt-piano + bell notes over final sunrise
    [
      [73.1, 62, 3.2, 0.62, -0.3], [73.9, 66, 3.0, 0.56, 0.25], [74.8, 69, 3.0, 0.58, -0.15], [75.8, 76, 3.2, 0.60, 0.35],
      [77.5, 66, 3.0, 0.56, -0.25],[78.5, 71, 3.0, 0.55, 0.25], [79.6, 73, 3.0, 0.56, -0.1],
      [81.1, 62, 4.5, 0.64, -0.2], [81.6, 69, 4.2, 0.58, 0.2],  [82.2, 78, 4.0, 0.62, 0.0]
    ].forEach(([t, m, d, v, p]) => {
      add(t, 'piano', { midi: m, dur: d, vel: v, pan: p });
      add(t + 0.02, 'bell', { midi: m + 12, dur: d * 0.7, vel: v * 0.42, pan: -p });
    });

    ev.sort((a, b) => a.t - b.t);
    this.events = ev;
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();

    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0.0001 : 0.84;

    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -9;
    this.comp.knee.value = 16;
    this.comp.ratio.value = 5;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.22;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

    this.streamDest = this.ctx.createMediaStreamDestination();

    this.dry = this.ctx.createGain();
    this.dry.gain.value = 0.70;

    this.wet = this.ctx.createGain();
    this.wet.gain.value = 0.52;
    this.convolver = this.ctx.createConvolver();
    this.convolver.buffer = this._makeConcertHallIR(3.3, 2.7);

    this.dry.connect(this.master);
    this.wet.connect(this.convolver);
    this.convolver.connect(this.master);

    this.master.connect(this.comp);
    this.comp.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.comp.connect(this.streamDest);

    this.noiseBuf = this._makePinkNoise(3.0);
  }

  _makeConcertHallIR(seconds, decay) {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * seconds);
    const buf = this.ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const ch = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const u = i / len;
        const env = Math.pow(1 - u, decay) * (0.35 + 0.65 * Math.min(1, i / (sr * 0.025)));
        const n = (Math.random() * 2 - 1) * env;
        lp = lp * 0.76 + n * 0.24;
        ch[i] = lp * 0.88;
      }
    }
    return buf;
  }

  _makePinkNoise(seconds) {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * seconds);
    const buf = this.ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + w * 0.099;
      b1 = 0.963 * b1 + w * 0.296;
      b2 = 0.570 * b2 + w * 1.052;
      d[i] = (b0 + b1 + b2 + w * 0.18) * 0.14;
    }
    return buf;
  }

  unlock(unmute = true) {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.unlocked = true;
    this.muted = !unmute;
    this.master.gain.setTargetAtTime(this.muted ? 0.0001 : 0.84, this.ctx.currentTime, 0.06);
  }

  toggleMute() {
    if (!this.unlocked) {
      this.unlock(true);
      return false;
    }
    this.muted = !this.muted;
    if (this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0.0001 : 0.84, this.ctx.currentTime, 0.06);
    }
    return this.muted;
  }

  seek(storyTime) {
    this.lastStoryTime = storyTime;
    this.nextIdx = 0;
    while (this.nextIdx < this.events.length && this.events[this.nextIdx].t < storyTime - 0.02) {
      this.nextIdx++;
    }
  }

  update(storyTime, dt, isPlaying) {
    // Decay visual reactivity envelopes smoothly
    this.envLow = Math.max(0, this.envLow - dt * 1.6);
    this.envMid = Math.max(0, this.envMid - dt * 2.1);
    this.envHigh = Math.max(0, this.envHigh - dt * 3.0);

    if (!isPlaying) return;

    // Detect loop wrap or scrub jump
    if (storyTime < this.lastStoryTime - 0.25 || storyTime > this.lastStoryTime + 1.5) {
      this.seek(storyTime);
    }
    this.lastStoryTime = storyTime;

    const horizon = storyTime + 0.10;
    while (this.nextIdx < this.events.length && this.events[this.nextIdx].t <= horizon) {
      const ev = this.events[this.nextIdx++];
      const delay = Math.max(0, ev.t - storyTime);
      this._triggerEvent(ev, delay);
    }

    // Blend real FFT energy if unmuted
    if (this.ctx && !this.muted && this.analyser) {
      this.analyser.getByteFrequencyData(this.freqData);
      let l = 0, m = 0, h = 0;
      for (let i = 0; i < 8; i++) l += this.freqData[i];
      for (let i = 8; i < 36; i++) m += this.freqData[i];
      for (let i = 36; i < 90; i++) h += this.freqData[i];
      this.envLow = Math.max(this.envLow, (l / (8 * 255)));
      this.envMid = Math.max(this.envMid, (m / (28 * 255)));
      this.envHigh = Math.max(this.envHigh, (h / (54 * 255)));
    }
  }

  _panNode(panVal) {
    if (this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-0.95, Math.min(0.95, panVal || 0));
      return p;
    }
    return this.ctx.createGain();
  }

  _triggerEvent(ev, delaySec) {
    // Always bump analytic visual envelopes so silent playback still dances on beat!
    if (ev.kind === 'heartbeat' || ev.kind === 'subdrop') this.envLow = Math.min(1.2, this.envLow + 0.75);
    if (ev.kind === 'piano' || ev.kind === 'strings' || ev.kind === 'choir') this.envMid = Math.min(1.2, this.envMid + 0.45);
    if (ev.kind === 'pulse' || ev.kind === 'bell') this.envHigh = Math.min(1.2, this.envHigh + 0.42);

    if (!this.ctx || !this.unlocked || this.muted) return;
    const t0 = this.ctx.currentTime + delaySec;

    if (ev.kind === 'piano') {
      const f = midiToHz(ev.midi);
      const pan = this._panNode(ev.pan);
      pan.connect(this.dry);
      pan.connect(this.wet);

      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(f * 5.2, t0);
      lp.frequency.exponentialRampToValueAtTime(Math.max(180, f * 1.35), t0 + ev.dur * 0.75);

      const g = this.ctx.createGain();
      const peak = 0.16 * ev.vel;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(peak, t0 + 0.010);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + ev.dur);

      const o1 = this.ctx.createOscillator();
      o1.type = 'triangle';
      o1.frequency.value = f;

      const o2 = this.ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = f * 2.001;
      const g2 = this.ctx.createGain();
      g2.gain.value = 0.24;

      // Subtle felt-hammer wooden thud transient
      const thud = this.ctx.createBufferSource();
      thud.buffer = this.noiseBuf;
      const tBp = this.ctx.createBiquadFilter();
      tBp.type = 'lowpass';
      tBp.frequency.value = 220;
      const tg = this.ctx.createGain();
      tg.gain.setValueAtTime(0.06 * ev.vel, t0);
      tg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.028);
      thud.connect(tBp); tBp.connect(tg); tg.connect(pan);
      thud.start(t0); thud.stop(t0 + 0.032);

      o1.connect(lp);
      o2.connect(g2); g2.connect(lp);
      lp.connect(g);
      g.connect(pan);
      o1.start(t0); o2.start(t0);
      o1.stop(t0 + ev.dur + 0.05); o2.stop(t0 + ev.dur + 0.05);

    } else if (ev.kind === 'strings') {
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(240, t0);
      lp.frequency.exponentialRampToValueAtTime(ev.bright || 1200, t0 + ev.dur * 0.45);
      lp.frequency.exponentialRampToValueAtTime(320, t0 + ev.dur);

      const env = this.ctx.createGain();
      const perVoice = (0.13 * ev.amp) / Math.max(1, Math.sqrt(ev.midis.length));
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.linearRampToValueAtTime(perVoice, t0 + Math.min(1.1, ev.dur * 0.35));
      env.gain.setValueAtTime(perVoice * 0.88, t0 + ev.dur * 0.7);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + ev.dur + 0.35);

      lp.connect(env);
      env.connect(this.dry);
      env.connect(this.wet);

      ev.midis.forEach((m, idx) => {
        const f = midiToHz(m);
        [-6.5, 6.5].forEach((det) => {
          const o = this.ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = f;
          o.detune.value = det + (idx - 1) * 1.5;
          o.connect(lp);
          o.start(t0);
          o.stop(t0 + ev.dur + 0.4);
        });
      });

    } else if (ev.kind === 'choir') {
      // Two vowel-formant bandpass resonators ("Ahhh" cathedral pad)
      const f1 = this.ctx.createBiquadFilter();
      f1.type = 'bandpass'; f1.frequency.value = 720; f1.Q.value = 2.6;
      const f2 = this.ctx.createBiquadFilter();
      f2.type = 'bandpass'; f2.frequency.value = 1180; f2.Q.value = 3.0;

      const env = this.ctx.createGain();
      const amp = (0.16 * ev.amp) / Math.max(1, Math.sqrt(ev.midis.length));
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.linearRampToValueAtTime(amp, t0 + Math.min(1.4, ev.dur * 0.38));
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + ev.dur + 0.5);

      f1.connect(env);
      f2.connect(env);
      env.connect(this.wet);
      env.connect(this.dry);

      ev.midis.forEach((m) => {
        const freq = midiToHz(m);
        [-5, 5].forEach((det) => {
          const o = this.ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = freq;
          o.detune.value = det;
          o.connect(f1);
          o.connect(f2);
          o.start(t0);
          o.stop(t0 + ev.dur + 0.55);
        });
      });

    } else if (ev.kind === 'pulse') {
      const f = midiToHz(ev.midi);
      const pan = this._panNode(ev.pan);
      pan.connect(this.dry);
      pan.connect(this.wet);

      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(f * 5.0, t0);
      lp.frequency.exponentialRampToValueAtTime(f * 1.2, t0 + 0.16);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.095 * ev.vel, t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24);

      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.connect(lp); lp.connect(g); g.connect(pan);
      o.start(t0); o.stop(t0 + 0.26);

    } else if (ev.kind === 'bell') {
      const f = midiToHz(ev.midi);
      const pan = this._panNode(ev.pan);
      pan.connect(this.wet);
      pan.connect(this.dry);

      [1.0, 2.756].forEach((r, i) => {
        if (f * r > 15000) return;
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f * r;
        const g = this.ctx.createGain();
        const pk = (i === 0 ? 0.065 : 0.022) * ev.vel;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(pk, t0 + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + ev.dur / (i + 1));
        o.connect(g); g.connect(pan);
        o.start(t0); o.stop(t0 + ev.dur + 0.05);
      });

    } else if (ev.kind === 'heartbeat') {
      // Two-stroke organic lub-dub
      [0.0, 0.28].forEach((off, idx) => {
        const ts = t0 + off;
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(idx === 0 ? 68 : 56, ts);
        o.frequency.exponentialRampToValueAtTime(28, ts + 0.22);
        const g = this.ctx.createGain();
        const pk = (idx === 0 ? 0.26 : 0.18) * ev.amp;
        g.gain.setValueAtTime(0.0001, ts);
        g.gain.linearRampToValueAtTime(pk, ts + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, ts + 0.28);
        o.connect(g); g.connect(this.dry); g.connect(this.wet);
        o.start(ts); o.stop(ts + 0.32);
      });

    } else if (ev.kind === 'subdrop') {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(98, t0);
      o.frequency.exponentialRampToValueAtTime(31, t0 + 1.45);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.32 * ev.amp, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.65);
      o.connect(g); g.connect(this.dry);
      o.start(t0); o.stop(t0 + 1.7);

    } else if (ev.kind === 'wind') {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 340;
      bp.Q.value = 1.8;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(ev.amp, t0 + 2.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + ev.dur);
      src.connect(bp); bp.connect(g); g.connect(this.wet);
      src.start(t0); src.stop(t0 + ev.dur + 0.1);
    }
  }

  // Interactive chime when viewer touches inside the story!
  touchSpark(normX = 0, actIdx = 0) {
    this.envHigh = Math.min(1.2, this.envHigh + 0.35);
    if (!this.ctx || !this.unlocked || this.muted) return;
    const scales = [
      [62, 65, 69, 74, 76], // Act I Dm
      [62, 65, 69, 72, 77], // Act II
      [65, 69, 72, 76, 83], // Act III Lydian
      [62, 69, 72, 76, 81], // Act IV
      [69, 74, 76, 81],     // Act V fragile
      [62, 66, 69, 74, 78]  // Act VI D Major!
    ];
    const sc = scales[Math.min(5, Math.max(0, actIdx))];
    const m = sc[Math.floor(Math.random() * sc.length)];
    this._triggerEvent({ kind: 'bell', midi: m, dur: 1.2, vel: 0.36, pan: normX * 0.75 }, 0);
  }
}
