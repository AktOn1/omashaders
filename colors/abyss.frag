#version 300 es
// category: Color
// desc: Abyss: shadows sink to blue-black, mid tones go teal, highlights glow cyan-white; contrast kept so text stays readable
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
    vec3 shadow = vec3(0.005, 0.025, 0.07);
    vec3 mid = vec3(0.05, 0.42, 0.50);
    vec3 high = vec3(0.72, 1.0, 0.98);
    vec3 grad = l < 0.5 ? mix(shadow, mid, smoothstep(0.0, 0.5, l)) : mix(mid, high, smoothstep(0.5, 1.0, l));
    // keep a little of the original hue so reds and yellows do not vanish completely
    vec3 keep = mix(vec3(l), c, 0.35);
    c = mix(keep * vec3(0.7, 0.95, 1.1), grad, 0.72);
    // faint bioluminescent lift on the saturated parts
    float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
    c += vec3(0.0, 0.10, 0.12) * sat * smoothstep(0.2, 0.7, l);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
