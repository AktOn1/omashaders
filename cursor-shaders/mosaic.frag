// category: Bend
// desc: A round patch of the real screen turns into big pixels under the pointer and sharpens toward its edge
const float R = 150.0;
vec4 bend(vec2 uv) {
    vec2 p = uv * RES;
    float t = length(p - CUR) / R;
    if (t >= 1.0) return texture(tex, uv);
    float blk = floor(mix(9.0, 1.0, smoothstep(0.3, 1.0, t)) + 0.5);
    if (blk < 1.5) return texture(tex, uv);
    vec2 q = (floor(p / blk) + 0.5) * blk;
    return vec4(texture(tex, q / RES).rgb, 1.0);
}
