#version 300 es
// category: Color
// desc: Evergreen: shadows go deep spruce blue-green, mids a quiet desaturated pine, highlights pale mist white, soft and calm
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
    // three-stop gradient: deep spruce -> muted pine green-blue -> pale mist
    vec3 spruce = vec3(0.020, 0.058, 0.060);
    vec3 pine = vec3(0.34, 0.52, 0.48);
    vec3 mist = vec3(0.90, 0.96, 0.94);
    vec3 grad = l < 0.5 ? mix(spruce, pine, smoothstep(0.0, 0.5, l)) : mix(pine, mist, smoothstep(0.5, 1.0, l));
    float gl = max(luma(grad), 0.001);
    grad = clamp(grad * (l / gl), 0.0, 1.0);                 // keep luminance: text contrast untouched
    c = mix(c, grad, 0.78);
    c = mix(c, c * vec3(0.96, 1.02, 1.03) + vec3(0.0, 0.006, 0.010), 0.5);   // a little of the original life survives in the mids
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
