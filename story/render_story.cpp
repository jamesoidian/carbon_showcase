// C++20 Multi-Threaded Cinema Film Renderer for "THE HANDPRINT" (Gemini 4 Carbon)
// Renders 1280x720 @ 60fps HDR 3D formations + cave/water/sunrise shaders + optical-serif subtitles.

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <fstream>
#include <iostream>
#include <string>
#include <thread>
#include <vector>

static constexpr int W = 1280;
static constexpr int H = 720;
static constexpr int FPS = 60;
static constexpr float DURATION = 86.0f;
static constexpr int TOTAL_FRAMES = static_cast<int>(DURATION * FPS);

static inline float clampf(float x, float a, float b) {
  return x < a ? a : (x > b ? b : x);
}
static inline float smoothstepf(float e0, float e1, float x) {
  float t = clampf((x - e0) / (e1 - e0), 0.0f, 1.0f);
  return t * t * (3.0f - 2.0f * t);
}

struct Mulberry32 {
  uint32_t a;
  explicit Mulberry32(uint32_t seed) : a(seed) {}
  float next() {
    a += 0x6D2B79F5u;
    uint32_t t = a;
    t = (t ^ (t >> 15)) * (t | 1u);
    t ^= t + (t ^ (t >> 7)) * (t | 61u);
    return static_cast<float>((t ^ (t >> 14))) / 4294967296.0f;
  }
};

static inline float hash21(float px, float py) {
  float x = px * 0.1031f - std::floor(px * 0.1031f);
  float y = py * 0.1031f - std::floor(py * 0.1031f);
  float z = x;
  float d = x * (y + 33.33f) + y * (z + 33.33f) + z * (x + 33.33f);
  x += d; y += d; z += d;
  float r = (x + y) * z;
  return r - std::floor(r);
}

static float noise2(float px, float py) {
  float ix = std::floor(px), iy = std::floor(py);
  float fx = px - ix, fy = py - iy;
  float ux = fx * fx * (3.0f - 2.0f * fx);
  float uy = fy * fy * (3.0f - 2.0f * fy);
  float a = hash21(ix, iy);
  float b = hash21(ix + 1.0f, iy);
  float c = hash21(ix, iy + 1.0f);
  float d = hash21(ix + 1.0f, iy + 1.0f);
  return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy;
}

static float fbm(float px, float py) {
  float v = 0.0f, amp = 0.5f;
  for (int i = 0; i < 4; i++) {
    v += amp * noise2(px, py);
    float nx = (0.80f * px + 0.60f * py) * 2.03f + 11.7f;
    float ny = (-0.60f * px + 0.80f * py) * 2.03f + 5.3f;
    px = nx; py = ny;
    amp *= 0.5f;
  }
  return v;
}

static float sdSeg2D(float px, float py, float ax, float ay, float bx, float by) {
  float pax = px - ax, pay = py - ay;
  float bax = bx - ax, bay = by - ay;
  float h = clampf((pax * bax + pay * bay) / (bax * bax + bay * bay), 0.0f, 1.0f);
  return std::hypot(pax - bax * h, pay - bay * h);
}

static float smin2D(float a, float b, float k) {
  float h = std::max(k - std::fabs(a - b), 0.0f) / k;
  return std::min(a, b) - h * h * k * 0.25f;
}

static float sdHandprint(float px, float py) {
  float sx = px * 1.18f;
  float sy = (py - 0.03f) * 1.18f;
  float ca = std::cos(0.06f), sa = std::sin(0.06f);
  float qx = ca * sx + sa * sy;
  float qy = -sa * sx + ca * sy;

  float dPalm = std::hypot(qx * 1.08f, (qy + 0.09f) * 0.94f) - 0.145f;
  float dWrist = sdSeg2D(qx, qy, -0.01f, -0.18f, -0.02f, -0.32f) - 0.082f;
  float d = smin2D(dPalm, dWrist, 0.075f);

  d = smin2D(d, sdSeg2D(qx, qy, -0.10f, -0.10f, -0.27f, 0.04f) - 0.031f, 0.042f);
  d = smin2D(d, sdSeg2D(qx, qy, -0.085f, 0.01f, -0.145f, 0.255f) - 0.027f, 0.038f);
  d = smin2D(d, sdSeg2D(qx, qy, -0.020f, 0.03f, -0.022f, 0.305f) - 0.028f, 0.038f);
  d = smin2D(d, sdSeg2D(qx, qy,  0.046f, 0.02f,  0.092f, 0.270f) - 0.026f, 0.038f);
  d = smin2D(d, sdSeg2D(qx, qy,  0.102f,-0.02f,  0.195f, 0.175f) - 0.023f, 0.038f);
  return d;
}

static float landNoise3D(float x, float y, float z) {
  float n1 = std::sin(x * 3.1f + 0.7f) * std::cos(y * 2.9f - 0.4f) * std::sin(z * 3.3f + 1.1f);
  float n2 = std::sin(x * 6.7f - z * 4.2f) * std::cos(y * 5.8f + x * 3.1f) * 0.5f;
  float n3 = std::cos(z * 11.3f + y * 8.4f) * 0.25f;
  return n1 + n2 + n3;
}

struct SubCard {
  float t0, t1;
  std::vector<uint8_t> rgba;
};

struct Cluster {
  float x, y, z;
  int domain;
};

struct LineSeg {
  float ax, ay, az, bx, by, bz, r, g, b, a, width;
};

