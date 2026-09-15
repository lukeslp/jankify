/**
 * Pixel planets — multi-type WebGL port of Deep-Fold PixelPlanets core looks.
 * Types: rocky, gas, ice, lava, star, blackhole, asteroid, galaxy
 */
import { hslToRgb, mulberry32, randRange } from "../rng.js";
import {
  clear,
  createGL,
  createProgram,
  resizeCanvas,
  setUniform1f,
  setUniform1i,
  setUniform2f,
  setUniform3f,
} from "../webgl.js";
import { NOISE_FUNCS } from "../../shaders/common.glsl.js";

const FS = `precision highp float;
varying vec2 v_uv;

uniform float u_pixels;
uniform float u_seed;
uniform float u_time;
uniform float u_rotation;
uniform int u_type; // 0 rocky 1 gas 2 ice 3 lava 4 star 5 blackhole 6 asteroid 7 galaxy
uniform int u_dither;
uniform int u_octaves;
uniform float u_size;
uniform vec2 u_light;
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;

${NOISE_FUNCS}

float cloud_alpha(vec2 uv) {
  float c_noise = 0.0;
  for (int i = 0; i < 6; i++) {
    c_noise += circleNoise(uv * u_size * 0.3 + float(i + 1) + 10.0 + vec2(u_time * 0.15, 0.0), u_seed);
  }
  return fbm(uv * u_size + c_noise + vec2(u_time * 0.15, 0.0), u_seed, u_octaves);
}

void main() {
  vec2 uv = floor(v_uv * u_pixels) / u_pixels;
  float d_circle = distance(uv, vec2(0.5));
  float a = step(d_circle, 0.49999);
  bool dith = dither(uv, v_uv, u_pixels);
  float d_light = distance(uv, u_light);

  // galaxy / star can fill square-ish; others hard circle
  if (u_type == 7) {
    a = 1.0 - smoothstep(0.48, 0.5, d_circle);
  }
  if (u_type == 5) {
    // black hole: ring + disk
  }

  uv = rotate2(uv, u_rotation);

  vec3 col = u_c0;
  float alpha = a;

  if (u_type == 0 || u_type == 2 || u_type == 3 || u_type == 6) {
    // rocky / ice / lava / asteroid lighting bands
    float fbm1 = fbm(uv * u_size, u_seed, u_octaves);
    d_light += fbm(uv * u_size + fbm1 + vec2(u_time * 0.2, 0.0), u_seed + 1.0, u_octaves) * 0.3;
    float b1 = 0.4;
    float b2 = 0.6;
    if (u_type == 2) { b1 = 0.35; b2 = 0.55; }
    if (u_type == 3) { b1 = 0.3; b2 = 0.5; }
    if (u_type == 6) {
      // asteroid: noisier edge
      float edge = fbm(uv * u_size * 1.5, u_seed, 3);
      a = step(d_circle + edge * 0.08, 0.48);
      alpha = a;
    }
    col = u_c0;
    if (d_light > b1) {
      col = u_c1;
      if (u_dither == 1 && dith && d_light < b1 + 2.0 / u_pixels) col = u_c0;
    }
    if (d_light > b2) {
      col = u_c2;
      if (u_dither == 1 && dith && d_light < b2 + 2.0 / u_pixels) col = u_c1;
    }
    if (u_type == 3) {
      // lava: low-frequency field so flows connect into lakes and rivers
      float rivers = fbm(uv * u_size * 0.8 + vec2(u_time * 0.1, 0.0), u_seed + 3.0, 4);
      if (rivers > 0.54) col = mix(col, u_c3, 0.85);
      if (rivers > 0.62) col = mix(col, vec3(1.0, 0.88, 0.5), 0.55); // hottest cores
    }
    if (u_type == 2) {
      float ice = fbm(uv * u_size * 1.2, u_seed + 2.0, 3);
      if (ice > 0.55) col = mix(col, u_c3, 0.4);
    }
  } else if (u_type == 1) {
    // gas giant: opaque latitude bands + swirled cloud highlights + limb shading
    vec2 suv = spherify(uv);
    float swirl = cloud_alpha(suv * vec2(1.0, 2.0));
    float bands = fbm(vec2(u_seed * 3.7, suv.y * u_size * 0.22 + swirl * 0.6), u_seed + 7.0, 3);
    col = mix(u_c0, u_c1, step(0.42, bands));
    if (swirl > 0.6) col = mix(col, u_c0, 0.55); // storm highlights
    if (d_light + swirl * 0.15 > 0.5) col = mix(col, u_c2, 0.85);
    if (d_light + swirl * 0.15 > 0.62) col = u_c3;
    alpha = a;
  } else if (u_type == 4) {
    // star
    float body = 1.0 - smoothstep(0.0, 0.5, d_circle);
    float f = fbm(uv * u_size + vec2(u_time * 0.3, 0.0), u_seed, u_octaves);
    col = mix(u_c0, u_c1, f);
    col = mix(col, u_c2, pow(d_circle * 2.0, 2.0));
    // corona
    float corona = smoothstep(0.5, 0.35, d_circle) * (0.4 + 0.6 * fbm(uv * 20.0 + u_time, u_seed, 3));
    col += u_c3 * corona * 0.5;
    alpha = max(body, corona * 0.6);
    if (d_circle > 0.55) alpha *= smoothstep(0.72, 0.5, d_circle);
  } else if (u_type == 5) {
    // black hole + accretion
    float ring = abs(d_circle - 0.28);
    float disk = smoothstep(0.06, 0.0, ring);
    float hole = step(d_circle, 0.18);
    float swirl = fbm(rotate2(uv, u_time * 0.4) * u_size, u_seed, 4);
    col = mix(u_c0, u_c1, swirl);
    col = mix(col, u_c2, disk);
    alpha = max(disk * (0.5 + 0.5 * swirl), 0.0);
    if (hole > 0.5) {
      col = vec3(0.0);
      alpha = 1.0;
    }
    // photon ring
    if (abs(d_circle - 0.2) < 0.012) {
      col = u_c3;
      alpha = 1.0;
    }
  } else if (u_type == 7) {
    // galaxy
    vec2 p = uv - 0.5;
    float ang = atan(p.y, p.x);
    float rad = length(p);
    float arms = sin(ang * 3.0 + rad * 18.0 - u_time * 0.5);
    float dens = fbm(uv * u_size + arms, u_seed, u_octaves);
    float core = exp(-rad * 8.0);
    col = mix(u_c0, u_c1, dens);
    col = mix(col, u_c2, core);
    col = mix(col, u_c3, clamp(arms * 0.5 + 0.5, 0.0, 1.0) * dens);
    alpha = clamp(dens * (1.0 - rad * 1.6) + core, 0.0, 1.0);
  }

  gl_FragColor = vec4(col, alpha);
}
`;

