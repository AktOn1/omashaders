#version 300 es
// category: Lens
// desc: Warm light shafts streaming in from the top right corner
// strength: 50
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec2 light = vec2(0.92, -0.05);
    vec2 step_ = (light - v_texcoord) / 32.0;
    vec2 p = v_texcoord;
    vec3 acc = vec3(0.0);
    float decay = 1.0;
    for (int i = 0; i < 32; i++) {
        p += step_;
        vec3 t = texture(tex, clamp(p, 0.0, 1.0)).rgb;
        acc += max(t - 0.4, 0.0) * decay;
        decay *= 0.94;
    }
    vec3 rays = acc / 32.0 * vec3(1.0, 0.82, 0.55) * 1.8;
    float sun = exp(-3.5 * length((v_texcoord - light) * vec2(1.78, 1.0)));
    rays += vec3(1.0, 0.8, 0.5) * sun * 0.4;
    fragColor = vec4(min(s.rgb + rays * STRENGTH, 1.0), s.a);
}
