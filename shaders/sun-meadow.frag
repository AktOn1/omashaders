#version 300 es
// category: Ambient
// desc: Sun meadow: warm spring light over the whole screen: a golden highlight lift in the top-right corner, soft green-tinted shadows, a gentle cream wash on the bright parts and a light vignette. The centre stays sharp and untouched, so text reads clearly (static, no animation)
// strength: 55
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float sm_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
    vec2 uv = v_texcoord;
    vec2 sz = vec2(textureSize(tex, 0));
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float l = sm_luma(c);
    float ar = sz.x / sz.y;

    // soft shadows lean fresh green, not grey: lift the dark end a touch into a leafy tone
    float shadow = 1.0 - smoothstep(0.02, 0.45, l);
    c = mix(c, c * vec3(0.78, 1.10, 0.74) + vec3(0.004, 0.026, 0.008), shadow * 0.85);

    // light from the top-right: a golden pool that fades towards the centre, nothing in the middle
    vec2 q = (uv - vec2(0.97, 0.03)) * vec2(ar, 1.0);
    float sun = exp(-dot(q, q) / 0.55);
    float pool = sun;
    vec3 gold = vec3(1.00, 0.83, 0.46);
    c += gold * pool * 0.34 * (0.35 + 0.65 * l);
    c = mix(c, c * vec3(1.14, 1.04, 0.80), pool * 0.75);

    // a faint warm cream on the highlights
    c = mix(c, c * vec3(1.03, 1.01, 0.95), smoothstep(0.55, 1.0, l) * 0.5);

    // a light vignette, deep leaf green rather than black; the centre is left alone
    vec2 v = (uv - 0.5) * vec2(ar, 1.0);
    float vig = smoothstep(0.50, 1.20, length(v));
    c = mix(c, c * 0.80 * vec3(0.92, 1.02, 0.90) + vec3(0.002, 0.010, 0.003), vig * 0.80);

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
