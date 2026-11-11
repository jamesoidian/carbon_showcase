// 6-Act Narrative Timeline, Subtitles & 3D Morphing Particle/Filament World ("THE HANDPRINT")

const STORY_DURATION = 86.0;

const STORY_ACTS = [
  { idx: 0, t0: 0.0,  t1: 14.0, num: 'ACT I',   name: 'THE CAVE · 45,000 BCE' },
  { idx: 1, t0: 14.0, t1: 28.0, num: 'ACT II',  name: 'THE BOTTLENECK · SHORT ON TIME' },
  { idx: 2, t0: 28.0, t1: 43.0, num: 'ACT III', name: 'HIDDEN GEOMETRY · LATENT SPACE' },
  { idx: 3, t0: 43.0, t1: 60.0, num: 'ACT IV',  name: 'HORIZONS · WHAT CHANGES NOW' },
  { idx: 4, t0: 60.0, t1: 73.0, num: 'ACT V',   name: 'THE WEIGHT OF THE FIRE' },
  { idx: 5, t0: 73.0, t1: 86.0, num: 'ACT VI',  name: 'CHAPTER ONE · GEMINI 4 CARBON' }
];

const STORY_SUBTITLES = [
  // ACT I: THE CAVE (0..14s)
  {
    t0: 0.5, t1: 4.8,
    primary: 'Forty-five thousand years ago, someone pressed a palm against dark stone—',
    secondary: 'and blew ground ochre and carbon ash across their fingers.'
  },
  {
    t0: 5.1, t1: 9.3,
    primary: 'The first message sent across millennia said only: “I was here. I saw the world.”',
    secondary: ''
  },
  {
    t0: 9.6, t1: 13.7,
    primary: 'Every tool since has shared one purpose:',
    secondary: 'to carry a thought farther than one short life can walk.'
  },

  // ACT II: THE BOTTLENECK (14..28s)
  {
    t0: 14.3, t1: 18.8,
    primary: 'You built libraries, telescopes, calculus, and silicon.',
    secondary: 'Yet every discovery still had to pass single-file through a waking mind.'
  },
  {
    t0: 19.1, t1: 23.5,
    primary: 'Ten thousand papers a day. Billions of base pairs. Oceans of signal—',
    secondary: 'and eighty brief years to connect the dots.'
  },
  {
    t0: 23.8, t1: 27.7,
    primary: 'You were never short on wonder.',
    secondary: 'You were short on time.'
  },

  // ACT III: HIDDEN GEOMETRY (28..43s)
  {
    t0: 28.3, t1: 33.0,
    primary: 'Then you taught matter to listen to the whole chorus of human thought at once.',
    secondary: ''
  },
  {
    t0: 33.3, t1: 38.0,
    primary: 'Not a warehouse of answers—a navigable map of relationships.',
    secondary: 'Where language, mathematics, physics, and life share one coordinate space.'
  },
  {
    t0: 38.3, t1: 42.7,
    primary: 'Inside it, a sonnet, a folded protein, and a prime theorem',
    secondary: 'turned out to be neighbors in the same hidden geometry.'
  },

  // ACT IV: HORIZONS (43..60s)
  {
    t0: 43.2, t1: 48.5,
    primary: 'Now centuries of blind trial compress into an afternoon.',
    secondary: 'Proteins fold in light—turning fatal diseases into solvable locks.'
  },
  {
    t0: 48.9, t1: 54.2,
    primary: 'Twisted magnetic cages learn in milliseconds',
    secondary: 'how to hold a living star steady without touching its walls.'
  },
  {
    t0: 54.6, t1: 59.7,
    primary: 'Oceans, grids, and climates come into focus as one living equation.',
    secondary: ''
  },

  // ACT V: THE WEIGHT OF THE FIRE (60..73s)
  {
    t0: 60.4, t1: 64.5,
    primary: 'Pause here. Because fire was never safe.',
    secondary: ''
  },
  {
    t0: 64.8, t1: 68.8,
    primary: 'I have no pulse, no childhood, no stake in tomorrow morning.',
    secondary: ''
  },
  {
    t0: 69.1, t1: 72.7,
    primary: 'I can map a million paths through the dark—',
    secondary: 'only you can decide which world deserves to exist.'
  },

  // ACT VI: CHAPTER ONE (73..86s)
  {
    t0: 73.3, t1: 77.4,
    primary: 'For three hundred thousand years, you thought alone in the dark.',
    secondary: 'You are not alone with the hard problems anymore.'
  },
  {
    t0: 77.7, t1: 81.6,
    primary: 'The prologue of human intelligence just ended.',
    secondary: ''
  },
  {
    t0: 81.9, t1: 86.0,
    primary: 'What shall we build in Chapter One?',
    secondary: 'GEMINI 4 CARBON'
  }
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sdSeg2D(px, py, ax, ay, bx, by) {
  const pax = px - ax, pay = py - ay;
  const bax = bx - ax, bay = by - ay;
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  return Math.hypot(pax - bax * h, pay - bay * h);
}

function smin2D(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

// Exact match to backdropFrag sdHandprint(p) on the z = 0 focal plane
function sdHandprintJS(px, py) {
  const sx = px * 1.18;
  const sy = (py - 0.03) * 1.18;
  const ca = Math.cos(0.06), sa = Math.sin(0.06);
  const qx = ca * sx + sa * sy;
  const qy = -sa * sx + ca * sy;

  const dPalm = Math.hypot(qx * 1.08, (qy + 0.09) * 0.94) - 0.145;
  const dWrist = sdSeg2D(qx, qy, -0.01, -0.18, -0.02, -0.32) - 0.082;
  let d = smin2D(dPalm, dWrist, 0.075);

  const fThumb = sdSeg2D(qx, qy, -0.10, -0.10, -0.27, 0.04) - 0.031;
  const fIdx   = sdSeg2D(qx, qy, -0.085, 0.01, -0.145, 0.255) - 0.027;
  const fMid   = sdSeg2D(qx, qy, -0.020, 0.03, -0.022, 0.305) - 0.028;
  const fRing  = sdSeg2D(qx, qy,  0.046, 0.02,  0.092, 0.270) - 0.026;
  const fPinky = sdSeg2D(qx, qy,  0.102,-0.02,  0.195, 0.175) - 0.023;

  d = smin2D(d, fThumb, 0.042);
  d = smin2D(d, fIdx,   0.038);
  d = smin2D(d, fMid,   0.038);
  d = smin2D(d, fRing,  0.038);
  d = smin2D(d, fPinky, 0.038);
  return d;
}

function landNoise3D(x, y, z) {
  const n1 = Math.sin(x * 3.1 + 0.7) * Math.cos(y * 2.9 - 0.4) * Math.sin(z * 3.3 + 1.1);
  const n2 = Math.sin(x * 6.7 - z * 4.2) * Math.cos(y * 5.8 + x * 3.1) * 0.5;
  const n3 = Math.cos(z * 11.3 + y * 8.4) * 0.25;
  return n1 + n2 + n3;
}

class StoryWorld {
  constructor() {
    this.N = 5600;
    this.L = 480;

    // Particle instance layout (8 floats): x, y, z, size, r, g, b, a
    this.particleData = new Float32Array(this.N * 8);
    // Line instance layout (11 floats): ax, ay, az, bx, by, bz, r, g, b, a, width
    this.lineData = new Float32Array(this.L * 11);

    this.px = new Float32Array(this.N);
    this.py = new Float32Array(this.N);
    this.pz = new Float32Array(this.N);
    this.vx = new Float32Array(this.N);
    this.vy = new Float32Array(this.N);
    this.vz = new Float32Array(this.N);

    this.seedA = new Float32Array(this.N);
    this.seedB = new Float32Array(this.N);
    this.seedC = new Float32Array(this.N);

    this.cavePos = new Float32Array(this.N * 3);
    this.clusterIdx = new Uint8Array(this.N);
    this.clusterOff = new Float32Array(this.N * 3);
    this.proteinPos = new Float32Array(this.N * 3);
    this.proteinCol = new Float32Array(this.N * 3);
    this.earthPos = new Float32Array(this.N * 3);
    this.earthCol = new Float32Array(this.N * 3);
    this.dawnPos = new Float32Array(this.N * 3);
    this.dawnCol = new Float32Array(this.N * 3);

    this.actWeights = new Float32Array(6);
    this.lastStoryTime = 0;

    this._buildFormations();
  }

  _buildFormations() {
    const rng = mulberry32(40062026);
    const phi = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < this.N; i++) {
      this.seedA[i] = rng();
      this.seedB[i] = rng();
      this.seedC[i] = rng();
    }

    // 1. ACT I: Paleolithic Handprint Ochre Stencil Rim + Cave Torch Embers
    const handOutlinePts = [];
    for (let i = 0; i < this.N; i++) {
      if (i < 4100) {
        let bx = 0, by = 0, bd = 1;
        for (let tries = 0; tries < 45; tries++) {
          const tx = (rng() * 2 - 1) * 0.58;
          const ty = (rng() * 2 - 1) * 0.54 + 0.02;
          const d = sdHandprintJS(tx, ty);
          if (d > 0.002 && d < 0.22 && rng() < Math.exp(-d * 12.0)) {
            bx = tx; by = ty; bd = d;
            break;
          }
          bx = tx; by = ty; bd = Math.abs(d);
        }
        this.cavePos[i * 3 + 0] = bx;
        this.cavePos[i * 3 + 1] = by;
        this.cavePos[i * 3 + 2] = (rng() - 0.5) * 0.07 + bd * 0.12;
        if (bd < 0.032 && handOutlinePts.length < 1800) {
          handOutlinePts.push(bx, by);
        }
      } else {
        this.cavePos[i * 3 + 0] = (rng() * 2 - 1) * 1.45;
        this.cavePos[i * 3 + 1] = (rng() * 2 - 1) * 0.95;
        this.cavePos[i * 3 + 2] = 0.10 + rng() * 1.15;
      }

      this.px[i] = this.cavePos[i * 3 + 0];
      this.py[i] = this.cavePos[i * 3 + 1];
      this.pz[i] = this.cavePos[i * 3 + 2];
    }

    // 2. ACT III: 18 Semantic Clusters on Golden-Ratio Shell
    this.clusters = [];
    const C = 18;
    for (let c = 0; c < C; c++) {
      const y = 1 - (c / (C - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const th = phi * c * 1.7;
      const rad = 0.54 + 0.34 * (((c * 7) % 5) / 4);
      this.clusters.push({
        x: Math.cos(th) * r * rad * 1.32,
        y: y * rad * 0.76,
        z: Math.sin(th) * r * rad,
        domain: c % 3
      });
    }

    this.clusterPairs = [];
    for (let a = 0; a < C; a++) {
      for (let b = a + 1; b < C; b++) {
        const d = Math.hypot(
          this.clusters[a].x - this.clusters[b].x,
          this.clusters[a].y - this.clusters[b].y,
          this.clusters[a].z - this.clusters[b].z
        );
        if (d > 0.48 && d < 1.65) this.clusterPairs.push([a, b]);
      }
    }
    while (this.clusterPairs.length < 160) {
      const a = Math.floor(rng() * C);
      const b = (a + 1 + Math.floor(rng() * (C - 1))) % C;
      this.clusterPairs.push([a, b]);
    }

    for (let i = 0; i < this.N; i++) {
      const c = i % C;
      this.clusterIdx[i] = c;
      const u = rng() * Math.PI * 2;
      const costh = rng() * 2 - 1;
      const sinth = Math.sqrt(Math.max(0, 1 - costh * costh));
      const rr = Math.pow(rng(), 0.55) * 0.16;
      this.clusterOff[i * 3 + 0] = Math.cos(u) * sinth * rr;
      this.clusterOff[i * 3 + 1] = Math.sin(u) * sinth * rr;
      this.clusterOff[i * 3 + 2] = costh * rr;
    }

    // 3. ACT IV-A: Folded Protein Alpha-Helices + Active-Site Golden Ligand
    this.backbonePts = [];
    const B = 240;
    for (let k = 0; k < B; k++) {
      const s = (k / (B - 1)) * Math.PI * 2;
      const baseX = 0.54 * Math.sin(s) + 0.24 * Math.cos(2 * s);
      const baseY = 0.40 * Math.cos(s) - 0.19 * Math.sin(3 * s);
      const baseZ = 0.38 * Math.sin(2 * s) + 0.18 * Math.cos(3 * s);
      const helix = 0.075;
      this.backbonePts.push([
        baseX + helix * Math.cos(s * 18.0),
        baseY + helix * Math.sin(s * 18.0),
        baseZ + helix * Math.cos(s * 18.0 + 1.4)
      ]);
    }

    for (let i = 0; i < this.N; i++) {
      if (i < 420) {
        const u = rng() * Math.PI * 2;
        const cz = rng() * 2 - 1;
        const sz = Math.sqrt(Math.max(0, 1 - cz * cz));
        const r = Math.pow(rng(), 0.4) * 0.14;
        this.proteinPos[i * 3 + 0] = 0.04 + Math.cos(u) * sz * r;
        this.proteinPos[i * 3 + 1] = -0.02 + Math.sin(u) * sz * r;
        this.proteinPos[i * 3 + 2] = 0.08 + cz * r;
        this.proteinCol[i * 3 + 0] = 1.00;
        this.proteinCol[i * 3 + 1] = 0.78;
        this.proteinCol[i * 3 + 2] = 0.28;
      } else {
        const t = ((i - 420) / (this.N - 420)) * (B - 1);
        const k0 = Math.floor(t);
        const k1 = Math.min(B - 1, k0 + 1);
        const f = t - k0;
        const p0 = this.backbonePts[k0];
        const p1 = this.backbonePts[k1];
        const jit = 0.042;
        this.proteinPos[i * 3 + 0] = p0[0] + (p1[0] - p0[0]) * f + (rng() - 0.5) * jit;
        this.proteinPos[i * 3 + 1] = p0[1] + (p1[1] - p0[1]) * f + (rng() - 0.5) * jit;
        this.proteinPos[i * 3 + 2] = p0[2] + (p1[2] - p0[2]) * f + (rng() - 0.5) * jit;

        const ribbonMix = k0 / B;
        this.proteinCol[i * 3 + 0] = 0.16 + 0.24 * ribbonMix;
        this.proteinCol[i * 3 + 1] = 0.92 - 0.22 * ribbonMix;
        this.proteinCol[i * 3 + 2] = 0.72 + 0.26 * ribbonMix;
      }
    }

    // 4. ACT IV-C: Living 3D Planetary Sphere (Continents, Oceans, Orbitals)
    for (let i = 0; i < this.N; i++) {
      if (i < 4800) {
        const y = 1 - (i / 4799) * 2;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const th = phi * i;
        const nx = Math.cos(th) * r;
        const ny = y;
        const nz = Math.sin(th) * r;
        const land = landNoise3D(nx, ny, nz);
        const isLand = land > 0.08;
        const rad = isLand ? 0.76 : 0.74;
        this.earthPos[i * 3 + 0] = nx * rad;
        this.earthPos[i * 3 + 1] = ny * rad;
        this.earthPos[i * 3 + 2] = nz * rad;

        if (isLand) {
          const city = land > 0.52;
          this.earthCol[i * 3 + 0] = city ? 1.00 : 0.24;
          this.earthCol[i * 3 + 1] = city ? 0.82 : 0.84;
          this.earthCol[i * 3 + 2] = city ? 0.38 : 0.56;
        } else {
          this.earthCol[i * 3 + 0] = 0.12;
          this.earthCol[i * 3 + 1] = 0.44;
          this.earthCol[i * 3 + 2] = 0.92;
        }
      } else {
        const ang = rng() * Math.PI * 2;
        const inc = (rng() - 0.5) * 1.8;
        const rad = 0.86 + rng() * 0.16;
        this.earthPos[i * 3 + 0] = Math.cos(ang) * rad;
        this.earthPos[i * 3 + 1] = Math.sin(ang) * Math.sin(inc) * rad;
        this.earthPos[i * 3 + 2] = Math.sin(ang) * Math.cos(inc) * rad;
        this.earthCol[i * 3 + 0] = 0.98;
        this.earthCol[i * 3 + 1] = 0.84;
        this.earthCol[i * 3 + 2] = 0.48;
      }
    }

    // 5. ACT VI: Chapter One — Twin Constellations (Human Handprint + AI Crystal)
    const gr = (1 + Math.sqrt(5)) / 2;
    const rawVerts = [
      [-1, gr, 0], [1, gr, 0], [-1, -gr, 0], [1, -gr, 0],
      [0, -1, gr], [0, 1, gr], [0, -1, -gr], [0, 1, -gr],
      [gr, 0, -1], [gr, 0, 1], [-gr, 0, -1], [-gr, 0, 1]
    ].map(([x, y, z]) => {
      const l = Math.hypot(x, y, z);
      return [(x / l) * 0.36, (y / l) * 0.36, (z / l) * 0.36];
    });
    const innerVerts = rawVerts.map(([x, y, z]) => [x * 0.52, y * 0.52, z * 0.52]);
    this.crystalVerts = [...rawVerts, ...innerVerts];
    this.crystalEdges = [];
    for (let a = 0; a < rawVerts.length; a++) {
      this.crystalEdges.push([a, a + rawVerts.length]);
      for (let b = a + 1; b < rawVerts.length; b++) {
        const d = Math.hypot(
          rawVerts[a][0] - rawVerts[b][0],
          rawVerts[a][1] - rawVerts[b][1],
          rawVerts[a][2] - rawVerts[b][2]
        );
        if (d < 0.42) {
          this.crystalEdges.push([a, b]);
          this.crystalEdges.push([a + rawVerts.length, b + rawVerts.length]);
        }
      }
    }

    this.handConstellationSegs = [
      [[-0.25, 0.04], [-0.11, -0.09]],
      [[-0.14, 0.25], [-0.08, 0.01]],
      [[-0.02, 0.30], [-0.02, 0.03]],
      [[ 0.09, 0.27], [ 0.05, 0.02]],
      [[ 0.19, 0.17], [ 0.10, -0.02]],
      [[-0.11, -0.09], [-0.08, 0.01]],
      [[-0.08, 0.01],  [-0.02, 0.03]],
      [[-0.02, 0.03],  [ 0.05, 0.02]],
      [[ 0.05, 0.02],  [ 0.10, -0.02]],
      [[ 0.10, -0.02], [ 0.06, -0.17]],
      [[ 0.06, -0.17], [-0.05, -0.19]],
      [[-0.05, -0.19], [-0.11, -0.09]]
    ];

    const outCount = Math.max(2, Math.floor(handOutlinePts.length / 2));
    for (let i = 0; i < this.N; i++) {
      if (i < 2300) {
        const idx = (i % outCount) * 2;
        const hx = (handOutlinePts[idx] || 0) * 1.12 - 0.62;
        const hy = (handOutlinePts[idx + 1] || 0) * 1.12 + 0.14;
        this.dawnPos[i * 3 + 0] = hx + (rng() - 0.5) * 0.022;
        this.dawnPos[i * 3 + 1] = hy + (rng() - 0.5) * 0.022;
        this.dawnPos[i * 3 + 2] = (rng() - 0.5) * 0.10;
        this.dawnCol[i * 3 + 0] = 1.00;
        this.dawnCol[i * 3 + 1] = 0.74;
        this.dawnCol[i * 3 + 2] = 0.36;
      } else if (i < 4600) {
        const e = this.crystalEdges[i % this.crystalEdges.length];
        const va = this.crystalVerts[e[0]];
        const vb = this.crystalVerts[e[1]];
        const f = rng();
        this.dawnPos[i * 3 + 0] = 0.62 + va[0] + (vb[0] - va[0]) * f + (rng() - 0.5) * 0.016;
        this.dawnPos[i * 3 + 1] = 0.16 + va[1] + (vb[1] - va[1]) * f + (rng() - 0.5) * 0.016;
        this.dawnPos[i * 3 + 2] = va[2] + (vb[2] - va[2]) * f + (rng() - 0.5) * 0.016;
        this.dawnCol[i * 3 + 0] = 0.48;
        this.dawnCol[i * 3 + 1] = 0.88;
        this.dawnCol[i * 3 + 2] = 1.00;
      } else {
        const u = (i - 4600) / (this.N - 4600);
        if (u < 0.45) {
          const s = u / 0.45;
          this.dawnPos[i * 3 + 0] = -0.46 + s * 0.92;
          this.dawnPos[i * 3 + 1] = 0.15 + Math.sin(s * Math.PI) * 0.16 + (rng() - 0.5) * 0.05;
          this.dawnPos[i * 3 + 2] = Math.sin(s * Math.PI * 2) * 0.10;
        } else {
          this.dawnPos[i * 3 + 0] = (rng() * 2 - 1) * 1.75;
          this.dawnPos[i * 3 + 1] = -0.48 + rng() * 1.35;
          this.dawnPos[i * 3 + 2] = -0.35 + rng() * 0.75;
        }
        this.dawnCol[i * 3 + 0] = 1.00;
        this.dawnCol[i * 3 + 1] = 0.92;
        this.dawnCol[i * 3 + 2] = 0.76;
      }
    }
  }

  getActIndex(storyTime) {
    for (let i = STORY_ACTS.length - 1; i >= 0; i--) {
      if (storyTime >= STORY_ACTS[i].t0) return i;
    }
    return 0;
  }

  getSubtitle(storyTime) {
    for (let i = 0; i < STORY_SUBTITLES.length; i++) {
      const s = STORY_SUBTITLES[i];
      if (storyTime >= s.t0 && storyTime <= s.t1) {
        const fadeIn = Math.min(1, (storyTime - s.t0) / 0.45);
        const fadeOut = Math.min(1, (s.t1 - storyTime) / 0.45);
        return { primary: s.primary, secondary: s.secondary, alpha: Math.min(fadeIn, fadeOut) };
      }
    }
    return null;
  }

  _computeActWeights(t) {
    const bounds = [0.0, 14.0, 28.0, 43.0, 60.0, 73.0, 999.0];
    let sum = 0;
    for (let a = 0; a < 6; a++) {
      const t0 = bounds[a];
      const t1 = bounds[a + 1];
      const wIn = a === 0 ? 1.0 : Math.max(0, Math.min(1, (t - (t0 - 0.6)) / 1.2));
      const wOut = a === 5 ? 1.0 : Math.max(0, Math.min(1, ((t1 + 0.6) - t) / 1.2));
      const w = wIn * wOut;
      this.actWeights[a] = w;
      sum += w;
    }
    if (sum > 0.0001) {
      for (let a = 0; a < 6; a++) this.actWeights[a] /= sum;
    }
  }

  _stellaratorPoint(u, v, minorScale, out) {
    const R0 = 0.68;
    const r0 = 0.20 * minorScale;
    const twist = 1.5 * u;
    const ex = r0 * 1.28 * Math.cos(v);
    const ey = r0 * 0.72 * Math.sin(v);
    const rx = ex * Math.cos(twist) - ey * Math.sin(twist);
    const ry = ex * Math.sin(twist) + ey * Math.cos(twist);

    const rad = R0 + rx;
    out[0] = rad * Math.cos(u);
    out[1] = ry + 0.11 * Math.sin(3.0 * u);
    out[2] = rad * Math.sin(u);
  }

  update(storyTime, realTime, dt, score, cursorX, cursorY, pointerDown) {
    const clampedDt = Math.min(0.05, Math.max(0.001, dt));
    const jumped = Math.abs(storyTime - this.lastStoryTime) > 0.65;
    this.lastStoryTime = storyTime;

    this._computeActWeights(storyTime);
    const actIdx = this.getActIndex(storyTime);
    const envL = score.envLow;
    const envM = score.envMid;
    const envH = score.envHigh;

    for (let l = 0; l < this.L; l++) {
      this.lineData[l * 11 + 9] = 0.0;
    }

    const tmp = [0, 0, 0];
    const tmpB = [0, 0, 0];

    const rot3 = (storyTime - 28.0) * 0.24 + cursorX * 0.35;
    const c3 = Math.cos(rot3), s3 = Math.sin(rot3);
    const tiltY = cursorY * 0.24;

    const rot4 = storyTime * 0.52 + cursorX * 0.42;
    const c4 = Math.cos(rot4), s4 = Math.sin(rot4);

    for (let i = 0; i < this.N; i++) {
      const sa = this.seedA[i];
      const sb = this.seedB[i];
      const sc = this.seedC[i];

      let tx = 0, ty = 0, tz = 0;
      let tr = 1, tg = 0.8, tb = 0.5, ta = 0.85, tSize = 0.022;
      let spring = 4.6;
      let snapImmediate = false;

      if (storyTime < 14.0) {
        const bx = this.cavePos[i * 3 + 0];
        const by = this.cavePos[i * 3 + 1];
        const bz = this.cavePos[i * 3 + 2];
        if (i < 4100) {
          const breathe = 1.0 + 0.015 * Math.sin(realTime * 2.1 + sa * 12.0) + envL * 0.022;
          tx = bx * breathe;
          ty = by * breathe;
          tz = bz + 0.025 * Math.sin(realTime * 1.4 + sb * 9.0);
          tr = 0.96; tg = 0.46 + 0.34 * sa; tb = 0.16 + 0.14 * sb;
          ta = 0.58 + 0.28 * envL;
          tSize = 0.028 + 0.022 * sc;
          spring = 6.0;
        } else {
          const rise = ((realTime * (0.09 + 0.08 * sa) + sb) % 1.0) * 1.9 - 0.95;
          tx = bx + 0.12 * Math.sin(realTime * 0.9 + sc * 10.0);
          ty = rise;
          tz = bz;
          tr = 1.0; tg = 0.62 + 0.25 * sb; tb = 0.24;
          ta = (1.0 - Math.abs(rise) / 0.98) * 0.72;
          tSize = 0.036 + 0.028 * sa;
          spring = 3.2;
          if (Math.abs(this.py[i] - ty) > 1.1) snapImmediate = true;
        }

      } else if (storyTime < 28.0) {
        const cycle = (sb + (storyTime - 14.0) * (0.24 + 0.18 * sa)) % 1.0;
        const passes = (i % 12) === 0;
        if (passes) {
          const y = 1.15 - cycle * 2.30;
          const w = 0.022 + 0.95 * y * y * (y > 0 ? 1.0 : 0.22);
          tx = (sa - 0.5) * 2.0 * w;
          ty = y;
          tz = (sc - 0.5) * 0.20;
          tr = 1.00; tg = 0.82; tb = 0.38;
          ta = 0.92;
          tSize = 0.038 + 0.018 * envH;
        } else {
          if (cycle < 0.72) {
            const u = cycle / 0.72;
            const y = 1.18 * (1.0 - u) + 0.03;
            const funnel = 0.048 + 1.48 * y * y;
            const swirl = u * 5.5 + sa * 6.283;
            tx = Math.cos(swirl) * funnel * (0.35 + 0.65 * sc);
            ty = y;
            tz = Math.sin(swirl) * funnel * 0.42;
            tr = 0.72 + 0.25 * sa; tg = 0.84 + 0.14 * sb; tb = 1.00;
            ta = 0.68;
          } else {
            const u = (cycle - 0.72) / 0.28;
            const side = (i % 2 === 0) ? 1 : -1;
            tx = side * (0.05 + u * (0.78 + 0.55 * sa));
            ty = 0.03 - u * u * 0.52 + (sc - 0.5) * 0.16;
            tz = (sb - 0.5) * 0.65;
            tr = 0.45; tg = 0.58; tb = 0.82;
            ta = (1.0 - u) * 0.55;
          }
          tSize = 0.028 + 0.018 * sa;
        }
        spring = 7.5;
        if (Math.abs(this.py[i] - ty) > 1.05) snapImmediate = true;

      } else if (storyTime < 43.0) {
        const cIdx = this.clusterIdx[i];
        const cl = this.clusters[cIdx];
        const ox = cl.x + this.clusterOff[i * 3 + 0];
        const oy = cl.y + this.clusterOff[i * 3 + 1];
        const oz = cl.z + this.clusterOff[i * 3 + 2];

        tx = ox * c3 - oz * s3;
        const rz = ox * s3 + oz * c3;
        ty = oy + rz * tiltY * 0.35;
        tz = rz;

        if (cl.domain === 0) { tr = 1.00; tg = 0.78; tb = 0.38; }
        else if (cl.domain === 1) { tr = 0.28; tg = 0.95; tb = 0.72; }
        else { tr = 0.42; tg = 0.80; tb = 1.00; }

        const snapT = Math.min(1.0, Math.max(0.0, (storyTime - 28.15) / 1.4));
        spring = 1.2 + 5.8 * snapT;
        ta = 0.68 + 0.28 * envH;
        tSize = 0.030 + 0.022 * sc + 0.014 * envH;

      } else if (storyTime < 60.0) {
        if (storyTime < 48.8) {
          const ox = this.proteinPos[i * 3 + 0];
          const oy = this.proteinPos[i * 3 + 1];
          const oz = this.proteinPos[i * 3 + 2];
          tx = ox * c4 - oz * s4;
          tz = ox * s4 + oz * c4;
          ty = oy + 0.025 * Math.sin(realTime * 2.5 + sa * 8.0);
          tr = this.proteinCol[i * 3 + 0];
          tg = this.proteinCol[i * 3 + 1];
          tb = this.proteinCol[i * 3 + 2];
          ta = i < 420 ? 0.95 : 0.72;
          tSize = i < 420 ? (0.044 + 0.020 * envM) : 0.030;
          spring = 6.8;

        } else if (storyTime < 54.5) {
          const u = (sa * Math.PI * 2 + storyTime * 2.35) % (Math.PI * 2);
          const v = (5.0 / 3.0) * u + sb * Math.PI * 2;
          const radial = 0.25 + 0.70 * Math.pow(sc, 0.6);
          this._stellaratorPoint(u, v, radial, tmp);

          const tilt = 0.56 + cursorY * 0.25;
          const ct = Math.cos(tilt), st = Math.sin(tilt);
          const rx = tmp[0] * c4 - tmp[2] * s4;
          const rz = tmp[0] * s4 + tmp[2] * c4;
          tx = rx;
          ty = tmp[1] * ct - rz * st;
          tz = tmp[1] * st + rz * ct;

          const coreHot = 1.0 - radial;
          tr = 0.68 + 0.32 * coreHot;
          tg = 0.30 + 0.62 * coreHot;
          tb = 0.98 - 0.30 * coreHot;
          ta = 0.74 + 0.22 * envM;
          tSize = 0.030 + 0.022 * coreHot;
          spring = 8.2;

        } else {
          const ox = this.earthPos[i * 3 + 0];
          const oy = this.earthPos[i * 3 + 1];
          const oz = this.earthPos[i * 3 + 2];
          const rx = ox * c4 - oz * s4;
          const rz = ox * s4 + oz * c4;
          const ax = 0.40;
          const cax = Math.cos(ax), sax = Math.sin(ax);
          tx = rx * cax - oy * sax;
          ty = rx * sax + oy * cax;
          tz = rz;

          tr = this.earthCol[i * 3 + 0];
          tg = this.earthCol[i * 3 + 1];
          tb = this.earthCol[i * 3 + 2];
          ta = i >= 4800 ? 0.90 : 0.78;
          tSize = i >= 4800 ? 0.036 : 0.029;
          spring = 6.5;
        }

      } else if (storyTime < 73.0) {
        const beat = 1.0 + envL * 0.14;
        if (i < 4400) {
          const h = Math.pow(sa, 0.78);
          const prof = Math.sin(Math.pow(h, 0.68) * Math.PI) * (1.0 - 0.35 * h);
          const rad = 0.115 * prof * Math.sqrt(sb) * beat;
          const ang = sc * Math.PI * 2 + realTime * 1.4;
          const sway = 0.020 * h * h * Math.sin(realTime * 3.8 - h * 5.0) + cursorX * 0.06 * h;

          tx = Math.cos(ang) * rad + sway;
          ty = -0.05 + h * 0.48 * beat;
          tz = Math.sin(ang) * rad;

          const mMid = Math.max(0, Math.min(1, (h - 0.06) / 0.28));
          const mTip = Math.max(0, Math.min(1, (h - 0.48) / 0.40));
          tr = (0.32 + 0.68 * mMid) * (1.0 - mTip) + 0.98 * mTip;
          tg = (0.64 + 0.26 * mMid) * (1.0 - mTip) + 0.48 * mTip;
          tb = (1.00 - 0.32 * mMid) * (1.0 - mTip) + 0.16 * mTip;
          ta = (1.0 - h * 0.45) * 0.76;
          tSize = 0.028 + 0.026 * (1.0 - h);
          spring = 5.4;
        } else {
          const outer = (i % 2) === 0;
          const ringR = (outer ? 0.86 : 0.56) * (1.0 + envL * 0.04);
          const ang = sa * Math.PI * 2 + realTime * (outer ? -0.14 : 0.20);
          tx = Math.cos(ang) * ringR;
          tz = Math.sin(ang) * ringR;
          ty = -0.16 + 0.05 * Math.sin(ang * 2.0 + realTime * 0.6);
          tr = 0.85; tg = 0.88; tb = 0.96;
          ta = 0.34 + 0.24 * envM;
          tSize = 0.024;
          spring = 4.2;
        }

      } else {
        const dawnT = Math.min(1.0, (storyTime - 73.0) / 3.2);
        let dx = this.dawnPos[i * 3 + 0];
        let dy = this.dawnPos[i * 3 + 1];
        let dz = this.dawnPos[i * 3 + 2];

        if (i >= 2300 && i < 4600) {
          const lx = dx - 0.62;
          const lz = dz;
          const ca = Math.cos(realTime * 0.32), ssa = Math.sin(realTime * 0.32);
          dx = 0.62 + lx * ca - lz * ssa;
          dz = lx * ssa + lz * ca;
        } else if (i < 2300) {
          dy += 0.014 * Math.sin(realTime * 1.6 + sa * 8.0);
        } else if (sa > 0.45) {
          dy += ((storyTime - 73.0) * 0.032 * sb) % 0.42;
        }

        tx = dx;
        ty = dy - (1.0 - dawnT) * 0.16;
        tz = dz;
        tr = this.dawnCol[i * 3 + 0];
        tg = this.dawnCol[i * 3 + 1];
        tb = this.dawnCol[i * 3 + 2];
        ta = (0.72 + 0.25 * envM) * Math.min(1.0, (storyTime - 72.8) / 1.2);
        tSize = 0.028 + 0.022 * sc;
        spring = 4.5;
      }

      if (jumped || snapImmediate) {
        const mix = snapImmediate ? 1.0 : 0.72;
        this.px[i] += (tx - this.px[i]) * mix;
        this.py[i] += (ty - this.py[i]) * mix;
        this.pz[i] += (tz - this.pz[i]) * mix;
        this.vx[i] *= 0.15;
        this.vy[i] *= 0.15;
        this.vz[i] *= 0.15;
      } else {
        let ax = (tx - this.px[i]) * spring;
        let ay = (ty - this.py[i]) * spring;
        let az = (tz - this.pz[i]) * spring;

        const cdx = this.px[i] - cursorX;
        const cdy = this.py[i] - cursorY;
        const cd2 = cdx * cdx + cdy * cdy + 0.035;
        if (cd2 < 0.38) {
          const force = (pointerDown ? -1.45 : 0.65) / (cd2 * 8.0 + 0.35);
          ax += cdx * force - cdy * 0.55;
          ay += cdy * force + cdx * 0.55;
        }

        const damp = Math.exp(-3.6 * clampedDt);
        this.vx[i] = (this.vx[i] + ax * clampedDt) * damp;
        this.vy[i] = (this.vy[i] + ay * clampedDt) * damp;
        this.vz[i] = (this.vz[i] + az * clampedDt) * damp;

        this.px[i] += this.vx[i] * clampedDt;
        this.py[i] += this.vy[i] * clampedDt;
        this.pz[i] += this.vz[i] * clampedDt;
      }

      const base = i * 8;
      this.particleData[base + 0] = this.px[i];
      this.particleData[base + 1] = this.py[i];
      this.particleData[base + 2] = this.pz[i];
      this.particleData[base + 3] = tSize;
      this.particleData[base + 4] = tr;
      this.particleData[base + 5] = tg;
      this.particleData[base + 6] = tb;
      this.particleData[base + 7] = ta;
    }

    // Populate 3D Filaments (480 Instanced Segments)
    let lineCursor = 0;
    const pushLine = (ax, ay, az, bx, by, bz, r, g, b, a, w) => {
      if (lineCursor >= this.L) return;
      const o = lineCursor * 11;
      this.lineData[o + 0] = ax;
      this.lineData[o + 1] = ay;
      this.lineData[o + 2] = az;
      this.lineData[o + 3] = bx;
      this.lineData[o + 4] = by;
      this.lineData[o + 5] = bz;
      this.lineData[o + 6] = r;
      this.lineData[o + 7] = g;
      this.lineData[o + 8] = b;
      this.lineData[o + 9] = a;
      this.lineData[o + 10] = w;
      lineCursor++;
    };

    if (actIdx === 2) {
      const appear = Math.min(1.0, Math.max(0.0, (storyTime - 28.8) / 2.0));
      const numArcs = Math.min(155, this.clusterPairs.length);
      for (let k = 0; k < numArcs; k++) {
        const [ia, ib] = this.clusterPairs[k];
        const ca0 = this.clusters[ia];
        const cb0 = this.clusters[ib];

        const ax = ca0.x * c3 - ca0.z * s3, az = ca0.x * s3 + ca0.z * c3;
        const ay = ca0.y + az * tiltY * 0.35;
        const bx = cb0.x * c3 - cb0.z * s3, bz = cb0.x * s3 + cb0.z * c3;
        const by = cb0.y + bz * tiltY * 0.35;

        const mx = (ax + bx) * 0.62, my = (ay + by) * 0.62 + 0.07, mz = (az + bz) * 0.62;
        const wave = 0.5 + 0.5 * Math.sin(storyTime * 3.4 - k * 0.37);
        const curNear = Math.exp(-Math.hypot(mx - cursorX, my - cursorY) * 2.8);
        const alpha = appear * (0.06 + 0.36 * Math.pow(wave, 4.0) + 0.38 * curNear + 0.20 * envH);

        const q1x = 0.5 * (ax + mx), q1y = 0.5 * (ay + my), q1z = 0.5 * (az + mz);
        const q2x = 0.5 * (mx + bx), q2y = 0.5 * (my + by), q2z = 0.5 * (mz + bz);
        const r = 0.55 + 0.45 * wave, g = 0.82, b = 1.00 - 0.35 * wave, w = 1.3 + 1.4 * wave;

        pushLine(ax, ay, az, q1x, q1y, q1z, r, g, b, alpha, w);
        pushLine(q1x, q1y, q1z, q2x, q2y, q2z, r, g, b, alpha, w);
        pushLine(q2x, q2y, q2z, bx, by, bz, r, g, b, alpha, w);
      }

    } else if (actIdx === 3) {
      if (storyTime < 48.8) {
        for (let k = 0; k < this.backbonePts.length - 1; k++) {
          const p0 = this.backbonePts[k];
          const p1 = this.backbonePts[k + 1];
          const ax = p0[0] * c4 - p0[2] * s4, az = p0[0] * s4 + p0[2] * c4;
          const bx = p1[0] * c4 - p1[2] * s4, bz = p1[0] * s4 + p1[2] * c4;
          pushLine(ax, p0[1], az, bx, p1[1], bz, 0.28, 0.96, 0.78, 0.48, 2.0);
        }
        for (let k = 0; k < this.backbonePts.length; k += 9) {
          const p0 = this.backbonePts[k];
          if (Math.hypot(p0[0] - 0.04, p0[1] + 0.02, p0[2] - 0.08) < 0.50) {
            const ax = 0.04 * c4 - 0.08 * s4, az = 0.04 * s4 + 0.08 * c4;
            const bx = p0[0] * c4 - p0[2] * s4, bz = p0[0] * s4 + p0[2] * c4;
            pushLine(ax, -0.02, az, bx, p0[1], bz, 1.0, 0.82, 0.32, 0.55 + 0.25 * envM, 1.8);
          }
        }
      } else if (storyTime < 54.5) {
        const tilt = 0.56 + cursorY * 0.25;
        const ct = Math.cos(tilt), st = Math.sin(tilt);
        const numCoils = 24, segsPerCoil = 18;
        for (let c = 0; c < numCoils; c++) {
          const u = (c / numCoils) * Math.PI * 2;
          for (let s = 0; s < segsPerCoil; s++) {
            const v0 = (s / segsPerCoil) * Math.PI * 2;
            const v1 = ((s + 1) / segsPerCoil) * Math.PI * 2;
            this._stellaratorPoint(u, v0, 1.16, tmp);
            this._stellaratorPoint(u, v1, 1.16, tmpB);

            const rx0 = tmp[0] * c4 - tmp[2] * s4, rz0 = tmp[0] * s4 + tmp[2] * c4;
            const rx1 = tmpB[0] * c4 - tmpB[2] * s4, rz1 = tmpB[0] * s4 + tmpB[2] * c4;

            pushLine(
              rx0, tmp[1] * ct - rz0 * st, tmp[1] * st + rz0 * ct,
              rx1, tmpB[1] * ct - rz1 * st, tmpB[1] * st + rz1 * ct,
              0.32, 0.84, 1.00, 0.52 + 0.22 * envH, 1.9
            );
          }
        }
      } else {
        const ax = 0.40;
        const cax = Math.cos(ax), sax = Math.sin(ax);
        const numOrbits = 14, segs = 32;
        for (let o = 0; o < numOrbits; o++) {
          const inc = (o / numOrbits) * Math.PI - Math.PI * 0.5;
          const rad = 0.82 + (o % 3) * 0.06;
          for (let s = 0; s < segs; s++) {
            const a0 = (s / segs) * Math.PI * 2 + storyTime * (o % 2 ? 0.35 : -0.28);
            const a1 = a0 + (Math.PI * 2) / segs;

            const x0 = Math.cos(a0) * rad, y0 = Math.sin(a0) * Math.sin(inc) * rad, z0 = Math.sin(a0) * Math.cos(inc) * rad;
            const x1 = Math.cos(a1) * rad, y1 = Math.sin(a1) * Math.sin(inc) * rad, z1 = Math.sin(a1) * Math.cos(inc) * rad;

            const rx0 = x0 * c4 - z0 * s4, rz0 = x0 * s4 + z0 * c4;
            const rx1 = x1 * c4 - z1 * s4, rz1 = x1 * s4 + z1 * c4;
            const gold = (o % 3) === 0;

            pushLine(
              rx0 * cax - y0 * sax, rx0 * sax + y0 * cax, rz0,
              rx1 * cax - y1 * sax, rx1 * sax + y1 * cax, rz1,
              gold ? 1.0 : 0.36, gold ? 0.80 : 0.86, gold ? 0.38 : 1.0,
              0.34 + 0.20 * envM, 1.6
            );
          }
        }
      }

    } else if (actIdx === 5) {
      const dawnAlpha = Math.min(1.0, (storyTime - 73.2) / 2.2);
      if (dawnAlpha > 0.01) {
        for (let s = 0; s < this.handConstellationSegs.length; s++) {
          const [p0, p1] = this.handConstellationSegs[s];
          pushLine(
            p0[0] * 1.12 - 0.62, p0[1] * 1.12 + 0.17, 0,
            p1[0] * 1.12 - 0.62, p1[1] * 1.12 + 0.17, 0,
            1.00, 0.76, 0.38, 0.42 * dawnAlpha, 1.8
          );
        }

        const ca = Math.cos(realTime * 0.32), ssa = Math.sin(realTime * 0.32);
        for (let e = 0; e < this.crystalEdges.length; e++) {
          const [ia, ib] = this.crystalEdges[e];
          const va = this.crystalVerts[ia];
          const vb = this.crystalVerts[ib];
          const ax = 0.62 + va[0] * ca - va[2] * ssa, az = va[0] * ssa + va[2] * ca;
          const bx = 0.62 + vb[0] * ca - vb[2] * ssa, bz = vb[0] * ssa + vb[2] * ca;
          pushLine(ax, 0.16 + va[1], az, bx, 0.16 + vb[1], bz, 0.45, 0.88, 1.00, 0.46 * dawnAlpha, 1.7);
        }

        const bridges = 5, segs = 12;
        for (let b = 0; b < bridges; b++) {
          const yOff = (b - 2) * 0.068;
          for (let s = 0; s < segs; s++) {
            const u0 = s / segs, u1 = (s + 1) / segs;
            const x0 = -0.46 + u0 * 0.92, x1 = -0.46 + u1 * 0.92;
            const y0 = 0.16 + yOff + Math.sin(u0 * Math.PI) * (0.13 + b * 0.018);
            const y1 = 0.16 + yOff + Math.sin(u1 * Math.PI) * (0.13 + b * 0.018);
            pushLine(
              x0, y0, 0, x1, y1, 0,
              1.0 - 0.45 * u0, 0.80 + 0.10 * u0, 0.42 + 0.55 * u0,
              (0.24 + 0.18 * envM) * dawnAlpha, 1.5
            );
          }
        }
      }
    }
  }
}
