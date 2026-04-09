'use strict';

/* ─── 별 & 구름 생성 ─── */
const sky = document.getElementById('sky');
for (let i = 0; i < 100; i++) {
  const el = document.createElement('div');
  el.className = 'star';
  const sz = Math.random() * 2.4 + 0.5;
  el.style.cssText = `width:${sz}px;height:${sz}px;top:${Math.random()*95}%;left:${Math.random()*100}%;--d:${(1+Math.random()*2.5).toFixed(1)}s;animation-delay:${(Math.random()*3).toFixed(1)}s`;
  sky.appendChild(el);
}
for (let i = 0; i < 6; i++) {
  const el = document.createElement('div');
  el.className = 'cloud';
  const w = 70 + Math.random() * 130;
  el.style.cssText = `width:${w}px;height:${w*.38}px;top:${3+Math.random()*30}%;left:${Math.random()*100}%;animation-duration:${(20+Math.random()*30).toFixed(0)}s;animation-delay:-${(Math.random()*30).toFixed(0)}s`;
  sky.appendChild(el);
}

/* ─── 캔버스 ─── */
const cv  = document.getElementById('cv');
const ctx = cv.getContext('2d');
let W, H, GY;

function resize() {
  W = cv.width  = window.innerWidth;
  H = cv.height = window.innerHeight;
  GY = H - 108;
}
resize();
window.addEventListener('resize', resize);

/* ─── 게임 변수 ─── */
let score, best = 0, lives;
let running = false;
let items = [], sparks = [], pops = [];
let spawnT = 0, elapsed = 0;
let lastTs = 0;
const keys = {};

/* ─── DOM 참조 ─── */
const elScore   = document.getElementById('elScore');
const elBest    = document.getElementById('elBest');
const startScr  = document.getElementById('startScreen');
const overScr   = document.getElementById('overScreen');
const elGoScore = document.getElementById('elGoScore');
const elGoBest  = document.getElementById('elGoBest');
const flash     = document.getElementById('flash');

/* ─── 토끼 오브젝트 ─── */
const bunny = {
  W: 54, H: 66,
  x: 0,  y: 0,
  spd: 7,
  dir: 1,
  legT: 0, earT: 0, blinkT: 0, blink: false,
  BW: 78, BH: 30,
  bx() { return this.x + this.W / 2; },
  by() { return this.y - 52; },
  reset() {
    this.x = W / 2 - this.W / 2;
    this.y = GY - this.H;
    this.legT = 0; this.earT = 0; this.blinkT = 0; this.blink = false;
  }
};

/* ─── 아이템 풀 ─── */
const COINS = [
  { value: 1,  r: 14, col: '#c8a818', shine: '#ffe566' },
  { value: 5,  r: 15, col: '#909090', shine: '#e8e8e8' },
  { value: 10, r: 17, col: '#c86010', shine: '#ffcc88' },
];

function spawnItem() {
  const x = 50 + Math.random() * (W - 100);
  const tier  = Math.min(Math.floor(score / 30), 15);
  const spd   = 1.5 + tier * 0.5;
  const bombP = 0.20 + tier * 0.04;

  if (Math.random() < bombP) {
    items.push({
      kind: 'bomb', x, y: -28, r: 20,
      vy: (3.0 + Math.random() * 1.2) * spd,
      rot: 0
    });
  } else {
    const c = COINS[Math.floor(Math.random() * (Math.random() < .5 ? 1 : COINS.length))];
    items.push({
      kind: 'coin', x, y: -20, r: c.r,
      vy: (3.2 + Math.random() * 1.2) * spd,
      spin: Math.random() * Math.PI * 2,
      spinV: 0.05 + Math.random() * 0.04,
      value: c.value, col: c.col, shine: c.shine
    });
  }
}

/* ─── 충돌 판정 ─── */
function caught(item) {
  const bx = bunny.bx(), by = bunny.by();
  const hw = bunny.BW / 2;
  return (
    item.x > bx - hw &&
    item.x < bx + hw &&
    item.y > by - 10 &&
    item.y < by + bunny.BH + 5
  );
}

