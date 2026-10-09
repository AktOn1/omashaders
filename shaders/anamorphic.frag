#version 300 es
// category: Lens
// desc: Cinema lens: bright spots stretch into a cool horizontal streak
// strength: 45
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec2 px = 1.0 / vec2(textureSize(tex, 0));
    vec3 acc = vec3(0.0);
    float wsum = 0.0;
    vec3 mean = 0.25 * (texture(tex, v_texcoord + vec2(40.0, 0.0) * px).rgb + texture(tex, v_texcoord - vec2(40.0, 0.0) * px).rgb
                      + texture(tex, v_texcoord + vec2(0.0, 40.0) * px).rgb + texture(tex, v_texcoord - vec2(0.0, 40.0) * px).rgb);
    for (int i = -16; i <= 16; i++) {
        float fi = float(i);
        float w = exp(-fi * fi / 90.0);
        vec3 t = texture(tex, v_texcoord + vec2(fi * 7.0 * px.x, 0.0)).rgb;
        acc += max(t - mean - 0.3, 0.0) * w;
        wsum += w;
    }
    vec3 streak = acc / wsum * vec3(0.55, 0.8, 1.4) * 5.0;
    fragColor = vec4(min(s.rgb + streak * STRENGTH, 1.0), s.a);
}
