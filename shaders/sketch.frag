#version 300 es
// category: Art
// desc: Pencil sketch on warm paper: ink outlines and cross-hatched shadows
// strength: 70
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec2 px = 1.0 / vec2(textureSize(tex, 0));
    vec2 uv = v_texcoord;
    float tl = luma(texture(tex, uv + px * vec2(-1.0, -1.0)).rgb);
    float tc = luma(texture(tex, uv + px * vec2(0.0, -1.0)).rgb);
    float tr = luma(texture(tex, uv + px * vec2(1.0, -1.0)).rgb);
    float ml = luma(texture(tex, uv + px * vec2(-1.0, 0.0)).rgb);
    float mc = luma(texture(tex, uv).rgb);
    float mr = luma(texture(tex, uv + px * vec2(1.0, 0.0)).rgb);
    float bl = luma(texture(tex, uv + px * vec2(-1.0, 1.0)).rgb);
    float bc = luma(texture(tex, uv + px * vec2(0.0, 1.0)).rgb);
    float br = luma(texture(tex, uv + px * vec2(1.0, 1.0)).rgb);
    float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
    float gy = (bl + 2.0 * bc + br) - (tl + 2.0 * tc + tr);
    float edge = smoothstep(0.08, 0.7, sqrt(gx * gx + gy * gy));
    vec2 fc = gl_FragCoord.xy;
    float h1 = smoothstep(0.35, 0.5, abs(fract((fc.x + fc.y) / 7.0) - 0.5)) ;
    float h2 = smoothstep(0.35, 0.5, abs(fract((fc.x - fc.y) / 7.0) - 0.5));
    float dark = 1.0 - smoothstep(0.15, 0.75, mc);
    float hatch = max(h1 * step(0.25, dark), h2 * step(0.6, dark)) * dark;
    vec3 paper = vec3(0.96, 0.94, 0.87);
    vec3 c = paper * (1.0 - 0.9 * edge) * (1.0 - 0.45 * hatch);
    fragColor = vec4(c, texture(tex, uv).a);
}
