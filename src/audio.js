// Procedural Physical-Modeling WebAudio Synthesizer (Zero External Samples)
class CarbonAudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.unlocked = false;
    this.currentPhase = 0;
    this.lastPluckTime = 0;
    this.lastGrainTime = 0;
    this.lastFusionTime = 0;
    this.lastNoteName = 'D5 LYDIAN';
    this.crushLevel = 0;

    // Scales (Hz)
    this.lydianD = [293.66, 329.63, 369.99, 415.30, 440.00, 493.88, 554.37, 587.33, 659.25, 739.99, 830.61, 880.00, 987.77, 1174.66];
    this.noteNamesD = ['D4','E4','F#4','G#4','A4','B4','C#5','D5','E5','F#5','G#5','A5','B5','D6'];
    this.lydianF = [174.61, 196.00, 220.00, 246.94, 261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25, 587.33, 659.25, 698.46, 783.99];
    this.noteNamesF = ['F3','G3','A3','B3','C4','D4','E4','F4','G4','A4','B4','C5','D5','E5','F5','G5'];
    this.handpanG = [196.00, 220.00, 246.94, 293.66, 329.63, 392.00, 440.00, 493.88, 587.33];
    this.noteNamesG = ['G3','A3','B3','D4','E4','G4','A4','B4','D5'];
    this.bioScale = [523.25, 587.33, 659.25, 783.99, 987.77, 1046.50, 1174.66, 1318.51, 1567.98];
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();

    // Master chain: MasterGain -> Compressor -> Analyser -> Destination
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.78;

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -8;
    this.compressor.knee.value = 14;
    this.compressor.ratio.value = 6;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.18;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.82;
    this.scopeData = new Uint8Array(this.analyser.frequencyBinCount);

    // MediaStream tap for built-in video+audio recorder
    this.streamDest = this.ctx.createMediaStreamDestination();

    // Dry + Algorithmic Velvet-Shimmer Stereo Reverb
    this.dryBus = this.ctx.createGain();
    this.dryBus.gain.value = 0.72;

    this.reverbBus = this.ctx.createGain();
    this.reverbBus.gain.value = 0.42;
    this.convolver = this.ctx.createConvolver();
    this.convolver.buffer = this._buildVelvetImpulse(2.5, 2.8);

    this.dryBus.connect(this.masterGain);
    this.reverbBus.connect(this.convolver);
    this.convolver.connect(this.masterGain);

    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.compressor.connect(this.streamDest);

    // Shared noise buffer for plasma/snap/stellar rumble
    this.noiseBuffer = this._buildNoiseBuffer(2.0);

    // Continuous ambient beds for the 5 phases
    this._setupAmbientBeds();
  }

  _buildVelvetImpulse(duration, decay) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * duration);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const env = Math.pow(1 - t, decay);
        // Sparse velvet reflections + smooth diffuse tail
        const raw = (Math.random() * 2 - 1) * env;
        lp = lp * 0.72 + raw * 0.28;
        data[i] = lp * 0.85;
      }
    }
    return buf;
  }

  _buildNoiseBuffer(seconds) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(1, len, rate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      // Pink-ish filter
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.16;
    }
    return buf;
  }

  _setupAmbientBeds() {
    const now = this.ctx.currentTime;
    this.beds = [];

    // 0: Diamond crystalline fifth shimmer (D4 + A4 + F#5)
    const dGain = this.ctx.createGain();
    dGain.gain.value = 0;
    const dFilter = this.ctx.createBiquadFilter();
    dFilter.type = 'lowpass';
    dFilter.frequency.value = 1400;
    [293.66, 440.0, 739.99].forEach((f, idx) => {
      const o = this.ctx.createOscillator();
      o.type = idx === 2 ? 'sine' : 'triangle';
      o.frequency.value = f;
      o.detune.value = (idx - 1) * 4;
      const g = this.ctx.createGain();
      g.gain.value = idx === 2 ? 0.018 : 0.03;
      o.connect(g);
      g.connect(dFilter);
      o.start(now);
    });
    dFilter.connect(dGain);
    dGain.connect(this.reverbBus);
    dGain.connect(this.dryBus);
    this.diamondFilter = dFilter;
    this.beds.push(dGain);

    // 1: Graphene taut quantum lattice hum (F2 + C3)
    const gGain = this.ctx.createGain();
    gGain.gain.value = 0;
    [87.31, 130.81, 261.63].forEach((f, idx) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.value = idx === 2 ? 0.015 : 0.038;
      o.connect(g);
      g.connect(gGain);
      o.start(now);
    });
    gGain.connect(this.dryBus);
    this.beds.push(gGain);

    // 2: Fullerene hollow geodesic cavity drone (G2 + D3)
    const fGain = this.ctx.createGain();
    fGain.gain.value = 0;
    [98.0, 146.83, 293.66].forEach((f, idx) => {
      const o = this.ctx.createOscillator();
      o.type = idx === 1 ? 'triangle' : 'sine';
      o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.value = 0.028;
      o.connect(g);
      g.connect(fGain);
      o.start(now);
    });
    fGain.connect(this.reverbBus);
    this.beds.push(fGain);

    // 3: Bios breathing generative ambient pad (C3 + G3 + D4 + E4 + B4)
    const bGain = this.ctx.createGain();
    bGain.gain.value = 0;
    const bFilter = this.ctx.createBiquadFilter();
    bFilter.type = 'lowpass';
    bFilter.frequency.value = 620;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.14;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 280;
    lfo.connect(lfoGain);
    lfoGain.connect(bFilter.frequency);
    lfo.start(now);

    [130.81, 196.0, 293.66, 329.63, 493.88].forEach((f, idx) => {
      const o = this.ctx.createOscillator();
      o.type = idx % 2 === 0 ? 'triangle' : 'sine';
      o.frequency.value = f;
      o.detune.value = (idx - 2) * 5.5;
      const g = this.ctx.createGain();
      g.gain.value = 0.024;
      o.connect(g);
      g.connect(bFilter);
      o.start(now);
    });
    bFilter.connect(bGain);
    bGain.connect(this.reverbBus);
    bGain.connect(this.dryBus);
    this.beds.push(bGain);

    // 4: Starforge relativistic core sub-bass + plasma roar
    const sGain = this.ctx.createGain();
    sGain.gain.value = 0;
    const sFilter = this.ctx.createBiquadFilter();
    sFilter.type = 'lowpass';
    sFilter.frequency.value = 135;
    sFilter.Q.value = 2.4;

    this.starSub1 = this.ctx.createOscillator();
    this.starSub1.type = 'sawtooth';
    this.starSub1.frequency.value = 43.65; // F1
    this.starSub2 = this.ctx.createOscillator();
    this.starSub2.type = 'triangle';
    this.starSub2.frequency.value = 65.41; // C2

    const subMix = this.ctx.createGain();
    subMix.gain.value = 0.09;
    this.starSub1.connect(subMix);
    this.starSub2.connect(subMix);

    const plasmaNoise = this.ctx.createBufferSource();
    plasmaNoise.buffer = this.noiseBuffer;
    plasmaNoise.loop = true;
    const nGain = this.ctx.createGain();
    nGain.gain.value = 0.16;
    plasmaNoise.connect(nGain);
    nGain.connect(sFilter);

    subMix.connect(sFilter);
    sFilter.connect(sGain);
    sGain.connect(this.dryBus);
    sGain.connect(this.reverbBus);

    this.starSub1.start(now);
    this.starSub2.start(now);
    plasmaNoise.start(now);
    this.starFilter = sFilter;
    this.beds.push(sGain);
  }

  unlockAndEnable() {
    this.init();
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.unlocked = true;
    this.enabled = true;
    this.masterGain.gain.setTargetAtTime(0.78, this.ctx.currentTime, 0.08);
    this.setPhase(this.currentPhase, true);
    return true;
  }

  toggle() {
    if (!this.unlocked) {
      return this.unlockAndEnable();
    }
    this.enabled = !this.enabled;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.enabled ? 0.78 : 0.0001, now, 0.06);
    if (this.enabled) {
      this.setPhase(this.currentPhase, false);
    }
    return this.enabled;
  }

  setPhase(phaseIdx, playTransition = true) {
    this.currentPhase = phaseIdx;
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    this.beds.forEach((bed, idx) => {
      const target = idx === phaseIdx ? 1.0 : 0.0001;
      bed.gain.setTargetAtTime(target, now, 0.35);
    });
    if (playTransition) {
      this._playTransitionSignature(phaseIdx);
    }
  }

  _panner(panVal) {
    if (this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-0.95, Math.min(0.95, panVal || 0));
      return p;
    }
    const g = this.ctx.createGain();
    return g;
  }

  _playTransitionSignature(phaseIdx) {
    const now = this.ctx.currentTime;
    if (phaseIdx === 0) {
      // Crystalline chord bloom
      this.ringCrystal(0.75, -0.25, 0);
      setTimeout(() => this.ringCrystal(0.65, 0.3, 2), 90);
    } else if (phaseIdx === 1) {
      // Quick harp arpeggio
      [0, 2, 4, 7].forEach((step, i) => {
        setTimeout(() => this.pluckBond(0.3 + i * 0.1, (i - 1.5) * 0.4, step / 10), i * 55);
      });
    } else if (phaseIdx === 2) {
      this.strikeFullerene(0.8, 0, false);
    } else if (phaseIdx === 3) {
      this.bioGrain(-0.3, 0.7);
      setTimeout(() => this.bioGrain(0.35, 0.8), 110);
    } else if (phaseIdx === 4) {
      this.fusionFlash(0, 1.0);
    }
  }

  // Phase 0: Modal Crystal Eigenmode Bell
  ringCrystal(intensity = 0.7, pan = 0, cutIdx = 0) {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    const idx = Math.min(this.lydianD.length - 1, Math.max(0, Math.floor((cutIdx * 2 + Math.random() * 6))));
    const baseFreq = this.lydianD[idx];
    this.lastNoteName = this.noteNamesD[idx] + ' CRYSTAL';

    const panner = this._panner(pan);
    panner.connect(this.dryBus);
    panner.connect(this.reverbBus);

    const ratios = [1.0, 2.756, 5.404, 8.933];
    const amps = [0.15, 0.065, 0.028, 0.012];
    const decays = [1.9, 1.1, 0.65, 0.32];

    ratios.forEach((r, i) => {
      const f = baseFreq * r;
      if (f > 15000) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;

      const g = this.ctx.createGain();
      const peak = amps[i] * Math.min(1.2, Math.max(0.15, intensity));
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(peak, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, now + decays[i]);

      osc.connect(g);
      g.connect(panner);
      osc.start(now);
      osc.stop(now + decays[i] + 0.05);
    });
  }

  updateDiamondMotion(speed) {
    if (!this.ctx || !this.enabled || !this.diamondFilter) return;
    const target = 900 + Math.min(3200, speed * 1800);
    this.diamondFilter.frequency.setTargetAtTime(target, this.ctx.currentTime, 0.08);
  }

  // Phase 1: Polyphonic Acoustic Waveguide Graphene Harp
  pluckBond(strain = 0.3, pan = 0, pitchNorm = 0.5) {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    if (now - this.lastPluckTime < 0.048) return; // Clean glissando rate limit
    this.lastPluckTime = now;

    const idx = Math.min(
      this.lydianF.length - 1,
      Math.max(0, Math.floor(pitchNorm * (this.lydianF.length - 3) + strain * 2.5))
    );
    const freq = this.lydianF[idx] * (1 + Math.min(0.06, strain * 0.02));
    this.lastNoteName = this.noteNamesF[idx] + ' WAVEGUIDE';

    const panner = this._panner(pan);
    panner.connect(this.dryBus);
    panner.connect(this.reverbBus);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 2.2;
    filter.frequency.setValueAtTime(Math.min(7000, freq * 7.5), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(220, freq * 1.4), now + 0.45);

    const env = this.ctx.createGain();
    const vel = Math.min(0.18, 0.07 + strain * 0.08);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(vel, now + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

    const o1 = this.ctx.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.value = freq;

    const o2 = this.ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = freq * 2.0;
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.35;

    o1.connect(filter);
    o2.connect(g2);
    g2.connect(filter);
    filter.connect(env);
    env.connect(panner);

    o1.start(now);
    o2.start(now);
    o1.stop(now + 0.9);
    o2.stop(now + 0.9);
  }

  snapBond(pan = 0) {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    if (now - this.lastPluckTime < 0.035) return;
    this.lastPluckTime = now;
    this.lastNoteName = 'σ-BOND CLEAVE';

    const panner = this._panner(pan);
    panner.connect(this.dryBus);

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2800, now);
    bp.frequency.exponentialRampToValueAtTime(520, now + 0.09);
    bp.Q.value = 3.5;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

    src.connect(bp);
    bp.connect(g);
    g.connect(panner);
    src.start(now);
    src.stop(now + 0.11);
  }

  annealChord() {
    if (!this.ctx || !this.enabled) return;
    this.lastNoteName = 'sp² ANNEAL';
    [261.63, 329.63, 392.00, 493.88, 587.33].forEach((f, i) => {
      setTimeout(() => {
        if (!this.ctx || !this.enabled) return;
        const now = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.08, now + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
        o.connect(g);
        g.connect(this.reverbBus);
        g.connect(this.dryBus);
        o.start(now);
        o.stop(now + 1.15);
      }, i * 45);
    });
  }

  // Phase 2: Geodesic Handpan / Hang-Drum (1 : 2 : 2.997 harmonic ratios)
  strikeFullerene(velocity = 0.7, pan = 0, endohedral = true) {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    if (endohedral && now - this.lastPluckTime < 0.09) return;
    this.lastPluckTime = now;

    const idx = Math.floor(Math.random() * this.handpanG.length);
    const f0 = this.handpanG[idx] * (endohedral ? 1.0 : 0.5);
    this.lastNoteName = this.noteNamesG[idx] + (endohedral ? ' @C60' : ' CAGE');

    const panner = this._panner(pan);
    panner.connect(this.dryBus);
    panner.connect(this.reverbBus);

    [1.0, 2.0, 2.997].forEach((ratio, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = i === 0 ? 'triangle' : 'sine';
      // Characteristic steel handpan pitch envelope
      osc.frequency.setValueAtTime(f0 * ratio * 1.016, now);
      osc.frequency.exponentialRampToValueAtTime(f0 * ratio, now + 0.028);

      const g = this.ctx.createGain();
      const amp = (i === 0 ? 0.14 : i === 1 ? 0.065 : 0.03) * Math.min(1.1, velocity);
      const dec = i === 0 ? 1.25 : 0.75;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(amp, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dec);

      osc.connect(g);
      g.connect(panner);
      osc.start(now);
      osc.stop(now + dec + 0.05);
    });
  }

  // Phase 3: Bioluminescent Chemotaxis Grains
  bioGrain(pan = 0, energy = 0.5) {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    if (now - this.lastGrainTime < 0.075) return;
    this.lastGrainTime = now;

    const f = this.bioScale[Math.floor(Math.random() * this.bioScale.length)];
    this.lastNoteName = 'CHEMOTAXIS ' + Math.round(f) + 'Hz';

    const panner = this._panner(pan);
    panner.connect(this.reverbBus);
    panner.connect(this.dryBus);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f * 0.99, now);
    osc.frequency.exponentialRampToValueAtTime(f * 1.005, now + 0.18);

    const g = this.ctx.createGain();
    const peak = 0.045 * Math.min(1.2, Math.max(0.25, energy));
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(peak, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

    osc.connect(g);
    g.connect(panner);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  // Phase 4: Stellar Core Crush + 7.65 MeV Hoyle Fusion Bell
  setStarCrush(crush01) {
    this.crushLevel = crush01;
    if (!this.ctx || !this.enabled || !this.starFilter) return;
    const now = this.ctx.currentTime;
    this.starFilter.frequency.setTargetAtTime(135 + crush01 * 620, now, 0.06);
    this.starSub1.frequency.setTargetAtTime(43.65 * (1 + crush01 * 0.38), now, 0.06);
    this.starSub2.frequency.setTargetAtTime(65.41 * (1 + crush01 * 0.38), now, 0.06);
  }

  fusionFlash(pan = 0, intensity = 0.8) {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    if (now - this.lastFusionTime < 0.055) return;
    this.lastFusionTime = now;
    this.lastNoteName = '7.65 MeV HOYLE → ¹²C';

    const panner = this._panner(pan);
    panner.connect(this.dryBus);
    panner.connect(this.reverbBus);

    // High gamma harmonic ping + low fusion thump
    const chord = [523.25, 783.99, 1174.66, 1567.98];
    const base = chord[Math.floor(Math.random() * chord.length)];

    [base, base * 1.5].forEach((f, idx) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime((idx === 0 ? 0.09 : 0.04) * intensity, now + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
      o.connect(g);
      g.connect(panner);
      o.start(now);
      o.stop(now + 1.0);
    });

    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(125, now);
    sub.frequency.exponentialRampToValueAtTime(38, now + 0.22);
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.18 * intensity, now);
    sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
    sub.connect(sg);
    sg.connect(panner);
    sub.start(now);
    sub.stop(now + 0.28);
  }

  sampleScope() {
    if (!this.analyser || !this.enabled) return null;
    this.analyser.getByteTimeDomainData(this.scopeData);
    return this.scopeData;
  }
}
