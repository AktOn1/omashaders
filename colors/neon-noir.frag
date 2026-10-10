#version 300 es
// category: Color
// desc: Neon noir: shadows go deep indigo, mid tones lean magenta, highlights glow cyan; the brightness curve is kept so text stays readable
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
    vec3 shadow = vec3(0.02, 0.01, 0.07);
    vec3 mid = vec3(0.62, 0.12, 0.55);
    vec3 high = vec3(0.45, 0.95, 1.0);
    vec3 grad = l < 0.5 ? mix(shadow, mid, smoothstep(0.0, 0.5, l)) : mix(mid, high, smoothstep(0.5, 1.0, l));
    // push white-ish text toward cool white so it stays crisp against the magenta
    grad = mix(grad, vec3(0.88, 0.97, 1.0), smoothstep(0.82, 1.0, l) * 0.6);
    vec3 keep = mix(vec3(l), c, 0.4);
    c = mix(keep * vec3(0.9, 0.8, 1.15), grad, 0.7);
    // neon bloom on strongly coloured pixels
    float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
    c += vec3(0.10, 0.0, 0.10) * sat * smoothstep(0.15, 0.6, l);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
