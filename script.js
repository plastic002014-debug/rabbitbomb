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
let W, H, GY; // GY = ground top y

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
let items = [], sparks = [], pops = [], fireworks = [];
let spawnT = 0, elapsed = 0;
let lastTs = 0;
const keys = {};

// 콤보
let combo = 0, comboTimer = 0;
// 보너스 타임
let bonusActive = false, bonusTimer = 0;
let lastBonusTier = 0;
// 기록 갱신
let newRecord = false, recordTimer = 0;
// 보스 스테이지
let bossActive = false;          // 보스 진행 중
let bossWarning = false;         // WARNING 연출 중
let bossWarningTimer = 0;        // WARNING 표시 카운터 (프레임)
let bossRowsLeft = 0;            // 남은 줄 수 (5줄 통과 목표)
let bossRowTimer = 0;            // 다음 줄 스폰까지 대기
let bossRowInterval = 120;       // 줄 간격 (프레임 기준)
let lastBossTier = 0;            // 이미 발동한 보스 단계 (1000점 단위)

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
  W: 54, H: 70,
  x: 0,  y: 0,
  spd: 7,
  dir: 1,
  legT: 0,
  earT: 0,
  blinkT: 0,
  blink: false,
  face: 'normal',   // 'normal' | 'happy' | 'sad'
  faceTimer: 0,
  BW: 80,
  BH: 32,
  bx() { return this.x + this.W / 2; },
  by() { return this.y - 10; },   // 바구니 앞으로 들기 → y 조정
  reset() {
    this.x = W / 2 - this.W / 2;
    this.y = GY - this.H;
    this.legT = 0; this.earT = 0; this.blinkT = 0; this.blink = false;
    this.face = 'normal'; this.faceTimer = 0;
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

  // 점수 기반 난이도 — 상한 없이 계속 빨라짐
  //  0점 : spd=2.8  (초반부터 빠른 체감)
  //  300점: spd=4.0
  //  600점: spd=5.2
  // 1000점: spd=6.6  (이후에도 계속 증가)
  const spd   = 2.8 + (score / 300) * 1.2;
  const bombP = 0.08 + Math.min(score / 500, 1) * 0.20;

  // 보너스 타임: 10원짜리만, 현재 속도 기반으로 빠르게
  if (bonusActive) {
    const c = COINS[2];
    items.push({
      kind: 'coin', x, y: -20, r: c.r,
      vy: spd * 1.5 + Math.random() * 1.0,
      spin: Math.random() * Math.PI * 2,
      spinV: 0.05 + Math.random() * 0.04,
      value: c.value, col: c.col, shine: c.shine
    });
    return;
  }

  // 목숨 아이템
  if (score >= 100 && lives < 3 && Math.random() < 0.10) {
    items.push({ kind: 'life', x, y: -20, r: 16, vy: spd * 0.75, spin: 0 });
    return;
  }

  if (Math.random() < bombP) {
    items.push({ kind: 'bomb', x, y: -28, r: 20, vy: spd + Math.random() * 0.6, rot: 0 });
  } else {
    // 동전 순차 등장: 1점 → 5점 → 10점
    let coinIdx;
    const r = Math.random();
    if (score < 60)       coinIdx = 0;
    else if (score < 150) coinIdx = r < 0.70 ? 0 : 1;
    else if (score < 300) coinIdx = r < 0.45 ? 0 : 1;
    else                  coinIdx = r < 0.30 ? 0 : r < 0.60 ? 1 : 2;
    const c = COINS[coinIdx];
    items.push({
      kind: 'coin', x, y: -20, r: c.r,
      vy: spd + Math.random() * 0.6,
      spin: Math.random() * Math.PI * 2,
      spinV: 0.05 + Math.random() * 0.04,
      value: c.value, col: c.col, shine: c.shine
    });
  }
}

/* ─── 보스 줄(row) 스폰 ─── */
function spawnBossRow() {
  const SLOTS = 7;
  const coinSlot = Math.floor(Math.random() * SLOTS);
  const slotW = W / SLOTS;
  const spd = 2.8 + (score / 300) * 1.2;

  for (let i = 0; i < SLOTS; i++) {
    const x = slotW * i + slotW / 2;
    if (i === coinSlot) {
      const c = COINS[2];
      items.push({
        kind: 'coin', x, y: -24, r: c.r,
        vy: spd + 0.5,
        spin: Math.random() * Math.PI * 2,
        spinV: 0.06,
        value: c.value, col: c.col, shine: c.shine,
        isBossRow: true
      });
    } else {
      items.push({ kind: 'bomb', x, y: -28, r: 20, vy: spd + 0.5, rot: 0, isBossRow: true });
    }
  }
}

