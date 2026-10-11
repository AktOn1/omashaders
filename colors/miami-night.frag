#version 300 es
// category: Color
// desc: Miami night: deep violet shadows, hot pink mid-tones and cold cyan highlights, the colours of a neon boulevard after dark
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
    vec3 k0 = vec3(0.03, 0.00, 0.10);                    // night violet
    vec3 k1 = vec3(0.28, 0.06, 0.42);                    // deep purple
    vec3 k2 = vec3(1.00, 0.22, 0.62);                    // hot pink
    vec3 k3 = vec3(0.60, 0.96, 1.00);                    // ice cyan
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.30, l));
    grad = mix(grad, k2, smoothstep(0.26, 0.60, l));
    grad = mix(grad, k3, smoothstep(0.58, 0.98, l));
    vec3 keep = mix(vec3(l), c, 0.30);
    vec3 g = mix(keep, grad, 0.78);
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.70);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
