#version 300 es
// category: Mood
// desc: Sakura bloom: bright areas bleed a soft pink glow and the screen edges fill with a pink-lavender dusk haze, like a spring evening seen through blossom (static, text stays crisp)
// strength: 65
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec2 px = 1.0 / vec2(textureSize(tex, 0));
    // soft bloom: bright pixels only, two rings, tinted blossom pink
    vec3 acc = vec3(0.0);
    float ring = 0.0;
    for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.785398 + 0.2;
        vec2 d = vec2(cos(a), sin(a)) * px;
        vec3 ta = texture(tex, v_texcoord + d * 6.0).rgb;
        vec3 tb = texture(tex, v_texcoord + d * 15.0).rgb;
        acc += max(ta - 0.55, 0.0) + max(tb - 0.55, 0.0);
        ring += dot(ta + tb, vec3(0.1667));
    }
    // glow only spills out of bright spots into dark surroundings; inside a light window it fades out, so dark text on a light page keeps its contrast
    float spill = clamp(1.0 - ring / 16.0 * 1.7, 0.0, 1.0);
    vec3 bloom = acc / 16.0 * vec3(1.0, 0.70, 0.88);
    vec3 c = s.rgb + bloom * 1.6 * spill;
    // dusk haze that gathers at the edges: lilac at the top, rose at the bottom (screen blend, so white stays white)
    vec2 q = (v_texcoord - 0.5) * vec2(1.0, 0.85);
    float edge = smoothstep(0.30, 0.78, length(q));
    vec3 haze = mix(vec3(0.62, 0.50, 0.95), vec3(1.0, 0.52, 0.70), smoothstep(0.2, 0.9, v_texcoord.y));
    c = 1.0 - (1.0 - c) * (1.0 - haze * edge * 0.40);
    // a touch of lifted plum in the blacks and a cool-pink cast
    c = c * 0.96 + vec3(0.030, 0.012, 0.045);
    c *= vec3(1.0, 0.975, 1.0);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
