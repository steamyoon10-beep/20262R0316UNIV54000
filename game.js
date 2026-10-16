"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const startPanel = document.getElementById("start-panel");
const gameOverPanel = document.getElementById("game-over-panel");
const startButton = document.getElementById("start-button");
const restartButton = document.getElementById("restart-button");
const finalScoreEl = document.getElementById("final-score");
const soundButton = document.getElementById("sound-button");
const soundIcon = document.getElementById("sound-icon");

const WORLD = {
  width: 1080,
  height: 520,
  groundY: 406,
};

const PALETTE = {
  sky: "#efe9dc",
  skyNight: "#252d3d",
  ink: "#19202a",
  muted: "#6f746f",
  acid: "#d8ff5e",
  orange: "#ff6b35",
  dune: "#d9d1c2",
};

let state = "idle";
let lastTime = 0;
let distance = 0;
let speed = 420;
let spawnTimer = 0;
let nextSpawn = 1.3;
let groundOffset = 0;
let shake = 0;
let muted = false;
let duckHeld = false;
let obstacles = [];
let particles = [];
let audioContext = null;
let best = Number(localStorage.getItem("dino-sprint-best") || 0);

bestEl.textContent = padScore(best);

const dino = {
  x: 155,
  y: WORLD.groundY - 72,
  width: 68,
  height: 72,
  normalHeight: 72,
  duckHeight: 42,
  vy: 0,
  grounded: true,
  step: 0,
};

function padScore(value) {
  return Math.floor(value).toString().padStart(5, "0");
}

function resetGame() {
  distance = 0;
  speed = 420;
  spawnTimer = 0;
  nextSpawn = 1.1;
  groundOffset = 0;
  shake = 0;
  obstacles = [];
  particles = [];
  duckHeld = false;
  Object.assign(dino, {
    y: WORLD.groundY - dino.normalHeight,
    height: dino.normalHeight,
    vy: 0,
    grounded: true,
    step: 0,
  });
  scoreEl.textContent = "00000";
}

function startGame() {
  resetGame();
  state = "running";
  startPanel.hidden = true;
  gameOverPanel.hidden = true;
  ensureAudio();
  beep(230, 0.06, "square", 0.035);
}

function endGame() {
  state = "over";
  shake = 12;
  const final = Math.floor(distance);
  if (final > best) {
    best = final;
    localStorage.setItem("dino-sprint-best", String(best));
    bestEl.textContent = padScore(best);
  }
  finalScoreEl.textContent = final.toLocaleString("ko-KR");
  gameOverPanel.hidden = false;
  beep(115, 0.16, "sawtooth", 0.055);
  setTimeout(() => beep(76, 0.22, "square", 0.04), 90);
}

function jump() {
  if (state === "idle") {
    startGame();
  }
  if (state !== "running" || !dino.grounded) return;
  dino.vy = -900;
  dino.grounded = false;
  addDust(dino.x + 18, WORLD.groundY - 2, 9);
  beep(360, 0.08, "square", 0.035);
}

function setDuck(value) {
  duckHeld = value;
  if (state !== "running" || !dino.grounded) return;
  dino.height = value ? dino.duckHeight : dino.normalHeight;
  dino.y = WORLD.groundY - dino.height;
}

function ensureAudio() {
  if (muted) return;
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) audioContext = new AudioCtx();
  }
  if (audioContext?.state === "suspended") audioContext.resume();
}

