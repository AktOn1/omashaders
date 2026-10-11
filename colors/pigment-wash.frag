#version 300 es
// category: Color
// desc: Pigment wash: blacks lifted to a warm paper grey-brown, colours become light translucent pastels with a touch of rose in the mid tones and cream in the highlights; text stays readable
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
    vec3 k0 = vec3(0.115, 0.105, 0.135);       // dusty violet-grey instead of black
    vec3 k1 = vec3(0.470, 0.400, 0.470);       // faded rose-mauve
    vec3 k2 = vec3(0.820, 0.740, 0.700);       // warm peach paper
    vec3 k3 = vec3(0.985, 0.965, 0.920);       // cream paper white
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.40, l));
    grad = mix(grad, k2, smoothstep(0.35, 0.75, l));
    grad = mix(grad, k3, smoothstep(0.72, 1.00, l));
    // keep the hue but wash it out: lighter, a little less saturated
    vec3 pastel = mix(vec3(l), c, 0.78);
    pastel = pastel * 0.92 + 0.05;
    vec3 g = mix(pastel, grad, 0.45);
    // hold the original luminance so text contrast is unchanged
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.70);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
