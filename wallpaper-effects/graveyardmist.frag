// label: Graveyard mist
// hint: your picture is veiled in cold green-grey mist that pools where it is dark and low, with a veiled moon halo over its brightest spot, a few painted graveyard silhouettes standing in the fog and will-o-wisps that curl around the pointer. No scenery: your picture stays
// category: Dark tales
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
layout(binding = 2) uniform sampler2D sprites; // graveyardmist.png: 4 x 2 cells of 256 px, painted cut-outs (0,1 crosses, 2 angel, 3 dead tree, 4 lantern)

vec2 coverUV(vec2 uv) {
  float ra = res.x / res.y;
  float ia = imgSize.x / imgSize.y;
  vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
  return (uv - 0.5) * s + 0.5;
}
vec3 wall(vec2 uv) { return texture(src, coverUV(clamp((uv - 0.5) * max(zoom, 0.05) + 0.5, 0.0, 1.0))).rgb; } // the picture stays unzoomed; only the effect scales
// a blurred read of the picture: the mist follows broad shadows, not every leaf
vec3 wallBlur(vec2 uv, float lod) { return textureLod(src, coverUV(clamp((uv - 0.5) * max(zoom, 0.05) + 0.5, 0.0, 1.0)), lod).rgb; }

float gm_sq(float x) { return x * x; }
float gm_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float gm_hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float gm_h1(float n) { return gm_hash(vec2(n, n * 0.7 + 4.0)); }
float gm_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gm_hash(i), gm_hash(i + vec2(1, 0)), f.x), mix(gm_hash(i + vec2(0, 1)), gm_hash(i + vec2(1, 1)), f.x), f.y);
}
// two octaves only; the two mist layers together stay inside the four-octave budget
float gm_f2(vec2 p) { return 0.64 * gm_noise(p) + 0.36 * gm_noise(p * 2.17 + 11.3); }

