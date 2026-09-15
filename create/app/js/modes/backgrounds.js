/**
 * Space backgrounds — port of BackgroundGenerator StarStuff + Nebulae shaders.
 */
import { hslToRgb, mulberry32, randRange } from "../rng.js";
import {
  clear,
  colorschemeTexture,
  createGL,
  createProgram,
  resizeCanvas,
  setUniform1f,
  setUniform1i,
  setUniform2f,
  setUniform4f,
} from "../webgl.js";
import { NOISE_FUNCS } from "../../shaders/common.glsl.js";

const STARSTUFF_FS = `precision highp float;
varying vec2 v_uv;
uniform float u_seed;
uniform float u_pixels;
uniform float u_size;
uniform int u_octaves;
uniform int u_should_tile;
uniform int u_reduce_bg;
uniform vec2 u_uv_correct;
uniform sampler2D u_scheme;

${NOISE_FUNCS}

float randT(vec2 coord) {
  if (u_should_tile == 1) {
    coord = mod(coord / u_uv_correct, u_size);
  }
  return rand(coord, u_seed);
}

float noiseT(vec2 coord) {
  vec2 i = floor(coord);
  vec2 f = fract(coord);
  float a = randT(i);
  float b = randT(i + vec2(1.0, 0.0));
  float c = randT(i + vec2(0.0, 1.0));
  float d = randT(i + vec2(1.0, 1.0));
  vec2 cubic = f * f * (3.0 - 2.0 * f);
  return mix(a, b, cubic.x) + (c - a) * cubic.y * (1.0 - cubic.x) + (d - b) * cubic.x * cubic.y;
}

float fbmT(vec2 coord) {
  float value = 0.0;
  float scale = 0.5;
  for (int i = 0; i < 8; i++) {
    if (i >= u_octaves) break;
    value += noiseT(coord) * scale;
    coord *= 2.0;
    scale *= 0.5;
  }
  return value;
}

float circleNoiseT(vec2 uv) {
  if (u_should_tile == 1) uv = mod(uv, u_size);
  float uv_y = floor(uv.y);
  uv.x += uv_y * 0.31;
  vec2 f = fract(uv);
  float h = randT(vec2(floor(uv.x), floor(uv_y)));
  float m = length(f - 0.25 - (h * 0.5));
  float r = h * 0.25;
  return smoothstep(0.0, r, m * 0.75);
}

float cloud_alpha(vec2 uv) {
  float c_noise = 0.0;
  for (int i = 0; i < 2; i++) {
    c_noise += circleNoiseT(uv * 0.5 + float(i + 1) + vec2(-0.3, 0.0));
  }
  return fbmT(uv + c_noise);
}

void main() {
  vec2 uv = floor(v_uv * u_pixels) / u_pixels * u_uv_correct;
  bool dith = dither(uv, v_uv, u_pixels);
  float n_alpha = fbmT(uv * ceil(u_size * 0.5) + vec2(2.0, 2.0));
  float n_dust = cloud_alpha(uv * u_size);
  float n_dust2 = fbmT(uv * ceil(u_size * 0.2) - vec2(2.0, 2.0));
  float n_dust_lerp = n_dust2 * n_dust;
  if (dith) n_dust_lerp *= 0.95;
  float a_dust = step(n_alpha * 0.85, n_dust_lerp * 2.15);
  n_dust_lerp = pow(n_dust_lerp, 2.6) * 72.0;
  if (dith) n_dust_lerp *= 1.1;
  if (u_reduce_bg == 1) n_dust_lerp = pow(n_dust_lerp, 0.8) * 0.7;
  float col_value = floor(n_dust_lerp) / 7.0;
  vec3 col = texture2D(u_scheme, vec2(col_value, 0.5)).rgb;
  gl_FragColor = vec4(col, a_dust);
}
`;

