// category: Follow
// desc: A faint, soft lens that lags behind the pointer and catches up when you stop; barely magnifies, never covers what you read
// tail: 0.6
const float R = 150.0;
vec4 bend(vec2 uv) {
    vec2 p = uv * RES;
    vec2 c0 = mix(CTR[2], CTR[4], 0.5);
    vec2 d = p - c0;
    float t = length(d) / R;
    if (t >= 1.0) return texture(tex, uv);
    float k = 1.0 - smoothstep(0.0, 1.0, t);
    vec2 q = c0 + d * (1.0 - 0.16 * k * k);
    vec3 col = texture(tex, q / RES).rgb;
    col += 0.02 * (1.0 - smoothstep(0.82, 1.0, t)) * smoothstep(0.55, 0.82, t);
    return vec4(col, 1.0);
}
