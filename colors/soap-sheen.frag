#version 300 es
// category: Comfort
// desc: Soap sheen: a clean, slightly cool grade with lifted blacks, a faint pearl-blue in the shadows and a touch of warmth kept in the highlights; low contrast, nothing crushed, text stays crisp
// strength: 60
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float sh_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = sh_luma(c);

    // lifted blacks: the darkest parts rise off zero into a cool pearl grey, like light through a film
    vec3 lift = vec3(0.034, 0.042, 0.058);
    vec3 g = lift + c * (1.0 - lift);

    // split tone: pearl-blue in the shadows, a hint of straw left in the highlights
    float shad = 1.0 - smoothstep(0.00, 0.46, l);
    float high = smoothstep(0.58, 1.00, l);
    g += vec3(-0.012, 0.004, 0.028) * shad;
    g += vec3(0.020, 0.012, -0.006) * high;

    // clean, a little more colour in the mid tones, nothing pushed
    float mids = 1.0 - abs(l - 0.5) * 2.0;
    float gl = sh_luma(g);
    g = mix(vec3(gl), g, 1.0 + 0.16 * max(mids, 0.0));

    // very gentle S-curve so the lift does not make it flat
    g = clamp(g, 0.0, 1.0);
    g = mix(g, g * g * (3.0 - 2.0 * g), 0.14);

    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
