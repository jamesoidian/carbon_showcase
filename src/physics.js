// Multi-Scale Carbon Physics, Crystallography & Nuclear Reaction Engines

const Vec3 = {
  norm(x, y, z) {
    const l = Math.hypot(x, y, z) || 1;
    return [x / l, y / l, z / l];
  },
  dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  },
  cross(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  }
};

function makePerspectiveProjView(aspect, camPos, target, fovDeg = 42) {
  const f = 1.0 / Math.tan((fovDeg * Math.PI) / 360);
  const nf = 1 / (0.1 - 40.0);
  const P = [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (40.0 + 0.1) * nf, -1,
    0, 0, (2 * 40.0 * 0.1) * nf, 0
  ];

  const zAxis = Vec3.norm(camPos[0] - target[0], camPos[1] - target[1], camPos[2] - target[2]);
  const xAxis = Vec3.norm(...Vec3.cross([0, 1, 0], zAxis));
  const yAxis = Vec3.cross(zAxis, xAxis);

  const V = [
    xAxis[0], yAxis[0], zAxis[0], 0,
    xAxis[1], yAxis[1], zAxis[1], 0,
    xAxis[2], yAxis[2], zAxis[2], 0,
    -Vec3.dot(xAxis, camPos), -Vec3.dot(yAxis, camPos), -Vec3.dot(zAxis, camPos), 1
  ];

  // Column-major P * V
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += P[k * 4 + row] * V[col * 4 + k];
      }
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

function projectToNDC(pv, x, y, z) {
  const cx = pv[0] * x + pv[4] * y + pv[8] * z + pv[12];
  const cy = pv[1] * x + pv[5] * y + pv[9] * z + pv[13];
  const cw = pv[3] * x + pv[7] * y + pv[11] * z + pv[15];
  if (cw <= 0.05) return null;
  return [cx / cw, cy / cw, cw];
}

// ============================================================================
// 1. DIAMOND 32-PLANE CONVEX CRYSTALLOGRAPHY + CPU CAUSTIC BUNDLE TRACER
// ============================================================================
class DiamondOpticsSim {
  constructor() {
    this.cutNames = ['BRILLIANT', 'OCTAHEDRON', 'EMERALD', 'GEODESIC'];
    this.cuts = [
      this._makeBrilliant(),
      this._makeOctahedron(),
      this._makeEmerald(),
      this._makeGeodesic()
    ];
    this.cutIndex = 0;
    this.currentPlanes = this.cuts[0].map(p => p.slice());
    this.planeUniforms = new Float32Array(32 * 4);

    this.yaw = 0.45;
    this.pitch = 0.24;
    this.velYaw = 0.38;
    this.velPitch = 0.0;

    this.lightAzimuth = 0.62;
    this.lightElev = 0.78;
    this.dispersion = 1.35;
    this.ringPulse = 0.0;

    this.rotMat = new Float32Array(9);
    this.rotInv = new Float32Array(9);

    this.maxSplats = 360;
    this.splatPosSize = new Float32Array(this.maxSplats * 4);
    this.splatColor = new Float32Array(this.maxSplats * 3);
    this.activeSplats = 0;
  }

  _sortPlanes(planes) {
    return planes.slice().sort((a, b) => (a[1] - b[1]) || (Math.atan2(a[2], a[0]) - Math.atan2(b[2], b[0])));
  }

  _makeBrilliant() {
    const p = [];
    p.push([0, 1, 0, 0.56]);
    p.push([0, -1, 0, 0.92]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      p.push([...Vec3.norm(Math.cos(a) * Math.sin(0.60), Math.cos(0.60), Math.sin(a) * Math.sin(0.60)), 0.78]);
    }
    for (let i = 0; i < 6; i++) {
      const a = ((i + 0.5) / 6) * Math.PI * 2;
      p.push([...Vec3.norm(Math.cos(a) * Math.sin(0.42), Math.cos(0.42), Math.sin(a) * Math.sin(0.42)), 0.71]);
    }
    for (let i = 0; i < 8; i++) {
      const a = ((i + 0.25) / 8) * Math.PI * 2;
      p.push([...Vec3.norm(Math.cos(a) * Math.sin(0.715), -Math.cos(0.715), Math.sin(a) * Math.sin(0.715)), 0.70]);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      p.push([Math.cos(a), 0, Math.sin(a), 0.98]);
    }
    return this._sortPlanes(p);
  }

