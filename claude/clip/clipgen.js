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

G.guide = false;
G.frame = function (name, t, q) {
  const c = G.out.getContext('2d'); c.setTransform(720 / 1080, 0, 0, 1280 / 1920, 0, 0); c.fillStyle = '#000'; c.fillRect(0, 0, 1080, 1920);
  G[name](c, t);
  const v = c.createRadialGradient(540, 900, 380, 540, 960, 1250); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.38)'); c.fillStyle = v; c.fillRect(0, 0, 1080, 1920);
  if (G.guide) { c.fillStyle = 'rgba(255,0,0,.25)'; c.fillRect(0, 1440, 1080, 120); c.fillStyle = 'rgba(0,120,255,.25)'; c.fillRect(40, 106, 440, 136); c.fillRect(700, 106, 340, 136) }
  c.setTransform(1, 0, 0, 1, 0, 0); return G.out.toDataURL('image/jpeg', q || 0.95);
};
