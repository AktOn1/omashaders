#version 300 es
// category: Color
// desc: Gaslight: black-and-white noir film stock, shadows crushed to blue-black, mid tones almost neutral, highlights pushed to warm tungsten amber; luminance kept so text stays readable
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
    // a gentle S-curve: deeper blacks, bright whites, like a high-contrast stock
    float lc = mix(l, l * l * (3.0 - 2.0 * l), 0.35);
    vec3 shadow = vec3(0.012, 0.022, 0.050);
    vec3 mid = vec3(0.50, 0.51, 0.52);
    vec3 high = vec3(1.0, 0.84, 0.58);
    vec3 grad = lc < 0.5 ? mix(shadow, mid, smoothstep(0.0, 0.5, lc) * 0.5 + lc)
                         : mix(mid, high, smoothstep(0.45, 1.0, lc));
    // keep luminance exactly where the picture had it, so text keeps its contrast
    grad *= (lc + 0.001) / (luma(grad) + 0.001);
    // a trace of the original colour survives, otherwise it would be a pure grade
    vec3 keep = mix(vec3(l), c, 0.12);
    c = mix(keep, grad, 0.90);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
