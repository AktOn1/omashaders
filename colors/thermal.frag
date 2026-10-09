#version 300 es
// category: Devices
// desc: Thermal camera: brightness mapped to heat colours
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    vec3 a = vec3(0.0, 0.0, 0.25), b = vec3(0.5, 0.0, 0.6), d = vec3(0.95, 0.25, 0.1), e = vec3(1.0, 0.85, 0.1), f = vec3(1.0);
    c = l < 0.25 ? mix(a, b, l * 4.0) : l < 0.5 ? mix(b, d, (l - 0.25) * 4.0) : l < 0.75 ? mix(d, e, (l - 0.5) * 4.0) : mix(e, f, (l - 0.75) * 4.0);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
