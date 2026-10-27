#version 300 es
// category: Ambient
// desc: Stone glow: a cold basalt blue-grey cast with a heavier vignette, a faint carved-stone grain that gathers toward the edges, and a warm ember glow bleeding in from the two bottom corners. The centre stays sharp and clear for reading (static, no animation)
// strength: 55
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float sg_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float sg_h(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
float sg_n(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(sg_h(i), sg_h(i + vec2(1.0, 0.0)), f.x), mix(sg_h(i + vec2(0.0, 1.0)), sg_h(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
    vec2 uv = v_texcoord;
    vec2 sz = vec2(textureSize(tex, 0));
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float l = sg_luma(c);
    float sc = clamp(sz.y / 1080.0, 0.75, 2.0);
    vec2 px = uv * sz;
    vec2 q = (uv - 0.5) * vec2(sz.x / sz.y, 1.0);
    float edge = smoothstep(0.38, 1.05, length(q));     // 0 in the middle, 1 at the corners

    // basalt cast: shadows lean slate blue, the picture keeps its own colour
    vec3 tint = mix(vec3(0.050, 0.070, 0.120), vec3(0.88, 0.92, 1.00), smoothstep(0.0, 0.7, l));
    c = mix(c, c * tint / max(sg_luma(tint), 0.05) * 0.94, 0.30 + 0.25 * edge);

    // carved-stone grain: two scales of mottling, only toward the edges so text in the middle stays crisp
    float g = sg_n(px / (5.0 * sc)) * 0.55 + sg_n(px / (1.7 * sc) + 11.0) * 0.45;
    float chisel = sg_n(vec2(px.x / (260.0 * sc), px.y / (3.0 * sc)) + 5.0);   // faint horizontal tool marks
    c *= 1.0 + (g - 0.5) * 0.16 * edge + (chisel - 0.5) * 0.06 * edge;

    // the corners close in, cold and dark
    c = mix(c, c * 0.62 + vec3(0.006, 0.010, 0.026), edge * edge * 0.80);

    // ember glow creeping in from the bottom corners, strongest on dark pixels
    vec2 aspect = vec2(sz.x / sz.y, 1.0);
    float dl = length((uv - vec2(0.0, 1.0)) * aspect);
    float dr = length((uv - vec2(1.0, 1.0)) * aspect);
    float ember = exp(-dl * dl / 0.13) + exp(-dr * dr / 0.13);
    float breath = 0.75 + 0.25 * sg_n(px / (60.0 * sc));
    vec3 hot = vec3(1.00, 0.42, 0.12);
    vec3 warm = vec3(1.00, 0.66, 0.26);
    float darkW = 1.0 - 0.55 * smoothstep(0.2, 0.8, l);
    c += mix(hot, warm, 0.25) * ember * 0.34 * breath * darkW * (0.35 + 0.65 * edge);
    c = mix(c, c * vec3(1.06, 0.98, 0.90), clamp(ember, 0.0, 1.0) * 0.25);

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
