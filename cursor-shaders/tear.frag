// category: Bend
// desc: Real glitch: rows of the actual screen tear sideways and split into red and blue around the moving pointer, then settle
// tail: 0.6
const float W = 360.0;
const float H = 130.0;
float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
vec4 bend(vec2 uv) {
    vec2 p = uv * RES;
    vec2 d = (p - CUR) / vec2(W, H);
    float f = 1.0 - smoothstep(0.45, 1.0, length(d));
    float act = clamp(length(CVEL) / 800.0, 0.0, 1.0);
    act = max(act, 0.3) * (1.0 - smoothstep(0.12, 0.6, CT));
    float k = f * act;
    if (k < 0.002) return texture(tex, uv);
    float seed = floor(CUR.x / 9.0) + floor(CUR.y / 9.0) * 37.0;
    float row = floor(p.y / 7.0);
    float h = hash(row * 1.7 + seed);
    float torn = step(0.58, h);
    float shift = (hash(row + seed * 3.1) - 0.5) * 2.0 * 110.0 * k * torn;
    float split = (3.0 + 9.0 * k) * k;
    vec2 q = p + vec2(shift, 0.0);
    float r = texture(tex, (q + vec2(split, 0.0)) / RES).r;
    float g = texture(tex, q / RES).g;
    float b = texture(tex, (q - vec2(split, 0.0)) / RES).b;
    vec3 c = vec3(r, g, b);
    c += torn * 0.05 * k * hash(row * 9.3 + seed);
    return vec4(c, 1.0);
}