  _makeOctahedron() {
    const p = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      p.push([...Vec3.norm(sx, sy * 0.92, sz), 0.78]);
    }
    for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
      p.push([...Vec3.norm(s1, s2, 0), 0.96]);
      p.push([...Vec3.norm(s1, 0, s2), 0.98]);
      p.push([...Vec3.norm(0, s1, s2), 0.96]);
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      p.push([...Vec3.norm(Math.cos(a), i % 2 === 0 ? 0.35 : -0.35, Math.sin(a)), 1.15]);
    }
    return this._sortPlanes(p);
  }

  _makeEmerald() {
    const p = [];
    p.push([0, 1, 0, 0.52]);
    p.push([0, -1, 0, 0.82]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const dx = Math.cos(a) / 1.18;
      const dz = Math.sin(a) / 0.88;
      const k = (i % 2 === 1) ? 0.95 : 1.0;
      p.push([...Vec3.norm(dx * 0.55, 0.83, dz * 0.55), 0.68 * k]);
      p.push([...Vec3.norm(dx * 0.82, 0.57, dz * 0.82), 0.80 * k]);
      p.push([...Vec3.norm(dx * 0.78, -0.62, dz * 0.78), 0.74 * k]);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      p.push([...Vec3.norm(Math.cos(a), -0.85, Math.sin(a) * 0.8), 0.78]);
    }
    return this._sortPlanes(p);
  }

  _makeGeodesic() {
    const phi = (1 + Math.sqrt(5)) / 2;
    const p = [];
    for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
      p.push([...Vec3.norm(0, s1, s2 * phi), 0.82]);
      p.push([...Vec3.norm(s1, s2 * phi, 0), 0.82]);
      p.push([...Vec3.norm(s2 * phi, 0, s1), 0.82]);
    }
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      p.push([...Vec3.norm(sx, sy, sz), 0.85]);
    }
    for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
      p.push([...Vec3.norm(0, s1 / phi, s2 * phi), 0.85]);
      p.push([...Vec3.norm(s1 / phi, s2 * phi, 0), 0.85]);
      p.push([...Vec3.norm(s2 * phi, 0, s1 / phi), 0.85]);
    }
    return this._sortPlanes(p);
  }

  setCut(idx) {
    this.cutIndex = ((idx % 4) + 4) % 4;
    this.ringPulse = 0.75;
  }

  strike() {
    this.ringPulse = 1.0;
    this.velYaw += (Math.random() > 0.5 ? 1 : -1) * 0.9;
  }

  getLightDir() {
    const ce = Math.cos(this.lightElev);
    return Vec3.norm(Math.sin(this.lightAzimuth) * ce, Math.sin(this.lightElev), Math.cos(this.lightAzimuth) * ce);
  }

  update(dt, isDragging) {
    if (!isDragging) {
      this.yaw += this.velYaw * dt;
      this.pitch += this.velPitch * dt;
      // Gentle cruise rotation so caustics dance even hands-free
      this.velYaw = this.velYaw * Math.pow(0.28, dt) + 0.34 * (1 - Math.pow(0.28, dt));
      this.velPitch = this.velPitch * Math.pow(0.15, dt);
      this.pitch = Math.max(-0.85, Math.min(0.85, this.pitch));
    }

    this.ringPulse = Math.max(0, this.ringPulse - dt * 1.45);

    // Morph currentPlanes smoothly toward target cut
    const target = this.cuts[this.cutIndex];
    const blend = 1 - Math.pow(0.0015, dt);
    for (let i = 0; i < 32; i++) {
      const c = this.currentPlanes[i];
      const tg = target[i];
      const nx = c[0] + (tg[0] - c[0]) * blend;
      const ny = c[1] + (tg[1] - c[1]) * blend;
      const nz = c[2] + (tg[2] - c[2]) * blend;
      const nn = Vec3.norm(nx, ny, nz);
      c[0] = nn[0]; c[1] = nn[1]; c[2] = nn[2];
      c[3] = c[3] + (tg[3] - c[3]) * blend;

      this.planeUniforms[i * 4 + 0] = c[0];
      this.planeUniforms[i * 4 + 1] = c[1];
      this.planeUniforms[i * 4 + 2] = c[2];
      this.planeUniforms[i * 4 + 3] = c[3];
    }

    // Build column-major 3x3 rotation matrix Ry(yaw) * Rx(pitch)
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);

    // Columns of R
    const r00 = cy,       r10 = 0,   r20 = -sy;
    const r01 = sy * sp,  r11 = cp,  r21 = cy * sp;
    const r02 = sy * cp,  r12 = -sp, r22 = cy * cp;

    this.rotMat.set([r00, r10, r20, r01, r11, r21, r02, r12, r22]);
    this.rotInv.set([r00, r01, r02, r10, r11, r12, r20, r21, r22]);

    this._traceCaustics();
  }

  _mulRot(m, v) {
    return [
      m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
      m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
      m[2] * v[0] + m[5] * v[1] + m[8] * v[2]
    ];
  }

  _refract(I, N, eta) {
    const cosi = -(I[0] * N[0] + I[1] * N[1] + I[2] * N[2]);
    const k = 1.0 - eta * eta * (1.0 - cosi * cosi);
    if (k < 0.0) return null;
    const s = eta * cosi - Math.sqrt(k);
    return Vec3.norm(eta * I[0] + s * N[0], eta * I[1] + s * N[1], eta * I[2] + s * N[2]);
  }

  _reflect(I, N) {
    const d = 2.0 * (I[0] * N[0] + I[1] * N[1] + I[2] * N[2]);
    return [I[0] - d * N[0], I[1] - d * N[1], I[2] - d * N[2]];
  }

  _traceCaustics() {
    const lightW = this.getLightDir();
    const baseDirW = [-lightW[0], -lightW[1], -lightW[2]];
    const rightW = Vec3.norm(...Vec3.cross(baseDirW, [0, 1, 0]));
    const upW = Vec3.cross(rightW, baseDirW);

    const bands = [
      { ior: 2.417 - 0.045 * this.dispersion, col: [0.36, 0.07, 0.01] },
      { ior: 2.417,                            col: [0.04, 0.30, 0.14] },
      { ior: 2.417 + 0.045 * this.dispersion, col: [0.10, 0.12, 0.40] }
    ];

    let count = 0;
    const grid = 13;
    for (let gx = 0; gx < grid; gx++) {
      for (let gy = 0; gy < grid; gy++) {
        const ox = ((gx + 0.5) / grid - 0.5) * 1.55;
        const oy = ((gy + 0.5) / grid - 0.5) * 1.55;
        // Focused studio spotlight cone entering the crystal from above/side
        const rayDirW = Vec3.norm(
          baseDirW[0] + rightW[0] * ox * 0.28 + upW[0] * oy * 0.28,
          baseDirW[1] + rightW[1] * ox * 0.28 + upW[1] * oy * 0.28 - 0.22,
          baseDirW[2] + rightW[2] * ox * 0.28 + upW[2] * oy * 0.28
        );
        const rdC = this._mulRot(this.rotInv, rayDirW);

        const roW = [
          -rayDirW[0] * 3.0 + rightW[0] * ox * 0.72 + upW[0] * oy * 0.72,
          -rayDirW[1] * 3.0 + rightW[1] * ox * 0.72 + upW[1] * oy * 0.72,
          -rayDirW[2] * 3.0 + rightW[2] * ox * 0.72 + upW[2] * oy * 0.72
        ];
        const roC = this._mulRot(this.rotInv, roW);

        let tNear = -1e9, tFar = 1e9, nNear = null;
        let hit = true;
        for (let i = 0; i < 32; i++) {
          const pl = this.currentPlanes[i];
          const den = pl[0] * rdC[0] + pl[1] * rdC[1] + pl[2] * rdC[2];
          const dst = pl[3] - (pl[0] * roC[0] + pl[1] * roC[1] + pl[2] * roC[2]);
          if (Math.abs(den) < 1e-6) {
            if (dst < 0) { hit = false; break; }
          } else {
            const t = dst / den;
            if (den < 0) { if (t > tNear) { tNear = t; nNear = pl; } }
            else { if (t < tFar) tFar = t; }
            if (tNear > tFar) { hit = false; break; }
          }
        }
        if (!hit || !nNear || tNear < 0) continue;

        const entryC = [roC[0] + rdC[0] * tNear, roC[1] + rdC[1] * tNear, roC[2] + rdC[2] * tNear];

        for (let b = 0; b < 3; b++) {
          if (count >= this.maxSplats) break;
          const ior = bands[b].ior;
          let dirC = this._refract(rdC, nNear, 1.0 / ior);
          if (!dirC) continue;
          let pC = [entryC[0] + dirC[0] * 0.001, entryC[1] + dirC[1] * 0.001, entryC[2] + dirC[2] * 0.001];

          let exitedW = null, exitPosW = null;
          for (let bounce = 0; bounce < 5; bounce++) {
            let tEx = 1e9, nEx = null;
            for (let i = 0; i < 32; i++) {
              const pl = this.currentPlanes[i];
              const den = pl[0] * dirC[0] + pl[1] * dirC[1] + pl[2] * dirC[2];
              if (den > 1e-5) {
                const t = (pl[3] - (pl[0] * pC[0] + pl[1] * pC[1] + pl[2] * pC[2])) / den;
                if (t < tEx) { tEx = t; nEx = pl; }
              }
            }
            if (!nEx) break;
            pC = [pC[0] + dirC[0] * tEx, pC[1] + dirC[1] * tEx, pC[2] + dirC[2] * tEx];
            const negN = [-nEx[0], -nEx[1], -nEx[2]];
            const outC = this._refract(dirC, negN, ior);
            if (outC) {
              const outW = this._mulRot(this.rotMat, outC);
              if (outW[1] < -0.10) {
                exitedW = outW;
                exitPosW = this._mulRot(this.rotMat, pC);
                break;
              }
            }
            dirC = this._reflect(dirC, negN);
            pC = [pC[0] + dirC[0] * 0.001, pC[1] + dirC[1] * 0.001, pC[2] + dirC[2] * 0.001];
          }

          if (exitedW && exitPosW) {
            const tFloor = (-1.16 - exitPosW[1]) / exitedW[1];
            if (tFloor > 0 && tFloor < 10.5) {
              const fx = exitPosW[0] + exitedW[0] * tFloor;
              const fz = exitPosW[2] + exitedW[2] * tFloor;
              const u = fx * 0.155 + 0.5;
              const v = fz * 0.155 + 0.5;
              if (u > 0.02 && u < 0.98 && v > 0.02 && v < 0.98) {
                const ang = Math.atan2(exitedW[2], exitedW[0]);
                const spread = 0.026 + tFloor * 0.009;
                this.splatPosSize[count * 4 + 0] = u;
                this.splatPosSize[count * 4 + 1] = v;
                this.splatPosSize[count * 4 + 2] = spread;
                this.splatPosSize[count * 4 + 3] = ang;

                this.splatColor[count * 3 + 0] = bands[b].col[0];
                this.splatColor[count * 3 + 1] = bands[b].col[1];
                this.splatColor[count * 3 + 2] = bands[b].col[2];
                count++;
              }
            }
          }
        }
      }
    }
    this.activeSplats = count;
  }
}

