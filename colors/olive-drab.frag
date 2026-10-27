#version 300 es
// category: Color
// desc: Olive drab: near-black olive shadows, drab olive mid tones, khaki-tan upper mids and pale amber highlights, a flat field-gear grade that keeps a little of your picture's own colour
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
    vec3 k0 = vec3(0.020, 0.030, 0.012);
    vec3 k1 = vec3(0.230, 0.270, 0.110);
    vec3 k2 = vec3(0.640, 0.590, 0.400);
    vec3 k3 = vec3(1.000, 0.820, 0.470);
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.38, l));
    grad = mix(grad, k2, smoothstep(0.36, 0.76, l));
    grad = mix(grad, k3, smoothstep(0.78, 1.00, l));
    vec3 keep = mix(vec3(l), c, 0.30);
    vec3 g = mix(keep, grad, 0.75);
    float gl2 = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl2), 0.0, 1.0), 0.45);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
