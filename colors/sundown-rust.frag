#version 300 es
// category: Color
// desc: Sundown rust: a split-tone of plum-brown shadows, rusty terracotta mid tones and honey-cream lights, like a photograph left on a sunny porch rail; luminance is held so text stays crisp
// strength: 55
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    // split tone: shadows lean plum-brown, mids rust, lights honey
    vec3 sh = vec3(0.20, 0.10, 0.12);
    vec3 md = vec3(0.74, 0.38, 0.22);
    vec3 hi = vec3(1.00, 0.86, 0.62);
    vec3 grad = mix(sh, md, smoothstep(0.0, 0.55, l));
    grad = mix(grad, hi, smoothstep(0.45, 1.0, l));
    // keep a good part of the original hue so icons and syntax colours still read
    vec3 keep = mix(vec3(l), c, 0.50) * vec3(1.05, 0.97, 0.88);
    vec3 g = mix(keep, grad, 0.62);
    // hold the original luminance so contrast and text legibility are unchanged
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.75);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
