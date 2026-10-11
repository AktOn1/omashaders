#version 300 es
// category: Color
// desc: Saturn gold: cream-gold lights and pale ochre highlights over soft brown-violet shadows, like sunlight on a ringed planet; luminance is held so text stays crisp
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
    vec3 k0 = vec3(0.045, 0.025, 0.055);
    vec3 k1 = vec3(0.26, 0.16, 0.22);
    vec3 k2 = vec3(0.74, 0.56, 0.36);
    vec3 k3 = vec3(1.0, 0.93, 0.76);
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.30, l));
    grad = mix(grad, k2, smoothstep(0.26, 0.68, l));
    grad = mix(grad, k3, smoothstep(0.64, 1.00, l));
    // keep a trace of the original hue
    vec3 keep = mix(vec3(l), c, 0.35);
    vec3 g = mix(keep, grad, 0.82);
    // hold the original luminance so contrast and text legibility are unchanged
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.70);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
