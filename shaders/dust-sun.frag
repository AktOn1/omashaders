#version 300 es
// category: Mood
// desc: Dust sun: warm low-sun haze with a sepia bloom that spills from bright areas, a golden glow in one corner, dust-brown vignette and a faint dry grain (static, text stays sharp)
// strength: 55
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float ds_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ds_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// bright parts only: what is above the knee spills as light
vec3 ds_bright(vec2 uv) {
    vec3 c = texture(tex, uv).rgb;
    float k = smoothstep(0.6, 0.98, ds_luma(c));
    return c * k;
}
void main() {
    vec2 uv = v_texcoord;
    vec2 size = vec2(textureSize(tex, 0));
    float asp = size.x / size.y;
    float S = STRENGTH;
    vec3 c = texture(tex, uv).rgb;

    // sepia bloom: two rings of taps around the pixel, only the bright parts, tinted amber
    vec3 b = vec3(0.0);
    for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.7853982 + 0.3;
        vec2 d = vec2(cos(a), sin(a));
        b += ds_bright(uv + d * vec2(1.0 / asp, 1.0) * 0.010);
        b += ds_bright(uv + d * vec2(1.0 / asp, 1.0) * 0.024);
    }
    b /= 16.0;
    // it only fills in around bright shapes: pixels that are already bright get almost none, so light windows do not blow out
    float spill = 1.0 - smoothstep(0.12, 0.55, ds_luma(c));
    c += (vec3(1.0, 0.78, 0.46) * ds_luma(b) * 0.30 + b * vec3(0.25, 0.17, 0.09)) * spill * S;

    // late-afternoon light: warm the picture, lift the shadows into a dusty brown rather than black
    float l = ds_luma(c);
    c = mix(c, c * vec3(1.08, 0.97, 0.80), 0.85 * S);
    c = mix(c, c * 0.88 + vec3(0.075, 0.048, 0.025), (1.0 - smoothstep(0.0, 0.5, l)) * 0.9 * S);

    // a low sun glowing in the lower right corner, a thin dusty veil along the bottom
    vec2 d = (uv - vec2(1.0, 1.0)) * vec2(asp, 1.0);
    c += vec3(1.0, 0.74, 0.40) * 0.15 * exp(-dot(d, d) * 2.2) * S;
    c = mix(c, c * 0.86 + vec3(1.0, 0.72, 0.44) * 0.10, smoothstep(0.65, 1.0, uv.y) * 0.5 * S);

    // dust-brown vignette
    float e = pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.6);
    c = mix(c, c * vec3(0.80, 0.64, 0.50), clamp(e * 0.55, 0.0, 0.5) * S);

    // dry grain, a little stronger toward the bottom
    float g = ds_hash(floor(uv * size) + 0.5) - 0.5;
    c += vec3(1.0, 0.85, 0.6) * g * (0.020 + 0.016 * uv.y) * S;

    fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
