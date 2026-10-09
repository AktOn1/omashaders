#version 300 es
// category: Retro
// desc: White-on-blue drafting look
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 gm3(float t, vec3 a, vec3 b, vec3 c) { t = clamp(t, 0.0, 1.0); return t < 0.5 ? mix(a, b, t * 2.0) : mix(b, c, t * 2.0 - 1.0); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    c = gm3(luma(c), vec3(0.03, 0.14, 0.38), vec3(0.12, 0.38, 0.78), vec3(0.92, 0.96, 1.0));
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
