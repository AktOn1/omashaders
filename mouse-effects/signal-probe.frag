#version 440
// category: Trail
// desc: Signal probe: the pointer is the tip of a small metal test probe with a glowing contact point; its handle swings round behind it and a thin copper wire follows the path the pointer took, routed like a circuit trace in straight runs and 45 degree turns with a gold via at every bend. A bright pulse of current runs down the wire and the wire fades out towards its far end
// motion: yes
layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;
layout(std140, binding = 0) uniform buf {
  mat4 qt_Matrix;
  float qt_Opacity;
  float time;
  vec2 mouse;
  vec2 res;
  vec4 h0;
  vec4 h1;
  vec4 h2;
  vec4 h3;
  vec4 h4;
  vec4 h5;
  vec4 h6;
  vec4 h7;
  vec4 hs;
};

vec2 P(int i) {
  if (i == 0) return mouse;
  if (i == 1) return h0.xy;
  if (i == 2) return h0.zw;
  if (i == 3) return h1.xy;
  if (i == 4) return h1.zw;
  if (i == 5) return h2.xy;
  if (i == 6) return h2.zw;
  if (i == 7) return h3.xy;
  if (i == 8) return h3.zw;
  if (i == 9) return h4.xy;
  if (i == 10) return h4.zw;
  if (i == 11) return h5.xy;
  if (i == 12) return h5.zw;
  if (i == 13) return h6.xy;
  if (i == 14) return h6.zw;
  if (i == 15) return h7.xy;
  return h7.zw;
}
// a history point that glides towards the newer one as the next sample is due, so the wire never jumps when a sample arrives
vec2 PG(int i) { return i == 0 ? mouse : mix(P(i), P(i - 1), hs.y); }

float sp_aa(float d, float w) { return clamp(w + 0.5 - d, 0.0, 1.0); }
vec4 sp_over(vec4 top, vec4 bot) { return top + bot * (1.0 - top.a); }

