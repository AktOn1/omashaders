#version 300 es
// category: Devices
// desc: E-ink night: soft grey text on dark warm paper, no blue
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    l = floor(clamp(l, 0.0, 1.0) * 15.0 + 0.5) / 15.0;
    c = mix(vec3(0.045, 0.040, 0.035), vec3(0.62, 0.55, 0.43), l);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
