#version 300 es
// target: window
// category: Ambient
// desc: Field Terminal HUD: bold night-vision green corner brackets that periodically snap in and flash, a radar sweep that circles the window lighting range rings, edge glow and tick marks, scrolling range scales with tiny numerals along all four margins, a lock-on reticle with range rings and read-outs that follows the pointer, blinking status lights in the corner, night-vision scanlines and grain in the margins only; idle windows show just dim standby brackets. Body text stays clear (animated)
// strength: 55
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
uniform vec2 surface_size;
uniform float is_active;
uniform float seed;
uniform vec2 mouse;
uniform vec4 window_box;
layout(location = 0) out vec4 fragColor;

float hu_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float hu_aa(float d, float w) { return clamp(w + 0.5 - d, 0.0, 1.0); }
float hu_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float hu_seg(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

// a 3x5 block "numeral": random lit cells with small gaps, g in cell units
float hu_glyph(vec2 g, float id) {
    if (g.x < 0.0 || g.x >= 3.0 || g.y < 0.0 || g.y >= 5.0) return 0.0;
    vec2 cc = floor(g), f = fract(g);
    float edgeRow = (cc.y < 0.5 || cc.y > 3.5) ? 0.36 : 0.52;
    float lit = step(edgeRow, hu_h(cc + vec2(id * 1.713, id * 0.377 + 4.1)));
    return lit * step(0.1, f.x) * step(f.x, 0.9) * step(0.1, f.y) * step(f.y, 0.9);
}

// range scale along an edge: u runs along the edge, d is the distance from the edge.
// returns (tick, numeral)
vec2 hu_scale(float u, float d, float sc, float sd, float bump) {
    float stp = 7.0 * sc;
    float i = floor(u / stp + 0.5);
    float du = u - i * stp;
    float lng = step(mod(i, 5.0), 0.5);
    float tl = (3.5 + 5.5 * lng + 6.0 * bump * (0.4 + 0.6 * lng)) * sc;
    float tick = hu_aa(abs(du), 0.6 * sc) * step(d, tl) * step(2.5 * sc, d);
    tick = max(tick, hu_aa(abs(d - 2.5 * sc), 0.35 * sc) * 0.35);     // the scale's baseline
    float lab = step(mod(i, 10.0), 0.5);
    float cell = 1.2 * sc;
    vec2 g = vec2(du / cell + 1.5, (d - 13.0 * sc) / cell);
    float num = hu_glyph(g, i + sd) * lab;
    return vec2(tick, num);
}

// add colour to dark ground, ink dark olive into light ground
vec3 hu_ink(vec3 c, vec3 lit, float dark) {
    float m = max(lit.r, max(lit.g, lit.b));
    vec3 hue = lit / max(m, 1e-4);
    vec3 sub = mix(c, hue * 0.30, clamp(m * 0.85, 0.0, 1.0));
    return mix(sub, c + lit, dark);
}

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    float a = s.a;
    vec3 c = s.rgb / max(a, 0.001);
    float k = clamp(STRENGTH / 0.55, 0.0, 1.6);
    float act = is_active;
    vec2 size = surface_size;
    vec2 px = uv * size;
    float sc = clamp(size.y / 640.0, 0.8, 1.7);
    float lum = hu_luma(c);

    // what the ground is like here, so text can be spared: a ring of taps gives the local background
    vec2 o = 13.0 * sc / size;
    float bgL = 0.25 * (hu_luma(texture(tex, clamp(uv + vec2(o.x, 0.0), 0.0, 1.0)).rgb)
                      + hu_luma(texture(tex, clamp(uv - vec2(o.x, 0.0), 0.0, 1.0)).rgb)
                      + hu_luma(texture(tex, clamp(uv + vec2(0.0, o.y), 0.0, 1.0)).rgb)
                      + hu_luma(texture(tex, clamp(uv - vec2(0.0, o.y), 0.0, 1.0)).rgb));
    float bgd = 1.0 - smoothstep(0.30, 0.62, bgL);               // 1 on a dark ground
    float textness = smoothstep(0.10, 0.34, abs(lum - bgL));
    float prot = 1.0 - textness;

    vec3 green = vec3(0.36, 1.0, 0.30);
    vec3 amber = vec3(1.0, 0.68, 0.18);
    vec3 tan = vec3(0.78, 0.70, 0.46);

    vec2 q = min(px, size - px);                                  // folded corner: all four corners match
    float dE = min(q.x, q.y);
    vec2 center = 0.5 * size;

    // pointer in window pixels
    vec2 pm = mouse - window_box.xy;
    float over = smoothstep(-8.0, 6.0, pm.x) * smoothstep(size.x + 8.0, size.x - 6.0, pm.x)
               * smoothstep(-8.0, 6.0, pm.y) * smoothstep(size.y + 8.0, size.y - 6.0, pm.y);

    vec3 big = vec3(0.0);        // soft light, fully shielded from text
    vec3 crisp = vec3(0.0);      // thin graphics, mostly shielded from text

    // ---- radar sweep around the window ----
    float per = 6.5 + 3.0 * fract(seed * 5.7);
    float sa = time * (6.2831853 / per) + seed * 6.2831853;
    vec2 cn = px / size - 0.5;
    float ang = atan(cn.y, cn.x);
    float dd = mod(sa - ang, 6.2831853);                         // 0 right behind the sweep line, grows behind it
    float trail = 0.75 * exp(-dd * 1.9) + 0.9 * exp(-dd * 26.0);
    float edgeBand = pow(1.0 - smoothstep(0.0, 100.0 * sc, dE), 1.5);
    float rr = length(px - center);
    float ringStep = 95.0 * sc;
    float rings = hu_aa(abs(mod(rr + 0.5 * ringStep, ringStep) - 0.5 * ringStep), 0.45 * sc);
    big += green * trail * ((0.050 * (0.3 + 0.7 * bgd)) + 0.30 * edgeBand + 0.35 * edgeBand * exp(-dd * 40.0)) * act * k;
    crisp += green * rings * trail * 0.55 * act * k;
    float spokeLine = exp(-dd * 70.0) * (1.0 - exp(-rr / (30.0 * sc)));
    crisp += green * spokeLine * 0.18 * act * k;                  // the sweep arm itself, across the window

    // ---- range scales along the margins ----
    float sg = mix(0.20, 1.0, act);
    float cx = 46.0 * sc;                                         // keep clear of the corner brackets
    float sd0 = floor(seed * 90.0);
    float spd = 15.0 * sc;
    if (dE < 21.0 * sc) {
        // top and bottom
        float dirH = px.y < center.y ? 1.0 : -1.0;
        float uH = px.x + dirH * time * spd + seed * 301.0;
        float bumpH = exp(-pow((px.x - pm.x) / (55.0 * sc), 2.0)) * over;
        float mH = smoothstep(cx, cx + 18.0 * sc, q.x) * step(q.y, 21.0 * sc);
        vec2 scH = hu_scale(uH, q.y, sc, sd0, bumpH);
        // vertical
        float dirV = px.x < center.x ? 1.0 : -1.0;
        float uV = px.y + dirV * time * spd * 0.8 + seed * 173.0;
        float bumpV = exp(-pow((px.y - pm.y) / (55.0 * sc), 2.0)) * over;
        float mV = smoothstep(cx, cx + 18.0 * sc, q.y) * step(q.x, 21.0 * sc);
        vec2 scV = hu_scale(uV, q.x, sc, sd0 + 7.0, bumpV);
        float tk = max(scH.x * mH, scV.x * mV);
        float nm = max(scH.y * mH, scV.y * mV);
        float swept = 0.35 + 1.2 * trail * act;
        float bump = max(bumpH * mH, bumpV * mV);
        vec3 tcol = mix(green, amber, clamp(bump * 1.2, 0.0, 1.0));
        crisp += tcol * (tk * 0.95 * swept + nm * 0.80 * (0.6 + 0.8 * trail * act)) * sg * k * (1.0 + 0.5 * bump);
    }

    // ---- corner brackets: lock on every few seconds, flash, hold ----
    float lp = mod(time + seed * 17.0, 8.0);
    float lt = clamp(lp / 0.5, 0.0, 1.0);
    float le = 1.0 - (1.0 - lt) * (1.0 - lt) * (1.0 - lt);
    float flash = step(0.5, lp) * exp(-(lp - 0.5) * 4.5);
    float ins = (6.0 + (1.0 - act) * 11.0 + act * (1.0 - le) * 20.0) * sc;
    float blen = mix(20.0, 34.0, act) * sc;
    float bd = min(hu_seg(q, vec2(ins), vec2(ins + blen, ins)), hu_seg(q, vec2(ins), vec2(ins, ins + blen)));
    float bw = mix(0.8, 1.3, act) * sc;
    float br = hu_aa(bd, bw);
    float halo = exp(-bd / (5.0 * sc)) * (0.20 + 0.7 * flash) * act;
    // inner notch ticks at the middle of each leg, and an amber tip at the end of each
    float notch = max(hu_aa(abs(q.x - (ins + 0.55 * blen)), 0.5 * sc) * step(ins, q.y) * step(q.y, ins + 5.0 * sc),
                      hu_aa(abs(q.y - (ins + 0.55 * blen)), 0.5 * sc) * step(ins, q.x) * step(q.x, ins + 5.0 * sc));
    float tip = hu_aa(length(q - vec2(ins + blen, ins)), 1.7 * sc) + hu_aa(length(q - vec2(ins, ins + blen)), 1.7 * sc);
    vec3 bcol = mix(tan, green, act);
    crisp += bcol * (br * mix(0.50, 1.15, act) + notch * 0.5 * act) * k * (1.0 + 0.8 * flash);
    crisp += amber * clamp(tip, 0.0, 1.0) * (0.35 + 0.65 * act) * k * (1.0 + flash);
    big += green * halo * 0.55 * k;

    // ---- blinking status lights in the bottom right ----
    vec2 bq = size - px;
    vec2 bp = vec2(ins + 9.0 * sc, ins + 9.0 * sc);
    float bl0 = 0.55 + 0.45 * step(0.0, sin(time * 3.0 + seed * 9.0));
    float bl1 = step(fract(time / 1.3 + seed * 3.0), 0.28);
    float bl2 = step(0.55, hu_h(vec2(floor(time * 4.0), seed * 40.0)));
    float lampA = hu_aa(length(bq - bp), 2.1 * sc);
    float lampB = hu_aa(length(bq - bp - vec2(8.0 * sc, 0.0)), 2.1 * sc);
    float lampC = hu_aa(length(bq - bp - vec2(16.0 * sc, 0.0)), 2.1 * sc);
    float hl = exp(-length(bq - bp - vec2(8.0 * sc, 0.0)) / (14.0 * sc));
    crisp += green * lampA * (0.12 + 0.95 * bl0) * act * k;
    crisp += amber * lampB * (0.10 + 1.0 * bl1) * k * mix(0.55, 1.0, act);
    crisp += green * lampC * (0.10 + 1.0 * bl2) * act * k;
    big += (green * (0.3 * bl0 + 0.3 * bl2) + amber * 0.5 * bl1) * hl * 0.12 * act * k;

    // ---- lock-on reticle that follows the pointer ----
    float rt = over * mix(0.30, 1.0, act);
    vec2 rel = px - pm;
    float r = length(rel);
    float R = 30.0 * sc;
    if (rt > 0.01 && r < 6.0 * R) {
        float aR = atan(rel.y, rel.x);
        float ring = hu_aa(abs(r - R), 0.6 * sc) * step(fract((aR + time * 0.8) / 1.5707963), 0.62);
        float rng = hu_aa(abs(r - 1.55 * R), 0.4 * sc) * step(fract((aR - time * 0.35) / 0.2617994), 0.5) * 0.7;
        float ph = fract(time / 2.4 + seed * 2.0);
        float pulse = hu_aa(abs(r - (0.45 + 2.0 * ph) * R), 0.5 * sc) * pow(1.0 - ph, 1.6) * 0.7;
        vec2 ar = abs(rel);
        float ax = hu_aa(ar.x, 0.5 * sc), ay = hu_aa(ar.y, 0.5 * sc);
        float inner = max(ax * step(5.0 * sc, ar.y) * step(ar.y, 13.0 * sc), ay * step(5.0 * sc, ar.x) * step(ar.x, 13.0 * sc));
        float outer = max(ax * step(R + 3.0 * sc, ar.y) * step(ar.y, R + 11.0 * sc), ay * step(R + 3.0 * sc, ar.x) * step(ar.x, R + 11.0 * sc));
        float B = (1.85 + 0.08 * sin(time * 3.5)) * R;
        float lenB = 10.0 * sc;
        float boxB = max(hu_aa(abs(ar.x - B), 0.6 * sc) * step(B - lenB, ar.y) * step(ar.y, B),
                         hu_aa(abs(ar.y - B), 0.6 * sc) * step(B - lenB, ar.x) * step(ar.x, B));
        float dot0 = hu_aa(r, 1.2 * sc);
        // read-outs to the right: bearing and range, three block numerals each
        float cell = 1.25 * sc;
        vec2 gp = vec2((rel.x - (R + 15.0 * sc)) / cell, (rel.y + 7.0 * sc) / cell);
        float gi = floor(gp.x / 4.4);
        float nums = 0.0;
        if (gi >= 0.0 && gi < 3.0) {
            vec2 l1 = vec2(gp.x - gi * 4.4, gp.y);
            vec2 l2 = vec2(gp.x - gi * 4.4, gp.y - 7.0);
            nums = max(hu_glyph(l1, floor(pm.x / 5.0) + gi * 13.0), hu_glyph(l2, floor(pm.y / 5.0) + gi * 7.0 + 50.0));
        }
        float lines = max(ring, max(boxB, max(inner, outer))) + rng + pulse;
        crisp += green * clamp(lines, 0.0, 1.0) * 0.95 * rt * k;
        crisp += amber * (dot0 + nums * 0.85) * rt * k;
        big += green * exp(-r * r / (2.0 * 40.0 * 40.0 * sc * sc)) * 0.12 * rt * k;
    }

    // ---- night-vision margins: scanlines, grain, a slow rolling bar, tint (margins only) ----
    float marg = 1.0 - smoothstep(10.0 * sc, 60.0 * sc, dE);
    float nvk = mix(0.30, 1.0, act);
    float gr = hu_h(floor(px) + floor(time * 18.0) * vec2(1.7, 9.2) + seed * 50.0);
    big += green * max(gr - 0.55, 0.0) * 0.16 * marg * nvk * k;
    float yb = mod(time * 48.0 * sc + seed * 500.0, size.y + 200.0 * sc) - 100.0 * sc;
    big += green * exp(-pow((px.y - yb) / (28.0 * sc), 2.0)) * 0.07 * marg * nvk * k;

    // apply: shielded light and graphics over the pixel
    big *= prot;
    crisp *= 1.0 - 0.5 * textness;
    float row = 0.5 + 0.5 * sin(px.y * 3.14159265 / (1.5 * sc));
    c *= 1.0 - 0.10 * k * marg * row * nvk * prot;
    c = mix(c, c * vec3(0.74, 1.0, 0.66) + vec3(0.0, 0.010, 0.0), clamp(marg * marg * 0.45 * k * nvk * prot, 0.0, 1.0));
    c = hu_ink(c, big + crisp, bgd);

    // idle windows sit back a little
    c = mix(c * vec3(0.96, 0.98, 0.94), c, act);

    fragColor = vec4(clamp(c, 0.0, 1.0), a);
}
