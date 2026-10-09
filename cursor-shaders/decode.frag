// category: Follow
// desc: The screen around the moving pointer turns into scrambling green glyphs and decodes back to the real pixels as you move on, a Matrix-style reveal; small, only at the edges of the pointer
// tail: 0.6
const float R = 100.0;
const vec2 CELL = vec2(10.0, 16.0);
const vec3 GREEN = vec3(0.30, 1.00, 0.50);
float dc_hash(vec2 v) { return fract(sin(dot(v, vec2(127.1, 311.7))) * 43758.5453); }
float dc_glyph(vec2 f, float id) {
    vec2 q = (f - 0.12) / 0.76;
    if (q.x < 0.0 || q.x >= 1.0 || q.y < 0.0 || q.y >= 1.0) return 0.0;
    vec2 g = floor(vec2(q.x * 4.0, q.y * 6.0));
    return step(0.52, dc_hash(g + vec2(id * 1.37, id * 0.71)));
}
vec4 bend(vec2 uv) {
    vec2 p = uv * RES;
    vec3 base = texture(tex, uv).rgb;
    float life = 1.0 - smoothstep(0.08, 0.55, CT);
    if (life < 0.01 || distance(p, CUR) > 1100.0) return vec4(base, 1.0);
    float w = 1.0 - smoothstep(0.0, R, distance(p, CUR));
    for (int i = 0; i < 8; i++) {
        vec2 dir; float len, h;
        float d = cur_seg(p, i, dir, len, h);
        if (d > R) continue;
        float age = (float(i) + 1.0 - h) / 8.0;
        w = max(w, (1.0 - smoothstep(0.0, R * 0.8, d)) * (1.0 - age * 0.8));
    }
    w *= life;
    if (w < 0.05) return vec4(base, 1.0);
    vec2 cell = floor(p / CELL);
    float t = dc_hash(cell);
    float d = w - (t * 0.7 + 0.2);
    if (d < 0.0) return vec4(base, 1.0);
    float seed = floor(CUR.x / 7.0) + floor(CUR.y / 7.0) * 3.0 + floor(CT * 12.0);
    float id = floor(dc_hash(cell + seed) * 64.0);
    float ink = dc_glyph(fract(p / CELL), id);
    vec3 avg = texture(tex, (cell + 0.5) * CELL / RES).rgb;
    if (d < 0.13) {
        float flick = step(0.35, dc_hash(cell + seed * 1.7));
        vec3 lit = mix(base, vec3(0.75, 1.0, 0.85), ink * flick * 0.8);
        return vec4(lit, 1.0);
    }
    vec3 bg = mix(avg, vec3(0.0, 0.05, 0.02), 0.72);
    vec3 fg = mix(GREEN, avg, 0.2);
    return vec4(mix(bg, fg, ink), 1.0);
}
