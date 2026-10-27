#version 300 es
// target: window
// category: Glass
// desc: Wet paper: the window becomes a sheet of damp watercolour paper; a cool wash pools and darkens along its edges, pigment granulates in slow damp blotches, the brightest content blooms softly into the fibres and the pointer leaves a wet patch; the focused window is the wettest, text stays crisp (static)
// strength: 60
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

float wpp_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wpp_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(wpp_h(i), wpp_h(i + vec2(1.0, 0.0)), f.x), mix(wpp_h(i + vec2(0.0, 1.0)), wpp_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float wpp_fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 3; i++) { v += a * wpp_n(p); p = p * 2.07 + 23.0; a *= 0.5; }
    return v;
}
float wpp_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    float al = max(s.a, 0.0001);
    vec3 c = s.rgb / al;                                              // un-premultiply; the composer re-applies alpha
    float K = STRENGTH * 1.667;                                       // 1.0 at the default strength
    float sd = fract(seed);
    vec2 px = uv * surface_size;
    float lum = wpp_luma(c);
    float wetK = mix(0.55, 1.0, is_active) * K;                       // the focused sheet is the wettest
    // text and bright content keep their contrast: the paper is under the ink, not over it
    float room = 1.0 - 0.60 * smoothstep(0.50, 0.96, lum);

    vec3 pigment = vec3(0.045, 0.085, 0.150);                         // the colour the wash leaves in the fibres

    // 1. damp blotches: pigment granulates where the sheet has not dried
    float damp = wpp_fbm(px / 120.0 + sd * 31.0);
    float blot = smoothstep(0.38, 0.74, damp);
    c = mix(c, c * 0.90 + pigment * 0.70, blot * 0.34 * wetK * room);

    // 2. the paper's own tooth, fine and irregular, both as shading and as settled pigment
    float tooth = wpp_n(px / 2.4) * 0.55 + wpp_n(px / 5.6 + 7.0) * 0.45;
    float t2 = (tooth - 0.5) * wetK * room * (0.4 + 0.8 * damp);
    c *= 1.0 + t2 * 0.11;
    c += pigment * t2 * 0.42;

    // 3. the wash ran to the edges of the sheet and dried there in a deeper band
    vec2 edge = min(px, surface_size - px);
    float band = clamp(min(surface_size.x, surface_size.y) * 0.11, 16.0, 70.0);
    float pool = 1.0 - smoothstep(0.0, band, min(edge.x, edge.y));
    pool *= 0.55 + 0.45 * wpp_n(vec2((px.x + px.y) / 70.0 + sd * 17.0, 2.0));   // the pool is uneven
    c = mix(c, c * 0.80 + pigment * 1.25, pool * 0.70 * wetK * room);

    // 4. a soft bloom where the content is brightest, as light spreads through wet fibres
    float hi = smoothstep(0.58, 1.0, lum);
    c += vec3(0.045, 0.058, 0.075) * hi * 0.9 * wetK;

    // 5. the pointer leaves a wet patch on the sheet: the pigment there is deeper and cooler
    vec2 mp = mouse - window_box.xy;
    float dm = length(px - mp * (surface_size / max(window_box.zw, vec2(1.0))));
    float wetSpot = exp(-dm * dm / (2.0 * 110.0 * 110.0));
    c = mix(c, c * 0.94 + pigment * 0.80, wetSpot * 0.40 * wetK * room);

    // 6. a thin damp line along the top edge of the focused sheet
    c = mix(c, c * 0.70 + pigment * 1.6, smoothstep(3.0, 0.0, px.y) * is_active * 0.55 * K);

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
