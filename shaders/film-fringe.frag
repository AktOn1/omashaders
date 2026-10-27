#version 300 es
// category: Lens
// desc: Film fringe: every edge on the screen is split into a faint prism, warm on one side and cool on the other, as if seen through a soap film, with a soft bloom on the brightest parts and a breath of pearl in the corners (static, text stays sharp)
// strength: 55
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float ff_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// soft bloom: a few taps on a golden-angle disc, only the bright parts count
vec3 ff_bloom(vec2 uv, vec2 px, float radius) {
    vec3 acc = vec3(0.0);
    float wsum = 0.0;
    for (int i = 0; i < 10; i++) {
        float fi = float(i) + 0.5;
        float a = fi * 2.39996;
        float r = sqrt(fi / 10.0) * radius;
        vec2 o = vec2(cos(a), sin(a)) * r * px;
        vec3 s = texture(tex, clamp(uv + o, 0.0, 1.0)).rgb;
        float w = 1.0 / (1.0 + r * 0.08);
        acc += max(s - 0.62, 0.0) * w;                 // only what is clearly bright blooms
        wsum += w;
    }
    return acc / max(wsum, 0.0001);
}

void main() {
    vec2 uv = v_texcoord;
    vec2 px = 1.0 / vec2(textureSize(tex, 0));
    vec3 c = texture(tex, uv).rgb;

    // where the picture has an edge, and which way it runs
    float l1 = ff_luma(texture(tex, uv + vec2(px.x, 0.0)).rgb);
    float l2 = ff_luma(texture(tex, uv - vec2(px.x, 0.0)).rgb);
    float l3 = ff_luma(texture(tex, uv + vec2(0.0, px.y)).rgb);
    float l4 = ff_luma(texture(tex, uv - vec2(0.0, px.y)).rgb);
    vec2 grad = vec2(l1 - l2, l3 - l4);
    float g = length(grad);
    float edge = smoothstep(0.035, 0.30, g);
    vec2 dir = g > 0.0001 ? grad / g : vec2(0.0);

    // the prism: red and blue are pulled apart along the edge, green stays put,
    // so the picture keeps its place and only a thin rainbow lip appears
    float spread = (0.55 + 1.35 * STRENGTH) * edge;
    vec2 o = dir * px * spread;
    float r = texture(tex, clamp(uv + o, 0.0, 1.0)).r;
    float b = texture(tex, clamp(uv - o, 0.0, 1.0)).b;
    vec3 fringed = vec3(r, c.g, b);
    // the fringe is a thin extra lip of colour, not a replacement of the edge
    vec3 res = mix(c, fringed, clamp(STRENGTH * 1.15, 0.0, 1.0));

    // faint pearl bloom around the highlights
    vec3 bl = ff_bloom(uv, px, 7.0 + 7.0 * STRENGTH);
    res += bl * vec3(0.92, 0.97, 1.08) * (0.30 * STRENGTH);

    // a breath of cool film in the corners, so the screen feels like it sits behind glass
    float rad = length((uv - 0.5) * vec2(1.0, 0.92));
    float corner = smoothstep(0.42, 0.80, rad);
    res = mix(res, res * vec3(0.975, 0.995, 1.030) + vec3(0.004, 0.006, 0.011), corner * 0.45 * STRENGTH);

    fragColor = vec4(clamp(res, 0.0, 1.0), 1.0);
}
