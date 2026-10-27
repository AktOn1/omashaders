#version 300 es
// category: Color
// desc: Quarantine steel: a cold industrial grade, colour drained by about 30 %, blacks crushed (but not clipped) into a deep blue-teal, mids leaning cold steel, highlights keeping a touch of warm amber so warning lights stay warm while cyan machine light stays alive
// strength: 75
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

float qc_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l0 = qc_luma(c);

    // how amber / warning-light it is: saturated pixels whose red leads and blue is lowest (orange, amber, red alarm)
    float mx = max(c.r, max(c.g, c.b));
    float mn = min(c.r, min(c.g, c.b));
    float sat = mx > 1e-4 ? (mx - mn) / mx : 0.0;
    float warm = smoothstep(0.30, 0.60, (c.r - c.b) / max(mx, 1e-4)) * smoothstep(0.35, 0.65, sat);
    // how cyan it is: blue and green lead over red and blue keeps up with green (machine light, holograms; true greens do not count)
    float cyan = smoothstep(0.20, 0.50, (max(c.g, c.b) - c.r) / max(mx, 1e-4)) * smoothstep(0.25, 0.55, sat)
               * smoothstep(0.62, 0.92, c.b / max(c.g, 1e-4));

    // how green it is: green clearly leads blue (not the blue-leaning cyan of machine light)
    float grn = smoothstep(0.05, 0.30, (c.g - max(c.r, c.b)) / max(mx, 1e-4)) * smoothstep(0.25, 0.55, sat) * (1.0 - cyan);

    // drain the colour by about 30 %; warning lights only about 12 %, machine cyan is kept almost whole,
    // loud greens and very saturated blues are drained further so nothing stays cheerful
    float keep = 0.70 + 0.18 * warm + 0.22 * cyan - 0.22 * grn - 0.24 * smoothstep(0.50, 0.90, sat) * (1.0 - warm);
    vec3 g = mix(vec3(l0), c, clamp(keep, 0.40, 0.98));
    // greens slide toward teal-steel (some of the green goes to blue)
    g.b += (g.g - g.b) * 0.30 * grn;
    g.g -= (g.g - g.b) * 0.10 * grn;

    // crush the blacks with a small toe, then a slightly steeper curve (kept soft: nothing clips)
    g = max(g - 0.022, 0.0) / 0.978;
    float l = qc_luma(g);
    g = mix(g, g * g * (3.0 - 2.0 * g), 0.20);

    // overall cold cast (warm lights spared)
    g *= mix(vec3(0.95, 0.99, 1.04), vec3(1.0), warm);

    // shadows sink into a deep blue-teal (multiplied, so true black stays near black)
    float shad = 1.0 - smoothstep(0.0, 0.40, l);
    g = mix(g, g * vec3(0.74, 0.98, 1.10) + vec3(-0.004, 0.006, 0.016) * shad, shad * (1.0 - 0.6 * warm));

    // mids lean cold steel
    float mid = smoothstep(0.10, 0.40, l) * (1.0 - smoothstep(0.50, 0.88, l));
    g *= mix(vec3(1.0), vec3(0.96, 1.00, 1.04), mid * (1.0 - 0.6 * warm));

    // highlights keep a touch of warm amber, the very brightest stay near white
    float high = smoothstep(0.55, 0.85, l) * (1.0 - 0.6 * smoothstep(0.92, 1.0, l));
    g = mix(g, g * vec3(1.04, 1.0, 0.93) + vec3(0.010, 0.006, 0.0), high * 0.50);

    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
