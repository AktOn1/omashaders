#version 300 es
// category: Color
// desc: Ashen green: a cold grey-green wash with lifted, slightly sea-green shadows, ash-grey mid tones and pale bone-white lights; a graveyard-mist grade that keeps text contrast
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
    vec3 k0 = vec3(0.045, 0.075, 0.072);
    vec3 k1 = vec3(0.30, 0.41, 0.38);
    vec3 k2 = vec3(0.66, 0.75, 0.70);
    vec3 k3 = vec3(0.94, 0.98, 0.93);
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.40, l));
    grad = mix(grad, k2, smoothstep(0.35, 0.75, l));
    grad = mix(grad, k3, smoothstep(0.70, 1.00, l));
    // a fifth of the original colour survives, drained and cooled
    vec3 keep = mix(vec3(l), c, 0.30) * vec3(0.96, 1.02, 1.00);
    vec3 g = mix(keep, grad, 0.78);
    // hold the original luminance so contrast and text legibility are unchanged
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.70);
    // lift the very darkest values a touch (cold ash in the shadows)
    g += vec3(0.010, 0.020, 0.018) * (1.0 - smoothstep(0.0, 0.25, l));
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