/* ─── 파티클 ─── */
function addSparks(x, y, col, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 1.5 + Math.random() * 4;
    sparks.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - 2.5,
                  r: 2.5 + Math.random()*3, col, life: 1, d: 0.025 + Math.random()*0.02 });
  }
}
function addPop(x, y, text, col) {
  pops.push({ x, y, text, col, life: 1, vy: -2 });
}

/* ─── 목숨 UI ─── */
function refreshLives() {
  for (let i = 0; i < 3; i++) {
    const el = document.getElementById('lh' + i);
    el.textContent = i < lives ? '💚' : '🖤';
    el.classList.toggle('lost', i >= lives);
  }
}
function doFlash() {
  flash.classList.add('on');
  setTimeout(() => flash.classList.remove('on'), 180);
}

/* ─── 업데이트 ─── */
function update(dt) {
  if (!running) return;

  let moving = false;
  if (keys.left)  { bunny.x -= bunny.spd; bunny.dir = -1; moving = true; }
  if (keys.right) { bunny.x += bunny.spd; bunny.dir =  1; moving = true; }
  bunny.x = Math.max(0, Math.min(W - bunny.W, bunny.x));

  if (moving) bunny.legT += 0.22;
  bunny.earT += 0.1;
  bunny.blinkT++;
  if (bunny.blinkT > 120 + Math.random() * 60) {
    bunny.blink = true;
    setTimeout(() => { bunny.blink = false; bunny.blinkT = 0; }, 110);
  }

  spawnT += dt;
  elapsed += dt / 1000;
  const tier2    = Math.min(Math.floor(score / 30), 15);
  const interval = Math.max(250, 1200 - tier2 * 65);
  if (spawnT >= interval) { spawnItem(); spawnItem(); spawnT = 0; }

  items = items.filter(it => {
    it.y += it.vy;
    if (caught(it)) {
      if (it.kind === 'coin') {
        score += it.value;
        elScore.textContent = score;
        addSparks(it.x, it.y, it.shine, 12);
        addPop(it.x, it.y - 20, '+' + it.value, it.shine);
        sfxCoin();
      } else {
        lives--;
        refreshLives();
        doFlash();
        addSparks(it.x, it.y, '#ff5500', 20);
        addPop(it.x, it.y - 20, '-♥', '#ff6b6b');
        sfxBomb();
        try {
          if (navigator.vibrate) {
            if (lives <= 0)       navigator.vibrate([100, 60, 100, 60, 200]);
            else if (lives === 1) navigator.vibrate([80, 50, 150]);
            else                  navigator.vibrate([80]);
          }
        } catch(e) {}
        if (lives <= 0) { setTimeout(endGame, 250); }
      }
      return false;
    }
    return it.y < GY + 50;
  });

  sparks.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= p.d; });
  sparks = sparks.filter(p => p.life > 0);
  pops.forEach(p => { p.y += p.vy; p.life -= 0.022; });
  pops = pops.filter(p => p.life > 0);
}

/* ─── 그리기 ─── */
function draw() {
  ctx.clearRect(0, 0, W, H);

  items.forEach(it => {
    if (it.kind === 'coin') drawCoin(it);
    else drawBomb(it);
  });

  sparks.forEach(p => {
    ctx.globalAlpha = p.life;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.col; ctx.fill();
  });
  ctx.globalAlpha = 1;

  drawBunny();

  pops.forEach(p => {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.col;
    ctx.font = 'bold 22px Jua, cursive';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 5;
    ctx.fillText(p.text, p.x, p.y);
    ctx.shadowBlur = 0;
  });
  ctx.globalAlpha = 1;
}

