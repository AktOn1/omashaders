#version 300 es
// category: Ambient
// desc: Redline HUD: a racing-cockpit look. The corners fall into charcoal, a faint carbon-fibre weave shows only in the outer margins, a thin amber-to-red strip of rev lights runs along the very top and bottom edges with a soft glow, and the contrast gets a small punch. The centre stays sharp so text reads clearly (static, no animation)
// strength: 55
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float rh_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
    vec2 uv = v_texcoord;
    vec2 sz = vec2(textureSize(tex, 0));
    vec4 s = texture(tex, uv);
    vec3 c = s.rgb;
    float sc = clamp(sz.y / 1080.0, 0.75, 2.0);
    vec2 px = uv * sz;

    // a small contrast punch with slightly lifted-charcoal blacks
    vec3 curve = c * c * (3.0 - 2.0 * c);
    c = mix(c, curve, 0.32);
    c = mix(c, c * 0.96 + vec3(0.010, 0.010, 0.012), 0.5);

    // distance from the screen edge in pixels (0 at the edge)
    float edge = min(min(px.x, sz.x - px.x), min(px.y, sz.y - px.y));

    // carbon-fibre twill in the outer margins only: 2x2 weave of small cells
    float cell = 5.0 * sc;
    vec2 cc = floor(px / cell);
    vec2 fc = fract(px / cell);
    float par = mod(cc.x + cc.y, 2.0);
    float grain = par < 0.5 ? fc.x : fc.y;
    float weave = mod(floor(cc.x * 0.5) + floor(cc.y * 0.5), 2.0) < 0.5 ? (grain - 0.5) : (0.5 - grain);
    float margin = 1.0 - smoothstep(10.0 * sc, 62.0 * sc, edge);
    c *= 1.0 + weave * 0.20 * margin;
    c += vec3(0.9, 0.92, 1.0) * weave * 0.030 * margin;
    c = mix(c, c * 0.88, 0.30 * margin);

    // the corners close in, asphalt charcoal with a trace of red
    float vig = smoothstep(0.50, 1.18, length((uv - 0.5) * vec2(sz.x / sz.y, 1.0) * 0.92));
    c = mix(c, c * vec3(0.70, 0.66, 0.68) + vec3(0.014, 0.002, 0.003), vig * 0.80);

    // rev lights: short segments along the very top, a plain line along the bottom, amber in the middle and red toward the sides
    float xn = abs(uv.x - 0.5) * 2.0;
    vec3 amber = vec3(1.00, 0.66, 0.16);
    vec3 red = vec3(1.00, 0.12, 0.08);
    vec3 lc = mix(amber, red, smoothstep(0.35, 0.95, xn));
    float seg = step(0.16, fract(px.x / (34.0 * sc)));
    float top = 1.0 - smoothstep(1.0 * sc, 3.2 * sc, px.y);
    float bot = 1.0 - smoothstep(0.5 * sc, 2.2 * sc, sz.y - px.y);
    float gTop = exp(-px.y / (14.0 * sc)) * 0.30;
    float gBot = exp(-(sz.y - px.y) / (12.0 * sc)) * 0.22;
    float ends = 0.35 + 0.65 * smoothstep(0.0, 0.18, xn);
    float lamp = (top * seg * 0.95 + bot * 0.70 + (gTop * (0.4 + 0.6 * seg) + gBot)) * ends;
    // on light pictures the strip turns a deeper red-amber so it still reads
    vec3 lcs = lc * (1.0 - 0.35 * smoothstep(0.45, 0.85, rh_luma(c)));
    c = mix(c, lcs, clamp(lamp * 0.9, 0.0, 1.0)) + lcs * lamp * 0.25;

    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
