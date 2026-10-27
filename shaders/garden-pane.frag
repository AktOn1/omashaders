#version 300 es
// target: window
// category: Glass
// desc: Garden pane: two slow layers of pale cloud drift inside the glass, the focused window catches a warm sunlit rim on the cloud edges and along its border, and a faint dew bloom beads along the top; dark and busy areas keep their contrast, so text stays crisp (animated)
// strength: 55
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
uniform vec2 surface_size;
uniform float is_active;
uniform float seed;
layout(location = 0) out vec4 fragColor;

float gp_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gp_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(gp_h(i), gp_h(i + vec2(1.0, 0.0)), f.x), mix(gp_h(i + vec2(0.0, 1.0)), gp_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float gp_fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * gp_n(p); p = p * 2.07 + 13.0; a *= 0.5; }
    return v;
}
float gp_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// coverage of one cloud layer at q
float gp_cloud(vec2 q, float cover) {
    float n = gp_fbm(q * vec2(1.0, 1.6));
    return smoothstep(cover, cover + 0.20, n);
}

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    float al = max(s.a, 0.0001);
    vec3 c = s.rgb / al;                                              // un-premultiply; the composer re-applies alpha
    float act = is_active;
    float sd = fract(seed);
    vec2 px = uv * surface_size;
    float sc = clamp(surface_size.y / 620.0, 0.7, 2.0);
    float lum = gp_luma(c);

    // keep the text area clear: dark backgrounds and busy, high-contrast places (glyphs, icons) take far less of the effect
    vec2 st = vec2(1.6, 1.6) / max(surface_size, vec2(1.0));
    float a1 = gp_luma(texture(tex, uv + st).rgb);
    float a2 = gp_luma(texture(tex, uv - st).rgb);
    float a3 = gp_luma(texture(tex, uv + vec2(st.x, -st.y)).rgb);
    float a4 = gp_luma(texture(tex, uv - vec2(st.x, -st.y)).rgb);
    float busy = max(max(a1, a2), max(a3, a4)) - min(min(a1, a2), min(a3, a4));
    float clear = (1.0 - 0.80 * smoothstep(0.05, 0.35, busy))         // right next to a glyph: almost nothing
                * mix(0.52, 1.0, smoothstep(0.05, 0.42, lum));        // a dark terminal keeps its depth
    float K = mix(0.60, 1.0, act);

    // two layers of cloud drifting inside the glass, the near one faster and larger (parallax)
    vec2 q1 = vec2(px.x / (520.0 * sc) + time * 0.0090 + sd * 17.0, px.y / (340.0 * sc) + sd * 5.0);
    vec2 q2 = vec2(px.x / (260.0 * sc) + time * 0.0165 + sd * 29.0, px.y / (190.0 * sc) + sd * 11.0);
    float f1 = gp_cloud(q1, 0.42);
    float f2 = gp_cloud(q2, 0.46);
    // the sun stands to the upper right of the glass: the edge of the near layer facing it lights up
    float f2s = gp_cloud(q2 + vec2(0.055, -0.075), 0.46);
    float rim = clamp(f2 - f2s, 0.0, 1.0);

    float band = mix(0.40, 1.0, pow(1.0 - uv.y, 0.8));                // the clouds hang from the top of the pane
    vec3 pale = vec3(0.97, 0.96, 0.95);
    vec3 cool = vec3(0.78, 0.84, 0.97);
    c += mix(cool, pale, 0.55) * f1 * 0.070 * K * clear * band;
    c += pale * f2 * 0.095 * K * clear * band;
    c += vec3(1.0, 0.86, 0.68) * rim * 0.20 * act * clear * band;     // sunlit rims only on the focused window
    c = mix(c, c * vec3(1.005, 1.0, 1.01), (f1 + f2) * 0.25 * clear);

    // dew along the top edge: a faint bloom with a few beads sitting in it
    float topd = px.y / (16.0 * sc);
    float bead = gp_n(vec2(px.x / (34.0 * sc) + sd * 23.0, 0.5));
    float dew = exp(-topd) * (0.55 + 0.75 * smoothstep(0.55, 0.95, bead));
    c += vec3(1.0, 0.97, 0.92) * dew * 0.105 * mix(0.7, 1.25, act);

    // a thin warm line and a soft inner glow on the border of the focused window
    float eg = min(min(px.x, surface_size.x - px.x), min(px.y, surface_size.y - px.y));
    c += vec3(1.0, 0.89, 0.74) * smoothstep(2.0, 0.0, eg) * 0.11 * act;
    c += vec3(1.0, 0.92, 0.80) * exp(-eg / (26.0 * sc)) * 0.030 * act * clear;

    fragColor = vec4(clamp(c, 0.0, 0.99), s.a);
}