/* ─── 토끼 그리기 ─── */
function drawBunny() {
  const b = bunny;
  const cx = b.x + b.W / 2;
  const cy = b.y + b.H / 2;
  const moving = keys.left || keys.right;
  const leg = moving ? Math.sin(b.legT) * 11 : 0;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(b.dir, 1);

  ctx.beginPath(); ctx.ellipse(0, b.H/2 - 2, 20, 6, 0, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fill();

  ctx.save(); ctx.translate(0, 14); ctx.rotate((leg - 6) * Math.PI/180);
  ctx.beginPath();
  ctx.arc(0, 6, 6, Math.PI, Math.PI*1.5);
  ctx.arc(0, 6, 6, Math.PI*1.5, 0);
  ctx.arc(0, 14, 6, 0, Math.PI*.5);
  ctx.arc(0, 14, 6, Math.PI*.5, Math.PI);
  ctx.closePath();
  ctx.fillStyle = '#ede4da'; ctx.fill(); ctx.restore();

  ctx.beginPath(); ctx.ellipse(0, 8, 16, 20, 0, 0, Math.PI*2);
  ctx.fillStyle = '#f5f0ea'; ctx.fill();
  ctx.strokeStyle = '#d8cfc4'; ctx.lineWidth = 1.2; ctx.stroke();

  ctx.beginPath(); ctx.ellipse(2, 10, 9, 13, 0.1, 0, Math.PI*2);
  ctx.fillStyle = '#fffdf8'; ctx.fill();

  ctx.beginPath(); ctx.arc(-14, 8, 7, 0, Math.PI*2);
  ctx.fillStyle = '#fff'; ctx.fill();

  const armAngle = 65;
  [[-11, -2, -armAngle], [11, -2, armAngle]].forEach(([ax, ay, ang]) => {
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang * Math.PI/180);
    ctx.beginPath();
    ctx.arc(0, 4, 4, Math.PI, 0);
    ctx.arc(0, 13, 4, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = '#ede4da'; ctx.fill(); ctx.restore();
  });

  ctx.beginPath(); ctx.ellipse(3, -14, 13, 14, 0, 0, Math.PI*2);
  ctx.fillStyle = '#f5f0ea'; ctx.fill();
  ctx.strokeStyle = '#d8cfc4'; ctx.lineWidth = 1; ctx.stroke();

  const wig = Math.sin(b.earT) * 4;
  [[-4, -23, -7 + wig], [11, -25, 5 - wig * .5]].forEach(([ex, ey, rot]) => {
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(rot * Math.PI/180);
    ctx.beginPath(); ctx.ellipse(0, -11, 5, 14, 0, 0, Math.PI*2);
    ctx.fillStyle = '#f5f0ea'; ctx.fill();
    ctx.strokeStyle = '#d8cfc4'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -11, 2.5, 10, 0, 0, Math.PI*2);
    ctx.fillStyle = '#f8c8cc'; ctx.fill();
    ctx.restore();
  });

  const ey0 = -18;
  if (b.blink) {
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(-3, ey0); ctx.lineTo(1, ey0 + 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(7, ey0);  ctx.lineTo(11, ey0 + 2); ctx.stroke();
  } else {
    [[-1, ey0], [9, ey0]].forEach(([ex, eey]) => {
      ctx.beginPath(); ctx.arc(ex, eey, 3, 0, Math.PI*2);
      ctx.fillStyle = '#2a2a2a'; ctx.fill();
      ctx.beginPath(); ctx.arc(ex + 1, eey - 1, 1.1, 0, Math.PI*2);
      ctx.fillStyle = '#fff'; ctx.fill();
    });
  }
  ctx.beginPath(); ctx.arc(4, ey0 + 6, 2, 0, Math.PI*2);
  ctx.fillStyle = '#ffb3c6'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(2, ey0+8); ctx.quadraticCurveTo(4, ey0+12, 7, ey0+8);
  ctx.strokeStyle = '#c08080'; ctx.lineWidth = 1.3; ctx.stroke();
  ctx.globalAlpha = .32;
  ctx.beginPath(); ctx.arc(-3, ey0+4, 4, 0, Math.PI*2); ctx.fillStyle = '#ffb3c6'; ctx.fill();
  ctx.beginPath(); ctx.arc(12, ey0+4, 4, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();
  drawBasket(cx, b.y - 52);
}

function drawBasket(cx, topY) {
  const bw = bunny.BW, bh = bunny.BH;
  ctx.save();
  ctx.translate(cx, topY);

  ctx.beginPath();
  ctx.moveTo(-bw/2,     0);
  ctx.lineTo( bw/2,     0);
  ctx.lineTo( bw/2 - 7, bh);
  ctx.lineTo(-bw/2 + 7, bh);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, bh);
  g.addColorStop(0, '#d4920e'); g.addColorStop(1, '#8b5a06');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#6b4404'; ctx.lineWidth = 2; ctx.stroke();

  ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.lineWidth = 1.4;
  for (let xi = -bw/2; xi < bw/2; xi += 11) {
    ctx.beginPath(); ctx.moveTo(xi, 0); ctx.lineTo(xi + 7, bh); ctx.stroke();
  }
  for (let yi = 0; yi <= bh; yi += 9) {
    ctx.beginPath(); ctx.moveTo(-bw/2, yi); ctx.lineTo(bw/2, yi); ctx.stroke();
  }
  ctx.restore();

  ctx.beginPath(); ctx.moveTo(-bw/2, 0); ctx.lineTo(bw/2, 0);
  ctx.strokeStyle = '#e8a820'; ctx.lineWidth = 4.5; ctx.stroke();

  ctx.beginPath(); ctx.arc(0, -3, bw * 0.33, Math.PI, 0);
  ctx.strokeStyle = '#6b4404'; ctx.lineWidth = 5; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -3, bw * 0.33, Math.PI, 0);
  ctx.strokeStyle = '#d4920e'; ctx.lineWidth = 2.5; ctx.stroke();

  ctx.restore();
}

