/* Generatore delle clip della libreria di Gennarino (solo per Claude: non va nell'app).
   Usa lo stesso disegno del creatore di Spinta (crea.js) con pose, inquadrature ed effetti nuovi.
   Spazio di lavoro 1080x1920, uscita 720x1280. */
const G = {};
G.init = function () {
  G.back = crLayer(1080, 1920, c => crBack(c, 7));
  G.front = crLayer(1080, 1920, crFrontL);
  const filtra = (src, f) => { const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1920; const c = cv.getContext('2d'); c.filter = f; c.drawImage(src, 0, 0); return cv };
  G.backBlur = filtra(G.back, 'blur(5px)');
  G.backNotte = filtra(G.back, 'blur(4px) brightness(0.62) saturate(0.85)');
  G.backTriste = filtra(G.back, 'blur(2px) saturate(0.4) brightness(0.72)');
  G.frontTriste = filtra(G.front, 'saturate(0.55) brightness(0.8)');
  G.out = document.createElement('canvas'); G.out.width = 720; G.out.height = 1280;
};
const lerp = (a, b, k) => a + (b - a) * k;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const mixPts = (A, B, k) => A.map((p, i) => [lerp(p[0], B[i][0], k), lerp(p[1], B[i][1], k)]);
const RIPOSO_L = [[392, 986], [350, 1062], [384, 1110]], RIPOSO_R = [[688, 986], [730, 1062], [696, 1110]];

function gArm(c, pts) {
  c.strokeStyle = '#eef1f6'; c.lineWidth = 30; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  pts.slice(1).forEach(p => c.lineTo(p[0], p[1])); c.stroke();
  crCirc(c, pts[0][0], pts[0][1], 22, '#9aa3b3'); crCirc(c, pts[1][0], pts[1][1], 17, '#9aa3b3'); crCirc(c, pts[2][0], pts[2][1], 24, '#f4f6fa');
}
function gEyes(c, mode, t, blink) {
  const y = 758, L = 468, R = 612; c.save(); c.shadowColor = '#4ff0d0'; c.shadowBlur = 20; c.strokeStyle = '#4ff0d0'; c.fillStyle = '#4ff0d0'; c.lineCap = 'round';
  if (blink && mode !== 'happy') { c.lineWidth = 12; [L, R].forEach(x => { c.beginPath(); c.moveTo(x - 26, y + 4); c.lineTo(x + 26, y + 4); c.stroke() }) }
  else if (mode === 'happy') { c.lineWidth = 13; [L, R].forEach(x => { c.beginPath(); c.arc(x, y + 16, 30, Math.PI * 1.12, Math.PI * 1.88); c.stroke() }) }
  else if (mode === 'down') { const dx = Math.sin(t * 3.1) * 7; [L, R].forEach(x => crRR(c, x - 15 + dx, y + 4, 30, 28, 13, '#4ff0d0')) }
  else if (mode === 'think') { const dx = Math.sin(t * 1.5) * 6; [L, R].forEach(x => crRR(c, x - 13 + 8 + dx, y - 30, 26, 40, 13, '#4ff0d0')); c.lineWidth = 9; c.beginPath(); c.moveTo(R - 24, y - 56); c.quadraticCurveTo(R, y - 70, R + 26, y - 60); c.stroke() }
  else if (mode === 'sad') { [L, R].forEach(x => crRR(c, x - 14, y - 4, 28, 34, 14, '#4ff0d0')); c.lineWidth = 10; c.beginPath(); c.moveTo(L - 34, y - 26); c.lineTo(L + 18, y - 46); c.moveTo(R + 34, y - 26); c.lineTo(R - 18, y - 46); c.stroke() }
  else if (mode === 'surprised') { c.lineWidth = 11; [L, R].forEach(x => { c.beginPath(); c.arc(x, y, 27, 0, Math.PI * 2); c.stroke() }) }
  else[L, R].forEach(x => crRR(c, x - 14, y - 22, 28, 46, 14, '#4ff0d0'));
  c.restore();
}
function gMouth(c, mode, m) {
  c.save(); c.shadowColor = '#4ff0d0'; c.shadowBlur = 14; c.strokeStyle = '#4ff0d0'; c.fillStyle = '#4ff0d0'; c.lineCap = 'round';
  if (mode === 'sad') { c.lineWidth = 9; c.beginPath(); c.arc(540, 852, 26, Math.PI * 1.2, Math.PI * 1.8); c.stroke() }
  else if (mode === 'smile') { c.lineWidth = 10; c.beginPath(); c.arc(540, 806, 32, Math.PI * 0.22, Math.PI * 0.78); c.stroke() }
  else if (mode === 'o') { c.lineWidth = 8; c.beginPath(); c.arc(540, 832, 14, 0, Math.PI * 2); c.stroke() }
  else if (mode === 'line') crRR(c, 516, 827, 48, 9, 4, '#4ff0d0');
  else if (mode === 'grin') { c.beginPath(); c.moveTo(506, 814); c.quadraticCurveTo(540, 822, 574, 814); c.quadraticCurveTo(572, 852, 540, 856); c.quadraticCurveTo(508, 852, 506, 814); c.closePath(); c.fill() }
  else { const h = 9 + m * 36, w = 62 - m * 12; crRR(c, 540 - w / 2, 830 - h / 2, w, h, Math.min(h / 2, 16), '#4ff0d0') }
  c.restore();
}
// o: armL, armR, armFront (davanti alla testa), eyes, mouth, m, blush, dy, tilt, bulb ('on' | 'party' | 'dim'), droop
function gRobot(c, t, o) {
  const bob = Math.sin(t * 2.4) * 5 + (o.dy || 0), blink = (t % 3.7) < 0.12 && !o.noBlink; c.save(); c.translate(0, bob);
  const bg = c.createLinearGradient(0, 930, 0, 1130); bg.addColorStop(0, '#f6f8fc'); bg.addColorStop(1, '#cbd2df'); crRR(c, 385, 928, 310, 220, 46, bg);
  crRR(c, 436, 972, 208, 86, 22, '#1b2133'); crHeart(c, 540, 1018, 26, '#ff4d5a');
  crRR(c, 508, 894, 64, 42, 12, '#a9b2c2');
  if (o.armL) gArm(c, o.armL); if (o.armR) gArm(c, o.armR);
  c.save(); if (o.tilt) { c.translate(540, 900); c.rotate(o.tilt); c.translate(-540, -900) }
  c.strokeStyle = '#9aa3b5'; c.lineWidth = 10; c.lineCap = 'round'; c.beginPath(); c.moveTo(540, 640);
  const tip = o.droop ? [562, 610] : [540, 600]; c.quadraticCurveTo(540, 618, tip[0], tip[1]); c.stroke();
  if (o.bulb === 'dim') crCirc(c, tip[0], tip[1] - 12, 22, '#6f7486');
  else {
    const on = o.bulb === 'party' ? (Math.floor(t * 6) % 2 === 0) : true;
    const ag = c.createRadialGradient(tip[0] - 8, tip[1] - 20, 4, tip[0], tip[1] - 12, 26); ag.addColorStop(0, on ? '#ffd0c6' : '#ffb6a8'); ag.addColorStop(1, on ? '#ff3b2b' : '#ff5747');
    if (on && o.bulb === 'party') { c.save(); c.shadowColor = '#ff5747'; c.shadowBlur = 40; crCirc(c, tip[0], tip[1] - 12, 22, ag); c.restore() } else crCirc(c, tip[0], tip[1] - 12, 22, ag);
  }
  crRR(c, 322, 730, 34, 96, 14, '#ff8a5c'); crRR(c, 724, 730, 34, 96, 14, '#ff8a5c');
  c.save(); c.shadowColor = 'rgba(0,0,0,.3)'; c.shadowBlur = 26; c.shadowOffsetY = 10; const hg = c.createLinearGradient(0, 640, 0, 900); hg.addColorStop(0, '#f8fafd'); hg.addColorStop(1, '#d3d9e4'); crRR(c, 345, 640, 390, 262, 72, hg); c.restore();
  const fg = c.createLinearGradient(0, 672, 0, 872); fg.addColorStop(0, '#1e2539'); fg.addColorStop(1, '#0e1322'); crRR(c, 377, 670, 326, 200, 56, fg);
  crRR(c, 397, 682, 286, 40, 20, 'rgba(255,255,255,.05)');
  if (o.occhioni) gOcchioni(c, t, o.occhioni, blink); else gEyes(c, o.eyes || 'normal', t, blink);
  if (o.blush) { c.globalAlpha = 0.55; c.beginPath(); c.ellipse(428, 808, 26, 13, 0, 0, Math.PI * 2); c.ellipse(652, 808, 26, 13, 0, 0, Math.PI * 2); c.fillStyle = '#ff7c9d'; c.fill(); c.globalAlpha = 1 }
  gMouth(c, o.mouth || 'talk', o.m || 0);
  c.restore();
  if (o.armFront) gArm(c, o.armFront); (o.fronts || []).forEach(a => gArm(c, a)); if (o.dito) gDito(c, o.dito[0], o.dito[1]);
  c.restore();
}
// gli occhioni: grandi, lucidi, con le pupille e i riflessi (o: look [dx,dy], size, squash, stelle)
function gOcchioni(c, t, o, blink) {
  const y = 760, r = 41 * (o.size == null ? 1 : o.size), sq = blink ? 0.12 : (o.squash || 1), lk = o.look || [0, 0];
  [468, 612].forEach((x, i) => {
    const cx = x + lk[0] * 0.5, cy = y + lk[1] * 0.4;
    c.save(); c.translate(cx, cy); c.scale(1, sq);
    c.shadowColor = '#4ff0d0'; c.shadowBlur = 24;
    const g = c.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.08, 0, 0, r); g.addColorStop(0, '#d4fff7'); g.addColorStop(0.5, '#4ff0d0'); g.addColorStop(1, '#16a594');
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fillStyle = g; c.fill(); c.shadowBlur = 0;
    if (!blink) {
      crCirc(c, lk[0] * 0.35, lk[1] * 0.35, r * 0.5, '#0b1a2a');
      if (o.stelle) { star(c, lk[0] * 0.35, lk[1] * 0.35, r * 0.42, 1) }
      else { crCirc(c, -r * 0.3 + lk[0] * 0.2, -r * 0.33 + lk[1] * 0.2, r * 0.25, '#ffffff'); crCirc(c, r * 0.28 + lk[0] * 0.2, r * 0.26 + lk[1] * 0.2, r * 0.11, 'rgba(255,255,255,.85)') }
    }
    c.restore();
  });
}
// un dito che indica (da un punto della mano, verso una direzione)
function gDito(c, p, d) { c.save(); c.strokeStyle = '#f4f6fa'; c.lineWidth = 15; c.lineCap = 'round'; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0] + d[0], p[1] + d[1]); c.stroke(); c.restore() }
// la scena di base con l'inquadratura: z = zoom, (cx, cy) = punto inquadrato al centro
// l'insegna (y 1274) resta all'altezza delle puntate, sopra i sottotitoli: il centro dell'inquadratura dipende dallo zoom
const cyInsegna = z => 1274 - 314 / z;
function gScene(c, cam, back, front, robot) {
  c.save(); c.translate(540, 960); c.scale(cam.z, cam.z); c.translate(-cam.cx, -cam.cy);
  c.drawImage(back, 0, 0); robot(); c.drawImage(front, 0, 0); crJar(c); if (cam.extra) cam.extra(); c.restore();
}
function rnd(seed) { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296 } }
function star(c, x, y, r, a) { c.save(); c.globalAlpha = a; c.fillStyle = '#fff6c9'; c.shadowColor = '#ffe27a'; c.shadowBlur = 18; c.beginPath();
  for (let i = 0; i < 8; i++) { const ang = i * Math.PI / 4, rr = i % 2 ? r * 0.28 : r; c.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr) } c.closePath(); c.fill(); c.restore() }

