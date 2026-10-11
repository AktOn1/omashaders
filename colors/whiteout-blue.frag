#version 300 es
// category: Color
// desc: Whiteout blue: a cold blue-white wash, shadows lifted to slate blue, mid tones pale steel, highlights snow white; low contrast but luminance order is kept so text stays readable
// strength: 55
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    vec3 k0 = vec3(0.070, 0.105, 0.190);
    vec3 k1 = vec3(0.300, 0.400, 0.530);
    vec3 k2 = vec3(0.690, 0.780, 0.870);
    vec3 k3 = vec3(0.950, 0.975, 1.000);
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.35, l));
    grad = mix(grad, k2, smoothstep(0.30, 0.70, l));
    grad = mix(grad, k3, smoothstep(0.65, 1.00, l));
    // desaturate towards the grade but leave a trace of the original colour
    vec3 keep = mix(vec3(l), c, 0.40) * vec3(0.92, 0.98, 1.08);
    vec3 g = mix(keep, grad, 0.68);
    // a gentle haze: lift the blacks a touch, but never flatten (keeps a readable gap between text and background)
    g = mix(g, g * 0.94 + vec3(0.025, 0.035, 0.05), 0.8);
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l * 0.94 + 0.04) / gl, 0.0, 1.0), 0.6);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
