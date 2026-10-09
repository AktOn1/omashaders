#version 300 es
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
void main() {
    vec4 c = texture(tex, v_texcoord);
    float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 v = mix(vec3(l), c.rgb, 1.5);
    v = (v - 0.5) * 1.08 + 0.5;
    fragColor = vec4(clamp(v, 0.0, 1.0), c.a);
}
