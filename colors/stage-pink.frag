#version 300 es
// category: Color
// desc: Stage pink: pastel pink and cyan stage-light glow, warm tones go bubblegum pink, cool tones go soft cyan, highlights glow pink-white; brightness kept
// strength: 55
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    // warm things lean pink, cool things lean cyan
    float warm = clamp(0.5 + 1.6 * (c.r - c.b), 0.0, 1.0);
    vec3 dpink = vec3(0.30, 0.08, 0.30);
    vec3 dcyan = vec3(0.05, 0.16, 0.34);
    vec3 mpink = vec3(1.00, 0.58, 0.80);
    vec3 mcyan = vec3(0.45, 0.92, 1.00);
    vec3 dark = mix(dcyan, dpink, warm);
    vec3 mid = mix(mcyan, mpink, warm);
    vec3 glow = vec3(1.00, 0.93, 0.98);
    vec3 grad = mix(dark, mid, smoothstep(0.00, 0.55, l));
    grad = mix(grad, glow, smoothstep(0.60, 1.00, l));
    // hold the brightness of the original
    float gl = max(luma(grad), 0.001);
    grad = clamp(grad * (l / gl), 0.0, 1.0);
    vec3 keep = mix(vec3(l), c, 0.30);
    c = mix(keep, grad, 0.74);
    // soft pastel bloom feel: the lights lift slightly toward pink-white
    c += vec3(0.030, 0.012, 0.026) * smoothstep(0.65, 1.0, l);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
