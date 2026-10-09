#version 300 es
// category: Color
// desc: Blockbuster look: teal shadows, orange skin and highlights
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    vec3 shadow = vec3(0.0, 0.18, 0.24);
    vec3 high = vec3(1.0, 0.62, 0.30);
    c = mix(c, c * mix(vec3(0.75, 1.0, 1.1), vec3(1.15, 1.0, 0.8), smoothstep(0.2, 0.8, l)), 0.85);
    c += mix(shadow, vec3(0.0), smoothstep(0.0, 0.45, l)) * 0.35;
    c += high * smoothstep(0.65, 1.0, l) * 0.06;
    c = (c - 0.5) * 1.06 + 0.5;
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
