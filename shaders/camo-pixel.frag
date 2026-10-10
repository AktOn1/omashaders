#version 300 es
// category: Art
// desc: Pixelated woodland camouflage (digital camo, 6 px blocks). Text stays readable
// strength: 70
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
const vec3 C0 = vec3(0.36, 0.38, 0.22);
const vec3 C1 = vec3(0.30, 0.22, 0.13);
const vec3 C2 = vec3(0.18, 0.28, 0.13);
const vec3 C3 = vec3(0.08, 0.10, 0.06);
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
    for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(17.3, 9.1); a *= 0.5; }
    return s;
}
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec2 p = floor(v_texcoord * vec2(textureSize(tex, 0)) / 6.0);
    vec3 c = C0;
    c = mix(c, C1, step(0.50, fbm(p / 16.0 + 3.0)));
    c = mix(c, C2, step(0.56, fbm(p / 9.0 + 41.0)));
    c = mix(c, C3, step(0.60, vnoise(p / 3.2 + 77.0) * 0.6 + hash(p) * 0.4));
    float l = dot(s.rgb, vec3(0.299, 0.587, 0.114));
    fragColor = vec4(clamp(c * mix(0.42, 1.3, l), 0.0, 1.0), s.a);
}
