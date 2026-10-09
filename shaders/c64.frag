#version 300 es
// category: Devices
// desc: Commodore 64: blue and light-blue, chunky pixels (slider = pixel size and palette)
// strength: 25
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    float blk = floor(1.0 + STRENGTH * 3.0 + 0.5);
    vec2 res = vec2(textureSize(tex, 0)) / blk;
    vec2 q = (floor(v_texcoord * res) + 0.5) / res;
    vec2 o = 0.25 / res;
    vec3 t = 0.25 * (texture(tex, q + o).rgb + texture(tex, q - o).rgb + texture(tex, q + vec2(o.x, -o.y)).rgb + texture(tex, q - vec2(o.x, -o.y)).rgb);
    float l = luma(t);
    vec3 c = mix(vec3(0.25, 0.20, 0.55), vec3(0.65, 0.62, 0.95), smoothstep(0.1, 0.8, l));
    c = mix(c, vec3(0.20, 0.17, 0.48), step(l, 0.05));
    c = mix(s.rgb, c, smoothstep(0.0, 0.5, STRENGTH));
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
