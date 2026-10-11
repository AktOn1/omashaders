#version 300 es
// category: Color
// desc: Stained glass: deep violet-black shadows, jewel-tone mid tones (a touch more ruby, sapphire and emerald) and warm cream highlights; boosts colour without touching contrast, so text stays clean
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
    // jewel tones: push saturation in the mid range only (greys and whites stay as they are)
    float mid = smoothstep(0.08, 0.35, l) * (1.0 - smoothstep(0.70, 0.95, l));
    c = mix(vec3(l), c, 1.0 + 0.45 * mid);
    // deeper, slightly cooler hue shift in the shadows toward violet and sapphire, a little ruby warmth above them
    float sh = 1.0 - smoothstep(0.0, 0.40, l);
    c = mix(c, c * vec3(0.90, 0.86, 1.14) + vec3(0.010, 0.004, 0.030), sh * 0.80);
    float lo = smoothstep(0.10, 0.45, l) * (1.0 - smoothstep(0.45, 0.75, l));
    c = mix(c, c * vec3(1.08, 0.92, 1.04), lo * 0.35);
    // cream, not white, in the lights
    float hi = smoothstep(0.65, 1.0, l);
    c = mix(c, c * vec3(1.05, 1.0, 0.90), hi * 0.6);
    // hold the original luminance so contrast and text legibility are unchanged
    float gl = max(luma(c), 0.001);
    c = mix(c, clamp(c * (l / gl), 0.0, 1.0), 0.70);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
