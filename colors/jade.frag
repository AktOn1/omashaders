#version 300 es
// category: Color
// desc: Jade pond: shadows sink to deep pond green, mid tones turn soft jade, highlights stay pale celadon; brightness is kept so text stays readable
// strength: 65
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    vec3 deep = vec3(0.030, 0.085, 0.075);    // dark pond water, a little lifted
    vec3 mid = vec3(0.34, 0.62, 0.52);        // jade
    vec3 high = vec3(0.90, 1.0, 0.90);        // pale celadon
    vec3 grad = l < 0.5 ? mix(deep, mid, smoothstep(0.0, 0.5, l)) : mix(mid, high, smoothstep(0.5, 1.0, l));
    // keep the original luminance so text contrast is untouched
    float gl = max(luma(grad), 0.001);
    grad = clamp(grad * (l / gl), 0.0, 1.0);
    // a little of the original hue survives (softened), so pictures and syntax colours stay apart
    vec3 soft = mix(vec3(l), c, 0.6) * vec3(0.94, 1.02, 0.98);
    c = mix(soft, grad, 0.72);
    // dark water is never pure black: a hint of green in the deepest shadows
    c += vec3(0.004, 0.016, 0.013) * (1.0 - smoothstep(0.0, 0.25, l));
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