/* ---------- 1. festeggia: braccia al cielo, coriandoli, la camera si avvicina ---------- */
G.coriandoli = (() => { const r = rnd(42), L = []; const col = ['#ff2d6f', '#25f4ee', '#ffd23f', '#4ff0d0', '#ffffff', '#ff8a5c'];
  for (let i = 0; i < 300; i++) L.push({ x: r() * 1080, y: -60 - r() * 900, vx: (r() - 0.5) * 140, vy: 260 + r() * 360, w: 14 + r() * 14, h: 8 + r() * 8, rot: r() * 6, vr: (r() - 0.5) * 9, sw: r() * 6, c: col[Math.floor(r() * col.length)], t0: i < 170 ? 0.45 + r() * 0.5 : 2.7 + r() * 0.8 });
  return L })();
G.festeggia = function (c, t) {
  const k = ease(t / 0.55), z = 1.1 + 0.32 * ease(t / 6), shake = t > 0.5 && t < 0.8 ? Math.sin(t * 90) * 6 * (0.8 - t) / 0.3 : 0;
  const a = Math.sin((t - 0.55) * 7.5), up = t > 0.55;
  const L = [[392, 986], [316, 884], [266, 748 - (up ? 46 * Math.max(0, a) : 0)]], R = [[688, 986], [764, 884], [814, 748 - (up ? 46 * Math.max(0, -a) : 0)]];
  gScene(c, { z, cx: 540 + shake, cy: cyInsegna(z) }, G.backBlur, G.front, () => gRobot(c, t, {
    armL: mixPts(RIPOSO_L, L, k), armR: mixPts(RIPOSO_R, R, k), eyes: t < 0.35 ? 'normal' : 'happy', mouth: 'talk', m: up ? 0.45 + 0.4 * Math.abs(Math.sin(t * 6)) : 0.2, blush: true, bulb: up ? 'party' : 'on'
  }));
  // brillantini intorno alla testa
  [[300, 520, 0.0], [820, 470, 0.7], [210, 860, 1.3], [880, 820, 1.9], [700, 380, 2.6]].forEach(([x, y, p], i) => { const q = (t - 0.6 - p * 0.5) % 1.6; if (t > 0.6 && q >= 0 && q < 0.8) star(c, x, y, 26 + i * 3, Math.sin(q / 0.8 * Math.PI)) });
  // coriandoli in primo piano
  G.coriandoli.forEach(p => { const d = t - p.t0; if (d < 0) return; const x = p.x + p.vx * d + Math.sin(d * 3 + p.sw) * 30, y = p.y + p.vy * d + 60 * d * d;
    if (y > 2000) return; c.save(); c.translate(x, y); c.rotate(p.rot + p.vr * d); c.scale(1, Math.cos(d * 5 + p.sw)); c.fillStyle = p.c; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); c.restore() });
};

/* ---------- 2. lavora: al portatile, simboli di codice che salgono, alla fine «fatto» ---------- */
G.lavora = function (c, t) {
  const z = 1.34, cx = 528 + 24 * ease(t / 6), done = t > 4.7;
  const ty = (s, p) => 1080 + 9 * Math.abs(Math.sin(t * s + p));
  const L = done ? mixPts([[392, 986], [372, 1062], [470, ty(21, 0)]], [[392, 986], [316, 884], [270, 760]], ease((t - 4.7) / 0.35)) : [[392, 986], [372, 1062], [470 + 8 * Math.sin(t * 13), ty(21, 0)]];
  const R = done ? mixPts([[688, 986], [708, 1062], [610, ty(23, 1)]], [[688, 986], [764, 884], [810, 760]], ease((t - 4.7) / 0.35)) : [[688, 986], [708, 1062], [610 + 8 * Math.sin(t * 11 + 2), ty(23, 1)]];
  gScene(c, { z, cx, cy: cyInsegna(z), extra: () => {
    // il portatile visto da dietro, con il cuore che si illumina
    c.save(); c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 30; c.shadowOffsetY = 12;
    const lg = c.createLinearGradient(0, 952, 0, 1118); lg.addColorStop(0, '#d9dde7'); lg.addColorStop(1, '#a3aabb'); crRR(c, 372, 952, 336, 168, 22, lg); c.restore();
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 3; crRR(c, 376, 956, 328, 160, 20); c.stroke();
    c.save(); c.shadowColor = '#4ff0d0'; c.shadowBlur = 26 + 10 * Math.sin(t * 4); crHeart(c, 540, 1036, 26, done ? '#ff4d5a' : 'rgba(255,255,255,.95)'); c.restore();
  } }, G.backNotte, G.front, () => {
    gRobot(c, t, { armL: L, armR: R, eyes: done ? 'happy' : 'down', mouth: done ? 'talk' : (Math.floor(t * 1.3) % 3 === 2 ? 'smile' : 'line'), m: done ? 0.6 : 0, blush: done, bulb: 'on' });
    // luce dello schermo sulla faccia
    c.save(); c.globalCompositeOperation = 'lighter'; const gl = c.createRadialGradient(540, 840, 20, 540, 860, 260); gl.addColorStop(0, `rgba(79,240,208,${done ? 0.08 : 0.16})`); gl.addColorStop(1, 'rgba(79,240,208,0)'); c.fillStyle = gl; c.fillRect(280, 600, 520, 520); c.restore();
  });
  // simboli di codice che salgono dal portatile (in primo piano, nello spazio dello schermo)
  const S = ['{ }', '</>', '( )', '01', '=>', '[ ]', '#', ';'], r = rnd(7);
  for (let i = 0; i < 14; i++) { const t0 = i * 0.33 + r() * 0.2, d = t - t0; if (d < 0 || d > 2.2 || t0 > 4.6) continue;
    const x = (i % 2 ? 790 + r() * 160 : 130 + r() * 160) + Math.sin(d * 2 + i) * 24, y = 1010 - d * 290, a = Math.min(1, d / 0.25) * Math.max(0, 1 - d / 2.2);
    c.save(); c.globalAlpha = a; c.font = '900 72px "DejaVu Sans Mono", monospace'; c.textAlign = 'center'; c.fillStyle = '#9ffcef'; c.shadowColor = '#4ff0d0'; c.shadowBlur = 24; c.fillText(S[i % S.length], x, y); c.restore() }
  // ingranaggi che girano
  const gear = (x, y, r0, n, ang, col) => { c.save(); c.translate(x, y); c.rotate(ang); c.fillStyle = col; c.beginPath();
    for (let i = 0; i < n * 2; i++) { const a0 = i * Math.PI / n, rr = i % 2 ? r0 : r0 * 1.22; c.lineTo(Math.cos(a0) * rr, Math.sin(a0) * rr) } c.closePath(); c.fill(); crCirc(c, 0, 0, r0 * 0.42, '#20233a'); c.restore() };
  if (!done) { c.save(); c.globalAlpha = 0.85; gear(880, 420, 46, 9, t * 1.6, '#ffd23f'); gear(812, 352, 30, 7, -t * 2.3, '#ff8a5c'); c.restore() }
  // fatto: spunta verde
  if (done) { const k = ease((t - 4.75) / 0.3), sc = 0.6 + 0.4 * k + 0.08 * Math.sin(Math.min(1, (t - 4.75) / 0.5) * Math.PI);
    c.save(); c.translate(830, 330); c.scale(sc * 0.85, sc * 0.85); c.globalAlpha = k; c.shadowColor = 'rgba(23,169,90,.8)'; c.shadowBlur = 40; crCirc(c, 0, 0, 92, '#17a95a'); c.shadowBlur = 0;
    c.strokeStyle = '#fff'; c.lineWidth = 22; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(-40, 4); c.lineTo(-10, 36); c.lineTo(44, -30); c.stroke(); c.restore();
    [[700, 250], [960, 260], [690, 420], [960, 440]].forEach(([x, y], i) => star(c, x, y, 22, Math.max(0, Math.sin(Math.min(1, (t - 4.8 - i * 0.08) / 0.6) * Math.PI)))) }
};

