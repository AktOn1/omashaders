#version 300 es
// category: Devices
// desc: Game Boy Color: 5-bit colour with a faint pixel grid
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    vec2 res = vec2(textureSize(tex, 0)) / 4.0;
    vec2 q = (floor(v_texcoord * res) + 0.5) / res;
    vec3 t = texture(tex, q).rgb;
    t = floor(t * 31.0 + 0.5) / 31.0;
    t = mix(vec3(luma(t)), t, 0.9) * 0.93 + 0.04;
    vec2 f = fract(v_texcoord * res);
    float grid = 1.0 - 0.10 * (step(f.x, 0.1) + step(f.y, 0.1));
    c = t * grid;
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
