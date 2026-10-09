#version 300 es
// category: Art
// desc: Oil painting (Kuwahara): flat brush patches. Costly on 4K, the slider sets the brush size
// strength: 30
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
void quad(vec2 uv, vec2 dir, int r, vec2 px, out vec3 mean, out float var_) {
    vec3 sum = vec3(0.0);
    vec3 sq = vec3(0.0);
    float n = 0.0;
    for (int j = 0; j <= r; j++) {
        for (int i = 0; i <= r; i++) {
            vec3 t = texture(tex, uv + vec2(float(i) * dir.x, float(j) * dir.y) * px).rgb;
            sum += t;
            sq += t * t;
            n += 1.0;
        }
    }
    mean = sum / n;
    vec3 v = sq / n - mean * mean;
    var_ = v.r + v.g + v.b;
}
void main() {
    vec4 s = texture(tex, v_texcoord);
    int r = int(floor(STRENGTH * 4.0 + 0.5));
    if (r < 1) { fragColor = s; return; }
    vec2 px = 1.0 / vec2(textureSize(tex, 0));
    vec3 m0, m1, m2, m3;
    float v0, v1, v2, v3;
    quad(v_texcoord, vec2(-1.0, -1.0), r, px, m0, v0);
    quad(v_texcoord, vec2(1.0, -1.0), r, px, m1, v1);
    quad(v_texcoord, vec2(-1.0, 1.0), r, px, m2, v2);
    quad(v_texcoord, vec2(1.0, 1.0), r, px, m3, v3);
    vec3 c = m0;
    float best = v0;
    if (v1 < best) { best = v1; c = m1; }
    if (v2 < best) { best = v2; c = m2; }
    if (v3 < best) { best = v3; c = m3; }
    fragColor = vec4(c, s.a);
}
