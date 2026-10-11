#version 300 es
// category: Color
// desc: Coin-op: saturated arcade primaries on deep blue-black; brightness is held, so white text and UI stay crisp and readable
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
    // push every channel apart so reds, yellows, greens and blues turn into pure cabinet primaries
    vec3 sat = mix(vec3(l), c, 1.55);
    vec3 pr = clamp(sat, 0.0, 1.0);
    pr = pr * pr * (3.0 - 2.0 * pr);
    vec3 g = mix(sat, pr, 0.55);
    // the darkest tones sink to a deep blue-black rather than grey
    vec3 void_ = vec3(0.010, 0.014, 0.075);
    g = mix(void_, g, smoothstep(0.0, 0.20, l) * 0.78 + 0.22);
    // hold the original luminance so contrast and text legibility are unchanged
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.75);
    // near-white stays white
    g = mix(g, vec3(l), smoothstep(0.82, 1.0, l) * 0.8);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
