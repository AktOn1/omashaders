#version 300 es
// category: Comfort
// desc: Indigo rime: shadows lifted to a soft indigo haze instead of black, mid tones cool pewter, highlights pale silver with a trace of ice blue; a low-contrast moonlit grade that keeps colours readable and never crushes the dark parts
// strength: 60
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float ir_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = ir_luma(c);

    // the ramp: lifted indigo -> pewter -> silver -> ice white
    vec3 k0 = vec3(0.090, 0.098, 0.175);     // lifted shadow, never pure black
    vec3 k1 = vec3(0.285, 0.325, 0.445);     // cool pewter
    vec3 k2 = vec3(0.620, 0.680, 0.790);     // silver
    vec3 k3 = vec3(0.945, 0.965, 1.000);     // moon white with a hint of ice
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.33, l));
    grad = mix(grad, k2, smoothstep(0.30, 0.70, l));
    grad = mix(grad, k3, smoothstep(0.66, 1.00, l));

    // keep a good share of the real hues, pushed toward silver-indigo
    vec3 keep = mix(vec3(l), c, 0.34);
    keep *= mix(vec3(0.86, 0.92, 1.18), vec3(1.00, 1.00, 1.06), smoothstep(0.25, 0.80, l));
    vec3 g = mix(keep, grad, 0.66);

    // lift the floor a little more (shadows stay open) and soften the top end
    g = g * 0.93 + vec3(0.030, 0.034, 0.058) * (1.0 - smoothstep(0.0, 0.55, l));

    // hold the original luminance ordering so contrast and text legibility survive
    float gl = max(ir_luma(g), 0.001);
    g = mix(g, g * (mix(l, 0.10 + l * 0.90, 0.5) / gl), 0.60);

    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