/* ─── 충돌 판정 (토끼 전체 영역) ─── */
function caught(item) {
  // 토끼 전체 바운딩박스 (귀 끝부터 발끝, 양옆 전체)
  const left  = bunny.x - 6;
  const right = bunny.x + bunny.W + 6;
  const top   = bunny.y - 42;   // 귀 끝 포함
  const bot   = bunny.y + bunny.H;
  return (
    item.x + item.r > left &&
    item.x - item.r < right &&
    item.y + item.r > top &&
    item.y - item.r < bot
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

  // 이동
  let moving = false;
  if (keys.left)  { bunny.x -= bunny.spd; bunny.dir = -1; moving = true; }
  if (keys.right) { bunny.x += bunny.spd; bunny.dir =  1; moving = true; }
  bunny.x = Math.max(0, Math.min(W - bunny.W, bunny.x));

  // 애니메이션
  if (moving) bunny.legT += 0.22;
  bunny.earT += 0.1;
  bunny.blinkT++;
  if (bunny.blinkT > 120 + Math.random() * 60) {
    bunny.blink = true;
    setTimeout(() => { bunny.blink = false; bunny.blinkT = 0; }, 110);
  }

  // 보너스 타임 체크 — 20콤보 달성 시 발동
  if (!bonusActive && combo > 0 && combo % 20 === 0 && lastBonusTier !== combo) {
    bonusActive = true;
    bonusTimer = 300;
    lastBonusTier = combo;
    combo = 0; comboTimer = 0; // 보너스 진입 시 콤보 초기화 (보너스 중 콤보 누적 방지)
    items = [];
    sfxBonus();
    addPop(W / 2, H / 2, '🎉 보너스 타임!', '#ffe066');
    addPop(W / 2, H / 2 + 44, '🔥 20콤보 달성!', '#ff9900');
  }

  // 보너스 타임 카운트다운
  if (bonusActive) {
    bonusTimer -= 1;
    if (bonusTimer <= 0) {
      bonusActive = false;
      combo = 0; comboTimer = 0;
      stopBonusBgm();
    }
  }

  // ── 보스 스테이지 체크 (1000점 단위)
  const bossTier = Math.floor(score / 1000);
  if (!bossActive && !bossWarning && !bonusActive && bossTier > lastBossTier) {
    lastBossTier = bossTier;
    bossWarning = true;
    bossWarningTimer = 180; // 3초 WARNING 연출
    items = []; // 화면 초기화
    spawnT = 9999; // 일반 스폰 잠시 차단
  }

  // WARNING 연출 카운트다운
  if (bossWarning) {
    bossWarningTimer--;
    if (bossWarningTimer <= 0) {
      bossWarning = false;
      bossActive = true;
      bossRowsLeft = 5;
      bossRowTimer = 0;
    }
  }

  // 보스 스테이지 진행
  if (bossActive) {
    bossRowTimer--;
    if (bossRowTimer <= 0) {
      if (bossRowsLeft > 0) {
        spawnBossRow();
        bossRowsLeft--;
        bossRowTimer = bossRowInterval;
      }
    }

    // 보스 줄 아이템이 전부 화면 밖으로 나가면 종료 판단
    const bossItems = items.filter(it => it.isBossRow);
    if (bossRowsLeft === 0 && bossItems.length === 0) {
      bossActive = false;
      addPop(W / 2, H / 2, '🎉 보스 클리어!', '#00ffcc');
      addPop(W / 2, H / 2 + 44, '+50 보너스!', '#ffe066');
      score += 50;
      elScore.textContent = score;
    }
  }

  // 스폰 — 보스/워닝 중에는 일반 아이템 스폰 차단
  elapsed += dt / 1000;
  if (!bossActive && !bossWarning) {
    spawnT += dt;
    const spawnInterval = bonusActive
      ? 220
      : Math.max(380, 1300 - score * 1.8);
    if (spawnT >= spawnInterval) {
      spawnItem();
      if (bonusActive) spawnItem();
      spawnT = 0;
    }
  }

  // 아이템 충돌
  items = items.filter(it => {
    it.y += it.vy;
    if (caught(it)) {
      if (it.kind === 'coin') {
        score += it.value;
        elScore.textContent = score;
        addSparks(it.x, it.y, it.shine, 12);
        addPop(it.x, it.y - 20, '+' + it.value, it.shine);
        sfxCoin();
        bunny.face = 'happy'; bunny.faceTimer = 50;

        // 보스 줄 동전 받으면 같은 줄 폭탄 모두 제거
        if (it.isBossRow) {
          items = items.filter(b => !(b.isBossRow && b.kind === 'bomb' && Math.abs(b.y - it.y) < 60));
        }

        // 콤보 — 보너스·보스 타임 중에는 콤보 누적 제외
        if (!bonusActive && !bossActive) {
          combo++;
          comboTimer = 180;
          if (combo > 0 && combo % 10 === 0) {
            score += 10;
            elScore.textContent = score;
            addPop(W / 2, H / 2 - 40, `🔥 ${combo}콤보!!`, '#ff9900');
            addPop(W / 2, H / 2, '+10 보너스!', '#ffe066');
            sfxCombo();
          }
        }

      } else if (it.kind === 'bomb') {
        lives--;
        combo = 0; comboTimer = 0; lastBonusTier = 0;
        // 보스 줄 폭탄 맞으면 해당 줄 전체 제거 후 보스 재도전
        if (it.isBossRow) {
          items = items.filter(b => !(b.isBossRow && Math.abs(b.y - it.y) < 60));
          if (bossRowsLeft === 0 && lives > 0) {
            // 이미 모든 줄 소화 중이었으면 패스
          }
        }
        refreshLives();
        doFlash();
        addSparks(it.x, it.y, '#ff5500', 20);
        addPop(it.x, it.y - 20, '-♥', '#ff6b6b');
        sfxBomb();
        bunny.face = 'sad'; bunny.faceTimer = 70;
        try {
          if (navigator.vibrate) {
            if (lives <= 0)       navigator.vibrate([100, 60, 100, 60, 200]);
            else if (lives === 1) navigator.vibrate([80, 50, 150]);
            else                  navigator.vibrate([80]);
          }
        } catch(e) {}
        if (lives <= 0) { setTimeout(endGame, 250); }

      } else if (it.kind === 'life') {
        if (lives < 3) {
          lives++;
          refreshLives();
          addSparks(it.x, it.y, '#00ff88', 18);
          addPop(it.x, it.y - 20, '+♥', '#00ff88');
          sfxLife();
          bunny.face = 'happy'; bunny.faceTimer = 60;
        }
      }
      return false;
    }
    return it.y < GY + 50;
  });

  // 콤보 타이머
  if (comboTimer > 0) { comboTimer--; if (comboTimer === 0) combo = 0; }

  // 표정 타이머
  if (bunny.faceTimer > 0) {
    bunny.faceTimer--;
    if (bunny.faceTimer === 0) bunny.face = 'normal';
  }

  // 기록 갱신 체크 — 이전 기록이 있을 때만 노티
  if (score > best && !newRecord && score > 0 && best > 0) {
    newRecord = true;
    recordTimer = 220;
    spawnFireworks();
  }
  if (recordTimer > 0) { recordTimer--; }

  // 파티클
  sparks.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= p.d; });
  sparks = sparks.filter(p => p.life > 0);
  pops.forEach(p => { p.y += p.vy; p.life -= 0.022; });
  pops = pops.filter(p => p.life > 0);

  // 폭죽
  fireworks.forEach(f => {
    f.particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.06;
      p.vx *= 0.97; p.life -= 0.018;
    });
    f.particles = f.particles.filter(p => p.life > 0);
  });
  fireworks = fireworks.filter(f => f.particles.length > 0);
}

