#version 300 es
// category: Color
// desc: Pop primary: flat, punchy primaries; colours are pulled toward pure red, yellow and blue, saturation is pushed and tones are stepped like printed ink, while the original luminance is kept so text stays crisp
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
    // punchier saturation
    vec3 sat = clamp(vec3(l) + (c - vec3(l)) * 1.55, 0.0, 1.0);
    float chroma = max(max(sat.r, sat.g), sat.b) - min(min(sat.r, sat.g), sat.b);
    // the nearest pure ink: red, yellow or blue
    vec3 red = vec3(0.93, 0.11, 0.14);
    vec3 yel = vec3(1.00, 0.84, 0.05);
    vec3 blu = vec3(0.07, 0.30, 0.86);
    float dr = distance(sat, red);
    float dy = distance(sat, yel);
    float db = distance(sat, blu);
    vec3 ink = red;
    float dm = dr;
    if (dy < dm) { ink = yel; dm = dy; }
    if (db < dm) { ink = blu; dm = db; }
    // coloured pixels are pulled toward their ink, greys are left alone
    vec3 g = mix(sat, ink, 0.34 * smoothstep(0.08, 0.45, chroma));
    // step the tones like printed flat colour, lightly
    g = mix(g, floor(g * 6.0 + 0.5) / 6.0, 0.22);
    // a touch of newsprint warmth in the lights
    g = mix(g, g * vec3(1.03, 1.00, 0.93), smoothstep(0.6, 1.0, l));
    // hold the original luminance so contrast and text legibility are unchanged
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.75);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
