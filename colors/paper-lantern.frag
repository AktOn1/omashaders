#version 300 es
// category: Color
// desc: Paper lantern night: shadows turn deep indigo, mid tones warm apricot-rose, highlights soft lantern cream; brightness is kept so text stays readable
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
    vec3 shadow = vec3(0.045, 0.060, 0.190);  // night-sky indigo
    vec3 mid = vec3(0.78, 0.50, 0.40);        // warm apricot-rose
    vec3 high = vec3(1.0, 0.93, 0.74);        // lantern cream
    vec3 grad = l < 0.5 ? mix(shadow, mid, smoothstep(0.0, 0.5, l)) : mix(mid, high, smoothstep(0.5, 1.0, l));
    float gl = max(luma(grad), 0.001);
    grad = clamp(grad * (l / gl), 0.0, 1.0);
    // original hue stays faintly, so images keep some life
    vec3 soft = mix(vec3(l), c, 0.55) * vec3(1.03, 0.97, 0.96);
    c = mix(soft, grad, 0.70);
    // split toning: the darkest areas lean indigo-blue, the bright ones a touch gold
    c += vec3(0.004, 0.006, 0.030) * (1.0 - smoothstep(0.0, 0.3, l));
    c += vec3(0.030, 0.014, -0.006) * smoothstep(0.6, 1.0, l);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
