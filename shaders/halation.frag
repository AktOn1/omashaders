#version 300 es
// category: Lens
// desc: Film halation: highlights bleed a warm red-orange glow
// strength: 55
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec2 px = 1.0 / vec2(textureSize(tex, 0));
    vec3 acc = vec3(0.0);
    float ring = 0.0;
    for (int i = 0; i < 12; i++) {
        float a = float(i) * 0.5236;
        vec2 d = vec2(cos(a), sin(a)) * px;
        vec3 ta = texture(tex, v_texcoord + d * 10.0).rgb;
        vec3 tb = texture(tex, v_texcoord + d * 26.0).rgb;
        acc += max(ta - 0.6, 0.0) + max(tb - 0.6, 0.0);
        ring += dot(ta + tb, vec3(0.1667));
    }
    float g = dot(acc, vec3(0.33)) / 24.0 * clamp(1.0 - ring / 24.0 * 1.5, 0.0, 1.0);
    vec3 glow = vec3(1.0, 0.38, 0.14) * g * 5.5 + vec3(0.2, 0.1, 0.05) * g;
    vec3 c = s.rgb + glow * STRENGTH;
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
