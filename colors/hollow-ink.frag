#version 300 es
// category: Color
// desc: Hollow ink: ink-teal shadows, slate-violet mid tones, lamp amber in the upper mids and bone-white highlights, a quiet autumn-night grade that keeps your picture's own light and dark
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
    vec3 k0 = vec3(0.025, 0.045, 0.060);
    vec3 k1 = vec3(0.20, 0.24, 0.32);
    vec3 k2 = vec3(0.80, 0.60, 0.38);
    vec3 k3 = vec3(0.96, 0.93, 0.84);
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.40, l));
    grad = mix(grad, k2, smoothstep(0.42, 0.78, l));
    grad = mix(grad, k3, smoothstep(0.74, 1.00, l));
    vec3 keep = mix(vec3(l), c, 0.45);
    vec3 g = mix(keep, grad, 0.62);
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.55);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
