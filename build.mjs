import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const styles = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
const template = fs.readFileSync(path.join(root, 'src/template.html'), 'utf8');
const audio = fs.readFileSync(path.join(root, 'src/audio.js'), 'utf8');
const shaders = fs.readFileSync(path.join(root, 'src/shaders.js'), 'utf8');
const physics = fs.readFileSync(path.join(root, 'src/physics.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');

const combinedJs = [audio, shaders, physics, main].join('\n\n');

// 1. Verify JS syntax
new vm.Script(combinedJs, { filename: 'bundle.js' });
console.log('✓ JS syntax verified cleanly.');

// 2. Strict WebGL2 WebIDL + WebAudio + DOM end-to-end execution test across all 5 phases!
function assertArity(name, args, allowedCounts) {
  if (!allowedCounts.includes(args.length)) {
    throw new TypeError(`WebGL2 ${name}: expected ${allowedCounts.join(' or ')} args, got ${args.length}`);
  }
}

const mockGl = new Proxy({
  VERTEX_SHADER: 0x8B31, FRAGMENT_SHADER: 0x8B30, COMPILE_STATUS: 0x8B81, LINK_STATUS: 0x8B82,
  ARRAY_BUFFER: 0x8892, STATIC_DRAW: 0x88E4, DYNAMIC_DRAW: 0x88E8,
  TEXTURE_2D: 0x0DE1, RGBA8: 0x8058, RGBA32F: 0x8814, RGBA16F: 0x881A, RGBA: 0x1908,
  UNSIGNED_BYTE: 0x1401, FLOAT: 0x1406, LINEAR: 0x2601, NEAREST: 0x2600,
  TEXTURE_MIN_FILTER: 0x2801, TEXTURE_MAG_FILTER: 0x2800, TEXTURE_WRAP_S: 0x2802, TEXTURE_WRAP_T: 0x2803,
  CLAMP_TO_EDGE: 0x812F, REPEAT: 0x2901, FRAMEBUFFER: 0x8D40, COLOR_ATTACHMENT0: 0x8CE0,
  FRAMEBUFFER_COMPLETE: 0x8CD5, COLOR_BUFFER_BIT: 0x4000, DEPTH_BUFFER_BIT: 0x0100,
  DEPTH_TEST: 0x0B71, BLEND: 0x0BE2, LEQUAL: 0x0203, ONE: 1, SRC_ALPHA: 0x0302, ONE_MINUS_SRC_ALPHA: 0x0303,
  TEXTURE0: 0x84C0, TEXTURE1: 0x84C1, TEXTURE2: 0x84C2, TRIANGLES: 4, POINTS: 0,

  getExtension: (...a) => (assertArity('getExtension', a, [1]), {}),
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
  createVertexArray: (...a) => (assertArity('createVertexArray', a, [0]), {}),
  bindVertexArray: (...a) => assertArity('bindVertexArray', a, [1]),
  createBuffer: (...a) => (assertArity('createBuffer', a, [0]), {}),
  bindBuffer: (...a) => assertArity('bindBuffer', a, [2]),
  bufferData: (...a) => assertArity('bufferData', a, [3, 4, 5]),
  bufferSubData: (...a) => assertArity('bufferSubData', a, [3, 4, 5]),
  createTexture: (...a) => (assertArity('createTexture', a, [0]), {}),
  bindTexture: (...a) => assertArity('bindTexture', a, [2]),
  texImage2D: (...a) => assertArity('texImage2D', a, [6, 9, 10]),
  texParameteri: (...a) => assertArity('texParameteri', a, [3]),
  createFramebuffer: (...a) => (assertArity('createFramebuffer', a, [0]), {}),
  bindFramebuffer: (...a) => assertArity('bindFramebuffer', a, [2]),
  framebufferTexture2D: (...a) => assertArity('framebufferTexture2D', a, [5]),
  checkFramebufferStatus: (...a) => (assertArity('checkFramebufferStatus', a, [1]), 0x8CD5),
  enableVertexAttribArray: (...a) => assertArity('enableVertexAttribArray', a, [1]),
  vertexAttribPointer: (...a) => assertArity('vertexAttribPointer', a, [6]),
  vertexAttribDivisor: (...a) => assertArity('vertexAttribDivisor', a, [2]),
  clearColor: (...a) => assertArity('clearColor', a, [4]),
  clear: (...a) => assertArity('clear', a, [1]),
  enable: (...a) => assertArity('enable', a, [1]),
  disable: (...a) => assertArity('disable', a, [1]),
  depthFunc: (...a) => assertArity('depthFunc', a, [1]),
  blendFunc: (...a) => assertArity('blendFunc', a, [2]),
  viewport: (...a) => assertArity('viewport', a, [4]),
  useProgram: (...a) => assertArity('useProgram', a, [1]),
  activeTexture: (...a) => assertArity('activeTexture', a, [1]),
  getUniformLocation: (...a) => (assertArity('getUniformLocation', a, [2]), {}),
  uniform1i: (...a) => assertArity('uniform1i', a, [2]),
  uniform1f: (...a) => assertArity('uniform1f', a, [2]),
  uniform2f: (...a) => assertArity('uniform2f', a, [3]),
  uniform3f: (...a) => assertArity('uniform3f', a, [4]),
  uniform4fv: (...a) => assertArity('uniform4fv', a, [2, 3, 4]),
  uniformMatrix3fv: (...a) => assertArity('uniformMatrix3fv', a, [3, 4, 5]),
  uniformMatrix4fv: (...a) => assertArity('uniformMatrix4fv', a, [3, 4, 5]),
  drawArrays: (...a) => assertArity('drawArrays', a, [3]),
  drawArraysInstanced: (...a) => assertArity('drawArraysInstanced', a, [4])
}, {
  get(target, prop) {
    if (!(prop in target)) throw new Error(`Unknown WebGL2 property/method called: gl.${String(prop)}`);
    return target[prop];
  }
});

const mock2d = {
  fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
  shadowColor: '', shadowBlur: 0,
  fillRect: () => {}, clearRect: () => {}, save: () => {}, restore: () => {},
  fillText: () => {}, beginPath: () => {}, moveTo: () => {}, lineTo: () => {},
  quadraticCurveTo: () => {}, arc: () => {}, stroke: () => {}, fill: () => {}
};

const elements = new Map();
function makeEl(id = '', dataset = {}) {
  const listeners = {};
  return {
    id, dataset, width: 1280, height: 720, clientWidth: 1280, clientHeight: 720,
    offsetParent: {}, innerHTML: '', textContent: '', value: 'CARBON',
    style: {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    addEventListener: (ev, fn) => { (listeners[ev] ||= []).push(fn); },
    dispatch: (ev, payload = {}) => { (listeners[ev] || []).forEach(fn => fn(payload)); },
    appendChild: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    getContext: (kind) => (kind === 'webgl2' ? mockGl : mock2d),
    click() { this.dispatch('click', { stopPropagation: () => {} }); }
  };
}

const phaseTabEls = [0, 1, 2, 3, 4].map(i => makeEl(`tab${i}`, { phase: String(i) }));
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
  createAnalyser() { return { fftSize: 256, frequencyBinCount: 128, smoothingTimeConstant: 0.8, connect: () => {}, getByteTimeDomainData: () => {} }; }
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
  setTimeout: (fn) => fn(),
  performance: { now: () => 0 },
  requestAnimationFrame: (cb) => { if (!rafCb) rafCb = cb; },
  window: {
    devicePixelRatio: 2,
    AudioContext: MockAudioContext,
    addEventListener: (ev, fn) => { (winListeners[ev] ||= []).push(fn); }
  },
  document: {
    activeElement: null,
    fullscreenElement: null,
    documentElement: {},
    body: { innerHTML: '' },
    getElementById: (id) => {
      if (!elements.has(id)) elements.set(id, makeEl(id));
      return elements.get(id);
    },
    createElement: (tag) => makeEl(tag),
    querySelectorAll: (sel) => (sel === '.phase-tab' ? phaseTabEls : [])
  }
});
sandbox.window.document = sandbox.document;

// Execute full app initialization + sound unlock + X-Ray open + 10 frames across ALL 5 PHASES!
vm.runInContext(combinedJs, sandbox);
elements.get('btnSound').click();
elements.get('btnXray').click();

let simNow = 16;
for (let ph = 0; ph < 5; ph++) {
  phaseTabEls[ph].click();
  elements.get('glCanvas').dispatch('pointerdown', { clientX: 600, clientY: 350, pointerId: 1, shiftKey: false });
  elements.get('glCanvas').dispatch('pointermove', { clientX: 640, clientY: 330, shiftKey: false });
  (winListeners['pointerup'] || []).forEach(fn => fn());
  for (let f = 0; f < 6; f++) {
    simNow += 16.67;
    rafCb(simNow);
  }
}
console.log('✓ Full WebGL2 WebIDL + WebAudio + 5-Phase Render Loop verified with ZERO runtime errors!');

// 3. Assemble single-file zero-dependency HTML
const html = template
  .replace('/* __STYLES__ */', () => styles)
  .replace('/* __SCRIPTS__ */', () => combinedJs);

const outPath = path.join(root, 'index.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log(`✓ Wrote standalone zero-dependency embed: ${outPath} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
