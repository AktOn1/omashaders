#version 300 es
// category: Art
// desc: Glowing neon outlines on every edge, over a dimmed picture
// strength: 50
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float edgeAt(vec2 uv, vec2 px) {
    float tl = luma(texture(tex, uv + px * vec2(-1.0, -1.0)).rgb);
    float tc = luma(texture(tex, uv + px * vec2(0.0, -1.0)).rgb);
    float tr = luma(texture(tex, uv + px * vec2(1.0, -1.0)).rgb);
    float ml = luma(texture(tex, uv + px * vec2(-1.0, 0.0)).rgb);
    float mr = luma(texture(tex, uv + px * vec2(1.0, 0.0)).rgb);
    float bl = luma(texture(tex, uv + px * vec2(-1.0, 1.0)).rgb);
    float bc = luma(texture(tex, uv + px * vec2(0.0, 1.0)).rgb);
    float br = luma(texture(tex, uv + px * vec2(1.0, 1.0)).rgb);
    float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
    float gy = (bl + 2.0 * bc + br) - (tl + 2.0 * tc + tr);
    return sqrt(gx * gx + gy * gy);
}
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec2 px = 1.0 / vec2(textureSize(tex, 0));
    float e = edgeAt(v_texcoord, px) + 0.5 * edgeAt(v_texcoord, px * 2.5);
    vec3 hue = normalize(s.rgb + 0.15);
    vec3 neon = pow(hue, vec3(2.0)) * 1.8 + vec3(0.04, 0.12, 0.2);
    vec3 c = s.rgb * (1.0 - 0.45 * STRENGTH) + neon * smoothstep(0.05, 0.8, e) * STRENGTH * 1.6;
    fragColor = vec4(min(c, 1.0), s.a);
}
