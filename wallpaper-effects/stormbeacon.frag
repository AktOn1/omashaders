// label: Storm beacon
// hint: a lighthouse on a rock in a night storm: the beam sweeps the rain and the waves, lightning now and then, the pointer draws the beam toward it
// category: Sea and sky
#version 440
layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;
layout(std140, binding = 0) uniform buf {
  mat4 qt_Matrix;
  float qt_Opacity;
  float time;
  vec2 mouse;
  vec2 res;
  vec2 imgSize;
  vec4 cBg;
  vec4 cBlue;
  vec4 cMagenta;
  vec4 cPink;
  vec4 cCream;
  vec4 cTarget;
  float react;
  float range;
  float zoom;
};
layout(binding = 1) uniform sampler2D src;

vec2 coverUV(vec2 uv) {
  float ra = res.x / res.y;
  float ia = imgSize.x / imgSize.y;
  vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
  return (uv - 0.5) * s + 0.5;
}
vec3 wall(vec2 uv) { return texture(src, coverUV(clamp((uv - 0.5) * max(zoom, 0.05) + 0.5, 0.0, 1.0))).rgb; } // the picture stays unzoomed; only the effect scales
float sb_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sb_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sb_hash(i), sb_hash(i + vec2(1, 0)), f.x), mix(sb_hash(i + vec2(0, 1)), sb_hash(i + vec2(1, 1)), f.x), f.y);
}
float sb_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * sb_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float sb_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * sb_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float sb_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
const float SB_HZ = 0.60;

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool onScr = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  vec3 pic = wall(uv);
  float pl = sb_luma(pic);

  // lighthouse geometry
  vec2 lamp = vec2(asp * 0.80, 0.285);
  float baseY = 0.625;

  // lightning: one flash every ~13 s, a quick double pulse
  float ph = fract(t / 13.0 + 0.55);
  float flash = exp(-abs(ph - 0.012) * 90.0) * 0.9 + exp(-abs(ph - 0.05) * 60.0) * 0.6;
  flash *= step(ph, 0.14);
  float fx = asp * (0.15 + 0.4 * sb_hash(vec2(floor(t / 13.0 + 0.55), 3.0)));

  // ---- sky: churning storm cloud, dark slate, lit from below the horizon and by the flash
  vec2 cq = vec2(p.x * 1.5 - t * 0.035, p.y * 3.2);
  vec2 warp = vec2(sb_fbm3(cq + t * 0.02), sb_fbm3(cq + 7.0 - t * 0.015));
  float cl = sb_fbm(cq * 1.1 + warp * 1.4);
  float up = 1.0 - clamp((uv.y) / SB_HZ, 0.0, 1.0);
  vec3 skyLo = vec3(0.13, 0.24, 0.27);
  vec3 skyHi = vec3(0.02, 0.045, 0.07);
  vec3 sky = mix(skyLo, skyHi, smoothstep(0.0, 0.85, up) * 0.9 + 0.1 * (1.0 - up));
  sky *= 0.55 + 0.75 * smoothstep(0.25, 0.75, cl);
  sky += vec3(0.02, 0.035, 0.04) * pl;                                           // the picture shows faintly through
  float fl = flash * (0.15 + 0.85 * smoothstep(0.35, 0.8, cl)) * exp(-pow((p.x - fx) / 0.7, 2.0));
  sky += vec3(0.55, 0.65, 0.85) * fl * 0.65 + vec3(0.25, 0.30, 0.42) * flash * 0.25;
  // the bolt
  float by = clamp(uv.y / (SB_HZ - 0.05), 0.0, 1.0);
  float bx = fx + (sb_noise(vec2(by * 9.0, 4.0)) - 0.5) * 0.13 + (sb_noise(vec2(by * 31.0, 9.0)) - 0.5) * 0.03;
  float bolt = exp(-pow((p.x - bx) / 0.0016, 2.0)) * step(uv.y, SB_HZ - 0.05) * step(0.0, ph) * step(ph, 0.06);
  bolt += exp(-pow((p.x - bx) / 0.02, 2.0)) * 0.10 * step(ph, 0.06) * step(uv.y, SB_HZ - 0.05) * flash;
  sky += vec3(0.85, 0.92, 1.0) * bolt * 0.9;

  // ---- the beam: sweeps left and right, leans toward the pointer
  float ang = 3.14159 + 0.75 * sin(t * 0.55);                                    // pointing left through the middle of the picture (+ swings)
  if (onScr) { vec2 dm = mp - lamp; ang = mix(ang, atan(dm.y, dm.x), 0.55); }
  vec2 bd = vec2(cos(ang), sin(ang));
  vec2 rel = p - lamp;
  float along = dot(rel, bd);
  float perp = dot(rel, vec2(-bd.y, bd.x));
  float spread = 0.012 + max(along, 0.0) * 0.075;
  float beam = exp(-pow(perp / spread, 2.0)) * smoothstep(0.0, 0.05, along) * exp(-max(along, 0.0) * 0.9);
  float beamBack = exp(-pow(dot(rel, vec2(-bd.y, bd.x)) / (0.012 + max(-along, 0.0) * 0.075), 2.0)) * smoothstep(0.0, 0.05, -along) * exp(-max(-along, 0.0) * 0.9);
  beam = beam + beamBack * 0.85;                                                // the lens throws two beams, opposite sides
  float mistN = 0.55 + 0.9 * sb_fbm3(vec2(p.x * 3.0 - t * 0.05, p.y * 5.0 + t * 0.03));
  vec3 beamCol = vec3(1.0, 0.90, 0.64);
  vec3 col = sky + beamCol * beam * mistN * 0.42 * smoothstep(0.0, 0.12, abs(length(rel))) * (1.0 - 0.0 * uv.y);
  float lampGlow = exp(-dot(rel, rel) / 0.0018) * 0.9 + exp(-dot(rel, rel) / 0.025) * 0.25;
  col += beamCol * lampGlow * (0.7 + 0.3 * sin(t * 3.0 + 1.0));

  // ---- the sea
  float depth = max(uv.y - SB_HZ, 0.0);
  float dz = depth + 0.02;
  float sc = 1.0 / dz;                                                             // perspective scale
  vec2 wq = vec2((p.x - asp * 0.5) * sc * 0.55 + t * 0.12, sc * 0.9 - t * 0.55);
  float w1 = sb_fbm(wq * vec2(0.9, 1.0) + sb_fbm3(wq * 0.5) * 1.5);
  float w2 = sb_noise(wq * vec2(2.4, 3.2) + 5.0);
  float crest = smoothstep(0.58, 0.82, w1 + 0.12 * w2);
  vec3 sea = mix(vec3(0.010, 0.035, 0.050), vec3(0.05, 0.15, 0.19), smoothstep(0.25, 0.7, w1));
  sea = mix(sea, skyLo * 0.8, exp(-depth * 18.0) * 0.6);                           // sky glow near the horizon
  sea += vec3(0.50, 0.62, 0.66) * crest * (0.25 + 0.5 * smoothstep(0.06, 0.4, depth)) * (0.55 + 0.45 * w2);   // whitecaps
  sea += vec3(0.30, 0.38, 0.45) * flash * (0.2 + 0.6 * crest) * 0.7;
  // the beam where it lands on the water: a long glittering stripe
  float wang = beam * smoothstep(0.0, 0.2, depth) * (0.5 + 0.9 * w2) * (0.35 + crest);
  sea += beamCol * wang * 0.22 * exp(-depth * 1.2);
  float wmask = smoothstep(SB_HZ - 0.003, SB_HZ + 0.004, uv.y);
  col = mix(col, sea, wmask);
  col += vec3(0.20, 0.30, 0.34) * smoothstep(0.010, 0.0, abs(uv.y - SB_HZ)) * 0.35;

  // ---- rock and tower silhouette
  vec3 rockC = vec3(0.012, 0.016, 0.020) + vec3(0.03, 0.04, 0.05) * flash;
  float rockN = sb_fbm3(vec2(p.x * 14.0, 1.0));
  float rx = (p.x - lamp.x) / 0.20;
  float rockTop = baseY - 0.07 * (1.0 - rx * rx) * (0.7 + 0.6 * rockN);
  float rock = smoothstep(0.0, 0.004, uv.y - rockTop) * step(uv.y, baseY + 0.010) * step(abs(rx), 1.0);
  // tower: tapered, from baseY - 0.03 up to the gallery
  float ty = clamp((uv.y - lamp.y) / (baseY - 0.02 - lamp.y), 0.0, 1.0);
  float tw = mix(0.0095, 0.021, ty);
  float tower = smoothstep(tw, tw - 0.0015, abs(p.x - lamp.x)) * step(lamp.y + 0.018, uv.y) * step(uv.y, baseY - 0.02);
  float gallery = step(abs(p.x - lamp.x), 0.019) * step(abs(uv.y - (lamp.y + 0.020)), 0.0045);
  float lantern = step(abs(p.x - lamp.x), 0.0085) * step(lamp.y - 0.014, uv.y) * step(uv.y, lamp.y + 0.018);
  float dome = step(length((p - vec2(lamp.x, lamp.y - 0.014)) * vec2(1.0, 1.4)), 0.0095) * step(uv.y, lamp.y - 0.014);
  float spire = step(abs(p.x - lamp.x), 0.0012) * step(lamp.y - 0.030, uv.y) * step(uv.y, lamp.y - 0.020);
  float stripes = 0.5 + 0.5 * step(0.5, fract(uv.y * 28.0));
  vec3 towerC = vec3(0.020, 0.024, 0.030) * (0.7 + 0.5 * stripes) + vec3(0.04, 0.05, 0.07) * flash;
  towerC += beamCol * 0.05 * smoothstep(0.4, 0.0, abs(perp)) * 0.0;
  float body = max(max(tower, gallery), max(dome, spire));
  col = mix(col, towerC, body);
  col = mix(col, beamCol * 1.1, lantern * step(0.0001, lantern) * 0.95);       // the lit lamp room
  col = mix(col, rockC, clamp(rock, 0.0, 1.0));
  // little warm window on the tower
  col += vec3(1.0, 0.7, 0.35) * smoothstep(0.004, 0.0, length((p - vec2(lamp.x, lamp.y + 0.11)) * vec2(1.0, 1.7))) * 0.8 * tower;

  // surf at the foot of the rock: pulsing foam
  float surf = exp(-pow((uv.y - (baseY + 0.004)) / 0.012, 2.0)) * smoothstep(0.24, 0.08, abs(p.x - lamp.x))
             * (0.5 + 0.5 * sb_noise(vec2(p.x * 40.0 - t * 0.6, t * 0.8)));
  surf *= 0.55 + 0.45 * sin(t * 0.9);
  col += vec3(0.65, 0.78, 0.82) * surf * 0.40 * (1.0 + flash);

  // ---- rain: slanted streaks, two thin layers
  float rain = 0.0;
  for (int k = 0; k < 2; k++) {
    float kf = float(k);
    vec2 rq = vec2(p.x * (62.0 + 30.0 * kf) + uv.y * (14.0 + 6.0 * kf), uv.y * (5.0 + 2.0 * kf) - t * (2.4 + 0.9 * kf));
    rq.y += sb_hash(vec2(floor(rq.x), kf)) * 20.0;
    float rid = floor(rq.x);
    float rh = sb_hash(vec2(rid, kf + 3.0));
    float streak = smoothstep(0.9, 1.0, fract(rq.y + rh)) * smoothstep(0.35, 0.0, abs(fract(rq.x) - 0.5)) * step(0.55, rh);
    rain += streak * (0.5 - 0.2 * kf);
  }
  col += vec3(0.55, 0.65, 0.72) * rain * 0.10 * (1.0 + 4.0 * beam) ;

  // vignette
  col *= 1.0 - 0.5 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.2);
  return vec4(col, 1.0) * qt_Opacity;
}

// mouse reaction slider: 1 = as designed, 0 = the pointer is ignored, above 1 = exaggerated (extrapolated from the no-pointer look)
void main() {
  vec2 away = vec2(-10000.0);
  vec4 c;
  if (react >= 0.995 && react <= 1.005) c = fxMain(mouse);
  else if (react <= 0.005) c = fxMain(away);
  else c = mix(fxMain(away), fxMain(mouse), react);
  fragColor = clamp(c, 0.0, 1.0);
}
