#version 300 es
// category: Color
// desc: Night ink: midnight-blue shadows, indigo-violet mid tones, pale periwinkle upper mids and silver-cream highlights, a cool star-chart grade that keeps a little of your picture's own colour
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
    vec3 k0 = vec3(0.010, 0.015, 0.060);
    vec3 k1 = vec3(0.120, 0.130, 0.360);
    vec3 k2 = vec3(0.520, 0.580, 0.880);
    vec3 k3 = vec3(0.970, 0.950, 0.900);
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.38, l));
    grad = mix(grad, k2, smoothstep(0.36, 0.76, l));
    grad = mix(grad, k3, smoothstep(0.78, 1.00, l));
    vec3 keep = mix(vec3(l), c, 0.30);
    vec3 g = mix(keep, grad, 0.75);
    float lumg = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / lumg), 0.0, 1.0), 0.45);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
