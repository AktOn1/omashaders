// category: Bend
// desc: A glass lens follows the pointer and magnifies the real screen under it, with a soft edge
const float R = 190.0;
vec4 bend(vec2 uv) {
    vec2 p = uv * RES;
    vec2 d = p - CUR;
    float r = length(d);
    if (r >= R) return texture(tex, uv);
    float t = r / R;
    float e = t * t * (3.0 - 2.0 * t);
    vec3 c = texture(tex, (CUR + d * mix(0.55, 1.0, e)) / RES).rgb;
    float rim = smoothstep(0.90, 0.97, t) * (1.0 - smoothstep(0.97, 1.0, t));
    c = c * (1.0 - 0.14 * smoothstep(0.8, 1.0, t)) + 0.10 * rim;
    return vec4(c, 1.0);
}
