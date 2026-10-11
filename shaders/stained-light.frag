#version 300 es
// target: window
// category: Light
// desc: Stained light: soft patches of coloured light fall through a stained-glass window onto the window, a slanted lancet of ruby, sapphire, amber or emerald panes with dark lead lines and a small rose beside it; fuller on the focused window, and every window gets its own places and hues from its seed (static)
// strength: 55
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform vec2 surface_size;
uniform float is_active;
uniform float seed;
uniform vec4 window_box;
uniform vec2 resolution;
layout(location = 0) out vec4 fragColor;

float sl_h(float x) { return fract(sin(x * 127.1 + 311.7) * 43758.5453); }
float sl_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// the jewel box: ruby, sapphire, amber, emerald, violet
vec3 sl_jewel(float h) {
    float k = floor(fract(h) * 5.0);
    if (k < 0.5) return vec3(0.95, 0.16, 0.26);
    if (k < 1.5) return vec3(0.16, 0.34, 1.00);
    if (k < 2.5) return vec3(1.00, 0.70, 0.16);
    if (k < 3.5) return vec3(0.14, 0.78, 0.40);
    return vec3(0.62, 0.24, 0.92);
}
// a pointed lancet, q in units of its half height: returns the soft light mask (x) and the lead lines (y) and the pane id (z)
vec3 sl_lancet(vec2 q, float hw, float blur) {
    float yn = clamp((q.y + 1.0) * 0.5, 0.0, 1.0);                        // 0 at the point, 1 at the sill
    float cap = 0.38;
    float w = hw * (yn < cap ? pow(yn / cap, 0.72) : 1.0);
    float side = 1.0 - smoothstep(-blur, blur, abs(q.x) - w);
    float ends = smoothstep(-1.0 - blur, -1.0 + blur, q.y) * (1.0 - smoothstep(1.0 - blur, 1.0 + blur, q.y));
    float m = side * ends;
    // lead: a centre mullion and two cross bars, thin and dark
    float lead = max(1.0 - smoothstep(0.012, 0.034, abs(q.x)), max(1.0 - smoothstep(0.012, 0.034, abs(yn - 0.40)), 1.0 - smoothstep(0.012, 0.034, abs(yn - 0.70))));
    lead = max(lead, 1.0 - smoothstep(0.015, 0.04, abs(abs(q.x) - w) * 1.0 + 0.0 * q.y));
    float pane = (q.x < 0.0 ? 0.0 : 1.0) + (yn < 0.40 ? 0.0 : (yn < 0.70 ? 2.0 : 4.0));
    return vec3(m, lead * m, pane);
}

void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    float al = max(s.a, 0.0001);
    vec3 c = s.rgb / al;                                      // un-premultiply; the composer re-applies alpha
    float S = STRENGTH;
    float K = S * 1.8182;                                     // 1.0 at the default strength
    float act = is_active;
    float sd = fract(seed);

    vec2 size = max(surface_size, vec2(1.0));
    vec2 px = uv * size;
    float u = sqrt(size.x * size.y);
    vec2 wp = window_box.xy / max(resolution, vec2(1.0));

    // ---- the lancet: its place, slant and hues come from the seed and from where the window sits on the monitor
    vec2 cA = size * vec2(0.18 + 0.64 * sl_h(sd + 1.0), 0.36 + 0.20 * sl_h(sd + 2.0));
    cA += (vec2(0.5) - wp) * size * vec2(0.18, 0.08);
    float hh = 0.36 * mix(0.85, 1.0, act) * size.y;                 // half height
    hh = max(hh, 0.20 * u);
    vec2 qa = px - cA;
    qa.x -= qa.y * (0.08 + 0.14 * sl_h(sd + 3.0));            // the light slants in from one side
    qa.x *= (sl_h(sd + 4.0) < 0.5 ? 1.0 : -1.0);
    qa /= hh;
    float blur = 0.16;
    vec3 L = sl_lancet(qa, 0.40, blur);
    float baseHue = sl_h(sd + 5.0);
    float paneH = baseHue + L.z * 0.21;
    vec3 jA = sl_jewel(paneH);

    // ---- the rose: a smaller round window of six coloured wedges, a little way off, from another hue
    vec2 cB = size * vec2(sl_h(sd + 6.0) < 0.5 ? 0.78 : 0.22, 0.62 + 0.22 * sl_h(sd + 7.0));
    cB += (vec2(0.5) - wp) * size * vec2(-0.10, 0.06);
    float rr = 0.13 * mix(0.85, 1.0, act) * u;
    vec2 qb = (px - cB) / rr;
    float rad = length(qb);
    float rose = 1.0 - smoothstep(1.0 - blur, 1.0 + blur, rad);
    float ang = atan(qb.y, qb.x) * 0.95493;                    // six wedges
    float wedge = floor(ang + 6.0);
    vec3 jB = sl_jewel(baseHue + 0.4 + wedge * 0.19);
    float petal = abs(fract(ang * 0.5 + 0.5) - 0.5);
    float leadB = max(1.0 - smoothstep(0.02, 0.06, petal * 2.0 * rad / max(rad, 0.15)), 1.0 - smoothstep(0.03, 0.08, abs(rad - 0.45))) * rose;
    leadB = max(leadB, 1.0 - smoothstep(0.03, 0.08, rad)) * rose;

    // ---- laying the light on the window
    float lum = sl_luma(c);
    float k = min(K, 1.4) * mix(0.62, 1.0, act);
    float mA = L.x * (1.0 - 0.80 * L.y);
    float mB = rose * (1.0 - 0.75 * leadB) * 0.75;
    // tint what is already there (so text keeps its shape) and add a little glow, more on dark windows
    c = mix(c, c * (0.62 + 0.80 * jA), mA * 0.34 * k);
    c = mix(c, c * (0.62 + 0.80 * jB), mB * 0.34 * k);
    float glowA = 0.12 * k * (0.55 + 0.9 * (1.0 - lum));
    c += jA * mA * glowA;
    c += jB * mB * glowA * 0.85;
    // the lead lines cast a faint shadow, a touch of warmth in the lit middle of the patch
    c *= 1.0 - 0.06 * k * (L.y + leadB * 0.8);
    c += vec3(0.04, 0.03, 0.02) * mA * k * (1.0 - 0.5 * lum);

    // where the glass sits close to the frame: a coloured rim of spilled light on the top edge
    float edge = min(px.x, px.y);
    float rim = smoothstep(2.5, 0.0, edge);
    c += mix(jA, jB, 0.5) * rim * mix(0.02, 0.07, act) * K;

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
