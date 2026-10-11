#version 300 es
// category: Color
// desc: Magma: shadows fall to black-red, mid tones smoulder deep crimson, lights glow orange and highlights pale molten yellow; luminance is held so text stays readable
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
    vec3 k0 = vec3(0.035, 0.005, 0.008);
    vec3 k1 = vec3(0.280, 0.045, 0.030);
    vec3 k2 = vec3(0.820, 0.290, 0.060);
    vec3 k3 = vec3(1.000, 0.620, 0.180);
    vec3 k4 = vec3(1.000, 0.900, 0.620);
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.22, l));
    grad = mix(grad, k2, smoothstep(0.18, 0.50, l));
    grad = mix(grad, k3, smoothstep(0.45, 0.78, l));
    grad = mix(grad, k4, smoothstep(0.75, 1.00, l));
    vec3 keep = mix(vec3(l), c, 0.35) * vec3(1.10, 0.85, 0.65);
    vec3 g = mix(keep, grad, 0.72);
    // hold the original luminance so shadows are black-red but not murky
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.70);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
