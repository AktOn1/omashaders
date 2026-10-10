#version 300 es
// category: Ambient
// desc: Wet window: drops slide down a cold window and bend the picture behind them, a faint mist of tiny dew drops, cool blue night tint (animated)
// strength: 70
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
uniform float time;
layout(location = 0) out vec4 fragColor;

float rg_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// one layer of sliding drops; returns xy = refraction offset, z = highlight
vec3 rg_layer(vec2 uv, vec2 grid, float seed, float speed) {
    vec2 p = uv * vec2(1.78, 1.0) * grid;
    vec2 id = floor(p), f = fract(p);
    float h = rg_h(id + seed);
    if (h < 0.5) return vec3(0.0);
    float h2 = rg_h(id + seed + 4.3), h3 = rg_h(id + seed + 8.7);
    float life = fract(time * speed * (0.6 + 0.8 * h2) + h * 7.0);
    // jerky slide: the drop sticks, then runs
    float run = life + 0.07 * sin(life * 18.0 + h3 * 6.28);
    float y = mix(0.12, 0.88, clamp(run, 0.0, 1.0));
    float x = 0.5 + (h3 - 0.5) * 0.4 + 0.04 * sin(life * 11.0 + h * 30.0);
    float fade = smoothstep(0.0, 0.08, life) * smoothstep(1.0, 0.82, life);
    vec2 d = (f - vec2(x, y)) * vec2(1.0, 0.8);
    float r = 0.10 + 0.07 * h2;
    float body = smoothstep(r, r * 0.55, length(d));
    // thin trail of water above the drop
    float tx = abs(f.x - x);
    float trail = smoothstep(0.035, 0.0, tx) * step(f.y, y) * smoothstep(0.0, y, f.y) * 0.45 * smoothstep(0.0, 0.25, life);
    float a = max(body, trail * 0.6) * fade;
    // a drop is a small lens: it flips the picture, so offset points against the drop centre
    vec2 n = (f - vec2(x, y)) / r;
    vec2 off = -n * 0.016 * body * fade;
    float spec = smoothstep(0.35, 0.0, length(n - vec2(-0.35, -0.4))) * body * fade;
    return vec3(off + vec2(0.0, 0.002) * trail * fade, spec * 0.55 + a * 0.05);
}

void main() {
    vec2 uv = v_texcoord;
    vec3 a = rg_layer(uv, vec2(7.0, 4.0), 0.0, 0.045);
    vec3 b = rg_layer(uv + 0.31, vec2(15.0, 8.5), 9.0, 0.07);
    // tiny dew drops, static
    vec2 q = uv * vec2(1.78, 1.0) * 70.0;
    vec2 qi = floor(q), qf = fract(q) - 0.5;
    float dh = rg_h(qi + 21.0);
    float dew = dh > 0.93 ? smoothstep(0.28, 0.05, length(qf - (vec2(rg_h(qi + 3.0), rg_h(qi + 5.0)) - 0.5) * 0.4)) : 0.0;
    vec2 off = a.xy + b.xy + (-qf * 0.0025 * dew);
    vec3 c = texture(tex, clamp(uv + off, 0.0, 1.0)).rgb;
    // cold wet night: slight blue push and a touch of lift in the dark
    c = mix(c, c * vec3(0.86, 0.95, 1.10) + vec3(0.008, 0.015, 0.03), 0.8);
    c += vec3(0.75, 0.88, 1.0) * (a.z + b.z + dew * 0.06);
    fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
