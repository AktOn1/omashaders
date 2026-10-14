#version 300 es
// category: Color
// desc: All pink: every colour on screen becomes a bright pink; even black turns hot raspberry pink (never dark), mid tones bubblegum, lights blush white; no original hue is kept, so the whole screen looks pink, text stays readable
// strength: 100
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 pinkRamp(float l) {
    vec3 k0 = vec3(0.76, 0.09, 0.43);
    vec3 k1 = vec3(0.93, 0.29, 0.59);
    vec3 k2 = vec3(1.00, 0.56, 0.77);
    vec3 k3 = vec3(1.00, 0.81, 0.90);
    vec3 k4 = vec3(1.00, 0.96, 0.98);
    vec3 g = k0;
    g = mix(g, k1, smoothstep(0.00, 0.20, l));
    g = mix(g, k2, smoothstep(0.20, 0.50, l));
    g = mix(g, k3, smoothstep(0.50, 0.80, l));
    g = mix(g, k4, smoothstep(0.80, 1.00, l));
    return g;
}
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 g = pinkRamp(pow(luma(s.rgb), 0.8));
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
