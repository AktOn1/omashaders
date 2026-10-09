// category: Follow
// desc: Motion blur: the real screen blurs along the direction you move the pointer, only near it, and sharpens again when you stop
// tail: 0.4
const float R = 130.0;
vec4 bend(vec2 uv) {
    vec2 p = uv * RES;
    vec2 v = CUR - CTR[3];
    float sp = length(v);
    if (sp < 3.0) return texture(tex, uv);
    vec2 c0 = mix(CUR, CTR[3], 0.55);
    float m = 1.0 - smoothstep(0.35 * R, R, distance(p, c0));
    if (m < 0.003) return texture(tex, uv);
    vec2 dir = v / sp;
    float span = min(sp * 0.45, 40.0) * m;
    vec3 c = vec3(0.0);
    for (int k = -3; k <= 3; k++) c += texture(tex, (p + dir * span * (float(k) / 3.0)) / RES).rgb;
    return vec4(c / 7.0, 1.0);
}
