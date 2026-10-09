// category: Bend
// desc: The real screen twists like a whirlpool around the pointer, a little more when you move fast
// tail: 0.6
const float R = 240.0;
vec4 bend(vec2 uv) {
    vec2 p = uv * RES;
    vec2 d = p - CUR;
    float t = length(d) / R;
    if (t >= 1.0) return texture(tex, uv);
    float sp = clamp(length(CVEL) / 1200.0, 0.0, 1.0) * (1.0 - smoothstep(0.1, 0.55, CT));
    float a = (0.7 + 0.8 * sp) * (1.0 - t) * (1.0 - t);
    float cs = cos(a), sn = sin(a);
    vec2 e = vec2(cs * d.x - sn * d.y, sn * d.x + cs * d.y);
    return vec4(texture(tex, (CUR + e) / RES).rgb, 1.0);
}
