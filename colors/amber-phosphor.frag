#version 300 es
// category: Retro
// desc: Amber phosphor: P3-style tube colour, deep brown-black shadows with a faint green undertone, rich amber mids and pale white-amber highlights, a hint of colour contrast kept
// strength: 70
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// five-stop ramp: shadow, low mid, mid, high, white point
vec3 ap5(float t, vec3 a, vec3 b, vec3 c, vec3 d, vec3 e) {
    t = clamp(t, 0.0, 1.0) * 4.0;
    if (t < 1.0) return mix(a, b, t);
    if (t < 2.0) return mix(b, c, t - 1.0);
    if (t < 3.0) return mix(c, d, t - 2.0);
    return mix(d, e, t - 3.0);
}
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float mx = max(c.r, max(c.g, c.b));
    float l = luma(c);
    l = mix(l, mx, 0.18);                     // saturated colours stay brighter than their luma: some colour contrast survives
    l = pow(clamp(l, 0.0, 1.0), 0.95);        // lift the mids a touch so text stays legible
    vec3 g = ap5(l,
        vec3(0.030, 0.026, 0.008),            // brown-black with the green cast of old P3
        vec3(0.190, 0.112, 0.010),
        vec3(0.800, 0.440, 0.040),            // rich amber
        vec3(1.000, 0.760, 0.340),
        vec3(1.000, 0.930, 0.740));           // pale white-amber
    // a few percent of the original hue leaks through, so a red alert or a green OK still reads
    vec3 hue = c / max(mx, 0.001);
    g = mix(g, g * (0.75 + 0.5 * hue), 0.15 * smoothstep(0.1, 0.5, mx));
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
