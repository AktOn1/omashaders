#version 300 es
// category: Color
// desc: Polar night: shadows sink to ink navy with a violet breath, mid tones go glacier teal, whites stay clean and skin tones keep their warmth
// strength: 80
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    // four-stop ramp: ink navy, aurora violet, glacier teal, ice white
    vec3 k0 = vec3(0.020, 0.035, 0.115);
    vec3 k1 = vec3(0.150, 0.130, 0.360);
    vec3 k2 = vec3(0.230, 0.560, 0.630);
    vec3 k3 = vec3(0.930, 0.975, 1.000);
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.28, l));
    grad = mix(grad, k2, smoothstep(0.22, 0.60, l));
    grad = mix(grad, k3, smoothstep(0.55, 1.00, l));
    // keep some of the original colour, cooled, so pictures do not go flat
    vec3 keep = mix(vec3(l), c, 0.55) * vec3(0.80, 0.94, 1.10);
    vec3 g = mix(keep, grad, 0.70);
    // skin-safe: warm, bright-ish pixels (skin, wood, candle light) are cooled much less
    float warm = smoothstep(0.03, 0.16, c.r - c.b) * smoothstep(0.12, 0.40, l);
    vec3 warmKeep = mix(vec3(l), c, 1.0) * vec3(0.98, 0.99, 1.03);
    g = mix(g, warmKeep, warm * 0.8);
    // clean white text: neutral bright pixels become ice white, not teal
    float neutral = (1.0 - smoothstep(0.05, 0.18, max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b)))) * smoothstep(0.78, 0.95, l);
    g = mix(g, vec3(0.96, 0.985, 1.0), neutral * 0.75);
    // faint aurora glint on saturated greens and blues
    float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
    g += vec3(0.0, 0.07, 0.05) * sat * smoothstep(0.2, 0.7, l) * (1.0 - warm);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
