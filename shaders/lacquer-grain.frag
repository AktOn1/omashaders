#version 300 es
// category: Ambient
// desc: Lacquer grain: a warm walnut-brown tint, long wood-grain streaks that show only in the margins and corners like a lacquered board around the picture, a brown vignette and a soft varnish highlight at the top left. The centre stays sharp so text is clear (static, no animation)
// strength: 55
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float lg_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float lg_h(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
float lg_n(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(lg_h(i), lg_h(i + vec2(1.0, 0.0)), f.x), mix(lg_h(i + vec2(0.0, 1.0)), lg_h(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
    vec2 uv = v_texcoord;
    vec2 sz = vec2(textureSize(tex, 0));
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float l = lg_luma(c);
    float sc = clamp(sz.y / 1080.0, 0.75, 2.0);
    vec2 px = uv * sz / sc;

    // lacquer tint: shadows lean deep walnut, highlights warm cream, the picture keeps its own colour
    vec3 tint = mix(vec3(0.130, 0.070, 0.035), vec3(1.00, 0.93, 0.80), smoothstep(0.0, 0.85, l));
    c = mix(c, c * tint / max(lg_luma(tint), 0.05) * 0.94, 0.30);

    // how far into the margin this pixel is: 0 in the centre, 1 at the edges
    vec2 e = abs(uv - 0.5) * 2.0;
    float mar = smoothstep(0.60, 1.00, max(e.x * 0.95, e.y * 1.20));
    mar = mar * mar * (3.0 - 2.0 * mar);

    // long grain streaks with a few cathedral arches, running along x
    float warp = lg_n(vec2(px.x * 0.0016, px.y * 0.004)) * 0.7 + lg_n(vec2(px.x * 0.004, px.y * 0.010)) * 0.3;
    float g = px.y * 0.030 + warp * 2.4;
    float sw = fract(g);
    float late = pow(sw, 2.4) * smoothstep(1.0, 0.90, sw);
    float fib = lg_n(vec2(px.x * 0.006, px.y * 0.55)) * 0.55 + lg_n(vec2(px.x * 0.022, px.y * 2.0)) * 0.45;
    float wood = 0.55 + 0.45 * (fib - 0.5) - 0.40 * late;
    vec3 wcol = mix(vec3(0.10, 0.055, 0.028), vec3(0.50, 0.32, 0.17), clamp(wood * 1.25, 0.0, 1.0));
    c = mix(c, c * 0.40 + wcol * 0.95, mar * 0.62);

    // a warm brown vignette
    float vig = smoothstep(0.55, 1.25, length((uv - 0.5) * vec2(sz.x / sz.y, 1.0) * 0.95));
    c = mix(c, c * 0.72 + vec3(0.030, 0.015, 0.006), vig * 0.80);

    // varnish highlight at the top left: a soft warm bloom with a faint streak along the grain
    vec2 d = (uv - vec2(0.10, 0.06)) * vec2(sz.x / sz.y, 1.0);
    float bloom = exp(-dot(d * vec2(0.6, 1.2), d * vec2(0.6, 1.2)) / 0.060);
    float sheen = bloom * (0.65 + 0.7 * fib);
    c = 1.0 - (1.0 - c) * (1.0 - vec3(1.00, 0.86, 0.60) * sheen * 0.34 * (0.4 + 0.6 * mar));

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
