// WebGL2 Shaders for "THE HANDPRINT" — Gemini 4 Carbon Audiovisual Short Film

const STORY_SHADERS = {
  fullscreenVert: `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`,

  backdropFrag: `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform vec2 uRes;
uniform float uTime;
uniform float uStoryTime;
uniform float uActWeights[6]; // Smooth 0..1 weights for Acts I..VI
uniform vec3 uAudio;          // x: low (heartbeat/sub), y: mid (chords), z: high (bells/pulse)
uniform vec2 uCursor;         // Aspect-corrected NDC coords
uniform float uIntroMix;      // 1.0 while on intro veil, 0.0 once started

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
  for (int i = 0; i < 4; i++) {
    v += a * noise2(p);
    p = rot * p * 2.03 + vec2(11.7, 5.3);
    a *= 0.5;
  }
  return v;
}

float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

// Signed distance to a Paleolithic open left palm + 5 spread fingers centered near (0, 0.03)
float sdHandprint(vec2 p) {
  vec2 q = (p - vec2(0.0, 0.03)) * 1.18;
  // Slight organic tilt
  float ca = cos(0.06), sa = sin(0.06);
  q = mat2(ca, -sa, sa, ca) * q;

  // Palm core + heel
  float dPalm = length((q - vec2(0.0, -0.09)) * vec2(1.08, 0.94)) - 0.145;
  float dWrist = sdSegment(q, vec2(-0.01, -0.18), vec2(-0.02, -0.32)) - 0.082;
  float d = smin(dPalm, dWrist, 0.075);

  // Thumb + 4 spread fingers (tapered capsules)
  float fThumb = sdSegment(q, vec2(-0.10, -0.10), vec2(-0.27, 0.04)) - 0.031;
  float fIdx   = sdSegment(q, vec2(-0.085, 0.01), vec2(-0.145, 0.255)) - 0.027;
  float fMid   = sdSegment(q, vec2(-0.020, 0.03), vec2(-0.022, 0.305)) - 0.028;
  float fRing  = sdSegment(q, vec2( 0.046, 0.02), vec2( 0.092, 0.270)) - 0.026;
  float fPinky = sdSegment(q, vec2( 0.102,-0.02), vec2( 0.195, 0.175)) - 0.023;

  d = smin(d, fThumb, 0.042);
  d = smin(d, fIdx,   0.038);
  d = smin(d, fMid,   0.038);
  d = smin(d, fRing,  0.038);
  d = smin(d, fPinky, 0.038);
  return d;
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = uRes.x / max(uRes.y, 1.0);
  vec2 p = vec2(uv.x * aspect, uv.y);

  float w1 = uActWeights[0];
  float w2 = uActWeights[1];
  float w3 = uActWeights[2];
  float w4 = uActWeights[3];
  float w5 = uActWeights[4];
  float w6 = uActWeights[5];

  vec3 col = vec3(0.014, 0.016, 0.024);

  // -------------------------------------------------------------------------
  // ACT I: THE CAVE — Limestone wall, torch flicker & Paleolithic Hand Stencil
  // -------------------------------------------------------------------------
  if (w1 > 0.001) {
    float rock = fbm(p * 4.2);
    float micro = fbm(p * 14.5 + rock * 0.45);
    float flicker = 0.90 + 0.10 * sin(uTime * 5.7) * cos(uTime * 3.3 + 1.1) + uAudio.x * 0.18;
    vec2 torchPos = uCursor * 0.35 + vec2(0.03 * sin(uTime * 1.1), 0.04 * cos(uTime * 0.8));
    float torchFalloff = exp(-dot(p - torchPos, p - torchPos) * 1.05) * flicker;

    vec3 stoneBase = vec3(0.030, 0.022, 0.020) + rock * vec3(0.048, 0.032, 0.024) + micro * 0.018;
    stoneBase *= (0.45 + 1.15 * torchFalloff);

    // Negative-space handprint stencil: bare dark limestone inside palm, blown red-ochre pigment outside!
    float dHand = sdHandprint(p + vec2(0.0, -0.02) * (rock - 0.5));
    float reveal = clamp((uStoryTime + uIntroMix * 6.0) / 3.8, 0.0, 1.0);
    float pigmentBand = smoothstep(-0.008, 0.016, dHand) * exp(-max(dHand, 0.0) * 4.8);
    float splatter = pigmentBand * (0.68 + 0.55 * micro) * reveal;

    vec3 ochre = mix(vec3(0.76, 0.25, 0.09), vec3(0.98, 0.66, 0.28), exp(-max(dHand, 0.0) * 12.0));
    vec3 caveCol = stoneBase + ochre * splatter * (0.68 + 0.45 * torchFalloff + 0.28 * uAudio.x);

    // Subtle dark-charcoal interior of the hand stencil so fingers read with visceral clarity
    float insideMask = 1.0 - smoothstep(-0.012, 0.012, dHand);
    caveCol = mix(caveCol, stoneBase * 0.52, insideMask * 0.78 * reveal);

    col += caveCol * w1;
  }

  // -------------------------------------------------------------------------
  // ACT II: THE BOTTLENECK — Deep Obsidian Void & Luminous Hourglass Waist
  // -------------------------------------------------------------------------
  if (w2 > 0.001) {
    float waistWidth = 0.042 + 1.55 * p.y * p.y;
    float edgeDist = abs(abs(p.x) - waistWidth);
    float wallGlow = exp(-edgeDist * 18.0) * exp(-abs(p.y) * 1.6);
    float pinchGlow = exp(-dot(p * vec2(1.2, 2.8), p * vec2(1.2, 2.8)) * 7.5);
    vec3 bottleCol = vec3(0.016, 0.022, 0.038)
      + vec3(0.35, 0.52, 0.85) * wallGlow * (0.28 + 0.25 * uAudio.z)
      + vec3(0.96, 0.74, 0.36) * pinchGlow * (0.24 + 0.30 * uAudio.y);
    col += bottleCol * w2;
  }

  // -------------------------------------------------------------------------
  // ACT III: HIDDEN GEOMETRY — Latent Cosmos & Harmonic Geodesic Rings
  // -------------------------------------------------------------------------
  if (w3 > 0.001) {
    float r = length(p);
    float neb = fbm(p * 2.2 + vec2(uTime * 0.03, -uTime * 0.02));
    float ringWave = sin(r * 16.0 - uStoryTime * 2.8) * 0.5 + 0.5;
    float rings = pow(ringWave, 8.0) * exp(-r * 1.8) * (0.12 + 0.35 * uAudio.z);
    vec3 geoCol = vec3(0.020, 0.026, 0.062)
      + neb * vec3(0.045, 0.055, 0.13)
      + rings * vec3(0.38, 0.78, 1.0)
      + exp(-r * 2.4) * vec3(0.14, 0.10, 0.28) * (0.5 + 0.5 * uAudio.y);
    col += geoCol * w3;
  }

  // -------------------------------------------------------------------------
  // ACT IV: HORIZONS — Shifting Scientific Aura (Bio -> Fusion -> Planetary)
  // -------------------------------------------------------------------------
  if (w4 > 0.001) {
    float subPhase = clamp((uStoryTime - 43.0) / 17.0, 0.0, 1.0);
    vec3 auraA = vec3(0.04, 0.22, 0.18); // Protein emerald-teal
    vec3 auraB = vec3(0.18, 0.08, 0.34); // Stellarator plasma violet
    vec3 auraC = vec3(0.05, 0.18, 0.38); // Planetary sapphire limb
    vec3 aura = subPhase < 0.35
      ? mix(auraA, auraB, smoothstep(0.28, 0.40, subPhase))
      : mix(auraB, auraC, smoothstep(0.62, 0.74, subPhase));
    float r = length(p);
    vec3 act4Col = vec3(0.012, 0.018, 0.032) + aura * exp(-r * 1.45) * (0.75 + 0.45 * uAudio.y);
    col += act4Col * w4;
  }

  // -------------------------------------------------------------------------
  // ACT V: THE WEIGHT OF THE FIRE — Dark Mirror Water & Heartbeat Ripples
  // -------------------------------------------------------------------------
  if (w5 > 0.001) {
    float horizonY = -0.24;
    vec3 fireSky = vec3(0.010, 0.011, 0.016);
    vec2 flameCenter = vec2(0.0, 0.14);
    float dFlame = length((p - flameCenter) * vec2(1.0, 0.75));
    fireSky += vec3(0.95, 0.62, 0.26) * exp(-dFlame * 4.2) * (0.28 + 0.26 * uAudio.x);

    if (p.y < horizonY) {
      float depth = horizonY - p.y;
      // Perspective water plane coordinates
      vec2 wp = vec2(p.x / max(depth * 3.5, 0.06), 1.0 / max(depth * 3.5, 0.06));
      float hbRipple = sin(length(vec2(p.x, depth * 2.6)) * 34.0 - uTime * 5.2) * exp(-depth * 4.5);
      float curRipple = sin(length(p - uCursor) * 42.0 - uTime * 7.0) * exp(-length(p - uCursor) * 4.0);
      float rip = (hbRipple * (0.35 + uAudio.x * 0.9) + curRipple * 0.35) * 0.025;

      vec2 reflP = vec2(p.x + rip, 2.0 * horizonY - p.y + rip * 0.6);
      float dRefl = length((reflP - flameCenter) * vec2(1.35, 0.65));
      vec3 reflGlow = vec3(1.0, 0.72, 0.36) * exp(-dRefl * 4.6) * (0.42 + 0.35 * uAudio.x);
      float horizonLine = exp(-abs(p.y - horizonY) * 90.0) * 0.18;
      fireSky = vec3(0.008, 0.012, 0.020) + reflGlow * exp(-depth * 1.8) + vec3(0.45, 0.55, 0.75) * horizonLine;
    }
    col += fireSky * w5;
  }

  // -------------------------------------------------------------------------
  // ACT VI: CHAPTER ONE — D-Major Picardy Dawn Over Curved Horizon
  // -------------------------------------------------------------------------
  if (w6 > 0.001) {
    float dawnProg = clamp((uStoryTime - 73.0) / 9.5, 0.0, 1.0);
    // Subtle curved planetary limb at bottom of frame
    float limbY = -0.58 - 0.16 * p.x * p.x + dawnProg * 0.08;
    float alt = p.y - limbY;

    vec3 spaceTop = vec3(0.022, 0.040, 0.095);
    vec3 atmoCyan = vec3(0.20, 0.56, 0.88);
    vec3 dawnGold = vec3(1.00, 0.76, 0.38);

    float bandGold = exp(-max(alt, -0.15) * 4.8) * smoothstep(-0.06, 0.02, alt);
    float bandCyan = exp(-max(alt, 0.0) * 2.1) * smoothstep(-0.04, 0.08, alt);
    float sunCore  = exp(-dot(p - vec2(0.0, limbY + 0.04), p - vec2(0.0, limbY + 0.04)) * 2.8);

    vec3 dawnCol = spaceTop
      + atmoCyan * bandCyan * (0.42 + 0.45 * dawnProg)
      + dawnGold * bandGold * (0.55 + 0.55 * dawnProg)
      + vec3(1.0, 0.88, 0.64) * sunCore * (0.28 + 0.42 * dawnProg + 0.18 * uAudio.y);

    // Dark planetary silhouette below limb
    if (alt < 0.0) {
      float rim = exp(alt * 55.0);
      dawnCol = mix(vec3(0.012, 0.016, 0.028), dawnGold * 0.85, rim * (0.5 + 0.5 * dawnProg));
    }

    // Crisp non-grid starfield in upper sky
    vec2 sc = floor((p + vec2(3.7, 1.9)) * 46.0);
    vec2 sf = fract((p + vec2(3.7, 1.9)) * 46.0) - 0.5;
    float sh = hash21(sc);
    if (sh > 0.968 && alt > 0.08) {
      vec2 jitter = vec2(hash21(sc + 13.1), hash21(sc + 29.7)) - 0.5;
      float sd = length(sf - jitter * 0.65);
      float tw = 0.65 + 0.35 * sin(uTime * 2.7 + sh * 40.0);
      dawnCol += vec3(0.95, 0.92, 0.85) * exp(-sd * 22.0) * tw * smoothstep(0.08, 0.45, alt) * 0.65;
    }

    col += dawnCol * w6;
  }

  // Gentle cursor light-touch halo across all acts
  float cDist = length(p - uCursor);
  col += vec3(0.95, 0.78, 0.52) * exp(-cDist * 6.5) * (0.045 + 0.08 * uAudio.z);

  // Subtle ACES-inspired filmic tonemap + clean dither
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  col = pow(clamp(col, 0.0, 1.0), vec3(0.94));

  fragColor = vec4(col, 1.0);
}`,

  // Instanced 3D glowing attention / structure filaments
  lineVert: `#version 300 es
precision highp float;
layout(location = 0) in vec2 aQuad;     // x: 0..1 along segment, y: -1..+1 across width
layout(location = 1) in vec3 iPosA;
layout(location = 2) in vec3 iPosB;
layout(location = 3) in vec4 iColor;    // rgb + alpha
layout(location = 4) in float iWidth;

uniform mat4 uProjView;
uniform vec2 uRes;

out vec2 vEdge;
out vec4 vCol;

void main() {
  vec4 clipA = uProjView * vec4(iPosA, 1.0);
  vec4 clipB = uProjView * vec4(iPosB, 1.0);

  // Guard behind-camera clipping
  if (clipA.w <= 0.05 || clipB.w <= 0.05 || iColor.a <= 0.002) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vCol = vec4(0.0);
    vEdge = vec2(0.0);
    return;
  }

  vec2 ndcA = clipA.xy / clipA.w;
  vec2 ndcB = clipB.xy / clipB.w;
  vec2 screenDir = (ndcB - ndcA) * uRes * 0.5;
  float len = length(screenDir);
  vec2 dir = len > 0.0001 ? screenDir / len : vec2(1.0, 0.0);
  vec2 perp = vec2(-dir.y, dir.x);

  vec4 clip = mix(clipA, clipB, aQuad.x);
  vec2 offsetNdc = (perp * aQuad.y * iWidth) / (uRes * 0.5);
  clip.xy += offsetNdc * clip.w;

  gl_Position = clip;
  vEdge = aQuad;
  vCol = iColor;
}`,

  lineFrag: `#version 300 es
precision highp float;
in vec2 vEdge;
in vec4 vCol;
out vec4 fragColor;

uniform float uTime;

void main() {
  float core = exp(-vEdge.y * vEdge.y * 4.5);
  float ends = smoothstep(0.0, 0.08, vEdge.x) * smoothstep(1.0, 0.92, vEdge.x);
  // Subtle traveling light pulse along filament
  float pulse = 0.78 + 0.22 * sin(vEdge.x * 12.566 - uTime * 4.8);
  float alpha = core * ends * vCol.a * pulse;
  fragColor = vec4(vCol.rgb * alpha * 1.35, alpha);
}`,

  // Instanced 3D luminous particles / embers / atoms / stars
  particleVert: `#version 300 es
precision highp float;
layout(location = 0) in vec2 aCorner;   // -1..+1 quad corner
layout(location = 1) in vec3 iPos;
layout(location = 2) in float iSize;
layout(location = 3) in vec4 iColor;

uniform mat4 uProjView;
uniform vec2 uRes;

out vec2 vUv;
out vec4 vColor;

void main() {
  vec4 clip = uProjView * vec4(iPos, 1.0);
  if (clip.w <= 0.08 || iColor.a <= 0.002) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vUv = vec2(0.0);
    vColor = vec4(0.0);
    return;
  }

  float aspect = uRes.x / max(uRes.y, 1.0);
  // Perspective size with gentle clamp so near particles bloom softly without filling screen
  float radY = clamp((iSize / clip.w), 0.0018, 0.075);
  float radX = radY / aspect;

  clip.xy += vec2(aCorner.x * radX, aCorner.y * radY) * clip.w;
  gl_Position = clip;
  vUv = aCorner;
  vColor = iColor;
}`,

  particleFrag: `#version 300 es
precision highp float;
in vec2 vUv;
in vec4 vColor;
out vec4 fragColor;

void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;
  float halo = exp(-r2 * 3.8);
  float hotCore = exp(-r2 * 16.0);
  vec3 rgb = vColor.rgb * halo + vec3(1.0, 0.97, 0.90) * hotCore * 0.48;
  float alpha = halo * vColor.a;
  fragColor = vec4(rgb * vColor.a, alpha);
}`
};