const NEBULAE_FS = `precision highp float;
varying vec2 v_uv;
uniform float u_seed;
uniform float u_pixels;
uniform float u_size;
uniform int u_octaves;
uniform int u_should_tile;
uniform int u_reduce_bg;
uniform vec2 u_uv_correct;
uniform vec4 u_bg;
uniform sampler2D u_scheme;

${NOISE_FUNCS}

float randT(vec2 coord) {
  if (u_should_tile == 1) coord = mod(coord / u_uv_correct, u_size);
  return rand(coord, u_seed);
}
float noiseT(vec2 coord) {
  vec2 i = floor(coord);
  vec2 f = fract(coord);
  float a = randT(i), b = randT(i + vec2(1.0, 0.0)), c = randT(i + vec2(0.0, 1.0)), d = randT(i + vec2(1.0, 1.0));
  vec2 cubic = f * f * (3.0 - 2.0 * f);
  return mix(a, b, cubic.x) + (c - a) * cubic.y * (1.0 - cubic.x) + (d - b) * cubic.x * cubic.y;
}
float fbmT(vec2 coord) {
  float value = 0.0; float scale = 0.5;
  for (int i = 0; i < 8; i++) {
    if (i >= u_octaves) break;
    value += noiseT(coord) * scale; coord *= 2.0; scale *= 0.5;
  }
  return value;
}
float circleNoiseT(vec2 uv) {
  if (u_should_tile == 1) uv = mod(uv, u_size / u_uv_correct);
  float uv_y = floor(uv.y);
  uv.x += uv_y * 0.31;
  vec2 f = fract(uv);
  float h = randT(vec2(floor(uv.x), floor(uv_y)));
  float m = length(f - 0.25 - (h * 0.5));
  float r = h * 0.25;
  return smoothstep(0.0, r, m * 0.75);
}
float cloud_alpha(vec2 uv) {
  float c_noise = 0.0;
  for (int i = 0; i < 2; i++) {
    c_noise += circleNoiseT(uv * 0.5 + float(i + 1) + vec2(-0.3, 0.0));
  }
  return fbmT(uv + c_noise);
}
void main() {
  vec2 uv = floor(v_uv * u_pixels) / u_pixels;
  float d = distance(uv, vec2(0.5)) * 0.4;
  if (u_should_tile == 1) d = 0.14; // tiles can't privilege a center
  uv *= u_uv_correct;
  bool dith = dither(uv, v_uv, u_pixels);
  float n = cloud_alpha(uv * u_size);
  float n2 = fbmT(uv * u_size + vec2(1.0, 1.0));
  // Soft density: high where the low-frequency field dips, massed toward
  // the frame center. Internal structure comes from the circle-noise field.
  float dens = 1.0 - smoothstep(0.3 - d, 0.58 - d, n2);
  float body = dens * (0.3 + 0.7 * n);
  if (dith) body *= 0.94;
  if (u_reduce_bg == 1) body *= 0.6;
  float col_value = floor(clamp(body, 0.0, 1.0) * 7.0) / 7.0;
  vec3 col = texture2D(u_scheme, vec2(col_value, 0.5)).rgb;
  if (col_value < 0.1) col = u_bg.rgb;
  float alpha = smoothstep(0.02, 0.35, body);
  gl_FragColor = vec4(col, alpha);
}
`;

/**
 * Astrophoto-plausible 8-step ramp: two adjacent hue families
 * (H-alpha rust/gold, reflection blue/violet, emission magenta),
 * dark→bright so the shader's col_value indexes read as depth.
 */
function nebulaPalette(rng) {
  const FAMILIES = [
    [205, 260], // reflection nebula blues / violets
    [275, 340], // emission magentas / pinks
    [10, 45], // H-alpha rusts / golds
  ];
  const fi = Math.floor(rng() * FAMILIES.length);
  const [h0, h1] = FAMILIES[fi];
  const [g0, g1] = FAMILIES[(fi + (rng() < 0.5 ? 1 : 2)) % FAMILIES.length];
  const baseHue = randRange(rng, h0, h1);
  const accentHue = randRange(rng, g0, g1);
  const cols = [];
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    // hue drifts toward the accent family as brightness climbs
    const h = baseHue + (accentHue - baseHue) * Math.pow(t, 1.6) + randRange(rng, -6, 6);
    const s = 0.45 + t * 0.25 + randRange(rng, -0.05, 0.05);
    const l = 0.12 + Math.pow(t, 1.25) * 0.66;
    cols.push(hslToRgb(h, s, l));
  }
  return cols;
}

