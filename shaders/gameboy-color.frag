#version 300 es
// category: Devices
// desc: Game Boy Color: 5-bit colour, pixel grid (slider = pixel size and colour depth)
// strength: 40
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
    t = floor(t * 31.0 + 0.5) / 31.0;
    t = mix(vec3(luma(t)), t, 0.9) * 0.93 + 0.04;
    vec2 f = fract(v_texcoord * res);
    float gridAmt = 0.10 * smoothstep(1.5, 3.0, blk);
    float grid = 1.0 - gridAmt * (step(f.x, 0.1) + step(f.y, 0.1));
    vec3 c = mix(s.rgb, t * grid, smoothstep(0.0, 0.5, STRENGTH));
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
