#version 300 es
// category: Comfort
// desc: Pale peach: grey-blue shadows, pale peach mid tones and cream lights; a soft dawn grade that keeps text contrast
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
    // grey-blue shadows -> pale peach-grey mids -> cream peach lights
    vec3 k0 = vec3(0.10, 0.12, 0.17);
    vec3 k1 = vec3(0.50, 0.53, 0.62);
    vec3 k2 = vec3(0.90, 0.80, 0.74);
    vec3 k3 = vec3(0.99, 0.95, 0.90);
    vec3 grad = mix(k0, k1, smoothstep(0.0, 0.40, l));
    grad = mix(grad, k2, smoothstep(0.35, 0.78, l));
    grad = mix(grad, k3, smoothstep(0.75, 1.0, l));
    float gl = max(luma(grad), 0.001);
    grad = clamp(grad * (l / gl), 0.0, 1.0);
    vec3 g = mix(c, grad, 0.60);
    float gg = luma(g);
    g = mix(vec3(gg), g, 0.88);
    g = min(g, vec3(0.99, 0.975, 0.955));
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
