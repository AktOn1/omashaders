#version 300 es
// target: window
// category: Light
// desc: Soak sheet: each window is a sheet of washi paper with a wet tide creeping up from the bottom edge, its ragged fibre line slowly rising and falling and bulging towards the pointer, darker bluish wet paper below it with a mild refraction at the margins, feathery indigo ink blooms spreading from the corners and receding again, and a damp spot with concentric ripples under the pointer; the focused sheet is wetter and deeper, and body text stays clear (animated)
// strength: 60
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

float ss_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float ss_h(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
float ss_noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(ss_h(i), ss_h(i + vec2(1.0, 0.0)), f.x), mix(ss_h(i + vec2(0.0, 1.0)), ss_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float ss_fbm(vec2 p) {
    float a = 0.5; float s = 0.0;
    for (int k = 0; k < 3; k++) { s += a * ss_noise(p); p = p * 2.03 + vec2(7.1, 3.7); a *= 0.5; }
    return s / 0.875;
}
float ss_fibre(vec2 p, float ang, float len, float sd) {
    float ca = cos(ang); float sa = sin(ang);
    vec2 r = vec2(ca * p.x + sa * p.y, -sa * p.x + ca * p.y);
    float n = ss_noise(vec2(r.x / len + sd, r.y / 1.6 + sd * 3.1));
    return smoothstep(0.66, 0.92, n);
}

// ink bloom seen from one corner (u: distance from that corner in 1080-like px, R: reach); returns density in x, vein lines in y
vec2 ss_bloom(vec2 u, float R, float sd, float t) {
    float rr = length(u);
    if (rr > R * 1.5) return vec2(0.0);
    vec2 w = u + 16.0 * (vec2(ss_noise(u / 38.0 + sd + t * 0.045), ss_noise(u / 38.0 + 9.1 + sd - t * 0.04)) - 0.5);
    float r = length(w);
    float ang = atan(w.y, w.x);
    float fing = ss_noise(vec2(ang * 6.5 + sd, r / 26.0 - t * 0.06));            // radial feathers: long and short fingers
    float fing2 = ss_noise(vec2(ang * 17.0 + sd * 2.0, r / 11.0 + t * 0.05));
    float edge = R * (0.55 + 0.55 * fing + 0.18 * fing2);
    float v = (edge - r) / R;                                                       // > 0 inside
    float grain = 0.65 + 0.35 * ss_noise(w / 5.0 + sd);
    float dens = smoothstep(-0.02, 0.55, v) * grain;
    float vein = pow(1.0 - abs(2.0 * ss_noise(w / 13.0 + sd * 3.0) - 1.0), 5.0) * smoothstep(-0.05, 0.25, v);
    return vec2(dens, vein);
}

void main() {
    vec2 uv = v_texcoord;
    vec4 s0 = texture(tex, uv);
    float a = s0.a;
    float k = min(STRENGTH / 0.55, 1.3);
    float act = is_active;
    vec2 size = surface_size;
    vec2 px = uv * size;
    float sc = clamp(size.y / 560.0, 0.8, 2.0);
    vec2 q = px / sc;
    float sd = seed * 37.0;
    float T = time;

    // pointer in window pixels, and how present it is (over or near the window)
    vec2 mp = (mouse - window_box.xy) / max(window_box.zw, vec2(1.0)) * size;
    vec2 outv = max(max(-mp, mp - size), vec2(0.0));
    float pres = 1.0 - smoothstep(0.0, 160.0 * sc, length(outv));

    // distances: the margin (sides and bottom) carries the strong effects, the middle only faint ones
    float dEdge = min(min(px.x, size.x - px.x), size.y - px.y);
    float marg = 1.0 - smoothstep(14.0 * sc, 95.0 * sc, dEdge);
    float inner = mix(0.55, 1.0, marg);

    // ---- the tide: height wanders slowly up and down, ragged line drifts, bulges towards the pointer ----
    float hb = size.y - px.y;                                                       // pixels above the bottom edge
    float hFrac = 0.165 + 0.05 * ss_h(vec2(sd, 4.4)) + 0.04 * act;
    float breathe = 0.035 * sin(T * 0.21 + sd) + 0.020 * sin(T * 0.53 + sd * 2.3);   // rises and falls
    float rag = ss_fbm(vec2(px.x / (50.0 * sc) + sd + T * 0.035, 2.0 + sd + T * 0.05)) - 0.5;
    float lap = sin(px.x / (38.0 * sc) - T * 0.7 + sd) * 2.2 * sc + sin(px.x / (13.0 * sc) + T * 1.1) * 0.8 * sc;
    float fing = ss_noise(vec2(px.x / (7.0 * sc) + sd, hb / (50.0 * sc) - T * 0.08)) - 0.5;
    float dxm = (px.x - mp.x) / (95.0 * sc);
    float bulge = 34.0 * sc * exp(-dxm * dxm) * pres;                               // capillary pull towards the pointer
    float tide = size.y * (hFrac + breathe) + rag * size.y * 0.12 + fing * 9.0 * sc + lap + bulge;
    float dist = tide - hb;                                                         // > 0 inside the wet part
    float wet = smoothstep(-1.5 * sc, 3.5 * sc, dist);
    float depth = 0.60 + 0.40 * smoothstep(tide, 0.0, hb);
    float rim = exp(-pow((dist - 1.5 * sc) / (3.4 * sc), 2.0)) * (0.7 + 0.5 * (fing + 0.5));
    float halo = exp(-pow((dist + 11.0 * sc) / (9.0 * sc), 2.0)) * 0.35;

    // ---- refraction: wet paper at the margins bends what lies behind it a little; the middle stays still ----
    float rb = exp(-pow(dist / (22.0 * sc), 2.0)) * 0.6 + 0.5 * wet;
    float rmar = (1.0 - smoothstep(10.0 * sc, 70.0 * sc, min(px.x, size.x - px.x))) + (1.0 - smoothstep(6.0 * sc, 50.0 * sc, size.y - px.y)) * wet;
    float rw = clamp(rb * rmar, 0.0, 1.0) * min(k, 1.0);
    vec2 dm = px - mp;
    float dl = length(dm) / sc;
    float rip = sin(dl * 0.30 - T * 3.2) * exp(-dl / 70.0) * pres;               // ripples round the pointer
    vec2 disp = vec2(ss_noise(q / 17.0 + vec2(T * 0.6, sd)) - 0.5, ss_noise(q / 17.0 + vec2(sd, T * 0.5) + 7.0) - 0.5) * 5.0 * sc * rw;
    disp += dm / max(length(dm), 1.0) * rip * 2.2 * sc * (1.0 - smoothstep(30.0 * sc, 80.0 * sc, dEdge)) * min(k, 1.0);
    vec4 s1 = texture(tex, uv + disp / size);
    vec3 c = mix(s0.rgb / max(a, 0.001), s1.rgb / max(s1.a, 0.001), step(0.01, s1.a));

    float lum = ss_luma(c);
    float dark = 1.0 - smoothstep(0.12, 0.60, lum);
    vec3 indigo = vec3(0.060, 0.110, 0.300);

    // ---- paper fibres, drifting a hair when wet, strongest in the margin ----
    float fib = ss_fibre(q, 0.30, 70.0, 1.0 + sd) + 0.8 * ss_fibre(q, 1.90, 90.0, 5.0 + sd);
    float fibAmt = 0.050 * k * (0.20 + 0.80 * marg) * (1.0 + 0.5 * wet) * mix(1.0, 0.45, dark);
    c += (fib - 0.30) * fibAmt * mix(vec3(0.9, 0.95, 1.0), vec3(-0.9, -0.85, -0.7), smoothstep(0.25, 0.7, lum));

    // ---- wet paper below the tide line: darker and bluish (light paper), indigo lifted into the shadows (dark windows) ----
    float w = wet * depth * inner * k * mix(0.8, 1.0, act);
    vec3 cool = vec3(0.70, 0.80, 0.97);
    c = mix(c, c * cool, clamp(w * 0.92 * (1.0 - dark), 0.0, 1.0));
    c = mix(c, c * vec3(0.72, 0.82, 1.00) + indigo * 0.75, clamp(w * 0.85 * dark, 0.0, 1.0));
    // water caustics sliding slowly through the wet part, only on the paper background
    float ca = ss_noise(vec2(q.x / 34.0 + T * 0.12, q.y / 21.0 - T * 0.09) + sd) * ss_noise(vec2(q.x / 23.0 - T * 0.10, q.y / 30.0 + T * 0.13) + 3.0 + sd);
    c += vec3(0.55, 0.72, 1.0) * (ca - 0.22) * 0.10 * w * (0.4 + 0.6 * dark) * (1.0 - smoothstep(0.55, 0.95, lum));
    c = mix(c, c * vec3(0.58, 0.66, 0.90), clamp(rim * inner * 0.55 * k * (0.60 + 0.40 * marg), 0.0, 0.85));
    c = mix(c, c * vec3(0.90, 0.93, 0.99), halo * inner * 0.5 * k);
    // a thin wet sheen riding the tide line
    float sheen = exp(-pow((dist - 5.5 * sc) / (1.8 * sc), 2.0)) * smoothstep(0.35, 0.8, ss_noise(vec2(px.x / (26.0 * sc) - T * 0.35, sd + 2.0)));
    c += vec3(0.85, 0.93, 1.0) * sheen * 0.16 * k * inner * mix(0.5, 1.0, act) * (1.0 - 0.6 * smoothstep(0.7, 1.0, lum));

    // ---- ink blooms: feathery indigo stains spreading from the four corners, each on its own slow swell and ebb ----
    vec2 qc = min(px, size - px) / sc;
    float cid = step(size.x * 0.5, px.x) + 2.0 * step(size.y * 0.5, px.y);
    float ph = ss_h(vec2(cid + 1.0, sd)) * 6.2832;
    float grow = 0.50 + 0.50 * sin(T * 0.13 + ph);
    float R = clamp(0.36 * min(size.x, size.y) / sc, 70.0, 210.0) * (0.45 + 0.75 * grow) * (0.85 + 0.30 * act);
    vec2 bl = ss_bloom(qc, R, sd + cid * 3.3, T);
    float bamt = bl.x * k * inner * mix(0.65, 1.0, act);
    vec3 inkc = vec3(0.50, 0.58, 0.85);
    c = mix(c, c * inkc, clamp(bamt * 0.80 * (1.0 - 0.7 * dark), 0.0, 0.85));
    c = mix(c, c * vec3(0.42, 0.50, 0.80) + indigo * 0.3, clamp(bl.y * bl.x * 0.65 * k * inner, 0.0, 0.7));
    c += indigo * 1.1 * bamt * dark * 0.7;

    // ---- the pointer: a damp spot that breathes in and out, with a darker ragged rim, and rings spreading from it ----
    float cyc = 0.5 + 0.5 * sin(T * 0.45 + sd);                                      // spreads, then dries a little
    float rd = (62.0 + 38.0 * cyc) * (0.85 + 0.3 * act) + (ss_noise(dm / max(dl * sc, 1.0) * 2.2 + vec2(sd, T * 0.15)) - 0.5) * 22.0;
    float spot = smoothstep(rd, rd - 28.0, dl) * pres;
    float srim = exp(-pow((dl - rd + 4.0) / 5.0, 2.0)) * pres;
    vec3 dampc = vec3(0.80, 0.87, 0.99);
    c = mix(c, c * dampc, clamp(spot * 0.75 * k * (1.0 - 0.6 * dark), 0.0, 0.8));
    c += indigo * 0.8 * spot * dark * k * 0.55;
    c = mix(c, c * vec3(0.66, 0.74, 0.94), clamp(srim * 0.5 * k, 0.0, 0.6));
    float rings = rip * 0.5 + 0.5;
    c *= 1.0 + (rings - 0.5) * 0.10 * k * pres * (1.0 - smoothstep(0.55, 0.95, lum) * 0.5);
    c += vec3(0.80, 0.90, 1.0) * max(rip - 0.55, 0.0) * 0.10 * k * pres * (1.0 - smoothstep(0.5, 0.95, lum));

    // inactive windows sit back a little: drier, greyer
    c = mix(c * vec3(0.95, 0.96, 1.0), c, act);
    float g = ss_luma(c);
    c = mix(vec3(g), c, mix(0.88, 1.0, act));

    fragColor = vec4(clamp(c, 0.0, 1.0), a);
}
