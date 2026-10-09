#version 300 es
// category: Devices
// desc: E-ink, high contrast: near black and white, text stays crisp
// strength: 80
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    l = smoothstep(0.30, 0.62, l);
    l = floor(l * 7.0 + 0.5) / 7.0;
    c = mix(vec3(0.07), vec3(0.92, 0.91, 0.87), l);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
