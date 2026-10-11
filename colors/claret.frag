#version 300 es
// category: Color
// desc: Claret: wine-red shadows, rose-brown mid tones and ivory lights; a candle-lit gothic grade with the luminance held so text stays readable
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
    vec3 k0 = vec3(0.085, 0.015, 0.035);
    vec3 k1 = vec3(0.40, 0.11, 0.16);
    vec3 k2 = vec3(0.80, 0.60, 0.58);
    vec3 k3 = vec3(1.0, 0.95, 0.84);
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.38, l));
    grad = mix(grad, k2, smoothstep(0.34, 0.74, l));
    grad = mix(grad, k3, smoothstep(0.70, 1.00, l));
    // a little of the original hue stays so images are not flattened to one wash
    vec3 keep = mix(vec3(l), c, 0.32) * vec3(1.03, 0.97, 0.98);
    vec3 g = mix(keep, grad, 0.76);
    // hold the original luminance so contrast and text legibility are unchanged
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.75);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
