// category: Follow
// desc: The screen softly drips and slumps behind the pointer, like wax warmed by it; short, and it firms up again quickly
// tail: 0.5
const float RAD = 52.0;
const float DRIP = 22.0;
float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
vec4 bend(vec2 uv) {
    vec2 p = uv * RES;
    if (distance(p, CUR) > 1100.0) return texture(tex, uv);
    float best = 0.0;
    for (int i = 0; i < 8; i++) {
        vec2 dir; float len, h;
        float d = cur_seg(p, i, dir, len, h);
        if (d > RAD) continue;
        float age = (float(i) + 1.0 - h) / 8.0;
        float w = (1.0 - smoothstep(0.0, RAD, d)) * sin(age * 3.14159) * clamp(len / 14.0, 0.0, 1.0);
        best = max(best, w);
    }
    if (best < 0.002) return texture(tex, uv);
    float col = hash(floor(p.x / 4.0));
    float dy = DRIP * best * (0.35 + 0.65 * col);
    float dx = (hash(floor(p.y / 6.0) + col * 9.0) - 0.5) * 3.0 * best;
    vec3 c = 0.5 * texture(tex, (p + vec2(dx, -dy)) / RES).rgb + 0.5 * texture(tex, (p + vec2(dx, -dy * 0.45)) / RES).rgb;
    return vec4(c, 1.0);
}