const TYPES = [
  { id: "rocky", label: "No atmosphere", type: 0 },
  { id: "gas", label: "Gas giant", type: 1 },
  { id: "ice", label: "Ice world", type: 2 },
  { id: "lava", label: "Lava world", type: 3 },
  { id: "star", label: "Star", type: 4 },
  { id: "blackhole", label: "Black hole", type: 5 },
  { id: "asteroid", label: "Asteroid", type: 6 },
  { id: "galaxy", label: "Galaxy", type: 7 },
];

/**
 * Per-type palettes in [hue, sat, light] with seeded jitter.
 * Slot order matters to the shader: c0 = lit surface, c1 = mid band,
 * c2 = shadow band, c3 = accent (lava rivers, ice sheets, corona, ring…).
 * Luminance MUST descend c0→c2 or the bands stop reading as lighting.
 */
const TYPE_PALETTES = {
  rocky: [
    // regolith worlds: warm grey / tan / rust families
    [[35, 0.18, 0.78], [32, 0.2, 0.55], [28, 0.22, 0.33], [25, 0.2, 0.2]],
    [[20, 0.32, 0.72], [16, 0.35, 0.5], [12, 0.35, 0.3], [10, 0.3, 0.18]],
    [[220, 0.06, 0.75], [220, 0.07, 0.52], [222, 0.08, 0.3], [224, 0.08, 0.18]],
  ],
  gas: [
    // jovian creams and rusts
    [[38, 0.45, 0.82], [30, 0.5, 0.62], [18, 0.5, 0.44], [10, 0.45, 0.3]],
    // neptunian blues
    [[210, 0.55, 0.78], [215, 0.6, 0.58], [222, 0.6, 0.4], [230, 0.55, 0.26]],
    // saturnian pastels
    [[48, 0.35, 0.85], [42, 0.35, 0.68], [34, 0.35, 0.5], [26, 0.3, 0.34]],
  ],
  ice: [[[200, 0.3, 0.92], [204, 0.38, 0.72], [210, 0.42, 0.5], [195, 0.15, 0.97]]],
  lava: [[[14, 0.28, 0.34], [12, 0.3, 0.22], [8, 0.3, 0.12], [24, 1.0, 0.55]]],
  star: [
    [[52, 0.85, 0.88], [42, 0.95, 0.66], [22, 0.95, 0.48], [45, 1.0, 0.72]],
    [[210, 0.55, 0.9], [215, 0.6, 0.72], [225, 0.55, 0.55], [200, 0.6, 0.8]],
    [[10, 0.8, 0.7], [6, 0.85, 0.55], [2, 0.85, 0.4], [18, 0.95, 0.6]],
  ],
  blackhole: [[[28, 0.85, 0.5], [215, 0.5, 0.35], [38, 0.95, 0.68], [48, 0.7, 0.92]]],
  asteroid: [[[30, 0.08, 0.68], [28, 0.1, 0.45], [26, 0.1, 0.27], [24, 0.1, 0.16]]],
  galaxy: [[[222, 0.5, 0.22], [220, 0.18, 0.68], [45, 0.5, 0.9], [208, 0.45, 0.8]]],
};