/* ─── 동전 그리기 ─── */
function drawCoin(c) {
  c.spin += c.spinV;
  const sx = Math.abs(Math.cos(c.spin));
  ctx.save(); ctx.translate(c.x, c.y); ctx.scale(sx, 1);
  ctx.beginPath(); ctx.arc(0, 0, c.r, 0, Math.PI*2);
  const g = ctx.createRadialGradient(-c.r*.3, -c.r*.3, 0, 0, 0, c.r);
  g.addColorStop(0, c.shine); g.addColorStop(1, c.col);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = c.col; ctx.lineWidth = 2; ctx.stroke();
  if (sx > 0.15) {
    ctx.globalAlpha = sx;
    ctx.fillStyle = 'rgba(255,255,255,.88)';
    ctx.font = `bold ${c.r * .9}px Jua, cursive`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(c.value, 0, 1);
    ctx.globalAlpha = 1;
  }
  ctx.beginPath(); ctx.arc(-c.r*.26, -c.r*.28, c.r*.28, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fill();
  ctx.restore();
}

/* ─── 폭탄 그리기 ─── */
function drawBomb(b) {
  b.rot += 0.045;
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);

  ctx.beginPath(); ctx.arc(0, 2, b.r, 0, Math.PI*2);
  const g = ctx.createRadialGradient(-b.r*.3, -b.r*.15, 0, 0, 2, b.r);
  g.addColorStop(0, '#606060'); g.addColorStop(1, '#111');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#222'; ctx.lineWidth = 2.5; ctx.stroke();

  ctx.beginPath(); ctx.arc(-b.r*.28, -b.r*.12, b.r*.24, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, -b.r);
  ctx.bezierCurveTo(8, -b.r-10, 14, -b.r-5, 10, -b.r-19);
  ctx.strokeStyle = '#8b6914'; ctx.lineWidth = 2.5; ctx.stroke();

  const ff = Math.sin(Date.now() * .03) * 2.5;
  ctx.beginPath(); ctx.arc(10, -b.r-19+ff, 5.5, 0, Math.PI*2);
  ctx.fillStyle = '#ff8800'; ctx.fill();
  ctx.beginPath(); ctx.arc(10, -b.r-19+ff, 3.5, 0, Math.PI*2);
  ctx.fillStyle = '#ffee00'; ctx.fill();
  ctx.beginPath(); ctx.arc(10, -b.r-20+ff, 1.8, 0, Math.PI*2);
  ctx.fillStyle = '#fff'; ctx.fill();

  ctx.restore();
}

