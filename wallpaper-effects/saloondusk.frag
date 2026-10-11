// label: Dusty saloon
// hint: sunset over a one-street western town: a saloon with a swinging lantern, a tumbleweed rolling slowly past, long shadows and golden dust that swirls near the pointer while the lantern leans toward it
// category: Frontier and steam
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
float sd_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sd_noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sd_hash(i), sd_hash(i + vec2(1, 0)), f.x), mix(sd_hash(i + vec2(0, 1)), sd_hash(i + vec2(1, 1)), f.x), f.y);
}
float sd_fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * sd_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float sd_fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * sd_noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float sd_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// coverage of an axis aligned rectangle (centre c, half size h), y runs down
float sd_rect(vec2 p, vec2 c, vec2 h) {
  vec2 d = abs(p - c) - h;
  return 1.0 - smoothstep(-0.0008, 0.0012, max(d.x, d.y));
}
// coverage of a capsule from a to b with radius r
float sd_seg(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return 1.0 - smoothstep(r - 0.0006, r + 0.0008, length(pa - ba * h));
}

const float SD_HZ = 0.60;

// the shadow a vertical thing casts on the street: the sun sits at the horizon point sunX, so every shadow runs along a line through that point
float sd_shadow(vec2 p, float sunX, float xa, float xb, float yf, float len) {
  float dy = max(p.y - SD_HZ, 0.01);
  float s = (p.x - sunX) / dy;
  float s0 = (xa - sunX) / (yf - SD_HZ);
  float s1 = (xb - sunX) / (yf - SD_HZ);
  float w = 0.05 + 0.05 * (s1 - s0);
  float side = smoothstep(s0 - w, s0 + w, s) * (1.0 - smoothstep(s1 - w, s1 + w, s));
  float along = smoothstep(yf - 0.004, yf + 0.006, p.y) * (1.0 - smoothstep(yf + len * 0.55, yf + len, p.y));
  return side * along;
}

