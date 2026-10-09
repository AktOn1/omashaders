#version 300 es
// category: Color
// desc: Teal shadows, orange highlights, film contrast
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    c = mix(c * vec3(0.85, 1.0, 1.12), c * vec3(1.1, 1.0, 0.85), smoothstep(0.3, 0.8, l));
    c = mix(c, c * c * (3.0 - 2.0 * c), 0.35);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
