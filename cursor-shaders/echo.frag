// category: Follow
// desc: A faint afterimage: a ghost copy of the screen under the pointer trails a little behind it and fades; text stays readable
// tail: 0.5
const float R = 110.0;
vec4 bend(vec2 uv) {
    vec2 p = uv * RES;
    vec3 base = texture(tex, uv).rgb;
    vec2 lag = CTR[5] - CUR;
    float ll = length(lag);
    if (ll < 4.0) return vec4(base, 1.0);
    float m = 1.0 - smoothstep(0.3 * R, R, distance(p, CUR));
    float k = 0.22 * m * clamp(ll / 60.0, 0.0, 1.0);
    if (k < 0.002) return vec4(base, 1.0);
    vec3 ghost = texture(tex, (p + lag * 0.5) / RES).rgb;
    return vec4(mix(base, ghost, k), 1.0);
}
