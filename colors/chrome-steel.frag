#version 300 es
// category: Color
// desc: Chrome steel: a cool machined grade, shadows gun-metal blue, mid tones brushed slate, highlights polished white with a faint cyan edge; colour is pulled well back and contrast pushed hard but cleanly, so text stays sharp
// strength: 70
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float cs_lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = cs_lum(c);

    // pull the colour back: steel keeps only a memory of the hue
    vec3 grey = vec3(l);
    vec3 d = mix(grey, c, 0.20);

    // a clean S-curve: deeper shadows, brighter highlights, mid tones untouched in the middle
    float k = clamp(l, 0.0, 1.0);
    float sC = k * k * (3.0 - 2.0 * k);
    float lc = clamp(mix(k, sC, 0.72) * 1.05 - 0.015, 0.0, 1.0);

    // the steel ramp
    vec3 k0 = vec3(0.030, 0.040, 0.062);     // gun metal in the shadows
    vec3 k1 = vec3(0.232, 0.272, 0.332);     // brushed slate
    vec3 k2 = vec3(0.618, 0.672, 0.742);     // polished chrome
    vec3 k3 = vec3(0.975, 0.990, 1.000);     // a white highlight with a cyan edge
    vec3 ramp = mix(k0, k1, smoothstep(0.00, 0.34, lc));
    ramp = mix(ramp, k2, smoothstep(0.30, 0.74, lc));
    ramp = mix(ramp, k3, smoothstep(0.72, 1.00, lc));

    // re-apply the kept hue on top of the ramp, cooled a touch
    float dl = max(cs_lum(d), 0.001);
    vec3 hue = d / dl;
    hue = mix(vec3(1.0), hue, 0.34) * vec3(0.945, 0.990, 1.085);
    vec3 outc = ramp * hue;

    fragColor = vec4(clamp(outc, 0.0, 1.0), s.a);
}