/* ─── 그리기 ─── */
function draw() {
  ctx.clearRect(0, 0, W, H);

  // 보너스 타임 배경 반짝임 (나이트클럽)
  if (bonusActive) {
    const t = Date.now();
    const colors = ['#ff0088','#00ffcc','#ffff00','#ff6600','#aa00ff','#00aaff'];
    const col = colors[Math.floor(t / 120) % colors.length];
    ctx.globalAlpha = 0.13 + Math.sin(t * 0.01) * 0.07;
    ctx.fillStyle = col;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    const pulse = 1 + Math.sin(t * 0.008) * 0.06;
    ctx.save();
    ctx.translate(W / 2, 90);
    ctx.scale(pulse, pulse);
    ctx.font = 'bold 32px Jua, cursive';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = col;
    ctx.shadowColor = col; ctx.shadowBlur = 18;
    ctx.fillText('🎉 보너스 타임!', 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ── WARNING 연출
  if (bossWarning) {
    const t = Date.now();
    const flash2 = Math.floor(t / 200) % 2 === 0;
    ctx.fillStyle = flash2 ? 'rgba(180,0,0,0.35)' : 'rgba(0,0,0,0.2)';
    ctx.fillRect(0, 0, W, H);

    const pulse = 1 + Math.sin(t * 0.015) * 0.08;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(pulse, pulse);
    ctx.font = `bold ${Math.min(W * 0.14, 90)}px Jua, cursive`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = flash2 ? '#ff2222' : '#ff8888';
    ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 40;
    ctx.fillText('⚠️ WARNING ⚠️', 0, 0);
    ctx.shadowBlur = 0;
    ctx.font = `bold ${Math.min(W * 0.06, 36)}px Jua, cursive`;
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 12;
    ctx.fillText('보스 스테이지 시작!', 0, 60);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ── 보스 스테이지 진행 중 UI (남은 줄 표시)
  if (bossActive) {
    const t = Date.now();
    ctx.save();
    ctx.fillStyle = 'rgba(120,0,0,0.18)';
    ctx.fillRect(0, 0, W, H);

    // 상단 진행 바
    const total = 5;
    const cleared = total - bossRowsLeft;
    const barW = Math.min(W * 0.5, 300);
    const barX = W / 2 - barW / 2;
    const barY = 75;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.arc(W/2, 90, barW/2 + 18, 0, Math.PI*2); ctx.fill();
    ctx.font = 'bold 16px Jua, cursive';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ff4444';
    ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 10;
    ctx.fillText(`👾 보스 스테이지   ${cleared} / ${total}`, W / 2, 90);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // 폭죽
  fireworks.forEach(f => {
    f.particles.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = p.col; ctx.fill();
    });
  });
  ctx.globalAlpha = 1;

  // 아이템
  items.forEach(it => {
    if (it.kind === 'coin') drawCoin(it);
    else if (it.kind === 'bomb') drawBomb(it);
    else if (it.kind === 'life') drawLife(it);
  });

  // 파티클
  sparks.forEach(p => {
    ctx.globalAlpha = p.life;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.col; ctx.fill();
  });
  ctx.globalAlpha = 1;

  // 토끼
  drawBunny();

  // 팝업 텍스트
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

  // 기록 갱신 배너
  if (newRecord && recordTimer > 0) {
    const alpha = Math.min(1, recordTimer / 40) * Math.min(1, (recordTimer) / 30);
    const pulse = 1 + Math.sin(Date.now() * 0.012) * 0.04;
    ctx.save();
    ctx.globalAlpha = Math.min(1, recordTimer / 50);
    ctx.translate(W / 2, H / 2 - 80);
    ctx.scale(pulse, pulse);
    // 배경
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.beginPath();
    ctx.arc(0, 0, 110, 0, Math.PI*2);
    ctx.fill();
    // 텍스트
    ctx.font = 'bold 28px Jua, cursive';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffe066';
    ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 20;
    ctx.fillText('🏆 기록 갱신!', 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

/* ─── 토끼 그리기 ─── */
function drawBunny() {
  const b = bunny;
  const cx = b.x + b.W / 2;
  const by = b.y + b.H;        // 발 y
  const moving = keys.left || keys.right;
  const leg = moving ? Math.sin(b.legT) * 10 : 0;
  const face = b.face;

  ctx.save();
  ctx.translate(cx, by);       // 발 기준

  // ── 그림자
  ctx.beginPath(); ctx.ellipse(0, -2, 24, 7, 0, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fill();

  // ── 다리 (뒤쪽)
  ctx.save(); ctx.translate(-7, -14); ctx.rotate((leg - 5) * Math.PI/180);
  ctx.beginPath(); ctx.ellipse(0, 9, 5, 12, 0, 0, Math.PI*2);
  ctx.fillStyle = '#ede4da'; ctx.fill(); ctx.restore();

  // ── 다리 (앞쪽)
  ctx.save(); ctx.translate(7, -14); ctx.rotate((leg + 5) * Math.PI/180);
  ctx.beginPath(); ctx.ellipse(0, 9, 5, 12, 0, 0, Math.PI*2);
  ctx.fillStyle = '#f0e8de'; ctx.fill(); ctx.restore();

  // ── 몸통 (작고 통통)
  ctx.beginPath(); ctx.ellipse(0, -26, 15, 18, 0, 0, Math.PI*2);
  ctx.fillStyle = '#f5f0ea'; ctx.fill();
  ctx.strokeStyle = '#ddd0c4'; ctx.lineWidth = 1.2; ctx.stroke();

  // ── 배
  ctx.beginPath(); ctx.ellipse(1, -25, 8, 12, 0.1, 0, Math.PI*2);
  ctx.fillStyle = '#fffcf7'; ctx.fill();

  // ── 꼬리
  ctx.beginPath(); ctx.arc(-15, -26, 6, 0, Math.PI*2);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.strokeStyle = '#e8e0d8'; ctx.lineWidth = 1; ctx.stroke();

  // ── 팔: 앞으로 내밀어 바구니 들기
  // 왼팔
  ctx.save(); ctx.translate(-10, -32);
  ctx.rotate(30 * Math.PI/180);
  ctx.beginPath(); ctx.ellipse(0, 8, 5, 10, 0, 0, Math.PI*2);
  ctx.fillStyle = '#ede4da'; ctx.fill(); ctx.restore();
  // 오른팔
  ctx.save(); ctx.translate(10, -32);
  ctx.rotate(-30 * Math.PI/180);
  ctx.beginPath(); ctx.ellipse(0, 8, 5, 10, 0, 0, Math.PI*2);
  ctx.fillStyle = '#ede4da'; ctx.fill(); ctx.restore();

  // ── 머리 (크게!)
  const hY = -54;
  ctx.beginPath(); ctx.ellipse(0, hY, 22, 24, 0, 0, Math.PI*2);
  ctx.fillStyle = '#f5f0ea'; ctx.fill();
  ctx.strokeStyle = '#ddd0c4'; ctx.lineWidth = 1.3; ctx.stroke();

  // ── 귀
  const wig = Math.sin(b.earT) * 5;
  // 왼쪽 귀
  ctx.save(); ctx.translate(-11, hY - 18); ctx.rotate((-12 + wig) * Math.PI/180);
  ctx.beginPath(); ctx.ellipse(0, -14, 7, 18, 0, 0, Math.PI*2);
  ctx.fillStyle = '#f5f0ea'; ctx.fill();
  ctx.strokeStyle = '#ddd0c4'; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, -14, 4, 13, 0, 0, Math.PI*2);
  ctx.fillStyle = '#f9c8d0'; ctx.fill();
  ctx.restore();
  // 오른쪽 귀
  ctx.save(); ctx.translate(11, hY - 20); ctx.rotate((10 - wig * .5) * Math.PI/180);
  ctx.beginPath(); ctx.ellipse(0, -14, 7, 18, 0, 0, Math.PI*2);
  ctx.fillStyle = '#f5f0ea'; ctx.fill();
  ctx.strokeStyle = '#ddd0c4'; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, -14, 4, 13, 0, 0, Math.PI*2);
  ctx.fillStyle = '#f9c8d0'; ctx.fill();
  ctx.restore();

  // ── 볼 홍조
  ctx.globalAlpha = .38;
  ctx.beginPath(); ctx.arc(-13, hY + 6, 7, 0, Math.PI*2); ctx.fillStyle = '#ffb3c6'; ctx.fill();
  ctx.beginPath(); ctx.arc(13,  hY + 6, 7, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;

  // ── 눈
  const eyY = hY - 4;
  if (face === 'happy') {
    // 웃는 눈 (U자 반전 = 초승달)
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(-8, eyY + 2, 5, Math.PI, 0); ctx.stroke();
    ctx.beginPath(); ctx.arc( 8, eyY + 2, 5, Math.PI, 0); ctx.stroke();
  } else if (face === 'sad') {
    // 우는 눈 (눈물 + 찡그림)
    ctx.strokeStyle = '#555'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-8, eyY - 2, 5, 0, Math.PI); ctx.stroke(); // 뒤집힌 호
    ctx.beginPath(); ctx.arc( 8, eyY - 2, 5, 0, Math.PI); ctx.stroke();
    // 눈물방울
    ctx.fillStyle = '#88ccff';
    ctx.beginPath(); ctx.arc(-8, eyY + 7, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( 8, eyY + 7, 3, 0, Math.PI*2); ctx.fill();
  } else if (b.blink) {
    ctx.strokeStyle = '#444'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-12, eyY); ctx.lineTo(-4, eyY + 1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4,   eyY); ctx.lineTo(12, eyY + 1); ctx.stroke();
  } else {
    // 기본 눈 (동그란 반짝이 눈)
    [[-8, eyY],[8, eyY]].forEach(([ex, ey]) => {
      ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI*2);
      ctx.fillStyle = '#2a2a2a'; ctx.fill();
      ctx.beginPath(); ctx.arc(ex - 1, ey - 1.5, 2, 0, Math.PI*2);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.beginPath(); ctx.arc(ex + 2, ey + 1.5, 1, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fill();
    });
  }

  // ── 코
  ctx.beginPath(); ctx.ellipse(0, eyY + 9, 4, 3, 0, 0, Math.PI*2);
  ctx.fillStyle = '#ffb3c6'; ctx.fill();
  ctx.strokeStyle = '#e8a0b8'; ctx.lineWidth = .8; ctx.stroke();

  // ── 입
  if (face === 'happy') {
    ctx.beginPath();
    ctx.moveTo(-7, eyY + 14);
    ctx.quadraticCurveTo(0, eyY + 22, 7, eyY + 14);
    ctx.strokeStyle = '#c07080'; ctx.lineWidth = 2; ctx.stroke();
    // 웃음 보조선
    ctx.beginPath(); ctx.moveTo(-7, eyY+14); ctx.lineTo(-10, eyY+11);
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(7, eyY+14); ctx.lineTo(10, eyY+11);
    ctx.stroke();
  } else if (face === 'sad') {
    ctx.beginPath();
    ctx.moveTo(-7, eyY + 18);
    ctx.quadraticCurveTo(0, eyY + 12, 7, eyY + 18);
    ctx.strokeStyle = '#c07080'; ctx.lineWidth = 2; ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-5, eyY + 14);
    ctx.quadraticCurveTo(0, eyY + 18, 5, eyY + 14);
    ctx.strokeStyle = '#c07080'; ctx.lineWidth = 1.5; ctx.stroke();
  }

  ctx.restore();

  // ── 바구니 (앞으로 내밀어 들기: 몸통 앞쪽, 절대 좌표)
  const bskX = cx + b.dir * 14;   // 방향에 따라 살짝 앞으로
  const bskY = by - 36;
  drawBasket(bskX, bskY, b.dir);
}

function drawBasket(cx, topY, dir) {
  const bw = bunny.BW, bh = bunny.BH;
  dir = dir || 1;
  ctx.save();
  ctx.translate(cx, topY);
  ctx.rotate(dir * -18 * Math.PI/180);   // 앞으로 약간 기울임

  // 몸체 (사다리꼴)
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

  // 격자 무늬
  ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.lineWidth = 1.4;
  for (let xi = -bw/2; xi < bw/2; xi += 11) {
    ctx.beginPath(); ctx.moveTo(xi, 0); ctx.lineTo(xi + 7, bh); ctx.stroke();
  }
  for (let yi = 0; yi <= bh; yi += 9) {
    ctx.beginPath(); ctx.moveTo(-bw/2, yi); ctx.lineTo(bw/2, yi); ctx.stroke();
  }
  ctx.restore();

  // 윗테두리
  ctx.beginPath(); ctx.moveTo(-bw/2, 0); ctx.lineTo(bw/2, 0);
  ctx.strokeStyle = '#e8a820'; ctx.lineWidth = 4.5; ctx.stroke();

  // 손잡이
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
  // 광택
  ctx.beginPath(); ctx.arc(-c.r*.26, -c.r*.28, c.r*.28, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fill();
  ctx.restore();
}

/* ─── 폭탄 그리기 ─── */
function drawBomb(b) {
  b.rot += 0.045;
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);

  // 몸체
  ctx.beginPath(); ctx.arc(0, 2, b.r, 0, Math.PI*2);
  const g = ctx.createRadialGradient(-b.r*.3, -b.r*.15, 0, 0, 2, b.r);
  g.addColorStop(0, '#606060'); g.addColorStop(1, '#111');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#222'; ctx.lineWidth = 2.5; ctx.stroke();

  // 하이라이트
  ctx.beginPath(); ctx.arc(-b.r*.28, -b.r*.12, b.r*.24, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fill();

  // 도화선
  ctx.beginPath();
  ctx.moveTo(0, -b.r);
  ctx.bezierCurveTo(8, -b.r-10, 14, -b.r-5, 10, -b.r-19);
  ctx.strokeStyle = '#8b6914'; ctx.lineWidth = 2.5; ctx.stroke();

  // 불꽃 (도화선 끝)
  const ff = Math.sin(Date.now() * .03) * 2.5;
  ctx.beginPath(); ctx.arc(10, -b.r-19+ff, 5.5, 0, Math.PI*2);
  ctx.fillStyle = '#ff8800'; ctx.fill();
  ctx.beginPath(); ctx.arc(10, -b.r-19+ff, 3.5, 0, Math.PI*2);
  ctx.fillStyle = '#ffee00'; ctx.fill();
  ctx.beginPath(); ctx.arc(10, -b.r-20+ff, 1.8, 0, Math.PI*2);
  ctx.fillStyle = '#fff'; ctx.fill();

  ctx.restore();
}

/* ─── 목숨 아이템 그리기 ─── */
function drawLife(it) {
  it.spin = (it.spin || 0) + 0.06;
  const pulse = 1 + Math.sin(it.spin * 2) * 0.08;
  ctx.save();
  ctx.translate(it.x, it.y);
  ctx.scale(pulse, pulse);
  // 하트 모양
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.bezierCurveTo(-18, -8, -22, 10, 0, 22);
  ctx.bezierCurveTo(22, 10, 18, -8, 0, 6);
  ctx.fillStyle = '#ff4466';
  ctx.shadowColor = '#ff88aa'; ctx.shadowBlur = 14;
  ctx.fill();
  ctx.shadowBlur = 0;
  // 하이라이트
  ctx.beginPath(); ctx.arc(-6, 2, 4, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fill();
  ctx.restore();
}

/* ─── 폭죽 ─── */
function spawnFireworks() {
  const colors = ['#ffe066','#ff6b6b','#00ffcc','#ff88ff','#66aaff','#ffaa44'];
  for (let b = 0; b < 6; b++) {
    const fx = W * 0.15 + Math.random() * W * 0.7;
    const fy = H * 0.1 + Math.random() * H * 0.35;
    const col = colors[b % colors.length];
    const particles = [];
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const s = 2 + Math.random() * 5;
      particles.push({
        x: fx, y: fy,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1,
        r: 2 + Math.random() * 3,
        col, life: 1
      });
    }
    fireworks.push({ particles });
  }
}

/* ─── 효과음 추가 ─── */
function sfxCombo() {
  const ac = getAudioCtx();
  const g = ac.createGain(); g.connect(ac.destination);
  [523,659,784,1046].forEach((f,i) => playTone(f,'square', ac.currentTime+i*0.07, 0.15, 0.18, ac, g));
}
function sfxLife() {
  const ac = getAudioCtx();
  const g = ac.createGain(); g.connect(ac.destination);
  [392,523,659,784].forEach((f,i) => playTone(f,'sine', ac.currentTime+i*0.08, 0.18, 0.2, ac, g));
}

let bonusBgmPlaying = false, bonusBgmGain = null, bonusBgmTimer = null;
function sfxBonus() {
  // 기존 BGM 잠시 낮춤
  if (bgmMasterGain) bgmMasterGain.gain.setValueAtTime(0.2, getAudioCtx().currentTime);
  if (bonusBgmPlaying) return;
  bonusBgmPlaying = true;
  const ac = getAudioCtx();
  bonusBgmGain = ac.createGain();
  bonusBgmGain.gain.value = 0.22;
  bonusBgmGain.connect(ac.destination);
  // 신나는 보너스 멜로디 루프
  const BONUS_NOTES = [
    [784,0.5],[880,0.5],[988,0.5],[1046,0.5],
    [988,0.5],[880,0.5],[784,1.0],
    [659,0.5],[784,0.5],[880,1.0],
  ];
  const bpm = 180, beat = 60/bpm;
  function playBonusLoop() {
    if (!bonusBgmPlaying) return;
    let t = ac.currentTime;
    BONUS_NOTES.forEach(([f, b]) => {
      playTone(f, 'square', t, b*beat*0.85, 0.25, ac, bonusBgmGain);
      t += b * beat;
    });
    const total = BONUS_NOTES.reduce((s,[,b])=>s+b,0) * beat;
    bonusBgmTimer = setTimeout(playBonusLoop, (total - 0.05) * 1000);
  }
  playBonusLoop();
}
function stopBonusBgm() {
  bonusBgmPlaying = false;
  clearTimeout(bonusBgmTimer);
  if (bonusBgmGain) {
    bonusBgmGain.gain.exponentialRampToValueAtTime(0.001, getAudioCtx().currentTime + 0.3);
  }
  // BGM 원래대로
  if (bgmMasterGain) bgmMasterGain.gain.setValueAtTime(1, getAudioCtx().currentTime + 0.3);
}

/* ─── 타이머 ─── */
/* ─── 오디오 엔진 (Web Audio API) ─── */
let audioCtx = null;
let bgmNodes = [];   // 현재 재생 중인 bgm 노드들
let bgmPlaying = false;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

// 단음 재생 헬퍼
function playTone(freq, type, start, duration, gain, ctx, dest) {
  const osc = ctx.createOscillator();
  const g   = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(g); g.connect(dest);
  osc.start(start); osc.stop(start + duration);
}

// ── BGM: 경쾌한 8비트 멜로디 루프 ──
const BGM_BPM   = 148;
const BGM_BEAT  = 60 / BGM_BPM;
const BGM_BAR   = BGM_BEAT * 4;

// 멜로디 음표 (도레미 기준 Hz, C4=261.63)
const NOTE = {
  C4:261.63, D4:293.66, E4:329.63, F4:349.23,
  G4:392.00, A4:440.00, B4:493.88,
  C5:523.25, D5:587.33, E5:659.25, F5:698.46,
  G5:783.99, A5:880.00,
  G3:196.00, C3:130.81, F3:174.61,
};

// 멜로디 패턴 (음, 박자길이)
const MELODY = [
  [NOTE.E4,1],[NOTE.G4,1],[NOTE.A4,2],
  [NOTE.G4,1],[NOTE.E4,1],[NOTE.C4,2],
  [NOTE.D4,1],[NOTE.F4,1],[NOTE.G4,2],
  [NOTE.F4,1],[NOTE.D4,1],[NOTE.B4,2],  // ← 2바
  [NOTE.E4,1],[NOTE.G4,1],[NOTE.C5,2],
  [NOTE.B4,1],[NOTE.G4,1],[NOTE.E4,2],
  [NOTE.A4,1],[NOTE.C5,1],[NOTE.E5,1],[NOTE.C5,1],
  [NOTE.G4,2],[NOTE.E4,2],              // ← 4바
];

// 베이스 패턴 (4바 반복)
const BASS = [
  [NOTE.C3,2],[NOTE.G3,2],
  [NOTE.C3,2],[NOTE.G3,2],
  [NOTE.F3,2],[NOTE.C3,2],
  [NOTE.G3,2],[NOTE.G3,2],
];

function scheduleBgmLoop(ctx, masterGain) {
  if (!bgmPlaying) return;
  const now = ctx.currentTime;
  const melodyGain = ctx.createGain();
  melodyGain.gain.value = 0.18;
  melodyGain.connect(masterGain);

  const bassGain = ctx.createGain();
  bassGain.gain.value = 0.12;
  bassGain.connect(masterGain);

  // 멜로디
  let t = now;
  MELODY.forEach(([freq, beats]) => {
    const dur = beats * BGM_BEAT;
    playTone(freq, 'square', t, dur * 0.85, 0.3, ctx, melodyGain);
    t += dur;
  });

  // 베이스
  let bt = now;
  BASS.forEach(([freq, beats]) => {
    const dur = beats * BGM_BEAT;
    playTone(freq, 'triangle', bt, dur * 0.7, 0.5, ctx, bassGain);
    bt += dur;
  });

  // 리듬 (하이햇 느낌)
  const drumGain = ctx.createGain();
  drumGain.gain.value = 0.06;
  drumGain.connect(masterGain);
  for (let i = 0; i < 16; i++) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let j = 0; j < data.length; j++) data[j] = (Math.random() * 2 - 1) * (1 - j / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(drumGain);
    src.start(now + i * BGM_BEAT * 0.5);
  }

  // 루프 길이 = MELODY 총 박자 합
  const totalBeats = MELODY.reduce((s, [,b]) => s + b, 0);
  const loopDur = totalBeats * BGM_BEAT;

  bgmNodes._timer = setTimeout(() => scheduleBgmLoop(ctx, masterGain), (loopDur - 0.1) * 1000);
}

let bgmMasterGain = null;
function startBgm() {
  if (bgmPlaying) return;
  bgmPlaying = true;
  const ctx = getAudioCtx();
  if (ctx.state === 'suspended') ctx.resume();
  bgmMasterGain = ctx.createGain();
  bgmMasterGain.gain.value = 1;
  bgmMasterGain.connect(ctx.destination);
  scheduleBgmLoop(ctx, bgmMasterGain);
}

function stopBgm() {
  bgmPlaying = false;
  clearTimeout(bgmNodes._timer);
  if (bgmMasterGain) {
    bgmMasterGain.gain.setValueAtTime(bgmMasterGain.gain.value, getAudioCtx().currentTime);
    bgmMasterGain.gain.exponentialRampToValueAtTime(0.001, getAudioCtx().currentTime + 0.3);
  }
}

// ── 효과음 ──
function sfxCoin() {
  const ctx = getAudioCtx();
  const g = ctx.createGain(); g.connect(ctx.destination);
  [523, 659, 784].forEach((f, i) => playTone(f, 'sine', ctx.currentTime + i*0.06, 0.12, 0.15, ctx, g));
}
function sfxBomb() {
  const ctx = getAudioCtx();
  const g = ctx.createGain(); g.gain.value = 0.4; g.connect(ctx.destination);
  // 저음 펑 소리
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(120, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.3);
  const eg = ctx.createGain();
  eg.gain.setValueAtTime(0.5, ctx.currentTime);
  eg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
  osc.connect(eg); eg.connect(g);
  osc.start(); osc.stop(ctx.currentTime + 0.35);
  // 노이즈
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i=0;i<d.length;i++) d[i] = (Math.random()*2-1)*(1-i/d.length);
  const ns = ctx.createBufferSource(); ns.buffer = buf;
  const ng = ctx.createGain(); ng.gain.value = 0.3;
  ns.connect(ng); ng.connect(g); ns.start();
}
function sfxGameOver() {
  const ctx = getAudioCtx();
  const g = ctx.createGain(); g.connect(ctx.destination);
  [[220,0],[185,0.25],[165,0.5],[130,0.8]].forEach(([f,t]) =>
    playTone(f, 'sawtooth', ctx.currentTime+t, 0.3, 0.25, ctx, g));
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
  items = []; sparks = []; pops = []; fireworks = []; spawnT = 0;
  combo = 0; comboTimer = 0;
  bonusActive = false; bonusTimer = 0; lastBonusTier = 0;
  newRecord = false; recordTimer = 0;
  bossActive = false; bossWarning = false; bossWarningTimer = 0;
  bossRowsLeft = 0; bossRowTimer = 0; lastBossTier = 0;
  stopBonusBgm();
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
  stopBonusBgm();
  sfxGameOver();
  const hadPrevBest = best > 0;
  const isNewBest = score > best;
  if (isNewBest) best = score;
  elBest.textContent    = best;
  elGoScore.textContent = `내 점수: ${score} 점`;
  // 이전 기록이 없으면 신기록 표시 안 함
  elGoBest.textContent  = (isNewBest && hadPrevBest) ? '🏆 신기록!' : `최고기록: ${best} 점`;

  renderOverSb();
  overScr.style.display = 'flex';
}

/* ─── 스코어보드 localStorage ─── */
const SB_KEY = 'rabbitCoinSB_v1';
function loadSb() {
  try { return JSON.parse(localStorage.getItem(SB_KEY)) || []; }
  catch(e) { return []; }
}
function saveSb(list) {
  localStorage.setItem(SB_KEY, JSON.stringify(list));
}
function getRank(list, s) {
  // 내 점수보다 높은 항목 수 + 1
  return list.filter(e => e.score > s).length + 1;
}
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

  // 현재 점수 임시 하이라이트용 플래그 없이 렌더
  renderSbTable('overSbBody', list, undefined);

  // 입력 초기화
  ['ic0','ic1','ic2'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('initialWrap').style.display = 'block';
  document.getElementById('ic0').focus();
}

function renderMainSb() {
  const list = loadSb();
  renderSbTable('sbBody', list, undefined);
}

/* ─── 이니셜 입력 자동 포커스 ─── */
['ic0','ic1','ic2'].forEach((id, i) => {
  const el = document.getElementById(id);
  el.addEventListener('input', () => {
    el.value = el.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (el.value.length === 1 && i < 2) {
      document.getElementById('ic' + (i+1)).focus();
    }
  });
  el.addEventListener('keydown', e => {
    if (e.key === 'Backspace' && el.value === '' && i > 0) {
      document.getElementById('ic' + (i-1)).focus();
    }
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

  // 저장
  let list = loadSb();
  const newEntry = { name, score, _highlight: true };
  list.push(newEntry);
  list.sort((a, b) => b.score - a.score);
  // 상위 20개만 유지
  list = list.slice(0, 20);
  saveSb(list);

  // 하이라이트 해서 다시 렌더
  renderSbTable('overSbBody', list, score);
  // 하이라이트 플래그 제거 후 저장
  list.forEach(e => delete e._highlight);
  saveSb(list);

  const rank = list.findIndex(e => e.name === name && e.score === score) + 1;
  document.getElementById('myRankText').textContent = `🎉 ${rank}위로 등록됐어요!`;
  document.getElementById('initialWrap').style.display = 'none';

  // me 클래스 강제 적용
  const rows = document.querySelectorAll('#overSbBody tr');
  rows.forEach((tr, i) => {
    if (i === rank - 1) tr.className = 'me';
  });
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

// 모바일
const mbl = document.getElementById('mbl');
const mbr = document.getElementById('mbr');
mbl.addEventListener('touchstart', e => { e.preventDefault(); keys.left  = true;  });
mbl.addEventListener('touchend',   e => { e.preventDefault(); keys.left  = false; });
mbr.addEventListener('touchstart', e => { e.preventDefault(); keys.right = true;  });
mbr.addEventListener('touchend',   e => { e.preventDefault(); keys.right = false; });

requestAnimationFrame(loop);
