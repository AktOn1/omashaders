#version 300 es
// category: Lens
// desc: Cracked glass: the impact shatters the picture into shards that tilt the light, with rainbow edges along the cracks and an ink-bleed spot
// strength: 60
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

const vec2 IMPACT = vec2(0.70, 0.30);
const float SPOKES = 15.0;
const float RINGS = 1.15;

vec2 bs_h22(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
}
float bs_h(vec2 p) { return fract(sin(dot(p, vec2(41.7, 289.3))) * 43758.5453); }
float bs_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(bs_h(i), bs_h(i + vec2(1.0, 0.0)), f.x), mix(bs_h(i + vec2(0.0, 1.0)), bs_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec3 bs_hue(float h) { return clamp(abs(fract(h + vec3(0.0, 0.667, 0.333)) * 6.0 - 3.0) - 1.0, 0.0, 1.0); }

void main() {
    vec2 res = vec2(textureSize(tex, 0));
    vec2 px = v_texcoord * res;
    vec2 d = px - IMPACT * res;
    float r = max(length(d), 1.0);
    float ang = atan(d.y, d.x) / 6.28318 + 0.5;
    // polar cells: spokes around the impact, rings that get wider with distance
    vec2 q = vec2(ang * SPOKES, log(r / 18.0) * RINGS);
    vec2 ci = floor(q), cf = fract(q);
    float f1 = 9.0, f2 = 9.0;
    vec2 best = vec2(0.0);
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 cid = ci + g;
            cid.x = mod(cid.x, SPOKES);
            vec2 o = bs_h22(cid);
            vec2 dv = g + 0.15 + 0.7 * o - cf;
            float dd = dot(dv, dv);
            if (dd < f1) { f2 = f1; f1 = dd; best = cid; }
            else if (dd < f2) { f2 = dd; }
        }
    }
    float edge = sqrt(f2) - sqrt(f1);
    float cell = max(min(r * 6.28318 / SPOKES, r / RINGS), 3.0);
    float en = edge * cell;
    float broken = smoothstep(0.42, 0.66, bs_n(q * vec2(1.6, 1.1) + 4.0) + 0.22 * bs_n(q * 5.0));
    float crack = (1.0 - smoothstep(0.4, 1.5, en)) * mix(0.55, 1.0, broken);
    float glow = (1.0 - smoothstep(1.0, 7.0, en)) * broken;
    float reach = 1.0 - smoothstep(0.55, 1.15, r / res.y);
    crack *= mix(0.45, 1.0, reach);
    glow *= reach;

    float S = STRENGTH;
    vec2 hv = bs_h22(best + 3.7) - 0.5;
    vec2 tilt = hv * 2.0 * 7.0 * S * (0.5 + reach);
    vec2 uv0 = (px + tilt) / res;
    vec2 disp = tilt * 0.55 / res;
    vec3 c = vec3(texture(tex, uv0 + disp).r, texture(tex, uv0).g, texture(tex, uv0 - disp).b);
    c *= 1.0 + 0.10 * S * (bs_h(best + 9.1) - 0.5) * 2.0;

    // light split into a spectrum along the cracks and in a thin band inside each shard edge
    vec3 spec = bs_hue(bs_h(best + 1.3) * 0.6 + ang * 1.5 + r / res.y * 0.8);
    c += spec * glow * 0.45 * S;
    c = mix(c, vec3(1.0), crack * 0.50 * S);

    // ink bleed at the impact: soft dark blotch with magenta and green fringes
    float ink = 1.0 - smoothstep(10.0, 62.0 + 28.0 * bs_n(d * 0.06), r);
    float fringe = smoothstep(0.0, 1.0, 1.0 - abs(r - 62.0) / 18.0) * (1.0 - ink);
    c = mix(c, vec3(0.02, 0.0, 0.05), ink * 0.82 * S);
    c += (vec3(0.9, 0.1, 0.8) * step(0.0, d.x) + vec3(0.1, 0.9, 0.5) * step(d.x, 0.0)) * fringe * 0.12 * S * (1.0 - ink);
    fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
