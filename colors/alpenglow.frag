#version 300 es
// category: Color
// desc: Alpenglow: shadows lean blue-violet, mid tones warm to rose, lights glow orange and highlights stay a soft peach-white; luminance is held so text stays crisp
// strength: 60
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    vec3 k0 = vec3(0.060, 0.055, 0.200);
    vec3 k1 = vec3(0.300, 0.200, 0.470);
    vec3 k2 = vec3(0.880, 0.440, 0.480);
    vec3 k3 = vec3(1.000, 0.700, 0.420);
    vec3 k4 = vec3(1.000, 0.930, 0.860);
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.25, l));
    grad = mix(grad, k2, smoothstep(0.22, 0.52, l));
    grad = mix(grad, k3, smoothstep(0.48, 0.80, l));
    grad = mix(grad, k4, smoothstep(0.78, 1.00, l));
    // keep some of the original hue so colours stay tellable apart
    vec3 keep = mix(vec3(l), c, 0.50) * vec3(1.04, 0.97, 1.03);
    vec3 g = mix(keep, grad, 0.66);
    // hold the original luminance: the grade tints, it does not change contrast
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.75);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
