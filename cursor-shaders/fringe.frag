// category: Bend
// desc: Colour fringes (red, green and blue pull apart) around the pointer, stretching along the way you move it
// tail: 0.6
vec4 bend(vec2 uv) {
    vec2 p = uv * RES;
    vec2 d = p - CUR;
    float r = length(d);
    float f = exp(-r * r / (2.0 * 200.0 * 200.0));
    if (f < 0.01) return texture(tex, uv);
    vec2 dir = r > 0.5 ? d / r : vec2(0.0);
    float sp = clamp(length(CVEL) / 1200.0, 0.0, 1.0) * (1.0 - smoothstep(0.1, 0.55, CT));
    vec2 vd = length(CVEL) > 1.0 ? normalize(CVEL) : vec2(0.0);
    vec2 o = (dir * 3.0 * smoothstep(0.0, 120.0, r) + vd * 16.0 * sp) * f;
    float r_ = texture(tex, (p + o) / RES).r;
    float g_ = texture(tex, uv).g;
    float b_ = texture(tex, (p - o) / RES).b;
    return vec4(r_, g_, b_, 1.0);
}
