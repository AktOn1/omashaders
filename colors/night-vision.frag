#version 300 es
// category: Devices
// desc: Night vision: green amplified image
// strength: 90
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    l = pow(clamp(l * 1.5, 0.0, 1.0), 0.7);
    c = vec3(0.10, 1.0, 0.25) * l;
    c += vec3(0.0, 0.03, 0.0);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
