#version 300 es
// category: Art
// desc: Desert camouflage in sand and brown. Text stays readable
// strength: 75
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
const vec3 C0 = vec3(0.76, 0.66, 0.47);
const vec3 C1 = vec3(0.58, 0.46, 0.30);
const vec3 C2 = vec3(0.66, 0.58, 0.40);
const vec3 C3 = vec3(0.40, 0.32, 0.22);
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
    vec2 p = v_texcoord * vec2(textureSize(tex, 0));
    float e = 0.012;
    vec3 c = C0;
    c = mix(c, C1, smoothstep(0.50 - e, 0.50 + e, fbm(p / 300.0 + 3.0)));
    c = mix(c, C2, smoothstep(0.56 - e, 0.56 + e, fbm(p / 170.0 + 41.0)));
    c = mix(c, C3, smoothstep(0.63 - e, 0.63 + e, fbm(p / 95.0 + 77.0)));
    float l = dot(s.rgb, vec3(0.299, 0.587, 0.114));
    fragColor = vec4(clamp(c * mix(0.42, 1.3, l), 0.0, 1.0), s.a);
}
