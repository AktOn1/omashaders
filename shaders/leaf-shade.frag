#version 300 es
// target: window
// category: Living
// desc: Dappled grove: soft leaf shadows and warm sun patches drift across the window as a breeze moves the canopy; the focused window stands in full sun, the others in cool green shade, the pointer stirs the leaves nearby (animated)
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
uniform vec2 resolution;
layout(location = 0) out vec4 fragColor;

float ls_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 ls_h2(vec2 p) { return vec2(ls_h(p), ls_h(p + 19.19)); }
float ls_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(ls_h(i), ls_h(i + vec2(1.0, 0.0)), f.x), mix(ls_h(i + vec2(0.0, 1.0)), ls_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec2 ls_rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }

// shadow of the leaves at one scale: pointed, lens-shaped leaves in jittered cells, each tilted its own way and fluttering a little.
// returns 0..1 coverage (1 = in the shadow of a leaf); `blur` is the edge softness, far branches cast blurrier shadows
float ls_leaves(vec2 p, float scale, float density, float blur, float sd, float ang) {
    vec2 q = p / scale;
    q += (vec2(ls_n(q * 0.9 + sd * 20.0), ls_n(q * 0.9 + 7.7 + sd * 20.0)) - 0.5) * 0.35;   // slow warp: no two leaves align
    vec2 id = floor(q), f = fract(q);
    float cover = 0.0;
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 o = vec2(float(i), float(j));
            vec2 cid = id + o + sd * 53.0;
            vec3 h = vec3(ls_h(cid), ls_h(cid + 4.1), ls_h(cid + 8.3));
            if (h.x > density) continue;
            vec2 d = o + ls_h2(cid + 1.7) - f;
            float a = ang + h.y * 6.28 + 0.22 * sin(time * (0.5 + h.z) + h.x * 40.0);       // flutter
            d = ls_rot(d, a);
            float L = 0.50 + 0.28 * h.z;                              // half length in cells
            float W = L * (0.34 + 0.14 * h.y);                        // half width
            float t = clamp(d.x / L, -1.0, 1.0);
            float v = (W * (1.0 - t * t) - abs(d.y)) / W;             // lens shape: > 0 inside, pointed tips
            cover = max(cover, smoothstep(0.0, blur, v) * (0.8 + 0.2 * h.x / max(density, 0.01)));
        }
    }
    return cover;
}

