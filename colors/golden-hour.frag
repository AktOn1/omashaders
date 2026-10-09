#version 300 es
// category: Color
// desc: Late sun: warm gold light, soft amber shadows
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    c = c * vec3(1.08, 0.97, 0.78) + vec3(0.04, 0.02, 0.0);
    c = mix(c, c * c * (3.0 - 2.0 * c), 0.25);
    c += vec3(0.10, 0.05, 0.0) * smoothstep(0.55, 1.0, l);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
