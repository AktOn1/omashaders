// category: Bend
// desc: The screen turns to water around the pointer: ripples bend the real pixels and spread out when you stop
// tail: 3
const float R = 460.0;
vec4 bend(vec2 uv) {
    vec2 p = uv * RES;
    vec2 d = p - CUR;
    float r = length(d);
    if (r > R) return texture(tex, uv);
    float life = 1.0 - smoothstep(1.4, 3.0, CT);
    float sp = clamp(length(CVEL) / 900.0, 0.0, 1.0);
    float amp = (3.0 + 3.0 * sp) * life;
    float env = exp(-r / 170.0) * smoothstep(0.0, 36.0, r) * (1.0 - smoothstep(R * 0.7, R, r));
    float ph = r * 0.055 - CT * 9.0;
    vec2 dir = d / max(r, 0.001);
    vec3 c = texture(tex, (p + dir * amp * sin(ph) * env) / RES).rgb;
    c += 0.05 * life * env * cos(ph);
    return vec4(c, 1.0);
}