// bright "sun coins": little round pinhole images of the sun scattered on a drifting grid
float ls_coins(vec2 p, float sd) {
    vec2 g = p / 58.0;
    g += vec2(time * 0.10, time * 0.045);
    vec2 id = floor(g), f = fract(g);
    float hh = ls_h(id + sd * 31.0);
    if (hh > 0.45) return 0.0;
    vec2 c = ls_h2(id + 3.3 + sd * 17.0) * 0.5 + 0.25;
    c += 0.05 * vec2(sin(time * 0.7 + hh * 40.0), cos(time * 0.6 + hh * 29.0));
    float r = 0.06 + 0.07 * ls_h(id + 8.8);
    float d = length(c - f);
    float tw = 0.75 + 0.25 * sin(time * (0.5 + hh * 2.0) + hh * 60.0);
    return smoothstep(r, r * 0.35, d) * tw * (0.6 + 0.4 * ls_h(id + 5.5));
}

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    float al = max(s.a, 0.0001);
    vec3 c = s.rgb / al;                                              // un-premultiply; the composer re-applies alpha
    float S = STRENGTH;
    float act = is_active;
    float sd = fract(seed);

    // pattern lives in physical pixels, and slides gently with the window's place on the monitor (distant canopy)
    vec2 px = uv * surface_size;
    vec2 p = px + (window_box.xy / resolution) * vec2(380.0, 300.0) + sd * vec2(900.0, 700.0);

    // breeze: the whole canopy sways slowly, with a gust that comes and goes
    float gust = 0.55 + 0.45 * sin(time * 0.23 + sd * 6.28);
    p += vec2(sin(time * 0.31 + p.y * 0.0042 + sd * 5.0), cos(time * 0.26 + p.x * 0.0036)) * (11.0 + 9.0 * gust);
    p += vec2(time * 5.0, time * 1.5);

    // the pointer is a puff of wind: leaves around it lean away
    vec2 mp = (mouse - window_box.xy) / max(window_box.zw, vec2(1.0)) * surface_size;
    vec2 dm = px - mp;
    float dl = length(dm);
    float wind = exp(-dl * dl / (2.0 * 150.0 * 150.0));
    p -= dm / max(dl, 1.0) * 26.0 * wind * (0.8 + 0.2 * sin(time * 1.3));

    // sunlight through the canopy: patches of sun lie on the shaded pane, and the leaves cut dark silhouettes out of them.
    // The focused window sits in full sun (large patches, sparse leaves), the others mostly in shade.
    float K = S * 1.6667;                                             // 1.0 at the default strength
    float dens = mix(0.58, 0.46, act);
    vec2 w = p + vec2(time * 3.0, 0.0);
    float cl = ls_n(ls_rot(w, 0.3) / 165.0 + sd * 9.0) * 0.50 + ls_n(ls_rot(w, 1.1) / 78.0 + 4.0 + sd * 5.0) * 0.32 + ls_n(ls_rot(w, 2.2) / 37.0 + 8.0 + sd * 3.0) * 0.18;
    float thr = mix(0.57, 0.39, act) + 0.015 * sin(time * 0.35 + sd * 7.0);
    float dapple = smoothstep(thr, thr + 0.13, cl);                   // where the canopy is open overhead
    float far = ls_leaves(p, 210.0, dens + 0.10, 1.3, sd, 0.5);       // far branches: big and blurry
    float mid = ls_leaves(p * vec2(1.0, 0.92) + 40.0, 92.0, dens, 0.55, sd + 0.31, 2.0);   // near leaves: smaller and crisper
    float fine = ls_leaves(p + 123.0, 47.0, dens * 0.6, 0.45, sd + 0.67, 4.1);
    float cover = 1.0 - (1.0 - 0.7 * far) * (1.0 - mid) * (1.0 - 0.8 * fine);
    float sun = dapple * (1.0 - cover);
    float shade = 1.0 - sun;
    float core = smoothstep(0.55, 1.0, sun);
    float deep = smoothstep(0.35, 1.0, cover) * (1.0 - dapple);        // under dense leaves, outside the sun

    vec3 warm = vec3(0.94, 0.90, 0.40);
    float coins = ls_coins(p + 11.0, sd) * smoothstep(0.55, 0.95, sun);

    // shadows: darken a little (never more than ~22%) and cool toward mossy green
    float dark = (mix(0.115, 0.075, act) + 0.04 * deep) * shade * K;
    c = mix(c, c * vec3(0.84, 0.96, 0.85), shade * 0.8 * min(K, 1.4));
    c *= 1.0 - dark;
    c += vec3(0.004, 0.026, 0.010) * shade * K;                       // green bounce light in the shade

    // light: warm gold, gentle and additive so text keeps its contrast; it also pulls dark/blue themes toward gold
    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float shimmer = 1.0 - 0.20 * (1.0 - act) * (0.5 + 0.5 * sin(time * 0.8 + p.x * 0.01 + sd * 5.0));
    float lift = (mix(0.06, 0.092, act) * sun + mix(0.035, 0.095, act) * core) * K * shimmer;
    c = mix(c, c * vec3(1.06, 1.04, 0.82), sun * 0.55 * min(K, 1.4) * (0.4 + 0.6 * act));
    c += warm * lift * (0.7 + 0.6 * (1.0 - lum));
    c += vec3(1.0, 0.90, 0.58) * coins * mix(0.07, 0.17, act) * K;

    // a sunlit top edge on the focused window, like light spilling over the frame
    float edge = min(min(px.x, surface_size.x - px.x), min(px.y, surface_size.y - px.y));
    float rim = smoothstep(2.5, 0.0, edge) * (0.25 + 0.75 * sun);
    c += warm * rim * mix(0.025, 0.09, act) * K;

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
