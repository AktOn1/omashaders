#version 300 es
// category: Devices
// desc: Commodore 64: blue border colours, chunky pixels
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    vec2 res = vec2(textureSize(tex, 0)) / 3.0;
    vec3 t = texture(tex, (floor(v_texcoord * res) + 0.5) / res).rgb;
    float l = luma(t);
    c = mix(vec3(0.25, 0.20, 0.55), vec3(0.65, 0.62, 0.95), smoothstep(0.1, 0.8, l));
    c = mix(c, vec3(0.20, 0.17, 0.48), step(l, 0.05));
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
