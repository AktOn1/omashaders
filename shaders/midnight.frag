#version 300 es
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
void main() {
    vec4 c = texture(tex, v_texcoord);
    float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 tint = mix(c.rgb, vec3(l) * vec3(0.55, 0.7, 1.0), 0.35);
    fragColor = vec4(tint * vec3(0.78, 0.86, 1.0) * 0.85, c.a);
}
