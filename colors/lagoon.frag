#version 300 es
// category: Color
// desc: Clear lagoon: shadows go deep sea teal, mids bright turquoise, highlights pale warm sand
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
    // three-stop gradient: deep teal -> turquoise -> pale sand
    vec3 deep = vec3(0.012, 0.075, 0.095);
    vec3 turq = vec3(0.30, 0.76, 0.76);
    vec3 sand = vec3(1.0, 0.95, 0.80);
    vec3 grad = l < 0.5 ? mix(deep, turq, smoothstep(0.0, 0.5, l)) : mix(turq, sand, smoothstep(0.45, 1.0, l));
    // keep the original luminance so text contrast is untouched
    float gl = max(luma(grad), 0.001);
    grad = clamp(grad * (l / gl), 0.0, 1.0);
    c = mix(c, grad, 0.80);
    // a little of the original colour survives, cooled toward the water
    c = mix(c, c * vec3(0.96, 1.03, 1.02) + vec3(0.0, 0.010, 0.012), 0.5);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
