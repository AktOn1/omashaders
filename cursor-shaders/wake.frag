// category: Follow
// desc: A boat's wake: a narrow ribbon of gentle ripples bends the real screen along the pointer's path and fades behind it
// tail: 0.5
const float RAD = 46.0;
vec4 bend(vec2 uv) {
    vec2 p = uv * RES;
    if (distance(p, CUR) > 1100.0) return texture(tex, uv);
    vec2 off = vec2(0.0);
    float lift = 0.0;
    for (int i = 0; i < 8; i++) {
        vec2 dir; float len, h;
        float d = cur_seg(p, i, dir, len, h);
        if (d > RAD) continue;
        float age = (float(i) + 1.0 - h) / 8.0;
        float w = (1.0 - smoothstep(0.0, RAD, d)) * (1.0 - age) * clamp(len / 18.0, 0.0, 1.0);
        vec2 nrm = vec2(-dir.y, dir.x);
        float ph = age * 28.0;
        off += nrm * sin(ph) * 3.4 * w + dir * cos(ph) * 1.4 * w;
        lift += cos(ph) * w;
    }
    vec3 c = texture(tex, (p + off) / RES).rgb + 0.025 * lift;
    return vec4(c, 1.0);
}
