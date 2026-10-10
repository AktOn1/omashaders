#version 300 es
// category: Color
// desc: Aurora night: shadows deep blue-green, mid tones calm teal, highlights pale mint-white with a breath of violet in the darkest blues; contrast kept so text stays readable
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
    vec3 k0 = vec3(0.012, 0.035, 0.065);       // deep blue-green night
    vec3 k1 = vec3(0.060, 0.260, 0.300);       // lake teal
    vec3 k2 = vec3(0.420, 0.760, 0.640);       // aurora green
    vec3 k3 = vec3(0.900, 1.000, 0.960);       // pale mint white
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.30, l));
    grad = mix(grad, k2, smoothstep(0.25, 0.65, l));
    grad = mix(grad, k3, smoothstep(0.60, 1.00, l));
    // faint violet in the deepest areas that were blue to begin with
    grad += vec3(0.030, 0.000, 0.045) * (1.0 - smoothstep(0.0, 0.2, l)) * smoothstep(0.0, 0.2, c.b - c.g + 0.1);
    // keep some of the original colour, cooled, so pictures keep their life
    vec3 keep = mix(vec3(l), c, 0.5) * vec3(0.84, 1.00, 1.00);
    vec3 g = mix(keep, grad, 0.72);
    // luminance anchor so contrast (and text) stays as in the original
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.6);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
