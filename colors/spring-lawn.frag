#version 300 es
// category: Color
// desc: Spring lawn: greens turn richer and brighter, shadows sink into deep forest green, highlights go warm cream, blues drift slightly teal and reds stay as poppy accents, a fresh sunny grade that still keeps your picture's own colour
// strength: 65
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    float mx = max(c.r, max(c.g, c.b));
    float mn = min(c.r, min(c.g, c.b));
    float sat = (mx - mn) / max(mx, 0.001);

    // tone ramp: deep forest shadows, leaf green mids, cream highlights
    vec3 k0 = vec3(0.012, 0.060, 0.030);
    vec3 k1 = vec3(0.100, 0.330, 0.110);
    vec3 k2 = vec3(0.640, 0.800, 0.380);
    vec3 k3 = vec3(1.000, 0.960, 0.800);
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.34, l));
    grad = mix(grad, k2, smoothstep(0.30, 0.74, l));
    grad = mix(grad, k3, smoothstep(0.74, 1.00, l));

    // the picture keeps its colour: greens richer, blues slightly teal, warm reds kept as accents
    vec3 keep = c;
    float gdom = smoothstep(0.0, 0.10, c.g - max(c.r, c.b));
    float bdom = smoothstep(0.0, 0.10, c.b - max(c.r, c.g));
    float rdom = smoothstep(0.05, 0.25, c.r - max(c.g, c.b));
    keep = mix(keep, vec3(keep.r * 0.80, keep.g * 1.14 + 0.02, keep.b * 0.72), gdom * 0.7);
    keep = mix(keep, vec3(keep.r * 0.72, keep.g * 1.00 + 0.04 * l, keep.b * 0.92), bdom * 0.6);
    keep = mix(keep, keep * vec3(1.08, 0.92, 0.82), rdom * 0.2);
    float lk = max(luma(keep), 0.001);
    keep = clamp(keep * (l / lk), 0.0, 1.0);

    // colourful areas keep more of themselves, dull ones follow the ramp
    float own = clamp(0.18 + 0.42 * sat + 0.45 * rdom, 0.0, 0.80);
    vec3 g = mix(grad, keep, own);
    float lg = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / lg), 0.0, 1.0), 0.55);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
