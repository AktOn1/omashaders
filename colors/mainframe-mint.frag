#version 300 es
// category: Retro
// desc: Mainframe mint: near black-green shadows, a bright phosphor green in the mid tones and pale mint-white highlights; a green-screen look that keeps the whole tonal range, so syntax colours still read as different brightness
// strength: 65
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    float lp = pow(l, 0.82);
    vec3 k0 = vec3(0.006, 0.022, 0.012);       // tube black
    vec3 k1 = vec3(0.040, 0.250, 0.110);       // deep phosphor
    vec3 k2 = vec3(0.350, 0.920, 0.480);       // bright P39 green
    vec3 k3 = vec3(0.860, 1.000, 0.890);       // overdriven mint white
    vec3 g = mix(k0, k1, smoothstep(0.00, 0.30, lp));
    g = mix(g, k2, smoothstep(0.25, 0.70, lp));
    g = mix(g, k3, smoothstep(0.72, 1.00, lp));
    // a touch of the original hue survives so red errors and blue links are not lost completely
    g = mix(g, g * (0.75 + 0.5 * c / max(l, 0.05)), 0.12);
    // hold the original luminance so contrast and text legibility are unchanged (dark text on a light window stays dark)
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.60);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
