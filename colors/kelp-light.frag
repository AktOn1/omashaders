#version 300 es
// category: Color
// desc: Kelp light: shadows sink to deep sea-green, mid tones turn leaf green and gold, highlights stay clear warm white; a clean green-gold underwater grade that keeps text crisp
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
    vec3 k0 = vec3(0.012, 0.075, 0.075);
    vec3 k1 = vec3(0.12, 0.42, 0.24);
    vec3 k2 = vec3(0.72, 0.74, 0.30);
    vec3 k3 = vec3(1.0, 0.98, 0.84);
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.40, l));
    grad = mix(grad, k2, smoothstep(0.35, 0.78, l));
    grad = mix(grad, k3, smoothstep(0.74, 1.00, l));
    // keep a trace of the original colour so reds and blues do not vanish
    vec3 keep = mix(vec3(l), c, 0.40);
    vec3 g = mix(keep, grad, 0.68);
    // hold the original luminance so contrast and text legibility are unchanged
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.75);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
