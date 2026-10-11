#version 300 es
// category: Color
// desc: Sunny pop: cheerful, slightly saturated colour with warm cream highlights and shadows lifted to a soft plum instead of black; a bright happy grade that keeps the original luminance so text stays crisp
// strength: 60
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    // more colour, a little warmer
    vec3 g = mix(vec3(l), c, 1.32) * vec3(1.04, 1.01, 0.95);
    // shadows lift toward a soft plum, highlights toward cream
    g += vec3(0.055, 0.035, 0.075) * (1.0 - smoothstep(0.0, 0.35, l));
    g = mix(g, g * vec3(1.02, 1.0, 0.95), smoothstep(0.55, 1.0, l) * 0.6);
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.45);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
