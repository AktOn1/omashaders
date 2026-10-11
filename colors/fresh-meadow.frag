#version 300 es
// category: Color
// desc: Fresh meadow: clear spring greens and sunny yellows; cool tints turn toward leaf green, whites warm to a light butter, shadows are lifted a little and nothing gets dark or muddy
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
    vec3 shadowC = vec3(0.10, 0.28, 0.12);       // leaf shade green
    vec3 midC = vec3(0.45, 0.78, 0.25);          // fresh green
    vec3 lightC = vec3(1.00, 0.97, 0.62);        // sunny butter yellow
    vec3 grad = mix(shadowC, midC, smoothstep(0.05, 0.50, l));
    grad = mix(grad, lightC, smoothstep(0.45, 1.00, l));
    // a little extra clarity: more colour in what is already colourful
    vec3 vivid = mix(vec3(l), c, 1.12);
    vec3 g = mix(vivid, grad, 0.40);
    // gentle lift of the shadows
    g += vec3(0.02, 0.035, 0.015) * (1.0 - smoothstep(0.0, 0.4, l));
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.80);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