// ============================================================================
// 2. GRAPHENE sp² HEXAGONAL MONOLAYER — VERLET + LASER CLEAVE + SELF-HEALING
// ============================================================================
class GrapheneSim {
  constructor() {
    this.tool = 'pluck'; // 'pluck' | 'laser' | 'heal'
    this.camYaw = 0.0;
    this.camPitch = 0.52;
    this.buildLattice();
  }

  buildLattice() {
    this.atoms = [];
    this.bonds = [];
    const rows = 15;
    const cols = 13;
    const a = 0.25; // C-C bond length in world units
    const dx = a * Math.sqrt(3);
    const dy = a * 1.5;

    const grid = new Map();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        for (let sub = 0; sub < 2; sub++) {
          const x = (c - (cols - 1) * 0.5 + (r % 2) * 0.5) * dx;
          const z = (r - (rows - 1) * 0.5) * dy + (sub === 1 ? a * 0.5 : -a * 0.5);
          if (Math.abs(x) > 2.65 || Math.abs(z) > 2.35) continue;
          const pinned = (Math.abs(x) > 2.28 || Math.abs(z) > 2.02);
          const idx = this.atoms.length;
          this.atoms.push({
            x, y: 0, z,
            vx: 0, vy: 0, vz: 0,
            rx: x, rz: z,
            pinned,
            heat: 0,
            deg: 0
          });
          grid.set(`${r},${c},${sub}`, idx);
        }
      }
    }

    // Connect nearest honeycomb neighbors (~a distance)
    this.r0 = a;
    for (let i = 0; i < this.atoms.length; i++) {
      for (let j = i + 1; j < this.atoms.length; j++) {
        const dist = Math.hypot(
          this.atoms[i].x - this.atoms[j].x,
          this.atoms[i].z - this.atoms[j].z
        );
        if (dist > a * 0.7 && dist < a * 1.32) {
          this.bonds.push({
            i, j,
            r0: dist,
            active: true,
            strain: 0,
            pulse: 0
          });
          this.atoms[i].deg++;
          this.atoms[j].deg++;
        }
      }
    }

    this.atomPosBuf = new Float32Array(this.atoms.length * 3);
    this.atomMetaBuf = new Float32Array(this.atoms.length * 4);
    this.bondP0Buf = new Float32Array((this.bonds.length + 128) * 3);
    this.bondP1Buf = new Float32Array((this.bonds.length + 128) * 3);
    this.bondMetaBuf = new Float32Array((this.bonds.length + 128) * 4);
    this.activeBondCount = this.bonds.length;
  }

  triggerRipple(cx = 0, cz = 0, amp = 0.36) {
    for (const at of this.atoms) {
      if (at.pinned) continue;
      const d = Math.hypot(at.x - cx, at.z - cz);
      const w = Math.exp(-d * d * 2.2);
      at.vy += amp * w;
      at.heat = Math.min(1.0, at.heat + w * 0.7);
    }
    for (const b of this.bonds) {
      if (!b.active) continue;
      const mx = 0.5 * (this.atoms[b.i].x + this.atoms[b.j].x);
      const mz = 0.5 * (this.atoms[b.i].z + this.atoms[b.j].z);
      if (Math.hypot(mx - cx, mz - cz) < 0.7) b.pulse = 1.0;
    }
  }

  annealAll(audio) {
    let healed = 0;
    // Recompute degrees
    for (const at of this.atoms) at.deg = 0;
    for (const b of this.bonds) {
      if (b.active) {
        this.atoms[b.i].deg++;
        this.atoms[b.j].deg++;
      }
    }
    // Restore broken original bonds first if atoms are reasonably close
    for (const b of this.bonds) {
      if (!b.active) {
        const ai = this.atoms[b.i], aj = this.atoms[b.j];
        const d = Math.hypot(ai.x - aj.x, ai.y - aj.y, ai.z - aj.z);
        if (d < this.r0 * 2.4 && ai.deg < 3 && aj.deg < 3) {
          b.active = true;
          b.pulse = 1.0;
          ai.deg++; aj.deg++;
          ai.heat = 0.9; aj.heat = 0.9;
          healed++;
        }
      }
    }
    // Pull atoms gently toward crystal equilibrium
    for (const at of this.atoms) {
      if (!at.pinned) {
        at.vx += (at.rx - at.x) * 3.0;
        at.vz += (at.rz - at.z) * 3.0;
      }
    }
    if (healed > 0 && audio) audio.annealChord();
    return healed;
  }

  interactScreen(ndcX, ndcY, prevNdcX, prevNdcY, pv, audio, forceTool = null) {
    const mode = forceTool || this.tool;
    if (mode === 'heal') {
      this.annealAll(audio);
      return;
    }

    // Project atoms once
    const proj = this.atoms.map(a => projectToNDC(pv, a.x, a.y, a.z));

    if (mode === 'laser') {
      // Sever covalent bonds intersected by laser stroke
      let snapped = 0;
      for (const b of this.bonds) {
        if (!b.active) continue;
        const p0 = proj[b.i], p1 = proj[b.j];
        if (!p0 || !p1) continue;
        const mx = 0.5 * (p0[0] + p1[0]);
        const my = 0.5 * (p0[1] + p1[1]);
        if (Math.hypot(mx - ndcX, my - ndcY) < 0.055) {
          b.active = false;
          const ai = this.atoms[b.i], aj = this.atoms[b.j];
          ai.deg = Math.max(0, ai.deg - 1);
          aj.deg = Math.max(0, aj.deg - 1);
          ai.heat = 1.0; aj.heat = 1.0;
          // Elastic recoil!
          const dx = ai.x - aj.x, dz = ai.z - aj.z;
          const l = Math.hypot(dx, dz) || 1;
          if (!ai.pinned) { ai.vx += (dx / l) * 0.9; ai.vy += (Math.random() - 0.5) * 0.8; }
          if (!aj.pinned) { aj.vx -= (dx / l) * 0.9; aj.vy += (Math.random() - 0.5) * 0.8; }
          snapped++;
        }
      }
      if (snapped > 0 && audio) audio.snapBond(ndcX);
      return;
    }

    // Default: Pluck covalent waveguide harp!
    const vxScreen = ndcX - prevNdcX;
    const vyScreen = ndcY - prevNdcY;
    let bestBond = null, bestDist = 0.095;

    for (let i = 0; i < this.atoms.length; i++) {
      const p = proj[i];
      if (!p || this.atoms[i].pinned) continue;
      const d = Math.hypot(p[0] - ndcX, p[1] - ndcY);
      if (d < 0.14) {
        const w = 1.0 - d / 0.14;
        this.atoms[i].vy += (0.22 + Math.hypot(vxScreen, vyScreen) * 3.2) * w * (vyScreen >= 0 ? 1 : -1);
        this.atoms[i].vx += vxScreen * 2.2 * w;
        this.atoms[i].heat = Math.min(1.0, this.atoms[i].heat + w * 0.45);
      }
    }

    for (const b of this.bonds) {
      if (!b.active) continue;
      const p0 = proj[b.i], p1 = proj[b.j];
      if (!p0 || !p1) continue;
      const mx = 0.5 * (p0[0] + p1[0]);
      const my = 0.5 * (p0[1] + p1[1]);
      const d = Math.hypot(mx - ndcX, my - ndcY);
      if (d < bestDist) {
        bestDist = d;
        bestBond = b;
      }
    }

    if (bestBond) {
      bestBond.pulse = 1.0;
      if (audio) {
        audio.pluckBond(bestBond.strain, ndcX, (ndcY + 1) * 0.5);
      }
    }
  }

  getProjView(aspect) {
    const r = 4.65;
    const cx = Math.sin(this.camYaw) * Math.cos(this.camPitch) * r;
    const cy = Math.sin(this.camPitch) * r;
    const cz = Math.cos(this.camYaw) * Math.cos(this.camPitch) * r;
    return makePerspectiveProjView(aspect, [cx, cy, cz], [0, -0.05, 0], 42);
  }

  update(dt, time, audio) {
    const subSteps = 3;
    const h = Math.min(0.022, dt) / subSteps;
    const kSpring = 210.0;
    const kPlanar = 4.2;

    for (let step = 0; step < subSteps; step++) {
      for (const b of this.bonds) {
        if (!b.active) continue;
        const ai = this.atoms[b.i];
        const aj = this.atoms[b.j];
        const dx = aj.x - ai.x;
        const dy = aj.y - ai.y;
        const dz = aj.z - ai.z;
        const dist = Math.hypot(dx, dy, dz) || 1e-5;
        const diff = dist - b.r0;
        b.strain = Math.abs(diff) / b.r0;

        // Extreme tear threshold under violent pull
        if (b.strain > 0.95) {
          b.active = false;
          ai.heat = 1.0; aj.heat = 1.0;
          if (audio) audio.snapBond(0);
          continue;
        }

        const f = (kSpring * diff) / dist;
        const fx = dx * f, fy = dy * f, fz = dz * f;
        if (!ai.pinned) { ai.vx += fx * h; ai.vy += fy * h; ai.vz += fz * h; }
        if (!aj.pinned) { aj.vx -= fx * h; aj.vy -= fy * h; aj.vz -= fz * h; }
      }

      for (const at of this.atoms) {
        if (at.pinned) {
          // Subtle ambient quantum zero-point undulation along boundary
          at.y = Math.sin(at.x * 2.2 + time * 1.9) * Math.cos(at.z * 2.0 - time * 1.4) * 0.045;
          continue;
        }
        // Soft out-of-plane drumhead restoration + viscous damping
        at.vy += (-kPlanar * at.y) * h;
        const damp = Math.pow(0.24, h);
        at.vx *= damp; at.vy *= damp; at.vz *= damp;
        at.x += at.vx * h;
        at.y += at.vy * h;
        at.z += at.vz * h;
      }
    }

    // Pack GPU instance buffers
    for (let i = 0; i < this.atoms.length; i++) {
      const at = this.atoms[i];
      at.heat = Math.max(0, at.heat - dt * 1.2);
      this.atomPosBuf[i * 3 + 0] = at.x;
      this.atomPosBuf[i * 3 + 1] = at.y;
      this.atomPosBuf[i * 3 + 2] = at.z;

      this.atomMetaBuf[i * 4 + 0] = 0.048;
      this.atomMetaBuf[i * 4 + 1] = Math.min(1.0, at.heat + (at.deg < 3 && !at.pinned ? 0.55 : 0.0));
      this.atomMetaBuf[i * 4 + 2] = 0;
      this.atomMetaBuf[i * 4 + 3] = 1.0;
    }

    let bOut = 0;
    for (let i = 0; i < this.bonds.length; i++) {
      const b = this.bonds[i];
      if (!b.active) continue;
      b.pulse = Math.max(0, b.pulse - dt * 2.2);
      const ai = this.atoms[b.i], aj = this.atoms[b.j];
      this.bondP0Buf[bOut * 3 + 0] = ai.x;
      this.bondP0Buf[bOut * 3 + 1] = ai.y;
      this.bondP0Buf[bOut * 3 + 2] = ai.z;

      this.bondP1Buf[bOut * 3 + 0] = aj.x;
      this.bondP1Buf[bOut * 3 + 1] = aj.y;
      this.bondP1Buf[bOut * 3 + 2] = aj.z;

      this.bondMetaBuf[bOut * 4 + 0] = b.strain;
      this.bondMetaBuf[bOut * 4 + 1] = 1.0;
      this.bondMetaBuf[bOut * 4 + 2] = 0.019;
      this.bondMetaBuf[bOut * 4 + 3] = b.pulse;
      bOut++;
    }
    this.activeBondCount = bOut;
  }
}

