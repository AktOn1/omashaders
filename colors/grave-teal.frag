#version 300 es
// category: Color
// desc: Grave teal: blue-black shadows with a green-teal cast, cold grey-teal mid tones and bone-white highlights; a graveyard-night grade that holds contrast so text stays crisp
// strength: 60
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    vec3 k0 = vec3(0.010, 0.028, 0.034);       // blue-black teal
    vec3 k1 = vec3(0.130, 0.270, 0.290);       // deep grave teal
    vec3 k2 = vec3(0.560, 0.700, 0.700);       // cold grey-green mist
    vec3 k3 = vec3(0.940, 0.965, 0.940);       // bone white
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.35, l));
    grad = mix(grad, k2, smoothstep(0.30, 0.72, l));
    grad = mix(grad, k3, smoothstep(0.68, 1.00, l));
    // keep a faint trace of the original hue, cooled and desaturated
    vec3 keep = mix(vec3(l), c, 0.30) * vec3(0.90, 1.00, 1.00);
    vec3 g = mix(keep, grad, 0.74);
    // hold the original luminance so contrast and text legibility are unchanged
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.65);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
