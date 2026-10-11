#version 300 es
// category: Color
// desc: Hex purple: violet shadows, plum mid tones and pale lilac lights with a touch of acid green kept in the brightest greens; a witch's-brew grade, luminance held so text stays readable
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
    vec3 k0 = vec3(0.060, 0.025, 0.130);
    vec3 k1 = vec3(0.32, 0.16, 0.50);
    vec3 k2 = vec3(0.72, 0.58, 0.84);
    vec3 k3 = vec3(0.97, 0.94, 1.00);
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.38, l));
    grad = mix(grad, k2, smoothstep(0.34, 0.74, l));
    grad = mix(grad, k3, smoothstep(0.70, 1.00, l));
    vec3 keep = mix(vec3(l), c, 0.30) * vec3(1.00, 0.97, 1.03);
    vec3 g = mix(keep, grad, 0.74);
    // hold the original luminance so contrast and text legibility are unchanged
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.75);
    // acid-green accent: saturated, bright greens in the picture keep (and gain) their green
    float gr = clamp((c.g - max(c.r, c.b)) * 3.0, 0.0, 1.0) * smoothstep(0.25, 0.65, c.g);
    g = mix(g, vec3(0.50, 1.0, 0.25) * (0.35 + 0.65 * l) + g * 0.2, gr * 0.75);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
