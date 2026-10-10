#version 300 es
// category: Ambient
// desc: Starship HUD glass: cyan corner brackets, edge rulers, a faint scan grid and a little lens fringe at the rim; the middle of the screen stays clear
// strength: 60
// strength-mode: native
precision highp float;
in vec2 v_texcoord;
uniform sampler2D tex;
layout(location = 0) out vec4 fragColor;

void main() {
    vec2 sz = vec2(textureSize(tex, 0));
    vec2 uv = v_texcoord;
    vec2 px = uv * sz;
    vec2 cen = (uv - 0.5) * vec2(sz.x / sz.y, 1.0);
    float rr = length(cen);
    float rim = smoothstep(0.38, 0.95, rr);              // 0 in the middle, 1 at the corners
    float S = STRENGTH;

    // lens fringe: red and blue pulled apart toward the rim, nothing in the middle
    vec2 off = (uv - 0.5) * rim * 0.0035 * S;
    float cr = texture(tex, uv + off).r;
    vec4 mid = texture(tex, uv);
    float cb = texture(tex, uv - off).b;
    vec3 c = vec3(cr, mid.g, cb);

    // glass: the rim is darker and cooler, plus a few faint horizontal scan lines
    c *= 1.0 - 0.28 * S * rim * rim;
    c += vec3(0.0, 0.05, 0.09) * S * rim;
    float scan = 0.5 + 0.5 * sin(px.y * 2.0944);          // period 3 px
    c *= 1.0 - 0.035 * S * scan * (0.3 + 0.7 * rim);

    // HUD overlay, drawn in the folded corner so all four corners match
    vec2 q = min(px, sz - px);
    vec3 cyan = vec3(0.16, 0.88, 1.0);
    vec3 orange = vec3(1.0, 0.54, 0.12);
    float hud = 0.0, hot = 0.0;

    // corner brackets: L shapes 30 px in, 2 px thick, 76 px long
    float inset = 30.0, len = 76.0;
    float bx = step(abs(q.x - inset), 1.0) * step(inset - 1.0, q.y) * step(q.y, inset + len);
    float by = step(abs(q.y - inset), 1.0) * step(inset - 1.0, q.x) * step(q.x, inset + len);
    hud += max(bx, by) * 0.85;
    // orange tick on each bracket end and a small square at the vertex
    float endx = step(abs(q.x - inset), 4.0) * step(abs(q.y - (inset + len)), 1.0);
    float endy = step(abs(q.y - inset), 4.0) * step(abs(q.x - (inset + len)), 1.0);
    hot += max(endx, endy) * 0.9;
    hot += step(max(abs(q.x - inset - 8.0), abs(q.y - inset - 8.0)), 2.0) * 0.8;

    // rulers along the four edges, fading out before the middle of each edge
    float fadeH = smoothstep(0.30, 0.42, abs(uv.x - 0.5));
    float fadeV = smoothstep(0.30, 0.44, abs(uv.y - 0.5));
    float skipH = step(inset + len + 18.0, q.x);
    float skipV = step(inset + len + 18.0, q.y);
    float mx = mod(px.x, 24.0), my = mod(px.y, 24.0);
    float idx = floor(px.x / 24.0), idy = floor(px.y / 24.0);
    float longX = mod(idx, 5.0) < 0.5 ? 1.0 : 0.0;
    float longY = mod(idy, 5.0) < 0.5 ? 1.0 : 0.0;
    float topbot = step(mx, 1.0) * step(q.y, 3.0 + 4.0 * longX + 1.0) * step(1.0, q.y) * skipH * fadeH;
    float sides = step(my, 1.0) * step(q.x, 3.0 + 4.0 * longY + 1.0) * step(1.0, q.x) * skipV * fadeV;
    hud += (topbot + sides) * 0.45;

    // a faint grid of dots every 96 px, only toward the rim
    vec2 g = mod(px + 48.0, 96.0) - 48.0;
    float dotg = step(max(abs(g.x), abs(g.y)), 1.0) * smoothstep(0.45, 0.8, rr);
    hud += dotg * 0.35;
    // and a thin inner frame line along each edge
    float frame = step(abs(q.y - 12.0), 0.5) * step(inset + len + 18.0, q.x) * fadeH * 0.35
                + step(abs(q.x - 12.0), 0.5) * step(inset + len + 18.0, q.y) * fadeV * 0.35;
    hud += frame;

    c = mix(c, cyan, clamp(hud, 0.0, 1.0) * 1.0 * S);
    c = mix(c, orange, clamp(hot, 0.0, 1.0) * 0.85 * S);
    // thin cyan glow hugging the bracket lines
    float gl = smoothstep(7.0, 0.0, abs(q.x - inset)) * step(q.y, inset + len) + smoothstep(7.0, 0.0, abs(q.y - inset)) * step(q.x, inset + len);
    c += cyan * 0.05 * S * clamp(gl, 0.0, 1.0) * step(inset - 7.0, min(q.x, q.y));
    fragColor = vec4(clamp(c, 0.0, 1.0), mid.a);
}
