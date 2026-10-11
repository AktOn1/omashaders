#version 300 es
// category: Color
// desc: Atomic cream: warm walnut shadows, burnt orange mid tones, apricot lights and cream highlights; a 1960s space-age grade
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
    vec3 k0 = vec3(0.10, 0.07, 0.06);
    vec3 k1 = vec3(0.55, 0.30, 0.15);
    vec3 k2 = vec3(0.95, 0.70, 0.42);
    vec3 k3 = vec3(1.0, 0.96, 0.84);
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.35, l));
    grad = mix(grad, k2, smoothstep(0.30, 0.72, l));
    grad = mix(grad, k3, smoothstep(0.68, 1.00, l));
    // keep a faint trace of the original hue
    vec3 keep = mix(vec3(l), c, 0.30) * vec3(1.04, 0.98, 0.90);
    vec3 g = mix(keep, grad, 0.76);
    // hold the original luminance so contrast and text legibility are unchanged
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.7);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
