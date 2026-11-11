// Main WebGL2 Multi-Pass Engine, GPGPU Compute, UI & MediaRecorder Controller

(function () {
  const PHASE_INFO = [
    {
      name: 'DIAMOND PRISM',
      hybrid: 'sp³ TETRAHEDRAL CRYSTAL',
      telemetry: '15.0 GPa · 1,800 K · n = 2.417',
      color: '#7dd3fc',
      pt: [0.36, 0.18], // x = T, y = P (top = high P)
      ptLabel: '15 GPa · 1.8kK',
      hint: 'Drag crystal to refract · Shift+Drag steers key beam · Click crystal to ring eigenmodes',
      prims: '32 Half-Spaces · 7λ',
      passes: 'Analytic Hull + Caustic FBO',
      audioDesc: '4-Mode Crystal Bar + Velvet IR',
      eq: 'n(λ) = 2.378 + 0.0138/λ² · 5-bounce TIR + Fresnel R(θ)'
    },
    {
      name: 'GRAPHENE SHEET',
      hybrid: 'sp² HONEYCOMB MONOLAYER',
      telemetry: '100 kPa · 300 K · d = 1.42 Å',
      color: '#38bdf8',
      pt: [0.28, 0.56],
      ptLabel: '1 atm · 300 K',
      hint: 'Sweep across bonds to pluck quantum harp · Switch to LASER CUT to cleave bonds, ANNEAL to self-heal',
      prims: '330 Atoms · ~470 σ-Bonds',
      passes: '3× Substep Verlet + Instanced 3D',
      audioDesc: 'Polyphonic F-Lydian Waveguide',
      eq: 'F_ij = -k(|r_ij| - r₀)r̂_ij · Dynamic σ-bond cleavage & radical healing'
    },
    {
      name: 'BUCKMINSTER C₆₀',
      hybrid: 'TRUNCATED ICOSAHEDRON CAGE',
      telemetry: '10⁻³ Pa · 2,400 K · I_h Symmetry',
      color: '#fbbf24',
      pt: [0.54, 0.84],
      ptLabel: 'Vacuum · 2.4kK',
      hint: 'Drag to spin · Click cage to compress icosahedral truss · Watch @La endohedral ion ricochet inside',
      prims: '60 C (30 C=C, 60 C–C) + @La',
      passes: 'Golden-Ratio Graph + Soft Truss',
      audioDesc: '1 : 2 : 2.997 Geodesic Handpan',
      eq: 'V = 60, E = 90, F = 32 (12 C₅ + 20 C₆) · Euler V - E + F = 2'
    },
    {
      name: 'ORGANIC BIOS',
      hybrid: 'C·H·N·O MORPHOGENETIC LIFE',
      telemetry: '101 kPa · 310 K · 65,536 GPU Agents',
      color: '#34d399',
      pt: [0.24, 0.52],
      ptLabel: '310 K · Habitable',
      hint: 'Move cursor to lure living filaments · Click to scatter · Type ANY word below to grow living letters',
      prims: '65,536 Autonomous GPU Agents',
      passes: 'Ping-Pong FBO + 3×3 Reaction-Diff',
      audioDesc: 'Evolving Bio-Pad + Chemotaxis Grains',
      eq: '∂C/∂t = D∇²C - λC + ∑δ(x - x_k) · 3-sensor chemotactic steering'
    },
    {
      name: 'STARFORGE CORE',
      hybrid: 'TRIPLE-ALPHA NUCLEOSYNTHESIS',
      telemetry: '10¹⁴ Pa · 1.2×10⁸ K · 7.65 MeV Hoyle',
      color: '#f472b6',
      pt: [0.90, 0.14],
      ptLabel: '10⁸ K · Red Giant',
      hint: 'Press & hold anywhere (or HOLD CRUSH) to compress stellar core and ignite runaway ¹²C fusion!',
      prims: '175 Nuclei + Lensed Plasma',
      passes: 'Schwarzschild Lens + 3α Kinetics',
      audioDesc: 'Sub-Bass Core + Hoyle Gamma Chimes',
      eq: '⁴He + ⁴He ⇌ ⁸Be* , ⁸Be* + ⁴He → ¹²C* (7.65 MeV) → ¹²C + 2γ'
    }
  ];

  const canvas = document.getElementById('glCanvas');
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: true,
    depth: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false
  });

  if (!gl) {
    document.body.innerHTML = '<div style="padding:32px;color:#fff;font-family:sans-serif">WebGL2 is required to view this interactive simulation.</div>';
    return;
  }

  gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('OES_texture_float_linear');

  // Compile & link helpers
  function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(s), src);
    }
    return s;
  }

  function createProgram(vsSrc, fsSrc) {
    const p = gl.createProgram();
    const vs = compileShader(gl.VERTEX_SHADER, vsSrc);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSrc);
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(p));
    }
    return p;
  }

  // Build all GPU shader programs
  const progDiamond = createProgram(SHADERS.fullscreenVert, SHADERS.diamondFrag);
  const progCaustic = createProgram(SHADERS.causticVert, SHADERS.causticFrag);
  const progLatticeBg = createProgram(SHADERS.fullscreenVert, SHADERS.latticeBgFrag);
  const progBond = createProgram(SHADERS.bondVert, SHADERS.bondFrag);
  const progAtom = createProgram(SHADERS.atomVert, SHADERS.atomFrag);
  const progBiosAgent = createProgram(SHADERS.fullscreenVert, SHADERS.biosAgentUpdateFrag);
  const progBiosDeposit = createProgram(SHADERS.biosDepositVert, SHADERS.biosDepositFrag);
  const progBiosDiffuse = createProgram(SHADERS.fullscreenVert, SHADERS.biosDiffuseFrag);
  const progBiosDisplay = createProgram(SHADERS.fullscreenVert, SHADERS.biosDisplayFrag);
  const progStarforge = createProgram(SHADERS.fullscreenVert, SHADERS.starforgeFrag);

  // Empty VAO for attribute-less gl_VertexID passes
  const emptyVao = gl.createVertexArray();

  // =========================================================================
  // GPU BUFFERS & VAOs FOR INSTANCED CAUSTICS, BONDS & SPHERE ATOMS
  // =========================================================================
  const audio = new CarbonAudioEngine();
  const diamondSim = new DiamondOpticsSim();
  const grapheneSim = new GrapheneSim();
  const fullereneSim = new FullereneSim();
  const starforgeSim = new StarforgeSim();

  // Shared [-1..1]^2 unit quad
  const unitQuadCentered = new Float32Array([
    -1, -1,  1, -1, -1,  1,
    -1,  1,  1, -1,  1,  1
  ]);
  // Bond quad: x in [-1, 1], y in [0, 1]
  const unitQuadBond = new Float32Array([
    -1, 0,  1, 0, -1, 1,
    -1, 1,  1, 0,  1, 1
  ]);

  const quadCenteredBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadCenteredBuf);
  gl.bufferData(gl.ARRAY_BUFFER, unitQuadCentered, gl.STATIC_DRAW);

  const quadBondBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBondBuf);
  gl.bufferData(gl.ARRAY_BUFFER, unitQuadBond, gl.STATIC_DRAW);

  // 1. Caustic FBO (256x256 RGBA8) + Instanced Splat VAO
  const CAUSTIC_RES = 256;
  const causticTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, causticTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, CAUSTIC_RES, CAUSTIC_RES, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const causticFbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, causticFbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, causticTex, 0);

  const causticVao = gl.createVertexArray();
  gl.bindVertexArray(causticVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadCenteredBuf);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const causticPosBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, causticPosBuf);
  gl.bufferData(gl.ARRAY_BUFFER, diamondSim.splatPosSize.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(1, 1);

  const causticColBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, causticColBuf);
  gl.bufferData(gl.ARRAY_BUFFER, diamondSim.splatColor.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(2, 1);

  // 2. Instanced Bond VAO (up to 1024 bonds)
  const MAX_BONDS = 1024;
  const bondVao = gl.createVertexArray();
  gl.bindVertexArray(bondVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBondBuf);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const bondP0GlBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bondP0GlBuf);
  gl.bufferData(gl.ARRAY_BUFFER, MAX_BONDS * 12, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(1, 1);

  const bondP1GlBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bondP1GlBuf);
  gl.bufferData(gl.ARRAY_BUFFER, MAX_BONDS * 12, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(2, 1);

  const bondMetaGlBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bondMetaGlBuf);
  gl.bufferData(gl.ARRAY_BUFFER, MAX_BONDS * 16, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(3);
  gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(3, 1);

  // 3. Instanced Atom Sphere VAO (up to 1024 atoms)
  const MAX_ATOMS = 1024;
  const atomVao = gl.createVertexArray();
  gl.bindVertexArray(atomVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadCenteredBuf);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const atomPosGlBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, atomPosGlBuf);
  gl.bufferData(gl.ARRAY_BUFFER, MAX_ATOMS * 12, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(1, 1);

  const atomMetaGlBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, atomMetaGlBuf);
  gl.bufferData(gl.ARRAY_BUFFER, MAX_ATOMS * 16, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(2, 1);

  gl.bindVertexArray(null);

  // =========================================================================
  // PHASE 3 (BIOS): 65,536-AGENT GPGPU PING-PONG FBOs + LIVE TEXT FIELD
  // =========================================================================
  const AGENT_GRID = 256; // 256 x 256 = 65,536 autonomous living agents
  const TRAIL_W = 512;
  const TRAIL_H = 288;

  const initAgents = new Float32Array(AGENT_GRID * AGENT_GRID * 4);
  for (let i = 0; i < AGENT_GRID * AGENT_GRID; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 0.38;
    initAgents[i * 4 + 0] = 0.5 + Math.cos(a) * r * 0.6;
    initAgents[i * 4 + 1] = 0.5 + Math.sin(a) * r;
    initAgents[i * 4 + 2] = a + Math.PI;
    initAgents[i * 4 + 3] = (i % 5 === 0) ? 1.0 : 0.0; // Two symbiotic species
  }

  function createAgentFBO(initialData) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, AGENT_GRID, AGENT_GRID, 0, gl.RGBA, gl.FLOAT, initialData);

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      // Fallback to RGBA16F on mobile GPUs if needed
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, AGENT_GRID, AGENT_GRID, 0, gl.RGBA, gl.FLOAT, initialData);
    }
    return { tex, fbo };
  }

  function createTrailFBO() {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, TRAIL_W, TRAIL_H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fbo };
  }

  let agentPing = createAgentFBO(initAgents);
  let agentPong = createAgentFBO(initAgents);
  let trailPing = createTrailFBO();
  let trailPong = createTrailFBO();
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  // Offscreen 2D Canvas -> WebGL Texture for Live Morphogenetic Text Inscription!
  const textCanvas = document.createElement('canvas');
  textCanvas.width = 512;
  textCanvas.height = 288;
  const textCtx = textCanvas.getContext('2d');
  const biosTextTex = gl.createTexture();

  let currentBiosWord = 'CARBON';
  let biosTextStrength = 1.0;

  function updateBiosTextTexture(word) {
    currentBiosWord = word;
    textCtx.fillStyle = '#000000';
    textCtx.fillRect(0, 0, 512, 288);

    const clean = (word || '').trim().toUpperCase();
    if (!clean || clean === 'WILD') {
      biosTextStrength = 0.0;
    } else {
      biosTextStrength = 1.0;
      const len = clean.length;
      const fontSize = Math.max(42, Math.min(108, Math.floor(430 / Math.max(3.6, len * 0.72))));
      textCtx.save();
      textCtx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, "Inter", sans-serif`;
      textCtx.textAlign = 'center';
      textCtx.textBaseline = 'middle';

      // Soft outer chemotactic gradient halo so distant agents sense the letters!
      textCtx.shadowColor = '#ffffff';
      textCtx.shadowBlur = 24;
      textCtx.fillStyle = 'rgba(255,255,255,0.65)';
      textCtx.fillText(clean, 256, 144);

      // Crisp inner nutrient core
      textCtx.shadowBlur = 4;
      textCtx.fillStyle = '#ffffff';
      textCtx.fillText(clean, 256, 144);
      textCtx.restore();
    }

    gl.bindTexture(gl.TEXTURE_2D, biosTextTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);
  }

  updateBiosTextTexture('CARBON');

  // Pre-warm Bios simulation 25 steps so if user jumps straight to Phase 3 it's already lush!
  function stepBiosGPU(timeVal, pointerUV, pointerAct) {
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(emptyVao);

    // 1. Update 65,536 agent positions/headings
    gl.bindFramebuffer(gl.FRAMEBUFFER, agentPong.fbo);
    gl.viewport(0, 0, AGENT_GRID, AGENT_GRID);
    gl.useProgram(progBiosAgent);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, agentPing.tex);
    gl.uniform1i(gl.getUniformLocation(progBiosAgent, 'uAgentTex'), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, trailPing.tex);
    gl.uniform1i(gl.getUniformLocation(progBiosAgent, 'uTrailTex'), 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, biosTextTex);
    gl.uniform1i(gl.getUniformLocation(progBiosAgent, 'uTextTex'), 2);

    gl.uniform2f(gl.getUniformLocation(progBiosAgent, 'uWorldRes'), canvas.width || 1280, canvas.height || 720);
    gl.uniform1f(gl.getUniformLocation(progBiosAgent, 'uTime'), timeVal);
    gl.uniform2f(gl.getUniformLocation(progBiosAgent, 'uPointer'), pointerUV[0], pointerUV[1]);
    gl.uniform1f(gl.getUniformLocation(progBiosAgent, 'uPointerAct'), pointerAct);
    gl.uniform1f(gl.getUniformLocation(progBiosAgent, 'uTextStrength'), biosTextStrength);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    [agentPing, agentPong] = [agentPong, agentPing];

    // 2. Deposit pheromone trails into trailPing
    gl.bindFramebuffer(gl.FRAMEBUFFER, trailPing.fbo);
    gl.viewport(0, 0, TRAIL_W, TRAIL_H);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(progBiosDeposit);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, agentPing.tex);
    gl.uniform1i(gl.getUniformLocation(progBiosDeposit, 'uAgentTex'), 0);
    gl.uniform1i(gl.getUniformLocation(progBiosDeposit, 'uGridSize'), AGENT_GRID);
    gl.drawArrays(gl.POINTS, 0, AGENT_GRID * AGENT_GRID);
    gl.disable(gl.BLEND);

    // 3. Diffuse & decay trailPing -> trailPong
    gl.bindFramebuffer(gl.FRAMEBUFFER, trailPong.fbo);
    gl.viewport(0, 0, TRAIL_W, TRAIL_H);
    gl.useProgram(progBiosDiffuse);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, trailPing.tex);
    gl.uniform1i(gl.getUniformLocation(progBiosDiffuse, 'uTrailTex'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, biosTextTex);
    gl.uniform1i(gl.getUniformLocation(progBiosDiffuse, 'uTextTex'), 1);
    gl.uniform2f(gl.getUniformLocation(progBiosDiffuse, 'uTexel'), 1 / TRAIL_W, 1 / TRAIL_H);
    gl.uniform1f(gl.getUniformLocation(progBiosDiffuse, 'uTextStrength'), biosTextStrength);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    [trailPing, trailPong] = [trailPong, trailPing];
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  for (let w = 0; w < 35; w++) {
    stepBiosGPU(w * 0.016, [0.5, 0.5], 0.0);
  }

  // =========================================================================
  // UI STATE, AUTO-TOUR DIRECTOR & INTERACTIVE CONTROLS
  // =========================================================================
  let currentPhase = 0;
  let phaseFlash = 0.0;
  let autoTour = true;
  let phaseTimer = 0.0;
  const TOUR_DURATION = 8.5; // seconds per allotrope during hands-free showcase

  let xrayOpen = false;
  let pointerDown = false;
  let pointerUV = [0.5, 0.5];
  let prevPointerUV = [0.5, 0.5];
  let biosScatterTimer = 0.0;

  // DOM Elements
  const elPhaseDot = document.getElementById('phaseDot');
  const elPhaseHybrid = document.getElementById('phaseHybrid');
  const elPhaseTitle = document.getElementById('phaseTitle');
  const elPhaseTelemetry = document.getElementById('phaseTelemetry');
  const elGestureHint = document.getElementById('gestureHint');
  const elContextBar = document.getElementById('contextBar');
  const elXrayPanel = document.getElementById('xrayPanel');
  const elXrFps = document.getElementById('xrFps');
  const elXrPrims = document.getElementById('xrPrims');
  const elXrPasses = document.getElementById('xrPasses');
  const elXrAudio = document.getElementById('xrAudio');
  const elXrEquation = document.getElementById('xrEquation');
  const elXrNote = document.getElementById('xrNote');
  const elPtCoord = document.getElementById('ptCoord');

  const btnAuto = document.getElementById('btnAuto');
  const btnXray = document.getElementById('btnXray');
  const btnRec = document.getElementById('btnRec');
  const btnSound = document.getElementById('btnSound');
  const btnFullscreen = document.getElementById('btnFullscreen');
  const tabButtons = Array.from(document.querySelectorAll('.phase-tab'));

  const scopeCanvas = document.getElementById('scopeCanvas');
  const scopeCtx = scopeCanvas.getContext('2d');
  const ptCanvas = document.getElementById('ptCanvas');
  const ptCtx = ptCanvas.getContext('2d');

  let ptPos = [...PHASE_INFO[0].pt];

  function syncSoundButton() {
    if (audio.enabled) {
      btnSound.classList.add('active', 'sound-on');
      btnSound.classList.remove('sound-prompt-pulse');
      document.getElementById('soundLabel').textContent = 'SOUND ON';
    } else {
      btnSound.classList.remove('active', 'sound-on');
      document.getElementById('soundLabel').textContent = audio.unlocked ? 'MUTED' : 'SOUND';
    }
  }

  function ensureSoundOnFirstGesture() {
    if (!audio.unlocked) {
      audio.unlockAndEnable();
      syncSoundButton();
    }
  }

  function pauseAutoTour() {
    if (autoTour) {
      autoTour = false;
      btnAuto.classList.remove('active');
      tabButtons.forEach((b, i) => {
        const pr = document.getElementById('prog' + i);
        if (pr) pr.style.width = i === currentPhase ? '100%' : '0%';
      });
    }
  }

  function renderContextBar() {
    elContextBar.innerHTML = '';
    canvas.classList.toggle('laser-cursor', currentPhase === 1 && grapheneSim.tool === 'laser');

    const addLabel = (txt) => {
      const s = document.createElement('span');
      s.className = 'ctx-label';
      s.textContent = txt;
      elContextBar.appendChild(s);
    };
    const addDiv = () => {
      const d = document.createElement('div');
      d.className = 'ctx-divider';
      elContextBar.appendChild(d);
    };
    const addChip = (label, active, onClick, accent = false) => {
      const b = document.createElement('button');
      b.className = 'ctx-chip' + (active ? ' active' : '') + (accent ? ' accent-action' : '');
      b.textContent = label;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        ensureSoundOnFirstGesture();
        onClick();
      });
      elContextBar.appendChild(b);
      return b;
    };

    if (currentPhase === 0) {
      addLabel('CUT');
      diamondSim.cutNames.forEach((name, idx) => {
        addChip(name, diamondSim.cutIndex === idx, () => {
          pauseAutoTour();
          diamondSim.setCut(idx);
          audio.ringCrystal(0.85, (idx - 1.5) * 0.35, idx);
          renderContextBar();
        });
      });
      addDiv();
      addLabel('FIRE');
      [
        ['1× REAL', 1.0],
        ['2× PRISM', 1.85],
        ['3.5× HYPER', 3.2]
      ].forEach(([lbl, val]) => {
        addChip(lbl, Math.abs(diamondSim.dispersion - val) < 0.25, () => {
          pauseAutoTour();
          diamondSim.dispersion = val;
          audio.ringCrystal(0.6, 0, diamondSim.cutIndex);
          renderContextBar();
        });
      });
      addDiv();
      addChip('STRIKE BELL', false, () => {
        diamondSim.strike();
        audio.ringCrystal(1.0, 0, diamondSim.cutIndex);
      }, true);
    } else if (currentPhase === 1) {
      addLabel('CURSOR');
      [
        ['PLUCK HARP', 'pluck'],
        ['LASER CUT', 'laser'],
        ['ANNEAL HEAL', 'heal']
      ].forEach(([lbl, mode]) => {
        addChip(lbl, grapheneSim.tool === mode, () => {
          pauseAutoTour();
          grapheneSim.tool = mode;
          if (mode === 'heal') grapheneSim.annealAll(audio);
          renderContextBar();
        });
      });
      addDiv();
      addChip('WAVE PULSE', false, () => {
        grapheneSim.triggerRipple(0, 0, 0.48);
        audio.pluckBond(0.65, 0, 0.6);
      }, true);
      addChip('RESET SHEET', false, () => {
        grapheneSim.buildLattice();
        grapheneSim.triggerRipple(0, 0, 0.28);
        audio.annealChord();
      });
    } else if (currentPhase === 2) {
      addLabel('TOPOLOGY');
      addChip('C₆₀ BUCKYBALL', fullereneSim.subMode === 'c60', () => {
        pauseAutoTour();
        fullereneSim.setSubMode('c60');
        audio.strikeFullerene(0.9, 0, false);
        renderContextBar();
      });
      addChip('(6,6) NANOTUBE', fullereneSim.subMode === 'tube', () => {
        pauseAutoTour();
        fullereneSim.setSubMode('tube');
        audio.strikeFullerene(0.9, 0, false);
        renderContextBar();
      });
      addDiv();
      addChip('EXCITE @La ION', false, () => {
        fullereneSim.kickIon(audio);
      }, true);
    } else if (currentPhase === 3) {
      addLabel('INSCRIBE');
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'bios-input';
      inp.maxLength = 12;
      inp.value = currentBiosWord;
      inp.placeholder = 'TYPE WORD';
      inp.addEventListener('input', () => {
        pauseAutoTour();
        ensureSoundOnFirstGesture();
        updateBiosTextTexture(inp.value);
        audio.bioGrain(0, 0.8);
      });
      inp.addEventListener('keydown', (e) => e.stopPropagation());
      elContextBar.appendChild(inp);

      addDiv();
      ['CARBON', 'GEMINI 4', 'Z = 6', 'ALIVE', 'WILD'].forEach((w) => {
        addChip(w, currentBiosWord === w, () => {
          pauseAutoTour();
          updateBiosTextTexture(w);
          audio.bioGrain(0, 0.9);
          renderContextBar();
        });
      });
    } else if (currentPhase === 4) {
      const stat = document.createElement('span');
      stat.className = 'stat-pill';
      stat.id = 'c12Badge';
      stat.textContent = `¹²C FORGED: ${starforgeSim.c12Forged}`;
      elContextBar.appendChild(stat);
      addDiv();

      const crushBtn = addChip('HOLD: GRAVITY CRUSH', false, () => {}, true);
      const startCrush = (e) => {
        e.preventDefault();
        e.stopPropagation();
        ensureSoundOnFirstGesture();
        pauseAutoTour();
        starforgeSim.targetCrush = 1.0;
      };
      const endCrush = () => {
        if (starforgeSim.targetCrush > 0.5) {
          starforgeSim.supernovaBurst(audio);
        }
        starforgeSim.targetCrush = 0.0;
      };
      crushBtn.addEventListener('pointerdown', startCrush);
      window.addEventListener('pointerup', endCrush, { once: false });

      addChip('HOYLE BURST', false, () => {
        pauseAutoTour();
        starforgeSim.supernovaBurst(audio);
      });
    }
  }

  function setPhase(idx, fromAuto = false) {
    const next = ((idx % 5) + 5) % 5;
    const changed = next !== currentPhase;
    currentPhase = next;
    phaseTimer = 0.0;
    if (!fromAuto) pauseAutoTour();

    if (changed) {
      phaseFlash = 0.42;
      audio.setPhase(currentPhase, true);
    }

    const info = PHASE_INFO[currentPhase];
    elPhaseDot.style.background = info.color;
    elPhaseDot.style.boxShadow = `0 0 12px ${info.color}`;
    elPhaseHybrid.textContent = info.hybrid;
    elPhaseTitle.textContent = info.name;
    elPhaseTelemetry.textContent = info.telemetry;
    elGestureHint.textContent = info.hint;
    elXrPrims.textContent = info.prims;
    elXrPasses.textContent = info.passes;
    elXrAudio.textContent = info.audioDesc;
    elXrEquation.textContent = info.eq;
    elPtCoord.textContent = info.ptLabel;

    tabButtons.forEach((b, i) => {
      b.classList.toggle('active', i === currentPhase);
      const pr = document.getElementById('prog' + i);
      if (pr) pr.style.width = i === currentPhase && !autoTour ? '100%' : '0%';
    });

    // Trigger gentle entrance impulse on newly entered world
    if (currentPhase === 0) diamondSim.ringPulse = 0.55;
    if (currentPhase === 1) grapheneSim.triggerRipple(0, 0, 0.32);
    if (currentPhase === 2) fullereneSim.kickIon(null);

    renderContextBar();
  }

  // Bind Top & Bottom UI Buttons
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      ensureSoundOnFirstGesture();
      setPhase(parseInt(btn.dataset.phase, 10), false);
    });
  });

  btnAuto.addEventListener('click', () => {
    ensureSoundOnFirstGesture();
    autoTour = !autoTour;
    phaseTimer = 0;
    btnAuto.classList.toggle('active', autoTour);
  });

  btnXray.addEventListener('click', () => {
    ensureSoundOnFirstGesture();
    xrayOpen = !xrayOpen;
    btnXray.classList.toggle('active', xrayOpen);
    elXrayPanel.classList.toggle('open', xrayOpen);
  });

  btnSound.addEventListener('click', () => {
    audio.toggle();
    syncSoundButton();
  });

  btnFullscreen.addEventListener('click', () => {
    ensureSoundOnFirstGesture();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  });

  // Built-in 60fps Video + Stereo WebAudio Recorder (.webm)
  let mediaRecorder = null;
  let recordedChunks = [];
  btnRec.addEventListener('click', () => {
    ensureSoundOnFirstGesture();
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      return;
    }
    try {
      const canvasStream = canvas.captureStream(60);
      if (audio.streamDest) {
        audio.streamDest.stream.getAudioTracks().forEach(t => canvasStream.addTrack(t));
      }
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';
      mediaRecorder = new MediaRecorder(canvasStream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
      recordedChunks = [];
      mediaRecorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) recordedChunks.push(ev.data);
      };
      mediaRecorder.onstop = () => {
        btnRec.classList.remove('rec-active');
        document.getElementById('recLabel').textContent = 'REC';
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gemini-4-carbon-${Date.now()}.webm`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      };
      mediaRecorder.start();
      btnRec.classList.add('rec-active');
      document.getElementById('recLabel').textContent = 'STOP';
    } catch (err) {
      console.warn('Recording unavailable:', err);
    }
  });

  // =========================================================================
  // CANVAS POINTER, KEYBOARD & P-T PHASE MAP INTERACTION
  // =========================================================================
  let pointerDownPos = [0, 0];
  let pointerMovedDist = 0;

  function getUV(e) {
    const rect = canvas.getBoundingClientRect();
    return [
      (e.clientX - rect.left) / Math.max(1, rect.width),
      1.0 - (e.clientY - rect.top) / Math.max(1, rect.height)
    ];
  }

  canvas.addEventListener('pointerdown', (e) => {
    ensureSoundOnFirstGesture();
    pauseAutoTour();
    pointerDown = true;
    canvas.setPointerCapture?.(e.pointerId);
    const uv = getUV(e);
    pointerUV = uv;
    prevPointerUV = uv;
    pointerDownPos = [e.clientX, e.clientY];
    pointerMovedDist = 0;

    const aspect = canvas.width / Math.max(1, canvas.height);
    const ndcX = uv[0] * 2 - 1;
    const ndcY = uv[1] * 2 - 1;

    if (currentPhase === 1) {
      grapheneSim.interactScreen(ndcX, ndcY, ndcX, ndcY, grapheneSim.getProjView(aspect), audio, e.shiftKey ? 'laser' : null);
    } else if (currentPhase === 2) {
      fullereneSim.pokeCage(ndcX, ndcY, fullereneSim.getProjView(aspect), audio);
    } else if (currentPhase === 3) {
      biosScatterTimer = 0.28;
      audio.bioGrain(ndcX, 1.0);
    } else if (currentPhase === 4) {
      starforgeSim.targetCrush = 1.0;
      starforgeSim.spawnShock(uv[0], uv[1], 0.85);
      audio.fusionFlash(ndcX * 0.8, 0.7);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const uv = getUV(e);
    const dx = uv[0] - prevPointerUV[0];
    const dy = uv[1] - prevPointerUV[1];
    pointerMovedDist += Math.hypot(e.clientX - pointerDownPos[0], e.clientY - pointerDownPos[1]);

    const aspect = canvas.width / Math.max(1, canvas.height);
    const ndcX = uv[0] * 2 - 1;
    const ndcY = uv[1] * 2 - 1;
    const prevNdcX = prevPointerUV[0] * 2 - 1;
    const prevNdcY = prevPointerUV[1] * 2 - 1;

    if (currentPhase === 0) {
      if (pointerDown) {
        if (e.shiftKey) {
          diamondSim.lightAzimuth += dx * 3.8;
          diamondSim.lightElev = Math.max(0.25, Math.min(1.35, diamondSim.lightElev + dy * 2.4));
        } else {
          diamondSim.yaw += dx * 4.2;
          diamondSim.pitch = Math.max(-0.95, Math.min(0.95, diamondSim.pitch - dy * 3.4));
          diamondSim.velYaw = dx * 28.0;
          diamondSim.velPitch = -dy * 22.0;
        }
        audio.updateDiamondMotion(Math.hypot(dx, dy) * 35);
      } else {
        // Subtle parallax steering of incident light beam on hover!
        diamondSim.lightAzimuth = 0.62 + (uv[0] - 0.5) * 0.85;
        diamondSim.lightElev = 0.76 + (uv[1] - 0.5) * 0.35;
      }
    } else if (currentPhase === 1) {
      if (pointerDown || Math.hypot(dx, dy) > 0.002) {
        const toolOverride = (!pointerDown && grapheneSim.tool === 'laser') ? 'pluck' : (e.shiftKey ? 'laser' : null);
        if (pointerDown || toolOverride === 'pluck') {
          grapheneSim.interactScreen(ndcX, ndcY, prevNdcX, prevNdcY, grapheneSim.getProjView(aspect), audio, pointerDown ? toolOverride : 'pluck');
        }
      }
    } else if (currentPhase === 2) {
      if (pointerDown) {
        fullereneSim.rotYaw += dx * 4.2;
        fullereneSim.rotPitch = Math.max(-1.2, Math.min(1.2, fullereneSim.rotPitch - dy * 3.5));
        fullereneSim.velYaw = dx * 24.0;
        fullereneSim.velPitch = -dy * 18.0;
      }
    } else if (currentPhase === 3) {
      if (Math.hypot(dx, dy) > 0.008 && audio.enabled) {
        audio.bioGrain(ndcX, Math.min(1.0, Math.hypot(dx, dy) * 25));
      }
    }

    prevPointerUV = pointerUV;
    pointerUV = uv;
  });

  window.addEventListener('pointerup', () => {
    if (!pointerDown) return;
    pointerDown = false;
    if (currentPhase === 0 && pointerMovedDist < 12) {
      // Crisp tap on crystal rings eigenmodes!
      diamondSim.strike();
      audio.ringCrystal(0.95, (pointerUV[0] - 0.5) * 1.4, diamondSim.cutIndex);
    }
    if (currentPhase === 4 && starforgeSim.targetCrush > 0.5) {
      starforgeSim.supernovaBurst(audio);
      starforgeSim.targetCrush = 0.0;
    }
  });

  // Interactive P-T Phase Diagram Click/Drag
  let ptDragging = false;
  function handlePtPick(e) {
    ensureSoundOnFirstGesture();
    const r = ptCanvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    ptPos = [x, y];

    // Nearest thermodynamic carbon phase in (T, P) space
    let bestIdx = 0, bestD = 999;
    PHASE_INFO.forEach((inf, idx) => {
      const d = Math.hypot(inf.pt[0] - x, inf.pt[1] - y);
      if (d < bestD) { bestD = d; bestIdx = idx; }
    });
    if (bestIdx !== currentPhase) {
      setPhase(bestIdx, false);
    } else {
      pauseAutoTour();
    }
  }
  ptCanvas.addEventListener('pointerdown', (e) => { ptDragging = true; handlePtPick(e); });
  window.addEventListener('pointermove', (e) => { if (ptDragging) handlePtPick(e); });
  window.addEventListener('pointerup', () => { ptDragging = false; });

  // Keyboard shortcuts (1-5 phases, X x-ray, M mute, F fullscreen, Space action)
  window.addEventListener('keydown', (e) => {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    ensureSoundOnFirstGesture();
    if (e.key >= '1' && e.key <= '5') {
      setPhase(parseInt(e.key, 10) - 1, false);
    } else if (e.key === 'x' || e.key === 'X') {
      btnXray.click();
    } else if (e.key === 'm' || e.key === 'M') {
      btnSound.click();
    } else if (e.key === 'f' || e.key === 'F') {
      btnFullscreen.click();
    } else if (e.key === ' ') {
      e.preventDefault();
      if (currentPhase === 0) { diamondSim.strike(); audio.ringCrystal(1, 0, diamondSim.cutIndex); }
      if (currentPhase === 1) { grapheneSim.triggerRipple(0, 0, 0.5); audio.pluckBond(0.7, 0, 0.6); }
      if (currentPhase === 2) { fullereneSim.kickIon(audio); }
      if (currentPhase === 3) { biosScatterTimer = 0.32; audio.bioGrain(0, 1.0); }
      if (currentPhase === 4) { starforgeSim.supernovaBurst(audio); }
    }
  });

  // =========================================================================
  // RESIZE & HUD CANVAS RENDERERS (P-T DIAGRAM + OSCILLOSCOPE)
  // =========================================================================
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(320, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(240, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }
  window.addEventListener('resize', resize);
  resize();
  setPhase(0, true);
  autoTour = true;
  btnAuto.classList.add('active');

  function drawPtDiagram(dt) {
    if (ptCanvas.offsetParent === null) return;
    const target = PHASE_INFO[currentPhase].pt;
    if (!ptDragging) {
      ptPos[0] += (target[0] - ptPos[0]) * Math.min(1, dt * 6);
      ptPos[1] += (target[1] - ptPos[1]) * Math.min(1, dt * 6);
    }

    const w = ptCanvas.width, h = ptCanvas.height;
    ptCtx.clearRect(0, 0, w, h);

    // Subtle phase-boundary curves
    ptCtx.strokeStyle = 'rgba(255,255,255,0.12)';
    ptCtx.lineWidth = 1;
    ptCtx.beginPath();
    ptCtx.moveTo(0, h * 0.36);
    ptCtx.quadraticCurveTo(w * 0.5, h * 0.34, w * 0.72, 0);
    ptCtx.moveTo(w * 0.70, 0);
    ptCtx.lineTo(w * 0.76, h);
    ptCtx.moveTo(0, h * 0.72);
    ptCtx.lineTo(w * 0.74, h * 0.72);
    ptCtx.stroke();

    // Node markers for the 5 phases
    PHASE_INFO.forEach((inf, idx) => {
      const px = inf.pt[0] * w, py = inf.pt[1] * h;
      ptCtx.fillStyle = idx === currentPhase ? inf.color : 'rgba(255,255,255,0.28)';
      ptCtx.beginPath();
      ptCtx.arc(px, py, idx === currentPhase ? 3.5 : 2.2, 0, Math.PI * 2);
      ptCtx.fill();
    });

    // Live crosshair
    const cx = ptPos[0] * w, cy = ptPos[1] * h;
    const col = PHASE_INFO[currentPhase].color;
    ptCtx.strokeStyle = col;
    ptCtx.lineWidth = 1.2;
    ptCtx.beginPath();
    ptCtx.arc(cx, cy, 6.5, 0, Math.PI * 2);
    ptCtx.stroke();
  }

  function drawScope() {
    if (!xrayOpen) return;
    const w = scopeCanvas.width, h = scopeCanvas.height;
    scopeCtx.clearRect(0, 0, w, h);
    const data = audio.sampleScope();

    scopeCtx.strokeStyle = 'rgba(125, 211, 252, 0.88)';
    scopeCtx.lineWidth = 1.5;
    scopeCtx.beginPath();
    if (!data) {
      scopeCtx.moveTo(0, h * 0.5);
      scopeCtx.lineTo(w, h * 0.5);
    } else {
      for (let i = 0; i < data.length; i++) {
        const x = (i / (data.length - 1)) * w;
        const y = ((data[i] - 128) / 128) * (h * 0.42) + h * 0.5;
        if (i === 0) scopeCtx.moveTo(x, y);
        else scopeCtx.lineTo(x, y);
      }
    }
    scopeCtx.stroke();
    elXrNote.textContent = audio.enabled ? audio.lastNoteName : 'AUDIO STANDBY';
  }

  // =========================================================================
  // HELPER TO RENDER INSTANCED 3D BONDS + SPHERE ATOMS
  // =========================================================================
  function renderMolecular3D(pv, atomPos, atomMeta, numAtoms, bondP0, bondP1, bondMeta, numBonds) {
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    if (numBonds > 0) {
      gl.useProgram(progBond);
      gl.uniformMatrix4fv(gl.getUniformLocation(progBond, 'uProjView'), false, pv);
      gl.uniform2f(gl.getUniformLocation(progBond, 'uRes'), canvas.width, canvas.height);

      gl.bindVertexArray(bondVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, bondP0GlBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, bondP0.subarray(0, numBonds * 3));
      gl.bindBuffer(gl.ARRAY_BUFFER, bondP1GlBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, bondP1.subarray(0, numBonds * 3));
      gl.bindBuffer(gl.ARRAY_BUFFER, bondMetaGlBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, bondMeta.subarray(0, numBonds * 4));

      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, numBonds);
    }

    if (numAtoms > 0) {
      gl.useProgram(progAtom);
      gl.uniformMatrix4fv(gl.getUniformLocation(progAtom, 'uProjView'), false, pv);
      gl.uniform2f(gl.getUniformLocation(progAtom, 'uRes'), canvas.width, canvas.height);

      gl.bindVertexArray(atomVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, atomPosGlBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, atomPos.subarray(0, numAtoms * 3));
      gl.bindBuffer(gl.ARRAY_BUFFER, atomMetaGlBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, atomMeta.subarray(0, numAtoms * 4));

      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, numAtoms);
    }

    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
  }

  // =========================================================================
  // MAIN 60–120 FPS RENDER LOOP
  // =========================================================================
  let lastT = performance.now();
  let fpsAccum = 0, fpsFrames = 0, lastFpsUpdate = lastT;
  let lastAutoCue = -1;

  function frame(now) {
    requestAnimationFrame(frame);
    resize();

    const dt = Math.min(0.05, Math.max(0.001, (now - lastT) * 0.001));
    lastT = now;
    const tSec = now * 0.001;

    phaseFlash = Math.max(0, phaseFlash - dt * 1.6);
    biosScatterTimer = Math.max(0, biosScatterTimer - dt);

    // Auto-Tour Director + subtle mid-phase flourishes
    if (autoTour) {
      phaseTimer += dt;
      const pct = Math.min(100, (phaseTimer / TOUR_DURATION) * 100);
      const pr = document.getElementById('prog' + currentPhase);
      if (pr) pr.style.width = pct.toFixed(1) + '%';

      const cueSlot = Math.floor(phaseTimer / 3.8);
      if (cueSlot !== lastAutoCue && cueSlot === 1) {
        lastAutoCue = cueSlot;
        if (currentPhase === 0) {
          diamondSim.setCut((diamondSim.cutIndex + 1) % 4);
          renderContextBar();
        } else if (currentPhase === 1) {
          grapheneSim.triggerRipple((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.0, 0.42);
        } else if (currentPhase === 2) {
          fullereneSim.kickIon(audio);
        } else if (currentPhase === 3) {
          const nextW = currentBiosWord === 'CARBON' ? 'GEMINI 4' : 'CARBON';
          updateBiosTextTexture(nextW);
          renderContextBar();
        } else if (currentPhase === 4) {
          starforgeSim.supernovaBurst(audio);
        }
      }

      if (phaseTimer >= TOUR_DURATION) {
        lastAutoCue = -1;
        setPhase((currentPhase + 1) % 5, true);
      }
    }

    const aspect = canvas.width / Math.max(1, canvas.height);

    // -----------------------------------------------------------------------
    // RENDER ACTIVE CARBON ALLOTROPE
    // -----------------------------------------------------------------------
    if (currentPhase === 0) {
      diamondSim.update(dt, pointerDown);

      // Pass 1: Render refracted spectral caustics into 256x256 caustic FBO
      gl.bindFramebuffer(gl.FRAMEBUFFER, causticFbo);
      gl.viewport(0, 0, CAUSTIC_RES, CAUSTIC_RES);
      gl.disable(gl.DEPTH_TEST);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      if (diamondSim.activeSplats > 0) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(progCaustic);
        gl.bindVertexArray(causticVao);

        gl.bindBuffer(gl.ARRAY_BUFFER, causticPosBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, diamondSim.splatPosSize.subarray(0, diamondSim.activeSplats * 4));
        gl.bindBuffer(gl.ARRAY_BUFFER, causticColBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, diamondSim.splatColor.subarray(0, diamondSim.activeSplats * 3));

        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, diamondSim.activeSplats);
        gl.disable(gl.BLEND);
      }

      // Pass 2: Fullscreen Analytic Convex Raytracer + 7-Wavelength Dispersion
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(progDiamond);
      gl.bindVertexArray(emptyVao);

      gl.uniform2f(gl.getUniformLocation(progDiamond, 'uRes'), canvas.width, canvas.height);
      gl.uniform1f(gl.getUniformLocation(progDiamond, 'uTime'), tSec);
      gl.uniformMatrix3fv(gl.getUniformLocation(progDiamond, 'uRot'), false, diamondSim.rotMat);
      gl.uniformMatrix3fv(gl.getUniformLocation(progDiamond, 'uRotInv'), false, diamondSim.rotInv);
      gl.uniform4fv(gl.getUniformLocation(progDiamond, 'uPlanes'), diamondSim.planeUniforms);
      const lDir = diamondSim.getLightDir();
      gl.uniform3f(gl.getUniformLocation(progDiamond, 'uLightDir'), lDir[0], lDir[1], lDir[2]);
      gl.uniform1f(gl.getUniformLocation(progDiamond, 'uDispersion'), diamondSim.dispersion);
      gl.uniform1f(gl.getUniformLocation(progDiamond, 'uRingPulse'), diamondSim.ringPulse);
      gl.uniform1f(gl.getUniformLocation(progDiamond, 'uFlash'), phaseFlash);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, causticTex);
      gl.uniform1i(gl.getUniformLocation(progDiamond, 'uCausticTex'), 0);

      gl.drawArrays(gl.TRIANGLES, 0, 3);

    } else if (currentPhase === 1) {
      grapheneSim.camYaw = Math.sin(tSec * 0.25) * 0.24;
      grapheneSim.update(dt, tSec, audio);
      const pv = grapheneSim.getProjView(aspect);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.disable(gl.DEPTH_TEST);
      gl.clear(gl.DEPTH_BUFFER_BIT);

      gl.useProgram(progLatticeBg);
      gl.bindVertexArray(emptyVao);
      gl.uniform2f(gl.getUniformLocation(progLatticeBg, 'uRes'), canvas.width, canvas.height);
      gl.uniform1f(gl.getUniformLocation(progLatticeBg, 'uTime'), tSec);
      gl.uniform1i(gl.getUniformLocation(progLatticeBg, 'uMode'), 1);
      gl.uniform2f(gl.getUniformLocation(progLatticeBg, 'uCursor'), pointerUV[0], pointerUV[1]);
      gl.uniform1f(gl.getUniformLocation(progLatticeBg, 'uFlash'), phaseFlash);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      renderMolecular3D(
        pv,
        grapheneSim.atomPosBuf, grapheneSim.atomMetaBuf, grapheneSim.atoms.length,
        grapheneSim.bondP0Buf, grapheneSim.bondP1Buf, grapheneSim.bondMetaBuf, grapheneSim.activeBondCount
      );

    } else if (currentPhase === 2) {
      fullereneSim.update(dt, pointerDown, audio);
      const pv = fullereneSim.getProjView(aspect);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.disable(gl.DEPTH_TEST);
      gl.clear(gl.DEPTH_BUFFER_BIT);

      gl.useProgram(progLatticeBg);
      gl.bindVertexArray(emptyVao);
      gl.uniform2f(gl.getUniformLocation(progLatticeBg, 'uRes'), canvas.width, canvas.height);
      gl.uniform1f(gl.getUniformLocation(progLatticeBg, 'uTime'), tSec);
      gl.uniform1i(gl.getUniformLocation(progLatticeBg, 'uMode'), 2);
      gl.uniform2f(gl.getUniformLocation(progLatticeBg, 'uCursor'), pointerUV[0], pointerUV[1]);
      gl.uniform1f(gl.getUniformLocation(progLatticeBg, 'uFlash'), phaseFlash);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      renderMolecular3D(
        pv,
        fullereneSim.atomPosBuf, fullereneSim.atomMetaBuf, fullereneSim.atoms.length + 1,
        fullereneSim.bondP0Buf, fullereneSim.bondP1Buf, fullereneSim.bondMetaBuf, fullereneSim.bonds.length
      );

    } else if (currentPhase === 3) {
      // 2 GPGPU chemotaxis substeps per frame for fluid organic motion!
      const act = biosScatterTimer > 0 ? -1.0 : 1.0;
      stepBiosGPU(tSec, pointerUV, act);
      stepBiosGPU(tSec + 0.007, pointerUV, act);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(progBiosDisplay);
      gl.bindVertexArray(emptyVao);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, trailPing.tex);
      gl.uniform1i(gl.getUniformLocation(progBiosDisplay, 'uTrailTex'), 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, biosTextTex);
      gl.uniform1i(gl.getUniformLocation(progBiosDisplay, 'uTextTex'), 1);

      gl.uniform1f(gl.getUniformLocation(progBiosDisplay, 'uTextStrength'), biosTextStrength);
      gl.uniform1f(gl.getUniformLocation(progBiosDisplay, 'uFlash'), phaseFlash);
      gl.uniform1f(gl.getUniformLocation(progBiosDisplay, 'uTime'), tSec);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

    } else if (currentPhase === 4) {
      const pv = starforgeSim.update(dt, aspect, audio);
      const badge = document.getElementById('c12Badge');
      if (badge) badge.textContent = `¹²C FORGED: ${starforgeSim.c12Forged}`;

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.disable(gl.DEPTH_TEST);
      gl.clear(gl.DEPTH_BUFFER_BIT);

      gl.useProgram(progStarforge);
      gl.bindVertexArray(emptyVao);
      gl.uniform2f(gl.getUniformLocation(progStarforge, 'uRes'), canvas.width, canvas.height);
      gl.uniform1f(gl.getUniformLocation(progStarforge, 'uTime'), tSec);
      gl.uniform1f(gl.getUniformLocation(progStarforge, 'uCrush'), starforgeSim.crush);
      gl.uniform4fv(gl.getUniformLocation(progStarforge, 'uShocks'), starforgeSim.shockUniform);
      gl.uniform1f(gl.getUniformLocation(progStarforge, 'uFlash'), phaseFlash);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      renderMolecular3D(
        pv,
        starforgeSim.atomPosBuf, starforgeSim.atomMetaBuf, starforgeSim.particles.length,
        null, null, null, 0
      );
    }

    // Update P-T diagram & X-Ray Telemetry
    drawPtDiagram(dt);
    drawScope();

    fpsAccum += dt;
    fpsFrames++;
    if (now - lastFpsUpdate > 400) {
      const avgDt = fpsAccum / Math.max(1, fpsFrames);
      const fps = Math.round(1 / avgDt);
      elXrFps.textContent = `${fps} FPS · ${(avgDt * 1000).toFixed(1)} ms`;
      fpsAccum = 0;
      fpsFrames = 0;
      lastFpsUpdate = now;
    }
  }

  requestAnimationFrame(frame);
})();