int main(int argc, char** argv) {
  bool previewOnly = (argc > 1 && std::string(argv[1]) == "--preview");
  const std::string buildDir = "/Users/juhani/.gemini/antigravity/brain/89ee0ee7-ef1d-4586-9bcc-e66913cc9e49/scratch/story_build";
  const std::string outMp4 = "/Users/juhani/dev/carbon_showcase/story/the-handprint-film.mp4";

  // 1. Load 60fps Audio Envelopes
  std::vector<float> envelopes(TOTAL_FRAMES * 3, 0.0f);
  {
    std::ifstream ef(buildDir + "/envelopes.bin", std::ios::binary);
    if (!ef) { std::cerr << "Missing envelopes.bin\n"; return 1; }
    ef.read(reinterpret_cast<char*>(envelopes.data()), envelopes.size() * sizeof(float));
  }

  // 2. Load Pre-Rendered Optical-Serif RGBA Typography Overlays
  int numActs = 0, headerH = 0, numSubs = 0, subH = 0;
  std::vector<std::vector<uint8_t>> actHeaders;
  std::vector<SubCard> subCards;
  {
    std::ifstream of(buildDir + "/overlays.bin", std::ios::binary);
    if (!of) { std::cerr << "Missing overlays.bin\n"; return 1; }
    of.read(reinterpret_cast<char*>(&numActs), 4);
    of.read(reinterpret_cast<char*>(&headerH), 4);
    of.read(reinterpret_cast<char*>(&numSubs), 4);
    of.read(reinterpret_cast<char*>(&subH), 4);

    actHeaders.resize(numActs, std::vector<uint8_t>(W * headerH * 4));
    for (int i = 0; i < numActs; i++) {
      of.read(reinterpret_cast<char*>(actHeaders[i].data()), actHeaders[i].size());
    }
    subCards.resize(numSubs);
    for (int i = 0; i < numSubs; i++) {
      of.read(reinterpret_cast<char*>(&subCards[i].t0), 4);
      of.read(reinterpret_cast<char*>(&subCards[i].t1), 4);
      subCards[i].rgba.resize(W * subH * 4);
      of.read(reinterpret_cast<char*>(subCards[i].rgba.data()), subCards[i].rgba.size());
    }
  }

  // 3. Precompute Static Per-Pixel Backdrop Fields (20x Speedup!)
  const float aspect = static_cast<float>(W) / static_cast<float>(H);
  std::vector<float> caveRock(W * H), caveMicro(W * H), caveDHand(W * H);
  std::vector<float> starBright(W * H, 0.0f), starPhase(W * H, 0.0f);

  const unsigned nThreads = std::max(2u, std::thread::hardware_concurrency());
  {
    std::vector<std::thread> initPool;
    for (unsigned tid = 0; tid < nThreads; tid++) {
      initPool.emplace_back([&, tid]() {
        int y0 = (H * tid) / nThreads;
        int y1 = (H * (tid + 1)) / nThreads;
        for (int y = y0; y < y1; y++) {
          float py = 1.0f - (2.0f * (y + 0.5f)) / H;
          for (int x = 0; x < W; x++) {
            int idx = y * W + x;
            float px = ((2.0f * (x + 0.5f)) / W - 1.0f) * aspect;
            float r = fbm(px * 4.2f, py * 4.2f);
            float m = fbm(px * 14.5f + r * 0.45f, py * 14.5f + r * 0.45f);
            caveRock[idx] = r;
            caveMicro[idx] = m;
            caveDHand[idx] = sdHandprint(px, py - 0.02f * (r - 0.5f));

            // Static non-grid starfield for Act VI
            float sx = (px + 3.7f) * 46.0f, sy = (py + 1.9f) * 46.0f;
            float scx = std::floor(sx), scy = std::floor(sy);
            float sfx = (sx - scx) - 0.5f, sfy = (sy - scy) - 0.5f;
            float sh = hash21(scx, scy);
            if (sh > 0.966f) {
              float jx = (hash21(scx + 13.1f, scy + 13.1f) - 0.5f) * 0.65f;
              float jy = (hash21(scx + 29.7f, scy + 29.7f) - 0.5f) * 0.65f;
              float sd = std::hypot(sfx - jx, sfy - jy);
              starBright[idx] = std::exp(-sd * 22.0f) * 0.72f;
              starPhase[idx] = sh * 40.0f;
            }
          }
        }
      });
    }
    for (auto& th : initPool) th.join();
  }

  // 4. Build Exact 3D StoryWorld Formations (5,600 Particles + 480 Filaments)
  constexpr int N = 5600;
  constexpr int L = 480;
  const float phi = 3.1415926535f * (3.0f - std::sqrt(5.0f));

  Mulberry32 rng(40062026u);
  std::vector<float> seedA(N), seedB(N), seedC(N);
  for (int i = 0; i < N; i++) {
    seedA[i] = rng.next();
    seedB[i] = rng.next();
    seedC[i] = rng.next();
  }

  std::vector<float> px(N), py(N), pz(N), vx(N, 0.0f), vy(N, 0.0f), vz(N, 0.0f);
  std::vector<float> cavePos(N * 3);
  std::vector<float> handOutlinePts;

  for (int i = 0; i < N; i++) {
    if (i < 4100) {
      float bx = 0, by = 0, bd = 1;
      for (int tries = 0; tries < 45; tries++) {
        float tx = (rng.next() * 2.0f - 1.0f) * 0.58f;
        float ty = (rng.next() * 2.0f - 1.0f) * 0.54f + 0.02f;
        float d = sdHandprint(tx, ty);
        if (d > 0.002f && d < 0.22f && rng.next() < std::exp(-d * 12.0f)) {
          bx = tx; by = ty; bd = d;
          break;
        }
        bx = tx; by = ty; bd = std::fabs(d);
      }
      cavePos[i * 3 + 0] = bx;
      cavePos[i * 3 + 1] = by;
      cavePos[i * 3 + 2] = (rng.next() - 0.5f) * 0.07f + bd * 0.12f;
      if (bd < 0.032f && handOutlinePts.size() < 1800) {
        handOutlinePts.push_back(bx);
        handOutlinePts.push_back(by);
      }
    } else {
      cavePos[i * 3 + 0] = (rng.next() * 2.0f - 1.0f) * 1.45f;
      cavePos[i * 3 + 1] = (rng.next() * 2.0f - 1.0f) * 0.95f;
      cavePos[i * 3 + 2] = 0.10f + rng.next() * 1.15f;
    }
    px[i] = cavePos[i * 3 + 0];
    py[i] = cavePos[i * 3 + 1];
    pz[i] = cavePos[i * 3 + 2];
  }

  std::vector<Cluster> clusters;
  const int C = 18;
  for (int c = 0; c < C; c++) {
    float y = 1.0f - (static_cast<float>(c) / (C - 1)) * 2.0f;
    float r = std::sqrt(std::max(0.0f, 1.0f - y * y));
    float th = phi * c * 1.7f;
    float rad = 0.54f + 0.34f * (((c * 7) % 5) / 4.0f);
    clusters.push_back({std::cos(th) * r * rad * 1.32f, y * rad * 0.76f, std::sin(th) * r * rad, c % 3});
  }
  std::vector<std::pair<int, int>> clusterPairs;
  for (int a = 0; a < C; a++) {
    for (int b = a + 1; b < C; b++) {
      float d = std::hypot(clusters[a].x - clusters[b].x,
                           std::hypot(clusters[a].y - clusters[b].y, clusters[a].z - clusters[b].z));
      if (d > 0.48f && d < 1.65f) clusterPairs.push_back({a, b});
    }
  }
  while (clusterPairs.size() < 160) {
    int a = static_cast<int>(rng.next() * C) % C;
    int b = (a + 1 + static_cast<int>(rng.next() * (C - 1))) % C;
    clusterPairs.push_back({a, b});
  }

  std::vector<int> clusterIdx(N);
  std::vector<float> clusterOff(N * 3);
  for (int i = 0; i < N; i++) {
    clusterIdx[i] = i % C;
    float u = rng.next() * 6.2831853f;
    float cz = rng.next() * 2.0f - 1.0f;
    float sz = std::sqrt(std::max(0.0f, 1.0f - cz * cz));
    float rr = std::pow(rng.next(), 0.55f) * 0.16f;
    clusterOff[i * 3 + 0] = std::cos(u) * sz * rr;
    clusterOff[i * 3 + 1] = std::sin(u) * sz * rr;
    clusterOff[i * 3 + 2] = cz * rr;
  }

  const int B = 240;
  std::vector<float> backbonePts(B * 3);
  for (int k = 0; k < B; k++) {
    float s = (static_cast<float>(k) / (B - 1)) * 6.2831853f;
    float bx0 = 0.54f * std::sin(s) + 0.24f * std::cos(2.0f * s);
    float by0 = 0.40f * std::cos(s) - 0.19f * std::sin(3.0f * s);
    float bz0 = 0.38f * std::sin(2.0f * s) + 0.18f * std::cos(3.0f * s);
    backbonePts[k * 3 + 0] = bx0 + 0.075f * std::cos(s * 18.0f);
    backbonePts[k * 3 + 1] = by0 + 0.075f * std::sin(s * 18.0f);
    backbonePts[k * 3 + 2] = bz0 + 0.075f * std::cos(s * 18.0f + 1.4f);
  }

  std::vector<float> proteinPos(N * 3), proteinCol(N * 3);
  for (int i = 0; i < N; i++) {
    if (i < 420) {
      float u = rng.next() * 6.2831853f;
      float cz = rng.next() * 2.0f - 1.0f;
      float sz = std::sqrt(std::max(0.0f, 1.0f - cz * cz));
      float r = std::pow(rng.next(), 0.4f) * 0.14f;
      proteinPos[i * 3 + 0] = 0.04f + std::cos(u) * sz * r;
      proteinPos[i * 3 + 1] = -0.02f + std::sin(u) * sz * r;
      proteinPos[i * 3 + 2] = 0.08f + cz * r;
      proteinCol[i * 3 + 0] = 1.00f; proteinCol[i * 3 + 1] = 0.78f; proteinCol[i * 3 + 2] = 0.28f;
    } else {
      float t = (static_cast<float>(i - 420) / (N - 420)) * (B - 1);
      int k0 = static_cast<int>(t);
      int k1 = std::min(B - 1, k0 + 1);
      float f = t - k0;
      for (int c = 0; c < 3; c++) {
        float p0 = backbonePts[k0 * 3 + c], p1 = backbonePts[k1 * 3 + c];
        proteinPos[i * 3 + c] = p0 + (p1 - p0) * f + (rng.next() - 0.5f) * 0.042f;
      }
      float rm = static_cast<float>(k0) / B;
      proteinCol[i * 3 + 0] = 0.16f + 0.24f * rm;
      proteinCol[i * 3 + 1] = 0.92f - 0.22f * rm;
      proteinCol[i * 3 + 2] = 0.72f + 0.26f * rm;
    }
  }

  std::vector<float> earthPos(N * 3), earthCol(N * 3);
  for (int i = 0; i < N; i++) {
    if (i < 4800) {
      float y = 1.0f - (static_cast<float>(i) / 4799.0f) * 2.0f;
      float r = std::sqrt(std::max(0.0f, 1.0f - y * y));
      float th = phi * i;
      float nx = std::cos(th) * r, ny = y, nz = std::sin(th) * r;
      float land = landNoise3D(nx, ny, nz);
      bool isLand = land > 0.08f;
      float rad = isLand ? 0.76f : 0.74f;
      earthPos[i * 3 + 0] = nx * rad; earthPos[i * 3 + 1] = ny * rad; earthPos[i * 3 + 2] = nz * rad;
      if (isLand) {
        bool city = land > 0.52f;
        earthCol[i * 3 + 0] = city ? 1.0f : 0.24f;
        earthCol[i * 3 + 1] = city ? 0.82f : 0.84f;
        earthCol[i * 3 + 2] = city ? 0.38f : 0.56f;
      } else {
        earthCol[i * 3 + 0] = 0.12f; earthCol[i * 3 + 1] = 0.44f; earthCol[i * 3 + 2] = 0.92f;
      }
    } else {
      float ang = rng.next() * 6.2831853f;
      float inc = (rng.next() - 0.5f) * 1.8f;
      float rad = 0.86f + rng.next() * 0.16f;
      earthPos[i * 3 + 0] = std::cos(ang) * rad;
      earthPos[i * 3 + 1] = std::sin(ang) * std::sin(inc) * rad;
      earthPos[i * 3 + 2] = std::sin(ang) * std::cos(inc) * rad;
      earthCol[i * 3 + 0] = 0.98f; earthCol[i * 3 + 1] = 0.84f; earthCol[i * 3 + 2] = 0.48f;
    }
  }

  // Icosahedral Crystal for Act VI
  float gr = (1.0f + std::sqrt(5.0f)) * 0.5f;
  float rawIco[12][3] = {
    {-1, gr, 0}, {1, gr, 0}, {-1, -gr, 0}, {1, -gr, 0},
    {0, -1, gr}, {0, 1, gr}, {0, -1, -gr}, {0, 1, -gr},
    {gr, 0, -1}, {gr, 0, 1}, {-gr, 0, -1}, {-gr, 0, 1}
  };
  std::vector<float> crystalVerts(24 * 3);
  for (int v = 0; v < 12; v++) {
    float l = std::hypot(rawIco[v][0], std::hypot(rawIco[v][1], rawIco[v][2]));
    for (int c = 0; c < 3; c++) {
      crystalVerts[v * 3 + c] = (rawIco[v][c] / l) * 0.36f;
      crystalVerts[(v + 12) * 3 + c] = crystalVerts[v * 3 + c] * 0.52f;
    }
  }
  std::vector<std::pair<int, int>> crystalEdges;
  for (int a = 0; a < 12; a++) {
    crystalEdges.push_back({a, a + 12});
    for (int b = a + 1; b < 12; b++) {
      float d = std::hypot(crystalVerts[a * 3] - crystalVerts[b * 3],
                           std::hypot(crystalVerts[a * 3 + 1] - crystalVerts[b * 3 + 1],
                                      crystalVerts[a * 3 + 2] - crystalVerts[b * 3 + 2]));
      if (d < 0.42f) {
        crystalEdges.push_back({a, b});
        crystalEdges.push_back({a + 12, b + 12});
      }
    }
  }

  float handSegs[12][4] = {
    {-0.25f, 0.04f, -0.11f, -0.09f}, {-0.14f, 0.25f, -0.08f, 0.01f},
    {-0.02f, 0.30f, -0.02f,  0.03f}, { 0.09f, 0.27f,  0.05f, 0.02f},
    { 0.19f, 0.17f,  0.10f, -0.02f}, {-0.11f,-0.09f, -0.08f, 0.01f},
    {-0.08f, 0.01f, -0.02f,  0.03f}, {-0.02f, 0.03f,  0.05f, 0.02f},
    { 0.05f, 0.02f,  0.10f, -0.02f}, { 0.10f,-0.02f,  0.06f,-0.17f},
    { 0.06f,-0.17f, -0.05f, -0.19f}, {-0.05f,-0.19f, -0.11f,-0.09f}
  };

  std::vector<float> dawnPos(N * 3), dawnCol(N * 3);
  int outCount = std::max(2, static_cast<int>(handOutlinePts.size() / 2));
  for (int i = 0; i < N; i++) {
    if (i < 2300) {
      int idx = (i % outCount) * 2;
      dawnPos[i * 3 + 0] = handOutlinePts[idx] * 1.12f - 0.62f + (rng.next() - 0.5f) * 0.022f;
      dawnPos[i * 3 + 1] = handOutlinePts[idx + 1] * 1.12f + 0.14f + (rng.next() - 0.5f) * 0.022f;
      dawnPos[i * 3 + 2] = (rng.next() - 0.5f) * 0.10f;
      dawnCol[i * 3 + 0] = 1.0f; dawnCol[i * 3 + 1] = 0.74f; dawnCol[i * 3 + 2] = 0.36f;
    } else if (i < 4600) {
      auto e = crystalEdges[i % crystalEdges.size()];
      float f = rng.next();
      for (int c = 0; c < 3; c++) {
        float va = crystalVerts[e.first * 3 + c], vb = crystalVerts[e.second * 3 + c];
        dawnPos[i * 3 + c] = (c == 0 ? 0.62f : (c == 1 ? 0.16f : 0.0f)) + va + (vb - va) * f + (rng.next() - 0.5f) * 0.016f;
      }
      dawnCol[i * 3 + 0] = 0.48f; dawnCol[i * 3 + 1] = 0.88f; dawnCol[i * 3 + 2] = 1.0f;
    } else {
      float u = static_cast<float>(i - 4600) / (N - 4600);
      if (u < 0.45f) {
        float s = u / 0.45f;
        dawnPos[i * 3 + 0] = -0.46f + s * 0.92f;
        dawnPos[i * 3 + 1] = 0.15f + std::sin(s * 3.14159265f) * 0.16f + (rng.next() - 0.5f) * 0.05f;
        dawnPos[i * 3 + 2] = std::sin(s * 6.2831853f) * 0.10f;
      } else {
        dawnPos[i * 3 + 0] = (rng.next() * 2.0f - 1.0f) * 1.75f;
        dawnPos[i * 3 + 1] = -0.48f + rng.next() * 1.35f;
        dawnPos[i * 3 + 2] = -0.35f + rng.next() * 0.75f;
      }
      dawnCol[i * 3 + 0] = 1.0f; dawnCol[i * 3 + 1] = 0.92f; dawnCol[i * 3 + 2] = 0.76f;
    }
  }

  auto stellaratorPt = [](float u, float v, float minorScale, float* out) {
    float R0 = 0.68f, r0 = 0.20f * minorScale;
    float twist = 1.5f * u;
    float ex = r0 * 1.28f * std::cos(v), ey = r0 * 0.72f * std::sin(v);
    float rx = ex * std::cos(twist) - ey * std::sin(twist);
    float ry = ex * std::sin(twist) + ey * std::cos(twist);
    float rad = R0 + rx;
    out[0] = rad * std::cos(u);
    out[1] = ry + 0.11f * std::sin(3.0f * u);
    out[2] = rad * std::sin(u);
  };

  FILE* pipe = nullptr;
  if (!previewOnly) {
    std::string cmd = "/opt/homebrew/bin/ffmpeg -y -f rawvideo -pixel_format rgb24 -video_size 1280x720 -framerate 60 "
                      "-i - -i \"" + buildDir + "/story_score.wav\" "
                      "-c:v libx264 -preset fast -crf 17 -pix_fmt yuv420p "
                      "-c:a aac -b:a 192k -movflags +faststart -shortest \"" + outMp4 + "\" 2>/dev/null";
    pipe = popen(cmd.c_str(), "w");
    if (!pipe) { std::cerr << "Failed to open ffmpeg pipe\n"; return 1; }
  }

  std::vector<float> hdr(W * H * 3, 0.0f);
  std::vector<uint8_t> rgb(W * H * 3, 0);
  std::vector<float> pSize(N), pR(N), pG(N), pB(N), pA(N);
  std::vector<LineSeg> lines;
  lines.reserve(L);

  const float dt = 1.0f / FPS;
  const int previewFrames[] = { 240, 1260, 2370, 2750, 3090, 3420, 4230, 5010 };

  for (int frame = 0; frame < TOTAL_FRAMES; frame++) {
    float storyTime = frame * dt;
    float envL = envelopes[frame * 3 + 0];
    float envM = envelopes[frame * 3 + 1];
    float envH = envelopes[frame * 3 + 2];

    // Compute smooth act weights
    float bounds[7] = { 0.0f, 14.0f, 28.0f, 43.0f, 60.0f, 73.0f, 999.0f };
    float w[6], wSum = 0.0f;
    for (int a = 0; a < 6; a++) {
      float wIn = (a == 0) ? 1.0f : clampf((storyTime - (bounds[a] - 0.6f)) / 1.2f, 0.0f, 1.0f);
      float wOut = (a == 5) ? 1.0f : clampf(((bounds[a + 1] + 0.6f) - storyTime) / 1.2f, 0.0f, 1.0f);
      w[a] = wIn * wOut;
      wSum += w[a];
    }
    for (int a = 0; a < 6; a++) w[a] /= std::max(0.0001f, wSum);

    int actIdx = 0;
    for (int a = 5; a >= 0; a--) {
      if (storyTime >= bounds[a]) { actIdx = a; break; }
    }

    float rot3 = (storyTime - 28.0f) * 0.24f;
    float c3 = std::cos(rot3), s3 = std::sin(rot3);
    float rot4 = storyTime * 0.52f;
    float c4 = std::cos(rot4), s4 = std::sin(rot4);

    // Step 3D Particles
    float tmp[3], tmpB[3];
    for (int i = 0; i < N; i++) {
      float sa = seedA[i], sb = seedB[i], sc = seedC[i];
      float tx = 0, ty = 0, tz = 0, tr = 1, tg = 0.8f, tb = 0.5f, ta = 0.85f, tSz = 0.03f, spring = 4.6f;
      bool snap = false;

      if (storyTime < 14.0f) {
        if (i < 4100) {
          float br = 1.0f + 0.015f * std::sin(storyTime * 2.1f + sa * 12.0f) + envL * 0.022f;
          tx = cavePos[i * 3 + 0] * br;
          ty = cavePos[i * 3 + 1] * br;
          tz = cavePos[i * 3 + 2] + 0.025f * std::sin(storyTime * 1.4f + sb * 9.0f);
          tr = 0.96f; tg = 0.46f + 0.34f * sa; tb = 0.16f + 0.14f * sb;
          ta = 0.58f + 0.28f * envL; tSz = 0.028f + 0.020f * sc; spring = 6.0f;
        } else {
          float rise = std::fmod(storyTime * (0.09f + 0.08f * sa) + sb, 1.0f) * 1.9f - 0.95f;
          tx = cavePos[i * 3 + 0] + 0.12f * std::sin(storyTime * 0.9f + sc * 10.0f);
          ty = rise; tz = cavePos[i * 3 + 2];
          tr = 1.0f; tg = 0.62f + 0.25f * sb; tb = 0.24f;
          ta = (1.0f - std::fabs(rise) / 0.98f) * 0.72f; tSz = 0.034f + 0.026f * sa; spring = 3.2f;
          if (std::fabs(py[i] - ty) > 1.1f) snap = true;
        }
      } else if (storyTime < 28.0f) {
        float cyc = std::fmod(sb + (storyTime - 14.0f) * (0.24f + 0.18f * sa), 1.0f);
        if ((i % 12) == 0) {
          float y = 1.15f - cyc * 2.30f;
          float ww = 0.022f + 0.95f * y * y * (y > 0 ? 1.0f : 0.22f);
          tx = (sa - 0.5f) * 2.0f * ww; ty = y; tz = (sc - 0.5f) * 0.20f;
          tr = 1.0f; tg = 0.82f; tb = 0.38f; ta = 0.92f; tSz = 0.036f + 0.016f * envH;
        } else {
          if (cyc < 0.72f) {
            float u = cyc / 0.72f;
            float y = 1.18f * (1.0f - u) + 0.03f;
            float fun = 0.048f + 1.48f * y * y;
            float sw = u * 5.5f + sa * 6.283f;
            tx = std::cos(sw) * fun * (0.35f + 0.65f * sc); ty = y; tz = std::sin(sw) * fun * 0.42f;
            tr = 0.72f + 0.25f * sa; tg = 0.84f + 0.14f * sb; tb = 1.0f; ta = 0.68f;
          } else {
            float u = (cyc - 0.72f) / 0.28f;
            float side = (i % 2 == 0) ? 1.0f : -1.0f;
            tx = side * (0.05f + u * (0.78f + 0.55f * sa));
            ty = 0.03f - u * u * 0.52f + (sc - 0.5f) * 0.16f;
            tz = (sb - 0.5f) * 0.65f;
            tr = 0.45f; tg = 0.58f; tb = 0.82f; ta = (1.0f - u) * 0.55f;
          }
          tSz = 0.026f + 0.016f * sa;
        }
        spring = 7.5f;
        if (std::fabs(py[i] - ty) > 1.05f) snap = true;
      } else if (storyTime < 43.0f) {
        const auto& cl = clusters[clusterIdx[i]];
        float ox = cl.x + clusterOff[i * 3 + 0];
        float oy = cl.y + clusterOff[i * 3 + 1];
        float oz = cl.z + clusterOff[i * 3 + 2];
        tx = ox * c3 - oz * s3; ty = oy; tz = ox * s3 + oz * c3;
        if (cl.domain == 0) { tr = 1.0f; tg = 0.78f; tb = 0.38f; }
        else if (cl.domain == 1) { tr = 0.28f; tg = 0.95f; tb = 0.72f; }
        else { tr = 0.42f; tg = 0.80f; tb = 1.0f; }
        float snapT = clampf((storyTime - 28.15f) / 1.4f, 0.0f, 1.0f);
        spring = 1.2f + 5.8f * snapT;
        ta = 0.68f + 0.28f * envH; tSz = 0.028f + 0.020f * sc + 0.012f * envH;
      } else if (storyTime < 60.0f) {
        if (storyTime < 48.8f) {
          float ox = proteinPos[i * 3 + 0], oy = proteinPos[i * 3 + 1], oz = proteinPos[i * 3 + 2];
          tx = ox * c4 - oz * s4; tz = ox * s4 + oz * c4;
          ty = oy + 0.025f * std::sin(storyTime * 2.5f + sa * 8.0f);
          tr = proteinCol[i * 3 + 0]; tg = proteinCol[i * 3 + 1]; tb = proteinCol[i * 3 + 2];
          ta = i < 420 ? 0.95f : 0.72f; tSz = i < 420 ? (0.042f + 0.018f * envM) : 0.028f; spring = 6.8f;
        } else if (storyTime < 54.5f) {
          float u = std::fmod(sa * 6.2831853f + storyTime * 2.35f, 6.2831853f);
          float v = (5.0f / 3.0f) * u + sb * 6.2831853f;
          float rad = 0.25f + 0.70f * std::pow(sc, 0.6f);
          stellaratorPt(u, v, rad, tmp);
          float ct = std::cos(0.56f), st = std::sin(0.56f);
          float rx = tmp[0] * c4 - tmp[2] * s4, rz = tmp[0] * s4 + tmp[2] * c4;
          tx = rx; ty = tmp[1] * ct - rz * st; tz = tmp[1] * st + rz * ct;
          float ch = 1.0f - rad;
          tr = 0.68f + 0.32f * ch; tg = 0.30f + 0.62f * ch; tb = 0.98f - 0.30f * ch;
          ta = 0.74f + 0.22f * envM; tSz = 0.028f + 0.020f * ch; spring = 8.2f;
        } else {
          float ox = earthPos[i * 3 + 0], oy = earthPos[i * 3 + 1], oz = earthPos[i * 3 + 2];
          float rx = ox * c4 - oz * s4, rz = ox * s4 + oz * c4;
          float cax = std::cos(0.40f), sax = std::sin(0.40f);
          tx = rx * cax - oy * sax; ty = rx * sax + oy * cax; tz = rz;
          tr = earthCol[i * 3 + 0]; tg = earthCol[i * 3 + 1]; tb = earthCol[i * 3 + 2];
          ta = i >= 4800 ? 0.90f : 0.78f; tSz = i >= 4800 ? 0.034f : 0.027f; spring = 6.5f;
        }
      } else if (storyTime < 73.0f) {
        float beat = 1.0f + envL * 0.14f;
        if (i < 4400) {
          float h = std::pow(sa, 0.78f);
          float prof = std::sin(std::pow(h, 0.68f) * 3.14159265f) * (1.0f - 0.35f * h);
          float rad = 0.115f * prof * std::sqrt(sb) * beat;
          float ang = sc * 6.2831853f + storyTime * 1.4f;
          float sway = 0.020f * h * h * std::sin(storyTime * 3.8f - h * 5.0f);
          tx = std::cos(ang) * rad + sway; ty = -0.05f + h * 0.48f * beat; tz = std::sin(ang) * rad;
          float mMid = smoothstepf(0.06f, 0.34f, h);
          float mTip = smoothstepf(0.48f, 0.88f, h);
          tr = (0.32f + 0.68f * mMid) * (1.0f - mTip) + 0.98f * mTip;
          tg = (0.64f + 0.26f * mMid) * (1.0f - mTip) + 0.48f * mTip;
          tb = (1.00f - 0.32f * mMid) * (1.0f - mTip) + 0.16f * mTip;
          ta = (1.0f - h * 0.45f) * 0.76f; tSz = 0.026f + 0.024f * (1.0f - h); spring = 5.4f;
        } else {
          bool outer = (i % 2) == 0;
          float rR = (outer ? 0.86f : 0.56f) * (1.0f + envL * 0.04f);
          float ang = sa * 6.2831853f + storyTime * (outer ? -0.14f : 0.20f);
          tx = std::cos(ang) * rR; tz = std::sin(ang) * rR;
          ty = -0.16f + 0.05f * std::sin(ang * 2.0f + storyTime * 0.6f);
          tr = 0.85f; tg = 0.88f; tb = 0.96f; ta = 0.34f + 0.24f * envM; tSz = 0.022f; spring = 4.2f;
        }
      } else {
        float dawnT = clampf((storyTime - 73.0f) / 3.2f, 0.0f, 1.0f);
        float dx = dawnPos[i * 3 + 0], dy = dawnPos[i * 3 + 1], dz = dawnPos[i * 3 + 2];
        if (i >= 2300 && i < 4600) {
          float lx = dx - 0.62f, lz = dz;
          float ca = std::cos(storyTime * 0.32f), ssa = std::sin(storyTime * 0.32f);
          dx = 0.62f + lx * ca - lz * ssa; dz = lx * ssa + lz * ca;
        } else if (i < 2300) {
          dy += 0.014f * std::sin(storyTime * 1.6f + sa * 8.0f);
        } else if (sa > 0.45f) {
          dy += std::fmod((storyTime - 73.0f) * 0.032f * sb, 0.42f);
        }
        tx = dx; ty = dy - (1.0f - dawnT) * 0.16f; tz = dz;
        tr = dawnCol[i * 3 + 0]; tg = dawnCol[i * 3 + 1]; tb = dawnCol[i * 3 + 2];
        ta = (0.72f + 0.25f * envM) * clampf((storyTime - 72.8f) / 1.2f, 0.0f, 1.0f);
        tSz = 0.026f + 0.020f * sc; spring = 4.5f;
      }

      if (snap) {
        px[i] = tx; py[i] = ty; pz[i] = tz;
        vx[i] = vy[i] = vz[i] = 0.0f;
      } else {
        float damp = std::exp(-3.6f * dt);
        vx[i] = (vx[i] + (tx - px[i]) * spring * dt) * damp;
        vy[i] = (vy[i] + (ty - py[i]) * spring * dt) * damp;
        vz[i] = (vz[i] + (tz - pz[i]) * spring * dt) * damp;
        px[i] += vx[i] * dt; py[i] += vy[i] * dt; pz[i] += vz[i] * dt;
      }
      pSize[i] = tSz; pR[i] = tr; pG[i] = tg; pB[i] = tb; pA[i] = ta;
    }

    // Build 3D Filaments for current frame
    lines.clear();
    auto pushL = [&](float ax, float ay, float az, float bx, float by, float bz, float r, float g, float b, float a, float wd) {
      if (lines.size() < L && a > 0.005f) lines.push_back({ax, ay, az, bx, by, bz, r, g, b, a, wd});
    };

    if (actIdx == 2) {
      float appear = clampf((storyTime - 28.8f) / 2.0f, 0.0f, 1.0f);
      int nA = std::min(155, static_cast<int>(clusterPairs.size()));
      for (int k = 0; k < nA; k++) {
        const auto& ca0 = clusters[clusterPairs[k].first];
        const auto& cb0 = clusters[clusterPairs[k].second];
        float ax = ca0.x * c3 - ca0.z * s3, ay = ca0.y, az = ca0.x * s3 + ca0.z * c3;
        float bx = cb0.x * c3 - cb0.z * s3, by = cb0.y, bz = cb0.x * s3 + cb0.z * c3;
        float mx = (ax + bx) * 0.62f, my = (ay + by) * 0.62f + 0.07f, mz = (az + bz) * 0.62f;
        float wave = 0.5f + 0.5f * std::sin(storyTime * 3.4f - k * 0.37f);
        float al = appear * (0.07f + 0.42f * std::pow(wave, 4.0f) + 0.22f * envH);
        float q1x = 0.5f * (ax + mx), q1y = 0.5f * (ay + my), q1z = 0.5f * (az + mz);
        float q2x = 0.5f * (mx + bx), q2y = 0.5f * (my + by), q2z = 0.5f * (mz + bz);
        float r = 0.55f + 0.45f * wave, g = 0.82f, b = 1.0f - 0.35f * wave, wd = 1.3f + 1.4f * wave;
        pushL(ax, ay, az, q1x, q1y, q1z, r, g, b, al, wd);
        pushL(q1x, q1y, q1z, q2x, q2y, q2z, r, g, b, al, wd);
        pushL(q2x, q2y, q2z, bx, by, bz, r, g, b, al, wd);
      }
    } else if (actIdx == 3) {
      if (storyTime < 48.8f) {
        for (int k = 0; k < B - 1; k++) {
          float p0x = backbonePts[k * 3], p0y = backbonePts[k * 3 + 1], p0z = backbonePts[k * 3 + 2];
          float p1x = backbonePts[(k + 1) * 3], p1y = backbonePts[(k + 1) * 3 + 1], p1z = backbonePts[(k + 1) * 3 + 2];
          pushL(p0x * c4 - p0z * s4, p0y, p0x * s4 + p0z * c4,
                p1x * c4 - p1z * s4, p1y, p1x * s4 + p1z * c4, 0.28f, 0.96f, 0.78f, 0.48f, 2.0f);
        }
        for (int k = 0; k < B; k += 9) {
          float p0x = backbonePts[k * 3], p0y = backbonePts[k * 3 + 1], p0z = backbonePts[k * 3 + 2];
          if (std::hypot(p0x - 0.04f, std::hypot(p0y + 0.02f, p0z - 0.08f)) < 0.50f) {
            pushL(0.04f * c4 - 0.08f * s4, -0.02f, 0.04f * s4 + 0.08f * c4,
                  p0x * c4 - p0z * s4, p0y, p0x * s4 + p0z * c4, 1.0f, 0.82f, 0.32f, 0.55f + 0.25f * envM, 1.8f);
          }
        }
      } else if (storyTime < 54.5f) {
        float ct = std::cos(0.56f), st = std::sin(0.56f);
        for (int c = 0; c < 24; c++) {
          float u = (c / 24.0f) * 6.2831853f;
          for (int s = 0; s < 18; s++) {
            stellaratorPt(u, (s / 18.0f) * 6.2831853f, 1.16f, tmp);
            stellaratorPt(u, ((s + 1) / 18.0f) * 6.2831853f, 1.16f, tmpB);
            float rx0 = tmp[0] * c4 - tmp[2] * s4, rz0 = tmp[0] * s4 + tmp[2] * c4;
            float rx1 = tmpB[0] * c4 - tmpB[2] * s4, rz1 = tmpB[0] * s4 + tmpB[2] * c4;
            pushL(rx0, tmp[1] * ct - rz0 * st, tmp[1] * st + rz0 * ct,
                  rx1, tmpB[1] * ct - rz1 * st, tmpB[1] * st + rz1 * ct, 0.32f, 0.84f, 1.0f, 0.52f + 0.22f * envH, 1.9f);
          }
        }
      } else {
        float cax = std::cos(0.40f), sax = std::sin(0.40f);
        for (int o = 0; o < 14; o++) {
          float inc = (o / 14.0f) * 3.14159265f - 1.570796f;
          float rad = 0.82f + (o % 3) * 0.06f;
          for (int s = 0; s < 32; s++) {
            float a0 = (s / 32.0f) * 6.2831853f + storyTime * (o % 2 ? 0.35f : -0.28f);
            float a1 = a0 + 6.2831853f / 32.0f;
            float x0 = std::cos(a0) * rad, y0 = std::sin(a0) * std::sin(inc) * rad, z0 = std::sin(a0) * std::cos(inc) * rad;
            float x1 = std::cos(a1) * rad, y1 = std::sin(a1) * std::sin(inc) * rad, z1 = std::sin(a1) * std::cos(inc) * rad;
            float rx0 = x0 * c4 - z0 * s4, rz0 = x0 * s4 + z0 * c4;
            float rx1 = x1 * c4 - z1 * s4, rz1 = x1 * s4 + z1 * c4;
            bool gold = (o % 3) == 0;
            pushL(rx0 * cax - y0 * sax, rx0 * sax + y0 * cax, rz0,
                  rx1 * cax - y1 * sax, rx1 * sax + y1 * cax, rz1,
                  gold ? 1.0f : 0.36f, gold ? 0.80f : 0.86f, gold ? 0.38f : 1.0f, 0.34f + 0.20f * envM, 1.6f);
          }
        }
      }
    } else if (actIdx == 5) {
      float dA = clampf((storyTime - 73.2f) / 2.2f, 0.0f, 1.0f);
      if (dA > 0.01f) {
        for (int s = 0; s < 12; s++) {
          pushL(handSegs[s][0] * 1.12f - 0.62f, handSegs[s][1] * 1.12f + 0.17f, 0,
                handSegs[s][2] * 1.12f - 0.62f, handSegs[s][3] * 1.12f + 0.17f, 0, 1.0f, 0.76f, 0.38f, 0.42f * dA, 1.8f);
        }
        float ca = std::cos(storyTime * 0.32f), ssa = std::sin(storyTime * 0.32f);
        for (const auto& e : crystalEdges) {
          const float* va = &crystalVerts[e.first * 3];
          const float* vb = &crystalVerts[e.second * 3];
          pushL(0.62f + va[0] * ca - va[2] * ssa, 0.16f + va[1], va[0] * ssa + va[2] * ca,
                0.62f + vb[0] * ca - vb[2] * ssa, 0.16f + vb[1], vb[0] * ssa + vb[2] * ca, 0.45f, 0.88f, 1.0f, 0.46f * dA, 1.7f);
        }
        for (int b = 0; b < 5; b++) {
          float yOff = (b - 2) * 0.068f;
          for (int s = 0; s < 12; s++) {
            float u0 = s / 12.0f, u1 = (s + 1) / 12.0f;
            float x0 = -0.46f + u0 * 0.92f, x1 = -0.46f + u1 * 0.92f;
            float y0 = 0.16f + yOff + std::sin(u0 * 3.14159265f) * (0.13f + b * 0.018f);
            float y1 = 0.16f + yOff + std::sin(u1 * 3.14159265f) * (0.13f + b * 0.018f);
            pushL(x0, y0, 0, x1, y1, 0, 1.0f - 0.45f * u0, 0.80f + 0.10f * u0, 0.42f + 0.55f * u0, (0.24f + 0.18f * envM) * dA, 1.5f);
          }
        }
      }
    }

    // In --preview mode, skip rasterizing frames that aren't in previewFrames[]!
    if (previewOnly) {
      bool match = false;
      for (int pf : previewFrames) if (pf == frame) match = true;
      if (!match) continue;
    }

    // Multi-Threaded Pass 1: HDR Backdrop Shader
    {
      std::vector<std::thread> pool;
      for (unsigned tid = 0; tid < nThreads; tid++) {
        pool.emplace_back([&, tid]() {
          int y0 = (H * tid) / nThreads;
          int y1 = (H * (tid + 1)) / nThreads;
          for (int y = y0; y < y1; y++) {
            float pyC = 1.0f - (2.0f * (y + 0.5f)) / H;
            for (int x = 0; x < W; x++) {
              int idx = y * W + x;
              float pxC = ((2.0f * (x + 0.5f)) / W - 1.0f) * aspect;

              float cr = 0.014f, cg = 0.016f, cb = 0.024f;

              if (w[0] > 0.001f) {
                float rock = caveRock[idx], micro = caveMicro[idx], dH = caveDHand[idx];
                float flick = 0.90f + 0.10f * std::sin(storyTime * 5.7f) * std::cos(storyTime * 3.3f + 1.1f) + envL * 0.18f;
                float tx0 = 0.03f * std::sin(storyTime * 1.1f), ty0 = 0.04f * std::cos(storyTime * 0.8f);
                float tf = std::exp(-((pxC - tx0) * (pxC - tx0) + (pyC - ty0) * (pyC - ty0)) * 1.05f) * flick;

                float sbR = (0.030f + rock * 0.048f + micro * 0.018f) * (0.45f + 1.15f * tf);
                float sbG = (0.022f + rock * 0.032f + micro * 0.018f) * (0.45f + 1.15f * tf);
                float sbB = (0.020f + rock * 0.024f + micro * 0.018f) * (0.45f + 1.15f * tf);

                float rev = clampf(storyTime / 2.6f, 0.0f, 1.0f);
                float pig = smoothstepf(-0.008f, 0.016f, dH) * std::exp(-std::max(dH, 0.0f) * 4.8f) * (0.68f + 0.55f * micro) * rev;
                float rim = std::exp(-std::max(dH, 0.0f) * 12.0f);
                float ocR = 0.76f + 0.22f * rim, ocG = 0.25f + 0.41f * rim, ocB = 0.09f + 0.19f * rim;
                float boost = pig * (0.68f + 0.45f * tf + 0.28f * envL);

                float cR = sbR + ocR * boost, cG = sbG + ocG * boost, cB = sbB + ocB * boost;
                float inM = (1.0f - smoothstepf(-0.012f, 0.012f, dH)) * 0.78f * rev;
                cR = cR * (1.0f - inM) + sbR * 0.52f * inM;
                cG = cG * (1.0f - inM) + sbG * 0.52f * inM;
                cB = cB * (1.0f - inM) + sbB * 0.52f * inM;
                cr += cR * w[0]; cg += cG * w[0]; cb += cB * w[0];
              }

              if (w[1] > 0.001f) {
                float ww = 0.042f + 1.55f * pyC * pyC;
                float wg = std::exp(-std::fabs(std::fabs(pxC) - ww) * 18.0f) * std::exp(-std::fabs(pyC) * 1.6f);
                float pg = std::exp(-(pxC * pxC * 1.44f + pyC * pyC * 7.84f) * 7.5f);
                cr += (0.016f + 0.35f * wg * (0.28f + 0.25f * envH) + 0.96f * pg * (0.24f + 0.30f * envM)) * w[1];
                cg += (0.022f + 0.52f * wg * (0.28f + 0.25f * envH) + 0.74f * pg * (0.24f + 0.30f * envM)) * w[1];
                cb += (0.038f + 0.85f * wg * (0.28f + 0.25f * envH) + 0.36f * pg * (0.24f + 0.30f * envM)) * w[1];
              }

              if (w[2] > 0.001f) {
                float r = std::hypot(pxC, pyC);
                float rw = std::pow(0.5f + 0.5f * std::sin(r * 16.0f - storyTime * 2.8f), 8.0f) * std::exp(-r * 1.8f) * (0.12f + 0.35f * envH);
                float neb = caveRock[idx];
                cr += (0.020f + neb * 0.045f + rw * 0.38f + std::exp(-r * 2.4f) * 0.14f * (0.5f + 0.5f * envM)) * w[2];
                cg += (0.026f + neb * 0.055f + rw * 0.78f + std::exp(-r * 2.4f) * 0.10f * (0.5f + 0.5f * envM)) * w[2];
                cb += (0.062f + neb * 0.130f + rw * 1.00f + std::exp(-r * 2.4f) * 0.28f * (0.5f + 0.5f * envM)) * w[2];
              }

              if (w[3] > 0.001f) {
                float sp = clampf((storyTime - 43.0f) / 17.0f, 0.0f, 1.0f);
                float m1 = smoothstepf(0.28f, 0.40f, sp), m2 = smoothstepf(0.62f, 0.74f, sp);
                float aR = sp < 0.5f ? (0.04f + 0.14f * m1) : (0.18f - 0.13f * m2);
                float aG = sp < 0.5f ? (0.22f - 0.14f * m1) : (0.08f + 0.10f * m2);
                float aB = sp < 0.5f ? (0.18f + 0.16f * m1) : (0.34f + 0.04f * m2);
                float glw = std::exp(-std::hypot(pxC, pyC) * 1.45f) * (0.75f + 0.45f * envM);
                cr += (0.012f + aR * glw) * w[3];
                cg += (0.018f + aG * glw) * w[3];
                cb += (0.032f + aB * glw) * w[3];
              }

              if (w[4] > 0.001f) {
                float hY = -0.24f;
                float dF = std::hypot(pxC, (pyC - 0.14f) * 0.75f);
                float fR = 0.010f + 0.95f * std::exp(-dF * 4.2f) * (0.28f + 0.26f * envL);
                float fG = 0.011f + 0.62f * std::exp(-dF * 4.2f) * (0.28f + 0.26f * envL);
                float fB = 0.016f + 0.26f * std::exp(-dF * 4.2f) * (0.28f + 0.26f * envL);
                if (pyC < hY) {
                  float dep = hY - pyC;
                  float rip = std::sin(std::hypot(pxC, dep * 2.6f) * 34.0f - storyTime * 5.2f) * std::exp(-dep * 4.5f) * (0.35f + envL * 0.9f) * 0.025f;
                  float dRf = std::hypot((pxC + rip) * 1.35f, (2.0f * hY - pyC + rip * 0.6f - 0.14f) * 0.65f);
                  float rg = std::exp(-dRf * 4.6f) * (0.42f + 0.35f * envL) * std::exp(-dep * 1.8f);
                  float hl = std::exp(-std::fabs(pyC - hY) * 90.0f) * 0.18f;
                  fR = 0.008f + 1.00f * rg + 0.45f * hl;
                  fG = 0.012f + 0.72f * rg + 0.55f * hl;
                  fB = 0.020f + 0.36f * rg + 0.75f * hl;
                }
                cr += fR * w[4]; cg += fG * w[4]; cb += fB * w[4];
              }

              if (w[5] > 0.001f) {
                float dp = clampf((storyTime - 73.0f) / 9.5f, 0.0f, 1.0f);
                float limbY = -0.58f - 0.16f * pxC * pxC + dp * 0.08f;
                float alt = pyC - limbY;
                float bG = std::exp(-std::max(alt, -0.15f) * 4.8f) * smoothstepf(-0.06f, 0.02f, alt);
                float bC = std::exp(-std::max(alt, 0.0f) * 2.1f) * smoothstepf(-0.04f, 0.08f, alt);
                float sC = std::exp(-(pxC * pxC + (pyC - (limbY + 0.04f)) * (pyC - (limbY + 0.04f))) * 2.8f);
                float dR = 0.022f + 0.20f * bC * (0.42f + 0.45f * dp) + 1.00f * bG * (0.55f + 0.55f * dp) + 1.00f * sC * (0.28f + 0.42f * dp + 0.18f * envM);
                float dG = 0.040f + 0.56f * bC * (0.42f + 0.45f * dp) + 0.76f * bG * (0.55f + 0.55f * dp) + 0.88f * sC * (0.28f + 0.42f * dp + 0.18f * envM);
                float dB = 0.095f + 0.88f * bC * (0.42f + 0.45f * dp) + 0.38f * bG * (0.55f + 0.55f * dp) + 0.64f * sC * (0.28f + 0.42f * dp + 0.18f * envM);
                if (alt < 0.0f) {
                  float rim = std::exp(alt * 55.0f) * (0.5f + 0.5f * dp);
                  dR = 0.012f * (1.0f - rim) + 0.85f * rim;
                  dG = 0.016f * (1.0f - rim) + 0.65f * rim;
                  dB = 0.028f * (1.0f - rim) + 0.32f * rim;
                } else if (starBright[idx] > 0.0f && alt > 0.08f) {
                  float tw = (0.65f + 0.35f * std::sin(storyTime * 2.7f + starPhase[idx])) * smoothstepf(0.08f, 0.45f, alt) * starBright[idx];
                  dR += 0.95f * tw; dG += 0.92f * tw; dB += 0.85f * tw;
                }
                cr += dR * w[5]; cg += dG * w[5]; cb += dB * w[5];
              }

              hdr[idx * 3 + 0] = cr;
              hdr[idx * 3 + 1] = cg;
              hdr[idx * 3 + 2] = cb;
            }
          }
        });
      }
      for (auto& th : pool) th.join();
    }

    // Pass 2: Additive 3D Filaments (50mm Projection: Z_cam = 2.8, focal = 2.8)
    auto project = [&](float x, float y, float z, float& sx, float& sy, float& wClip) -> bool {
      wClip = 2.8f - z;
      if (wClip <= 0.12f) return false;
      float ndcX = (x * 2.8f / aspect) / wClip;
      float ndcY = (y * 2.8f) / wClip;
      sx = (ndcX * 0.5f + 0.5f) * W;
      sy = (0.5f - ndcY * 0.5f) * H;
      return true;
    };

    for (const auto& ln : lines) {
      float x0, y0, w0, x1, y1, w1;
      if (!project(ln.ax, ln.ay, ln.az, x0, y0, w0)) continue;
      if (!project(ln.bx, ln.by, ln.bz, x1, y1, w1)) continue;
      float dx = x1 - x0, dy = y1 - y0;
      float segLen = std::hypot(dx, dy);
      int steps = std::max(2, std::min(220, static_cast<int>(segLen * 1.1f)));
      int rad = std::max(1, static_cast<int>(std::ceil(ln.width + 1.0f)));
      for (int s = 0; s <= steps; s++) {
        float u = static_cast<float>(s) / steps;
        float cx = x0 + dx * u, cy = y0 + dy * u;
        int ix0 = std::max(0, static_cast<int>(cx) - rad);
        int ix1 = std::min(W - 1, static_cast<int>(cx) + rad);
        int iy0 = std::max(0, static_cast<int>(cy) - rad);
        int iy1 = std::min(H - 1, static_cast<int>(cy) + rad);
        float pulse = (0.78f + 0.22f * std::sin(u * 12.566f - storyTime * 4.8f)) * ln.a * (1.0f / steps) * (segLen * 0.65f);
        for (int yy = iy0; yy <= iy1; yy++) {
          for (int xx = ix0; xx <= ix1; xx++) {
            float d2 = ((xx - cx) * (xx - cx) + (yy - cy) * (yy - cy)) / (ln.width * ln.width);
            if (d2 < 2.2f) {
              float k = std::exp(-d2 * 2.2f) * pulse * 0.48f;
              int pIdx = (yy * W + xx) * 3;
              hdr[pIdx + 0] += ln.r * k;
              hdr[pIdx + 1] += ln.g * k;
              hdr[pIdx + 2] += ln.b * k;
            }
          }
        }
      }
    }

    // Pass 3: Additive 3D Soft-Core Luminous Particles
    for (int i = 0; i < N; i++) {
      float sx, sy, wClip;
      if (!project(px[i], py[i], pz[i], sx, sy, wClip)) continue;
      float radNdc = clampf(pSize[i] / wClip, 0.002f, 0.065f);
      float radPx = radNdc * (H * 0.5f);
      int ir = std::max(1, static_cast<int>(std::ceil(radPx)));
      int ix0 = std::max(0, static_cast<int>(sx) - ir);
      int ix1 = std::min(W - 1, static_cast<int>(sx) + ir);
      int iy0 = std::max(0, static_cast<int>(sy) - ir);
      int iy1 = std::min(H - 1, static_cast<int>(sy) + ir);
      float invR2 = 1.0f / std::max(1.0f, radPx * radPx);
      float al = pA[i] * 0.52f;
      for (int yy = iy0; yy <= iy1; yy++) {
        float dy2 = (yy - sy) * (yy - sy);
        for (int xx = ix0; xx <= ix1; xx++) {
          float r2 = ((xx - sx) * (xx - sx) + dy2) * invR2;
          if (r2 < 1.0f) {
            float halo = std::exp(-r2 * 3.8f);
            float core = std::exp(-r2 * 16.0f) * 0.45f;
            int pIdx = (yy * W + xx) * 3;
            hdr[pIdx + 0] += (pR[i] * halo + core) * al;
            hdr[pIdx + 1] += (pG[i] * halo + 0.96f * core) * al;
            hdr[pIdx + 2] += (pB[i] * halo + 0.90f * core) * al;
          }
        }
      }
    }

    // Multi-Threaded Pass 4: ACES Filmic Tonemap + Cinema Vignette -> RGB8
    {
      std::vector<std::thread> pool;
      for (unsigned tid = 0; tid < nThreads; tid++) {
        pool.emplace_back([&, tid]() {
          int y0 = (H * tid) / nThreads;
          int y1 = (H * (tid + 1)) / nThreads;
          for (int y = y0; y < y1; y++) {
            float vyN = (2.0f * y) / H - 1.0f;
            for (int x = 0; x < W; x++) {
              float vxN = (2.0f * x) / W - 1.0f;
              float vig = 1.0f - 0.22f * (vxN * vxN + vyN * vyN);
              int pIdx = (y * W + x) * 3;
              for (int c = 0; c < 3; c++) {
                float v = hdr[pIdx + c] * vig;
                v = (v * (2.51f * v + 0.03f)) / (v * (2.43f * v + 0.59f) + 0.14f);
                v = std::pow(clampf(v, 0.0f, 1.0f), 0.94f);
                rgb[pIdx + c] = static_cast<uint8_t>(v * 255.0f + 0.5f);
              }
            }
          }
        });
      }
      for (auto& th : pool) th.join();
    }

    // Pass 5: Composite Top Act Indicator + Lower-Third Optical-Serif Subtitles
    const auto& hdrStrip = actHeaders[actIdx];
    for (int y = 0; y < headerH; y++) {
      for (int x = 0; x < W; x++) {
        int sIdx = (y * W + x) * 4;
        uint8_t a = hdrStrip[sIdx + 3];
        if (a > 0) {
          float af = (a / 255.0f) * 0.92f;
          int dIdx = (y * W + x) * 3;
          rgb[dIdx + 0] = static_cast<uint8_t>(rgb[dIdx + 0] * (1.0f - af) + hdrStrip[sIdx + 0] * af);
          rgb[dIdx + 1] = static_cast<uint8_t>(rgb[dIdx + 1] * (1.0f - af) + hdrStrip[sIdx + 1] * af);
          rgb[dIdx + 2] = static_cast<uint8_t>(rgb[dIdx + 2] * (1.0f - af) + hdrStrip[sIdx + 2] * af);
        }
      }
    }

    for (const auto& sc : subCards) {
      if (storyTime >= sc.t0 && storyTime <= sc.t1) {
        float fade = std::min(1.0f, std::min((storyTime - sc.t0) / 0.45f, (sc.t1 - storyTime) / 0.45f));
        int yBase = H - subH - 28;
        for (int y = 0; y < subH; y++) {
          for (int x = 0; x < W; x++) {
            int sIdx = (y * W + x) * 4;
            uint8_t a = sc.rgba[sIdx + 3];
            if (a > 0) {
              float af = (a / 255.0f) * fade;
              int dIdx = ((yBase + y) * W + x) * 3;
              rgb[dIdx + 0] = static_cast<uint8_t>(rgb[dIdx + 0] * (1.0f - af) + sc.rgba[sIdx + 0] * af);
              rgb[dIdx + 1] = static_cast<uint8_t>(rgb[dIdx + 1] * (1.0f - af) + sc.rgba[sIdx + 1] * af);
              rgb[dIdx + 2] = static_cast<uint8_t>(rgb[dIdx + 2] * (1.0f - af) + sc.rgba[sIdx + 2] * af);
            }
          }
        }
        break;
      }
    }

    // Subtle film fade-in (0..0.8s) and gentle hold/fade at 85.4..86.0s
    float masterFade = std::min(clampf(storyTime / 0.8f, 0.0f, 1.0f), clampf((DURATION - storyTime) / 0.6f, 0.15f, 1.0f));
    if (masterFade < 0.999f) {
      for (size_t k = 0; k < rgb.size(); k++) {
        rgb[k] = static_cast<uint8_t>(rgb[k] * masterFade);
      }
    }

    if (previewOnly) {
      std::string ppm = buildDir + "/frame_" + std::to_string(frame) + ".ppm";
      FILE* fp = std::fopen(ppm.c_str(), "wb");
      if (fp) {
        std::fprintf(fp, "P6\n%d %d\n255\n", W, H);
        std::fwrite(rgb.data(), 1, rgb.size(), fp);
        std::fclose(fp);
      }
    } else {
      std::fwrite(rgb.data(), 1, rgb.size(), pipe);
      if (frame % 600 == 0 || frame == TOTAL_FRAMES - 1) {
        std::cout << "Rendered frame " << frame << " / " << TOTAL_FRAMES
                  << " (" << static_cast<int>((100.0f * frame) / TOTAL_FRAMES) << "%)\n";
      }
    }
  }

  if (pipe) pclose(pipe);
  std::cout << (previewOnly ? "✓ Preview keyframes written.\n" : "✓ Master MP4 film encoded: " + outMp4 + "\n");
  return 0;
}
