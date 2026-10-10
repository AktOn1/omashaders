#version 300 es
// category: Color
// desc: Banked coals: shadows fall to burnt umber and red-black, mid tones glow ember orange-brown, highlights pale flame yellow; almost no blue, contrast kept so text stays readable
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
    vec3 shadow = vec3(0.050, 0.014, 0.008);
    vec3 low = vec3(0.30, 0.095, 0.035);
    vec3 mid = vec3(0.80, 0.37, 0.10);
    vec3 high = vec3(1.0, 0.88, 0.58);
    vec3 grad = mix(shadow, low, smoothstep(0.0, 0.22, l));
    grad = mix(grad, mid, smoothstep(0.18, 0.60, l));
    grad = mix(grad, high, smoothstep(0.55, 1.0, l));
    // keep a faint trace of the original hue (heavily warmed) so colours stay tellable apart
    vec3 keep = mix(vec3(l), c, 0.35) * vec3(1.12, 0.86, 0.42);
    c = mix(keep, grad, 0.72);
    // coals glow a little from within: lift the red in the mid tones
    c.r += 0.05 * smoothstep(0.1, 0.5, l) * (1.0 - smoothstep(0.5, 1.0, l));
    c.b *= 0.6;
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
