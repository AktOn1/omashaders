#version 300 es
// category: Color
// desc: Pastel pink: the whole screen is soft milky pink; black turns dusty rose, lights become pink-white; no original hue is kept
// strength: 100
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 pinkRamp(float l) {
    vec3 k0 = vec3(0.85, 0.37, 0.58);
    vec3 k1 = vec3(0.94, 0.56, 0.72);
    vec3 k2 = vec3(0.98, 0.74, 0.84);
    vec3 k3 = vec3(0.99, 0.88, 0.93);
    vec3 k4 = vec3(1.00, 0.98, 0.99);
    vec3 g = k0;
    g = mix(g, k1, smoothstep(0.00, 0.30, l));
    g = mix(g, k2, smoothstep(0.30, 0.60, l));
    g = mix(g, k3, smoothstep(0.60, 0.85, l));
    g = mix(g, k4, smoothstep(0.85, 1.00, l));
    return g;
}
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 g = pinkRamp(pow(luma(s.rgb), 0.8));
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
