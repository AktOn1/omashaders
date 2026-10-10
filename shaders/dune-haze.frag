#version 300 es
// category: Mood
// desc: Dune haze: golden-hour air that thickens toward the bottom, a faint heat wobble along the bottom and side edges, a low sun glow in the corner and fine sand grain (static, text stays sharp in the middle)
// strength: 60
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float dh_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float dh_noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(dh_hash(i), dh_hash(i + vec2(1.0, 0.0)), f.x), mix(dh_hash(i + vec2(0.0, 1.0)), dh_hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
    vec2 uv = v_texcoord;
    vec2 size = vec2(textureSize(tex, 0));
    float asp = size.x / size.y;
    float S = STRENGTH;

    // heat wobble: frozen shimmer lines, only in the bottom band and along the side edges, none in the middle
    float band = smoothstep(0.84, 1.0, uv.y);
    float side = smoothstep(0.86, 1.0, abs(uv.x - 0.5) * 2.0) * smoothstep(0.35, 0.9, uv.y);
    float mask = max(band, 0.7 * side);
    float n = dh_noise(vec2(uv.x * 7.0 * asp, uv.y * 90.0)) - 0.5;
    float m = dh_noise(vec2(uv.x * 19.0 * asp, uv.y * 210.0)) - 0.5;
    float dx = (n * 0.75 + m * 0.35) * 0.0055 * mask * S;
    vec3 c = texture(tex, uv + vec2(dx, dx * 0.15)).rgb;

    // golden light: warm the whole picture a touch, gently
    c = mix(c, c * vec3(1.12, 0.95, 0.70) + vec3(0.03, 0.012, 0.0), 1.0 * S);

    // air thickens toward the bottom: a hazy ochre veil that lifts the shadows (kept light so text stays readable)
    float veil = pow(smoothstep(0.40, 1.0, uv.y), 1.5);
    vec3 HAZE = vec3(1.0, 0.72, 0.42);
    c = mix(c, c * 0.80 + HAZE * 0.24, veil * S);

    // low sun glowing in the upper right corner
    vec2 d = (uv - vec2(0.97, 0.03)) * vec2(asp, 1.0);
    c += vec3(1.0, 0.82, 0.50) * 0.16 * exp(-dot(d, d) * 2.6) * S;

    // sand dust at the edges: warm brown vignette instead of black
    float e = pow(length((uv - 0.5) * vec2(1.0, 1.1)), 2.6);
    c = mix(c, c * vec3(0.78, 0.62, 0.48), clamp(e * 0.55, 0.0, 0.5) * S);

    // fine grain like blown sand, a little stronger in the haze
    float g = dh_hash(floor(uv * size) + 0.5) - 0.5;
    c += vec3(1.0, 0.85, 0.6) * g * (0.022 + 0.03 * veil) * S;

    fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
