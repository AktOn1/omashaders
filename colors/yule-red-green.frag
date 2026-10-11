#version 300 es
// category: Color
// desc: Yule red and green: other colours settle into deep midnight blue while reds and fir greens keep (and gain) a rich, warm glow; a Christmas Eve grade
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
    // base: luminance toned in deep blue (shadows indigo, lights pale ice)
    vec3 deep = vec3(0.04, 0.07, 0.20);
    vec3 mid = vec3(0.35, 0.50, 0.85);
    vec3 pale = vec3(0.92, 0.96, 1.00);
    vec3 base = mix(deep, mid, smoothstep(0.00, 0.50, l));
    base = mix(base, pale, smoothstep(0.45, 1.00, l));
    // how red and how green the pixel is
    float red = clamp((c.r - max(c.g, c.b)) * 3.0, 0.0, 1.0);
    float grn = clamp((c.g - max(c.r, c.b * 0.8)) * 3.0, 0.0, 1.0);
    vec3 redC = c * vec3(1.18, 0.78, 0.74);
    vec3 grnC = c * vec3(0.72, 1.12, 0.82);
    vec3 g = mix(vec3(l), c, 0.20) * 0.35 + base * 0.65;
    g = mix(g, redC, red * 0.85);
    g = mix(g, grnC, grn * 0.85);
    // hold the original luminance so contrast and text legibility are unchanged
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.75);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
