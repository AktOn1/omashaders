// category: Follow
// desc: Like dragging a finger through wet paint: the real pixels along the pointer's path smear forward and settle again, small and soft
// tail: 0.5
const float RAD = 64.0;
const float REACH = 34.0;
vec4 bend(vec2 uv) {
    vec2 p = uv * RES;
    if (distance(p, CUR) > 1100.0) return texture(tex, uv);
    vec2 acc = vec2(0.0);
    float wsum = 0.0, wmax = 0.0;
    for (int i = 0; i < 8; i++) {
        vec2 dir; float len, h;
        float d = cur_seg(p, i, dir, len, h);
        if (d > RAD) continue;
        float age = (float(i) + 1.0 - h) / 8.0;
        float w = (1.0 - smoothstep(0.0, RAD, d)) * (1.0 - age);
        float amt = clamp(len / 26.0, 0.0, 1.0) * REACH;
        acc += -dir * amt * w;
        wsum += w;
        wmax = max(wmax, w);
    }
    if (wsum < 0.002) return texture(tex, uv);
    vec2 off = acc / wsum * wmax;
    vec3 c = vec3(0.0);
    for (int k = 0; k < 5; k++) c += texture(tex, (p + off * (float(k) / 4.0)) / RES).rgb;
    return vec4(c / 5.0, 1.0);
}
