#version 300 es
// category: Art
// desc: Woodland camouflage: tan, green and brown patches with black flecks, in thin printed-cloth grain. The screen's light and dark are kept, so text stays readable
// strength: 80
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
const vec3 C0 = vec3(0.50, 0.47, 0.29); // tan
const vec3 C1 = vec3(0.21, 0.30, 0.15); // green
const vec3 C2 = vec3(0.31, 0.21, 0.12); // brown
const vec3 C3 = vec3(0.07, 0.08, 0.06); // black
const float KEEP = 0.62;                // how much of the screen's own light and dark survives
float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}
float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = p * 2.07 + vec2(17.3, 9.1); a *= 0.5; }
    return s / 0.875;
}
float edge(float n, float t) {
    float w = max(fwidth(n) * 0.75, 0.002);
    return smoothstep(t - w, t + w, n);
}
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec2 px = v_texcoord * vec2(textureSize(tex, 0));
    vec2 q = px / vec2(190.0, 110.0);
    q += (vec2(fbm(q * 1.6 + 5.0), fbm(q * 1.6 + 19.0)) - 0.5) * 1.1;
    vec3 c = C0;
    c = mix(c, C1, edge(fbm(q * 0.9 + 3.0), 0.50));
    c = mix(c, C2, edge(fbm(q * 0.9 + 41.0), 0.54));
    c = mix(c, C3, edge(fbm(q * vec2(2.6, 2.0) + 77.0), 0.64));
    c *= 0.94 + 0.12 * vnoise(px * 0.7);
    float l = dot(s.rgb, vec3(0.299, 0.587, 0.114));
    float k = 0.5 + KEEP * (l - 0.5);
    c = k < 0.5 ? c * (2.0 * k) : mix(c, vec3(1.0), 2.0 * (k - 0.5));
    fragColor = vec4(c, s.a);
}
