#version 300 es
// category: Color
// desc: Cold blue-white winter light
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    vec3 grad = mix(vec3(0.02, 0.07, 0.18), vec3(0.88, 0.97, 1.0), smoothstep(0.0, 1.0, l));
    c = mix(c, grad, 0.7);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
