#version 300 es
// category: Color
// desc: Rite oxblood: a candle-lit ritual chamber. Blacks crushed toward black lacquer with an oxblood tint (lifted just a little), highlights polished brass, reds deepened and saturated, blues, greens and cyans drained and darkened so they sink into the shadow; contrast firm, whites stay readable and only slightly warm
// strength: 80
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float ro_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float mx = max(c.r, max(c.g, c.b));
    float mn = min(c.r, min(c.g, c.b));
    float sat = mx > 1e-4 ? (mx - mn) / mx : 0.0;
    float chroma = mx - mn;

    // pink and magenta (blue and red both lead green): these swing toward crimson, not toward neon
    float mag = smoothstep(0.08, 0.35, (min(c.r, c.b) - c.g) / max(mx, 1e-4)) * smoothstep(0.10, 0.35, sat);
    // hue families (soft, by which channel leads)
    // warm: red (and its orange side) leads; red: red leads and the rest are low (blood, wine, rust)
    float warm = smoothstep(0.02, 0.35, (c.r - max(c.g, c.b)) / max(mx, 1e-4)) * smoothstep(0.05, 0.40, sat);
    float redd = warm * (1.0 - smoothstep(0.35, 0.80, (c.g - c.b) / max(c.r, 1e-4) + 0.4 * max(c.g - 0.5 * c.r, 0.0)));
    // cool: green, teal, cyan, blue lead over red (violet and magenta keep a little: they lean red-ish)
    float cool = smoothstep(0.02, 0.22, (max(c.g, c.b) - c.r) / max(mx, 1e-4)) * smoothstep(0.03, 0.22, sat) * (1.0 - mag);
    float grn = smoothstep(0.02, 0.25, (c.g - c.b) / max(mx, 1e-4)) * cool;

    float l0 = ro_luma(c);

    // drain the cool hues hard (and green hardest), warm ones are kept whole, reds are pushed up
    float keep = 1.0 - 0.80 * cool - 0.10 * grn + 0.14 * redd;
    vec3 g = mix(vec3(l0), c, clamp(keep, 0.12, 1.30));
    // what colour is left in cool hues is pulled toward the wine side instead of staying green or blue
    float cm = cool * 0.55;
    g = mix(g, vec3(l0 * 1.05, l0 * 0.80, l0 * 0.76), cm);
    // cool hues also go darker, so a sea or a sky sinks into black lacquer
    g *= 1.0 - 0.38 * cool - 0.10 * grn;
    // reds deepen: a touch less green, a little less blue, a bit more weight on the red channel
    g = mix(g, vec3(g.r * 1.10, g.g * 0.66, g.b * 0.72), redd * 0.60);

    // magenta slides to crimson: the blue drains away, the whole tone sinks a little
    g = mix(g, vec3(g.r * 0.96, g.g * 0.82, g.b * 0.30), mag * 0.85);
    g *= 1.0 - 0.40 * mag;
    g = mix(g, g * vec3(0.84, 0.66, 0.66), warm * 0.45 * smoothstep(0.45, 0.9, mx));

    // firm contrast: black toe, then an S curve
    float l = ro_luma(g);
    g = max(g - 0.030, 0.0) / 0.970;
    g = mix(g, g * g * (3.0 - 2.0 * g), 0.34);
    l = ro_luma(g);

    // shadows: oxblood tint (multiplied, so true black stays black lacquer) and a very small lift
    float shad = 1.0 - smoothstep(0.0, 0.34, l);
    g = mix(g, g * vec3(1.18, 0.62, 0.68), shad * 0.75);
    g += vec3(0.022, 0.0025, 0.0055) * shad * shad;

    // mids lean candle amber a little
    float mid = smoothstep(0.12, 0.40, l) * (1.0 - smoothstep(0.55, 0.90, l));
    g *= mix(vec3(1.0), vec3(1.05, 0.96, 0.84), mid * 0.9);

    // highlights turn polished brass; the very brightest settle at a warm bone white so text stays readable
    float high = smoothstep(0.50, 0.85, l) * (1.0 - 0.75 * smoothstep(0.92, 1.0, l));
    g = mix(g, g * vec3(1.05, 0.94, 0.72) + vec3(0.012, 0.006, -0.004), high * 0.70);
    g *= mix(vec3(1.0), vec3(1.0, 0.975, 0.93), smoothstep(0.85, 1.0, l));

    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