/* ---------- 3. pensa: mano sul mento, nuvoletta col punto di domanda, poi la lampadina ---------- */
G.pensa = function (c, t) {
  const z = 1.3 + 0.08 * ease(t / 6), eureka = t > 3.4, k = ease((t - 3.4) / 0.3);
  const chin = [[688, 986], [772, 1028], [604, 906 + 4 * Math.sin(t * 6)]], su = [[688, 986], [770, 920], [800, 786]];
  const arm = eureka ? mixPts(chin, su, k) : chin;
  gScene(c, { z, cx: 600, cy: cyInsegna(z) }, G.backBlur, G.front, () => gRobot(c, t, {
    armL: RIPOSO_L, armFront: arm, eyes: eureka ? (t < 3.75 ? 'surprised' : 'happy') : 'think', mouth: eureka ? (t < 3.75 ? 'o' : 'talk') : 'line', m: eureka ? 0.55 : 0,
    blush: eureka, tilt: eureka ? 0 : 0.05 * Math.sin(t * 1.2), bulb: 'on'
  }));
  // nuvoletta (nello spazio dello schermo, in alto a destra)
  const pop = (t0, d) => { const q = (t - t0) / d; return q <= 0 ? 0 : q >= 1 ? 1 : 1 + Math.sin(q * Math.PI) * 0.25 - (1 - q) * 0.25 };
  c.save(); c.fillStyle = '#fbf8f1'; c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 24; c.shadowOffsetY = 8;
  [[735, 478, 12, 0.5], [772, 448, 17, 0.7], [808, 418, 22, 0.9]].forEach(([x, y, r0, t0]) => { const s = pop(t0, 0.25); if (s > 0) crCirc(c, x, y, r0 * s, '#fbf8f1') });
  const sb = pop(1.1, 0.35);
  if (sb > 0) { c.translate(872, 350); c.scale(sb * 0.72, sb * 0.72); c.beginPath();
    [[-120, 20, 78], [-40, -40, 92], [60, -36, 88], [130, 24, 74], [40, 64, 82], [-60, 66, 76]].forEach(([x, y, r0]) => { c.moveTo(x + r0, y); c.arc(x, y, r0, 0, Math.PI * 2) }); c.fill(); c.shadowColor = 'transparent';
    if (!eureka) { c.fillStyle = '#1b2133'; c.font = `900 ${150 + 10 * Math.sin(t * 5)}px ${CR_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 0, 14) }
    else { const b = 0.7 + 0.3 * ease((t - 3.4) / 0.25);
      c.save(); c.scale(b, b); c.shadowColor = '#ffd23f'; c.shadowBlur = 50; crCirc(c, 0, -16, 62, '#ffd23f'); c.shadowBlur = 0; crRR(c, -30, 40, 60, 26, 8, '#9aa3b3'); crRR(c, -26, 70, 52, 16, 8, '#7d8394');
      c.strokeStyle = '#fff3b0'; c.lineWidth = 6; c.beginPath(); c.moveTo(-18, 6); c.lineTo(-6, -24); c.lineTo(6, -6); c.lineTo(18, -30); c.stroke();
      c.strokeStyle = '#ffd23f'; c.lineWidth = 9; c.lineCap = 'round'; const ray = 18 * Math.sin(Math.min(1, (t - 3.4) / 0.4) * Math.PI / 2);
      for (let i = 0; i < 8; i++) { const a0 = -Math.PI / 2 + (i - 3.5) * 0.42; c.beginPath(); c.moveTo(Math.cos(a0) * 84, -16 + Math.sin(a0) * 84); c.lineTo(Math.cos(a0) * (98 + ray), -16 + Math.sin(a0) * (98 + ray)); c.stroke() } c.restore() } }
  c.restore();
};

/* ---------- 4. triste: spalle giù, nuvola con la pioggia sopra la testa ---------- */
G.triste = function (c, t) {
  const z = 1.06 + 0.08 * ease(t / 5);
  gScene(c, { z, cx: 540, cy: cyInsegna(z) }, G.backTriste, G.frontTriste, () => {
    gRobot(c, t * 0.7, { armL: [[392, 990], [376, 1068], [432, 1114]], armR: [[688, 990], [704, 1068], [648, 1114]], eyes: 'sad', mouth: 'sad', dy: 16, tilt: -0.035, bulb: 'dim', droop: true });
  });
  c.save(); c.fillStyle = 'rgba(30,48,96,.2)'; c.fillRect(0, 0, 1080, 1920); c.restore();
  // la nuvoletta con la pioggia (si muove appena)
  const cx = 540 + Math.sin(t * 1.1) * 14, cy = 380 + Math.sin(t * 1.7) * 6;
  const r = rnd(5);
  c.save(); c.strokeStyle = 'rgba(170,200,255,.75)'; c.lineWidth = 5; c.lineCap = 'round';
  for (let i = 0; i < 26; i++) { const x0 = cx - 150 + r() * 300, sp = 520 + r() * 220, ph = r(); const y = cy + 60 + ((t * sp / 260 + ph) % 1) * 190;
    if (y > cy + 210) continue; c.globalAlpha = 0.85 * Math.min(1, (cy + 210 - y) / 40); c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 - 6, y + 34); c.stroke() }
  c.restore();
  c.save(); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 30; c.shadowOffsetY = 10; const cg = c.createLinearGradient(0, cy - 120, 0, cy + 70); cg.addColorStop(0, '#9aa3b8'); cg.addColorStop(1, '#5f677e'); c.fillStyle = cg; c.beginPath();
  [[-140, 20, 74], [-60, -30, 90], [40, -44, 98], [130, 4, 80], [70, 44, 70], [-40, 46, 72]].forEach(([x, y, r0]) => { c.moveTo(cx + x + r0, cy + y); c.arc(cx + x, cy + y, r0, 0, Math.PI * 2) }); c.fill(); c.restore();
};

/* ---------- 5. meraviglia: occhioni che si accendono, mani sulle guance, brillantini ---------- */
G.meraviglia = function (c, t) {
  const pop = t < 0.45 ? 0 : Math.min(1, (t - 0.45) / 0.22), over = pop < 1 ? pop : 1 + 0.12 * Math.max(0, Math.sin(Math.min(1, (t - 0.67) / 0.35) * Math.PI));
  const z = 1.18 + (t > 0.45 ? 0.1 * ease((t - 0.45) / 0.3) : 0) + 0.06 * ease(t / 6), k = ease((t - 0.45) / 0.3), giu = ease((t - 4.6) / 0.5);
  const guance = [[[392, 986], [318, 940], [350, 862]], [[688, 986], [762, 940], [730, 862]]];
  const L = mixPts(mixPts(RIPOSO_L, guance[0], k), RIPOSO_L, giu), R = mixPts(mixPts(RIPOSO_R, guance[1], k), RIPOSO_R, giu);
  const lk = t > 1.6 && t < 4.4 ? [Math.sin((t - 1.6) * 2.2) * 26, -4] : [0, 0];
  gScene(c, { z, cx: 540, cy: cyInsegna(z) }, G.backBlur, G.front, () => gRobot(c, t, {
    armL: null, armR: null, fronts: [L, R], occhioni: { size: 0.55 + 0.45 * over, look: lk }, mouth: t < 0.45 ? 'line' : t < 1.4 ? 'o' : 'grin', blush: t > 0.45, bulb: t > 0.45 ? 'party' : 'on'
  }));
  [[250, 600], [830, 560], [190, 900], [890, 880], [540, 300], [330, 380], [760, 360]].forEach(([x, y], i) => { const q = (t - 0.5 - i * 0.12) % 1.4; if (t > 0.5 && q >= 0 && q < 0.7) star(c, x, y, 20 + (i % 3) * 8, Math.sin(q / 0.7 * Math.PI)) });
};

/* ---------- 6. ascolta: mano dietro l'orecchio, occhioni verso di te, arrivano i commenti ---------- */
G.ascolta = function (c, t) {
  const z = 1.3, k = ease((t - 0.2) / 0.45), nod = Math.sin(t * 3.2) * 0.03;
  const orecchio = [[688, 986], [796, 918], [772, 790]];
  gScene(c, { z, cx: 560, cy: cyInsegna(z) }, G.backBlur, G.front, () => gRobot(c, t, {
    armL: RIPOSO_L, armR: null, fronts: [mixPts(RIPOSO_R, orecchio, k)], occhioni: { size: 1, look: [-10 + Math.sin(t * 0.9) * 8, 2] }, mouth: Math.floor(t * 0.8) % 2 ? 'smile' : 'o', blush: true, tilt: 0.06 + nod, bulb: 'on'
  }));
  // nuvolette di commento che salgono a sinistra
  for (let i = 0; i < 6; i++) { const t0 = 0.6 + i * 0.75, d = t - t0; if (d < 0 || d > 2.6) continue;
    const x = 150 + (i % 2) * 120, y = 1060 - d * 230, a = Math.min(1, d / 0.2) * Math.max(0, 1 - d / 2.6), sc = 0.8 + 0.2 * Math.min(1, d / 0.25);
    c.save(); c.globalAlpha = a; c.translate(x, y); c.scale(sc, sc); c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 16; crRR(c, -70, -38, 140, 76, 26, '#fbf8f1'); c.shadowBlur = 0;
    c.beginPath(); c.moveTo(-30, 36); c.lineTo(-46, 62); c.lineTo(-6, 36); c.closePath(); c.fillStyle = '#fbf8f1'; c.fill();
    if (i % 3 === 1) crHeart(c, 0, 2, 20, '#ff4d5a'); else [-30, 0, 30].forEach((dx, j) => crCirc(c, dx, 0, 9, j === Math.floor(t * 4) % 3 ? '#1b2133' : '#8a8f9c'));
    c.restore() }
};

/* ---------- 7. indica: «nei commenti!», il dito verso il basso, le lettere A B C che scendono ---------- */
G.indica = function (c, t) {
  const z = 1.24, k = ease((t - 0.15) / 0.4), b = Math.sin(t * 7) * 10;
  const giu = [[688, 986], [786, 1004], [842, 1078 + b * 0.4]];
  gScene(c, { z, cx: 580, cy: cyInsegna(z) }, G.backBlur, G.front, () => gRobot(c, t, {
    armL: RIPOSO_L, armR: null, fronts: [mixPts(RIPOSO_R, giu, k)], dito: k > 0.8 ? [[842, 1078 + b * 0.4], [10, 34]] : null,
    occhioni: { size: 1, look: [14, 18] }, mouth: 'grin', blush: true, bulb: 'on'
  }));
  // freccia che rimbalza verso il basso, a destra
  c.save(); c.translate(948, 1040 + Math.abs(Math.sin(t * 5)) * 46); c.strokeStyle = '#4ff0d0'; c.lineWidth = 20; c.lineCap = 'round'; c.lineJoin = 'round'; c.shadowColor = '#4ff0d0'; c.shadowBlur = 24;
  c.beginPath(); c.moveTo(0, -70); c.lineTo(0, 40); c.moveTo(-40, 4); c.lineTo(0, 44); c.lineTo(40, 4); c.stroke(); c.restore();
  // le lettere del voto che scendono a turno lungo il lato destro
  ['A', 'B', 'C'].forEach((L, i) => { const d = ((t - 0.5 - i * 0.55) % 1.65 + 1.65) % 1.65; if (t < 0.5 + i * 0.55) return;
    const y = 420 + d * 330, a = Math.min(1, d / 0.2) * Math.max(0, 1 - (d - 1.3) / 0.35); if (a <= 0) return;
    c.save(); c.globalAlpha = Math.min(1, a); c.translate(948, y); c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 18; crCirc(c, 0, 0, 52, '#1b2133'); c.shadowBlur = 0;
    c.strokeStyle = '#4ff0d0'; c.lineWidth = 6; c.beginPath(); c.arc(0, 0, 52, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#4ff0d0'; c.font = `900 60px ${CR_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(L, 0, 3); c.restore() });
};

/* ---------- 8. regalo: il pacco sul banco si apre e ne esce il telefono con l'app ---------- */
G.regalo = function (c, t) {
  const z = 1.22, aperto = t > 1.35, ka = ease((t - 1.35) / 0.35), sale = ease((t - 1.6) / 1.0);
  const mani = [[688, 986], [740, 1040], [742, 1000]];
  const R = t < 1.35 ? mixPts(RIPOSO_R, mani, ease((t - 0.2) / 0.5)) : mixPts(mani, [[688, 986], [764, 884], [814, 748]], ease((t - 2.4) / 0.4));
  const L = t < 2.4 ? RIPOSO_L : mixPts(RIPOSO_L, [[392, 986], [316, 884], [266, 748]], ease((t - 2.4) / 0.4));
  gScene(c, { z, cx: 600, cy: cyInsegna(z), extra: () => {
    const bx = 760, by = 1118;   // il pacco sul banco, a destra
    if (aperto) { c.save(); c.globalCompositeOperation = 'lighter'; const gl = c.createRadialGradient(bx, by - 120, 10, bx, by - 120, 260); gl.addColorStop(0, `rgba(255,236,170,${0.55 * ka})`); gl.addColorStop(1, 'rgba(255,220,140,0)'); c.fillStyle = gl; c.fillRect(bx - 280, by - 400, 560, 420); c.restore() }
    // il telefono che sale dal pacco
    if (t > 1.6) { const py = by - 60 - sale * 330; c.save(); c.translate(bx, py); c.rotate(0.06 * Math.sin(t * 2)); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 24;
      crRR(c, -62, -110, 124, 220, 24, '#1b2133'); c.shadowBlur = 0; crRR(c, -52, -96, 104, 192, 16, '#25304a');
      const g = c.createLinearGradient(-34, -40, 34, 30); g.addColorStop(0, '#25f4ee'); g.addColorStop(1, '#ff2d6f'); crRR(c, -36, -40, 72, 72, 18, g); crHeart(c, 0, -2, 18, '#fff');
      c.restore() }
    const g2 = c.createLinearGradient(0, by - 120, 0, by); g2.addColorStop(0, '#ff4d6d'); g2.addColorStop(1, '#c9304d');
    c.save(); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 20; c.shadowOffsetY = 8; crRR(c, bx - 90, by - 118, 180, 118, 10, g2); c.restore();
    c.fillStyle = '#25f4ee'; c.fillRect(bx - 14, by - 118, 28, 118);
    // il coperchio: prima chiuso, poi vola via
    c.save(); if (aperto) { c.translate(bx + ka * 170, by - 132 - ka * 260); c.rotate(ka * 0.9); c.globalAlpha = 1 - ka * 0.9 } else { c.translate(bx, by - 132 + Math.sin(t * 18) * (t > 0.7 ? 3 : 0)) }
    crRR(c, -100, -16, 200, 32, 8, '#ff5c79'); c.fillStyle = '#25f4ee'; c.fillRect(-14, -16, 28, 32);
    c.strokeStyle = '#25f4ee'; c.lineWidth = 10; c.beginPath(); c.ellipse(-22, -30, 22, 13, -0.5, 0, Math.PI * 2); c.ellipse(22, -30, 22, 13, 0.5, 0, Math.PI * 2); c.stroke(); c.restore();
  } }, G.backBlur, G.front, () => gRobot(c, t, {
    armL: L, armR: null, fronts: [R], occhioni: { size: aperto ? 1.08 : 1, look: t < 2.4 ? [26, 14 - sale * 30] : [0, 0], stelle: t > 2.4 }, mouth: aperto ? 'grin' : 'o', blush: true, bulb: aperto ? 'party' : 'on'
  }));
  if (aperto) [[640, 520], [900, 480], [600, 760], [960, 720], [780, 380]].forEach(([x, y], i) => { const q = (t - 1.45 - i * 0.1) % 1.2; if (q >= 0 && q < 0.6) star(c, x, y, 22 + (i % 2) * 10, Math.sin(q / 0.6 * Math.PI)) });
};

/* ---------- 9. ciao: saluto grande da vicino, cuoricini che salgono ---------- */
G.ciao = function (c, t) {
  const z = 1.42 - 0.16 * ease(t / 5), a = Math.sin(t * 8) * 0.38, k = ease((t - 0.1) / 0.35);
  const ex = 786, ey = 880, hx = ex + Math.sin(0.25 + a) * 96, hy = ey - Math.cos(0.25 + a) * 96;
  gScene(c, { z, cx: 560, cy: cyInsegna(z) }, G.backBlur, G.front, () => gRobot(c, t, {
    armL: RIPOSO_L, armR: null, fronts: [mixPts(RIPOSO_R, [[688, 986], [ex, ey], [hx, hy]], k)], occhioni: { size: 1, look: [0, 0], squash: (t % 2.2) < 1.1 ? 1 : 0.62 }, mouth: 'grin', blush: true, bulb: 'on'
  }));
  for (let i = 0; i < 7; i++) { const t0 = 0.4 + i * 0.62, d = t - t0; if (d < 0 || d > 2) continue;
    const x = 860 + Math.sin(d * 3 + i) * 34 + (i % 2 ? 60 : -20), y = 640 - d * 260, al = Math.min(1, d / 0.2) * Math.max(0, 1 - d / 2);
    c.save(); c.globalAlpha = al; c.shadowColor = '#ff4d6d'; c.shadowBlur = 18; crHeart(c, x, y, 22 + (i % 3) * 6, '#ff4d6d'); c.restore() }
};

/* ============================================================
   Seconda serie (ottobre 2026), presa dal video di prova di Sam: tramonto al mercato,
   cassette di frutta sul banco, il telefono con l'app in mano, le icone che volano,
   le mani in testa. Più le scene per le idee della settimana 12-18 ottobre.
   ============================================================ */

// le cassette di frutta sul banco (come nel video di prova): mele, pomodori, arance
function gFrutta(c) {
  const cassa = (x, w, col, n) => {
    const y = 1118; c.save(); c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 14; c.shadowOffsetY = 6;
    const g = c.createLinearGradient(0, y - 46, 0, y); g.addColorStop(0, '#c58b55'); g.addColorStop(1, '#8a5a33'); crRR(c, x, y - 46, w, 46, 8, g); c.restore();
    c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + 6, y - 24); c.lineTo(x + w - 6, y - 24); c.stroke();
    const r = rnd(n * 13 + w);
    for (let row = 0; row < 2; row++) for (let i = 0; i < n - row; i++) {
      const fx = x + 22 + i * ((w - 44) / Math.max(1, n - 1)) + row * ((w - 44) / Math.max(1, n - 1)) / 2, fy = y - 52 - row * 24 + r() * 4;
      const fg = c.createRadialGradient(fx - 7, fy - 8, 2, fx, fy, 21); fg.addColorStop(0, '#fff3e0'); fg.addColorStop(0.25, col[0]); fg.addColorStop(1, col[1]);
      crCirc(c, fx, fy, 20, fg);
    }
  };
  cassa(96, 150, ['#ff6b5a', '#b8231c'], 4);            // pomodori
  cassa(838, 146, ['#ffb347', '#e0731c'], 4);           // arance
}
// un telefono con lo schermo dell'app (lista con le spunte), in coordinate locali
function gTelefono(c, x, y, s, rot, t, schermo) {
  c.save(); c.translate(x, y); c.rotate(rot || 0); c.scale(s, s);
  c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 30; c.shadowOffsetY = 10; crRR(c, -78, -150, 156, 300, 30, '#1b2133'); c.shadowBlur = 0; c.shadowOffsetY = 0;
  crRR(c, -68, -138, 136, 276, 22, '#fbf8f1'); crRR(c, -22, -132, 44, 10, 5, '#1b2133');
  if (schermo) schermo(c); else {
    crRR(c, -56, -112, 112, 30, 8, '#4ff0d0'); c.fillStyle = '#1b2133'; c.font = `900 18px ${CR_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('LA MIA APP', 0, -96);
    for (let i = 0; i < 5; i++) { const yy = -62 + i * 38, on = t > 0.6 + i * 0.35;
      crCirc(c, -42, yy, 11, on ? '#17a95a' : '#d6d0c2'); if (on) { c.strokeStyle = '#fff'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(-47, yy); c.lineTo(-43, yy + 4); c.lineTo(-36, yy - 4); c.stroke() }
      crRR(c, -24, yy - 6, 70 - (i % 2) * 18, 12, 6, on ? '#c9c2b3' : '#8a8f9c') }
  }
  c.restore();
}
// un'icona rotonda (generica, nessun marchio): carrello, nuvoletta, cuore, freccia di condivisione
function gIcona(c, x, y, r, tipo, col, a) {
  c.save(); c.globalAlpha = a; c.translate(x, y); c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 16; crCirc(c, 0, 0, r, col); c.shadowBlur = 0;
  c.strokeStyle = '#fff'; c.fillStyle = '#fff'; c.lineWidth = r * 0.12; c.lineCap = 'round'; c.lineJoin = 'round'; const k = r / 40;
  if (tipo === 'carrello') { c.beginPath(); c.moveTo(-20 * k, -14 * k); c.lineTo(-12 * k, -14 * k); c.lineTo(-6 * k, 8 * k); c.lineTo(16 * k, 8 * k); c.lineTo(20 * k, -6 * k); c.lineTo(-9 * k, -6 * k); c.stroke(); crCirc(c, -3 * k, 16 * k, 4 * k, '#fff'); crCirc(c, 13 * k, 16 * k, 4 * k, '#fff') }
  else if (tipo === 'chat') { crRR(c, -20 * k, -16 * k, 40 * k, 28 * k, 10 * k, '#fff'); c.beginPath(); c.moveTo(-8 * k, 10 * k); c.lineTo(-14 * k, 22 * k); c.lineTo(2 * k, 10 * k); c.fill(); [-9, 0, 9].forEach(dx => crCirc(c, dx * k, -2 * k, 3.4 * k, col)) }
  else if (tipo === 'cuore') crHeart(c, 0, 2 * k, 18 * k, '#fff');
  else if (tipo === 'condividi') { [[-12, 0], [12, -13], [12, 13]].forEach(([px, py]) => crCirc(c, px * k, py * k, 6 * k, '#fff')); c.beginPath(); c.moveTo(12 * k, -13 * k); c.lineTo(-12 * k, 0); c.lineTo(12 * k, 13 * k); c.stroke() }
  c.restore();
}
// la puntina della mappa
function gPin(c, x, y, s, col) { c.save(); c.translate(x, y); c.scale(s, s); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 16; c.shadowOffsetY = 6;
  c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-30, -38, -36, -58, -36, -72); c.arc(0, -72, 36, Math.PI, 0); c.bezierCurveTo(36, -58, 30, -38, 0, 0); c.fillStyle = col; c.fill(); c.shadowBlur = 0; crCirc(c, 0, -72, 14, '#fff'); c.restore() }
// una nuvoletta rotonda (fumetto) nello spazio dello schermo
function gBolla(c, x, y, w, h, s, coda) { c.save(); c.translate(x, y); c.scale(s, s); c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 24; c.shadowOffsetY = 8;
  crRR(c, -w / 2, -h / 2, w, h, 40, '#fbf8f1'); if (coda) { c.beginPath(); c.moveTo(coda[0], h / 2 - 4); c.lineTo(coda[0] + coda[1], h / 2 + 46); c.lineTo(coda[0] + 46, h / 2 - 4); c.fillStyle = '#fbf8f1'; c.fill() } c.restore() }
const popK = (t, t0, d) => { const q = (t - t0) / d; return q <= 0 ? 0 : q >= 1 ? 1 : 1 + Math.sin(q * Math.PI) * 0.22 - (1 - q) * 0.22 };

/* ---------- 10. telefono: alza il telefono con l'app e lo fa vedere (come nel video di prova) ---------- */
G.telefono = function (c, t) {
  const z = 1.2 + 0.1 * ease(t / 6), k = ease((t - 0.2) / 0.5);
  const mano = [[688, 986], [800, 960], [812, 880]];
  const ph = [lerp(760, 846, k), lerp(1100, 860, k)];
  gScene(c, { z, cx: 600, cy: cyInsegna(z), extra: () => {
    gFrutta(c);
    gTelefono(c, ph[0], ph[1], 0.95, -0.08 + 0.03 * Math.sin(t * 1.6), t - 0.7);
    if (t > 2.6) { const d = t - 2.6; const tap = (d % 1.1) < 0.18; c.save(); c.globalAlpha = 0.5 * (1 - (d % 1.1) / 1.1); c.strokeStyle = '#4ff0d0'; c.lineWidth = 6; c.beginPath(); c.arc(ph[0] - 10, ph[1] + 10, 20 + (d % 1.1) * 50, 0, Math.PI * 2); c.stroke(); c.restore(); if (tap) crCirc(c, ph[0] - 10, ph[1] + 10, 14, 'rgba(79,240,208,.6)') }
  } }, G.back, G.front, () => gRobot(c, t, {
    armL: t > 2.4 ? mixPts(RIPOSO_L, [[392, 986], [520, 1010], [ph[0] - 70, ph[1] + 40]], ease((t - 2.4) / 0.4)) : RIPOSO_L, armR: null, fronts: [mixPts(RIPOSO_R, mano, k)],
    occhioni: { size: 1, look: t < 1.8 || (t > 3.4 && t < 4.6) ? [34, 6] : [0, 0] }, mouth: t < 1.8 ? 'o' : 'grin', blush: true, bulb: 'on'
  }));
  [[880, 620], [990, 760], [720, 560]].forEach(([x, y], i) => { const q = (t - 1 - i * 0.3) % 1.5; if (t > 1 && q >= 0 && q < 0.7) star(c, x, y, 22, Math.sin(q / 0.7 * Math.PI)) });
};

/* ---------- 11. condividi: dal telefono volano su le icone (carrello, messaggi, cuori, condividi) ---------- */
G.condividi = function (c, t) {
  const z = 1.16, k = ease((t - 0.15) / 0.45);
  const ph = [lerp(760, 820, k), lerp(1100, 900, k)];
  gScene(c, { z, cx: 580, cy: cyInsegna(z), extra: () => { gFrutta(c); gTelefono(c, ph[0], ph[1], 0.85, -0.12, 9) } }, G.back, G.front, () => gRobot(c, t, {
    armL: RIPOSO_L, armR: null, fronts: [mixPts(RIPOSO_R, [[688, 986], [780, 990], [796, 920]], k)], occhioni: { size: 1, look: [-6, -12] }, mouth: 'grin', blush: true, bulb: 'party'
  }));
  const tipi = [['carrello', '#ff8a5c'], ['chat', '#17a95a'], ['cuore', '#ff2d6f'], ['condividi', '#2f8cff']];
  for (let i = 0; i < 9; i++) { const t0 = 0.8 + i * 0.45, d = t - t0; if (d < 0 || d > 2.4) continue;
    const [tp, col] = tipi[i % 4], dir = (i % 3) - 1, x = 640 + dir * 230 * ease(d / 1.2) + Math.sin(d * 3 + i) * 20, y = 560 - d * 170 - 40 * ease(d / 0.6);
    const a = Math.min(1, d / 0.2) * Math.max(0, 1 - (d - 1.7) / 0.7), s = 0.6 + 0.4 * Math.min(1, d / 0.3);
    gIcona(c, x, y, 50 * s, tp, col, a) }
};

/* ---------- 12. piazza: la domenica la bancarella arriva in una piazza nuova ---------- */
G.piazza = function (c, t) {
  const arr = ease(t / 1.6), sx = (1 - arr) * 1100, sobbalzo = t < 1.6 ? Math.abs(Math.sin(t * 14)) * 10 * (1 - arr) : 0;
  const z = 0.98 + 0.16 * ease((t - 1.6) / 4);
  // il cielo resta fermo, la bancarella entra da destra
  c.drawImage(G.backBlur, 0, 0, 1080, 1150, 0, 0, 1080, 1150);
  c.fillStyle = '#23212e'; c.fillRect(0, 1150, 1080, 770);
  c.save(); c.translate(sx, -sobbalzo);
  gScene(c, { z, cx: 540, cy: cyInsegna(z), extra: () => { gFrutta(c);
    // le ruote del carretto sotto il banco
    [250, 830].forEach(x => { c.save(); c.translate(x, 1440); c.rotate(-sx / 60); crCirc(c, 0, 0, 62, '#2a2230'); crCirc(c, 0, 0, 44, '#8a6240'); c.strokeStyle = '#2a2230'; c.lineWidth = 8; for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 4); c.beginPath(); c.moveTo(-44, 0); c.lineTo(44, 0); c.stroke() } crCirc(c, 0, 0, 12, '#2a2230'); c.restore() });
  } }, G.back, G.front, () => {
    const ciao = t > 1.7, a = Math.sin(t * 9) * 0.35, ex = 786, ey = 880;
    gRobot(c, t, { armL: RIPOSO_L, armR: null, fronts: [ciao ? mixPts(RIPOSO_R, [[688, 986], [ex, ey], [ex + Math.sin(0.25 + a) * 96, ey - Math.cos(0.25 + a) * 96]], ease((t - 1.7) / 0.3)) : RIPOSO_R],
      eyes: ciao ? 'happy' : 'normal', mouth: 'talk', m: ciao ? 0.4 + 0.3 * Math.abs(Math.sin(t * 6)) : 0.1, blush: ciao, bulb: ciao ? 'party' : 'on' });
  });
  c.restore();
  // la puntina della piazza nuova che cade dall'alto
  if (t > 2.2) { const d = t - 2.2, y = Math.min(430, -100 + d * 1500), rimb = d > 0.35 ? Math.max(0, Math.sin((d - 0.35) * 14) * 30 * Math.exp(-(d - 0.35) * 5)) : 0;
    gPin(c, 900, y - rimb, 1.15, '#ff4d5a');
    if (d > 0.35) { c.save(); c.globalAlpha = Math.min(1, (d - 0.35) / 0.3) * 0.5; c.strokeStyle = '#ff4d5a'; c.lineWidth = 5; c.beginPath(); c.ellipse(900, 436, 30 + (d % 1) * 50, 10 + (d % 1) * 16, 0, 0, Math.PI * 2); c.stroke(); c.restore() } }
};

/* ---------- 13. mammamia: le mani in testa (come alla fine del video di prova), poi ride ---------- */
G.mammamia = function (c, t) {
  const z = 1.32 - 0.06 * ease(t / 5), k = ease((t - 0.15) / 0.35), ride = t > 2.6;
  const scuoti = !ride ? Math.sin(t * 16) * 0.05 * ease((t - 0.4) / 0.3) : 0.03 * Math.sin(t * 9);
  const L = mixPts(RIPOSO_L, [[392, 986], [292, 860], [372, 676]], k), R = mixPts(RIPOSO_R, [[688, 986], [788, 860], [708, 676]], k);
  gScene(c, { z, cx: 540, cy: cyInsegna(z), extra: () => gFrutta(c) }, G.back, G.front, () => gRobot(c, t, {
    armL: null, armR: null, fronts: [L, R], tilt: scuoti, occhioni: ride ? null : { size: 1.1, look: [0, -4] }, eyes: 'happy', mouth: ride ? 'grin' : 'o', blush: true, bulb: ride ? 'party' : 'on'
  }));
  if (!ride && t > 0.5) { const d = (t - 0.5) % 0.9; c.save(); c.globalAlpha = Math.sin(d / 0.9 * Math.PI); const gx = 760, gy = 600 + d * 90; const g = c.createRadialGradient(gx - 4, gy - 4, 2, gx, gy, 20); g.addColorStop(0, '#e6fbff'); g.addColorStop(1, '#58c8ff');
    c.beginPath(); c.moveTo(gx, gy - 30); c.quadraticCurveTo(gx + 20, gy, gx, gy + 18); c.quadraticCurveTo(gx - 20, gy, gx, gy - 30); c.fillStyle = g; c.fill(); c.restore() }
  if (!ride) [[300, 470], [540, 400], [780, 470]].forEach(([x, y], i) => { const q = (t * 2 + i * 0.33) % 1; c.save(); c.globalAlpha = 0.85; c.fillStyle = '#ffd23f'; c.font = `900 ${64 + 10 * Math.sin(q * Math.PI)}px ${CR_FONT}`; c.textAlign = 'center'; c.fillText('!', x, y - q * 20); c.restore() });
  if (ride) [[250, 560], [830, 520], [540, 380]].forEach(([x, y], i) => { const q = (t - 2.7 - i * 0.15) % 1.2; if (q >= 0 && q < 0.6) star(c, x, y, 24, Math.sin(q / 0.6 * Math.PI)) });
};

/* ---------- 14. differenziata: tre bidoni sul banco, il calendario dei giorni ---------- */
G.differenziata = function (c, t) {
  const z = 1.12, bidoni = [['#2f8cff', 'CARTA'], ['#ffd23f', 'PLASTICA'], ['#8a5a33', 'UMIDO']];
  const sel = t > 3 ? Math.floor((t - 3) / 0.9) % 3 : -1;
  const xs = [190, 300, 410];
  gScene(c, { z, cx: 560, cy: cyInsegna(z), extra: () => {
    bidoni.forEach(([col, nome], i) => { const s = popK(t, 0.4 + i * 0.3, 0.35); if (!s) return; const x = xs[i], y = 1118, on = sel === i;
      c.save(); c.translate(x, y - (on ? 18 * Math.abs(Math.sin((t - 3) * 7)) : 0)); c.scale(s, s); c.shadowColor = on ? col : 'rgba(0,0,0,.4)'; c.shadowBlur = on ? 40 : 16;
      crRR(c, -46, -150, 92, 150, 12, col); c.shadowBlur = 0; crRR(c, -52, -168, 104, 24, 8, col); crRR(c, -14, -178, 28, 12, 5, 'rgba(0,0,0,.35)');
      c.fillStyle = 'rgba(0,0,0,.18)'; [-22, 0, 22].forEach(dx => crRR(c, dx - 4, -132, 8, 100, 4, 'rgba(0,0,0,.16)'));
      c.fillStyle = nome === 'PLASTICA' ? '#1b2133' : '#fff'; c.font = `900 15px ${CR_FONT}`; c.textAlign = 'center'; c.fillText(nome, 0, -12); c.restore() });
  } }, G.back, G.front, () => gRobot(c, t, {
    armL: null, armR: RIPOSO_R, fronts: [sel >= 0 ? [[392, 986], [330, 1000], [xs[sel] + 40, 980]] : mixPts(RIPOSO_L, [[392, 986], [330, 1000], [470, 960]], ease((t - 2.6) / 0.4))],
    occhioni: { size: 1, look: sel >= 0 ? [-30, 22] : [-20, 10] }, mouth: Math.floor(t * 2) % 2 ? 'smile' : 'talk', m: 0.4, blush: true, bulb: 'on'
  }));
  // il calendario con la luna: «stasera fuori il bidone»
  const s = popK(t, 1.4, 0.4); if (s) { gBolla(c, 800, 420, 330, 250, s, [-60, -40]);
    c.save(); c.translate(800, 420); c.scale(s, s); crRR(c, -120, -90, 240, 46, 12, '#e63946'); c.fillStyle = '#fff'; c.font = `900 28px ${CR_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('STASERA', 0, -66);
    for (let i = 0; i < 7; i++) { const x = -102 + i * 34, on = i === 2; crRR(c, x - 14, -30, 28, 28, 6, on ? '#e63946' : '#e2d6bf') }
    const lx = 0, ly = 52; c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(lx, ly, 30, 0, Math.PI * 2); c.fill(); crCirc(c, lx + 13, ly - 8, 26, '#fbf8f1'); c.restore() }
};

/* ---------- 15. parcheggio: la macchinina corre sul banco, si ferma, cade la puntina ---------- */
G.parcheggio = function (c, t) {
  const z = 1.14, k = ease(t / 1.8), cx0 = lerp(-120, 300, k), ferma = t > 1.8;
  const auto = (x) => { const y = 1116, sb = ferma ? 0 : Math.sin(t * 30) * 2; c.save(); c.translate(x, y + sb); c.scale(1.4, 1.4);
    c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 14; c.shadowOffsetY = 6; c.beginPath(); c.moveTo(-90, -24); c.lineTo(-84, -56); c.lineTo(-50, -60); c.lineTo(-30, -96); c.lineTo(36, -96); c.lineTo(62, -60); c.lineTo(90, -54); c.lineTo(94, -24); c.closePath(); c.fillStyle = '#ff4d5a'; c.fill(); c.shadowBlur = 0;
    c.fillStyle = '#bfe9ff'; c.beginPath(); c.moveTo(-24, -86); c.lineTo(-2, -86); c.lineTo(-2, -62); c.lineTo(-40, -62); c.closePath(); c.fill(); c.beginPath(); c.moveTo(6, -86); c.lineTo(30, -86); c.lineTo(48, -62); c.lineTo(6, -62); c.closePath(); c.fill();
    crCirc(c, 88, -44, 7, '#ffd23f'); [-52, 54].forEach(wx => { crCirc(c, wx, -22, 22, '#1b2133'); crCirc(c, wx, -22, 9, '#c9ccd6') }); c.restore() };
  gScene(c, { z, cx: 560, cy: cyInsegna(z), extra: () => {
    if (!ferma) { c.save(); c.globalAlpha = 0.5; c.strokeStyle = '#fbf8f1'; c.lineWidth = 6; c.lineCap = 'round'; [0, 1, 2].forEach(i => { const y = 1066 + i * 18; c.beginPath(); c.moveTo(cx0 - 120 - i * 20, y); c.lineTo(cx0 - 180 - i * 30, y); c.stroke() }); c.restore() }
    auto(cx0);
  } }, G.back, G.front, () => gRobot(c, t, {
    armL: RIPOSO_L, armR: null, fronts: [ferma ? mixPts(RIPOSO_R, [[688, 986], [770, 940], [820, 860]], ease((t - 2.3) / 0.4)) : RIPOSO_R],
    occhioni: { size: 1, look: [lerp(-40, -26, k), 20] }, mouth: ferma ? 'grin' : 'o', blush: ferma, bulb: 'on'
  }));
  if (t > 2.0) { const d = t - 2.0, x = 300 * z - (560 * z - 540) + 0, yT = 860, y = Math.min(yT, 200 + d * 1700), rimb = d > 0.4 ? Math.max(0, Math.sin((d - 0.4) * 14) * 26 * Math.exp(-(d - 0.4) * 5)) : 0;
    gPin(c, x, y - rimb, 1.1, '#2f8cff');
    if (d > 0.5) { const s = popK(t, 2.6, 0.35); gBolla(c, 760, 430, 300, 150, s, [-90, -50]); if (s) { c.save(); c.translate(760, 430); c.scale(s, s); c.fillStyle = '#1b2133'; c.font = `900 54px ${CR_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('P', -80, 2); crRR(c, -40, -18, 150, 14, 7, '#c9c2b3'); crRR(c, -40, 8, 110, 14, 7, '#c9c2b3'); c.restore() } } }
};

/* ---------- 16. fontanella: l'acqua che scorre dalla fontanella, la mappa con le gocce ---------- */
G.fontanella = function (c, t) {
  const z = 1.12, fx = 200, top = 900;
  gScene(c, { z, cx: 540, cy: cyInsegna(z), extra: () => {
    const s = popK(t, 0.3, 0.45); if (!s) return;
    c.save(); c.translate(fx, 1118); c.scale(s, s); c.translate(-fx, -1118);
    // la colonnina di ghisa con il rubinetto e la vaschetta
    c.save(); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 18; c.shadowOffsetY = 8;
    const g = c.createLinearGradient(fx - 34, 0, fx + 34, 0); g.addColorStop(0, '#2c4a3e'); g.addColorStop(0.5, '#4f7a66'); g.addColorStop(1, '#22392f');
    crRR(c, fx - 34, top, 68, 1118 - top, 14, g); c.restore(); crCirc(c, fx, top, 40, '#3c6252'); crCirc(c, fx, top - 26, 18, '#4f7a66');
    crRR(c, fx + 20, top + 50, 70, 18, 8, '#9aa3b3'); crRR(c, fx + 80, top + 50, 16, 30, 6, '#9aa3b3');
    crRR(c, fx - 10, 1080, 150, 38, 12, '#5d6b7a');
    // il getto d'acqua
    if (t > 0.8) { c.save(); c.strokeStyle = 'rgba(160,220,255,.9)'; c.lineWidth = 12; c.lineCap = 'round'; c.shadowColor = '#7fd6ff'; c.shadowBlur = 16; c.beginPath(); c.moveTo(fx + 88, top + 80); c.quadraticCurveTo(fx + 96, top + 140, fx + 92, 1080); c.stroke(); c.restore();
      const r = rnd(3); for (let i = 0; i < 10; i++) { const ph = (t * 1.6 + r()) % 1; crCirc(c, fx + 92 + (r() - 0.5) * 60 * ph, 1076 - Math.sin(ph * Math.PI) * 30, 5 * (1 - ph) + 2, 'rgba(180,230,255,.85)') } }
    c.restore();
  } }, G.back, G.front, () => gRobot(c, t, {
    armL: null, armR: RIPOSO_R, fronts: [mixPts(RIPOSO_L, [[392, 986], [320, 960], [310, 900]], ease((t - 1.2) / 0.4))],
    occhioni: { size: 1, look: t < 3 ? [-34, 8] : [0, 0], stelle: t > 3.2 }, mouth: t < 3 ? 'o' : 'grin', blush: true, bulb: 'on'
  }));
  // la mappina con le gocce che si accendono una dopo l'altra
  const s = popK(t, 2.4, 0.4); if (s) { gBolla(c, 780, 420, 360, 300, s, [-80, -40]);
    c.save(); c.translate(780, 420); c.scale(s, s); crRR(c, -150, -120, 300, 240, 26, '#dff2e3');
    c.strokeStyle = '#fbf8f1'; c.lineWidth = 16; c.beginPath(); c.moveTo(-150, -30); c.lineTo(150, 10); c.moveTo(-40, -120); c.lineTo(10, 120); c.moveTo(60, -120); c.lineTo(120, 120); c.stroke();
    [[-90, -60], [30, 50], [110, -50], [-70, 70]].forEach(([x, y], i) => { const on = t > 2.9 + i * 0.35; if (!on) return; const b = 1 + 0.2 * Math.max(0, Math.sin((t - 2.9 - i * 0.35) * 10)) * Math.exp(-(t - 2.9 - i * 0.35) * 3);
      c.save(); c.translate(x, y); c.scale(b * 0.5, b * 0.5); c.beginPath(); c.moveTo(0, -60); c.quadraticCurveTo(44, -4, 0, 30); c.quadraticCurveTo(-44, -4, 0, -60); c.fillStyle = '#2f8cff'; c.fill(); crCirc(c, -10, -6, 9, 'rgba(255,255,255,.8)'); c.restore() });
    c.restore() }
};

/* ---------- 17. orologio: le ultime ore, la lancetta corre ---------- */
G.orologio = function (c, t) {
  const z = 1.26 + 0.06 * ease(t / 5);
  gScene(c, { z, cx: 520, cy: cyInsegna(z), extra: () => gFrutta(c) }, G.back, G.front, () => gRobot(c, t, {
    armL: RIPOSO_L, armR: null, fronts: [mixPts(RIPOSO_R, [[688, 986], [780, 930], [820, 840]], ease((t - 0.3) / 0.4))], occhioni: { size: 1.05, look: [26, -24] }, mouth: 'o', blush: false, bulb: Math.floor(t * 3) % 2 ? 'party' : 'on'
  }));
  const s = popK(t, 0.2, 0.4); if (!s) return; const x = 850, y = 420;
  c.save(); c.translate(x, y); c.scale(s, s); c.rotate(Math.sin(t * 20) * 0.04);
  c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 24; crCirc(c, 0, 0, 130, '#e63946'); c.shadowBlur = 0; crCirc(c, 0, 0, 108, '#fbf8f1');
  [-1, 1].forEach(sx => { crCirc(c, sx * 80, -120, 34, '#e63946'); crRR(c, sx * 80 - 8, -100, 16, 22, 4, '#e63946') });
  c.fillStyle = '#1b2133'; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; crRR(c, Math.cos(a) * 88 - 5, Math.sin(a) * 88 - 5, 10, 10, 5, '#1b2133') }
  c.strokeStyle = '#1b2133'; c.lineCap = 'round'; c.lineWidth = 12; const ah = -Math.PI / 2 + t * 0.6; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(ah) * 52, Math.sin(ah) * 52); c.stroke();
  c.lineWidth = 7; c.strokeStyle = '#e63946'; const am = -Math.PI / 2 + t * 4.2; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(am) * 84, Math.sin(am) * 84); c.stroke(); crCirc(c, 0, 0, 12, '#1b2133');
  c.restore();
  // le linee della vibrazione
  c.save(); c.strokeStyle = '#ffd23f'; c.lineWidth = 8; c.lineCap = 'round'; c.globalAlpha = 0.6 + 0.4 * Math.sin(t * 12);
  [[-1, -0.6], [-1, 0.4], [1, -0.6], [1, 0.4]].forEach(([sx, sy]) => { c.beginPath(); c.moveTo(x + sx * 160, y + sy * 100); c.lineTo(x + sx * 196, y + sy * 116); c.stroke() }); c.restore();
};

/* ---------- 18. conta: le lettere volano nell'urna, il contatore gira ---------- */
G.conta = function (c, t) {
  const z = 1.16, ux = 760, uy = 1118;
  gScene(c, { z, cx: 580, cy: cyInsegna(z), extra: () => {
    c.save(); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 18; c.shadowOffsetY = 8; const g = c.createLinearGradient(0, uy - 170, 0, uy); g.addColorStop(0, 'rgba(210,235,255,.55)'); g.addColorStop(1, 'rgba(160,200,240,.45)'); crRR(c, ux - 100, uy - 170, 200, 170, 18, g); c.restore();
    c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 5; crRR(c, ux - 100, uy - 170, 200, 170, 18); c.stroke(); crRR(c, ux - 110, uy - 186, 220, 24, 10, '#2f60b9'); crRR(c, ux - 50, uy - 180, 100, 10, 5, '#1b2133');
    for (let i = 0; i < Math.min(14, Math.floor(Math.max(0, t - 0.9) / 0.3)); i++) { const r = rnd(i + 5); c.save(); c.translate(ux - 70 + r() * 140, uy - 20 - r() * 70); c.rotate(r() * 1.5 - 0.75); crRR(c, -22, -14, 44, 28, 4, '#fbf8f1'); c.restore() }
  } }, G.back, G.front, () => gRobot(c, t, {
    armL: RIPOSO_L, armR: RIPOSO_R, occhioni: { size: 1, look: [30, 14 - 10 * Math.sin(t * 3)] }, mouth: Math.floor(t * 1.5) % 2 ? 'smile' : 'line', blush: false, bulb: 'on'
  }));
  // i foglietti con le lettere che volano dentro
  for (let i = 0; i < 14; i++) { const t0 = 0.3 + i * 0.3, d = (t - t0) / 0.6; if (d < 0 || d > 1) continue; const L = 'ABC'[i % 3], sx = i % 2 ? 1040 : 80 + (i % 3) * 40, sy = 520 + (i % 4) * 60;
    const ex = 540 + (ux - 580) * z, ey = 960 + (uy - 180 - cyInsegna(z)) * z, x = lerp(sx, ex, ease(d)), y = lerp(sy, ey, ease(d)) - Math.sin(d * Math.PI) * 160;
    c.save(); c.translate(x, y); c.rotate(d * 4 * (i % 2 ? -1 : 1)); c.scale(1 - d * 0.5, 1 - d * 0.5); crRR(c, -40, -30, 80, 60, 8, '#fbf8f1'); c.fillStyle = '#1b2133'; c.font = `900 42px ${CR_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(L, 0, 2); c.restore() }
  // il contatore che gira
  const n = Math.min(99, Math.floor(Math.max(0, t - 0.9) / 0.3)); const s = popK(t, 0.6, 0.4);
  if (s) { c.save(); c.translate(780, 400); c.scale(s, s); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 20; crRR(c, -140, -70, 280, 140, 26, '#1b2133'); c.shadowBlur = 0;
    c.strokeStyle = '#4ff0d0'; c.lineWidth = 6; crRR(c, -140, -70, 280, 140, 26); c.stroke(); c.fillStyle = '#4ff0d0'; c.shadowColor = '#4ff0d0'; c.shadowBlur = 16; c.font = `900 96px "DejaVu Sans Mono", monospace`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(n).padStart(2, '0'), 0, 6); c.restore() }
};

/* ---------- 19. officina: il sabato, la chiave inglese, le scintille, la bancarella in revisione ---------- */
G.officina = function (c, t) {
  const z = 1.22, colpo = Math.sin(t * 7), su = colpo > 0.6;
  gScene(c, { z, cx: 520, cy: cyInsegna(z), extra: () => {
    // la cassetta degli attrezzi sul banco
    c.save(); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 16; c.shadowOffsetY = 6; crRR(c, 700, 1040, 230, 78, 12, '#e63946'); c.restore(); crRR(c, 700, 1060, 230, 10, 4, '#b02a35');
    c.strokeStyle = '#9aa3b3'; c.lineWidth = 12; c.beginPath(); c.moveTo(770, 1040); c.lineTo(780, 1006); c.lineTo(850, 1006); c.lineTo(860, 1040); c.stroke();
    crRR(c, 720, 1010, 14, 40, 4, '#ffd23f'); crRR(c, 740, 1000, 10, 50, 4, '#9aa3b3');
  } }, G.backNotte, G.front, () => {
    const mano = [[392, 986], [300, 930], [240 + (su ? -10 : 10), 860 + (su ? -14 : 14)]];
    gRobot(c, t, { armL: null, armR: RIPOSO_R, fronts: [mano], eyes: 'down', mouth: Math.floor(t * 1.3) % 3 === 2 ? 'smile' : 'line', blush: false, bulb: 'on' });
    // la chiave inglese in mano
    c.save(); c.translate(mano[2][0], mano[2][1]); c.rotate(-0.9 + (su ? -0.25 : 0.15)); c.fillStyle = '#c9ccd6'; crRR(c, -10, -110, 20, 110, 8, '#c9ccd6'); c.beginPath(); c.arc(0, -120, 28, 0, Math.PI * 2); c.fill(); crRR(c, -10, -160, 20, 34, 4, '#23212e'); c.restore();
  });
  // le scintille sul palo della bancarella
  const sx = 540 + (180 - 520) * z, sy = 960 + (840 - cyInsegna(z)) * z, r = rnd(Math.floor(t * 7));
  if (su) for (let i = 0; i < 16; i++) { const a = -Math.PI / 2 + (r() - 0.5) * 2.4, l = 30 + r() * 90; c.save(); c.strokeStyle = r() > 0.5 ? '#ffd23f' : '#ff8a5c'; c.lineWidth = 5; c.lineCap = 'round'; c.shadowColor = '#ffd23f'; c.shadowBlur = 14; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l); c.stroke(); c.restore() }
  // ingranaggi in alto
  const gear = (x, y, r0, n, ang, col) => { c.save(); c.translate(x, y); c.rotate(ang); c.fillStyle = col; c.beginPath();
    for (let i = 0; i < n * 2; i++) { const a0 = i * Math.PI / n, rr = i % 2 ? r0 : r0 * 1.22; c.lineTo(Math.cos(a0) * rr, Math.sin(a0) * rr) } c.closePath(); c.fill(); crCirc(c, 0, 0, r0 * 0.42, '#20233a'); c.restore() };
  c.save(); c.globalAlpha = 0.9; gear(860, 400, 60, 10, t * 1.2, '#ffd23f'); gear(770, 320, 38, 8, -t * 1.9, '#ff8a5c'); gear(940, 300, 30, 7, -t * 2.2, '#4ff0d0'); c.restore();
};

G.guide = false;
G.frame = function (name, t, q) {
  const c = G.out.getContext('2d'); c.setTransform(720 / 1080, 0, 0, 1280 / 1920, 0, 0); c.fillStyle = '#000'; c.fillRect(0, 0, 1080, 1920);
  G[name](c, t);
  const v = c.createRadialGradient(540, 900, 380, 540, 960, 1250); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.38)'); c.fillStyle = v; c.fillRect(0, 0, 1080, 1920);
  if (G.guide) { c.fillStyle = 'rgba(255,0,0,.25)'; c.fillRect(0, 1440, 1080, 120); c.fillStyle = 'rgba(0,120,255,.25)'; c.fillRect(40, 106, 440, 136); c.fillRect(700, 106, 340, 136) }
  c.setTransform(1, 0, 0, 1, 0, 0); return G.out.toDataURL('image/jpeg', q || 0.95);
};
