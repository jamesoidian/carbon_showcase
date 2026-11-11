// Main WebGL2 Cinema Engine, Transport & Interactive Controller for "THE HANDPRINT"

(function () {
  const canvas = document.getElementById('glCanvas');
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: true,
    depth: false,
    preserveDrawingBuffer: true
  });

  if (!gl) {
    document.body.innerHTML =
      '<div style="color:#f5f2eb;padding:40px;font-family:sans-serif;font-size:15px;">WebGL2 is required to view THE HANDPRINT.</div>';
    return;
  }

  function compileShader(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(sh) || 'Shader compile error');
    }
    return sh;
  }

  function createProgram(vsSrc, fsSrc) {
    const prog = gl.createProgram();
    gl.attachShader(prog, compileShader(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) || 'Program link error');
    }
    return prog;
  }

  const backdropProg = createProgram(STORY_SHADERS.fullscreenVert, STORY_SHADERS.backdropFrag);
  const lineProg = createProgram(STORY_SHADERS.lineVert, STORY_SHADERS.lineFrag);
  const particleProg = createProgram(STORY_SHADERS.particleVert, STORY_SHADERS.particleFrag);

  const uBackdrop = {
    uRes: gl.getUniformLocation(backdropProg, 'uRes'),
    uTime: gl.getUniformLocation(backdropProg, 'uTime'),
    uStoryTime: gl.getUniformLocation(backdropProg, 'uStoryTime'),
    uActWeights: gl.getUniformLocation(backdropProg, 'uActWeights'),
    uAudio: gl.getUniformLocation(backdropProg, 'uAudio'),
    uCursor: gl.getUniformLocation(backdropProg, 'uCursor'),
    uIntroMix: gl.getUniformLocation(backdropProg, 'uIntroMix')
  };

  const uLine = {
    uProjView: gl.getUniformLocation(lineProg, 'uProjView'),
    uRes: gl.getUniformLocation(lineProg, 'uRes'),
    uTime: gl.getUniformLocation(lineProg, 'uTime')
  };

  const uParticle = {
    uProjView: gl.getUniformLocation(particleProg, 'uProjView'),
    uRes: gl.getUniformLocation(particleProg, 'uRes')
  };

  const score = new StoryScoreEngine();
  const world = new StoryWorld();

  // 1. Empty VAO for fullscreen triangle pass (always bind non-null VAO in WebGL2!)
  const emptyVao = gl.createVertexArray();

  // 2. Instanced Line VAO (quad: [0..1, -1..1], per-instance 11 floats)
  const lineVao = gl.createVertexArray();
  gl.bindVertexArray(lineVao);

  const lineQuadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, lineQuadBuf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      0, -1,  1, -1,  0,  1,
      0,  1,  1, -1,  1,  1
    ]),
    gl.STATIC_DRAW
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);

  const lineInstBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, lineInstBuf);
  gl.bufferData(gl.ARRAY_BUFFER, world.lineData.byteLength, gl.DYNAMIC_DRAW);

  const lineStride = 11 * 4;
  // loc 1: iPosA (vec3)
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, lineStride, 0);
  gl.vertexAttribDivisor(1, 1);
  // loc 2: iPosB (vec3)
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 3, gl.FLOAT, false, lineStride, 12);
  gl.vertexAttribDivisor(2, 1);
  // loc 3: iColor (vec4)
  gl.enableVertexAttribArray(3);
  gl.vertexAttribPointer(3, 4, gl.FLOAT, false, lineStride, 24);
  gl.vertexAttribDivisor(3, 1);
  // loc 4: iWidth (float)
  gl.enableVertexAttribArray(4);
  gl.vertexAttribPointer(4, 1, gl.FLOAT, false, lineStride, 40);
  gl.vertexAttribDivisor(4, 1);

  // 3. Instanced Particle VAO (quad: [-1..1, -1..1], per-instance 8 floats)
  const particleVao = gl.createVertexArray();
  gl.bindVertexArray(particleVao);

  const partQuadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, partQuadBuf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, -1,   1, -1,  -1,  1,
      -1,  1,   1, -1,   1,  1
    ]),
    gl.STATIC_DRAW
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);

  const partInstBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, partInstBuf);
  gl.bufferData(gl.ARRAY_BUFFER, world.particleData.byteLength, gl.DYNAMIC_DRAW);

  const partStride = 8 * 4;
  // loc 1: iPos (vec3)
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, partStride, 0);
  gl.vertexAttribDivisor(1, 1);
  // loc 2: iSize (float)
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 1, gl.FLOAT, false, partStride, 12);
  gl.vertexAttribDivisor(2, 1);
  // loc 3: iColor (vec4)
  gl.enableVertexAttribArray(3);
  gl.vertexAttribPointer(3, 4, gl.FLOAT, false, partStride, 16);
  gl.vertexAttribDivisor(3, 1);

  gl.bindVertexArray(null);

  // 50mm Cinema Perspective Projection Matrix (Z_cam = 2.8, focal = 2.8 -> z=0 matches backdropFrag p!)
  const projView = new Float32Array(16);
  function updateCameraMatrix(aspect) {
    const zCam = 2.8;
    const f = 2.8;
    const near = 0.15, far = 20.0;
    const nf = 1.0 / (near - far);

    projView.fill(0);
    projView[0] = f / Math.max(aspect, 0.1);
    projView[5] = f;
    projView[10] = (far + near) * nf;
    projView[11] = -1.0;
    // View translation (0, 0, -zCam) folded directly into column 3:
    projView[14] = (2.0 * far * near * nf) - zCam * ((far + near) * nf);
    projView[15] = zCam;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor((canvas.clientWidth || 1280) * dpr));
    const h = Math.max(1, Math.floor((canvas.clientHeight || 720) * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    updateCameraMatrix(w / h);
  }
  window.addEventListener('resize', resize);
  resize();

  // DOM References
  const introVeil = document.getElementById('introVeil');
  const btnStartSound = document.getElementById('btnStartSound');
  const btnStartMuted = document.getElementById('btnStartMuted');
  const actNumEl = document.getElementById('actNum');
  const actNameEl = document.getElementById('actName');
  const btnRec = document.getElementById('btnRec');
  const recText = document.getElementById('recText');
  const btnMute = document.getElementById('btnMute');
  const muteText = document.getElementById('muteText');
  const btnFull = document.getElementById('btnFull');
  const subPrimary = document.getElementById('subPrimary');
  const subSecondary = document.getElementById('subSecondary');
  const epilogueBar = document.getElementById('epilogueBar');
  const btnReplay = document.getElementById('btnReplay');
  const btnPlayPause = document.getElementById('btnPlayPause');
  const playIcon = document.getElementById('playIcon');
  const timelineWrap = document.getElementById('timelineWrap');
  const timelineTrack = document.getElementById('timelineTrack');
  const timelineFill = document.getElementById('timelineFill');
  const timeReadout = document.getElementById('timeReadout');
  const actTickBtns = Array.from(document.querySelectorAll('.act-tick-btn'));

  // Playback State
  let hasStarted = false;
  let isPlaying = false;
  let storyTime = 0.0;
  let introMix = 1.0;

  // Pointer State (aspect-corrected NDC coords matching backdropFrag p)
  let cursorX = 0.0, cursorY = 0.0;
  let targetCursorX = 0.0, targetCursorY = 0.0;
  let pointerDown = false;

  function formatTime(sec) {
    const s = Math.max(0, Math.min(STORY_DURATION, Math.floor(sec)));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r < 10 ? '0' : ''}${r}`;
  }

  function startExperience(withSound) {
    hasStarted = true;
    isPlaying = true;
    storyTime = 0.0;
    score.unlock(withSound);
    score.seek(0.0);
    introVeil.classList.add('hidden');
    epilogueBar.classList.remove('visible');
    muteText.textContent = score.muted ? 'MUTED' : 'SOUND ON';
    playIcon.textContent = '❚❚';
  }

  btnStartSound.addEventListener('click', () => startExperience(true));
  btnStartMuted.addEventListener('click', () => startExperience(false));

  function seekTo(newTime) {
    storyTime = Math.max(0.0, Math.min(STORY_DURATION, newTime));
    score.seek(storyTime);
    if (storyTime < STORY_DURATION - 0.15) {
      epilogueBar.classList.remove('visible');
    }
    if (!hasStarted) {
      hasStarted = true;
      isPlaying = true;
      score.unlock(false);
      introVeil.classList.add('hidden');
      muteText.textContent = 'MUTED';
    }
  }

  btnPlayPause.addEventListener('click', () => {
    if (!hasStarted) {
      startExperience(true);
      return;
    }
    if (storyTime >= STORY_DURATION - 0.05) {
      seekTo(0.0);
      isPlaying = true;
    } else {
      isPlaying = !isPlaying;
    }
    playIcon.textContent = isPlaying ? '❚❚' : '▶';
  });

  btnReplay.addEventListener('click', () => {
    epilogueBar.classList.remove('visible');
    seekTo(0.0);
    isPlaying = true;
    playIcon.textContent = '❚❚';
  });

  btnMute.addEventListener('click', () => {
    const muted = score.toggleMute();
    muteText.textContent = muted ? 'MUTED' : 'SOUND ON';
  });

  btnFull.addEventListener('click', () => {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  });

  // Timeline Scrubbing + Chapter Jump Buttons
  let scrubbing = false;
  function scrubFromEvent(e) {
    const rect = timelineTrack.getBoundingClientRect();
    if (rect.width <= 0) return;
    const u = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(u * STORY_DURATION);
  }

  timelineTrack.addEventListener('pointerdown', (e) => {
    scrubbing = true;
    scrubFromEvent(e);
  });
  window.addEventListener('pointermove', (e) => {
    if (scrubbing) scrubFromEvent(e);
  });
  window.addEventListener('pointerup', () => {
    scrubbing = false;
  });

  actTickBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const t = Number(btn.dataset.jump || 0);
      if (!hasStarted) {
        startExperience(true);
      }
      seekTo(t);
      isPlaying = true;
      playIcon.textContent = '❚❚';
    });
  });

  // Interactive Canvas Touch & Pointer Physics
  function updateCursorFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const nx = ((e.clientX - rect.left) / rect.width) * 2.0 - 1.0;
    const ny = 1.0 - ((e.clientY - rect.top) / rect.height) * 2.0;
    const aspect = rect.width / Math.max(1, rect.height);
    targetCursorX = nx * aspect;
    targetCursorY = ny;
  }

  canvas.addEventListener('pointerdown', (e) => {
    pointerDown = true;
    updateCursorFromEvent(e);
    if (hasStarted) {
      score.touchSpark(Math.max(-1, Math.min(1, targetCursorX / 1.5)), world.getActIndex(storyTime));
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    updateCursorFromEvent(e);
  });
  window.addEventListener('pointerup', () => {
    pointerDown = false;
  });

  // Keyboard Shortcuts (Space: Play/Pause, M: Mute, F: Fullscreen, 1..6: Jump to Act)
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      btnPlayPause.click();
    } else if (e.key === 'm' || e.key === 'M') {
      btnMute.click();
    } else if (e.key === 'f' || e.key === 'F') {
      btnFull.click();
    } else if (e.key >= '1' && e.key <= '6') {
      const idx = parseInt(e.key, 10) - 1;
      if (actTickBtns[idx]) actTickBtns[idx].click();
    } else if (e.key === 'ArrowRight') {
      seekTo(storyTime + 5.0);
    } else if (e.key === 'ArrowLeft') {
      seekTo(storyTime - 5.0);
    }
  });

  // Built-in 60fps Video + Stereo Score Recorder (.webm)
  let mediaRecorder = null;
  let recChunks = [];
  btnRec.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      return;
    }
    if (!canvas.captureStream || typeof MediaRecorder === 'undefined') return;
    if (!hasStarted) startExperience(true);
    else if (score.muted) btnMute.click();

    const vStream = canvas.captureStream(60);
    const tracks = [...vStream.getVideoTracks()];
    if (score.streamDest && score.streamDest.stream) {
      tracks.push(...score.streamDest.stream.getAudioTracks());
    }
    const mixed = new MediaStream(tracks);
    recChunks = [];
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm';
    mediaRecorder = new MediaRecorder(mixed, { mimeType: mime, videoBitsPerSecond: 12000000 });
    mediaRecorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) recChunks.push(ev.data);
    };
    mediaRecorder.onstop = () => {
      btnRec.classList.remove('recording');
      recText.textContent = '● REC';
      const blob = new Blob(recChunks, { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'the-handprint-gemini-4-carbon.webm';
      a.click();
    };
    mediaRecorder.start();
    btnRec.classList.add('recording');
    recText.textContent = '■ STOP';
  });

  // UI Sync Helpers
  let lastSubPrimary = '';
  let lastSubSecondary = '';
  let lastActIdx = -1;

  function syncHud() {
    const actIdx = world.getActIndex(storyTime);
    if (actIdx !== lastActIdx) {
      lastActIdx = actIdx;
      const act = STORY_ACTS[actIdx];
      actNumEl.textContent = act.num;
      actNameEl.textContent = act.name;
      actTickBtns.forEach((b, i) => b.classList.toggle('active', i === actIdx));
    }

    const pct = Math.max(0, Math.min(100, (storyTime / STORY_DURATION) * 100));
    timelineFill.style.width = `${pct.toFixed(2)}%`;
    timeReadout.textContent = `${formatTime(storyTime)} / 1:26`;

    const sub = hasStarted ? world.getSubtitle(storyTime) : null;
    if (sub) {
      if (sub.primary !== lastSubPrimary) {
        lastSubPrimary = sub.primary;
        subPrimary.textContent = sub.primary;
      }
      if (sub.secondary !== lastSubSecondary) {
        lastSubSecondary = sub.secondary;
        subSecondary.textContent = sub.secondary;
      }
      subPrimary.classList.toggle('visible', sub.alpha > 0.08);
      subSecondary.classList.toggle('visible', Boolean(sub.secondary) && sub.alpha > 0.08);
    } else {
      subPrimary.classList.remove('visible');
      subSecondary.classList.remove('visible');
    }
  }

  // Main 60fps Cinema Loop
  let prevMs = performance.now();

  function frame(nowMs) {
    const dt = Math.min(0.05, Math.max(0.001, (nowMs - prevMs) * 0.001));
    prevMs = nowMs;
    const realTime = nowMs * 0.001;

    resize();

    if (hasStarted && isPlaying) {
      storyTime += dt;
      if (storyTime >= STORY_DURATION) {
        storyTime = STORY_DURATION;
        isPlaying = false;
        playIcon.textContent = '▶';
        epilogueBar.classList.add('visible');
      }
    }

    introMix += ((hasStarted ? 0.0 : 1.0) - introMix) * Math.min(1.0, dt * 3.5);
    cursorX += (targetCursorX - cursorX) * Math.min(1.0, dt * 8.0);
    cursorY += (targetCursorY - cursorY) * Math.min(1.0, dt * 8.0);

    score.update(storyTime, dt, hasStarted && isPlaying);
    world.update(storyTime, realTime, dt, score, cursorX, cursorY, pointerDown);
    syncHud();

    // Render Pass 1: Atmospheric Multi-Act Shader Backdrop
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.BLEND);
    gl.useProgram(backdropProg);
    gl.bindVertexArray(emptyVao);
    gl.uniform2f(uBackdrop.uRes, canvas.width, canvas.height);
    gl.uniform1f(uBackdrop.uTime, realTime);
    gl.uniform1f(uBackdrop.uStoryTime, storyTime);
    gl.uniform1fv(uBackdrop.uActWeights, world.actWeights);
    gl.uniform3f(uBackdrop.uAudio, score.envLow, score.envMid, score.envHigh);
    gl.uniform2f(uBackdrop.uCursor, cursorX, cursorY);
    gl.uniform1f(uBackdrop.uIntroMix, introMix);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Enable Additive Cinema Glow Blending for 3D Filaments & Particles
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    // Render Pass 2: Instanced 3D Attention & Structural Filaments
    gl.useProgram(lineProg);
    gl.bindVertexArray(lineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, lineInstBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, world.lineData);
    gl.uniformMatrix4fv(uLine.uProjView, false, projView);
    gl.uniform2f(uLine.uRes, canvas.width, canvas.height);
    gl.uniform1f(uLine.uTime, realTime);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, world.L);

    // Render Pass 3: Instanced 3D Luminous Embers, Atoms & Stars
    gl.useProgram(particleProg);
    gl.bindVertexArray(particleVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, partInstBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, world.particleData);
    gl.uniformMatrix4fv(uParticle.uProjView, false, projView);
    gl.uniform2f(uParticle.uRes, canvas.width, canvas.height);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, world.N);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