// ============================================================================
// 3. FULLERENE C60 GEODESIC CAGE + ENDOHEDRAL @La ION + (6,6) NANOTUBE
// ============================================================================
class FullereneSim {
  constructor() {
    this.subMode = 'c60'; // 'c60' | 'tube'
    this.rotYaw = 0.3;
    this.rotPitch = 0.2;
    this.velYaw = 0.52;
    this.velPitch = 0.14;
    this.buildC60();
  }

  setSubMode(mode) {
    this.subMode = mode;
    if (mode === 'c60') this.buildC60();
    else this.buildNanotube();
  }

  buildC60() {
    const phi = (1 + Math.sqrt(5)) / 2;
    const raw = [];
    const addEvenPerms = (a, b, c) => {
      for (const [x, y, z] of [[a, b, c], [b, c, a], [c, a, b]]) {
        for (const vx of (x === 0 ? [0] : [-x, x])) {
          for (const vy of (y === 0 ? [0] : [-y, y])) {
            for (const vz of (z === 0 ? [0] : [-z, z])) {
              raw.push([vx, vy, vz]);
            }
          }
        }
      }
    };
    addEvenPerms(0, 1, 3 * phi);
    addEvenPerms(1, 2 + phi, 2 * phi);
    addEvenPerms(phi, 2, 2 * phi + 1);

    const scale = 0.255; // Cage radius ~ 1.26 world units
    this.atoms = raw.map(([x, y, z]) => ({
      x: x * scale, y: y * scale, z: z * scale,
      rx: x * scale, ry: y * scale, rz: z * scale,
      vx: 0, vy: 0, vz: 0,
      heat: 0
    }));

    const adj = Array.from({ length: 60 }, () => []);
    const edges = [];
    for (let i = 0; i < 60; i++) {
      for (let j = i + 1; j < 60; j++) {
        const dRaw = Math.hypot(raw[i][0] - raw[j][0], raw[i][1] - raw[j][1], raw[i][2] - raw[j][2]);
        if (Math.abs(dRaw - 2.0) < 1e-4) {
          adj[i].push(j);
          adj[j].push(i);
          edges.push([i, j, dRaw * scale]);
        }
      }
    }

    // Exact topological pi-bond order: 30 6:6 double bonds + 60 5:6 single bonds!
    this.bonds = edges.map(([u, v, r0]) => {
      let inPentagon = false;
      for (const a of adj[u]) {
        if (a === v) continue;
        for (const b of adj[v]) {
          if (b === u) continue;
          if (adj[a].some(c => c !== u && c !== v && adj[b].includes(c))) {
            inPentagon = true;
          }
        }
      }
      return { i: u, j: v, r0, order: inPentagon ? 1.0 : 2.0, strain: 0, pulse: 0 };
    });

    // Endohedral trapped @La ion inside C60!
    this.ion = {
      active: true,
      x: 0.08, y: 0.05, z: -0.04,
      vx: 2.35, vy: 1.75, vz: -1.55
    };

    this._allocBuffers();
  }

