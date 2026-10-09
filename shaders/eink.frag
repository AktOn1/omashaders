#version 300 es
// category: Devices
// desc: E-ink reader: 16 grey levels on warm paper
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    l = floor(clamp((l - 0.04) * 1.08, 0.0, 1.0) * 15.0 + 0.5) / 15.0;
    c = mix(vec3(0.10, 0.10, 0.09), vec3(0.89, 0.88, 0.82), l);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
