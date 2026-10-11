#version 300 es
// category: Comfort
// desc: Desk calm: soft neutral greys with a faint warmth, lightly gathered contrast so text and lines stay crisp and the eye rests
// strength: 50
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    // gentle S-curve on the luminance: darks a touch deeper, lights a touch cleaner
    float sc = l + 0.16 * (l - 0.5) * (1.0 - abs(2.0 * l - 1.0)) * 2.0 / 1.0;
    sc = clamp(sc, 0.0, 1.0);
    vec3 n = mix(vec3(l), c, 0.80);                     // desaturate a little
    n *= sc / max(l, 0.001);
    // soft warmth: shadows very slightly cool-neutral, lights slightly warm
    vec3 warm = mix(vec3(0.985, 0.985, 1.0), vec3(1.015, 1.0, 0.96), smoothstep(0.2, 0.9, l));
    n *= warm;
    fragColor = vec4(clamp(n, 0.0, 1.0), s.a);
}