  buildNanotube() {
    // (6,6) Armchair Carbon Nanotube: 13 rings x 12 atoms = 156 atoms
    this.atoms = [];
    this.bonds = [];
    const rings = 13;
    const perRing = 12;
    const radius = 0.68;
    const dz = 0.24;

    for (let r = 0; r < rings; r++) {
      const z = (r - (rings - 1) * 0.5) * dz;
      const twist = (r % 2) * (Math.PI / perRing);
      for (let k = 0; k < perRing; k++) {
        // Pair armchair dimers around circumference
        const baseA = (Math.floor(k / 2) / (perRing / 2)) * Math.PI * 2 + twist;
        const offset = (k % 2 === 0 ? -0.17 : 0.17);
        const ang = baseA + offset;
        const x = Math.cos(ang) * radius;
        const y = Math.sin(ang) * radius;
        this.atoms.push({
          x, y, z,
          rx: x, ry: y, rz: z,
          vx: 0, vy: 0, vz: 0,
          heat: 0
        });
      }
    }

    for (let i = 0; i < this.atoms.length; i++) {
      for (let j = i + 1; j < this.atoms.length; j++) {
        const d = Math.hypot(
          this.atoms[i].x - this.atoms[j].x,
          this.atoms[i].y - this.atoms[j].y,
          this.atoms[i].z - this.atoms[j].z
        );
        if (d < 0.42) {
          this.bonds.push({
            i, j, r0: d,
            order: d < 0.27 ? 2.0 : 1.0,
            strain: 0, pulse: 0
          });
        }
      }
    }

    this.ion = {
      active: true,
      x: 0, y: 0, z: -1.3,
      vx: 0.25, vy: -0.2, vz: 3.2
    };
    this._allocBuffers();
  }

