#version 300 es
// category: Color
// desc: Cipher red: a black-red surveillance grade, shadows sink into oxblood and mid-tones turn a muted crimson while the lights stay neutral so text reads
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
    // red lives in the shadows and mid-tones, the top end stays untouched (neutral white text on black)
    float red = (1.0 - smoothstep(0.50, 0.92, l));
    vec3 tint = vec3(1.0 + 0.30 * red, 1.0 - 0.34 * red, 1.0 - 0.30 * red);
    vec3 g = c * tint;
    g = mix(vec3(luma(g)), g, 1.0 + 0.10 * red);            // slightly richer red, never rainbow
    g += vec3(0.020, -0.006, -0.004) * (1.0 - smoothstep(0.0, 0.25, l));   // oxblood in the black
    // a touch of contrast so the shadows feel deep
    g = mix(g, g * g * (3.0 - 2.0 * g), 0.18);
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.72);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
