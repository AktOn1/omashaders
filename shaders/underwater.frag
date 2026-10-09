#version 300 es
// category: Ambient
// desc: Underwater: gentle ripple, drifting caustic light and a teal tint
// strength: 25
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
layout(location = 0) out vec4 fragColor;
float caustic(vec2 p, float t) {
    vec2 q = p;
    float c = 1.0;
    float inten = 0.005;
    for (int n = 0; n < 4; n++) {
        float tt = t * (1.0 - 3.5 / float(n + 1));
        q = p + vec2(cos(tt - q.x) + sin(tt + q.y), sin(tt - q.y) + cos(tt + q.x));
        c += 1.0 / length(vec2(p.x / (sin(q.x + tt) / inten), p.y / (cos(q.y + tt) / inten)));
    }
    c /= 4.0;
    c = 1.17 - pow(c, 1.4);
    return pow(abs(c), 8.0);
}
void main() {
    vec2 uv = v_texcoord;
    float amp = 0.0035 * STRENGTH;
    uv += amp * vec2(sin(uv.y * 38.0 + time * 1.6) + 0.5 * sin(uv.y * 91.0 - time * 2.3), cos(uv.x * 33.0 + time * 1.3));
    vec4 s = texture(tex, uv);
    vec2 p = mod(v_texcoord * 6.28318 * vec2(1.78, 1.0) * 2.0, 6.28318) - 250.0;
    float cs = caustic(p, time * 0.5 + 23.0);
    vec3 c = s.rgb * mix(vec3(1.0), vec3(0.78, 0.96, 1.0), STRENGTH);
    c += vec3(0.25, 0.6, 0.7) * cs * 0.5 * STRENGTH;
    c = mix(c, c * vec3(0.8, 1.0, 1.05) + vec3(0.0, 0.03, 0.05), 0.5 * STRENGTH);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