  _allocBuffers() {
    const totalAtoms = this.atoms.length + 1;
    this.atomPosBuf = new Float32Array(totalAtoms * 3);
    this.atomMetaBuf = new Float32Array(totalAtoms * 4);
    this.bondP0Buf = new Float32Array(this.bonds.length * 3);
    this.bondP1Buf = new Float32Array(this.bonds.length * 3);
    this.bondMetaBuf = new Float32Array(this.bonds.length * 4);
  }

  kickIon(audio) {
    const sp = 3.8;
    const th = Math.random() * Math.PI * 2;
    const ph = (Math.random() - 0.5) * Math.PI;
    this.ion.vx = Math.cos(th) * Math.cos(ph) * sp;
    this.ion.vy = Math.sin(ph) * sp;
    this.ion.vz = Math.sin(th) * Math.cos(ph) * sp;
    for (const b of this.bonds) {
      if (Math.random() < 0.35) b.pulse = 0.9;
    }
    if (audio) audio.strikeFullerene(0.95, 0, false);
  }

  pokeCage(ndcX, ndcY, pv, audio) {
    let hit = false;
    for (const at of this.atoms) {
      const wr = this._rotVec(at.x, at.y, at.z);
      const p = projectToNDC(pv, wr[0], wr[1], wr[2]);
      if (!p) continue;
      const d = Math.hypot(p[0] - ndcX, p[1] - ndcY);
      if (d < 0.24) {
        const w = 1.0 - d / 0.24;
        // Compress inward toward origin!
        const l = Math.hypot(at.x, at.y, at.z) || 1;
        at.vx -= (at.x / l) * 1.65 * w;
        at.vy -= (at.y / l) * 1.65 * w;
        at.vz -= (at.z / l) * 1.65 * w;
        at.heat = Math.min(1.0, at.heat + w * 0.9);
        hit = true;
      }
    }
    if (hit && audio) audio.strikeFullerene(0.75, ndcX, false);
  }

  _rotVec(x, y, z) {
    const cy = Math.cos(this.rotYaw), sy = Math.sin(this.rotYaw);
    const cp = Math.cos(this.rotPitch), sp = Math.sin(this.rotPitch);
    const x1 = cy * x + sy * sp * y + sy * cp * z;
    const y1 = cp * y - sp * z;
    const z1 = -sy * x + cy * sp * y + cy * cp * z;
    return [x1, y1, z1];
  }

  getProjView(aspect) {
    return makePerspectiveProjView(aspect, [0, 0, 4.4], [0, 0, 0], 42);
  }