/* ─── 오디오 엔진 ─── */
let audioCtx = null;
let bgmNodes = [];
let bgmPlaying = false;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(freq, type, start, duration, gain, actx, dest) {
  const osc = actx.createOscillator();
  const g   = actx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(g); g.connect(dest);
  osc.start(start); osc.stop(start + duration);
}

const BGM_BPM  = 148;
const BGM_BEAT = 60 / BGM_BPM;
const NOTE = {
  C3:130.81, F3:174.61, G3:196.00,
  C4:261.63, D4:293.66, E4:329.63, F4:349.23,
  G4:392.00, A4:440.00, B4:493.88,
  C5:523.25, E5:659.25,
};
const MELODY = [
  [NOTE.E4,1],[NOTE.G4,1],[NOTE.A4,2],
  [NOTE.G4,1],[NOTE.E4,1],[NOTE.C4,2],
  [NOTE.D4,1],[NOTE.F4,1],[NOTE.G4,2],
  [NOTE.F4,1],[NOTE.D4,1],[NOTE.B4,2],
  [NOTE.E4,1],[NOTE.G4,1],[NOTE.C5,2],
  [NOTE.B4,1],[NOTE.G4,1],[NOTE.E4,2],
  [NOTE.A4,1],[NOTE.C5,1],[NOTE.E5,1],[NOTE.C5,1],
  [NOTE.G4,2],[NOTE.E4,2],
];
const BASS = [
  [NOTE.C3,2],[NOTE.G3,2],
  [NOTE.C3,2],[NOTE.G3,2],
  [NOTE.F3,2],[NOTE.C3,2],
  [NOTE.G3,2],[NOTE.G3,2],
];

function scheduleBgmLoop(actx, masterGain) {
  if (!bgmPlaying) return;
  const now = actx.currentTime;

  const melodyGain = actx.createGain(); melodyGain.gain.value = 0.18; melodyGain.connect(masterGain);
  const bassGain   = actx.createGain(); bassGain.gain.value   = 0.12; bassGain.connect(masterGain);
  const drumGain   = actx.createGain(); drumGain.gain.value   = 0.06; drumGain.connect(masterGain);

  let t = now;
  MELODY.forEach(([freq, beats]) => {
    const dur = beats * BGM_BEAT;
    playTone(freq, 'square', t, dur * 0.85, 0.3, actx, melodyGain);
    t += dur;
  });

  let bt = now;
  BASS.forEach(([freq, beats]) => {
    const dur = beats * BGM_BEAT;
    playTone(freq, 'triangle', bt, dur * 0.7, 0.5, actx, bassGain);
    bt += dur;
  });

  for (let i = 0; i < 16; i++) {
    const buf  = actx.createBuffer(1, actx.sampleRate * 0.06, actx.sampleRate);
    const data = buf.getChannelData(0);
    for (let j = 0; j < data.length; j++) data[j] = (Math.random() * 2 - 1) * (1 - j / data.length);
    const src = actx.createBufferSource(); src.buffer = buf;
    src.connect(drumGain); src.start(now + i * BGM_BEAT * 0.5);
  }

  const totalBeats = MELODY.reduce((s, [,b]) => s + b, 0);
  bgmNodes._timer = setTimeout(() => scheduleBgmLoop(actx, masterGain), (totalBeats * BGM_BEAT - 0.1) * 1000);
}

