// category: Follow
// desc: A drifting wisp of smoke around the pointer that is pulled along behind it, curls and thins out upward after you stop; light smoke on dark screens, dark smoke on bright ones
// tail: 1.1
const float R = 150.0;
const vec3 SMOKE_LIGHT = vec3(0.88, 0.91, 0.96);
const vec3 SMOKE_DARK = vec3(0.16, 0.19, 0.27);
float sm_hash(vec2 v) { return fract(sin(dot(v, vec2(127.1, 311.7))) * 43758.5453); }
float sm_noise(vec2 v) {
    vec2 i = floor(v), f = fract(v);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(sm_hash(i), sm_hash(i + vec2(1.0, 0.0)), f.x),
               mix(sm_hash(i + vec2(0.0, 1.0)), sm_hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float sm_fbm(vec2 v) {
    float a = 0.5, s = 0.0;
    for (int k = 0; k < 4; k++) { s += a * sm_noise(v); v = v * 2.03 + vec2(17.0, 9.0); a *= 0.5; }
    return s;
}
vec4 bend(vec2 uv) {
    vec2 p = uv * RES;
    vec3 base = texture(tex, uv).rgb;
    float life = 1.0 - smoothstep(0.1, 1.0, CT);
    if (life < 0.01 || distance(p, CUR) > 1100.0) return vec4(base, 1.0);
    float w = 0.0;
    for (int i = 0; i < 8; i++) {
        vec2 dir; float len, h;
        float d = cur_seg(p, i, dir, len, h);
        float age = (float(i) + 1.0 - h) / 8.0;
        float rad = R * (0.55 + 0.45 * age);
        if (d > rad) continue;
        w = max(w, (1.0 - smoothstep(0.0, rad, d)) * (1.0 - age * 0.75));
    }
    w = max(w, (1.0 - smoothstep(0.0, R * 0.6, distance(p, CUR))) * 0.6);
    w *= life;
    if (w < 0.02) return vec4(base, 1.0);
    // the smoke pattern is anchored to a lagging trail point, so it is dragged along behind the pointer
    vec2 q = (p - CTR[4] * 0.7) / 55.0 + vec2(0.0, CT * 0.9);
    vec2 warp = vec2(sm_fbm(q + vec2(3.1, CT * 0.35)), sm_fbm(q + vec2(8.7, -CT * 0.3))) - 0.5;
    float n = sm_fbm(q + warp * 2.2);
    float a = smoothstep(0.30, 0.70, n) * w * 0.85;
    vec3 seen = texture(tex, (p + warp * 26.0 * w) / RES).rgb;
    float lum = dot(seen, vec3(0.299, 0.587, 0.114));
    vec3 smoke = mix(SMOKE_LIGHT, SMOKE_DARK, smoothstep(0.35, 0.7, lum));
    return vec4(mix(seen, mix(smoke, seen, 0.2), a), 1.0);
}
