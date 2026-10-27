#version 300 es
// category: Color
// desc: Solder mint: shadows sink into board green-black, mid tones turn a muted solder-mask green, highlights go warm copper-gold white and reds slide to amber, like a picture printed on a circuit board with a little of its own colour kept
// strength: 60
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    // reds lean to amber before the ramp is applied
    float red = max(c.r - max(c.g, c.b), 0.0);
    c = vec3(c.r - red * 0.10, c.g + red * 0.55, c.b - red * 0.25);
    float l = luma(c);
    vec3 k0 = vec3(0.008, 0.030, 0.020);
    vec3 k1 = vec3(0.060, 0.230, 0.140);
    vec3 k2 = vec3(0.300, 0.540, 0.360);
    vec3 k3 = vec3(0.900, 0.760, 0.480);
    vec3 k4 = vec3(1.000, 0.940, 0.780);
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.30, l));
    grad = mix(grad, k2, smoothstep(0.28, 0.62, l));
    grad = mix(grad, k3, smoothstep(0.58, 0.86, l));
    grad = mix(grad, k4, smoothstep(0.84, 1.00, l));
    vec3 keep = mix(vec3(l), c, 0.32);
    vec3 g = mix(keep, grad, 0.72);
    float lumg = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / lumg), 0.0, 1.0), 0.40);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
