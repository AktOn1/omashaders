#version 300 es
// target: window
// category: Glass
// desc: Frost pane: delicate frost crystals grow in feathery fronds from the window's corners and edges and leave the middle clear; the focused window is clearer, the pointer melts a small clear spot, every window grows its own crystal pattern (static)
// strength: 55
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform vec2 surface_size;
uniform float is_active;
uniform float seed;
uniform vec2 mouse;
uniform vec4 window_box;
layout(location = 0) out vec4 fragColor;

float fp_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fp_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(fp_h(i), fp_h(i + vec2(1.0, 0.0)), f.x), mix(fp_h(i + vec2(0.0, 1.0)), fp_h(i + vec2(1.0, 1.0)), f.x), f.y);
}

// frost growing inwards from one edge. u = position along the edge, v = distance from the edge (both pixels), L = edge length.
// Fern-like crystals: a herringbone of fine needles (two crossed families of slanted lines) inside a ragged front whose reach is
// longest in the corners. returns x = needle strength, y = soft frost body, both 0 in the clear middle
vec2 fp_edge(float u, float v, float L, float sd, float reachBase, float cornerBoost) {
    float cu = min(u, L - u);
    float corner = exp(-cu / (0.16 * L + 30.0));                      // 1 in the corner, fading along the edge
    float rn = fp_n(vec2(u * 0.022 + sd * 17.0, sd * 5.0)) * 0.6 + fp_n(vec2(u * 0.07 + sd * 3.0, 9.0)) * 0.4;
    float reach = reachBase * (0.55 + 0.9 * rn) + cornerBoost * corner * (0.7 + 0.6 * rn);
    float rag = fp_n(vec2(u * 0.16 + sd * 11.0, 2.0)) * 0.6 + fp_n(vec2(u * 0.4, 5.0 + sd)) * 0.4;
    float front = reach * (0.80 + 0.35 * rag);
    float ext = smoothstep(front, front * 0.2, v);
    ext *= ext;                   // 1 inside, 0 beyond the front
    // herringbone fern: needles slant away from the edge on both sides of a growing stem line
    float P = 9.0 + 4.0 * fp_h(vec2(sd, 3.0));
    float w1 = (u + v * 1.55) / P + fp_n(vec2(u * 0.05, v * 0.05 + sd * 7.0)) * 1.4;
    float w2 = (u - v * 1.55) / P + fp_n(vec2(u * 0.05 + 4.0, v * 0.05 + sd * 3.0)) * 1.4;
    float n1 = smoothstep(0.74, 0.92, abs(fract(w1) - 0.5) * 2.0);
    float n2 = smoothstep(0.74, 0.92, abs(fract(w2) - 0.5) * 2.0);
    float stem = smoothstep(0.42, 0.58, fract(u / (46.0 + 30.0 * fp_h(vec2(sd, 8.0))) + 0.25 * fp_n(vec2(u * 0.03, sd * 13.0))));
    float needles = mix(n1, n2, stem);                                // fronds lean one way left of a stem line and the other way right of it
    needles *= smoothstep(0.0, 0.25, ext) * smoothstep(front * 0.05, front * 0.5, v + front * 0.25);   // fronds taper off toward the clear middle
    needles *= 0.55 + 0.45 * fp_n(vec2(u * 0.09 + 2.0, v * 0.09 + sd * 9.0));
    return vec2(needles, ext);
}

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    float al = max(s.a, 0.0001);
    vec3 c = s.rgb / al;                                              // un-premultiply; the composer re-applies alpha
    float K = STRENGTH * 1.8182;                                      // 1.0 at the default strength
    float act = is_active;
    float sd = fract(seed);
    vec2 sz = max(surface_size, vec2(1.0));
    vec2 px = uv * sz;

    float clear = mix(1.0, 0.55, act);                                // the focused window is clearer
    float scale = clamp(min(sz.x, sz.y) / 700.0, 0.6, 1.6);          // frost reach grows a little with the window
    float rb = 9.0 * scale * clear;
    float cb = 62.0 * scale * clear;

    // four edges, each with its own seed so the sides differ
    vec2 ft = fp_edge(px.x, px.y, sz.x, sd, rb, cb);
    vec2 fb = fp_edge(px.x + 311.0, sz.y - px.y, sz.x, sd + 0.31, rb, cb);
    vec2 fl = fp_edge(px.y + 123.0, px.x, sz.y, sd + 0.57, rb, cb);
    vec2 fr = fp_edge(px.y + 719.0, sz.x - px.x, sz.y, sd + 0.83, rb, cb);
    float needles = max(max(ft.x, fb.x), max(fl.x, fr.x));
    float body = max(max(ft.y, fb.y), max(fl.y, fr.y));
    float cornerBody = 1.0 - (1.0 - ft.y) * (1.0 - fb.y) * (1.0 - fl.y) * (1.0 - fr.y);
    body = max(body, cornerBody);

    // the pointer melts a small clear spot in the frost
    vec2 mp = (mouse - window_box.xy) / max(window_box.zw, vec2(1.0)) * sz;
    float dm = length(px - mp);
    float melt = smoothstep(26.0, 88.0, dm);
    needles *= melt;
    body *= melt;

    float L = dot(c, vec3(0.2126, 0.7152, 0.0722));
    vec3 ice = vec3(0.84, 0.93, 1.0);
    // milky haze between the crystals (kept light so text under it stays legible), then the bright needles on top
    c = mix(c, ice, body * 0.045 * K * (1.0 - 0.3 * L));
    c = mix(c, ice, needles * 0.30 * K * body);
    c += vec3(0.010, 0.020, 0.032) * body * K * (1.0 - L);            // faint cool shade under the frost
    // fine rime sparkle: static grain on the crystals only
    float rime = fp_h(floor(px * 0.5) + sd * 100.0);
    c += ice * step(0.93, rime) * needles * 0.05 * K;

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
