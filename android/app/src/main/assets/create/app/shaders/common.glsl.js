/** Shared GLSL snippets injected into fragment shaders. */
export const NOISE_FUNCS = `
float rand(vec2 coord, float seed) {
  return fract(sin(dot(coord.xy, vec2(12.9898, 78.233))) * (15.5453 + seed));
}

float noise(vec2 coord, float seed) {
  vec2 i = floor(coord);
  vec2 f = fract(coord);
  float a = rand(i, seed);
  float b = rand(i + vec2(1.0, 0.0), seed);
  float c = rand(i + vec2(0.0, 1.0), seed);
  float d = rand(i + vec2(1.0, 1.0), seed);
  vec2 cubic = f * f * (3.0 - 2.0 * f);
  return mix(a, b, cubic.x) + (c - a) * cubic.y * (1.0 - cubic.x) + (d - b) * cubic.x * cubic.y;
}

float fbm(vec2 coord, float seed, int octaves) {
  float value = 0.0;
  float scale = 0.5;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    value += noise(coord, seed) * scale;
    coord *= 2.0;
    scale *= 0.5;
  }
  return value;
}

float circleNoise(vec2 uv, float seed) {
  float uv_y = floor(uv.y);
  uv.x += uv_y * 0.31;
  vec2 f = fract(uv);
  float h = rand(vec2(floor(uv.x), floor(uv_y)), seed);
  float m = length(f - 0.25 - (h * 0.5));
  float r = h * 0.25;
  return smoothstep(0.0, r, m * 0.75);
}

bool dither(vec2 uv1, vec2 uv2, float pixels) {
  return mod(uv1.y + uv2.x, 2.0 / pixels) <= 1.0 / pixels;
}

vec2 rotate2(vec2 vec, float angle) {
  vec -= 0.5;
  float c = cos(angle);
  float s = sin(angle);
  vec = mat2(c, -s, s, c) * vec;
  return vec + 0.5;
}

vec2 spherify(vec2 uv) {
  vec2 centered = uv * 2.0 - 1.0;
  float z = sqrt(max(0.0, 1.0 - dot(centered.xy, centered.xy)));
  vec2 sphere = centered / (z + 1.0);
  return sphere * 0.5 + 0.5;
}
`;
