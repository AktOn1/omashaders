#version 300 es
// category: Color
// desc: Doubloon: deep teal shadows and sea-green mid tones with warm gold lights and a pale glint at the top; a treasure-cove grade, teal against gold
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
    vec3 k0 = vec3(0.008, 0.045, 0.060);       // deep teal black
    vec3 k1 = vec3(0.080, 0.340, 0.350);       // sea teal
    vec3 k2 = vec3(0.830, 0.640, 0.250);       // doubloon gold
    vec3 k3 = vec3(1.000, 0.930, 0.730);       // glint
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.34, l));
    grad = mix(grad, k2, smoothstep(0.38, 0.76, l));
    grad = mix(grad, k3, smoothstep(0.72, 1.00, l));
    // keep a faint trace of the original hue
    vec3 keep = mix(vec3(l), c, 0.34) * vec3(0.96, 1.00, 1.00);
    vec3 g = mix(keep, grad, 0.76);
    // hold the original luminance so contrast and text legibility are unchanged
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.66);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
