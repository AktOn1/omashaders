#version 300 es
// category: Devices
// desc: IBM terminal: soft green text on a dark panel
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    l = pow(l, 0.85);
    c = mix(vec3(0.01, 0.03, 0.02), vec3(0.45, 1.0, 0.55), l);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
