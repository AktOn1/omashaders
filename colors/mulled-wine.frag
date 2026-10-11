#version 300 es
// category: Color
// desc: Mulled wine: lights warm to red-orange like market lanterns while the shadows go cool blue; a soft split tone with the original luminance held so text stays crisp
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
    vec3 shadowC = vec3(0.10, 0.16, 0.38);      // cool blue shadows
    vec3 midC = vec3(0.62, 0.30, 0.26);          // wine red mid tones
    vec3 lightC = vec3(1.00, 0.72, 0.42);        // lantern red-orange lights
    vec3 grad = mix(shadowC, midC, smoothstep(0.05, 0.50, l));
    grad = mix(grad, lightC, smoothstep(0.40, 0.95, l));
    vec3 keep = mix(vec3(l), c, 0.50);
    vec3 g = mix(keep, grad, 0.58);
    float gl = max(luma(g), 0.001);
    g = mix(g, clamp(g * (l / gl), 0.0, 1.0), 0.85);
    fragColor = vec4(clamp(g, 0.0, 1.0), s.a);
}
