#version 300 es
// category: Comfort
// desc: Ember hush: brown-black shadows, soft amber mid tones and warm cream lights, candle-lit and quiet, with the mid tones kept legible
// strength: 50
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    // brown-black -> deep amber-brown -> soft amber -> warm cream
    vec3 k0 = vec3(0.050, 0.034, 0.026);
    vec3 k1 = vec3(0.30, 0.20, 0.12);
    vec3 k2 = vec3(0.72, 0.52, 0.30);
    vec3 k3 = vec3(0.97, 0.88, 0.70);
    vec3 grad = mix(k0, k1, smoothstep(0.0, 0.30, l));
    grad = mix(grad, k2, smoothstep(0.25, 0.68, l));
    grad = mix(grad, k3, smoothstep(0.65, 1.0, l));
    // keep luminance (and a small lift in the darks so mid tones stay legible)
    float gl = max(luma(grad), 0.001);
    grad = clamp(grad * (max(l, 0.04) / gl), 0.0, 1.0);
    vec3 g = mix(c, grad, 0.64);
    float gg = luma(g);
    g = mix(vec3(gg), g, 0.9);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