function beep(frequency, duration, type = "square", volume = 0.03) {
  if (muted) return;
  ensureAudio();
  if (!audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function spawnObstacle() {
  const canFly = distance > 180;
  const flyer = canFly && Math.random() < 0.28;
  if (flyer) {
    const high = Math.random() < 0.5;
    obstacles.push({
      type: "ptero",
      x: WORLD.width + 50,
      y: high ? WORLD.groundY - 126 : WORLD.groundY - 72,
      width: 72,
      height: 42,
      phase: Math.random() * Math.PI * 2,
    });
  } else {
    const tall = Math.random() < 0.48;
    obstacles.push({
      type: "cactus",
      x: WORLD.width + 40,
      y: WORLD.groundY - (tall ? 86 : 58),
      width: tall ? 42 : 54,
      height: tall ? 86 : 58,
      variant: Math.floor(Math.random() * 3),
    });
  }
}

function addDust(x, y, count) {
  for (let i = 0; i < count; i += 1) {
    particles.push({
      x,
      y,
      vx: randomBetween(-85, 10),
      vy: randomBetween(-90, -20),
      life: randomBetween(0.2, 0.48),
      maxLife: 0.48,
      size: randomBetween(3, 8),
    });
  }
}

function update(dt) {
  if (shake > 0) shake = Math.max(0, shake - dt * 38);

  for (const particle of particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 250 * dt;
    particle.life -= dt;
  }
  particles = particles.filter((particle) => particle.life > 0);

  if (state !== "running") return;

  distance += dt * speed * 0.025;
  speed = Math.min(860, 420 + distance * 0.58);
  groundOffset = (groundOffset + speed * dt) % 86;
  scoreEl.textContent = padScore(distance);
  dino.step += dt * (speed / 64);

  dino.vy += 2200 * dt;
  dino.y += dino.vy * dt;
  if (dino.y >= WORLD.groundY - dino.height) {
    const justLanded = !dino.grounded;
    dino.y = WORLD.groundY - dino.height;
    dino.vy = 0;
    dino.grounded = true;
    dino.height = duckHeld ? dino.duckHeight : dino.normalHeight;
    dino.y = WORLD.groundY - dino.height;
    if (justLanded) addDust(dino.x + 24, WORLD.groundY, 5);
  }

  if (!dino.grounded && duckHeld) dino.vy += 1700 * dt;

  spawnTimer += dt;
  if (spawnTimer >= nextSpawn) {
    spawnObstacle();
    spawnTimer = 0;
    const difficulty = Math.max(0.65, 1 - distance / 1800);
    nextSpawn = randomBetween(0.95, 1.65) * difficulty + 0.22;
  }

  for (const obstacle of obstacles) {
    obstacle.x -= speed * dt;
    if (obstacle.type === "ptero") obstacle.phase += dt * 13;
  }
  obstacles = obstacles.filter((obstacle) => obstacle.x + obstacle.width > -50);

  if (dino.grounded && Math.random() < dt * 9) {
    addDust(dino.x + 15, WORLD.groundY - 2, 1);
  }

  const hitbox = {
    x: dino.x + 13,
    y: dino.y + 9,
    width: dino.width - 24,
    height: dino.height - 12,
  };

  for (const obstacle of obstacles) {
    const insetX = obstacle.type === "ptero" ? 8 : 5;
    const box = {
      x: obstacle.x + insetX,
      y: obstacle.y + 5,
      width: obstacle.width - insetX * 2,
      height: obstacle.height - 8,
    };
    if (
      hitbox.x < box.x + box.width &&
      hitbox.x + hitbox.width > box.x &&
      hitbox.y < box.y + box.height &&
      hitbox.y + hitbox.height > box.y
    ) {
      endGame();
      break;
    }
  }
}

function draw() {
  const dusk = Math.min(1, Math.max(0, (distance - 480) / 280));
  ctx.save();
  if (shake > 0) {
    ctx.translate(randomBetween(-shake, shake), randomBetween(-shake * 0.4, shake * 0.4));
  }

  drawSky(dusk);
  drawSun(dusk);
  drawDunes(dusk);
  drawGround(dusk);
  drawParticles(dusk);
  drawDino(dusk);
  for (const obstacle of obstacles) drawObstacle(obstacle, dusk);
  drawDistanceMarkers(dusk);
  ctx.restore();
}

function drawSky(dusk) {
  const gradient = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  gradient.addColorStop(0, mixColor(PALETTE.sky, PALETTE.skyNight, dusk));
  gradient.addColorStop(1, mixColor("#faf5e9", "#596174", dusk));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  ctx.fillStyle = `rgba(255,255,255,${0.5 * dusk})`;
  for (let i = 0; i < 22; i += 1) {
    const x = (i * 137 + 51) % WORLD.width;
    const y = (i * 61 + 30) % 210;
    const r = i % 4 === 0 ? 1.5 : 0.8;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSun(dusk) {
  const x = 815;
  const y = 118 + dusk * 25;
  ctx.save();
  ctx.globalAlpha = 1 - dusk * 0.22;
  ctx.fillStyle = mixColor(PALETTE.orange, "#f6df99", dusk);
  ctx.beginPath();
  ctx.arc(x, y, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(255,107,53,${0.22 * (1 - dusk)})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 77, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawDunes(dusk) {
  const offset = groundOffset * 0.08;
  ctx.fillStyle = mixColor("#ddd5c6", "#343d51", dusk);
  ctx.beginPath();
  ctx.moveTo(0, 325);
  ctx.quadraticCurveTo(180 - offset, 260, 390 - offset, 326);
  ctx.quadraticCurveTo(610 - offset, 382, 820 - offset, 302);
  ctx.quadraticCurveTo(980 - offset, 252, 1080, 305);
  ctx.lineTo(1080, 420);
  ctx.lineTo(0, 420);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.5;
  ctx.fillStyle = mixColor("#c9c0b1", "#2b3344", dusk);
  ctx.beginPath();
  ctx.moveTo(0, 357);
  ctx.quadraticCurveTo(280 + offset, 294, 535 + offset, 365);
  ctx.quadraticCurveTo(810 + offset, 424, 1080, 340);
  ctx.lineTo(1080, 430);
  ctx.lineTo(0, 430);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawGround(dusk) {
  ctx.fillStyle = mixColor("#252b31", "#141923", dusk);
  ctx.fillRect(0, WORLD.groundY, WORLD.width, WORLD.height - WORLD.groundY);
  ctx.fillStyle = mixColor(PALETTE.acid, PALETTE.orange, dusk * 0.75);
  ctx.fillRect(0, WORLD.groundY, WORLD.width, 4);

  ctx.strokeStyle = `rgba(255,255,255,${0.12 + dusk * 0.08})`;
  ctx.lineWidth = 2;
  for (let x = -groundOffset; x < WORLD.width; x += 86) {
    ctx.beginPath();
    ctx.moveTo(x, 452);
    ctx.lineTo(x + 40, 452);
    ctx.stroke();
  }
}

function drawDistanceMarkers(dusk) {
  ctx.fillStyle = `rgba(255,255,255,${0.2 + dusk * 0.15})`;
  ctx.font = "11px 'Courier New', monospace";
  ctx.textAlign = "right";
  ctx.fillText(`${Math.floor(distance)}M`, WORLD.width - 28, WORLD.height - 24);
}

function drawDino(dusk) {
  const x = dino.x;
  const y = dino.y;
  const ducking = dino.height === dino.duckHeight;
  const body = mixColor(PALETTE.ink, "#f4f0e6", dusk);
  const accent = mixColor(PALETTE.acid, PALETTE.orange, dusk);
  ctx.save();
  ctx.translate(x, y);

  if (ducking) {
    ctx.fillStyle = body;
    roundedRect(ctx, 4, 8, 58, 31, 9);
    ctx.fill();
    ctx.fillRect(47, 0, 23, 22);
    ctx.fillStyle = accent;
    ctx.fillRect(58, 7, 5, 5);
    ctx.fillStyle = body;
    ctx.fillRect(10, 35, 12, 7);
    ctx.fillRect(44, 35, 12, 7);
  } else {
    ctx.fillStyle = body;
    roundedRect(ctx, 19, 25, 37, 35, 8);
    ctx.fill();
    ctx.fillRect(42, 4, 29, 30);
    ctx.fillRect(8, 41, 21, 12);
    ctx.fillRect(3, 34, 11, 12);

    ctx.fillStyle = accent;
    ctx.fillRect(58, 11, 5, 5);
    ctx.fillStyle = body;
    const stride = Math.sin(dino.step) > 0;
    ctx.fillRect(stride ? 21 : 35, 56, 10, 16);
    ctx.fillRect(stride ? 40 : 22, 59, 10, 13);
    ctx.fillStyle = mixColor(PALETTE.sky, PALETTE.skyNight, dusk);
    ctx.fillRect(45, 26, 26, 7);
  }
  ctx.restore();
}

function drawObstacle(obstacle, dusk) {
  const color = mixColor("#556046", "#f1b35d", dusk);
  ctx.save();
  ctx.translate(obstacle.x, obstacle.y);
  if (obstacle.type === "cactus") {
    ctx.fillStyle = color;
    roundedRect(ctx, obstacle.width * 0.36, 0, obstacle.width * 0.29, obstacle.height, 7);
    ctx.fill();
    ctx.fillRect(0, obstacle.height * 0.42, obstacle.width * 0.5, 11);
    ctx.fillRect(0, obstacle.height * 0.24, 10, obstacle.height * 0.28);
    if (obstacle.variant !== 1) {
      ctx.fillRect(obstacle.width * 0.57, obstacle.height * 0.58, obstacle.width * 0.43, 10);
      ctx.fillRect(obstacle.width - 10, obstacle.height * 0.42, 10, obstacle.height * 0.25);
    }
  } else {
    const wing = Math.sin(obstacle.phase) > 0 ? -13 : 9;
    ctx.fillStyle = mixColor("#3a424b", "#e6ddd0", dusk);
    roundedRect(ctx, 19, 15, 34, 20, 6);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(45, 17);
    ctx.lineTo(72, 11);
    ctx.lineTo(53, 27);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(29, 19);
    ctx.lineTo(7, wing);
    ctx.lineTo(36, 27);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.orange;
    ctx.fillRect(48, 20, 4, 4);
  }
  ctx.restore();
}

function drawParticles(dusk) {
  const color = mixColor("#8f8779", "#f0a650", dusk);
  for (const particle of particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = color;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  }
  ctx.globalAlpha = 1;
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function mixColor(colorA, colorB, amount) {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  const t = Math.max(0, Math.min(1, amount));
  return `rgb(${Math.round(a.r + (b.r - a.r) * t)}, ${Math.round(
    a.g + (b.g - a.g) * t,
  )}, ${Math.round(a.b + (b.b - a.b) * t)})`;
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  const normalized = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function frame(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000 || 0, 0.034);
  lastTime = timestamp;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (event) => {
  if (["Space", "ArrowUp", "ArrowDown"].includes(event.code)) event.preventDefault();
  if ((event.code === "Space" || event.code === "ArrowUp") && !event.repeat) jump();
  if (event.code === "ArrowDown") setDuck(true);
  if (event.code === "KeyR" && state === "over") startGame();
});

window.addEventListener("keyup", (event) => {
  if (event.code === "ArrowDown") setDuck(false);
});

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  if (state === "over") startGame();
  else jump();
});

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);
soundButton.addEventListener("click", () => {
  muted = !muted;
  soundIcon.textContent = muted ? "×" : "♪";
  soundButton.setAttribute("aria-label", muted ? "소리 켜기" : "소리 끄기");
  if (!muted) beep(440, 0.06, "square", 0.03);
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && state === "running") {
    state = "idle";
    startPanel.hidden = false;
  }
});

requestAnimationFrame(frame);