let bgmMasterGain = null;
function startBgm() {
  if (bgmPlaying) return;
  bgmPlaying = true;
  const actx = getAudioCtx();
  if (actx.state === 'suspended') actx.resume();
  bgmMasterGain = actx.createGain();
  bgmMasterGain.gain.value = 1;
  bgmMasterGain.connect(actx.destination);
  scheduleBgmLoop(actx, bgmMasterGain);
}

function stopBgm() {
  bgmPlaying = false;
  clearTimeout(bgmNodes._timer);
  if (bgmMasterGain) {
    const actx = getAudioCtx();
    bgmMasterGain.gain.setValueAtTime(bgmMasterGain.gain.value, actx.currentTime);
    bgmMasterGain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.3);
  }
}

function sfxCoin() {
  const actx = getAudioCtx();
  const g = actx.createGain(); g.connect(actx.destination);
  [523, 659, 784].forEach((f, i) => playTone(f, 'sine', actx.currentTime + i*0.06, 0.12, 0.15, actx, g));
}
function sfxBomb() {
  const actx = getAudioCtx();
  const g = actx.createGain(); g.gain.value = 0.4; g.connect(actx.destination);
  const osc = actx.createOscillator(); osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(120, actx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, actx.currentTime + 0.3);
  const eg = actx.createGain();
  eg.gain.setValueAtTime(0.5, actx.currentTime);
  eg.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.35);
  osc.connect(eg); eg.connect(g);
  osc.start(); osc.stop(actx.currentTime + 0.35);
  const buf = actx.createBuffer(1, actx.sampleRate * 0.2, actx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1)*(1-i/d.length);
  const ns = actx.createBufferSource(); ns.buffer = buf;
  const ng = actx.createGain(); ng.gain.value = 0.3;
  ns.connect(ng); ng.connect(g); ns.start();
}
function sfxGameOver() {
  const actx = getAudioCtx();
  const g = actx.createGain(); g.connect(actx.destination);
  [[220,0],[185,0.25],[165,0.5],[130,0.8]].forEach(([f,t]) =>
    playTone(f, 'sawtooth', actx.currentTime+t, 0.3, 0.25, actx, g));
}

/* ─── 게임 루프 ─── */
function loop(ts) {
  const dt = ts - lastTs; lastTs = ts;
  update(dt); draw();
  requestAnimationFrame(loop);
}

/* ─── 게임 시작/종료 ─── */
function startGame() {
  score = 0; lives = 3; elapsed = 0;
  items = []; sparks = []; pops = []; spawnT = 0;
  elScore.textContent = '0';
  refreshLives();
  startScr.style.display = 'none';
  overScr.style.display  = 'none';
  document.getElementById('sbScreen').style.display = 'none';
  bunny.reset();
  running = true;
  startBgm();
}

function endGame() {
  running = false;
  stopBgm();
  sfxGameOver();
  if (score > best) best = score;
  elBest.textContent    = best;
  elGoScore.textContent = `내 점수: ${score} 점`;
  elGoBest.textContent  = `최고기록: ${best} 점`;
  renderOverSb();
  overScr.style.display = 'flex';
}

/* ─── 스코어보드 ─── */
const SB_KEY = 'rabbitCoinSB_v1';
function loadSb() {
  try { return JSON.parse(localStorage.getItem(SB_KEY)) || []; } catch(e) { return []; }
}
function saveSb(list) { localStorage.setItem(SB_KEY, JSON.stringify(list)); }
function getRank(list, s) { return list.filter(e => e.score > s).length + 1; }
const MEDALS = ['🥇','🥈','🥉'];

function renderSbTable(tbodyId, list, highlightScore) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = '';
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" id="sbEmpty">아직 기록이 없어요!</td></tr>`;
    return;
  }
  list.forEach((entry, i) => {
    const tr = document.createElement('tr');
    const rank = i + 1;
    if (rank === 1) tr.className = 'rank1';
    else if (rank === 2) tr.className = 'rank2';
    else if (rank === 3) tr.className = 'rank3';
    if (highlightScore !== undefined && entry.score === highlightScore && entry._highlight) {
      tr.className = 'me';
    }
    const medal = rank <= 3 ? `<span class="medal">${MEDALS[rank-1]}</span>` : rank;
    tr.innerHTML = `<td>${medal}</td><td>${entry.name}</td><td>${entry.score.toLocaleString()}</td>`;
    tbody.appendChild(tr);
  });
}

