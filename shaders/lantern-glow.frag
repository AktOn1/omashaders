#version 300 es
// category: Mood
// desc: Lantern night: warm bokeh-like glow around the brightest areas, gentle split toning from warm highlights to indigo shadows and a soft vignette (static)
// strength: 60
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float lg_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// bokeh-like bloom: ring-shaped taps at two radii, so bright spots bleed into soft discs rather than a plain blur
vec3 lg_bokeh(vec2 uv, float r1, float r2, float th) {
    vec2 px = 1.0 / vec2(textureSize(tex, 0));
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 10; i++) {
        float a = float(i) * 0.628318;
        vec2 d = vec2(cos(a), sin(a)) * px;
        acc += max(texture(tex, uv + d * r1).rgb - th, 0.0);
        acc += max(texture(tex, uv + d * r2).rgb - th, 0.0) * 0.8;
        acc += max(texture(tex, uv + d * r2 * 0.5).rgb - th, 0.0) * 0.5;
    }
    return acc / 23.0;
}
void main() {
    vec2 uv = v_texcoord;
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float l = lg_luma(c);
    // split toning: shadows lean indigo, highlights lean warm
    float sh = 1.0 - smoothstep(0.0, 0.45, l);
    float hi = smoothstep(0.35, 0.95, l);
    c = mix(c, c * vec3(0.90, 0.94, 1.12) + vec3(0.006, 0.010, 0.040), sh * 0.8);
    c = mix(c, c * vec3(1.10, 1.00, 0.84), hi * 0.6);
    // warm bokeh glow
    vec3 g = lg_bokeh(uv, 9.0, 24.0, 0.52);
    c += g * vec3(1.0, 0.66, 0.34) * 1.0;
    // soft vignette with a slightly indigo edge
    float v = smoothstep(0.42, 1.1, length((uv - 0.5) * vec2(1.1, 1.0)));
    c = c * (1.0 - 0.16 * v) + vec3(0.004, 0.006, 0.022) * v;
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
