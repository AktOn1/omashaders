#version 300 es
// category: Color
// desc: Sodium pink: warm pink-orange street-lamp lights over deep indigo shadows, a late-night rooftop grade
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
    vec3 k0 = vec3(0.02, 0.01, 0.07);                    // ink indigo
    vec3 k1 = vec3(0.17, 0.10, 0.36);                    // indigo mid
    vec3 k2 = vec3(0.92, 0.38, 0.40);                    // hot sodium pink
    vec3 k3 = vec3(1.00, 0.80, 0.58);                    // warm lamp peach
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.34, l));
    grad = mix(grad, k2, smoothstep(0.30, 0.70, l));
    grad = mix(grad, k3, smoothstep(0.68, 1.00, l));
    vec3 keep = mix(vec3(l), c, 0.35);
    vec3 g = mix(keep, grad, 0.72);
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.68);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