// the sprites that stand in the mist: x, base y (fractions of the screen), half cell size (fraction of the height), atlas cell
vec4 gm_spot(int i) {
  if (i == 0) return vec4(0.140, 1.045, 0.240, 3.0);  // dead twisted tree, bottom left, cropped
  if (i == 1) return vec4(0.207, 0.560, 0.060, 4.0);  // lantern, hanging from a branch of the tree
  if (i == 2) return vec4(0.330, 0.990, 0.092, 0.0);  // leaning stone cross
  if (i == 3) return vec4(0.705, 1.000, 0.200, 2.0);  // weeping angel
  return vec4(0.900, 0.968, 0.112, 1.0);              // iron cross, far right
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  float t = time;
  bool has = mpx.x > -5000.0;
  vec2 mp = has ? vec2(mpx.x / res.y, mpx.y / res.y) : vec2(-10.0);
  vec2 par = has ? (vec2(mpx.x / res.x, mpx.y / res.y) - 0.5) : vec2(0.0);

  vec3 pic = wall(uv);
  float pl = gm_luma(pic);
  float plb = gm_luma(wallBlur(uv, 4.5));          // broad brightness: the mist keys off this

  // ---- the picture itself: a touch desaturated and pulled towards green-grey
  float lum = gm_luma(pic);
  vec3 col = mix(pic, vec3(lum) * vec3(0.90, 1.00, 0.94), 0.30);
  col *= 0.94 + 0.06 * smoothstep(0.9, 0.2, uv.y);

  // ---- the brightest patch of the picture, found on a coarse 4 x 4 grid of the upper half (no arrays)
  vec2 bc = vec2(0.0);
  float bw = 1e-4, bmax = 0.0;
  for (int i = 0; i < 16; i++) {
    vec2 g = vec2((mod(float(i), 4.0) + 0.5) / 4.0, 0.07 + 0.49 * (floor(float(i) / 4.0) + 0.5) / 4.0);
    float l = gm_luma(wallBlur(g, 6.0));
    float w = max(l - 0.14, 0.0); w = w * w; w = w * w + 2e-4;
    bc += g * w; bw += w; bmax = max(bmax, l);
  }
  vec2 moonUV = bc / bw;
  vec2 moon = vec2(moonUV.x * asp, moonUV.y);
  moon += vec2(0.004 * sin(t * 0.05), 0.003 * cos(t * 0.04));

  // ---- pointer: it stirs the mist into a slow curl and calls the wisps in
  vec2 dm = p - mp;
  float rm = length(dm);
  float swirl = has ? exp(-rm * rm / 0.020) : 0.0;
  vec2 curl = vec2(-dm.y, dm.x) / (rm + 0.07) * swirl * 0.10;
  float gather = has ? exp(-rm * rm / 0.045) : 0.0;

  // ---- two mist layers drifting at different speeds (far one behind the silhouettes, near one in front)
  vec2 fa = vec2(p.x * 1.65 - t * 0.0115 + par.x * 0.020, uv.y * 3.3 - t * 0.004) + curl * 0.35;
  float nf = gm_f2(fa);
  vec2 na = vec2(p.x * 2.85 + t * 0.0265 + par.x * 0.055, uv.y * 5.1 + t * 0.006) + nf * 0.60 + curl;
  float nn = gm_f2(na);

  float dark = smoothstep(0.60, 0.07, plb);        // thick where the picture is dark
  float low = smoothstep(0.10, 0.90, uv.y);        // and thick low down
  float key = clamp(0.34 + 0.44 * dark + 0.50 * low + 0.28 * gather, 0.0, 1.15);
  float farA = smoothstep(0.33, 0.85, nf) * key * 0.34;
  float nearA = smoothstep(0.40, 0.93, nn) * key * 0.40;

  // the mist takes the picture's own brightness but none of its colour, so it reads as fog
  // over a bright gradient just as well as over a dark forest
  vec3 mistC = mix(vec3(0.335, 0.415, 0.380), vec3(0.740, 0.800, 0.760), smoothstep(0.04, 0.80, plb));

  // ---- the lantern's warm light: it flickers and it is the mist that shows it
  vec4 lsp = gm_spot(1);
  vec2 lpos = vec2(lsp.x * asp, lsp.y) + par * 0.018 + vec2(0.010 * sin(t * 0.33), 0.004 * sin(t * 0.52));
  float flick = 0.80 + 0.14 * sin(t * 4.3) * sin(t * 1.7) + 0.06 * sin(t * 11.0 + 1.3);
  float dl = length(p - lpos);
  float lamp = (exp(-dl / 0.075) * 0.55 + exp(-dl / 0.26) * 0.22) * flick;
  vec3 lampC = vec3(1.00, 0.63, 0.26);

  // ---- the veiled moon halo over that bright patch; the thin cloud veil breathes
  float dmn = length(p - moon);
  vec2 vq = vec2(p.x * 1.6 - t * 0.010, uv.y * 4.0);
  float veil = smoothstep(0.35, 0.80, gm_f2(vq + nf * 0.5));
  float halo = (exp(-dmn / 0.085) * 0.50 + exp(-dmn / 0.33) * 0.26) * (0.60 + 0.40 * veil);
  vec3 moonC = vec3(0.80, 0.90, 0.85);
  float moonAmt = 0.30 * (1.0 - 0.45 * smoothstep(0.35, 0.85, bmax));   // on an already bright sky it only whispers
  col += moonC * halo * moonAmt;
  col = mix(col, mistC * 0.9, halo * veil * 0.16);                      // the cloud that veils it greys the picture a little

  // far mist behind the silhouettes
  mistC += lampC * lamp * 0.55;
  col = mix(col, mistC, farA);

  // ---- the silhouettes: painted cut-outs read as dark shapes standing in the fog
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec4 sp = gm_spot(i);
    float r = sp.z;
    bool hang = (i == 1);
    float depth = 0.45 + 0.55 * smoothstep(0.06, 0.25, r);
    vec2 c = vec2(sp.x * asp, sp.y - (hang ? 0.0 : r * 0.90)) + par * depth * 0.024 * vec2(-1.0, -1.0);
    float sway = (hang ? 0.012 : 0.0030 + 0.004 * r) * sin(t * (hang ? 0.33 : 0.21 + 0.07 * fi) + fi * 1.9);
    c.x += sway;
    vec2 q0 = p - c;
    float ext = r * 1.75;
    if (abs(q0.x) < ext && abs(q0.y) < ext) {
      // the fog banks up a little behind each shape, so a black silhouette still reads on a dark picture
      if (!hang) {
        vec2 qe = q0 / r;
        float aur = exp(-dot(qe, qe) * 1.15) * (0.30 + 1.00 * dark) * (0.45 + 0.85 * nn)
                    * (1.0 - 0.45 * smoothstep(0.10, 0.24, r));   // the big tree does not drag a whole bank with it
        col = mix(col, mistC * 1.14, clamp(aur, 0.0, 1.0) * 0.28 * (0.45 + 0.75 * key));
      }
    }
    if (abs(q0.x) < r && abs(q0.y) < r) {
      float tilt = (hang ? 0.09 * sin(t * 0.33) : 0.0);
      float cs = cos(tilt), sn = sin(tilt);
      vec2 q = vec2(cs * q0.x + sn * q0.y, -sn * q0.x + cs * q0.y) / r;
      if (i == 4) q.x = -q.x;                                  // the far cross leans the other way
      vec2 base = (vec2(mod(sp.w, 4.0), floor(sp.w / 4.0)) + 0.5) / vec2(4.0, 2.0);
      vec2 cuv = base + q * 0.453 / vec2(4.0, 2.0);
      vec4 s = texture(sprites, cuv);
      float a = s.a;
      if (a > 0.004) {
        // the fog eats the feet of everything that stands on the ground
        float sink = hang ? 0.0 : smoothstep(0.35, 1.0, (q.y + 0.9)) * (0.45 + 0.45 * nearA / 0.40);
        a *= clamp(1.0 - sink, 0.0, 1.0);
        a *= 0.90 - 0.30 * farA / 0.34;
        // a cold rim where the shape faces the moon, found from the cut-out's own alpha
        vec2 toM = normalize(moon - c + 1e-5) * 0.0105 / vec2(4.0, 2.0);
        float rim = a * (1.0 - texture(sprites, cuv + toM).a);
        float sl = gm_luma(s.rgb);
        vec3 silC = vec3(0.030, 0.045, 0.042) + vec3(0.035, 0.050, 0.046) * sl;   // the painting's own shading, almost blacked out
        // only the warm pixels of the cut-out burn: that is the lantern's little flame behind its glass
        float emis = smoothstep(0.06, 0.30, s.r - s.b) * smoothstep(0.18, 0.55, sl);
        silC += lampC * emis * (0.55 + 0.75 * flick);
        col = mix(col, silC, a);
        col += vec3(0.40, 0.54, 0.49) * rim * (0.30 + 0.60 * clamp(bmax, 0.0, 1.0));
      }
    }
  }

  // the lantern's glow on the picture and, more strongly, on the mist in front of it
  col += lampC * lamp * (0.16 + 0.55 * (farA + nearA));

  // ---- near mist layer: it drifts in front of the silhouettes
  col = mix(col, mistC * 1.04, nearA);

  // ---- will-o-wisps: a few pale green lights that rise, and curl around the pointer when it is here
  vec3 wispC = vec3(0.56, 0.95, 0.72);
  float wsum = 0.0, wglow = 0.0;
  for (int k = 0; k < 7; k++) {
    float fk = float(k);
    float hs = gm_h1(fk + 5.0);
    float per = 13.0 + 7.0 * hs;
    float ph = fract(t / per + gm_h1(fk + 11.0));
    float cyc = floor(t / per + gm_h1(fk + 11.0));
    vec2 h = vec2(asp * (0.07 + 0.86 * gm_hash(vec2(fk, cyc + 3.0))) + 0.026 * sin(ph * 6.0 + fk * 2.0),
                  mix(1.00, 0.60, ph));
    float fade = smoothstep(0.0, 0.18, ph) * (1.0 - smoothstep(0.55, 1.0, ph));
    float on = 1.0;
    if (k >= 4) {                                   // three wisps exist only while the pointer is on this screen
      float ang = fk * 2.3 + t * 0.55 * (1.0 + 0.3 * hs);
      float orb = 0.055 + 0.035 * hs + 0.012 * sin(t * 0.8 + fk);
      h = mp + vec2(cos(ang), 0.72 * sin(ang * 1.21)) * orb;
      on = has ? 1.0 : 0.0;
      fade = 0.55 + 0.45 * sin(t * 1.1 + fk * 2.0);
    } else if (has) {                               // the rising ones lean towards the pointer
      vec2 dd = mp - h;
      h += dd * 0.62 * exp(-dot(dd, dd) / 0.14);
    }
    vec2 d = p - h;
    float head = exp(-dot(d, d) / 0.00008);
    float dy = max(d.y, 0.0);
    float tail = exp(-gm_sq((d.x - 0.008 * sin(dy * 20.0 - t * 1.5 + fk * 1.7)) / (0.0024 + 0.014 * dy)))
                 * exp(-dy / 0.030) * smoothstep(0.0, 0.008, d.y);
    wsum += (head + 0.30 * tail) * fade * on;
    wglow += exp(-dot(d, d) / 0.0030) * fade * on;
  }
  col += wispC * wglow * 0.17 * (0.4 + 1.6 * (farA + nearA));   // their light shows in the mist
  col += wispC * wsum * 0.42;

  // ---- a last cold breath: vignette and a thin veil at the very bottom
  col = mix(col, mistC * 0.96, smoothstep(0.90, 1.0, uv.y) * 0.16 * key);
  col *= 1.0 - 0.20 * pow(length((uv - 0.5) * vec2(1.0, 1.08)), 2.4);
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
