#version 300 es
// target: window
// category: Glass
// desc: Morning dew: fine droplets of condensation creep in from the window edges, each a tiny lens with a bright glint; the focused window is mostly clear and the pointer wipes the glass clean around it (static)
// strength: 50
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform vec2 surface_size;
uniform float is_active;
uniform float seed;
uniform vec2 mouse;
uniform vec4 window_box;
uniform vec2 resolution;
layout(location = 0) out vec4 fragColor;

float md_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float md_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(md_h(i), md_h(i + vec2(1.0, 0.0)), f.x), mix(md_h(i + vec2(0.0, 1.0)), md_h(i + vec2(1.0, 1.0)), f.x), f.y);
}

// one layer of droplets on a jittered grid. Each drop is a tiny lens: it shows the picture upside down and slightly magnified,
// has a bright glint at the upper left and a soft dark rim at the lower right. `mask` (0..1) is the chance a cell has a drop.
vec3 md_drops(vec3 c, vec2 p, vec2 uv, vec2 size, float cell, float rlo, float rhi, float sd, float mask, float K) {
    vec2 g = p / cell;
    vec2 id = floor(g);
    vec2 f = fract(g);
    float h = md_h(id + sd);
    if (h > mask) return c;
    vec2 ctr = 0.28 + 0.44 * vec2(md_h(id + sd + 3.1), md_h(id + sd + 7.7));
    float r = mix(rlo, rhi, md_h(id + sd + 1.3) * md_h(id + sd + 9.1) * 1.6) / cell;
    vec2 d = f - ctr;
    float dist = length(d);
    float aa = 0.9 / cell;
    float cov = smoothstep(r, r - aa, dist);
    if (cov <= 0.0) return c;
    vec2 n = d / r;
    vec3 lens = texture(tex, uv - d * cell * 2.6 / size).rgb;          // inverted, magnified view through the drop
    float rim = smoothstep(0.55, 1.0, length(n)) * (0.45 + 0.55 * clamp(dot(n, vec2(0.7, 0.7)), -1.0, 1.0));
    lens *= 1.0 - 0.30 * rim;
    float glint = smoothstep(0.55, 0.0, length(n - vec2(-0.38, -0.38)));
    lens += vec3(0.80, 0.92, 1.0) * glint * 0.34;                       // tiny cool-white sparkle
    lens = mix(lens, lens * vec3(0.96, 1.0, 1.03) + vec3(0.012, 0.018, 0.022), 0.6);   // water is faintly cool and bright
    return mix(c, lens, cov * min(K, 1.3) * 0.92);
}

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    float al = max(s.a, 0.0001);
    vec3 c = s.rgb / al;                                                // un-premultiply; the composer re-applies alpha
    float S = STRENGTH;
    float K = S * 2.0;                                                  // 1.0 at the default strength
    float act = is_active;
    float sd = fract(seed) * 97.0;

    vec2 size = max(surface_size, vec2(1.0));
    vec2 px = uv * size;
    float u = sqrt(size.x * size.y);

    // condensation creeps in from the edges, ragged and patchy, and the focused window is clearer
    float edge = min(min(px.x, size.x - px.x), min(px.y, size.y - px.y));
    float patch_ = md_n(px / (0.12 * u + 40.0) + sd) * 0.65 + md_n(px / (0.045 * u + 18.0) + sd * 1.7 + 4.0) * 0.35;   // 0..1, seed-dependent
    float reach = (0.07 + 0.20 * patch_) * u * mix(1.0, 0.55, act);
    float creep = 1.0 - smoothstep(0.0, max(reach, 24.0), edge);
    float interior = mix(0.10, 0.02, act) * smoothstep(0.35, 0.75, patch_);   // a few stray drops far from the edges
    float dens = clamp(creep + interior, 0.0, 1.0);

    // the pointer wipes the glass clean around it
    vec2 mp = (mouse - window_box.xy) / max(window_box.zw, vec2(1.0)) * size;
    float wipe = smoothstep(60.0, 190.0, length(px - mp));
    dens *= wipe;

    // very faint mist film right at the edges, so the drops sit in something
    float film = creep * creep * wipe * (0.5 + 0.5 * patch_);
    c = mix(c, c * 0.97 + vec3(0.62, 0.74, 0.78) * 0.05, film * 1.0 * K);

    // three sizes of droplet: fine dew, small, and a few bigger drops near the edge
    c = md_drops(c, px + sd * 13.0, uv, size, 9.0, 1.6, 3.0, sd, dens * 0.55, K);
    c = md_drops(c, px + sd * 29.0 + 3.0, uv, size, 17.0, 2.6, 5.0, sd + 11.0, dens * 0.36, K);
    c = md_drops(c, px + sd * 41.0 + 9.0, uv, size, 34.0, 4.0, 8.0, sd + 23.0, dens * dens * 0.30, K);

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
