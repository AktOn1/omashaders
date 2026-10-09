#version 300 es
// category: Comfort
// desc: Faint green tint, restful for long reading
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    float l = luma(c);
    c = mix(vec3(l), c, 0.9) * vec3(0.93, 1.0, 0.9);
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
