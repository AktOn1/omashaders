#version 300 es
// category: Color
// desc: Rune slate: blue-slate shadows, cool grey mid tones, warm bone highlights, antique gold in the brightest warm colours and reds pulled toward ember, like a carved hall lit by torches
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
    vec3 k0 = vec3(0.030, 0.045, 0.085);
    vec3 k1 = vec3(0.200, 0.250, 0.330);
    vec3 k2 = vec3(0.560, 0.610, 0.670);
    vec3 k3 = vec3(0.960, 0.920, 0.820);
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.30, l));
    grad = mix(grad, k2, smoothstep(0.28, 0.62, l));
    grad = mix(grad, k3, smoothstep(0.64, 1.00, l));
    vec3 keep = mix(vec3(l), c, 0.35);
    vec3 g = mix(keep, grad, 0.72);
    float lumg = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / lumg), 0.0, 1.0), 0.45);
    // warm, bright colours pick up antique gold; strong reds turn ember-orange
    float warm = clamp((c.r - c.b) * 1.6, 0.0, 1.0);
    float redness = clamp((c.r - max(c.g, c.b)) * 2.4, 0.0, 1.0);
    vec3 gold = vec3(0.95, 0.74, 0.34) * (0.55 + 0.6 * l);
    g = mix(g, gold, warm * smoothstep(0.45, 0.85, l) * 0.55);
    vec3 ember = vec3(1.00, 0.44, 0.13) * (0.45 + 0.8 * l);
    g = mix(g, ember, redness * 0.50);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