  update(dt, isDragging, audio) {
    if (!isDragging) {
      this.rotYaw += this.velYaw * dt;
      this.rotPitch += this.velPitch * dt;
      this.velYaw = this.velYaw * Math.pow(0.4, dt) + 0.45 * (1 - Math.pow(0.4, dt));
      this.velPitch = this.velPitch * Math.pow(0.2, dt);
      this.rotPitch = Math.max(-1.1, Math.min(1.1, this.rotPitch));
    }

    const h = Math.min(0.02, dt) * 0.5;
    for (let step = 0; step < 2; step++) {
      // Covalent bond springs
      for (const b of this.bonds) {
        const ai = this.atoms[b.i], aj = this.atoms[b.j];
        const dx = aj.x - ai.x, dy = aj.y - ai.y, dz = aj.z - ai.z;
        const d = Math.hypot(dx, dy, dz) || 1e-5;
        const diff = d - b.r0;
        b.strain = Math.abs(diff) / b.r0;
        const f = (165.0 * diff) / d;
        ai.vx += dx * f * h; ai.vy += dy * f * h; ai.vz += dz * f * h;
        aj.vx -= dx * f * h; aj.vy -= dy * f * h; aj.vz -= dz * f * h;
      }

      // Soft polyhedral shape-memory restoration so C60 springs back after squishing!
      for (const at of this.atoms) {
        at.vx += (at.rx - at.x) * 28.0 * h;
        at.vy += (at.ry - at.y) * 28.0 * h;
        at.vz += (at.rz - at.z) * 28.0 * h;
        const damp = Math.pow(0.18, h);
        at.vx *= damp; at.vy *= damp; at.vz *= damp;
        at.x += at.vx * h; at.y += at.vy * h; at.z += at.vz * h;
      }

      // Endohedral trapped @La ion physics!
      const ion = this.ion;
      ion.x += ion.vx * h;
      ion.y += ion.vy * h;
      ion.z += ion.vz * h;

      if (this.subMode === 'c60') {
        const rIon = Math.hypot(ion.x, ion.y, ion.z);
        const wallR = 0.96;
        if (rIon > wallR) {
          const nx = ion.x / rIon, ny = ion.y / rIon, nz = ion.z / rIon;
          ion.x = nx * wallR; ion.y = ny * wallR; ion.z = nz * wallR;
          const vn = ion.vx * nx + ion.vy * ny + ion.vz * nz;
          if (vn > 0) {
            ion.vx -= 1.98 * vn * nx;
            ion.vy -= 1.98 * vn * ny;
            ion.vz -= 1.98 * vn * nz;
            // Maintain lively thermal bounce speed
            const sp = Math.hypot(ion.vx, ion.vy, ion.vz) || 1;
            if (sp < 2.2) { ion.vx *= 2.4 / sp; ion.vy *= 2.4 / sp; ion.vz *= 2.4 / sp; }

            // Deform and light up struck C60 face!
            for (const at of this.atoms) {
              const dHit = Math.hypot(at.x - nx * 1.25, at.y - ny * 1.25, at.z - nz * 1.25);
              if (dHit < 0.68) {
                const w = 1.0 - dHit / 0.68;
                at.vx += nx * 1.4 * w;
                at.vy += ny * 1.4 * w;
                at.vz += nz * 1.4 * w;
                at.heat = Math.min(1.0, at.heat + w);
              }
            }
            const wHit = this._rotVec(ion.x, ion.y, ion.z);
            if (audio) audio.strikeFullerene(Math.min(1.0, vn * 0.32), wHit[0] * 0.7, true);
          }
        }
      } else {
        // Nanotube cylindrical channel bounce
        const rXY = Math.hypot(ion.x, ion.y);
        if (rXY > 0.42) {
          const nx = ion.x / rXY, ny = ion.y / rXY;
          ion.x = nx * 0.42; ion.y = ny * 0.42;
          const vn = ion.vx * nx + ion.vy * ny;
          if (vn > 0) { ion.vx -= 2.0 * vn * nx; ion.vy -= 2.0 * vn * ny; }
        }
        if (Math.abs(ion.z) > 1.48) {
          ion.z = Math.sign(ion.z) * 1.48;
          ion.vz *= -1.0;
          if (audio) audio.strikeFullerene(0.7, ion.z * 0.4, true);
        }
        for (const at of this.atoms) {
          if (Math.abs(at.z - ion.z) < 0.26) {
            at.heat = Math.min(1.0, at.heat + 0.35);
          }
        }
      }
    }

    // Transform rotated coordinates into GPU buffers
    for (let i = 0; i < this.atoms.length; i++) {
      const at = this.atoms[i];
      at.heat = Math.max(0, at.heat - dt * 1.5);
      const w = this._rotVec(at.x, at.y, at.z);
      this.atomPosBuf[i * 3 + 0] = w[0];
      this.atomPosBuf[i * 3 + 1] = w[1];
      this.atomPosBuf[i * 3 + 2] = w[2];

      this.atomMetaBuf[i * 4 + 0] = 0.068;
      this.atomMetaBuf[i * 4 + 1] = at.heat;
      this.atomMetaBuf[i * 4 + 2] = 0;
      this.atomMetaBuf[i * 4 + 3] = 1.0;
    }

    // Trapped ion at last slot
    const wi = this._rotVec(this.ion.x, this.ion.y, this.ion.z);
    const idxIon = this.atoms.length;
    this.atomPosBuf[idxIon * 3 + 0] = wi[0];
    this.atomPosBuf[idxIon * 3 + 1] = wi[1];
    this.atomPosBuf[idxIon * 3 + 2] = wi[2];
    this.atomMetaBuf[idxIon * 4 + 0] = 0.145;
    this.atomMetaBuf[idxIon * 4 + 1] = 1.0;
    this.atomMetaBuf[idxIon * 4 + 2] = 1; // Solar gold endohedral ion
    this.atomMetaBuf[idxIon * 4 + 3] = 1.0;

    for (let i = 0; i < this.bonds.length; i++) {
      const b = this.bonds[i];
      b.pulse = Math.max(0, b.pulse - dt * 1.8);
      const i0 = b.i * 3, i1 = b.j * 3;
      this.bondP0Buf[i * 3 + 0] = this.atomPosBuf[i0 + 0];
      this.bondP0Buf[i * 3 + 1] = this.atomPosBuf[i0 + 1];
      this.bondP0Buf[i * 3 + 2] = this.atomPosBuf[i0 + 2];

      this.bondP1Buf[i * 3 + 0] = this.atomPosBuf[i1 + 0];
      this.bondP1Buf[i * 3 + 1] = this.atomPosBuf[i1 + 1];
      this.bondP1Buf[i * 3 + 2] = this.atomPosBuf[i1 + 2];

      this.bondMetaBuf[i * 4 + 0] = b.strain + (this.atoms[b.i].heat + this.atoms[b.j].heat) * 0.22;
      this.bondMetaBuf[i * 4 + 1] = b.order;
      this.bondMetaBuf[i * 4 + 2] = b.order > 1.5 ? 0.032 : 0.021;
      this.bondMetaBuf[i * 4 + 3] = b.pulse;
    }
  }
}

// ============================================================================
// 4. STARFORGE TRIPLE-ALPHA (3 ⁴He → ⁸Be* + ⁴He → ¹²C + 7.65 MeV γ)
// ============================================================================
class StarforgeSim {
  constructor() {
    this.count = 175;
    this.c12Forged = 0;
    this.crush = 0.0;
    this.targetCrush = 0.0;
    this.shocks = Array.from({ length: 8 }, () => [0.5, 0.5, 0.0, 0.0]);
    this.shockUniform = new Float32Array(8 * 4);
    this.shockPtr = 0;

    this.particles = [];
    for (let i = 0; i < this.count; i++) {
      this.particles.push(this._spawnHelium());
    }
    this.atomPosBuf = new Float32Array(this.count * 3);
    this.atomMetaBuf = new Float32Array(this.count * 4);
  }

  _spawnHelium() {
    const r = 0.32 + Math.random() * 1.45;
    const th = Math.random() * Math.PI * 2;
    const inc = (Math.random() - 0.5) * 0.55;
    const vOrb = 1.05 / Math.sqrt(r + 0.18);
    return {
      x: Math.cos(th) * r,
      y: Math.sin(th) * Math.sin(inc) * r + (Math.random() - 0.5) * 0.25,
      z: Math.sin(th) * Math.cos(inc) * r,
      vx: -Math.sin(th) * vOrb,
      vy: (Math.random() - 0.5) * 0.35,
      vz: Math.cos(th) * vOrb,
      kind: 1, // 1 = 4He, 2 = 8Be dimer, 3 = forged 12C
      ttl: 0,
      age: 0,
      active: true
    };
  }

  spawnShock(uvX, uvY, intensity = 1.0) {
    this.shocks[this.shockPtr] = [uvX, uvY, 0.02, intensity];
    this.shockPtr = (this.shockPtr + 1) % 8;
  }

