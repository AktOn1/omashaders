#version 300 es
// category: Color
// desc: Sandstone: shadows turn warm umber, mid tones ochre, highlights cream gold; contrast kept so text stays readable
// strength: 80
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    vec3 shadow = vec3(0.045, 0.020, 0.012);
    vec3 mid = vec3(0.78, 0.46, 0.17);
    vec3 high = vec3(1.0, 0.90, 0.68);
    vec3 grad = l < 0.5 ? mix(shadow, mid, smoothstep(0.0, 0.5, l) * 1.0) : mix(mid, high, smoothstep(0.5, 1.0, l));
    // keep some of the original hue (warm-shifted) so reds and greens stay distinguishable
    vec3 keep = mix(vec3(l), c, 0.45) * vec3(1.10, 0.96, 0.78);
    c = mix(keep, grad, 0.68);
    // golden sheen on the bright, saturated parts
    float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
    c += vec3(0.10, 0.055, 0.0) * sat * smoothstep(0.3, 0.8, l);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
