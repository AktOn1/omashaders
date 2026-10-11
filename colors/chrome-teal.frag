#version 300 es
// category: Color
// desc: Chrome teal: a crisp teal and magenta split-tone, cold teal shadows, warm magenta highlights, a little extra snap and saturation like rain-slick neon
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
    // split-tone: teal pushed into the shadows, magenta into the highlights
    vec3 shadowT = vec3(0.62, 1.02, 1.08);
    vec3 lightT = vec3(1.10, 0.90, 1.04);
    vec3 g = c * mix(shadowT, lightT, smoothstep(0.22, 0.78, l));
    g += vec3(-0.01, 0.025, 0.035) * (1.0 - smoothstep(0.0, 0.35, l));      // a lifted teal floor instead of dead black
    // crisp: a gentle S-curve and a touch more colour
    vec3 sc = g * g * (3.0 - 2.0 * g);
    g = mix(g, sc, 0.30);
    float gl0 = luma(g);
    g = mix(vec3(gl0), g, 1.14);
    // hold the original luminance so contrast and text legibility are unchanged
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.70);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
