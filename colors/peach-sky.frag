#version 300 es
// category: Color
// desc: Peach sky: airy pastel grade, shadows soft powder blue, mids warm peach, highlights creamy white that never glares
// strength: 50
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    // three-stop gradient: slate-blue shadow -> peach-powder mids -> cream
    vec3 blue = vec3(0.10, 0.14, 0.24);
    vec3 peach = vec3(0.88, 0.76, 0.72);
    vec3 cream = vec3(0.985, 0.955, 0.915);
    vec3 grad = l < 0.5 ? mix(blue, peach, smoothstep(0.0, 0.5, l)) : mix(peach, cream, smoothstep(0.5, 1.0, l));
    // keep the original luminance so text contrast is untouched
    float gl = max(luma(grad), 0.001);
    grad = clamp(grad * (l / gl), 0.0, 1.0);
    c = mix(c, grad, 0.60);
    // soften saturation a little (pastel) and leave the brightest whites slightly warm instead of pure white
    float ll = luma(c);
    c = mix(vec3(ll), c, 0.92);
    c = min(c, vec3(0.985, 0.968, 0.950));
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
