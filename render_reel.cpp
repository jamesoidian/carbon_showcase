// Multi-threaded C++20 60fps Renderer + 48kHz Stereo Physical-Modeling Audio Synth
// Generates the 15.0s (900 frames @ 60fps, 1280x720) "GEMINI 4 CARBON" Launch Reel

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <algorithm>
#include <array>
#include <atomic>
#include <fstream>
#include <iostream>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

static constexpr int W = 1280;
static constexpr int H = 720;
static constexpr int FPS = 60;
static constexpr int TOTAL_FRAMES = 900; // 15.0 seconds @ 60fps
static constexpr int SAMPLE_RATE = 48000;

struct Vec3 {
  float x, y, z;
  Vec3 operator+(const Vec3& o) const { return {x + o.x, y + o.y, z + o.z}; }
  Vec3 operator-(const Vec3& o) const { return {x - o.x, y - o.y, z - o.z}; }
  Vec3 operator*(float s) const { return {x * s, y * s, z * s}; }
  Vec3 operator*(const Vec3& o) const { return {x * o.x, y * o.y, z * o.z}; }
};

inline float dot(const Vec3& a, const Vec3& b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
inline Vec3 cross(const Vec3& a, const Vec3& b) {
  return {a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x};
}
inline float length(const Vec3& v) { return std::sqrt(dot(v, v)); }
inline Vec3 normalize(const Vec3& v) {
  float l = length(v);
  return l > 1e-7f ? Vec3{v.x / l, v.y / l, v.z / l} : Vec3{0, 1, 0};
}
inline float clampf(float v, float lo, float hi) { return std::max(lo, std::min(hi, v)); }
inline float smoothstep(float e0, float e1, float x) {
  float t = clampf((x - e0) / (e1 - e0), 0.0f, 1.0f);
  return t * t * (3.0f - 2.0f * t);
}
inline Vec3 mixv(const Vec3& a, const Vec3& b, float t) {
  return a * (1.0f - t) + b * t;
}
inline Vec3 reflectv(const Vec3& I, const Vec3& N) {
  return I - N * (2.0f * dot(I, N));
}
inline bool refractv(const Vec3& I, const Vec3& N, float eta, Vec3& out) {
  float cosi = -dot(I, N);
  float k = 1.0f - eta * eta * (1.0f - cosi * cosi);
  if (k < 0.0f) return false;
  out = normalize(I * eta + N * (eta * cosi - std::sqrt(k)));
  return true;
}

// ============================================================================
// MINIMAL CRISP 5x7 BITMAP FONT FOR SCIENTIFIC CORNER HUD OVERLAY
// ============================================================================
static const uint8_t* glyph5x7(char c) {
  static const uint8_t G_SP[7] = {0,0,0,0,0,0,0};
  static const uint8_t G_A[7] = {0x0E,0x11,0x11,0x1F,0x11,0x11,0x11};
  static const uint8_t G_B[7] = {0x1E,0x11,0x11,0x1E,0x11,0x11,0x1E};
  static const uint8_t G_C[7] = {0x0E,0x11,0x10,0x10,0x10,0x11,0x0E};
  static const uint8_t G_D[7] = {0x1E,0x11,0x11,0x11,0x11,0x11,0x1E};
  static const uint8_t G_E[7] = {0x1F,0x10,0x10,0x1E,0x10,0x10,0x1F};
  static const uint8_t G_F[7] = {0x1F,0x10,0x10,0x1E,0x10,0x10,0x10};
  static const uint8_t G_G[7] = {0x0E,0x11,0x10,0x17,0x11,0x11,0x0F};
  static const uint8_t G_H[7] = {0x11,0x11,0x11,0x1F,0x11,0x11,0x11};
  static const uint8_t G_I[7] = {0x0E,0x04,0x04,0x04,0x04,0x04,0x0E};
  static const uint8_t G_K[7] = {0x11,0x12,0x14,0x18,0x14,0x12,0x11};
  static const uint8_t G_L[7] = {0x10,0x10,0x10,0x10,0x10,0x10,0x1F};
  static const uint8_t G_M[7] = {0x11,0x1B,0x15,0x15,0x11,0x11,0x11};
  static const uint8_t G_N[7] = {0x11,0x19,0x15,0x13,0x11,0x11,0x11};
  static const uint8_t G_O[7] = {0x0E,0x11,0x11,0x11,0x11,0x11,0x0E};
  static const uint8_t G_P[7] = {0x1E,0x11,0x11,0x1E,0x10,0x10,0x10};
  static const uint8_t G_Q[7] = {0x0E,0x11,0x11,0x11,0x15,0x12,0x0D};
  static const uint8_t G_R[7] = {0x1E,0x11,0x11,0x1E,0x14,0x12,0x11};
  static const uint8_t G_S[7] = {0x0F,0x10,0x10,0x0E,0x01,0x01,0x1E};
  static const uint8_t G_T[7] = {0x1F,0x04,0x04,0x04,0x04,0x04,0x04};
  static const uint8_t G_U[7] = {0x11,0x11,0x11,0x11,0x11,0x11,0x0E};
  static const uint8_t G_V[7] = {0x11,0x11,0x11,0x11,0x11,0x0A,0x04};
  static const uint8_t G_Y[7] = {0x11,0x11,0x0A,0x04,0x04,0x04,0x04};
  static const uint8_t G_Z[7] = {0x1F,0x01,0x02,0x04,0x08,0x10,0x1F};
  static const uint8_t G_0[7] = {0x0E,0x11,0x13,0x15,0x19,0x11,0x0E};
  static const uint8_t G_1[7] = {0x04,0x0C,0x04,0x04,0x04,0x04,0x0E};
  static const uint8_t G_2[7] = {0x0E,0x11,0x01,0x02,0x04,0x08,0x1F};
  static const uint8_t G_3[7] = {0x1E,0x01,0x01,0x0E,0x01,0x01,0x1E};
  static const uint8_t G_4[7] = {0x02,0x06,0x0A,0x12,0x1F,0x02,0x02};
  static const uint8_t G_5[7] = {0x1F,0x10,0x1E,0x01,0x01,0x11,0x0E};
  static const uint8_t G_6[7] = {0x06,0x08,0x10,0x1E,0x11,0x11,0x0E};
  static const uint8_t G_8[7] = {0x0E,0x11,0x11,0x0E,0x11,0x11,0x0E};
  static const uint8_t G_DOT[7] = {0,0,0,0x06,0x06,0,0};
  static const uint8_t G_EQ[7]  = {0,0,0x1F,0,0x1F,0,0};
  static const uint8_t G_DSH[7] = {0,0,0,0x1F,0,0,0};

  switch (c) {
    case 'A': return G_A; case 'B': return G_B; case 'C': return G_C; case 'D': return G_D;
    case 'E': return G_E; case 'F': return G_F; case 'G': return G_G; case 'H': return G_H;
    case 'I': return G_I; case 'K': return G_K; case 'L': return G_L; case 'M': return G_M;
    case 'N': return G_N; case 'O': return G_O; case 'P': return G_P; case 'Q': return G_Q; case 'R': return G_R;
    case 'S': return G_S; case 'T': return G_T; case 'U': return G_U; case 'V': return G_V;
    case 'Y': return G_Y; case 'Z': return G_Z;
    case '0': return G_0; case '1': return G_1; case '2': return G_2; case '3': return G_3;
    case '4': return G_4; case '5': return G_5; case '6': return G_6; case '8': return G_8;
    case '.': return G_DOT; case '=': return G_EQ; case '-': return G_DSH;
    default: return G_SP;
  }
}

static void drawText(uint8_t* rgb, const char* txt, int x0, int y0, int scale, uint8_t r, uint8_t g, uint8_t b, float alpha) {
  int cx = x0;
  for (int i = 0; txt[i]; i++) {
    const uint8_t* gl = glyph5x7(txt[i]);
    for (int row = 0; row < 7; row++) {
      for (int col = 0; col < 5; col++) {
        if (gl[row] & (1 << (4 - col))) {
          for (int sy = 0; sy < scale; sy++) {
            for (int sx = 0; sx < scale; sx++) {
              int px = cx + col * scale + sx;
              int py = y0 + row * scale + sy;
              if (px >= 0 && px < W && py >= 0 && py < H) {
                int idx = (py * W + px) * 3;
                rgb[idx + 0] = uint8_t(rgb[idx + 0] * (1.0f - alpha) + r * alpha);
                rgb[idx + 1] = uint8_t(rgb[idx + 1] * (1.0f - alpha) + g * alpha);
                rgb[idx + 2] = uint8_t(rgb[idx + 2] * (1.0f - alpha) + b * alpha);
              }
            }
          }
        }
      }
    }
    cx += 6 * scale + scale;
  }
}

// ============================================================================
// SCENE GEOMETRY PRECOMPUTATION (DIAMOND, GRAPHENE, C60, BIOS FIELD)
// ============================================================================
struct Plane { Vec3 n; float h; };
static std::vector<Plane> gBrilliantPlanes;

struct C60Data {
  std::vector<Vec3> verts;
  std::vector<std::pair<int, int>> edges;
  std::vector<int> order;
};
static C60Data gC60;

static constexpr int BW = 640;
static constexpr int BH = 360;
static std::vector<float> gBiosFrames; // 180 * BW * BH

static float segDist(float px, float py, float ax, float ay, float bx, float by) {
  float dx = bx - ax, dy = by - ay;
  float l2 = dx * dx + dy * dy + 1e-6f;
  float t = clampf(((px - ax) * dx + (py - ay) * dy) / l2, 0.0f, 1.0f);
  return std::hypot(px - (ax + dx * t), py - (ay + dy * t));
}

static void initStaticGeometry() {
  // 1. 32-plane Round Brilliant Crystal
  gBrilliantPlanes.push_back({{0, 1, 0}, 0.56f});
  gBrilliantPlanes.push_back({{0, -1, 0}, 0.92f});
  for (int i = 0; i < 8; i++) {
    float a = (i / 8.0f) * 6.2831853f;
    gBrilliantPlanes.push_back({normalize({std::cos(a) * std::sin(0.60f), std::cos(0.60f), std::sin(a) * std::sin(0.60f)}), 0.78f});
  }
  for (int i = 0; i < 6; i++) {
    float a = ((i + 0.5f) / 6.0f) * 6.2831853f;
    gBrilliantPlanes.push_back({normalize({std::cos(a) * std::sin(0.42f), std::cos(0.42f), std::sin(a) * std::sin(0.42f)}), 0.71f});
  }
  for (int i = 0; i < 8; i++) {
    float a = ((i + 0.25f) / 8.0f) * 6.2831853f;
    gBrilliantPlanes.push_back({normalize({std::cos(a) * std::sin(0.715f), -std::cos(0.715f), std::sin(a) * std::sin(0.715f)}), 0.70f});
  }
  for (int i = 0; i < 8; i++) {
    float a = (i / 8.0f) * 6.2831853f;
    gBrilliantPlanes.push_back({{std::cos(a), 0.0f, std::sin(a)}, 0.98f});
  }

  // 2. Exact C60 Truncated Icosahedron
  float phi = (1.0f + std::sqrt(5.0f)) * 0.5f;
  auto addEven = [&](float a, float b, float c) {
    float perms[3][3] = {{a,b,c}, {b,c,a}, {c,a,b}};
    for (auto& p : perms) {
      std::vector<float> xs = p[0] == 0 ? std::vector<float>{0} : std::vector<float>{-p[0], p[0]};
      std::vector<float> ys = p[1] == 0 ? std::vector<float>{0} : std::vector<float>{-p[1], p[1]};
      std::vector<float> zs = p[2] == 0 ? std::vector<float>{0} : std::vector<float>{-p[2], p[2]};
      for (float vx : xs) for (float vy : ys) for (float vz : zs)
        gC60.verts.push_back({vx, vy, vz});
    }
  };
  addEven(0, 1, 3 * phi);
  addEven(1, 2 + phi, 2 * phi);
  addEven(phi, 2, 2 * phi + 1);

  std::vector<std::vector<int>> adj(60);
  for (int i = 0; i < 60; i++) {
    for (int j = i + 1; j < 60; j++) {
      float d = length(gC60.verts[i] - gC60.verts[j]);
      if (std::abs(d - 2.0f) < 1e-3f) {
        adj[i].push_back(j);
        adj[j].push_back(i);
        gC60.edges.push_back({i, j});
      }
    }
  }
  for (auto [u, v] : gC60.edges) {
    bool pent = false;
    for (int a : adj[u]) if (a != v)
      for (int b : adj[v]) if (b != u)
        for (int c : adj[a]) if (c != u && c != v && std::find(adj[b].begin(), adj[b].end(), c) != adj[b].end())
          pent = true;
    gC60.order.push_back(pent ? 1 : 2);
  }
  for (auto& v : gC60.verts) v = v * 0.24f;

  // 3. Smooth geometric vector SDF for "CARBON" + real 48,000-agent Physarum simulation!
  std::vector<float> nutrient(BW * BH, 0.0f);
  // Vector stroke definitions in normalized letter boxes
  struct Seg { float x0, y0, x1, y1; };
  // 6 letters: C, A, R, B, O, N centered across BW x BH
  auto letterSegs = [](char ch) -> std::vector<Seg> {
    switch (ch) {
      case 'C': return {{0.85f,0.18f, 0.25f,0.12f}, {0.25f,0.12f, 0.12f,0.50f}, {0.12f,0.50f, 0.25f,0.88f}, {0.25f,0.88f, 0.85f,0.82f}};
      case 'A': return {{0.10f,0.90f, 0.50f,0.10f}, {0.50f,0.10f, 0.90f,0.90f}, {0.26f,0.62f, 0.74f,0.62f}};
      case 'R': return {{0.16f,0.90f, 0.16f,0.10f}, {0.16f,0.10f, 0.72f,0.10f}, {0.72f,0.10f, 0.84f,0.30f}, {0.84f,0.30f, 0.72f,0.50f}, {0.72f,0.50f, 0.16f,0.50f}, {0.48f,0.50f, 0.86f,0.90f}};
      case 'B': return {{0.16f,0.90f, 0.16f,0.10f}, {0.16f,0.10f, 0.70f,0.10f}, {0.70f,0.10f, 0.82f,0.29f}, {0.82f,0.29f, 0.68f,0.48f}, {0.68f,0.48f, 0.16f,0.48f}, {0.68f,0.48f, 0.85f,0.69f}, {0.85f,0.69f, 0.70f,0.90f}, {0.70f,0.90f, 0.16f,0.90f}};
      case 'O': return {{0.50f,0.10f, 0.84f,0.26f}, {0.84f,0.26f, 0.88f,0.50f}, {0.88f,0.50f, 0.84f,0.74f}, {0.84f,0.74f, 0.50f,0.90f}, {0.50f,0.90f, 0.16f,0.74f}, {0.16f,0.74f, 0.12f,0.50f}, {0.12f,0.50f, 0.16f,0.26f}, {0.16f,0.26f, 0.50f,0.10f}};
      case 'N': return {{0.15f,0.90f, 0.15f,0.10f}, {0.15f,0.10f, 0.85f,0.90f}, {0.85f,0.90f, 0.85f,0.10f}};
      default: return {};
    }
  };

  const char* word = "CARBON";
  std::vector<Seg> worldSegs;
  float boxW = 62.0f, boxH = 96.0f, gap = 24.0f;
  float startX = (BW - (6 * boxW + 5 * gap)) * 0.5f;
  float startY = (BH - boxH) * 0.5f;
  for (int i = 0; i < 6; i++) {
    float ox = startX + i * (boxW + gap);
    for (auto s : letterSegs(word[i])) {
      worldSegs.push_back({ox + s.x0 * boxW, startY + s.y0 * boxH, ox + s.x1 * boxW, startY + s.y1 * boxH});
    }
  }

  for (int y = 0; y < BH; y++) {
    for (int x = 0; x < BW; x++) {
      float best = 1e9f;
      for (const auto& s : worldSegs) {
        best = std::min(best, segDist(float(x), float(y), s.x0, s.y0, s.x1, s.y1));
      }
      float core = std::exp(-std::max(0.0f, best - 2.2f) * std::max(0.0f, best - 2.2f) * 0.085f);
      float halo = std::exp(-best * best * 0.0022f) * 0.32f;
      nutrient[y * BW + x] = core + halo;
    }
  }

  // Simulate 56,000 real Physarum chemotactic agents across 180 frames!
  struct Agent { float x, y, a; };
  const int NAGENTS = 56000;
  std::vector<Agent> agents(NAGENTS);
  uint32_t rng = 1337u;
  auto rnd01 = [&]() {
    rng ^= rng << 13; rng ^= rng >> 17; rng ^= rng << 5;
    return (rng & 0xFFFFFF) / float(0x1000000);
  };
  for (auto& ag : agents) {
    ag.x = rnd01() * BW;
    ag.y = rnd01() * BH;
    ag.a = rnd01() * 6.2831853f;
  }

  std::vector<float> trailA(BW * BH, 0.0f), trailB(BW * BH, 0.0f);
  gBiosFrames.resize(180 * BW * BH, 0.0f);

  auto sampleField = [&](float x, float y, float nutWeight) {
    int ix = (int(x) % BW + BW) % BW;
    int iy = (int(y) % BH + BH) % BH;
    return std::min(0.85f, trailA[iy * BW + ix]) + nutrient[iy * BW + ix] * nutWeight;
  };

  for (int step = -20; step < 180; step++) {
    float nutW = (step < 0) ? 0.25f : std::min(2.8f, 0.35f + step * 0.055f);
    for (int sub = 0; sub < 2; sub++) {
      for (auto& ag : agents) {
        float sa = 0.46f, sd = 3.6f;
        float fC = sampleField(ag.x + std::cos(ag.a) * sd, ag.y + std::sin(ag.a) * sd, nutW);
        float fL = sampleField(ag.x + std::cos(ag.a + sa) * sd, ag.y + std::sin(ag.a + sa) * sd, nutW);
        float fR = sampleField(ag.x + std::cos(ag.a - sa) * sd, ag.y + std::sin(ag.a - sa) * sd, nutW);
        float turn = 0.34f;
        if (fC >= fL && fC >= fR) ag.a += (rnd01() - 0.5f) * 0.12f;
        else if (fC < fL && fC < fR) ag.a += (rnd01() > 0.5f ? 1.0f : -1.0f) * turn;
        else if (fL > fR) ag.a += turn;
        else ag.a -= turn;

        int ix0 = (int(ag.x) % BW + BW) % BW;
        int iy0 = (int(ag.y) % BH + BH) % BH;
        float onTxt = nutrient[iy0 * BW + ix0];
        float sp = 1.25f - 0.55f * clampf(onTxt, 0.0f, 1.0f);
        ag.x = std::fmod(ag.x + std::cos(ag.a) * sp + BW, float(BW));
        ag.y = std::fmod(ag.y + std::sin(ag.a) * sp + BH, float(BH));
        trailA[int(ag.y) * BW + int(ag.x)] += 0.11f;
      }

      // 3x3 slight diffuse + decay (keeps fine vascular filaments razor-crisp!)
      for (int y = 0; y < BH; y++) {
        int ym = (y - 1 + BH) % BH, yp = (y + 1) % BH;
        for (int x = 0; x < BW; x++) {
          int xm = (x - 1 + BW) % BW, xp = (x + 1) % BW;
          float s =
            trailA[ym * BW + xm] * 0.035f + trailA[ym * BW + x] * 0.08f + trailA[ym * BW + xp] * 0.035f +
            trailA[y  * BW + xm] * 0.080f + trailA[y  * BW + x] * 0.54f + trailA[y  * BW + xp] * 0.080f +
            trailA[yp * BW + xm] * 0.035f + trailA[yp * BW + x] * 0.08f + trailA[yp * BW + xp] * 0.035f;
          trailB[y * BW + x] = std::min(1.85f, s * 0.91f);
        }
      }
      trailA.swap(trailB);
    }
    if (step >= 0) {
      std::memcpy(&gBiosFrames[step * BW * BH], trailA.data(), BW * BH * sizeof(float));
    }
  }
}

// ============================================================================
// PROCEDURAL NOISE & STUDIO ENVIRONMENT
// ============================================================================
inline float hash21(float x, float y) {
  float p3x = x * 0.1031f - std::floor(x * 0.1031f);
  float p3y = y * 0.1031f - std::floor(y * 0.1031f);
  float p3z = p3x;
  float d = p3x * (p3y + 33.33f) + p3y * (p3z + 33.33f) + p3z * (p3x + 33.33f);
  p3x += d; p3y += d; p3z += d;
  float r = (p3x + p3y) * p3z;
  return r - std::floor(r);
}

inline float vnoise(float x, float y) {
  float ix = std::floor(x), iy = std::floor(y);
  float fx = x - ix, fy = y - iy;
  fx = fx * fx * (3.0f - 2.0f * fx);
  fy = fy * fy * (3.0f - 2.0f * fy);
  float a = hash21(ix, iy), b = hash21(ix + 1, iy);
  float c = hash21(ix, iy + 1), d = hash21(ix + 1, iy + 1);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

inline float fbm(float x, float y) {
  float v = 0.0f, amp = 0.5f;
  for (int i = 0; i < 4; i++) {
    v += amp * vnoise(x, y);
    float nx = (0.8f * x - 0.6f * y) * 2.04f;
    float ny = (0.6f * x + 0.8f * y) * 2.04f;
    x = nx; y = ny;
    amp *= 0.5f;
  }
  return v;
}

inline Vec3 jewelEnv(const Vec3& dIn, const Vec3& lightDir) {
  Vec3 d = normalize(dIn);
  Vec3 col{0.008f, 0.011f, 0.018f};
  float up = std::max(d.y, 0.0f);
  float s1 = smoothstep(0.86f, 0.94f, std::abs(std::sin(d.x * 5.2f + 0.4f))) * std::pow(up, 0.65f);
  float s2 = smoothstep(0.90f, 0.97f, std::abs(std::cos(d.z * 6.0f - 0.3f))) * std::pow(up, 0.8f);
  col = col + Vec3{0.95f, 0.97f, 1.0f} * (s1 * 2.1f + s2 * 1.7f);

  float kd = std::max(dot(d, lightDir), 0.0f);
  col = col + Vec3{1.0f, 0.98f, 0.95f} * (std::pow(kd, 90.0f) * 14.0f + std::pow(kd, 12.0f) * 1.15f);

  float rA = std::pow(std::max(dot(d, normalize({-0.85f, 0.25f, -0.45f})), 0.0f), 6.0f);
  float rB = std::pow(std::max(dot(d, normalize({0.82f, 0.15f, 0.55f})), 0.0f), 7.0f);
  col = col + Vec3{0.22f, 0.68f, 1.0f} * (rA * 1.4f) + Vec3{1.0f, 0.55f, 0.22f} * (rB * 1.0f);
  return col;
}

// ============================================================================
// PER-SCENE PIXEL SHADERS IN C++
// ============================================================================
static Vec3 renderDiamondPixel(float uvx, float uvy, float t) {
  float yaw = 0.4f + t * 0.92f;
  float pitch = 0.22f + std::sin(t * 0.8f) * 0.14f;
  float cy = std::cos(yaw), sy = std::sin(yaw);
  float cp = std::cos(pitch), sp = std::sin(pitch);

  auto rotFwd = [&](const Vec3& v) -> Vec3 {
    return {
      cy * v.x + sy * sp * v.y + sy * cp * v.z,
      cp * v.y - sp * v.z,
      -sy * v.x + cy * sp * v.y + cy * cp * v.z
    };
  };
  auto rotInv = [&](const Vec3& v) -> Vec3 {
    return {
      cy * v.x - sy * v.z,
      sy * sp * v.x + cp * v.y + cy * sp * v.z,
      sy * cp * v.x - sp * v.y + cy * cp * v.z
    };
  };

  Vec3 ro{0.0f, 0.34f, 3.25f};
  Vec3 fwd = normalize(Vec3{0.0f, -0.08f, 0.0f} - ro);
  Vec3 right = normalize(cross(fwd, {0, 1, 0}));
  Vec3 up = cross(right, fwd);
  Vec3 rd = normalize(fwd * 1.82f + right * uvx + up * uvy);
  Vec3 lightDir = normalize({std::sin(0.55f + t * 0.3f) * 0.68f, 0.72f, std::cos(0.55f + t * 0.3f) * 0.68f});

  // Floor + shimmering refracted rainbow caustic arcs
  Vec3 color{0.013f, 0.017f, 0.026f};
  if (rd.y < -0.002f) {
    float tF = (-1.15f - ro.y) / rd.y;
    if (tF > 0.0f && tF < 25.0f) {
      Vec3 p = ro + rd * tF;
      float r = std::hypot(p.x, p.z);
      float fade = std::exp(-r * r * 0.09f);
      float sh = smoothstep(0.25f, 1.4f, r);
      Vec3 base = Vec3{0.024f, 0.028f, 0.038f} * (0.28f + 0.72f * sh);

      // Analytic caustic petals rotating with crystal facets
      float ang = std::atan2(p.z, p.x) - yaw;
      float petalR = std::pow(std::max(0.0f, std::cos(ang * 4.0f + 0.14f)), 8.0f);
      float petalG = std::pow(std::max(0.0f, std::cos(ang * 4.0f)), 8.0f);
      float petalB = std::pow(std::max(0.0f, std::cos(ang * 4.0f - 0.14f)), 8.0f);
      float ring = std::exp(-std::pow((r - 1.55f) * 1.45f, 2.0f)) * smoothstep(0.5f, 1.1f, r);
      Vec3 caust{petalR * 0.75f, petalG * 0.65f, petalB * 0.95f};
      color = (base + caust * ring * 1.35f) * fade + color * (1.0f - fade);
    }
  }

  Vec3 roC = rotInv(ro);
  Vec3 rdC = rotInv(rd);
  float tNear = -1e9f, tFar = 1e9f;
  Vec3 nNear{0, 1, 0};
  bool hit = true;
  for (const auto& pl : gBrilliantPlanes) {
    float den = dot(pl.n, rdC);
    float dst = pl.h - dot(pl.n, roC);
    if (std::abs(den) < 1e-6f) {
      if (dst < 0) { hit = false; break; }
    } else {
      float th = dst / den;
      if (den < 0) { if (th > tNear) { tNear = th; nNear = pl.n; } }
      else { if (th < tFar) tFar = th; }
      if (tNear > tFar) { hit = false; break; }
    }
  }

  if (hit && tFar > 0.0f && tNear > 0.0f) {
    Vec3 hitC = roC + rdC * tNear;
    Vec3 nW = normalize(rotFwd(nNear));
    float cosI = clampf(dot(rd * -1.0f, nW), 0.0f, 1.0f);
    float F0 = 0.172f + (1.0f - 0.172f) * std::pow(1.0f - cosI, 5.0f);
    Vec3 reflW = reflectv(rd, nW);
    Vec3 outer = jewelEnv(reflW, lightDir) + Vec3{1, 1, 1} * (std::pow(std::max(dot(reflW, lightDir), 0.0f), 160.0f) * 6.0f);

    static const Vec3 wts[7] = {
      {0.16f, 0.00f, 0.42f}, {0.00f, 0.09f, 0.44f}, {0.00f, 0.34f, 0.14f},
      {0.05f, 0.41f, 0.00f}, {0.30f, 0.14f, 0.00f}, {0.31f, 0.02f, 0.00f}, {0.18f, 0.00f, 0.00f}
    };
    Vec3 refrSum{0, 0, 0};
    for (int w = 0; w < 7; w++) {
      float ior = 2.417f + ((w - 3) / 3.0f) * 0.068f;
      Vec3 dirC;
      if (!refractv(rdC, nNear, 1.0f / ior, dirC)) continue;
      Vec3 pC = hitC + dirC * 0.0005f;
      Vec3 accum{0, 0, 0};
      float thr = 1.0f;
      for (int b = 0; b < 5; b++) {
        float tEx = 1e9f;
        Vec3 nEx{0, 1, 0};
        for (const auto& pl : gBrilliantPlanes) {
          float den = dot(pl.n, dirC);
          if (den > 1e-5f) {
            float tx = (pl.h - dot(pl.n, pC)) / den;
            if (tx < tEx) { tEx = tx; nEx = pl.n; }
          }
        }
        pC = pC + dirC * tEx;
        Vec3 negN = nEx * -1.0f;
        Vec3 outC;
        bool canEx = refractv(dirC, negN, ior, outC);
        float cosIn = clampf(dot(dirC * -1.0f, negN), 0.0f, 1.0f);
        float sin2T = ior * ior * (1.0f - cosIn * cosIn);
        float Fin = (sin2T >= 1.0f || !canEx) ? 1.0f : (0.172f + 0.828f * std::pow(1.0f - std::sqrt(1.0f - sin2T), 5.0f));
        if (Fin < 0.999f && canEx) {
          accum = accum + jewelEnv(rotFwd(outC), lightDir) * (thr * (1.0f - Fin));
        }
        thr *= Fin;
        if (thr < 0.03f) break;
        dirC = reflectv(dirC, negN);
        pC = pC + dirC * 0.0005f;
      }
      refrSum = refrSum + accum * wts[w];
    }
    color = outer * F0 + refrSum * (1.0f - F0 * 0.65f);
  }
  return color;
}

static Vec3 renderBiosPixel(float u, float v, float tLocal) {
  int f = std::min(179, std::max(0, int(tLocal * 60.0f)));
  const float* grid = &gBiosFrames[f * BW * BH];

  float fx = clampf(u, 0.0f, 0.9999f) * (BW - 1);
  float fy = clampf(1.0f - v, 0.0f, 0.9999f) * (BH - 1);
  int x0 = int(fx), y0 = int(fy);
  int x1 = std::min(BW - 1, x0 + 1), y1 = std::min(BH - 1, y0 + 1);
  float tx = fx - x0, ty = fy - y0;

  float d00 = grid[y0 * BW + x0], d10 = grid[y0 * BW + x1];
  float d01 = grid[y1 * BW + x0], d11 = grid[y1 * BW + x1];
  float density = (d00 * (1 - tx) + d10 * tx) * (1 - ty) + (d01 * (1 - tx) + d11 * tx) * ty;

  Vec3 bg = Vec3{0.008f, 0.014f, 0.020f} * (1.0f - 0.42f * ((u - 0.5f)*(u - 0.5f) + (v - 0.5f)*(v - 0.5f)));
  Vec3 low{0.04f, 0.36f, 0.42f};
  Vec3 mid{0.18f, 0.96f, 0.80f};
  Vec3 high{1.0f, 0.94f, 0.64f};

  Vec3 col = mixv(bg, low, smoothstep(0.04f, 0.28f, density));
  col = mixv(col, mid, smoothstep(0.24f, 0.85f, density));
  col = mixv(col, high, smoothstep(0.78f, 1.65f, density));
  return col;
}

static Vec3 renderStarforgePixel(float uvx, float uvy, float tLocal) {
  float crush = smoothstep(0.2f, 1.6f, tLocal) * (1.0f - smoothstep(1.75f, 2.0f, tLocal));
  float detonate = std::max(0.0f, tLocal - 1.65f);
  float shockR = detonate * 1.35f;
  float shockAmp = (tLocal > 1.65f) ? std::exp(-detonate * 1.8f) : 0.0f;

  float r = std::hypot(uvx, uvy);
  float ring = std::exp(-std::pow((r - shockR) * 22.0f, 2.0f)) * shockAmp;
  Vec3 shockGlow = mixv({0.45f, 0.88f, 1.0f}, {1.0f, 0.85f, 0.45f}, clampf(r, 0.0f, 1.0f)) * (ring * 1.9f);

  float px = uvx, py = uvy;
  if (r > 0.002f) {
    px -= (uvx / r) * ring * 0.035f;
    py -= (uvy / r) * ring * 0.035f;
  }
  float rl = std::hypot(px, py);
  float einstein = 0.026f + crush * 0.040f;
  float lensFactor = 1.0f - einstein / (rl * rl + 0.022f);
  float lx = px * lensFactor, ly = py * lensFactor;

  // Starfield + nebula with organic 2D cell jitter
  Vec3 col{0.007f, 0.010f, 0.020f};
  float neb = fbm(lx * 2.6f + 1.1f, ly * 2.6f - 0.5f);
  col = col + mixv({0.045f, 0.02f, 0.085f}, {0.01f, 0.065f, 0.12f}, neb) * smoothstep(0.35f, 0.85f, neb);

  for (int layer = 1; layer <= 2; layer++) {
    float sc = layer * 20.0f;
    float sgx = lx * sc, sgy = ly * sc;
    float ix = std::floor(sgx), iy = std::floor(sgy);
    float sid = hash21(ix + layer * 17.3f, iy - layer * 31.7f);
    if (sid > 0.78f) {
      float jx = hash21(ix + 5.1f, iy + 9.2f) * 0.6f - 0.3f;
      float jy = hash21(ix + 13.7f, iy + 2.8f) * 0.6f - 0.3f;
      float dx = (sgx - ix) - 0.5f - jx;
      float dy = (sgy - iy) - 0.5f - jy;
      float br = std::exp(-(dx*dx + dy*dy) * 190.0f) * (sid - 0.76f) * 5.2f;
      Vec3 stCol = mixv({1.0f, 0.80f, 0.60f}, {0.68f, 0.86f, 1.0f}, hash21(ix * 2.1f, iy * 3.7f));
      col = col + stCol * br;
    }
  }

  // Roaring 10^8 K Triple-Alpha core
  float coreRad = 0.21f - crush * 0.075f;
  float ang = std::atan2(py, px);
  float turb = fbm(rl * 7.5f - tLocal * 0.9f, ang * 3.0f + tLocal * 0.35f);
  float corona = std::exp(-std::max(rl - coreRad * 0.7f, 0.0f) * 4.8f);
  float mask = smoothstep(coreRad * 1.38f, coreRad * 0.25f, rl - (turb - 0.5f) * 0.055f);

  Vec3 plasma = mixv({1.0f, 0.52f, 0.12f}, {0.78f, 0.92f, 1.0f}, clampf(mask + crush * 0.4f, 0.0f, 1.0f));
  col = col * (1.0f - mask * 0.94f) + plasma * (mask * (2.3f + crush * 1.8f) + corona * 1.1f) + shockGlow;
  return col;
}

// ============================================================================
// 2D SOFT RASTERIZER FOR 3D MOLECULAR SCENES (GRAPHENE & FULLERENE C60)
// ============================================================================
static void splatLine(std::vector<Vec3>& hdr, float x0, float y0, float x1, float y1, float radiusPx, const Vec3& col, bool doubleRail = false) {
  int minX = std::max(0, int(std::min(x0, x1) - radiusPx * 2.2f));
  int maxX = std::min(W - 1, int(std::max(x0, x1) + radiusPx * 2.2f));
  int minY = std::max(0, int(std::min(y0, y1) - radiusPx * 2.2f));
  int maxY = std::min(H - 1, int(std::max(y0, y1) + radiusPx * 2.2f));

  float dx = x1 - x0, dy = y1 - y0;
  float len2 = dx * dx + dy * dy + 1e-4f;
  for (int y = minY; y <= maxY; y++) {
    for (int x = minX; x <= maxX; x++) {
      float t = clampf(((x - x0) * dx + (y - y0) * dy) / len2, 0.0f, 1.0f);
      float dist = std::hypot(x - (x0 + dx * t), y - (y0 + dy * t));
      float u = dist / radiusPx;
      float w = doubleRail
        ? (std::exp(-std::pow((std::abs(u) - 0.48f) * 2.8f, 2.0f)) * 0.85f + std::exp(-u * u * 1.8f) * 0.35f)
        : std::exp(-u * u * 1.9f);
      if (w > 0.005f) {
        hdr[y * W + x] = hdr[y * W + x] + col * w;
      }
    }
  }
}

static void splatSphere(std::vector<Vec3>& hdr, float cx, float cy, float radiusPx, const Vec3& baseCol, const Vec3& rimCol) {
  int minX = std::max(0, int(cx - radiusPx * 1.3f));
  int maxX = std::min(W - 1, int(cx + radiusPx * 1.3f));
  int minY = std::max(0, int(cy - radiusPx * 1.3f));
  int maxY = std::min(H - 1, int(cy + radiusPx * 1.3f));

  for (int y = minY; y <= maxY; y++) {
    for (int x = minX; x <= maxX; x++) {
      float qx = (x - cx) / radiusPx;
      float qy = (cy - y) / radiusPx;
      float r2 = qx * qx + qy * qy;
      if (r2 <= 1.0f) {
        float z = std::sqrt(1.0f - r2);
        float diff = std::max(0.0f, -0.42f * qx + 0.62f * qy + 0.66f * z) * 0.85f + 0.2f;
        float spec = std::pow(std::max(0.0f, -0.22f * qx + 0.35f * qy + 0.91f * z), 28.0f);
        float fres = std::pow(1.0f - z, 3.0f);
        float edge = smoothstep(1.0f, 0.82f, r2);
        Vec3 c = baseCol * diff + Vec3{1, 1, 1} * (spec * 0.9f) + rimCol * fres;
        hdr[y * W + x] = mixv(hdr[y * W + x], c, edge);
      } else if (r2 < 1.65f) {
        float glow = std::exp(-(r2 - 1.0f) * 6.5f) * 0.28f;
        hdr[y * W + x] = hdr[y * W + x] + rimCol * glow;
      }
    }
  }
}

static void renderGrapheneFrame(std::vector<Vec3>& hdr, float tLocal) {
  float aspect = float(W) / float(H);
  for (int y = 0; y < H; y++) {
    for (int x = 0; x < W; x++) {
      float px = ((x + 0.5f) / W - 0.5f) * aspect;
      float py = 0.5f - (y + 0.5f) / H;
      float r = std::hypot(px, py);
      hdr[y * W + x] = mixv({0.030f, 0.048f, 0.078f}, {0.007f, 0.010f, 0.018f}, smoothstep(0.0f, 0.95f, r));
    }
  }

  auto proj = [&](Vec3 p) -> std::array<float, 3> {
    float yaw = -0.25f + tLocal * 0.16f;
    float pitch = 0.56f;
    float cy = std::cos(yaw), sy = std::sin(yaw);
    float cp = std::cos(pitch), sp = std::sin(pitch);
    float x1 = cy * p.x + sy * p.z;
    float z1 = -sy * p.x + cy * p.z;
    float y2 = cp * p.y - sp * z1;
    float z2 = sp * p.y + cp * z1 + 4.35f;
    float f = 1.95f;
    float sx = ((x1 * f / (z2 * aspect)) * 0.5f + 0.5f) * W;
    float sy2 = (0.5f - (y2 * f / z2) * 0.5f) * H;
    return {sx, sy2, z2};
  };

  struct GAtom { Vec3 p; float strain; };
  std::vector<GAtom> atoms;
  float a = 0.27f;
  float dx = a * std::sqrt(3.0f), dz = a * 1.5f;
  float waveR = tLocal * 1.45f;

  for (int r = 0; r < 13; r++) {
    for (int c = 0; c < 13; c++) {
      for (int sub = 0; sub < 2; sub++) {
        float x = (c - 6.0f + (r % 2) * 0.5f) * dx;
        float z = (r - 6.0f) * dz + (sub ? a * 0.5f : -a * 0.5f);
        if (std::abs(x) > 2.45f || std::abs(z) > 2.05f) continue;
        float rad = std::hypot(x, z);
        float ripple = std::sin(rad * 4.2f - tLocal * 7.5f) * std::exp(-rad * 0.35f) * 0.24f;
        float ring = std::exp(-std::pow((rad - waveR) * 2.2f, 2.0f));
        float y = ripple + ring * 0.22f;
        atoms.push_back({{x, y, z}, clampf(std::abs(ripple) * 2.8f + ring * 0.9f, 0.0f, 1.0f)});
      }
    }
  }

  for (size_t i = 0; i < atoms.size(); i++) {
    for (size_t j = i + 1; j < atoms.size(); j++) {
      float d = std::hypot(atoms[i].p.x - atoms[j].p.x, atoms[i].p.z - atoms[j].p.z);
      if (d > a * 0.7f && d < a * 1.32f) {
        auto p0 = proj(atoms[i].p), p1 = proj(atoms[j].p);
        float st = 0.5f * (atoms[i].strain + atoms[j].strain);
        Vec3 col = mixv({0.20f, 0.68f, 0.98f}, {1.0f, 0.74f, 0.26f}, st);
        splatLine(hdr, p0[0], p0[1], p1[0], p1[1], 13.0f / p0[2], col, false);
      }
    }
  }

  // Depth-sort atoms back-to-front
  std::vector<size_t> order(atoms.size());
  for (size_t i = 0; i < atoms.size(); i++) order[i] = i;
  std::sort(order.begin(), order.end(), [&](size_t ia, size_t ib) {
    return proj(atoms[ia].p)[2] > proj(atoms[ib].p)[2];
  });
  for (size_t idx : order) {
    auto pr = proj(atoms[idx].p);
    Vec3 base = mixv({0.16f, 0.25f, 0.36f}, {1.0f, 0.60f, 0.22f}, atoms[idx].strain);
    Vec3 rim = mixv({0.35f, 0.86f, 1.0f}, {1.0f, 0.88f, 0.45f}, atoms[idx].strain);
    splatSphere(hdr, pr[0], pr[1], 32.0f / pr[2], base, rim);
  }
}

static void renderC60Frame(std::vector<Vec3>& hdr, float tLocal) {
  float aspect = float(W) / float(H);
  for (int y = 0; y < H; y++) {
    for (int x = 0; x < W; x++) {
      float px = ((x + 0.5f) / W - 0.5f) * aspect;
      float py = 0.5f - (y + 0.5f) / H;
      float r = std::hypot(px, py);
      hdr[y * W + x] = mixv({0.044f, 0.036f, 0.072f}, {0.008f, 0.010f, 0.018f}, smoothstep(0.0f, 0.95f, r));
    }
  }

  float yaw = tLocal * 1.05f;
  float pitch = 0.32f + std::sin(tLocal * 1.4f) * 0.2f;
  float cy = std::cos(yaw), sy = std::sin(yaw);
  float cp = std::cos(pitch), sp = std::sin(pitch);

  // Bouncing @La endohedral ion inside cage
  Vec3 ion{
    std::sin(tLocal * 4.4f) * 0.72f,
    std::cos(tLocal * 3.3f) * 0.68f,
    std::sin(tLocal * 2.7f + 1.0f) * 0.65f
  };

  auto xform = [&](Vec3 v) -> Vec3 {
    float dIon = length(v - ion);
    float push = std::exp(-dIon * dIon * 2.5f) * 0.09f;
    v = v + normalize(v) * push;
    float x1 = cy * v.x + sy * sp * v.y + sy * cp * v.z;
    float y1 = cp * v.y - sp * v.z;
    float z1 = -sy * v.x + cy * sp * v.y + cy * cp * v.z;
    return {x1, y1, z1 + 4.1f};
  };
  auto toScreen = [&](Vec3 cam) -> std::array<float, 3> {
    float f = 1.95f;
    return {((cam.x * f / (cam.z * aspect)) * 0.5f + 0.5f) * W, (0.5f - (cam.y * f / cam.z) * 0.5f) * H, cam.z};
  };

  std::vector<Vec3> camV(60);
  std::vector<float> heat(60);
  for (int i = 0; i < 60; i++) {
    camV[i] = xform(gC60.verts[i]);
    heat[i] = std::exp(-std::pow(length(gC60.verts[i] - ion) * 1.35f, 2.0f));
  }

  for (size_t e = 0; e < gC60.edges.size(); e++) {
    auto [u, v] = gC60.edges[e];
    auto p0 = toScreen(camV[u]), p1 = toScreen(camV[v]);
    float h = 0.5f * (heat[u] + heat[v]);
    float fog = clampf(1.38f - 0.5f * (p0[2] + p1[2]) * 0.10f, 0.25f, 1.0f);
    Vec3 col = mixv(gC60.order[e] == 2 ? Vec3{0.35f, 0.85f, 1.0f} : Vec3{0.22f, 0.58f, 0.86f}, Vec3{1.0f, 0.78f, 0.28f}, h) * fog;
    splatLine(hdr, p0[0], p0[1], p1[0], p1[1], (gC60.order[e] == 2 ? 19.0f : 13.0f) / p0[2], col, gC60.order[e] == 2);
  }

  struct DrawItem { Vec3 cam; float rad; Vec3 base; Vec3 rim; };
  std::vector<DrawItem> items;
  for (int i = 0; i < 60; i++) {
    float fog = clampf(1.38f - camV[i].z * 0.10f, 0.28f, 1.0f);
    items.push_back({
      camV[i], 42.0f,
      mixv({0.16f, 0.24f, 0.35f}, {1.0f, 0.62f, 0.22f}, heat[i]) * fog,
      mixv({0.35f, 0.86f, 1.0f}, {1.0f, 0.90f, 0.50f}, heat[i]) * fog
    });
  }
  Vec3 ionCam{
    cy * ion.x + sy * sp * ion.y + sy * cp * ion.z,
    cp * ion.y - sp * ion.z,
    -sy * ion.x + cy * sp * ion.y + cy * cp * ion.z + 4.1f
  };
  items.push_back({ionCam, 92.0f, {1.0f, 0.70f, 0.18f}, {1.0f, 0.96f, 0.68f}});

  std::sort(items.begin(), items.end(), [](const DrawItem& a, const DrawItem& b) { return a.cam.z > b.cam.z; });
  for (const auto& it : items) {
    auto pr = toScreen(it.cam);
    splatSphere(hdr, pr[0], pr[1], it.rad / pr[2], it.base, it.rim);
  }
}

// ============================================================================
// RENDER ONE FULL 1280x720 FRAME
// ============================================================================
static void renderFrame(int fIdx, uint8_t* outRgb) {
  float t = float(fIdx) / FPS; // 0..15.0s
  int scene = std::min(4, int(t / 3.0f));
  float tLocal = t - scene * 3.0f;
  float aspect = float(W) / float(H);

  // Subtle transition flash at 3.0, 6.0, 9.0, 12.0s
  float flash = 0.0f;
  if (fIdx > 0 && tLocal < 0.28f) flash = (1.0f - tLocal / 0.28f) * 0.48f;

  std::vector<Vec3> hdr(W * H);

  if (scene == 1) {
    renderGrapheneFrame(hdr, tLocal);
  } else if (scene == 2) {
    renderC60Frame(hdr, tLocal);
  } else {
    for (int y = 0; y < H; y++) {
      float v = 1.0f - (y + 0.5f) / H;
      float uvy = v * 2.0f - 1.0f;
      for (int x = 0; x < W; x++) {
        float u = (x + 0.5f) / W;
        float uvx = (u * 2.0f - 1.0f) * aspect;
        if (scene == 0) hdr[y * W + x] = renderDiamondPixel(uvx, uvy, tLocal);
        else if (scene == 3) hdr[y * W + x] = renderBiosPixel(u, v, tLocal);
        else hdr[y * W + x] = renderStarforgePixel(uvx, uvy, tLocal);
      }
    }
    if (scene == 4) {
      float crush = smoothstep(0.2f, 1.6f, tLocal) * (1.0f - smoothstep(1.75f, 2.0f, tLocal));
      float burst = std::max(0.0f, tLocal - 1.65f);
      for (int p = 0; p < 85; p++) {
        float seed = float(p) * 1.6180339f;
        float baseR = 0.28f + std::fmod(seed * 0.73f, 1.25f);
        float rOrb = baseR * (1.0f - crush * 0.48f) + (p % 3 == 0 ? burst * 0.85f : 0.0f);
        float ang = seed * 6.28f + tLocal * (1.5f + 1.1f / (baseR + 0.2f));
        float inc = std::sin(seed * 3.1f) * 0.45f;
        float wx = std::cos(ang) * rOrb;
        float wy = std::sin(ang) * std::sin(inc) * rOrb;
        float wz = std::sin(ang) * std::cos(inc) * rOrb + 4.2f;
        float sx = ((wx * 1.95f / (wz * aspect)) * 0.5f + 0.5f) * W;
        float sy2 = (0.5f - (wy * 1.95f / wz) * 0.5f) * H;
        bool isC12 = (tLocal > 1.65f && (p % 3 == 0));
        bool isBe8 = (!isC12 && (p % 9 == 0));
        Vec3 bCol = isC12 ? Vec3{0.32f, 0.92f, 1.0f} : (isBe8 ? Vec3{0.88f, 0.24f, 1.0f} : Vec3{1.0f, 0.68f, 0.18f});
        Vec3 rCol = isC12 ? Vec3{1.0f, 1.0f, 1.0f}    : (isBe8 ? Vec3{1.0f, 0.75f, 1.0f} : Vec3{1.0f, 0.95f, 0.65f});
        float radPx = (isC12 ? 36.0f : (isBe8 ? 28.0f : 19.0f)) / wz;
        splatSphere(hdr, sx, sy2, radPx, bCol, rCol);
      }
    }
  }

  // ACES tonemap + gamma + flash
  for (int i = 0; i < W * H; i++) {
    Vec3 c = hdr[i] + Vec3{0.88f, 0.94f, 1.0f} * flash;
    auto aces = [](float v) {
      v = std::max(0.0f, v);
      return (v * (2.51f * v + 0.03f)) / (v * (2.43f * v + 0.59f) + 0.14f);
    };
    float r = std::pow(clampf(aces(c.x), 0.0f, 1.0f), 1.0f / 2.2f);
    float g = std::pow(clampf(aces(c.y), 0.0f, 1.0f), 1.0f / 2.2f);
    float b = std::pow(clampf(aces(c.z), 0.0f, 1.0f), 1.0f / 2.2f);
    outRgb[i * 3 + 0] = uint8_t(r * 255.0f);
    outRgb[i * 3 + 1] = uint8_t(g * 255.0f);
    outRgb[i * 3 + 2] = uint8_t(b * 255.0f);
  }

  // Crisp minimalist scientific HUD stamp
  static const char* titles[5] = {
    "01 DIAMOND - SP3 PRISM RAYTRACER",
    "02 GRAPHENE - SP2 QUANTUM LATTICE",
    "03 FULLERENE - C60 GEODESIC CAGE",
    "04 BIOS - 65K GPU MORPHOGENESIS",
    "05 STARFORGE - TRIPLE ALPHA FUSION"
  };
  drawText(outRgb, "GEMINI 4 CARBON  Z = 6", 34, 30, 2, 240, 246, 255, 0.88f);
  drawText(outRgb, titles[scene], 34, H - 44, 2, 125, 211, 252, 0.86f);
  drawText(outRgb, "0 LIBS - 0 ASSETS - 1 HTML FILE", W - 445, H - 44, 2, 180, 198, 220, 0.72f);
}

// ============================================================================
// 48 kHz STEREO PHYSICAL-MODELING WAV SYNTHESIZER (MATCHING ALL 5 SCENES!)
// ============================================================================
static void writeStereoWav(const std::string& wavPath) {
  const int totalSamples = TOTAL_FRAMES * (SAMPLE_RATE / FPS); // 720,000 stereo frames
  std::vector<float> L(totalSamples, 0.0f), R(totalSamples, 0.0f);

  auto addModalNote = [&](float startSec, float freq, float dur, float amp, float pan, const std::vector<float>& ratios) {
    int s0 = int(startSec * SAMPLE_RATE);
    int len = int(dur * SAMPLE_RATE);
    float gL = std::sqrt(0.5f * (1.0f - pan));
    float gR = std::sqrt(0.5f * (1.0f + pan));
    for (size_t m = 0; m < ratios.size(); m++) {
      float f = freq * ratios[m];
      if (f > 16000.0f) continue;
      float mAmp = amp / (1.0f + m * 1.4f);
      float dec = dur / (1.0f + m * 0.55f);
      double ph = 0.0, dph = 6.28318530718 * f / SAMPLE_RATE;
      for (int i = 0; i < len && (s0 + i) < totalSamples; i++) {
        float t = float(i) / SAMPLE_RATE;
        float att = std::min(1.0f, t / 0.005f);
        float env = att * std::exp(-t * 4.2f / dec);
        float s = float(std::sin(ph)) * mAmp * env;
        ph += dph;
        L[s0 + i] += s * gL;
        R[s0 + i] += s * gR;
      }
    }
  };

  // Continuous warm evolving harmonic pad + scene transitions
  for (int i = 0; i < totalSamples; i++) {
    float t = float(i) / SAMPLE_RATE;
    // Smooth loop envelope at start/end
    float masterFade = smoothstep(0.0f, 0.25f, t) * smoothstep(15.0f, 14.55f, t);
    float pad = 0.045f * (
      std::sin(6.2831853f * 146.83f * t) +
      0.7f * std::sin(6.2831853f * 220.00f * t + 0.4f) +
      0.45f * std::sin(6.2831853f * 369.99f * t)
    );
    // Starforge deep sub-bass surge in Scene 5 (12.0s..15.0s)
    if (t > 11.8f) {
      float w = smoothstep(11.8f, 12.4f, t);
      float pitchLift = 1.0f + 0.30f * smoothstep(12.2f, 13.65f, t);
      pad += w * 0.14f * std::sin(6.2831853f * 49.0f * pitchLift * t);
    }
    L[i] += pad * masterFade;
    R[i] += pad * masterFade;
  }

  // Scene 1 (0..3s): Diamond Crystal Eigenmodes (D Lydian)
  addModalNote(0.08f, 587.33f, 2.2f, 0.22f, -0.3f, {1.0f, 2.756f, 5.404f});
  addModalNote(0.32f, 739.99f, 2.0f, 0.18f,  0.35f, {1.0f, 2.756f, 5.404f});
  addModalNote(1.25f, 880.00f, 1.9f, 0.19f, -0.2f, {1.0f, 2.756f, 5.404f});
  addModalNote(1.95f, 1174.66f, 1.6f, 0.16f, 0.25f, {1.0f, 2.756f});

  // Scene 2 (3..6s): Graphene Harp Glissando (F Lydian)
  float fLyd[8] = {293.66f, 329.63f, 369.99f, 440.0f, 493.88f, 587.33f, 659.25f, 739.99f};
  for (int k = 0; k < 8; k++) {
    addModalNote(3.05f + k * 0.28f, fLyd[k], 1.15f, 0.20f, -0.6f + k * 0.17f, {1.0f, 2.0f, 3.0f, 4.0f});
  }

  // Scene 3 (6..9s): C60 Geodesic Handpan Polyrhythm (1 : 2 : 2.997)
  float panNotes[6] = {220.0f, 293.66f, 329.63f, 440.0f, 369.99f, 587.33f};
  for (int k = 0; k < 6; k++) {
    addModalNote(6.05f + k * 0.44f, panNotes[k], 1.35f, 0.22f, (k % 2 ? 0.4f : -0.4f), {1.0f, 2.0f, 2.997f});
  }

  // Scene 4 (9..12s): Bios Bioluminescent Droplets
  float bio[7] = {587.33f, 739.99f, 880.0f, 1174.66f, 987.77f, 1318.51f, 1479.98f};
  for (int k = 0; k < 7; k++) {
    addModalNote(9.08f + k * 0.36f, bio[k], 0.9f, 0.14f, std::sin(k * 1.7f) * 0.55f, {1.0f, 2.0f});
  }

  // Scene 5 (12..15s): Starforge Hoyle 7.65 MeV Supernova Detonation @ 13.65s!
  addModalNote(12.10f, 440.0f, 1.4f, 0.16f, 0.0f, {1.0f, 1.5f});
  addModalNote(13.65f, 73.42f, 1.3f, 0.34f, 0.0f, {1.0f, 2.0f});
  addModalNote(13.65f, 587.33f, 1.3f, 0.24f, -0.35f, {1.0f, 1.5f, 2.0f, 3.0f});
  addModalNote(13.72f, 880.00f, 1.2f, 0.20f,  0.35f, {1.0f, 1.5f, 2.0f});

  // Simple stereo Schroeder/velvet feedback delay shimmer + soft tanh limiter
  std::vector<float> dL(11003, 0.0f), dR(13411, 0.0f);
  int pL = 0, pR = 0;

  std::ofstream out(wavPath, std::ios::binary);
  uint32_t dataBytes = totalSamples * 4;
  uint32_t riffSize = 36 + dataBytes;
  out.write("RIFF", 4); out.write(reinterpret_cast<char*>(&riffSize), 4);
  out.write("WAVEfmt ", 8);
  uint32_t fmtLen = 16; uint16_t pcm = 1, ch = 2;
  uint32_t sr = SAMPLE_RATE, byteRate = SAMPLE_RATE * 4;
  uint16_t align = 4, bits = 16;
  out.write(reinterpret_cast<char*>(&fmtLen), 4);
  out.write(reinterpret_cast<char*>(&pcm), 2);
  out.write(reinterpret_cast<char*>(&ch), 2);
  out.write(reinterpret_cast<char*>(&sr), 4);
  out.write(reinterpret_cast<char*>(&byteRate), 4);
  out.write(reinterpret_cast<char*>(&align), 2);
  out.write(reinterpret_cast<char*>(&bits), 2);
  out.write("data", 4);
  out.write(reinterpret_cast<char*>(&dataBytes), 4);

  for (int i = 0; i < totalSamples; i++) {
    float wetL = dL[pL], wetR = dR[pR];
    dL[pL] = L[i] + wetR * 0.34f;
    dR[pR] = R[i] + wetL * 0.34f;
    pL = (pL + 1) % int(dL.size());
    pR = (pR + 1) % int(dR.size());

    float outL = std::tanh((L[i] * 0.82f + wetL * 0.32f) * 1.15f) * 0.88f;
    float outR = std::tanh((R[i] * 0.82f + wetR * 0.32f) * 1.15f) * 0.88f;
    int16_t sL = int16_t(clampf(outL, -1.0f, 1.0f) * 32760.0f);
    int16_t sR = int16_t(clampf(outR, -1.0f, 1.0f) * 32760.0f);
    out.write(reinterpret_cast<char*>(&sL), 2);
    out.write(reinterpret_cast<char*>(&sR), 2);
  }
}

int main(int argc, char** argv) {
  if (argc < 3) {
    std::cerr << "Usage: render_reel <wav_out> <raw_rgb_fifo_or_file>\n";
    return 1;
  }
  initStaticGeometry();
  writeStereoWav(argv[1]);
  std::cerr << "✓ Synthesized 48kHz stereo physical-modeling soundtrack.\n";

  const int nThreads = std::max(2u, std::thread::hardware_concurrency());
  const int batch = nThreads * 2;
  std::vector<std::vector<uint8_t>> buffers(batch, std::vector<uint8_t>(W * H * 3));

  FILE* fp = std::fopen(argv[2], "wb");
  if (!fp) return 2;

  for (int base = 0; base < TOTAL_FRAMES; base += batch) {
    int count = std::min(batch, TOTAL_FRAMES - base);
    std::atomic<int> nextIdx{0};
    std::vector<std::thread> pool;
    for (int th = 0; th < nThreads; th++) {
      pool.emplace_back([&]() {
        while (true) {
          int local = nextIdx.fetch_add(1);
          if (local >= count) break;
          renderFrame(base + local, buffers[local].data());
        }
      });
    }
    for (auto& th : pool) th.join();
    for (int i = 0; i < count; i++) {
      std::fwrite(buffers[i].data(), 1, W * H * 3, fp);
    }
    if ((base / batch) % 4 == 0) {
      std::cerr << "Rendered " << (base + count) << " / " << TOTAL_FRAMES << " frames...\n";
    }
  }
  std::fclose(fp);
  std::cerr << "✓ Completed all " << TOTAL_FRAMES << " frames.\n";
  return 0;
}