function planetPalette(typeId, rng) {
  const families = TYPE_PALETTES[typeId] || TYPE_PALETTES.rocky;
  const fam = families[Math.floor(rng() * families.length)];
  // One shared hue drift keeps the four slots in the same color family
  const hueDrift = randRange(rng, -12, 12);
  return fam.map(([h, s, l]) =>
    hslToRgb(
      h + hueDrift + randRange(rng, -4, 4),
      s + randRange(rng, -0.06, 0.06),
      l + randRange(rng, -0.04, 0.04)
    )
  );
}

export const planetsMode = {
  id: "planets",
  name: "Planets",
  key: "3",
  blurb: "Pixel planet types (Deep-Fold PixelPlanets-inspired WebGL suite).",

  defaults() {
    return {
      seed: Math.floor(Math.random() * 1e9),
      pixels: 128,
      size: 512,
      planetType: "rocky",
      dither: true,
      animate: true,
      rotation: 0.8,
      lightX: 0.35,
      lightY: 0.35,
      useSeedLight: true,
    };
  },

  controls() {
    return [
      { type: "number", key: "seed", label: "Seed", min: 0, max: 2e9, step: 1 },
      {
        type: "select",
        key: "planetType",
        label: "Type",
        options: TYPES.map((t) => ({ value: t.id, label: t.label })),
      },
      { type: "number", key: "pixels", label: "Pixel res", min: 40, max: 200, step: 1 },
      { type: "number", key: "size", label: "Canvas", min: 200, max: 600, step: 10 },
      { type: "range", key: "rotation", label: "Rotation", min: 0, max: 6.28, step: 0.01 },
      { type: "checkbox", key: "useSeedLight", label: "Seeded light pos" },
      { type: "range", key: "lightX", label: "Light X", min: 0.1, max: 0.9, step: 0.01 },
      { type: "range", key: "lightY", label: "Light Y", min: 0.1, max: 0.9, step: 0.01 },
      { type: "checkbox", key: "dither", label: "Dither" },
      { type: "checkbox", key: "animate", label: "Animate" },
    ];
  },

  mount(host) {
    host.innerHTML = "";
    const c = document.createElement("canvas");
    c.className = "gen-canvas pixelated";
    host.append(c);
    this._canvas = c;
    this._gl = createGL(c);
    this._prog = createProgram(this._gl, FS);
    this._raf = 0;
    this._t0 = performance.now();
  },

  unmount() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._gl = null;
  },

  generate(state) {
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = 0;
    }
    this._state = { ...state };
    const rng = mulberry32(state.seed >>> 0);
    this._palette = planetPalette(state.planetType, rng);
    this._light = state.useSeedLight
      ? [randRange(rng, 0.25, 0.45), randRange(rng, 0.25, 0.45)]
      : [Number(state.lightX), Number(state.lightY)];
    this._seedF = randRange(rng, 1, 10);
    this._t0 = performance.now();

    const frame = () => {
      const t = state.animate ? (performance.now() - this._t0) * 0.001 : 0;
      this._draw(t);
      if (this._state?.animate) this._raf = requestAnimationFrame(frame);
    };
    frame();
    return this._canvas;
  },

  _draw(time) {
    const state = this._state;
    if (!state || !this._gl) return;
    const s = state.size | 0;
    const gl = this._gl;
    this._canvas.width = s;
    this._canvas.height = s;
    gl.viewport(0, 0, s, s);
    clear(gl, 0.043, 0.059, 0.086, 1); // #0b0f16 — standard stage backdrop
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const type = TYPES.find((t) => t.id === state.planetType)?.type ?? 0;
    const p = this._palette;
    const c = (i) => p[i] || [0.5, 0.5, 0.5];

    this._prog.draw((g, prog) => {
      setUniform1f(g, prog, "u_pixels", Number(state.pixels));
      setUniform1f(g, prog, "u_seed", this._seedF);
      setUniform1f(g, prog, "u_time", time);
      setUniform1f(g, prog, "u_rotation", Number(state.rotation));
      setUniform1i(g, prog, "u_type", type);
      setUniform1i(g, prog, "u_dither", state.dither ? 1 : 0);
      setUniform1i(g, prog, "u_octaves", 4);
      setUniform1f(g, prog, "u_size", 50);
      setUniform2f(g, prog, "u_light", this._light[0], this._light[1]);
      setUniform3f(g, prog, "u_c0", c(0)[0], c(0)[1], c(0)[2]);
      setUniform3f(g, prog, "u_c1", c(1)[0], c(1)[1], c(1)[2]);
      setUniform3f(g, prog, "u_c2", c(2)[0], c(2)[1], c(2)[2]);
      setUniform3f(g, prog, "u_c3", c(3)[0], c(3)[1], c(3)[2]);
    });
  },

  exportCanvas() {
    return this._canvas;
  },
};
