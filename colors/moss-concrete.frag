#version 300 es
// category: Color
// desc: Moss concrete: weathered grey-green shadows, mossy mid tones and warm sunlit bone lights; ruins taken back by the forest, text contrast kept
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
    vec3 k0 = vec3(0.050, 0.055, 0.055);
    vec3 k1 = vec3(0.30, 0.34, 0.29);
    vec3 k2 = vec3(0.68, 0.72, 0.56);
    vec3 k3 = vec3(1.00, 0.97, 0.80);
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.38, l));
    grad = mix(grad, k2, smoothstep(0.32, 0.74, l));
    grad = mix(grad, k3, smoothstep(0.70, 1.00, l));
    // keep a faint trace of the original hue
    vec3 keep = mix(vec3(l), c, 0.28) * vec3(0.98, 1.02, 0.96);
    vec3 g = mix(keep, grad, 0.76);
    // hold the original luminance so contrast and text legibility are unchanged
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.68);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
