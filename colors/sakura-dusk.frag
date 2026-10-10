#version 300 es
// category: Color
// desc: Sakura dusk: shadows turn plum-violet, mid tones pastel rose-lavender, highlights soft cream-pink; brightness is kept so text stays readable
// strength: 70
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    vec3 shadow = vec3(0.13, 0.08, 0.24);   // plum-violet
    vec3 mid = vec3(0.80, 0.58, 0.82);      // rose-lavender
    vec3 high = vec3(1.0, 0.93, 0.95);      // cream pink
    vec3 grad = l < 0.5 ? mix(shadow, mid, smoothstep(0.0, 0.5, l)) : mix(mid, high, smoothstep(0.5, 1.0, l));
    // keep the original hues faintly (pastel-softened) so syntax colours and pictures stay distinguishable
    vec3 soft = mix(vec3(l), c, 0.55) * vec3(1.0, 0.92, 1.04) * 0.90 + vec3(0.06, 0.035, 0.08);
    c = mix(soft, grad, 0.55);
    // blossom lift on the brightest rose tones
    c += vec3(0.05, 0.0, 0.025) * smoothstep(0.3, 0.7, l) * (1.0 - smoothstep(0.7, 1.0, l));
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
