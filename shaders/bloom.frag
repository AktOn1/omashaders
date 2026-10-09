#version 300 es
// category: Lens
// desc: Soft glow around bright areas
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
vec3 glow(vec2 uv, float r1, float r2, float th) {
    vec2 px = 1.0 / vec2(textureSize(tex, 0));
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.785398;
        vec2 d = vec2(cos(a), sin(a)) * px;
        acc += max(texture(tex, uv + d * r1).rgb - th, 0.0);
        acc += max(texture(tex, uv + d * r2).rgb - th, 0.0);
    }
    return acc / 16.0;
}
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    c += glow(v_texcoord, 4.0, 9.0, 0.55) * 0.9;
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
