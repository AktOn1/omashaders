#version 300 es
// category: Color
// desc: Indigo hush: shadows deep navy, mid tones cobalt-indigo, highlights pale periwinkle instead of white; a melancholy blue grade that keeps the original luminance so text stays crisp
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
    vec3 k0 = vec3(0.012, 0.020, 0.070);       // navy night
    vec3 k1 = vec3(0.085, 0.140, 0.340);       // cobalt indigo
    vec3 k2 = vec3(0.440, 0.540, 0.790);       // dusk periwinkle
    vec3 k3 = vec3(0.880, 0.920, 0.990);       // cold paper white
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.30, l));
    grad = mix(grad, k2, smoothstep(0.26, 0.70, l));
    grad = mix(grad, k3, smoothstep(0.68, 1.00, l));
    vec3 keep = mix(vec3(l), c, 0.22) * vec3(0.84, 0.93, 1.10);
    vec3 g = mix(keep, grad, 0.80);
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.60);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
