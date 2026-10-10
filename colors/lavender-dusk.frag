#version 300 es
// category: Color
// desc: Lavender dusk: shadows deep indigo-violet, mids soft lavender, highlights warm rose-cream, like the last light over a lavender field
// strength: 55
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    // three-stop gradient: indigo -> lavender -> rose cream
    vec3 indigo = vec3(0.075, 0.050, 0.170);
    vec3 lav = vec3(0.62, 0.52, 0.86);
    vec3 cream = vec3(1.0, 0.89, 0.88);
    vec3 grad = l < 0.5 ? mix(indigo, lav, smoothstep(0.0, 0.5, l)) : mix(lav, cream, smoothstep(0.5, 1.0, l));
    // keep the original luminance so text contrast is untouched
    float gl = max(luma(grad), 0.001);
    grad = clamp(grad * (l / gl), 0.0, 1.0);
    c = mix(c, grad, 0.72);
    // some of the original colour survives, with a faint rose warmth in the highlights
    c = mix(c, c * vec3(1.03, 0.98, 1.04), 0.5);
    c += vec3(0.020, 0.006, 0.012) * smoothstep(0.55, 1.0, l);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