vec4 fxMain(vec2 mpx) {
  vec2 uv = qt_TexCoord0;
  float asp = res.x / res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = mpx / res;
  bool hasM = m.x > 0.0 && m.x < 1.0 && m.y > 0.0 && m.y < 1.0;
  vec2 mp = vec2(m.x * asp, m.y);
  float t = time;
  vec3 pic = wall(uv);

  vec2 sunP = vec2(asp * 0.30, 0.572);
  vec3 sunCol = vec3(1.0, 0.72, 0.38);
  float dSun = length((p - sunP) * vec2(0.75, 1.0));

  // dust that swirls around the pointer: the sampling space of the haze and the grains is turned about it
  vec2 dq = p;
  float swirl = 0.0;
  if (hasM) {
    vec2 dd = p - mp;
    float r2 = dot(dd, dd);
    swirl = exp(-r2 / 0.045);
    float ang = swirl * (1.8 * sin(t * 0.55) + 0.9 * sin(t * 1.3 + 1.0));
    float cs = cos(ang), sn = sin(ang);
    dq = mp + vec2(cs * dd.x - sn * dd.y, sn * dd.x + cs * dd.y);
  }

  vec3 col;
  float k = uv.y / SD_HZ;

  // ---- sky: dusty violet overhead, rust and gold toward the sun
  vec3 skyTop = vec3(0.17, 0.15, 0.30);
  vec3 skyMid = vec3(0.70, 0.34, 0.30);
  vec3 skyLow = vec3(1.0, 0.70, 0.36);
  vec3 sky = mix(skyTop, skyMid, smoothstep(0.05, 0.80, k));
  sky = mix(sky, skyLow, smoothstep(0.70, 1.0, k));
  sky += sunCol * exp(-dSun * dSun / 0.060) * 0.45 + vec3(1.0, 0.85, 0.55) * exp(-dSun * dSun / 0.006) * 0.55;
  // long streaky clouds, lit underneath by the sun
  float cn = sd_fbm(vec2(p.x * 0.7 + t * 0.006, uv.y * 7.5) + 3.0);
  float cmask = smoothstep(0.50, 0.74, cn) * smoothstep(0.02, 0.18, uv.y) * smoothstep(SD_HZ, 0.30, uv.y);
  float sunSide = exp(-pow((p.x - sunP.x) / 0.9, 2.0));
  vec3 cloudC = mix(vec3(0.30, 0.18, 0.34), vec3(1.0, 0.52, 0.30), sunSide * (0.35 + 0.65 * smoothstep(0.05, 0.5, uv.y)));
  sky = mix(sky, cloudC, cmask * 0.75);
  // faint rays fanning from the sun
  float rayA = atan(p.y - sunP.y, (p.x - sunP.x) * 0.8);
  float rays = pow(sd_noise(vec2(rayA * 9.0, 2.0)), 3.0) * exp(-dSun * 1.6);
  sky += vec3(1.0, 0.7, 0.4) * rays * 0.10;
  // the sun disc, half sunk behind the mesas
  float disc = 1.0 - smoothstep(0.034, 0.040, dSun / 0.75 * 0.75);
  sky = mix(sky, vec3(1.0, 0.94, 0.78), disc);
  col = sky;
  vec3 hazeC = vec3(1.0, 0.70, 0.40);

  // ---- far mesas, flat topped
  float mh = sd_fbm3(vec2(p.x * 1.5 + 4.0, 3.0));
  float ridge = SD_HZ - 0.012 - 0.085 * smoothstep(0.38, 0.52, mh) - 0.02 * mh;
  float mesa = smoothstep(ridge - 0.0012, ridge + 0.0015, uv.y);
  vec3 mesaC = mix(vec3(0.34, 0.17, 0.27), hazeC * 0.7, 0.40 + 0.35 * smoothstep(ridge, SD_HZ, uv.y));
  col = mix(col, mesaC, mesa * step(uv.y, SD_HZ + 0.01));

  // ---- the far end of the street: a row of false-front shops, and a water tower against the sun
  {
    float bw = 0.042;
    float id = floor(p.x / bw);
    float fx = fract(p.x / bw);
    float hh = sd_hash(vec2(id, 7.0));
    float exist = step(0.22, hh) * step(0.05 * asp, p.x) * step(p.x, asp * 0.66);
    float top = SD_HZ - 0.016 - 0.030 * sd_hash(vec2(id, 1.0));
    top -= 0.010 * step(0.22, abs(fx - 0.5)) * 0.0 + 0.012 * step(abs(fx - 0.5), 0.30) * step(0.5, sd_hash(vec2(id, 5.0)));   // a stepped false front on some
    float b = step(top, uv.y) * step(uv.y, SD_HZ + 0.004) * exist * step(0.06, fx) * step(fx, 0.94);
    vec3 bc = mix(vec3(0.20, 0.11, 0.16), hazeC * 0.55, 0.40);
    // a few warm lit windows
    float wnd = step(0.78, sd_hash(vec2(id, floor(uv.y * 160.0)))) * step(abs(fx - 0.5), 0.2) * step(top + 0.006, uv.y) * step(uv.y, SD_HZ - 0.004);
    bc += vec3(1.0, 0.7, 0.3) * wnd * 0.45;
    col = mix(col, bc, b);
    // water tower: tank, roof, legs
    vec2 wt = vec2(asp * 0.385, SD_HZ + 0.004);
    float tank = sd_rect(p, wt + vec2(0.0, -0.092), vec2(0.0125, 0.017));
    float roofW = clamp((wt.y - 0.113 - p.y) / 0.014, 0.0, 1.0);
    float roof = step(p.y, wt.y - 0.109) * step(wt.y - 0.123, p.y) * step(abs(p.x - wt.x), 0.0145 * (1.0 - roofW));
    float legs = sd_seg(p, wt + vec2(-0.010, -0.074), wt + vec2(-0.015, 0.0), 0.0010) + sd_seg(p, wt + vec2(0.010, -0.074), wt + vec2(0.015, 0.0), 0.0010)
               + sd_seg(p, wt + vec2(-0.012, -0.040), wt + vec2(0.012, -0.060), 0.0006) + sd_seg(p, wt + vec2(0.012, -0.040), wt + vec2(-0.012, -0.060), 0.0006);
    float tw = clamp(max(max(tank, roof), legs), 0.0, 1.0);
    col = mix(col, vec3(0.16, 0.09, 0.14), tw);
    // a small church steeple down the street
    vec2 ch = vec2(asp * 0.50, SD_HZ + 0.004);
    float cb = sd_rect(p, ch + vec2(0.0, -0.018), vec2(0.012, 0.018));
    float spire = step(p.y, ch.y - 0.036) * step(ch.y - 0.075, p.y) * step(abs(p.x - ch.x), 0.0075 * (1.0 - (ch.y - 0.036 - p.y) / 0.039));
    col = mix(col, mix(vec3(0.20, 0.11, 0.16), hazeC * 0.5, 0.35), clamp(cb + spire, 0.0, 1.0));
  }

  // ---- the street: dust tan, hazy gold at the far end, warm brown close up, wheel ruts running to the vanishing point
  if (uv.y > SD_HZ) {
    float dpt = uv.y - SD_HZ;
    float gz = dpt + 0.02;
    float gx = (p.x - asp * 0.46) / gz * 0.03;
    float gzz = 0.03 / gz;
    float grain = sd_fbm(vec2(gx * 9.0, gzz * 5.0));
    vec3 far = vec3(0.86, 0.54, 0.31);
    vec3 near = vec3(0.22, 0.12, 0.12);
    vec3 g = mix(far, near, pow(clamp(dpt / 0.36, 0.0, 1.0), 0.75));
    g *= 0.82 + 0.34 * grain;
    float rut = exp(-pow((abs(gx) - 0.20) / 0.05, 2.0)) * 0.5 + exp(-pow((abs(gx) - 0.55) / 0.045, 2.0)) * 0.4;
    g *= 1.0 - 0.28 * rut * smoothstep(0.0, 0.10, dpt);
    // sunlight on the road, strongest along the line from the sun
    float sunRoad = exp(-pow((p.x - sunP.x) / (0.12 + 1.2 * dpt), 2.0)) * exp(-dpt * 3.0);
    g += sunCol * sunRoad * 0.32;
    col = g;
    // ---- long shadows, each one runs away from the sun along a line through the sun's point on the horizon
    float cx0 = min(asp * 0.77, asp - 0.36);
    float sh = 0.0;
    sh = max(sh, sd_shadow(p, sunP.x, cx0 - 0.24, cx0 + 0.24, 0.87, 0.30));                     // the saloon
    sh = max(sh, sd_shadow(p, sunP.x, asp * 0.115, asp * 0.122, 0.835, 0.16));                  // hitching posts
    sh = max(sh, sd_shadow(p, sunP.x, asp * 0.215, asp * 0.222, 0.835, 0.16));
    sh = max(sh, sd_shadow(p, sunP.x, cx0 - 0.345, cx0 - 0.305, 0.88, 0.05));                     // barrel
    sh = max(sh, sd_shadow(p, sunP.x, asp * 0.62, asp * 0.626, 0.70, 0.06));                      // a lone post up the street
    col = mix(col, col * vec3(0.34, 0.25, 0.38), sh * 0.80);
  }

  // ---- hitching rail in the near left: two posts and a rail, dark against the dust, rim lit
  {
    float post1 = sd_rect(p, vec2(asp * 0.1185, 0.80), vec2(0.0040, 0.036));
    float post2 = sd_rect(p, vec2(asp * 0.2185, 0.80), vec2(0.0040, 0.036));
    float rail = sd_rect(p, vec2(asp * 0.1685, 0.783), vec2(asp * 0.0500 + 0.004, 0.0040));
    float hr = clamp(post1 + post2 + rail, 0.0, 1.0);
    vec3 hc = vec3(0.16, 0.08, 0.10);
    hc += vec3(1.0, 0.6, 0.3) * 0.25 * smoothstep(0.0, 1.0, 1.0 - (p.x - asp * 0.1145) * 60.0) * step(p.x, asp * 0.1225);
    col = mix(col, hc, hr);
  }
  // barrel by the saloon, with iron hoops
  float cx = min(asp * 0.77, asp - 0.36);
  {
    vec2 bq = (p - vec2(cx - 0.325, 0.852)) / vec2(0.021, 0.031);
    float belly = 1.0 + 0.10 * (1.0 - bq.y * bq.y);
    float bb = (1.0 - smoothstep(0.90, 1.0, abs(bq.x) / belly)) * (1.0 - smoothstep(0.92, 1.0, abs(bq.y)));
    float band = smoothstep(0.10, 0.0, abs(abs(bq.y) - 0.58));
    vec3 bc = vec3(0.34, 0.18, 0.11) * (0.55 + 0.6 * (1.0 - smoothstep(-1.0, 1.0, bq.x))) * (0.85 + 0.15 * sin(bq.x * 18.0));
    bc = mix(bc, vec3(0.06, 0.05, 0.06), band * 0.7);
    col = mix(col, bc, bb);
  }

  // a saguaro cactus at the left edge, dark against the glow, rim lit on the sun side
  {
    float cxx = asp * 0.045, cyb = 0.90;
    float trunk = sd_seg(p, vec2(cxx, cyb), vec2(cxx, cyb - 0.34), 0.0125);
    float armL = max(sd_seg(p, vec2(cxx, cyb - 0.12), vec2(cxx - 0.045, cyb - 0.12), 0.0085), sd_seg(p, vec2(cxx - 0.045, cyb - 0.12), vec2(cxx - 0.045, cyb - 0.20), 0.0085));
    float armR = max(sd_seg(p, vec2(cxx, cyb - 0.19), vec2(cxx + 0.050, cyb - 0.19), 0.0085), sd_seg(p, vec2(cxx + 0.050, cyb - 0.19), vec2(cxx + 0.050, cyb - 0.27), 0.0085));
    float cac = clamp(trunk + armL + armR, 0.0, 1.0);
    vec3 cc = vec3(0.09, 0.07, 0.10) + vec3(1.0, 0.55, 0.25) * 0.22 * smoothstep(0.0, 0.5, (p.x - (cxx - 0.02)) * -40.0 + 0.5) * 0.0;
    cc += vec3(1.0, 0.6, 0.3) * 0.16 * smoothstep(0.012, 0.0, abs(p.x - cxx - 0.010)) * step(p.y, cyb);
    col = mix(col, cc, cac);
  }

  // ---- the saloon
  {
    float Y0 = 0.87;
    vec2 q = vec2(p.x - cx, p.y);
    float dx = q.x;
    float adx = abs(dx);
    // swinging lantern first: its position decides the light the facade receives
    float armY = 0.605;
    vec2 piv = vec2(cx - 0.292, armY + 0.003);
    float lean = hasM ? clamp((mp.x - piv.x) / 0.6, -1.0, 1.0) * 0.55 : 0.0;
    float lang = 0.13 * sin(t * 1.25) + 0.05 * sin(t * 2.7 + 1.3) + lean;
    float clen = 0.060;
    vec2 bob = piv + clen * vec2(sin(lang), cos(lang));
    float flick = 0.88 + 0.07 * sin(t * 11.0) + 0.05 * sin(t * 17.0 + 2.0);

    // wall of the upper storey, weathered planks, lit warm from the left by the low sun
    float ptop = 0.395 - 0.050 * step(adx, 0.150) - 0.035 * step(adx, 0.085) + 0.0;
    float bodyTop = 0.455;
    float upper = step(adx, 0.238) * step(bodyTop, p.y) * step(p.y, 0.655) + step(adx, 0.205) * step(ptop, p.y) * step(p.y, bodyTop + 0.002);
    float plank = 0.78 + 0.22 * sd_hash(vec2(floor(p.x / 0.013), 2.0)) + 0.10 * sin(p.x * 900.0 + p.y * 30.0) * 0.0;
    float board = smoothstep(0.1, 0.0, abs(fract(p.y / 0.011) - 0.5) - 0.42);
    float sunlit = 0.55 + 0.45 * smoothstep(0.30, -0.25, dx);      // the left side catches more sun
    vec3 wood = vec3(0.50, 0.26, 0.16) * (0.55 + 0.55 * sunlit) * plank * (1.0 - 0.20 * board);
    wood = mix(wood, wood * vec3(0.55, 0.40, 0.55), smoothstep(0.50, 0.66, p.y) * 0.55);       // shade under the balcony
    // the lantern lights what is close to it
    float ld = length(p - bob);
    float lantLight = exp(-ld * ld / 0.010) * flick;
    vec3 lampC = vec3(1.0, 0.70, 0.32);
    wood += lampC * lantLight * 0.55;
    col = mix(col, wood, clamp(upper, 0.0, 1.0));
    // cornice
    col = mix(col, vec3(0.12, 0.06, 0.08), sd_rect(p, vec2(cx, bodyTop + 0.003), vec2(0.250, 0.0045)));
    col = mix(col, vec3(0.20, 0.10, 0.10), sd_rect(p, vec2(cx, ptop - 0.002 + 0.0), vec2(0.0, 0.0)));

    // the sign: a long board with cream letter blocks, warm light on it
    float sbm = sd_rect(p, vec2(cx, 0.425), vec2(0.150, 0.026));
    vec3 sbc = vec3(0.22, 0.12, 0.09) * (0.75 + 0.4 * sunlit);
    sbc += lampC * exp(-pow(length(p - vec2(cx - 0.12, 0.43)), 2.0) / 0.012) * 0.10;
    col = mix(col, sbc, sbm);
    col = mix(col, vec3(0.62, 0.40, 0.20), (1.0 - sd_rect(p, vec2(cx, 0.425), vec2(0.140, 0.020))) * sbm);
    {
      float li = floor((dx + 0.108) / 0.036);
      float lf = (dx + 0.108) / 0.036 - li;
      vec2 gc = vec2(lf, (p.y - 0.4075) / 0.035);
      float inl = step(0.0, li) * step(li, 5.0) * step(0.18, lf) * step(lf, 0.82) * step(0.0, gc.y) * step(gc.y, 1.0);
      float gcell = sd_hash(vec2(li, floor(gc.y * 4.0)) + floor((lf - 0.18) / 0.22) * 7.0 + 1.0);
      float stroke = step(0.30, gcell) * 0.0 + step(0.28, sd_hash(vec2(li * 3.1 + floor((lf - 0.18) / 0.22), floor(gc.y * 5.0))));
      col = mix(col, vec3(0.97, 0.80, 0.50) * (0.8 + 0.2 * flick), inl * stroke * sbm);
    }

    // upper windows, warm and lit, a door onto the balcony between them
    for (int w = 0; w < 3; w++) {
      float wx = (w == 0) ? -0.125 : ((w == 1) ? 0.125 : 0.0);
      float wh = (w == 2) ? 0.055 : 0.050;
      float wy = (w == 2) ? 0.557 : 0.545;
      float ww = (w == 2) ? 0.026 : 0.030;
      float frame = sd_rect(p, vec2(cx + wx, wy), vec2(ww + 0.006, wh + 0.006));
      float glass = sd_rect(p, vec2(cx + wx, wy), vec2(ww, wh));
      float fl = 0.80 + 0.20 * sd_hash(vec2(float(w), floor(t * 0.5) + 3.0));
      vec3 gcol = mix(vec3(1.0, 0.62, 0.24), vec3(1.0, 0.82, 0.48), smoothstep(wy + wh, wy - wh, p.y) * 0.5) * fl * (w == 2 ? 0.55 : 1.0);
      float mull = max(sd_rect(p, vec2(cx + wx, wy), vec2(0.0016, wh)), sd_rect(p, vec2(cx + wx, wy - 0.01), vec2(ww, 0.0016)));
      col = mix(col, vec3(0.10, 0.05, 0.07), frame);
      col = mix(col, gcol, glass);
      col = mix(col, vec3(0.10, 0.05, 0.07), mull * glass);
      col += vec3(1.0, 0.65, 0.30) * glass * 0.0;
    }

    // balcony: deck, balusters and a top rail
    float deck = sd_rect(p, vec2(cx, 0.660), vec2(0.262, 0.008));
    float balu = sd_rect(vec2(mod(dx + 0.012, 0.024) - 0.012, p.y), vec2(0.0, 0.620), vec2(0.0028, 0.034)) * step(adx, 0.255);
    float topR = sd_rect(p, vec2(cx, 0.585), vec2(0.262, 0.0045));
    vec3 trim = vec3(0.17, 0.09, 0.09) + lampC * lantLight * 0.15;
    col = mix(col, trim, clamp(deck + balu + topR, 0.0, 1.0));

    // ground floor: dark porch, warm light spilling out of the doors and windows
    float floor1 = step(adx, 0.238) * step(0.668, p.y) * step(p.y, Y0);
    vec3 porch = vec3(0.10, 0.055, 0.075);
    float inner = exp(-pow(dx / 0.15, 2.0)) * (0.6 + 0.4 * smoothstep(0.668, Y0, p.y));
    porch += vec3(0.55, 0.28, 0.12) * inner * 0.28;
    col = mix(col, porch, floor1);
    // lit windows left and right of the doors
    for (int w = 0; w < 2; w++) {
      float wx = (w == 0) ? -0.130 : 0.130;
      float gl = sd_rect(p, vec2(cx + wx, 0.775), vec2(0.040, 0.034));
      float fr = sd_rect(p, vec2(cx + wx, 0.775), vec2(0.046, 0.040));
      float mull = max(sd_rect(p, vec2(cx + wx, 0.775), vec2(0.0016, 0.034)), sd_rect(p, vec2(cx + wx, 0.775), vec2(0.040, 0.0016)));
      vec3 gc = mix(vec3(1.0, 0.58, 0.22), vec3(1.0, 0.80, 0.42), smoothstep(0.80, 0.745, p.y) * 0.6) * (0.85 + 0.15 * sd_hash(vec2(float(w) * 3.0, floor(t * 0.7))));
      col = mix(col, vec3(0.07, 0.04, 0.06), fr);
      col = mix(col, gc, gl);
      col = mix(col, vec3(0.07, 0.04, 0.06), mull * gl);
    }
    // swing doors: bright inside, louvred leaves with a gap above and below
    float dbox = sd_rect(p, vec2(cx, 0.790), vec2(0.050, 0.080));
    col = mix(col, vec3(1.0, 0.66, 0.28) * (0.75 + 0.25 * (1.0 - smoothstep(0.73, 0.87, p.y))), dbox);
    float leaf = sd_rect(p, vec2(cx - 0.0235, 0.798), vec2(0.0225, 0.042)) + sd_rect(p, vec2(cx + 0.0235, 0.798), vec2(0.0225, 0.042));
    float louvre = smoothstep(0.30, 0.55, fract(p.y / 0.0075));
    col = mix(col, mix(vec3(0.12, 0.06, 0.07), vec3(0.45, 0.25, 0.14), louvre * 0.7), clamp(leaf, 0.0, 1.0));
    col = mix(col, vec3(0.08, 0.04, 0.06), sd_rect(p, vec2(cx, 0.790), vec2(0.0016, 0.080)) * 0.0 + sd_rect(p, vec2(cx, 0.755), vec2(0.050, 0.0016)) * 0.0);
    // porch posts
    float posts = 0.0;
    for (int k = 0; k < 4; k++) {
      float px = (k == 0) ? -0.234 : ((k == 1) ? -0.100 : ((k == 2) ? 0.100 : 0.234));
      posts += sd_rect(p, vec2(cx + px, 0.768), vec2(0.0062, 0.102));
    }
    vec3 postC = vec3(0.17, 0.09, 0.09);
    postC += vec3(1.0, 0.6, 0.3) * 0.22 * (1.0 - smoothstep(0.0, 0.012, mod(p.x - (cx - 0.2405), 0.134)) * 0.0);
    col = mix(col, postC, clamp(posts, 0.0, 1.0));
    // porch floor and the step
    col = mix(col, vec3(0.20, 0.11, 0.10), sd_rect(p, vec2(cx, Y0 - 0.002), vec2(0.250, 0.0055)));
    col = mix(col, vec3(0.14, 0.08, 0.09), sd_rect(p, vec2(cx, Y0 + 0.007), vec2(0.060, 0.0055)));
    // lantern: bracket arm, chain, tin lamp with a glowing flame
    float arm = sd_rect(p, vec2(cx - 0.268, armY), vec2(0.030, 0.0030));
    float brace = sd_seg(p, vec2(cx - 0.262, armY + 0.003), vec2(cx - 0.240, armY + 0.026), 0.0018);
    float chain = sd_seg(p, piv, bob - vec2(sin(lang), cos(lang)) * 0.0, 0.0011);
    vec2 lq = vec2(cos(lang) * (p.x - bob.x) - sin(lang) * (p.y - bob.y), sin(lang) * (p.x - bob.x) + cos(lang) * (p.y - bob.y));
    float lbody = sd_rect(lq, vec2(0.0, 0.016), vec2(0.0075, 0.0125));
    float lcap = sd_rect(lq, vec2(0.0, 0.0015), vec2(0.0100, 0.0030)) + sd_rect(lq, vec2(0.0, 0.031), vec2(0.0090, 0.0020));
    float lglass = sd_rect(lq, vec2(0.0, 0.016), vec2(0.0055, 0.0095));
    col = mix(col, vec3(0.08, 0.05, 0.06), clamp(arm + brace + chain, 0.0, 1.0));
    col = mix(col, vec3(0.07, 0.05, 0.06), clamp(lbody + lcap, 0.0, 1.0));
    col = mix(col, vec3(1.0, 0.86, 0.52) * flick, lglass);
    // halo of the lantern
    vec2 hq = p - (bob + vec2(0.0, 0.016));
    col += lampC * (exp(-dot(hq, hq) / 0.0010) * 0.55 + exp(-dot(hq, hq) / 0.014) * 0.30) * flick;
    // its light on the street below, swinging with it
    {
      vec2 gq = (p - vec2(bob.x + 0.02, Y0 + 0.040)) / vec2(0.20, 0.060);
      col += lampC * exp(-dot(gq, gq)) * 0.30 * flick * smoothstep(Y0 - 0.014, Y0 + 0.012, uv.y);
    }
    // light spilling from the doors onto the street
    {
      vec2 gq = (p - vec2(cx, Y0 + 0.055)) / vec2(0.21, 0.050);
      col += vec3(1.0, 0.55, 0.22) * exp(-dot(gq, gq)) * 0.26 * smoothstep(Y0 - 0.002, Y0 + 0.014, uv.y);
    }
    // contact shadow where the saloon meets the street
    col *= 1.0 - 0.45 * smoothstep(0.0, 0.016, p.y - Y0) * (1.0 - smoothstep(0.016, 0.036, p.y - Y0)) * (1.0 - smoothstep(0.24, 0.30, adx));
  }

  // ---- the tumbleweed: a dry tangle that rolls slowly across the street in front of the saloon and hops now and then
  {
    float span = asp + 0.35;
    float rx = mod(t * 0.030 + 0.55, span) - 0.18;
    float hop = abs(sin(t * 1.15)) * 0.012 * smoothstep(0.35, 0.8, sin(t * 0.37) * 0.5 + 0.5);
    vec2 tc = vec2(rx, 0.925 - hop);
    float R = 0.052;
    vec2 tq = (p - tc) / R;
    float rr = length(tq);
    float rot = -rx / R * 1.0;
    float cs = cos(rot), sn = sin(rot);
    vec2 rq = vec2(cs * tq.x - sn * tq.y, sn * tq.x + cs * tq.y);
    // thin curved twigs: three differently squashed rings spinning with the roll plus noisy strands
    float tw = 0.0;
    for (int j = 0; j < 4; j++) {
      float jf = float(j);
      float a = rot * (0.6 + 0.35 * jf) + jf * 0.9;
      float c2 = cos(a), s2 = sin(a);
      vec2 w = vec2(c2 * tq.x - s2 * tq.y, s2 * tq.x + c2 * tq.y) * vec2(1.0, 1.0 + 0.45 * jf);
      tw += smoothstep(0.075, 0.0, abs(length(w) - (0.82 - 0.06 * jf)));
    }
    float strands = smoothstep(0.50, 0.70, sd_noise(rq * 4.5 + 3.0)) * smoothstep(1.0, 0.7, rr);
    float tum = clamp(tw + strands * 0.8, 0.0, 1.0) * (1.0 - smoothstep(0.86, 1.0, rr));
    vec3 tcol = mix(vec3(0.20, 0.11, 0.09), vec3(0.78, 0.50, 0.26), smoothstep(0.7, -0.6, tq.x) * 0.9 * (0.5 + 0.5 * sd_noise(rq * 3.0)));
    // it throws a soft shadow on the road
    vec2 sq = (p - (vec2(rx, 0.972) + vec2(0.026, 0.0))) / vec2(0.066, 0.011);
    col *= 1.0 - 0.38 * exp(-dot(sq, sq));
    col = mix(col, tcol, tum * 0.96);
    col += vec3(1.0, 0.68, 0.34) * 0.10 * tum * smoothstep(0.5, -1.0, tq.x);
  }

  // ---- drifting dust: a low golden haze that rolls along the street, and bright grains caught in the low sun
  float hz = sd_fbm(vec2(dq.x * 1.8 - t * 0.07, dq.y * 5.0 + t * 0.012) + vec2(0.0, 5.0));
  float hLayer = smoothstep(0.38, 0.78, hz);
  float hBand = exp(-pow((uv.y - 0.72) / 0.20, 2.0)) + 0.6 * exp(-pow((uv.y - SD_HZ) / 0.05, 2.0));
  float nearSun = 0.55 + 0.9 * exp(-pow((p.x - sunP.x) / 0.7, 2.0));
  float swirlBoost = 1.0 + 0.9 * swirl;
  col += vec3(1.0, 0.68, 0.36) * hLayer * hBand * nearSun * 0.12 * swirlBoost;
  col = mix(col, col * 0.85 + hazeC * 0.12, smoothstep(SD_HZ + 0.03, SD_HZ - 0.02, uv.y) * smoothstep(SD_HZ - 0.12, SD_HZ, uv.y) * 0.4);
  float grains = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float sc = 34.0 + 26.0 * fi;
    vec2 gp = dq * sc + vec2(t * (1.2 + 0.7 * fi), t * (0.10 + 0.05 * fi) * (1.0 + sin(t * 0.3 + fi)));
    vec2 ci = floor(gp);
    vec2 jit = vec2(sd_hash(ci + fi * 11.0), sd_hash(ci.yx + 3.0 + fi));
    float on = step(0.90 - 0.10 * swirl, sd_hash(ci + 7.0 + fi * 5.0));
    float d = length(fract(gp) - (0.2 + 0.6 * jit));
    float tw = 0.5 + 0.5 * sin(t * 4.0 + sd_hash(ci) * 30.0);
    grains += smoothstep(0.12, 0.0, d) * on * tw * (0.9 - 0.2 * fi);
  }
  grains *= smoothstep(0.08, 0.35, uv.y) * (0.5 + 0.9 * nearSun / 1.45);
  col += vec3(1.0, 0.76, 0.42) * grains * 0.50;
  // the pointer disturbs the air: a faint warm shimmer where the dust swirls
  if (hasM) {
    vec2 wd = p - mp;
    float wr = length(wd);
    float arms = pow(0.5 + 0.5 * sin(3.0 * atan(wd.y, wd.x) + 34.0 * wr - t * 2.6 + 4.0 * sd_noise(wd * 14.0)), 3.0);
    col += vec3(1.0, 0.72, 0.42) * arms * exp(-wr * wr / 0.012) * smoothstep(0.0, 0.02, wr) * 0.22;
    col += vec3(1.0, 0.7, 0.4) * swirl * 0.04;
  }

  // ---- warm look: golden hour lifts the whole scene a little, the picture shows faintly through, soft vignette
  col = mix(col, col * vec3(1.04, 0.98, 0.92), 0.7);
  col *= 0.96 + 0.08 * sd_luma(pic);
  col *= 1.0 - 0.42 * pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.3);
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
