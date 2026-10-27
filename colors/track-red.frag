#version 300 es
// category: Color
// desc: Track red: a contrasty race-day grade. Blacks settle into asphalt grey, mid tones get a firm S-curve, reds turn saturated and bright, whites run slightly cool, and greens and blues are muted so the signal red and amber stand out
// strength: 60
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    // firm S-curve contrast
    vec3 sc = c * c * (3.0 - 2.0 * c);
    vec3 g = mix(c, sc, 0.65);
    float l = luma(g);
    // reds and warm oranges: saturated and bright; greens and blues: muted
    float warm = clamp((c.r - max(c.g * 0.85, c.b)) * 3.0, 0.0, 1.0);
    float cool = clamp((max(c.g, c.b) - c.r) * 2.5, 0.0, 1.0);
    float satk = 1.0 + 0.55 * warm - 0.50 * cool;
    g = clamp(vec3(l) + (g - vec3(l)) * satk, 0.0, 1.0);
    g = mix(g, min(g * vec3(1.16, 0.96, 0.94), vec3(1.0)), warm * 0.55);
    // asphalt-grey blacks, slightly cool whites
    g = g * 0.94 + vec3(0.050, 0.050, 0.056);
    g *= mix(vec3(1.0), vec3(0.97, 0.99, 1.04), smoothstep(0.72, 1.0, l));
    float lumg = max(luma(g), 0.001);
    g = mix(g, clamp(g * (luma(mix(c, sc, 0.65)) * 0.94 + 0.052) / lumg, 0.0, 1.0), 0.25);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
