#version 300 es
// category: Color
// desc: Xeno teal: teal and coral in the lights and mid tones over soft violet shadows, like the glow of an alien night garden; luminance is held so text stays crisp
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
    vec3 k0 = vec3(0.035, 0.020, 0.075);
    vec3 k1 = vec3(0.22, 0.14, 0.36);
    vec3 k2 = vec3(0.30, 0.78, 0.72);
    vec3 k3 = vec3(1.0, 0.86, 0.80);
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.30, l));
    grad = mix(grad, k2, smoothstep(0.26, 0.62, l));
    grad = mix(grad, k3, smoothstep(0.62, 1.00, l));
    // warm reds and oranges in the picture become coral instead of vanishing
    float warm = clamp((c.r - max(c.g, c.b)) * 2.5, 0.0, 1.0);
    grad = mix(grad, vec3(1.0, 0.45, 0.40) * (0.35 + 0.8 * l), warm * 0.55);
    vec3 keep = mix(vec3(l), c, 0.30);
    vec3 g = mix(keep, grad, 0.80);
    // hold the original luminance so contrast and text legibility are unchanged
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.70);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
