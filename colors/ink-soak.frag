#version 300 es
// category: Color
// desc: Ink soak: deep indigo shadows, slate-blue mid tones with the colour drawn down a little, warm cream washi highlights, and reds kept as bright vermilion accents like a seal stamp on a soaked print
// strength: 65
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    vec3 k0 = vec3(0.020, 0.040, 0.140);
    vec3 k1 = vec3(0.110, 0.200, 0.440);
    vec3 k2 = vec3(0.560, 0.650, 0.760);
    vec3 k3 = vec3(0.980, 0.950, 0.860);
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.34, l));
    grad = mix(grad, k2, smoothstep(0.32, 0.72, l));
    grad = mix(grad, k3, smoothstep(0.72, 0.98, l));
    // mids lose some colour; the picture keeps a little of its own hue
    vec3 keep = mix(vec3(l), c, 0.38);
    vec3 g = mix(keep, grad, 0.72);
    float lumg = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / lumg), 0.0, 1.0), 0.40);
    // reds stay vermilion
    float red = smoothstep(0.38, 0.62, c.r - max(c.g, c.b)) * smoothstep(0.12, 0.40, c.r);
    vec3 verm = vec3(0.92, 0.26, 0.14) * (0.45 + 0.75 * c.r);
    g = mix(g, verm, red * 0.70);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
