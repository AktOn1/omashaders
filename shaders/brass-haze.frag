#version 300 es
// category: Mood
// desc: Brass haze: a workshop glow, with the shadows tinted warm brass instead of black, a soft golden bloom around bright areas, a dim furnace light low in the frame and a gentle brown vignette (static)
// strength: 50
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float bh_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bh_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 bh_bright(vec2 uv) {
    vec3 c = texture(tex, uv).rgb;
    return c * smoothstep(0.45, 0.9, bh_luma(c));
}
void main() {
    vec2 uv = v_texcoord;
    vec2 size = vec2(textureSize(tex, 0));
    float asp = size.x / size.y;
    float S = STRENGTH;
    vec3 c = texture(tex, uv).rgb;
    float l = bh_luma(c);

    // soft glow: a wide ring of taps of the bright parts, golden
    vec3 b = vec3(0.0);
    for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.7853982;
        vec2 d = vec2(cos(a), sin(a)) * vec2(1.0 / asp, 1.0);
        b += bh_bright(uv + d * 0.014) + bh_bright(uv + d * 0.034);
    }
    b /= 16.0;
    // bright pixels get almost none (no blown-out light windows), the air around them lights up
    c += vec3(1.0, 0.80, 0.46) * bh_luma(b) * 0.38 * (1.0 - smoothstep(0.12, 0.55, l)) * S;

    // brass in the shadows: dark pixels get a warm bronze lift, lights are left alone
    float sh = 1.0 - smoothstep(0.0, 0.45, l);
    c = mix(c, c * 0.90 + vec3(0.10, 0.075, 0.032), sh * 0.95 * S);
    // a slight warmth overall
    c *= mix(vec3(1.0), vec3(1.05, 1.0, 0.90), 0.9 * S);

    // furnace light: a dim amber pool low in the lower left, very wide
    vec2 d = (uv - vec2(0.12, 0.98)) * vec2(asp, 1.0);
    c += vec3(1.0, 0.55, 0.20) * 0.13 * exp(-dot(d, d) * 1.6) * S;

    // brown vignette
    float e = pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.5);
    c = mix(c, c * vec3(0.78, 0.66, 0.52), clamp(e * 0.55, 0.0, 0.5) * S);

    // fine soot grain
    float g = bh_hash(floor(uv * size) + 0.5) - 0.5;
    c += vec3(1.0, 0.9, 0.7) * g * 0.016 * S;

    fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
