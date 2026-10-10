#version 300 es
// category: Art
// desc: Washi paper: faint hand-made fibres, softly lifted blacks, a warm aged-paper cast and slightly darker corners; text stays crisp
// strength: 65
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
    vec4 s = texture(tex, v_texcoord);
    vec3 c = s.rgb;
    vec2 fp = v_texcoord * vec2(textureSize(tex, 0));
    // two crossing sets of long, thin fibres plus a very soft cloudiness of the pulp
    vec2 fa = vec2(fp.x * 0.9 + fp.y * 0.42, fp.y * 0.9 - fp.x * 0.42);
    vec2 fb = vec2(fp.x * 0.35 - fp.y * 0.94, fp.y * 0.35 + fp.x * 0.94);
    float fib = vn(vec2(fa.x * 0.010, fa.y * 0.11)) * 0.5 + vn(vec2(fb.x * 0.08, fb.y * 0.010)) * 0.35
              + vn(fp * 0.004) * 0.15;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    // lifted, warm blacks: the darkest value becomes a soft ink grey, whites barely move (so text keeps its contrast)
    vec3 lift = vec3(0.080, 0.072, 0.062) * STRENGTH;
    vec3 r = c * (1.0 - 0.08 * STRENGTH) + lift;
    r *= mix(vec3(1.0), vec3(1.0, 0.975, 0.92), STRENGTH * smoothstep(0.0, 1.0, l));
    // fibres show most in the shadows and flat areas, hardly at all on bright text
    r += (fib - 0.5) * 0.06 * STRENGTH * (1.0 - 0.6 * l);
    // aged corners
    vec2 d = v_texcoord - 0.5;
    r *= 1.0 - 0.16 * STRENGTH * smoothstep(0.25, 0.85, length(d * vec2(1.0, 1.1)));
    fragColor = vec4(clamp(r, 0.0, 1.0), s.a);
}
