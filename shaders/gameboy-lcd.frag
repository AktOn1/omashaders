#version 300 es
// category: Devices
// desc: Game Boy: 4 greens, chunky pixels, LCD grid (slider = pixel size and palette)
// strength: 25
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    float blk = floor(1.0 + STRENGTH * 4.0 + 0.5);
    vec2 res = vec2(textureSize(tex, 0)) / blk;
    vec2 cell = floor(v_texcoord * res);
    vec2 q = (cell + 0.5) / res;
    vec2 o = 0.25 / res;
    vec3 t = 0.25 * (texture(tex, q + o).rgb + texture(tex, q - o).rgb + texture(tex, q + vec2(o.x, -o.y)).rgb + texture(tex, q - vec2(o.x, -o.y)).rgb);
    float l = clamp(luma(t), 0.0, 0.999);
    vec3 pal[4] = vec3[4](vec3(0.059, 0.220, 0.059), vec3(0.188, 0.384, 0.188), vec3(0.545, 0.675, 0.059), vec3(0.608, 0.737, 0.059));
    float f4 = l * 3.0;
    int i = int(floor(f4 + 0.5));
    vec3 g = pal[i];
    float amt = smoothstep(0.0, 0.5, STRENGTH);
    vec2 f = fract(v_texcoord * res);
    float gridAmt = 0.18 * smoothstep(1.5, 3.5, blk);
    float grid = 1.0 - gridAmt * (step(f.x, 0.12) + step(f.y, 0.12));
    vec3 c = mix(s.rgb, g * grid, amt);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