  supernovaBurst(audio) {
    this.spawnShock(0.5, 0.5, 1.5);
    let burstCount = 0;
    for (const p of this.particles) {
      if (p.kind === 1 && burstCount < 14 && Math.hypot(p.x, p.y, p.z) < 0.85) {
        p.kind = 3;
        p.age = 0;
        const r = Math.hypot(p.x, p.y, p.z) || 0.2;
        p.vx = (p.x / r) * 2.2;
        p.vy = (p.y / r) * 2.2;
        p.vz = (p.z / r) * 2.2;
        this.c12Forged++;
        burstCount++;
      }
    }
    if (audio) audio.fusionFlash(0, 1.2);
  }

  getProjView(aspect) {
    return makePerspectiveProjView(aspect, [0, 0.75, 4.35], [0, 0, 0], 42);
  }

  update(dt, aspect, audio) {
    this.crush += (this.targetCrush - this.crush) * (1 - Math.pow(0.01, dt));
    if (audio) audio.setStarCrush(this.crush);

    const pv = this.getProjView(aspect);
    const G = 1.25 + this.crush * 3.8;
    const h = Math.min(0.025, dt);

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.age += h;

      if (p.kind === 2) {
        // Unstable 8Be decays back to 4He if not struck in time!
        p.ttl -= h;
        if (p.ttl <= 0) {
          p.kind = 1;
        }
      } else if (p.kind === 3 && p.age > 7.5) {
        // Recycle old outer-shell 12C back into fresh fuel stream at outer rim
        Object.assign(p, this._spawnHelium());
      }

      const r2 = p.x * p.x + p.y * p.y + p.z * p.z + 0.065;
      const r = Math.sqrt(r2);

      if (p.kind === 3) {
        // Newly forged 12C coasts smoothly into wide stellar nebula shell
        const targetR = 1.65;
        const pull = (targetR - r) * 0.9;
        p.vx += (p.x / r) * pull * h - p.z * 0.35 * h;
        p.vz += (p.z / r) * pull * h + p.x * 0.35 * h;
        p.vx *= 0.988; p.vy *= 0.988; p.vz *= 0.988;
      } else {
        // Gravitational acceleration toward roaring core
        const acc = -G / r2;
        p.vx += (p.x / r) * acc * h;
        p.vy += (p.y / r) * acc * h - p.y * 0.6 * h;
        p.vz += (p.z / r) * acc * h;

        // Extra inward crush drag when user holds Gravity Crush
        if (this.crush > 0.05 && r > 0.22) {
          p.vx -= p.x * this.crush * 1.35 * h;
          p.vy -= p.y * this.crush * 1.35 * h;
          p.vz -= p.z * this.crush * 1.35 * h;
        }
        // Prevent infinite slingshot escape
        if (r > 2.35) {
          p.vx *= 0.92; p.vy *= 0.92; p.vz *= 0.92;
        }
      }

      p.x += p.vx * h;
      p.y += p.vy * h;
      p.z += p.vz * h;
    }

    // Pairwise Triple-Alpha nuclear reaction kinetics inside the hot core!
    const reactRadius = 0.085 + this.crush * 0.075;
    const coreZone = 0.55 + this.crush * 0.32;

    for (let i = 0; i < this.particles.length; i++) {
      const a = this.particles[i];
      if (a.kind === 3) continue;
      const ra = Math.hypot(a.x, a.y, a.z);
      if (ra > coreZone) continue;

      for (let j = i + 1; j < this.particles.length; j++) {
        const b = this.particles[j];
        if (b.kind === 3) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
        if (d < reactRadius) {
          if (a.kind === 1 && b.kind === 1) {
            // 4He + 4He -> unstable 8Be!
            a.kind = 2;
            a.ttl = 0.75 + this.crush * 0.55;
            Object.assign(b, this._spawnHelium());
            break;
          } else if ((a.kind === 2 && b.kind === 1) || (a.kind === 1 && b.kind === 2)) {
            // 8Be + 4He -> 12C* (7.65 MeV Hoyle state!) -> Stable CARBON-12!!
            const survivor = a.kind === 2 ? a : b;
            const consumed = a.kind === 2 ? b : a;
            survivor.kind = 3;
            survivor.age = 0;
            const rs = Math.hypot(survivor.x, survivor.y, survivor.z) || 0.15;
            survivor.vx = (survivor.x / rs) * 1.85;
            survivor.vy = (survivor.y / rs) * 1.35;
            survivor.vz = (survivor.z / rs) * 1.85;

            Object.assign(consumed, this._spawnHelium());
            this.c12Forged++;

            const ndc = projectToNDC(pv, survivor.x, survivor.y, survivor.z);
            const sx = ndc ? (ndc[0] * 0.5 + 0.5) : 0.5;
            const sy = ndc ? (ndc[1] * 0.5 + 0.5) : 0.5;
            this.spawnShock(sx, sy, 0.95);
            if (audio) audio.fusionFlash((sx - 0.5) * 1.6, 0.85);
            break;
          }
        }
      }
    }

    // Advance shockwaves
    for (let i = 0; i < 8; i++) {
      const sh = this.shocks[i];
      if (sh[3] > 0.001) {
        sh[2] += dt * 1.15;
        sh[3] = Math.max(0, sh[3] - dt * 1.35);
      }
      this.shockUniform[i * 4 + 0] = sh[0];
      this.shockUniform[i * 4 + 1] = sh[1];
      this.shockUniform[i * 4 + 2] = sh[2];
      this.shockUniform[i * 4 + 3] = sh[3];
    }

    // Pack instance buffers
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      this.atomPosBuf[i * 3 + 0] = p.x;
      this.atomPosBuf[i * 3 + 1] = p.y;
      this.atomPosBuf[i * 3 + 2] = p.z;

      const rad = p.kind === 1 ? 0.044 : p.kind === 2 ? 0.068 : 0.088;
      this.atomMetaBuf[i * 4 + 0] = rad;
      this.atomMetaBuf[i * 4 + 1] = p.kind === 3 ? 1.0 : 0.5;
      this.atomMetaBuf[i * 4 + 2] = p.kind;
      this.atomMetaBuf[i * 4 + 3] = 1.0;
    }

    return pv;
  }
}
