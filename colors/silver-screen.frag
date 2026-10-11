#version 300 es
// category: Color
// desc: Silver screen: black-and-white film with a gentle S-curve, neutral shadows and slightly warm silver highlights; classic noir print that keeps text crisp
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
    // a soft film curve on the grey value: lifted blacks, a little shoulder
    float lc = l + 0.10 * (smoothstep(0.0, 1.0, l) - l);
    vec3 k0 = vec3(0.020, 0.022, 0.028);       // inky, faintly cool black
    vec3 k1 = vec3(0.330, 0.335, 0.345);       // neutral silver grey
    vec3 k2 = vec3(0.760, 0.750, 0.725);       // warm silver
    vec3 k3 = vec3(0.985, 0.960, 0.905);       // projector-lamp white
    vec3 grad = mix(k0, k1, smoothstep(0.00, 0.45, lc));
    grad = mix(grad, k2, smoothstep(0.40, 0.80, lc));
    grad = mix(grad, k3, smoothstep(0.75, 1.00, lc));
    // a whisper of the original colour so reds and greens stay tellable apart
    vec3 keep = mix(vec3(l), c, 0.22);
    vec3 g = mix(keep, grad, 0.82);
    // hold the original luminance so contrast and text legibility are unchanged
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.65);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
