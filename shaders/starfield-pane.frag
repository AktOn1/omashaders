#version 300 es
// target: window
// category: Ambient
// desc: Star chart sky: the dark parts of a window fill with twinkling stars (gold and ice) over a drifting indigo haze band, a shooting star crosses every few seconds, stars near the pointer wake up and join into a growing constellation, tick rulers run along the top and left edges with a marker that follows the pointer, a radar arc sweeps in the bottom-right corner, and the focused window gets the brighter sky. Only dark pixels are touched, so body text stays clear (animated)
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

// the star field hash, shared with the star-weave cursor effect and the star-chart wallpaper
float sf_h(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
bool sf_has(vec2 c) { return sf_h(c + 41.7) < 0.80; }
vec2 sf_pos(vec2 c, float C) { return (c + 0.14 + 0.72 * vec2(sf_h(c), sf_h(c + 17.3))) * C; }
vec2 sf_off(int o) { return o == 0 ? vec2(1.0, 0.0) : (o == 1 ? vec2(0.0, 1.0) : (o == 2 ? vec2(1.0, 1.0) : vec2(1.0, -1.0))); }
bool sf_link(vec2 c, int o) {
    vec2 off = sf_off(o);
    return sf_h(c * 1.7 + off * 3.1 + 9.2) < (o < 2 ? 0.58 : 0.40) && sf_has(c + off);
}
float sf_aa(float d, float w) { return clamp(w + 0.5 - d, 0.0, 1.0); }
float sf_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float sf_noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(sf_h(i), sf_h(i + vec2(1.0, 0.0)), f.x), mix(sf_h(i + vec2(0.0, 1.0)), sf_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
// how awake a star is: 1 beside the pointer, 0 at distance R
float sf_wake(vec2 s, vec2 mp, float R, float on) { return on * smoothstep(R, R * 0.25, length(s - mp)); }
// ruler ticks: distance to the nearest tick along the edge, long every fifth, longer near the marker
float sf_ticks(float along, float depth, float spacing, float marker, float sc) {
    float u = along / spacing;
    float f = abs(fract(u + 0.5) - 0.5) * spacing;
    float idx = floor(u + 0.5);
    float major = step(mod(idx, 5.0), 0.5);
    float len = (3.5 + 4.5 * major) * sc + 9.0 * sc * exp(-pow((along - marker) / (34.0 * sc), 2.0));
    return sf_aa(f, 0.30 * sc) * step(depth, len) * step(2.0, depth);
}

void main() {
    vec4 s = texture(tex, v_texcoord);
    float a = s.a;
    vec3 c = s.rgb / max(a, 0.001);
    float kk = min(STRENGTH / 0.55, 1.3);
    float act = is_active;
    vec2 size = surface_size;
    vec2 px = v_texcoord * size;
    float sc = clamp(size.y / 700.0, 0.8, 1.8);
    float sky = 0.50 + 0.50 * act;                 // how bright this window's sky is
    float lum = sf_luma(c);
    // is the surroundings light (a light document)? then dark text pixels must not be lit up
    vec2 tq7 = 7.0 / size;
    float navg = (sf_luma(texture(tex, v_texcoord + vec2(tq7.x, tq7.y)).rgb) + sf_luma(texture(tex, v_texcoord - vec2(tq7.x, tq7.y)).rgb)
                + sf_luma(texture(tex, v_texcoord + vec2(tq7.x, -tq7.y)).rgb) + sf_luma(texture(tex, v_texcoord - vec2(tq7.x, -tq7.y)).rgb) + lum) * 0.2;
    float light = smoothstep(0.50, 0.75, navg);
    float dark = (1.0 - smoothstep(0.30, 0.55, lum)) * (1.0 - light);
    float gm = max(dark, light * 0.85);             // marks that may also appear (as dark ink) on light pictures
    float t = time;

    vec3 white = vec3(0.90, 0.95, 1.00);
    vec3 ice = vec3(0.62, 0.78, 1.00);
    vec3 gold = vec3(1.00, 0.86, 0.55);
    vec3 haze = vec3(0.42, 0.48, 0.98);

    vec2 pm = mouse - window_box.xy;
    float over = smoothstep(-60.0, 0.0, pm.x) * smoothstep(size.x + 60.0, size.x, pm.x)
               * smoothstep(-60.0, 0.0, pm.y) * smoothstep(size.y + 60.0, size.y, pm.y);
    float onp = over * (0.55 + 0.45 * act);
    vec2 mp = clamp(pm, vec2(0.0), size);

    // midnight indigo wash, deeper toward the corners
    vec2 q = (px / size - 0.5) * vec2(size.x / size.y, 1.0);
    float vig = smoothstep(0.35, 1.0, length(q));
    c = mix(c, c * vec3(0.90, 0.94, 1.06) + vec3(0.0, 0.006, 0.034), dark * (0.55 + 0.35 * vig) * kk);

    // a drifting Milky Way band of haze, moving slowly across the window
    float along = dot(q, vec2(0.80, -0.60)) + t * 0.012 + seed;
    float across = dot(q, vec2(0.60, 0.80)) + 0.10 * sin(along * 2.6 + t * 0.07 + seed * 9.0);
    float band = exp(-across * across / 0.045);
    float cloud = sf_noise(vec2(along * 4.5 + t * 0.03, across * 6.0)) * 0.65 + sf_noise(vec2(along * 10.0 - t * 0.04, across * 13.0 + 3.0)) * 0.35;
    float hz = band * (0.30 + 0.70 * cloud) * dark;
    c += haze * hz * 0.12 * kk * sky;
    c += ice * hz * hz * 0.08 * kk * sky;

    // soft pointer halo in the dark
    float pd = length(px - pm);
    c += vec3(0.30, 0.42, 0.90) * exp(-pd * pd / pow(150.0 * sc, 2.0)) * 0.10 * onp * dark * kk;

    // chart graticule: small plus marks on a coarse grid, a few dotted rows between them
    float G = 110.0 * sc;
    vec2 gp = px - (floor(px / G) + 0.5) * G;
    float plus = max(sf_aa(abs(gp.x), 0.35) * step(abs(gp.y), 5.0 * sc), sf_aa(abs(gp.y), 0.35) * step(abs(gp.x), 5.0 * sc));
    float rowDot = sf_aa(abs(gp.y), 0.35) * step(0.5, fract(px.x / (7.0 * sc))) * step(abs(gp.x), 38.0 * sc) * 0.5;
    float grid = max(plus, rowDot) * (0.55 + 0.45 * sin(t * 0.6 + floor(px.x / G) * 2.1 + floor(px.y / G) * 3.7));
    float gnear = 1.0 + 1.6 * onp * exp(-pd * pd / pow(220.0 * sc, 2.0));
    c = mix(c, ice, grid * 0.22 * dark * sky * gnear * kk);

    // the stars: fixed hashed places across the window, only visible where the window is dark
    float C = 68.0 * sc;
    float Rw = 210.0 * sc;
    vec2 c0 = floor(px / C);
    float starA = 0.0; float goldA = 0.0; float lineA = 0.0; float dotA = 0.0;
    bool near = onp > 0.01 && pd < Rw + C * 1.5;
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 ca = c0 + vec2(float(i), float(j)) + seed * 0.0;
            if (!sf_has(ca)) continue;
            vec2 sa = sf_pos(ca, C);
            float ma = sf_h(ca + 5.9);
            float wa = near ? sf_wake(sa, pm, Rw, onp) : 0.0;
            vec2 d = px - sa;
            float r2 = dot(d, d);
            float tw = 0.55 + 0.45 * sin(t * (0.9 + 1.9 * ma) + ma * 60.0 + seed * 20.0);
            float rad = (1.1 + 1.3 * ma) * sc * (1.0 + 0.7 * wa);
            float core = exp(-r2 / (rad * rad));
            float halo = exp(-r2 / (rad * rad * 16.0)) * 0.30;
            float spike = (exp(-abs(d.x) / (0.7 * sc)) * exp(-abs(d.y) / (rad * 7.0))
                         + exp(-abs(d.y) / (0.7 * sc)) * exp(-abs(d.x) / (rad * 7.0))) * (ma > 0.5 ? 0.55 : 0.2);
            float st = (core + halo + spike * (0.4 + 0.9 * wa)) * tw * (0.60 + 0.9 * wa) * (0.50 + 0.50 * ma);
            if (sf_h(ca + 77.7) < 0.18) goldA += st; else starA += st;
            if (near) {
                // constellation: links to neighbours, drawn out from the star that woke first, only while both ends are lit
                for (int o = 0; o < 4; o++) {
                    if (!sf_link(ca, o)) continue;
                    vec2 sb = sf_pos(ca + sf_off(o), C);
                    float wb = sf_wake(sb, pm, Rw, onp);
                    float wmax = max(wa, wb);
                    if (wmax < 0.04) continue;
                    float wmin = min(wa, wb);
                    vec2 p0 = wa >= wb ? sa : sb;
                    vec2 p1 = wa >= wb ? sb : sa;
                    vec2 ab = p1 - p0;
                    float len2 = dot(ab, ab);
                    float u = clamp(dot(px - p0, ab) / len2, 0.0, 1.0);
                    float reach = clamp(wmin * 2.6 + wmax * 0.35, 0.0, 1.0);
                    float dl = length(px - (p0 + ab * u));
                    float pulse = 0.65 + 0.35 * sin(u * 9.0 - t * 2.4 + ma * 6.0);
                    lineA += sf_aa(dl, 0.50 * sc) * step(u, reach) * smoothstep(reach, reach - 0.12, u) * (0.30 + 0.70 * wmax) * pulse;
                }
            }
        }
    }
    // stars are additive light on dark pixels
    float sg = dark * kk * sky;
    c += white * starA * 0.95 * sg + gold * goldA * 0.95 * sg;
    c = mix(c, ice, clamp(lineA * 0.60, 0.0, 1.0) * dark * kk * (0.5 + 0.5 * act));

    // shooting star: every ~7 s, on its own phase for each window, over the dark parts only
    float P = 7.0;
    float tp = t / P + fract(seed * 13.7);
    float slotN = floor(tp);
    float lt = (tp - slotN) * P;
    if (lt < 1.5) {
        float h1 = sf_h(vec2(slotN, seed * 5.0 + 3.3)); float h2 = sf_h(vec2(slotN, seed * 5.0 + 8.8)); float h3 = sf_h(vec2(slotN, 1.7));
        vec2 start = vec2(size.x * (0.15 + 0.70 * h1), size.y * (0.05 + 0.35 * h2));
        float ang = 0.35 + 0.40 * h3;
        vec2 dir = vec2((h1 > 0.5 ? -1.0 : 1.0) * cos(ang), sin(ang));
        vec2 head = start + dir * (640.0 * sc * lt);
        vec2 dd = px - head;
        float behind = dot(dd, -dir);
        float perp = abs(dot(dd, vec2(-dir.y, dir.x)));
        float Lt = 230.0 * sc;
        float tail = sf_aa(perp, 0.5 * sc + 0.9 * sc * clamp(1.0 - behind / Lt, 0.0, 1.0)) * step(0.0, behind) * step(behind, Lt) * pow(clamp(1.0 - behind / Lt, 0.0, 1.0), 1.6);
        float hg = exp(-dot(dd, dd) / (7.0 * sc * 7.0 * sc));
        float life = smoothstep(0.0, 0.15, lt) * smoothstep(1.5, 1.1, lt);
        c += mix(ice, white, hg) * (tail * 0.85 + hg * 0.9) * life * dark * kk * (0.45 + 0.55 * act);
    }

    // degree rulers along the top and left edges; a marker rides the pointer (or drifts when it is away)
    float drift = (0.5 + 0.5 * sin(t * 0.35 + seed * 12.0));
    vec2 mk = mix(vec2(drift * size.x, (0.5 + 0.5 * sin(t * 0.27 + seed * 7.0)) * size.y), mp, onp);
    float tk = max(sf_ticks(px.x, px.y, 10.0 * sc, mk.x, sc), sf_ticks(px.y, px.x, 10.0 * sc, mk.y, sc));
    float mkx = exp(-pow((px.x - mk.x) / (1.2 * sc), 2.0)) * step(px.y, 20.0 * sc) * step(2.0, px.y);
    float mky = exp(-pow((px.y - mk.y) / (1.2 * sc), 2.0)) * step(px.x, 20.0 * sc) * step(2.0, px.x);
    float rul = max(tk * 0.55, max(mkx, mky));
    // light pictures get dark ink instead of light marks
    vec3 ink = mix(ice, vec3(0.10, 0.16, 0.42), light);
    c = mix(c, ink, rul * gm * (0.40 + 0.35 * act) * kk);

    // compass arc in the bottom-right corner: dashed rings, degree ticks and a radar needle swinging with a glow trail
    vec2 dc = px - size;
    float rc = length(dc);
    float R0 = 150.0 * sc;
    if (rc < R0 + 12.0 * sc) {
        float ac = atan(dc.x, -dc.y);
        float rot = t * 0.04;
        float arcs = 0.0;
        for (int k = 0; k < 3; k++) {
            float Rk = R0 * (0.45 + 0.275 * float(k));
            float dash = step(fract((ac + rot * (k == 1 ? -1.0 : 1.0)) * Rk / (11.0 * sc)), 0.55);
            arcs = max(arcs, sf_aa(abs(rc - Rk), 0.45 * sc) * dash * (0.95 - 0.2 * float(k)));
        }
        float tkk = ac / 6.2832 * 72.0;
        float tkd = abs(fract(tkk + 0.5) - 0.5) * 6.2832 * R0 / 72.0;
        float tlen = mod(floor(tkk + 0.5), 6.0) < 0.5 ? 12.0 : 5.0;
        arcs = max(arcs, sf_aa(tkd, 0.4 * sc) * step(R0 - tlen * sc, rc) * step(rc, R0) * 0.95);
        float ndl = -1.5708 * (0.5 + 0.5 * sin(t * 0.55 + seed * 9.0));     // needle angle, swings through the corner quarter
        float dang = ac - ndl;
        float sweep = exp(-dang * dang * 9.0) * smoothstep(R0, R0 * 0.2, rc);
        float needle = sf_aa(abs(dang) * rc, 0.5 * sc) * step(rc, R0) * 0.9;
        float fade = smoothstep(R0 + 12.0 * sc, R0 - 30.0 * sc, rc);
        c = mix(c, ink, clamp(arcs * 0.50 + sweep * 0.20 + needle * 0.60, 0.0, 1.0) * fade * gm * (0.45 + 0.4 * act) * kk);
    }

    // inactive windows sit back a little
    c = mix(c * vec3(0.96, 0.97, 1.0), c, act);

    fragColor = vec4(clamp(c, 0.0, 1.0), a);
}
