import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const styles = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
const template = fs.readFileSync(path.join(root, 'src/template.html'), 'utf8');
const score = fs.readFileSync(path.join(root, 'src/score.js'), 'utf8');
const shaders = fs.readFileSync(path.join(root, 'src/shaders.js'), 'utf8');
const world = fs.readFileSync(path.join(root, 'src/story_world.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');

// 0. Check CSS minimum font-size >= 12px rule
const fontMatches = [...styles.matchAll(/font-size:\s*([\d.]+)px/g)];
for (const m of fontMatches) {
  const px = parseFloat(m[1]);
  if (px < 12) {
    throw new Error(`CSS font-size below 12px floor detected: ${m[0]}`);
  }
}
console.log(`✓ CSS typography floor verified (${fontMatches.length} px rules, all >= 12px).`);

const combinedJs = [score, shaders, world, main].join('\n\n');

// 1. Verify JS syntax
new vm.Script(combinedJs, { filename: 'story-bundle.js' });
console.log('✓ JS syntax verified cleanly.');

// 2. Strict WebGL2 WebIDL + VAO State + WebAudio + Full 86s 6-Act Execution Test
function assertArity(name, args, allowedCounts) {
  if (!allowedCounts.includes(args.length)) {
    throw new TypeError(`WebGL2 ${name}: expected ${allowedCounts.join(' or ')} args, got ${args.length}`);
  }
}

let boundVao = null;
let boundArrayBuf = null;

const mockGl = new Proxy({
  VERTEX_SHADER: 0x8B31, FRAGMENT_SHADER: 0x8B30, COMPILE_STATUS: 0x8B81, LINK_STATUS: 0x8B82,
  ARRAY_BUFFER: 0x8892, STATIC_DRAW: 0x88E4, DYNAMIC_DRAW: 0x88E8,
  FLOAT: 0x1406, BLEND: 0x0BE2, ONE: 1, SRC_ALPHA: 0x0302, ONE_MINUS_SRC_ALPHA: 0x0303,
  TRIANGLES: 4,

  createShader: (...a) => (assertArity('createShader', a, [1]), {}),
  shaderSource: (...a) => {
    assertArity('shaderSource', a, [2]);
    if (!a[1].startsWith('#version 300 es')) throw new Error('Shader missing #version 300 es');
  },
  compileShader: (...a) => assertArity('compileShader', a, [1]),
  getShaderParameter: (...a) => (assertArity('getShaderParameter', a, [2]), true),
  getShaderInfoLog: (...a) => (assertArity('getShaderInfoLog', a, [1]), ''),
  createProgram: (...a) => (assertArity('createProgram', a, [0]), {}),
  attachShader: (...a) => assertArity('attachShader', a, [2]),
  linkProgram: (...a) => assertArity('linkProgram', a, [1]),
  getProgramParameter: (...a) => (assertArity('getProgramParameter', a, [2]), true),
  getProgramInfoLog: (...a) => (assertArity('getProgramInfoLog', a, [1]), ''),
  createVertexArray: (...a) => (assertArity('createVertexArray', a, [0]), { isVao: true }),
  bindVertexArray: (...a) => {
    assertArity('bindVertexArray', a, [1]);
    boundVao = a[0];
  },
  createBuffer: (...a) => (assertArity('createBuffer', a, [0]), { isBuf: true }),
  bindBuffer: (...a) => {
    assertArity('bindBuffer', a, [2]);
    boundArrayBuf = a[1];
  },
  bufferData: (...a) => {
    assertArity('bufferData', a, [3, 4, 5]);
    if (!boundArrayBuf) throw new Error('bufferData called with no bound buffer');
  },
  bufferSubData: (...a) => {
    assertArity('bufferSubData', a, [3, 4, 5]);
    if (!boundArrayBuf) throw new Error('bufferSubData called with no bound buffer');
  },
  enableVertexAttribArray: (...a) => assertArity('enableVertexAttribArray', a, [1]),
  vertexAttribPointer: (...a) => assertArity('vertexAttribPointer', a, [6]),
  vertexAttribDivisor: (...a) => assertArity('vertexAttribDivisor', a, [2]),
  enable: (...a) => assertArity('enable', a, [1]),
  disable: (...a) => assertArity('disable', a, [1]),
  blendFunc: (...a) => assertArity('blendFunc', a, [2]),
  viewport: (...a) => assertArity('viewport', a, [4]),
  useProgram: (...a) => assertArity('useProgram', a, [1]),
  getUniformLocation: (...a) => (assertArity('getUniformLocation', a, [2]), {}),
  uniform1f: (...a) => assertArity('uniform1f', a, [2]),
  uniform1fv: (...a) => assertArity('uniform1fv', a, [2, 3, 4]),
  uniform2f: (...a) => assertArity('uniform2f', a, [3]),
  uniform3f: (...a) => assertArity('uniform3f', a, [4]),
  uniformMatrix4fv: (...a) => assertArity('uniformMatrix4fv', a, [3, 4, 5]),
  drawArrays: (...a) => {
    assertArity('drawArrays', a, [3]);
    if (!boundVao) throw new Error('drawArrays called without a bound VAO');
  },
  drawArraysInstanced: (...a) => {
    assertArity('drawArraysInstanced', a, [4]);
    if (!boundVao) throw new Error('drawArraysInstanced called without a bound VAO');
  }
}, {
  get(target, prop) {
    if (!(prop in target)) throw new Error(`Unknown WebGL2 property/method called: gl.${String(prop)}`);
    return target[prop];
  }
});

const elements = new Map();
function makeEl(id = '', dataset = {}) {
  const listeners = {};
  return {
    id, dataset, width: 1280, height: 720, clientWidth: 1280, clientHeight: 720,
    innerHTML: '', textContent: '',
    style: {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    addEventListener: (ev, fn) => { (listeners[ev] ||= []).push(fn); },
    dispatch: (ev, payload = {}) => { (listeners[ev] || []).forEach(fn => fn(payload)); },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    getContext: (kind) => (kind === 'webgl2' ? mockGl : null),
    click() { this.dispatch('click', { stopPropagation: () => {} }); }
  };
}

const jumpTimes = [0, 14, 28, 43, 60, 73];
const actTickEls = jumpTimes.map((t, i) => makeEl(`tick${i}`, { jump: String(t) }));
let rafCb = null;
const winListeners = {};

function makeAudioParam() {
  return {
    value: 0,
    setValueAtTime: () => {},
    linearRampToValueAtTime: () => {},
    exponentialRampToValueAtTime: () => {},
    setTargetAtTime: () => {}
  };
}

class MockAudioContext {
  constructor() { this.sampleRate = 48000; this.currentTime = 0; this.state = 'running'; this.destination = {}; }
  resume() {}
  createGain() { return { gain: makeAudioParam(), connect: () => {} }; }
  createDynamicsCompressor() {
    return { threshold: makeAudioParam(), knee: makeAudioParam(), ratio: makeAudioParam(), attack: makeAudioParam(), release: makeAudioParam(), connect: () => {} };
  }
  createAnalyser() {
    return {
      fftSize: 256,
      frequencyBinCount: 128,
      connect: () => {},
      getByteFrequencyData: (arr) => { arr[2] = 180; arr[14] = 140; arr[48] = 110; }
    };
  }
  createMediaStreamDestination() { return { stream: { getAudioTracks: () => [] } }; }
  createConvolver() { return { buffer: null, connect: () => {} }; }
  createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
  createBufferSource() { return { buffer: null, loop: false, connect: () => {}, start: () => {}, stop: () => {} }; }
  createBiquadFilter() { return { type: 'lowpass', frequency: makeAudioParam(), Q: makeAudioParam(), connect: () => {} }; }
  createOscillator() { return { type: 'sine', frequency: makeAudioParam(), detune: makeAudioParam(), connect: () => {}, start: () => {}, stop: () => {} }; }
  createStereoPanner() { return { pan: makeAudioParam(), connect: () => {} }; }
}

const sandbox = vm.createContext({
  Math, Float32Array, Uint8Array, Array, Map, Object, Number, String, Boolean, Error, TypeError,
  parseInt, console,
  performance: { now: () => 0 },
  requestAnimationFrame: (cb) => { rafCb = cb; },
  window: {
    devicePixelRatio: 2,
    AudioContext: MockAudioContext,
    addEventListener: (ev, fn) => { (winListeners[ev] ||= []).push(fn); }
  },
  document: {
    fullscreenElement: null,
    documentElement: { requestFullscreen: () => Promise.resolve() },
    body: { innerHTML: '' },
    getElementById: (id) => {
      if (!elements.has(id)) elements.set(id, makeEl(id));
      return elements.get(id);
    },
    createElement: (tag) => makeEl(tag),
    querySelectorAll: (sel) => (sel === '.act-tick-btn' ? actTickEls : [])
  }
});
sandbox.window.document = sandbox.document;

vm.runInContext(combinedJs, sandbox);

// Test intro veil preview frame before clicking Play
let simNow = 16.67;
rafCb(simNow);

// Start film with sound and step across the ENTIRE 86.0s runtime + interactive pointer events!
elements.get('btnStartSound').click();
for (let step = 0; step < 1800; step++) {
  simNow += 50.0; // 50ms steps -> covers full 90 seconds of story & score events!
  if (step % 300 === 10) {
    elements.get('glCanvas').dispatch('pointerdown', { clientX: 620, clientY: 340 });
    elements.get('glCanvas').dispatch('pointermove', { clientX: 680, clientY: 310 });
    (winListeners['pointerup'] || []).forEach(fn => fn());
  }
  rafCb(simNow);
}

// Verify epilogue reached, then test chapter jump buttons + replay + mute
if (elements.get('timeReadout').textContent !== '1:26 / 1:26') {
  throw new Error(`Expected final readout '1:26 / 1:26', got '${elements.get('timeReadout').textContent}'`);
}
for (let i = 0; i < actTickEls.length; i++) {
  actTickEls[i].click();
  simNow += 33.3;
  rafCb(simNow);
}
elements.get('btnMute').click();
elements.get('btnReplay').click();
simNow += 33.3;
rafCb(simNow);

console.log('✓ Full 86.0s 6-Act WebGL2 + WebAudio Score + Transport Simulation passed with ZERO errors!');

// 3. Assemble standalone zero-dependency HTML
const html = template
  .replace('/* __STYLES__ */', () => styles)
  .replace('/* __SCRIPTS__ */', () => combinedJs);

const outPath = path.join(root, 'index.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log(`✓ Built standalone interactive audiovisual film: ${outPath} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
