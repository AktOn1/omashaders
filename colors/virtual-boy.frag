#version 300 es
// category: Devices
// desc: Virtual Boy: red on black
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    l = floor(clamp(l, 0.0, 1.0) * 3.0 + 0.5) / 3.0;
    c = vec3(0.95 * l, 0.02 * l, 0.03 * l);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
