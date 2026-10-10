#version 300 es
// category: Color
// desc: Hot cocoa: shadows go deep espresso, mids warm caramel brown, highlights soft cream
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
    // three-stop gradient: espresso -> caramel -> cream
    vec3 dark = vec3(0.045, 0.026, 0.020);
    vec3 mid = vec3(0.62, 0.40, 0.25);
    vec3 cream = vec3(1.0, 0.93, 0.80);
    vec3 grad = l < 0.5 ? mix(dark, mid, smoothstep(0.0, 0.5, l)) : mix(mid, cream, smoothstep(0.45, 1.0, l));
    // keep the original luminance so text contrast is untouched
    float gl = max(luma(grad), 0.001);
    grad = clamp(grad * (l / gl), 0.0, 1.0);
    c = mix(c, grad, 0.80);
    // a little of the original colour survives, warmed
    c = mix(c, c * vec3(1.05, 1.0, 0.90) + vec3(0.012, 0.006, 0.0), 0.5);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
