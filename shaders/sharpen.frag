#version 300 es
// category: Mood
// desc: Crisper text and edges
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    vec2 px = 1.0 / vec2(textureSize(tex, 0));
    vec3 n = texture(tex, v_texcoord + vec2(px.x, 0.0)).rgb + texture(tex, v_texcoord - vec2(px.x, 0.0)).rgb
           + texture(tex, v_texcoord + vec2(0.0, px.y)).rgb + texture(tex, v_texcoord - vec2(0.0, px.y)).rgb;
    c += (c - n * 0.25) * 0.6;
    fragColor = vec4(clamp(c, 0.0, 1.0), s.a);
}
