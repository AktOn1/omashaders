#version 300 es
// category: Color
// desc: Vaporwave: purple shadows, pink and cyan highlights
// strength: 80
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    vec3 grad = l < 0.5 ? mix(vec3(0.10, 0.02, 0.28), vec3(0.95, 0.25, 0.65), l * 2.0) : mix(vec3(0.95, 0.25, 0.65), vec3(0.55, 0.98, 1.0), (l - 0.5) * 2.0);
    c = mix(c, grad, 0.65);
    c = mix(vec3(luma(c)), c, 1.2);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
