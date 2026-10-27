#version 300 es
// category: Color
// desc: Walnut print: deep walnut-brown shadows, desaturated honey-tan mid tones and cream highlights, like an old print on varnished wood, with greens pulled toward olive and blues toward slate and a moderate contrast
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
    vec3 k0 = vec3(0.075, 0.040, 0.022);
    vec3 k1 = vec3(0.290, 0.170, 0.090);
    vec3 k2 = vec3(0.700, 0.510, 0.300);
    vec3 k3 = vec3(0.960, 0.890, 0.730);
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.30, l));
    grad = mix(grad, k2, smoothstep(0.28, 0.66, l));
    grad = mix(grad, k3, smoothstep(0.66, 1.00, l));
    // greens lean olive, blues lean slate: pull those hues toward the wood tones before keeping them
    float gr = clamp((c.g - max(c.r, c.b)) * 3.0, 0.0, 1.0);
    float bl = clamp((c.b - max(c.r, c.g)) * 3.0, 0.0, 1.0);
    vec3 olive = vec3(l) * vec3(1.00, 0.98, 0.62) + vec3(0.0, 0.01, -0.01);
    vec3 slate = vec3(l) * vec3(0.86, 0.90, 0.98);
    vec3 cm = mix(c, olive, gr * 0.55);
    cm = mix(cm, slate, bl * 0.50);
    vec3 keep = mix(vec3(l), cm, 0.42);
    vec3 g = mix(keep, grad, 0.72);
    // keep the picture's own light and dark structure, with a little less contrast
    float lumg = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / lumg), 0.0, 1.0), 0.40);
    g = mix(vec3(0.46, 0.34, 0.22), g, 0.94);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