// one hop of the wire from A to B laid out like a trace: a straight run and a 45 degree run. d = distance, s = way along the hop, len = hop length
void sp_hop(vec2 p, vec2 A, vec2 B, out float d, out float s, out float len) {
  vec2 dv = B - A;
  float ax = abs(dv.x);
  float ay = abs(dv.y);
  float m = min(ax, ay);
  vec2 sg = vec2(sign(dv.x), sign(dv.y));
  bool diagFirst = (ax > ay) == (dv.x * dv.y > 0.0);
  vec2 M = diagFirst ? A + sg * m : B - sg * m;
  vec2 ab = M - A;
  float l1 = length(ab);
  float u1 = clamp(dot(p - A, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
  float d1 = length(p - (A + ab * u1));
  vec2 cd = B - M;
  float l2 = length(cd);
  float u2 = clamp(dot(p - M, cd) / max(dot(cd, cd), 1e-4), 0.0, 1.0);
  float d2 = length(p - (M + cd * u2));
  if (d1 <= d2) { d = d1; s = u1 * l1; } else { d = d2; s = l1 + u2 * l2; }
  len = l1 + l2;
}

void main() {
  vec2 p = qt_TexCoord0 * res;
  if (mouse.x < 0.0 || mouse.y < 0.0 || mouse.x > res.x || mouse.y > res.y) { fragColor = vec4(0.0); return; }
  float sc = clamp(res.y / 1080.0, 0.75, 2.0);
  float t = time;

  // which way the handle lies: towards where the pointer has been, or up and to the right when it rests
  vec2 dv = (PG(3) - mouse) + 0.6 * (PG(6) - mouse);
  float dl = length(dv);
  vec2 fb = normalize(vec2(0.55, -0.83));
  vec2 db = normalize(mix(fb, dv / max(dl, 1e-3), smoothstep(3.0 * sc, 26.0 * sc, dl)));
  float Lh = 38.0 * sc;
  vec2 B = mouse + db * Lh;

  // the wire's corner points: the glided history, with the ones that lie under the handle folded into its end
  vec2 Q1 = PG(2); vec2 Q2 = PG(4); vec2 Q3 = PG(6); vec2 Q4 = PG(8); vec2 Q5 = PG(10); vec2 Q6 = PG(12); vec2 Q7 = PG(14);
  float lim = Lh + 5.0 * sc;
  if (length(Q1 - mouse) < lim) Q1 = B;
  if (length(Q2 - mouse) < lim) Q2 = B;
  if (length(Q3 - mouse) < lim) Q3 = B;
  if (length(Q4 - mouse) < lim) Q4 = B;
  if (length(Q5 - mouse) < lim) Q5 = B;
  if (length(Q6 - mouse) < lim) Q6 = B;
  if (length(Q7 - mouse) < lim) Q7 = B;
  vec2 lo = min(min(min(mouse, B), min(Q1, Q2)), min(min(Q3, Q4), min(min(Q5, Q6), Q7)));
  vec2 hi = max(max(max(mouse, B), max(Q1, Q2)), max(max(Q3, Q4), max(max(Q5, Q6), Q7)));
  float pad = 22.0 * sc;
  if (p.x < lo.x - pad || p.x > hi.x + pad || p.y < lo.y - pad || p.y > hi.y + pad) { fragColor = vec4(0.0); return; }

  vec3 copper = vec3(0.90, 0.56, 0.26);
  vec3 gold = vec3(1.00, 0.82, 0.42);
  vec3 amber = vec3(1.00, 0.62, 0.15);
  vec3 cold = vec3(0.90, 0.96, 1.00);
  vec3 ink = vec3(0.012, 0.040, 0.030);

  // the wire: nearest hop and the way along it
  float bd = 1e4; float bs = 0.0; float cum = 0.0;
  float vring = 0.0; float vhole = 0.0;
  vec2 prev = B;
  float LF = 560.0 * sc;
  for (int j = 1; j <= 7; j++) {
    vec2 cur = j == 1 ? Q1 : (j == 2 ? Q2 : (j == 3 ? Q3 : (j == 4 ? Q4 : (j == 5 ? Q5 : (j == 6 ? Q6 : Q7)))));
    float d; float s; float len;
    sp_hop(p, prev, cur, d, s, len);
    if (d < bd) { bd = d; bs = cum + s; }
    cum += len;
    if (len > 16.0 * sc) {
      float rv = length(p - cur);
      float fj = clamp(1.0 - cum / LF, 0.0, 1.0);
      vring = max(vring, sp_aa(abs(rv - 2.5 * sc), 0.75 * sc) * fj);
      vhole = max(vhole, sp_aa(rv, 1.2 * sc) * fj);
    }
    prev = cur;
  }
  float fade = pow(clamp(1.0 - bs / LF, 0.0, 1.0), 1.3) * (1.0 - smoothstep(cum - 90.0 * sc, cum + 4.0 * sc, bs)) * smoothstep(0.0, 6.0 * sc, cum);
  float wc = sp_aa(bd, 0.95 * sc) * fade;
  float wglow = exp(-bd * bd / (5.0 * sc * 5.0 * sc)) * fade;

  // the pulse of current running away from the probe along the wire
  float per = 170.0 * sc;
  float ph = bs / per - t * 0.55;
  float u = fract(-ph);
  float pul = exp(-u * per / (46.0 * sc)) * smoothstep(1.0, 0.96, u);

  // the probe: needle, barrel and a gold ferrule, lying along db from the tip
  vec2 a = p - mouse;
  float along = dot(a, db);
  float perp = dot(a, vec2(-db.y, db.x));
  float sn = clamp(along, 0.0, Lh);
  float tapr = smoothstep(0.0, 0.52 * Lh, sn);
  float barrel = smoothstep(0.50 * Lh, 0.56 * Lh, sn);
  float w = mix(0.30 * sc + 1.45 * sc * tapr, 3.0 * sc, barrel);
  float hc = sp_aa(abs(perp), w) * step(-0.5, along) * (1.0 - smoothstep(Lh - 1.0, Lh + 1.2 * sc, along));
  float nrm = clamp(perp / max(w, 0.2), -1.0, 1.0);
  float lit = 0.30 + 0.70 * pow(max(1.0 - abs(nrm + 0.35) * 0.8, 0.0), 2.0);
  vec3 steel = vec3(0.78, 0.84, 0.90) * lit;
  vec3 anod = vec3(0.075, 0.085, 0.100) + vec3(0.55, 0.62, 0.68) * pow(max(1.0 - abs(nrm + 0.45) * 2.4, 0.0), 2.0) * 0.55;
  vec3 hcol = mix(steel, anod, barrel);
  float ring1 = sp_aa(abs(along - 0.53 * Lh), 1.0 * sc);
  float ring2 = sp_aa(abs(along - (Lh - 1.8 * sc)), 1.6 * sc);
  hcol = mix(hcol, gold * (0.55 + 0.45 * lit), max(ring1, ring2) * barrel);
  vec4 hand = vec4(hcol * hc, hc);

  // light: the contact point at the tip, the pulse on the wire, the vias
  float r2 = dot(a, a);
  float flick = 0.88 + 0.12 * sin(t * 3.1) * sin(t * 1.7 + 1.0);
  float core = exp(-r2 / (2.1 * sc * 2.1 * sc)) * flick;
  float halo = exp(-r2 / (10.0 * sc * 10.0 * sc)) * 0.50 * flick;
  float halo2 = exp(-r2 / (24.0 * sc * 24.0 * sc)) * 0.16 * flick;
  vec3 acc = vec3(1.0, 0.93, 0.78) * core + amber * (halo + halo2);
  acc += (copper * 0.30 * wglow * 0.85 + amber * pul * (wc + 0.55 * wglow) * 0.95 + cold * pul * pul * (wc + 0.4 * wglow) * 0.9);

  vec4 L = vec4(0.0);
  float sh = clamp(sp_aa(bd, 2.4 * sc) * fade * 0.50 + (core * 0.5 + halo * 0.9) * 0.55, 0.0, 0.55);
  sh = max(sh, sp_aa(abs(perp), w + 1.8 * sc) * step(-1.0, along) * (1.0 - smoothstep(Lh, Lh + 2.0 * sc, along)) * 0.4);
  L = vec4(ink * sh, sh);
  vec3 wcol = copper * (0.85 + 0.30 * pul);
  L = sp_over(vec4(wcol * wc, wc), L);
  vec3 vcol = gold * (0.9);
  float vr = vring;
  L = sp_over(vec4(vcol * vr, vr), L);
  L = sp_over(vec4(ink * vhole, vhole * 0.9), L);
  L = sp_over(hand, L);
  float la = clamp(max(acc.r, max(acc.g, acc.b)), 0.0, 1.0);
  vec3 rgb = L.rgb + min(acc, vec3(la));
  float aa = L.a + la * (1.0 - L.a);
  fragColor = vec4(min(rgb, vec3(aa)), aa) * qt_Opacity;
}
