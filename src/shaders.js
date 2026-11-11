// WebGL2 (#version 300 es) Shaders for all 5 Carbon Allotropes

const SHADERS = {
  fullscreenVert: `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 pos = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = pos;
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}`,

  // =========================================================================
  // PHASE 0: DIAMOND — 32-Half-Space Analytic Raytracer + 7-Band Dispersion
  // =========================================================================
  diamondFrag: `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform vec2 uRes;
uniform float uTime;
uniform mat3 uRot;
uniform mat3 uRotInv;
uniform vec4 uPlanes[32];
uniform vec3 uLightDir;
uniform float uDispersion;
uniform float uRingPulse;
uniform float uFlash;
uniform sampler2D uCausticTex;

// High-contrast jewelers' darkroom HDR environment for maximum scintillation
vec3 sampleJewelEnv(vec3 d, vec3 lightDir) {
  d = normalize(d);
  vec3 col = vec3(0.008, 0.011, 0.018);

  // Overhead studio softbox strips (crucial for diamond facet contrast)
  float up = max(d.y, 0.0);
  float strip1 = smoothstep(0.86, 0.94, abs(sin(d.x * 5.2 + 0.4))) * pow(up, 0.65);
  float strip2 = smoothstep(0.90, 0.97, abs(cos(d.z * 6.0 - 0.3))) * pow(up, 0.8);
  col += vec3(0.95, 0.97, 1.0) * (strip1 * 2.1 + strip2 * 1.7);

  // Collimated prism key spotlight
  float keyDot = max(dot(d, lightDir), 0.0);
  col += vec3(1.0, 0.98, 0.95) * (pow(keyDot, 90.0) * 14.0 + pow(keyDot, 12.0) * 1.15);

  // Cool cyan & warm amber rim reflectors
  float rimA = pow(max(dot(d, normalize(vec3(-0.85, 0.25, -0.45))), 0.0), 6.0);
  float rimB = pow(max(dot(d, normalize(vec3(0.82, 0.15, 0.55))), 0.0), 7.0);
  col += vec3(0.22, 0.68, 1.0) * rimA * 1.35;
  col += vec3(1.0, 0.55, 0.22) * rimB * 0.95;

  // Horizon dark obsidian band
  col *= mix(0.35, 1.0, smoothstep(-0.25, 0.15, d.y));
  return col;
}

// Exact convex hull entry/exit intersection in crystal-local coordinates
bool intersectCrystal(vec3 ro, vec3 rd, out float tNear, out float tFar, out vec3 nNear, out vec3 nFar) {
  tNear = -1e9;
  tFar = 1e9;
  nNear = vec3(0.0, 1.0, 0.0);
  nFar = vec3(0.0, 1.0, 0.0);

  for (int i = 0; i < 32; i++) {
    vec3 n = uPlanes[i].xyz;
    float h = uPlanes[i].w;
    float denom = dot(n, rd);
    float dist = h - dot(n, ro);
    if (abs(denom) < 1e-6) {
      if (dist < 0.0) return false;
    } else {
      float t = dist / denom;
      if (denom < 0.0) {
        if (t > tNear) {
          tNear = t;
          nNear = n;
        }
      } else {
        if (t < tFar) {
          tFar = t;
          nFar = n;
        }
      }
      if (tNear > tFar) return false;
    }
  }
  return tFar > 0.0;
}

// Inside crystal: find next exit facet along internal ray
float exitCrystal(vec3 ro, vec3 rd, out vec3 nExit) {
  float tExit = 1e9;
  nExit = vec3(0.0, 1.0, 0.0);
  for (int i = 0; i < 32; i++) {
    vec3 n = uPlanes[i].xyz;
    float denom = dot(n, rd);
    if (denom > 1e-5) {
      float t = (uPlanes[i].w - dot(n, ro)) / denom;
      if (t < tExit) {
        tExit = t;
        nExit = n;
      }
    }
  }
  return tExit;
}

float fresnelSchlick(float cosTheta, float f0) {
  return f0 + (1.0 - f0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

// 7 perceptual spectral weights summing to (1.0, 1.0, 1.0)
vec3 spectralWeight(int idx) {
  if (idx == 0) return vec3(0.16, 0.00, 0.42); // 415nm Violet
  if (idx == 1) return vec3(0.00, 0.09, 0.44); // 455nm Royal Blue
  if (idx == 2) return vec3(0.00, 0.34, 0.14); // 495nm Cyan
  if (idx == 3) return vec3(0.05, 0.41, 0.00); // 535nm Emerald
  if (idx == 4) return vec3(0.30, 0.14, 0.00); // 575nm Gold
  if (idx == 5) return vec3(0.31, 0.02, 0.00); // 615nm Amber-Red
  return vec3(0.18, 0.00, 0.00);               // 655nm Deep Crimson
}

vec3 shadeFloor(vec3 ro, vec3 rd, vec3 lightDir) {
  float floorY = -1.16;
  if (rd.y >= -0.001) {
    // Deep studio backdrop + volumetric collimated light beam hint
    vec3 bg = vec3(0.016, 0.020, 0.030) * (1.0 - 0.45 * length(vUv - 0.5));
    return bg;
  }
  float tF = (floorY - ro.y) / rd.y;
  if (tF < 0.0 || tF > 28.0) return vec3(0.012, 0.015, 0.024);

  vec3 p = ro + rd * tF;
  float r = length(p.xz);
  float fade = exp(-r * r * 0.085);

  // Subtle brushed slate micro-grain
  float grain = sin(p.x * 48.0) * sin(p.z * 48.0) * 0.012;
  vec3 base = vec3(0.022 + grain, 0.026 + grain, 0.036 + grain);

  // Soft ambient occlusion shadow directly beneath hovering crystal
  float shadow = smoothstep(0.25, 1.45, r);
  base *= mix(0.28, 1.0, shadow);

  // Sample real-time refracted spectral caustic FBO!
  vec2 cUv = p.xz * 0.155 + 0.5;
  vec3 caustics = vec3(0.0);
  if (cUv.x > 0.0 && cUv.x < 1.0 && cUv.y > 0.0 && cUv.y < 1.0) {
    caustics = texture(uCausticTex, cUv).rgb * 2.35;
  }

  // Subtle concentric acoustic wave on floor when crystal is struck
  if (uRingPulse > 0.001) {
    float wave = sin(r * 14.0 - (1.0 - uRingPulse) * 28.0) * uRingPulse;
    caustics += vec3(0.25, 0.65, 1.0) * max(wave, 0.0) * exp(-r * 0.6) * 0.45;
  }

  return (base + caustics) * fade + vec3(0.012, 0.015, 0.022) * (1.0 - fade);
}

// Volumetric light shaft passing into crystal crown
vec3 volumetricBeam(vec3 ro, vec3 rd, vec3 lightDir) {
  // Beam axis passes through (0, 0.1, 0) along -lightDir
  vec3 bOrigin = vec3(0.0, 0.08, 0.0);
  vec3 bAxis = normalize(lightDir);
  vec3 w0 = ro - bOrigin;
  float b = dot(rd, bAxis);
  float d = 1.0 - b * b;
  if (d < 1e-4) return vec3(0.0);
  float e = dot(rd, w0);
  float f = dot(bAxis, w0);
  float tRay = (b * f - e) / d;
  float tBeam = (f - b * e) / d;
  if (tRay < 0.0 || tBeam < -0.2) return vec3(0.0);
  vec3 pRay = ro + rd * tRay;
  vec3 pBeam = bOrigin + bAxis * tBeam;
  float dist = length(pRay - pBeam);
  float coneRadius = 0.22 + tBeam * 0.035;
  float glow = exp(-(dist * dist) / (coneRadius * coneRadius * 0.45));
  float mask = smoothstep(-0.15, 0.5, tBeam) * exp(-tBeam * 0.28);
  return vec3(0.75, 0.86, 1.0) * glow * mask * 0.13;
}

void main() {
  vec2 uv = (vUv * 2.0 - 1.0);
  uv.x *= uRes.x / max(uRes.y, 1.0);

  vec3 ro = vec3(0.0, 0.36, 3.35);
  vec3 target = vec3(0.0, -0.10, 0.0);
  vec3 fwd = normalize(target - ro);
  vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, fwd);
  vec3 rd = normalize(fwd * 1.82 + right * uv.x + up * uv.y);

  vec3 lightDir = normalize(uLightDir);
  vec3 color = shadeFloor(ro, rd, lightDir);

  // Transform ray into crystal local space
  vec3 roC = uRotInv * ro;
  vec3 rdC = uRotInv * rd;

  float tNear, tFar;
  vec3 nNearC, nFarC;
  if (intersectCrystal(roC, rdC, tNear, tFar, nNearC, nFarC) && tNear > 0.0) {
    vec3 hitPosC = roC + rdC * tNear;
    // Elastic acoustic eigenmode shimmer when tapped
    if (uRingPulse > 0.001) {
      float vib = sin(hitPosC.y * 24.0 + uTime * 55.0) * uRingPulse * 0.018;
      nNearC = normalize(nNearC + vec3(vib, -vib * 0.5, vib));
    }
    vec3 nWorld = normalize(uRot * nNearC);

    float cosI = clamp(dot(-rd, nWorld), 0.0, 1.0);
    // Diamond F0 = ((2.417 - 1)/(2.417 + 1))^2 = 0.172
    float F_outer = fresnelSchlick(cosI, 0.172);
    vec3 reflWorld = reflect(rd, nWorld);
    vec3 outerRefl = sampleJewelEnv(reflWorld, lightDir);
    // Crisp specular glint on crown facets
    outerRefl += vec3(1.0) * pow(max(dot(reflWorld, lightDir), 0.0), 180.0) * 6.0;

    // 7-band Cauchy spectral dispersion inside the diamond
    vec3 refractedSum = vec3(0.0);
    for (int w = 0; w < 7; w++) {
      float bandOffset = (float(w) - 3.0) / 3.0; // -1..+1
      float ior = 2.417 + bandOffset * 0.036 * uDispersion;

      vec3 pC = hitPosC + rdC * 0.0004;
      vec3 dirC = refract(rdC, nNearC, 1.0 / ior);
      vec3 specAccum = vec3(0.0);
      float throughput = 1.0;
      float pathLen = 0.0;

      for (int b = 0; b < 5; b++) {
        vec3 nExitC;
        float tEx = exitCrystal(pC, dirC, nExitC);
        pC += dirC * tEx;
        pathLen += max(tEx, 0.0);

        // Subtle facet edge sparkle
        vec3 outC = refract(dirC, -nExitC, ior);
        float cosIn = clamp(dot(-dirC, -nExitC), 0.0, 1.0);
        // Critical angle & internal Fresnel
        float sin2T = ior * ior * (1.0 - cosIn * cosIn);
        float F_in = (sin2T >= 1.0) ? 1.0 : fresnelSchlick(sqrt(max(0.0, 1.0 - sin2T)), 0.172);

        if (F_in < 0.999 && length(outC) > 0.001) {
          vec3 outW = normalize(uRot * outC);
          vec3 envSample = sampleJewelEnv(outW, lightDir);
          // Also pick up floor tint if exiting downward
          if (outW.y < -0.15) {
            envSample += vec3(0.08, 0.11, 0.16);
          }
          specAccum += envSample * throughput * (1.0 - F_in);
        }

        throughput *= F_in;
        if (throughput < 0.03) break;
        dirC = reflect(dirC, -nExitC);
        pC += dirC * 0.0004;
      }

      // Ultra-pure Type IIa carbon diamond slight cool-white Beer-Lambert clarity
      vec3 absorb = exp(-vec3(0.035, 0.022, 0.015) * pathLen);
      refractedSum += specAccum * absorb * spectralWeight(w);
    }

    // Crisp facet-edge bevel highlight
    color = outerRefl * F_outer + refractedSum * (1.0 - F_outer * 0.65);
  }

  color += volumetricBeam(ro, rd, lightDir);
  color += vec3(0.85, 0.93, 1.0) * uFlash;

  // ACES Filmic tonemapping
  color = (color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14);
  color = pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2));
  fragColor = vec4(color, 1.0);
}`,

  // Caustic splat pass into 256x256 caustic FBO
  causticVert: `#version 300 es
precision highp float;
layout(location = 0) in vec2 aQuad;
layout(location = 1) in vec4 aSplatPosSize; // xy in floor UV [0..1], z = size, w = angle
layout(location = 2) in vec3 aSplatColor;
out vec2 vLocal;
out vec3 vColor;
void main() {
  vLocal = aQuad;
  vColor = aSplatColor;
  float c = cos(aSplatPosSize.w), s = sin(aSplatPosSize.w);
  vec2 stretched = vec2(aQuad.x * 2.2, aQuad.y * 0.55) * aSplatPosSize.z;
  vec2 rot = vec2(stretched.x * c - stretched.y * s, stretched.x * s + stretched.y * c);
  vec2 clip = (aSplatPosSize.xy + rot) * 2.0 - 1.0;
  gl_Position = vec4(clip, 0.0, 1.0);
}`,

  causticFrag: `#version 300 es
precision highp float;
in vec2 vLocal;
in vec3 vColor;
out vec4 fragColor;
void main() {
  float d2 = dot(vLocal, vLocal);
  if (d2 > 1.0) discard;
  float falloff = pow(1.0 - d2, 2.2);
  fragColor = vec4(vColor * falloff, 1.0);
}`,

  // =========================================================================
  // PHASES 1 & 2: MOLECULAR STUDIO BACKDROP + INSTANCED BONDS & SPHERE ATOMS
  // =========================================================================
  latticeBgFrag: `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform vec2 uRes;
uniform float uTime;
uniform int uMode; // 1 = Graphene, 2 = Fullerene
uniform vec2 uCursor;
uniform float uFlash;

void main() {
  vec2 p = (vUv - 0.5) * vec2(uRes.x / max(uRes.y, 1.0), 1.0);
  float r = length(p);

  vec3 base = (uMode == 1)
    ? mix(vec3(0.032, 0.048, 0.075), vec3(0.008, 0.011, 0.018), smoothstep(0.0, 0.95, r))
    : mix(vec3(0.045, 0.036, 0.072), vec3(0.008, 0.010, 0.018), smoothstep(0.0, 0.95, r));

  // Subtle perspective laboratory measurement grid
  vec2 g = abs(fract(p * 8.0) - 0.5);
  float line = smoothstep(0.485, 0.5, max(g.x, g.y));
  base += vec3(0.10, 0.18, 0.28) * line * 0.14 * exp(-r * 1.6);

  // Subtle cursor field halo
  vec2 cPos = (uCursor - 0.5) * vec2(uRes.x / max(uRes.y, 1.0), 1.0);
  float cd = length(p - cPos);
  vec3 haloCol = (uMode == 1) ? vec3(0.15, 0.65, 1.0) : vec3(0.95, 0.65, 0.25);
  base += haloCol * exp(-cd * cd * 18.0) * 0.09;
  base += vec3(0.85, 0.95, 1.0) * uFlash;

  fragColor = vec4(pow(clamp(base, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
}`,

  bondVert: `#version 300 es
precision highp float;
layout(location = 0) in vec2 aQuad; // x in [-1, 1] width, y in [0, 1] along bond
layout(location = 1) in vec3 aP0;
layout(location = 2) in vec3 aP1;
layout(location = 3) in vec4 aMeta; // x = strain, y = bondOrder (1 or 2), z = thickness, w = pulse

uniform mat4 uProjView;
uniform vec2 uRes;

out vec2 vUvBond;
out vec4 vMeta;
out float vDepth;

void main() {
  vec4 c0 = uProjView * vec4(aP0, 1.0);
  vec4 c1 = uProjView * vec4(aP1, 1.0);
  if (c0.w <= 0.05 || c1.w <= 0.05) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec2 ndc0 = c0.xy / c0.w;
  vec2 ndc1 = c1.xy / c1.w;

  vec2 aspect = vec2(uRes.x / max(uRes.y, 1.0), 1.0);
  vec2 dir = (ndc1 - ndc0) * aspect;
  float len = length(dir);
  vec2 tang = (len > 1e-5) ? (dir / len) : vec2(1.0, 0.0);
  vec2 perp = vec2(-tang.y, tang.x) / aspect;

  vec4 clip = mix(c0, c1, aQuad.y);
  float pixelScale = aMeta.z / max(clip.w, 0.25);
  clip.xy += perp * aQuad.x * pixelScale * clip.w;

  vUvBond = aQuad;
  vMeta = aMeta;
  vDepth = clip.w;
  gl_Position = clip;
}`,

  bondFrag: `#version 300 es
precision highp float;
in vec2 vUvBond;
in vec4 vMeta;
in float vDepth;
out vec4 fragColor;

void main() {
  float x = vUvBond.x; // -1..1 across cylinder
  float strain = vMeta.x;
  float order = vMeta.y;
  float pulse = vMeta.w;

  // Cylindrical shading or double pi-bond twin-rail profile!
  float profile;
  if (order > 1.5) {
    float rail1 = exp(-pow((abs(x) - 0.42) * 3.1, 2.0));
    float core = (1.0 - x * x) * 0.45;
    profile = clamp(rail1 + core, 0.0, 1.2);
  } else {
    if (abs(x) > 1.0) discard;
    float nz = sqrt(max(0.0, 1.0 - x * x));
    profile = pow(nz, 0.85) + pow(nz, 8.0) * 0.45;
  }

  // Color shifts with covalent strain: relaxed cyan-silver -> gold -> hot plasma magenta!
  vec3 relaxed = (order > 1.5) ? vec3(0.38, 0.86, 1.0) : vec3(0.24, 0.62, 0.88);
  vec3 medium = vec3(1.0, 0.78, 0.28);
  vec3 critical = vec3(1.0, 0.22, 0.58);

  float s = clamp(strain * 2.6, 0.0, 2.0);
  vec3 col = (s < 1.0) ? mix(relaxed, medium, s) : mix(medium, critical, s - 1.0);
  col += vec3(0.55, 0.92, 1.0) * pulse * 1.4;

  // Depth atmospheric cue
  float fog = clamp(1.32 - vDepth * 0.09, 0.25, 1.0);
  float alpha = clamp(profile * 0.95, 0.0, 1.0);
  if (alpha < 0.03) discard;

  fragColor = vec4(pow(col * profile * fog, vec3(1.0 / 2.2)), alpha);
}`,

  atomVert: `#version 300 es
precision highp float;
layout(location = 0) in vec2 aQuad; // [-1, 1]^2
layout(location = 1) in vec3 aPos;
layout(location = 2) in vec4 aAtomMeta; // x = radius, y = energy/strain, z = kind (0=C, 1=Endohedral/He, 2=Be8, 3=C12), w = alpha

uniform mat4 uProjView;
uniform vec2 uRes;

out vec2 vQuad;
out vec4 vAtomMeta;
out float vViewDepth;

void main() {
  vec4 clip = uProjView * vec4(aPos, 1.0);
  if (clip.w <= 0.05) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec2 aspect = vec2(uRes.y / max(uRes.x, 1.0), 1.0);
  float sz = aAtomMeta.x / max(clip.w, 0.2);
  clip.xy += aQuad * aspect * sz * clip.w;

  vQuad = aQuad;
  vAtomMeta = aAtomMeta;
  vViewDepth = clip.w;
  gl_Position = clip;
}`,

  atomFrag: `#version 300 es
precision highp float;
in vec2 vQuad;
in vec4 vAtomMeta;
in float vViewDepth;
out vec4 fragColor;

void main() {
  float r2 = dot(vQuad, vQuad);
  if (r2 > 1.0) discard;

  float z = sqrt(1.0 - r2);
  vec3 normal = normalize(vec3(vQuad.x, vQuad.y, z));
  vec3 light1 = normalize(vec3(-0.45, 0.65, 0.72));
  vec3 light2 = normalize(vec3(0.6, -0.35, 0.5));

  float diff = max(dot(normal, light1), 0.0) * 0.78 + max(dot(normal, light2), 0.0) * 0.25 + 0.18;
  vec3 halfV = normalize(light1 + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(normal, halfV), 0.0), 36.0);
  float fres = pow(1.0 - z, 3.0);

  float energy = vAtomMeta.y;
  int kind = int(vAtomMeta.z + 0.5);

  vec3 baseCol;
  vec3 rimCol;
  if (kind == 0) {
    // Carbon atom: obsidian-graphite metallic sphere with cyan-gold orbital rim
    baseCol = mix(vec3(0.16, 0.24, 0.34), vec3(1.0, 0.58, 0.22), clamp(energy, 0.0, 1.0));
    rimCol = mix(vec3(0.35, 0.85, 1.0), vec3(1.0, 0.85, 0.45), clamp(energy, 0.0, 1.0));
  } else if (kind == 1) {
    // Endohedral @La ion or 4He alpha particle: blazing solar gold!
    baseCol = vec3(1.0, 0.68, 0.18);
    rimCol = vec3(1.0, 0.95, 0.65);
  } else if (kind == 2) {
    // Unstable 8Be resonance dimer: electric violet-magenta
    baseCol = vec3(0.88, 0.24, 1.0);
    rimCol = vec3(1.0, 0.75, 1.0);
  } else {
    // Newly forged 12C nucleus in Starforge: incandescent diamond-cyan!
    baseCol = vec3(0.32, 0.92, 1.0);
    rimCol = vec3(1.0, 1.0, 1.0);
  }

  vec3 col = baseCol * diff + vec3(1.0) * spec * 0.85 + rimCol * fres * (0.85 + energy * 0.8);
  float fog = clamp(1.38 - vViewDepth * 0.085, 0.25, 1.0);
  col *= fog;

  // Soft outer corona near sphere edge
  float edgeAlpha = smoothstep(1.0, 0.86, r2) * vAtomMeta.w;
  fragColor = vec4(pow(clamp(col, 0.0, 2.2), vec3(1.0 / 2.2)), edgeAlpha);
}`,

  // =========================================================================
  // PHASE 3: BIOS — 65,536-Agent GPGPU Chemotaxis + Morphogenetic Typography
  // =========================================================================
  biosAgentUpdateFrag: `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uAgentTex;
uniform sampler2D uTrailTex;
uniform sampler2D uTextTex;
uniform vec2 uWorldRes;
uniform float uTime;
uniform vec2 uPointer;     // [0..1]
uniform float uPointerAct; // 0 = idle, 1 = attract, -1 = scatter shock
uniform float uTextStrength;

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

float sense(vec2 pos, float angle, vec2 aspect) {
  vec2 dir = vec2(cos(angle), sin(angle)) * aspect;
  vec2 sp = fract(pos + dir * 0.0105);
  float trail = dot(texture(uTrailTex, sp).rgb, vec3(0.5, 0.35, 0.15));
  float textNutrient = texture(uTextTex, vec2(sp.x, 1.0 - sp.y)).r;
  return trail + textNutrient * uTextStrength * 3.1;
}

void main() {
  ivec2 coord = ivec2(gl_FragCoord.xy);
  vec4 state = texelFetch(uAgentTex, coord, 0); // xy = pos, z = angle, w = species [0..1]

  vec2 pos = state.xy;
  float angle = state.z;
  float species = state.w;

  vec2 aspect = vec2(uWorldRes.y / max(uWorldRes.x, 1.0), 1.0);
  float sensorAngle = 0.46 + species * 0.16;

  float fC = sense(pos, angle, aspect);
  float fL = sense(pos, angle + sensorAngle, aspect);
  float fR = sense(pos, angle - sensorAngle, aspect);

  float rnd = hash13(vec3(pos * 512.0, uTime));
  float turnSpeed = 0.28 + species * 0.12;

  if (fC >= fL && fC >= fR) {
    angle += (rnd - 0.5) * 0.08;
  } else if (fC < fL && fC < fR) {
    angle += (rnd > 0.5 ? 1.0 : -1.0) * turnSpeed;
  } else if (fL > fR) {
    angle += turnSpeed;
  } else if (fR > fL) {
    angle -= turnSpeed;
  }

  // Cursor interaction: chemotactic nutrient lure OR radial bioluminescent scatter!
  if (abs(uPointerAct) > 0.01) {
    vec2 delta = (uPointer - pos) * vec2(uWorldRes.x / max(uWorldRes.y, 1.0), 1.0);
    float d = length(delta);
    if (d < 0.28 && d > 0.001) {
      float targetA = atan(delta.y, delta.x * (uWorldRes.y / max(uWorldRes.x, 1.0)));
      if (uPointerAct > 0.0) {
        angle = mix(angle, targetA, 0.16 * (1.0 - d / 0.28));
      } else {
        angle = targetA + 3.14159265 + (rnd - 0.5) * 0.5;
      }
    }
  }

  // Slow down inside nutrient-rich letters so dense vascular filaments form cleanly
  float onText = texture(uTextTex, vec2(pos.x, 1.0 - pos.y)).r * uTextStrength;
  float speed = mix(0.0031, 0.0015, clamp(onText, 0.0, 1.0)) * (0.85 + species * 0.35);
  if (uPointerAct < -0.5) speed *= 2.4;

  vec2 vel = vec2(cos(angle), sin(angle)) * aspect * speed;
  pos = fract(pos + vel);

  fragColor = vec4(pos, mod(angle, 6.2831853), species);
}`,

  biosDepositVert: `#version 300 es
precision highp float;
uniform sampler2D uAgentTex;
uniform int uGridSize;
out float vSpecies;
void main() {
  ivec2 ij = ivec2(gl_VertexID % uGridSize, gl_VertexID / uGridSize);
  vec4 state = texelFetch(uAgentTex, ij, 0);
  vSpecies = state.w;
  gl_Position = vec4(state.xy * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = 1.35;
}`,

  biosDepositFrag: `#version 300 es
precision highp float;
in float vSpecies;
out vec4 fragColor;
void main() {
  vec3 c = mix(vec3(0.035, 0.095, 0.085), vec3(0.085, 0.055, 0.020), vSpecies);
  fragColor = vec4(c, 1.0);
}`,

  biosDiffuseFrag: `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTrailTex;
uniform sampler2D uTextTex;
uniform vec2 uTexel;
uniform float uTextStrength;

void main() {
  vec3 sum = vec3(0.0);
  sum += texture(uTrailTex, vUv + vec2(-uTexel.x, -uTexel.y)).rgb * 0.065;
  sum += texture(uTrailTex, vUv + vec2( 0.0,      -uTexel.y)).rgb * 0.120;
  sum += texture(uTrailTex, vUv + vec2( uTexel.x, -uTexel.y)).rgb * 0.065;
  sum += texture(uTrailTex, vUv + vec2(-uTexel.x,  0.0     )).rgb * 0.120;
  sum += texture(uTrailTex, vUv).rgb                              * 0.260;
  sum += texture(uTrailTex, vUv + vec2( uTexel.x,  0.0     )).rgb * 0.120;
  sum += texture(uTrailTex, vUv + vec2(-uTexel.x,  uTexel.y)).rgb * 0.065;
  sum += texture(uTrailTex, vUv + vec2( 0.0,       uTexel.y)).rgb * 0.120;
  sum += texture(uTrailTex, vUv + vec2( uTexel.x,  uTexel.y)).rgb * 0.065;

  float txt = texture(uTextTex, vec2(vUv.x, 1.0 - vUv.y)).r * uTextStrength;
  vec3 decayed = sum * 0.942 + vec3(0.008, 0.014, 0.012) * txt;
  fragColor = vec4(clamp(decayed, 0.0, 1.0), 1.0);
}`,

  biosDisplayFrag: `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTrailTex;
uniform sampler2D uTextTex;
uniform float uTextStrength;
uniform float uFlash;
uniform float uTime;

void main() {
  vec3 tr = texture(uTrailTex, vUv).rgb;
  float density = tr.r * 1.15 + tr.g * 1.45 + tr.b * 0.8;

  // Deep abyssal Petri dish background
  vec2 c = vUv - 0.5;
  vec3 bg = vec3(0.009, 0.014, 0.020) * (1.0 - 0.45 * dot(c, c));

  // Bioluminescent organic palette: deep emerald -> electric cyan -> ATP warm gold cores
  vec3 low = vec3(0.04, 0.34, 0.38);
  vec3 mid = vec3(0.18, 0.92, 0.78);
  vec3 high = vec3(1.0, 0.92, 0.62);

  float d1 = clamp(density * 1.35, 0.0, 1.0);
  float d2 = clamp((density - 0.42) * 1.7, 0.0, 1.0);
  vec3 bio = mix(bg, low, smoothstep(0.02, 0.25, d1));
  bio = mix(bio, mid, smoothstep(0.18, 0.68, d1));
  bio = mix(bio, high, smoothstep(0.35, 0.95, d2));

  // Subtle metabolic pulse wave across living vascular network
  float pulse = 0.92 + 0.08 * sin(uTime * 2.4 - length(c) * 9.0);
  bio *= pulse;

  // Faint ghost outline of nutrient inscription field
  float txt = texture(uTextTex, vec2(vUv.x, 1.0 - vUv.y)).r * uTextStrength;
  bio += vec3(0.03, 0.09, 0.08) * txt * 0.35;
  bio += vec3(0.8, 1.0, 0.95) * uFlash;

  fragColor = vec4(pow(clamp(bio, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
}`,

  // =========================================================================
  // PHASE 4: STARFORGE — Gravitational Lensing + 10^8 K Helium Core + Shockwaves
  // =========================================================================
  starforgeFrag: `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform vec2 uRes;
uniform float uTime;
uniform float uCrush;         // 0..1 gravitational core compression
uniform vec4 uShocks[8];      // xy = screen center, z = radius, w = intensity
uniform float uFlash;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    v += amp * noise(p);
    p = rot * p * 2.05;
    amp *= 0.5;
  }
  return v;
}

vec3 starfield(vec2 uv) {
  vec3 col = vec3(0.006, 0.009, 0.018);
  // Nebula dust wisps
  float neb = fbm(uv * 2.8 + vec2(0.1, -0.2));
  col += mix(vec3(0.04, 0.02, 0.08), vec3(0.01, 0.06, 0.11), neb) * smoothstep(0.35, 0.85, neb);

  // Two crisp procedural star layers
  for (int layer = 1; layer <= 2; layer++) {
    float scale = float(layer) * 26.0;
    vec2 gv = fract(uv * scale) - 0.5;
    vec2 id = floor(uv * scale);
    float rnd = hash21(id + float(layer) * 19.7);
    if (rnd > 0.72) {
      vec2 offset = vec2(fract(rnd * 34.1) - 0.5, fract(rnd * 91.7) - 0.5) * 0.6;
      float d = length(gv - offset);
      float star = exp(-d * d * 240.0) * (rnd - 0.7) * 4.5;
      vec3 tint = mix(vec3(1.0, 0.78, 0.58), vec3(0.68, 0.86, 1.0), fract(rnd * 13.7));
      col += tint * star;
    }
  }
  return col;
}

// Approximate Planck blackbody color
vec3 blackbody(float temp01) {
  vec3 cold = vec3(0.85, 0.16, 0.04);
  vec3 mid = vec3(1.0, 0.62, 0.15);
  vec3 hot = vec3(1.0, 0.96, 0.88);
  vec3 ultra = vec3(0.62, 0.86, 1.0);
  if (temp01 < 0.35) return mix(cold, mid, temp01 / 0.35);
  if (temp01 < 0.72) return mix(mid, hot, (temp01 - 0.35) / 0.37);
  return mix(hot, ultra, (temp01 - 0.72) / 0.28);
}

void main() {
  vec2 aspect = vec2(uRes.x / max(uRes.y, 1.0), 1.0);
  vec2 p = (vUv - 0.5) * aspect;

  // Apply Hoyle 7.65 MeV gamma shockwave space-time ripples!
  vec3 shockGlow = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    vec4 sh = uShocks[i];
    if (sh.w > 0.001) {
      vec2 sp = (sh.xy - 0.5) * aspect;
      vec2 diff = p - sp;
      float dist = length(diff);
      float ring = exp(-pow((dist - sh.z) * 26.0, 2.0)) * sh.w;
      if (dist > 0.001) {
        p -= (diff / dist) * ring * 0.028;
      }
      shockGlow += mix(vec3(0.45, 0.88, 1.0), vec3(1.0, 0.85, 0.45), clamp(dist * 2.0, 0.0, 1.0)) * ring * 1.45;
    }
  }

  float r = length(p);
  // Relativistic Schwarzschild gravitational lensing around degenerate helium core!
  float coreRadius = mix(0.20, 0.115, uCrush);
  float einsteinR = 0.022 + uCrush * 0.036;
  vec2 lensedUv = p * (1.0 - einsteinR / (r * r + 0.022));
  vec3 col = starfield(lensedUv * 0.7 + vec2(uTime * 0.004, 0.0));

  // Convective plasma envelope + roaring 10^8 K Triple-Alpha core
  float angle = atan(p.y, p.x);
  float turb = fbm(vec2(r * 7.5 - uTime * 0.65, angle * 3.0 + uTime * 0.22));
  float flare = fbm(p * 5.5 - vec2(uTime * 0.35, -uTime * 0.28));

  float corona = exp(-max(r - coreRadius * 0.7, 0.0) * (5.2 - uCrush * 1.4));
  float coreMask = smoothstep(coreRadius * 1.38, coreRadius * 0.25, r - (turb - 0.5) * 0.055);

  float temp = clamp(coreMask * 0.85 + corona * 0.42 + flare * 0.22 + uCrush * 0.35, 0.0, 1.0);
  vec3 plasma = blackbody(temp) * (coreMask * (2.2 + uCrush * 2.0) + corona * (0.85 + flare * 0.75));

  // Einstein ring shimmer
  float eRing = exp(-pow((r - coreRadius * 1.35) * 18.0, 2.0)) * (0.22 + uCrush * 0.55);
  plasma += vec3(0.55, 0.82, 1.0) * eRing;

  col = col * (1.0 - clamp(coreMask * 0.95, 0.0, 1.0)) + plasma + shockGlow;
  col += vec3(0.9, 0.95, 1.0) * uFlash;

  // Filmic tonemap
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  fragColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
}`
};
