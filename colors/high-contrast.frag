#version 300 es
// category: Comfort
// desc: Crisper blacks and whites with a mild saturation lift, for hard-to-read screens
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    c = (c - 0.5) * 1.25 + 0.5;
    c = mix(vec3(luma(c)), c, 1.1);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
