#version 300 es
// category: Ambient
// desc: Deep sea: slow light shafts from the surface, drifting marine snow, depth fog and a blue-green tint (animated)
// strength: 55
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
layout(location = 0) out vec4 fragColor;

float ds_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ds_n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(ds_h(i), ds_h(i + vec2(1.0, 0.0)), f.x), mix(ds_h(i + vec2(0.0, 1.0)), ds_h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float snow(vec2 uv, float scale, float speed, float seed) {
    vec2 p = uv * vec2(1.78, 1.0) * scale;
    p.y -= time * speed;
    p.x += sin(time * 0.15 + seed) * 0.6 + sin(p.y * 0.7 + seed) * 0.15;
    vec2 id = floor(p), f = fract(p) - 0.5;
    float h = ds_h(id + seed);
    if (h < 0.55) return 0.0;
    vec2 o = (vec2(ds_h(id + seed + 3.1), ds_h(id + seed + 7.7)) - 0.5) * 0.6;
    float r = 0.035 + 0.05 * ds_h(id + seed + 1.3);
    return smoothstep(r, r * 0.2, length(f - o)) * (0.4 + 0.6 * ds_h(id + seed + 9.9));
}
void main() {
    vec2 uv = v_texcoord;
    vec3 c = texture(tex, uv).rgb;
    float y = 1.0 - uv.y;
    // slanted light shafts from the surface, strongest at the top, swaying slowly
    float sx = uv.x * 1.78 + uv.y * 0.55;
    float shafts = ds_n(vec2(sx * 3.2 + time * 0.05, time * 0.08)) * 0.7 + ds_n(vec2(sx * 7.5 - time * 0.04, 2.0)) * 0.3;
    shafts = smoothstep(0.45, 0.95, shafts) * pow(y, 1.6);
    // depth: fog thickens downward and toward the corners
    float depth = clamp(0.30 * uv.y + 0.45 * pow(length((uv - 0.5) * vec2(1.0, 0.9)), 2.0), 0.0, 0.55);
    vec3 fog = vec3(0.02, 0.10, 0.16);
    c = mix(c, c * vec3(0.78, 0.96, 1.06), 0.85);
    c = mix(c, fog + c * 0.55, depth);
    c += vec3(0.30, 0.62, 0.72) * shafts * 0.20;
    float s = snow(uv, 38.0, 0.03, 0.0) + 0.7 * snow(uv + 0.37, 62.0, 0.05, 11.0);
    c += vec3(0.65, 0.85, 0.9) * s * 0.35;
    fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
