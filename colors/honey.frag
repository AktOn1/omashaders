#version 300 es
// category: Color
// desc: Honey: shadows go warm brown, mids amber honey, highlights creamy sunlit white, soft and low contrast
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
    // three-stop gradient: warm walnut -> amber honey -> creamy sun
    vec3 walnut = vec3(0.075, 0.045, 0.025);
    vec3 honey = vec3(0.80, 0.55, 0.24);
    vec3 cream = vec3(1.0, 0.92, 0.74);
    vec3 grad = l < 0.5 ? mix(walnut, honey, smoothstep(0.0, 0.5, l)) : mix(honey, cream, smoothstep(0.5, 1.0, l));
    float gl = max(luma(grad), 0.001);
    grad = clamp(grad * (l / gl), 0.0, 1.0);                 // keep luminance: text contrast untouched
    c = mix(c, grad, 0.78);
    c = mix(c, c * vec3(1.05, 1.0, 0.88) + vec3(0.010, 0.006, 0.0), 0.5);   // a little life survives in the mids
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