export const backgroundsMode = {
  // id stays "backgrounds" so shared recipe URLs keep working;
  // the display name is Starscapes — this mode renders nebulae and star fields.
  id: "backgrounds",
  name: "Starscapes",
  key: "2",
  blurb: "Nebulae, cosmic dust, and star fields over deep space.",

  defaults() {
    return {
      seed: Math.floor(Math.random() * 1e9),
      width: 512,
      height: 512,
      tile: false,
      reduceBg: false,
      showDust: true,
      showNebulae: true,
      showStars: true,
      showPlanets: true,
      transparent: false,
    };
  },

  controls(state) {
    return [
      { type: "number", key: "seed", label: "Seed", min: 0, max: 2e9, step: 1 },
      { type: "number", key: "width", label: "Width", min: 128, max: 2048, step: 16 },
      { type: "number", key: "height", label: "Height", min: 128, max: 2048, step: 16 },
      { type: "checkbox", key: "tile", label: "Tileable" },
      { type: "checkbox", key: "reduceBg", label: "Reduce background" },
      { type: "checkbox", key: "showDust", label: "Dust" },
      { type: "checkbox", key: "showNebulae", label: "Nebulae" },
      { type: "checkbox", key: "showStars", label: "Stars" },
      { type: "checkbox", key: "showPlanets", label: "Planets" },
      { type: "checkbox", key: "transparent", label: "Transparent BG" },
    ];
  },

  mount(host) {
    host.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "canvas-stack";
    const glCanvas = document.createElement("canvas");
    glCanvas.className = "gen-canvas";
    const overlay = document.createElement("canvas");
    overlay.className = "gen-canvas overlay";
    wrap.append(glCanvas, overlay);
    host.append(wrap);
    this._glCanvas = glCanvas;
    this._overlay = overlay;
    this._gl = createGL(glCanvas);
    this._dust = createProgram(this._gl, STARSTUFF_FS);
    this._neb = createProgram(this._gl, NEBULAE_FS);
    this._schemeTex = null;
    this._fbo = null;
  },

  unmount() {
    this._gl = null;
  },

  generate(state) {
    const gl = this._gl;
    const w = state.width | 0;
    const h = state.height | 0;
    resizeCanvas(this._glCanvas, w, h, 1);
    resizeCanvas(this._overlay, w, h, 1);
    this._glCanvas.width = w;
    this._glCanvas.height = h;
    this._overlay.width = w;
    this._overlay.height = h;

    const rng = mulberry32(state.seed >>> 0);
    // Vary sets `pal`: same composition (seed stream), different colors
    const palette = nebulaPalette(mulberry32((state.pal ?? state.seed) >>> 0));
    const bg = state.transparent ? [0, 0, 0, 0] : [...palette[0].map((c) => c * 0.25), 1];
    if (this._schemeTex) gl.deleteTexture(this._schemeTex);
    if (this._dustTex) gl.deleteTexture(this._dustTex);
    this._schemeTex = colorschemeTexture(gl, palette);
    // Dust covers most of the frame and clamps to the ramp's top index —
    // feed it the dark half of the palette so it stays a faint under-texture
    // in the same hue family as the nebulae.
    this._dustTex = colorschemeTexture(
      gl,
      [0, 1, 1, 2, 2, 3, 3, 3].map((i) => palette[i].map((v) => v * 0.5))
    );

    const aspect =
      w > h ? [w / h, 1] : [1, h / w];
    const pixels = Math.max(w, h);
    const seedA = randRange(rng, 1, 10);
    const seedB = randRange(rng, 1, 10);

    gl.viewport(0, 0, w, h);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    if (state.transparent) clear(gl, 0, 0, 0, 0);
    else clear(gl, bg[0], bg[1], bg[2], 1);

    const bindScheme = (prog, tex = this._schemeTex) => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      setUniform1i(gl, prog, "u_scheme", 0);
    };

    if (state.showDust) {
      this._dust.draw((g, p) => {
        setUniform1f(g, p, "u_seed", seedA);
        setUniform1f(g, p, "u_pixels", pixels);
        setUniform1f(g, p, "u_size", 38);
        setUniform1i(g, p, "u_octaves", 5);
        setUniform1i(g, p, "u_should_tile", state.tile ? 1 : 0);
        setUniform1i(g, p, "u_reduce_bg", state.reduceBg ? 1 : 0);
        setUniform2f(g, p, "u_uv_correct", aspect[0], aspect[1]);
        bindScheme(p, this._dustTex);
      });
    }

    if (state.showNebulae) {
      this._neb.draw((g, p) => {
        setUniform1f(g, p, "u_seed", seedB);
        setUniform1f(g, p, "u_pixels", pixels);
        // low frequency → large soft cloud masses instead of speckle islands
        setUniform1f(g, p, "u_size", 16);
        setUniform1i(g, p, "u_octaves", 4);
        setUniform1i(g, p, "u_should_tile", state.tile ? 1 : 0);
        setUniform1i(g, p, "u_reduce_bg", state.reduceBg ? 1 : 0);
        setUniform2f(g, p, "u_uv_correct", aspect[0], aspect[1]);
        setUniform4f(g, p, "u_bg", bg[0], bg[1], bg[2], 1);
        bindScheme(p);
      });
    }

    // Stars + planets on 2D overlay
    const ctx = this._overlay.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    // One light source for the whole scene (used by planets, implied by bright stars)
    const lightAngle = rng() * Math.PI * 2;
    const lx = Math.cos(lightAngle);
    const ly = Math.sin(lightAngle);
    if (state.showStars) {
      // Real fields: power-law sizes (mostly sub-2px), near-white with a
      // temperature tint, and a loose galactic band rather than pure uniform.
      const bandAngle = rng() * Math.PI;
      const bandC = Math.cos(bandAngle);
      const bandS = Math.sin(bandAngle);
      const bandSigma = Math.min(w, h) * randRange(rng, 0.08, 0.16);
      const gauss = () => {
        // Box–Muller
        const u = Math.max(rng(), 1e-9);
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
      };
      const starColor = () => {
        const t = rng();
        if (t < 0.35) return [0.78 + rng() * 0.14, 0.85 + rng() * 0.1, 1.0]; // O/B blue-white
        if (t < 0.85) return [0.95 + rng() * 0.05, 0.95 + rng() * 0.05, 0.92 + rng() * 0.08]; // white
        return [1.0, 0.82 + rng() * 0.1, 0.6 + rng() * 0.15]; // K/M warm
      };
      const n = Math.max(60, Math.floor((w * h) / 750));
      for (let i = 0; i < n; i++) {
        let x, y;
        if (rng() < 0.4) {
          // clustered along the band through the center
          const along = (rng() - 0.5) * Math.hypot(w, h);
          const perp = gauss() * bandSigma;
          x = w / 2 + along * bandC - perp * bandS;
          y = h / 2 + along * bandS + perp * bandC;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
        } else {
          x = rng() * w;
          y = rng() * h;
        }
        const r = 0.3 + Math.pow(rng(), 3) * 1.9;
        const c = starColor();
        const a = 0.3 + Math.pow(rng(), 2) * 0.7;
        ctx.fillStyle = `rgba(${c[0] * 255},${c[1] * 255},${c[2] * 255},${a})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        if (rng() > 0.985) {
          // a handful of bright foreground stars: soft halo + diffraction spikes
          const br = r * 2 + 1.2;
          const halo = ctx.createRadialGradient(x, y, 0, x, y, br * 4);
          halo.addColorStop(0, `rgba(${c[0] * 255},${c[1] * 255},${c[2] * 255},0.8)`);
          halo.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(x, y, br * 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = `rgba(${c[0] * 255},${c[1] * 255},${c[2] * 255},0.55)`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(x - br * 3.2, y);
          ctx.lineTo(x + br * 3.2, y);
          ctx.moveTo(x, y - br * 3.2);
          ctx.lineTo(x, y + br * 3.2);
          ctx.stroke();
        }
      }
    }
    if (state.showPlanets) {
      // 0–2 planets, all lit from the same direction, with a real terminator
      const roll = rng();
      const count = roll < 0.25 ? 0 : roll < 0.8 ? 1 : 2;
      for (let i = 0; i < count; i++) {
        const pr = randRange(rng, Math.min(w, h) * 0.025, Math.min(w, h) * 0.065);
        const px = randRange(rng, pr * 1.5, w - pr * 1.5);
        const py = randRange(rng, pr * 1.5, h - pr * 1.5);
        const c0 = palette[4 + (i % 3)] || [0.6, 0.5, 0.4];
        // day side → terminator → night side along the shared light vector
        const g = ctx.createRadialGradient(
          px + lx * pr * 0.55,
          py + ly * pr * 0.55,
          pr * 0.05,
          px,
          py,
          pr * 1.35
        );
        const rgb = `${c0[0] * 255},${c0[1] * 255},${c0[2] * 255}`;
        g.addColorStop(0, `rgb(${rgb})`);
        g.addColorStop(0.45, `rgba(${rgb},0.85)`);
        g.addColorStop(0.72, `rgba(${c0[0] * 70},${c0[1] * 70},${c0[2] * 80},1)`);
        g.addColorStop(1, "rgba(4,5,10,1)");
        ctx.save();
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = g;
        ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
        ctx.restore();
        // whisper of atmosphere on the lit limb
        ctx.strokeStyle = `rgba(${rgb},0.25)`;
        ctx.lineWidth = Math.max(1, pr * 0.05);
        ctx.beginPath();
        ctx.arc(px, py, pr - ctx.lineWidth / 2, lightAngle - 1.2, lightAngle + 1.2);
        ctx.stroke();
      }
    }

    return this.composite();
  },

  composite() {
    const w = this._glCanvas.width;
    const h = this._glCanvas.height;
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const ctx = out.getContext("2d");
    ctx.drawImage(this._glCanvas, 0, 0);
    ctx.drawImage(this._overlay, 0, 0);
    return out;
  },

  exportCanvas() {
    return this.composite();
  },
};
