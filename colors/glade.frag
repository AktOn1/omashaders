#version 300 es
// category: Color
// desc: Sunlit glade: shadows go deep moss green, mids warm leaf green, highlights buttery cream-gold
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
    // three-stop gradient: deep moss -> warm leaf green -> buttery sunlit cream
    vec3 moss = vec3(0.025, 0.075, 0.035);
    vec3 leaf = vec3(0.50, 0.66, 0.24);
    vec3 cream = vec3(1.0, 0.95, 0.68);
    vec3 grad = l < 0.5 ? mix(moss, leaf, smoothstep(0.0, 0.5, l)) : mix(leaf, cream, smoothstep(0.5, 1.0, l));
    // keep the original luminance so text contrast is untouched
    float gl = max(luma(grad), 0.001);
    grad = clamp(grad * (l / gl), 0.0, 1.0);
    c = mix(c, grad, 0.82);
    // a little of the original colour survives in the mids, so images keep some life
    c = mix(c, c * vec3(1.04, 1.02, 0.90) + vec3(0.012, 0.012, 0.0), 0.5);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