function renderOverSb() {
  const list = loadSb();
  const myRank = getRank(list, score);
  document.getElementById('myRankText').textContent =
    list.length === 0 ? '첫 번째 기록을 남겨보세요! 🎉'
    : `현재 랭킹: ${myRank}위 / ${list.length + 1}명`;
  renderSbTable('overSbBody', list, undefined);
  ['ic0','ic1','ic2'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('initialWrap').style.display = 'block';
  document.getElementById('ic0').focus();
}

function renderMainSb() {
  const list = loadSb();
  renderSbTable('sbBody', list, undefined);
}

/* ─── 이니셜 입력 ─── */
['ic0','ic1','ic2'].forEach((id, i) => {
  const el = document.getElementById(id);
  el.addEventListener('input', () => {
    el.value = el.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (el.value.length === 1 && i < 2) document.getElementById('ic' + (i+1)).focus();
  });
  el.addEventListener('keydown', e => {
    if (e.key === 'Backspace' && el.value === '' && i > 0) document.getElementById('ic' + (i-1)).focus();
  });
});

document.getElementById('btnSubmit').addEventListener('click', () => {
  const chars = ['ic0','ic1','ic2'].map(id => document.getElementById(id).value.trim().toUpperCase());
  const name = chars.join('') || '???';
  if (name.replace(/\?/g, '').length === 0) {
    ['ic0','ic1','ic2'].forEach(id => {
      const el = document.getElementById(id);
      el.style.borderColor = '#ff6b6b';
      setTimeout(() => el.style.borderColor = '', 600);
    });
    document.getElementById('ic0').focus();
    return;
  }
  let list = loadSb();
  const newEntry = { name, score, _highlight: true };
  list.push(newEntry);
  list.sort((a, b) => b.score - a.score);
  list = list.slice(0, 20);
  saveSb(list);
  renderSbTable('overSbBody', list, score);
  list.forEach(e => delete e._highlight);
  saveSb(list);
  const rank = list.findIndex(e => e.name === name && e.score === score) + 1;
  document.getElementById('myRankText').textContent = `🎉 ${rank}위로 등록됐어요!`;
  document.getElementById('initialWrap').style.display = 'none';
  const rows = document.querySelectorAll('#overSbBody tr');
  rows.forEach((tr, i) => { if (i === rank - 1) tr.className = 'me'; });
});

/* ─── 버튼 이벤트 ─── */
document.getElementById('btnStart').addEventListener('click', startGame);
document.getElementById('btnRetry').addEventListener('click', startGame);
document.getElementById('btnScore').addEventListener('click', () => {
  renderMainSb();
  startScr.style.display = 'none';
  document.getElementById('sbScreen').style.display = 'flex';
});
document.getElementById('btnSbBack').addEventListener('click', () => {
  document.getElementById('sbScreen').style.display = 'none';
  startScr.style.display = 'flex';
});

window.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft'  || e.key === 'a') keys.left  = true;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
  if (['ArrowLeft','ArrowRight','ArrowUp',' '].includes(e.key)) e.preventDefault();
});
window.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft'  || e.key === 'a') keys.left  = false;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
});

const mbl = document.getElementById('mbl');
const mbr = document.getElementById('mbr');
mbl.addEventListener('touchstart', e => { e.preventDefault(); keys.left  = true;  });
mbl.addEventListener('touchend',   e => { e.preventDefault(); keys.left  = false; });
mbr.addEventListener('touchstart', e => { e.preventDefault(); keys.right = true;  });
mbr.addEventListener('touchend',   e => { e.preventDefault(); keys.right = false; });

requestAnimationFrame(loop);
