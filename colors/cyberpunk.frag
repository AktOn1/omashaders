#version 300 es
// category: Color
// desc: Neon city: magenta shadows, cyan highlights, boosted saturation
// strength: 70
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    vec3 grad = mix(vec3(0.20, 0.0, 0.35), vec3(0.15, 0.95, 1.0), smoothstep(0.1, 0.9, l));
    c = mix(c, grad * (0.6 + 0.8 * l), 0.35);
    c = mix(vec3(luma(c)), c, 1.45);
    c = (c - 0.5) * 1.12 + 0.5;
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
