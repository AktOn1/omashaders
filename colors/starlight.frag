#version 300 es
// category: Color
// desc: Starlight: shadows sink to deep indigo-black, mid tones go slate blue, highlights turn cold silver-white with a trace of brass in the brightest bits; contrast kept so text stays readable
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
    vec3 shadow = vec3(0.012, 0.012, 0.055);
    vec3 mid = vec3(0.26, 0.34, 0.58);
    vec3 high = vec3(0.86, 0.91, 1.0);
    vec3 grad = l < 0.4 ? mix(shadow, mid, smoothstep(0.0, 0.4, l)) : mix(mid, high, smoothstep(0.4, 0.9, l));
    // brass: only the very brightest pixels pick up a hint of old gold
    grad += vec3(0.075, 0.050, -0.020) * smoothstep(0.88, 1.0, l);
    // keep a little of the original hue so reds and yellows do not vanish completely
    vec3 keep = mix(vec3(l), c, 0.35);
    c = mix(keep * vec3(0.78, 0.86, 1.12), grad, 0.72);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
