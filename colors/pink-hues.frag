#version 300 es
// category: Color
// desc: Pink hues: everything is pink, but each colour keeps its own shade of pink (rose, coral-pink, magenta, orchid) and richness, so a green app and a blue app both look pink yet still differ
// strength: 100
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 pinkRamp(float l) {
    vec3 k0 = vec3(0.76, 0.09, 0.43);
    vec3 k1 = vec3(0.93, 0.29, 0.59);
    vec3 k2 = vec3(1.00, 0.56, 0.77);
    vec3 k3 = vec3(1.00, 0.81, 0.90);
    vec3 k4 = vec3(1.00, 0.96, 0.98);
    vec3 g = k0;
    g = mix(g, k1, smoothstep(0.00, 0.20, l));
    g = mix(g, k2, smoothstep(0.20, 0.50, l));
    g = mix(g, k3, smoothstep(0.50, 0.80, l));
    g = mix(g, k4, smoothstep(0.80, 1.00, l));
    return g;
}
vec3 toHsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
}
vec3 fromHsv(vec3 c) {
    vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
    return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    vec3 h = toHsv(c);
    vec3 g = pinkRamp(pow(luma(c), 0.8));
    vec3 r = toHsv(g);
    // the original hue only nudges the pink within rose..magenta (smooth wave, no hard edge); colourful pixels get richer pink
    float hue = fract(r.x + 0.045 * sin(6.2832 * h.x));
    float sat = clamp(r.y * mix(0.85, 1.2, h.y), 0.0, 1.0);
    fragColor = vec4(clamp(fromHsv(vec3(hue, sat, r.z)), 0.0, 1.0), s.a);
}
