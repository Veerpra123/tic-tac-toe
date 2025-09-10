
/* ====== DOM ====== */
const boardEl = document.getElementById('board');
const cells = Array.from(document.querySelectorAll('.cell'));
const turnEl = document.getElementById('turn');
const resetBtn = document.getElementById('resetBtn');
const restartSameBtn = document.getElementById('restartSame');
const muteBtn = document.getElementById('muteBtn');
const scoreXEl = document.getElementById('scoreX');
const scoreOEl = document.getElementById('scoreO');
const confettiCanvas = document.getElementById('confetti-canvas');

let board = [];
let currentPlayer = 'X';
let running = true;
const WIN_COMBOS = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];
let scores = { X: 0, O: 0 };
let muted = false;

/* ====== Audio ====== */
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let audioAllowed = false; // will be set true after first user gesture

function ensureAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
}
function resumeAudioIfNeeded() {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().then(()=> { audioAllowed = true; }).catch(()=>{});
  } else if (audioCtx) {
    audioAllowed = true;
  }
}
function playTone(freq, duration=0.08, type='sine') {
  if (muted) return;
  try {
    ensureAudio();
    resumeAudioIfNeeded();
    if (!audioAllowed && audioCtx.state === 'suspended') return; // avoid error
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.connect(g);
    g.connect(audioCtx.destination);
    g.gain.value = 0.03;
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    o.stop(audioCtx.currentTime + duration + 0.02);
  } catch (err) {
    // Fail silently on unsupported browsers
    // console.warn('Audio error', err);
  }
}
function playMoveSound(player) {
  playTone(player === 'X' ? 420 : 320, 0.06);
}
function playWinSound() {
  playTone(880, 0.12, 'sine');
  setTimeout(()=> playTone(660,0.12,'sawtooth'), 120);
  setTimeout(()=> playTone(520,0.12,'triangle'), 260);
}

/* ====== Confetti (lightweight) ====== */
const ctx = confettiCanvas && confettiCanvas.getContext ? confettiCanvas.getContext('2d') : null;
let confetti = [];
function resizeCanvas(){
  if (!confettiCanvas) return;
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function spawnConfetti(x=undefined, y=undefined, count=40) {
  if (!ctx) return;
  const colors = ['#7c3aed','#06b6d4','#ffb86b','#7ee7ff','#f97316','#ff6bcb'];
  for (let i=0;i<count;i++){
    confetti.push({
      x: x ?? Math.random()*confettiCanvas.width,
      y: y ?? Math.random()*confettiCanvas.height*0.3,
      vx: (Math.random()-0.5)*6,
      vy: (Math.random()*-6) - 2,
      r: Math.random()*6 + 4,
      color: colors[Math.floor(Math.random()*colors.length)],
      rot: Math.random()*360,
      vr: (Math.random()-0.5)*10,
      life: 0,
      ttl: 70 + Math.random()*40
    });
  }
}
function stepConfetti(){
  if (!ctx) return;
  ctx.clearRect(0,0,confettiCanvas.width, confettiCanvas.height);
  for (let i = confetti.length-1; i >= 0; i--){
    const p = confetti[i];
    p.vy += 0.18;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life++;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate((p.rot*Math.PI)/180);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.r/2, -p.r/2, p.r, p.r*0.6);
    ctx.restore();
    if (p.life > p.ttl || p.y > confettiCanvas.height + 50) confetti.splice(i,1);
  }
  requestAnimationFrame(stepConfetti);
}
requestAnimationFrame(stepConfetti);

/* ====== Game functions ====== */
function initGame() {
  board = Array(9).fill('');
  currentPlayer = 'X';
  running = true;
  cells.forEach((cell, idx) => {
    cell.className = 'cell';
    cell.removeAttribute('data-symbol');
    cell.disabled = false;
    cell.setAttribute('data-index', idx);
    cell.setAttribute('aria-label', `Cell ${idx+1}`);
  });
  updateStatus(`${currentPlayer}'s turn`);
  document.querySelector('.status-bar')?.classList.add('status-active');
}

function updateStatus(text) {
  turnEl.textContent = `Player ${text}`;
}

function handleCellClick(e) {
  // ensure audio can start after a real user gesture
  if (!audioAllowed) {
    ensureAudio();
    resumeAudioIfNeeded();
    audioAllowed = true;
  }

  const el = e.currentTarget;
  const idx = Number(el.dataset.index);
  if (!running || board[idx] !== '') return;

  board[idx] = currentPlayer;
  el.setAttribute('data-symbol', currentPlayer);
  el.classList.add('filled', currentPlayer.toLowerCase());
  playMoveSound(currentPlayer);

  // check win
  if (checkWin(currentPlayer)) {
    running = false;
    updateStatus(`${currentPlayer} wins!`);
    highlightWin(currentPlayer);
    scores[currentPlayer]++;
    updateScores();
    playWinSound();
    // confetti center
    const r = boardEl.getBoundingClientRect();
    spawnConfetti(r.left + r.width/2, r.top + r.height/2, 100);
    return;
  }

  // check tie
  if (checkTie()) {
    running = false;
    updateStatus('Tie');
    spawnConfetti(undefined, undefined, 30);
    return;
  }

  currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
  updateStatus(`${currentPlayer}'s turn`);
}

function checkWin(player) {
  return WIN_COMBOS.some(combo => combo.every(i => board[i] === player));
}

function highlightWin(player) {
  WIN_COMBOS.forEach(combo => {
    if (combo.every(i => board[i] === player)) {
      combo.forEach(i => {
        const c = cells[i];
        c.classList.add('win');
        const r = c.getBoundingClientRect();
        spawnConfetti(r.left + r.width/2, r.top + r.height/2, 12);
      });
    }
  });
  disableAll();
}

function checkTie() {
  return board.every(cell => cell !== '');
}

function disableAll() {
  cells.forEach(c => c.disabled = true);
}

function resetGame() {
  initGame();
  scores = { X: 0, O: 0 };
  updateScores();
}

function restartSame() {
  board = Array(9).fill('');
  cells.forEach(cell => {
    cell.className = 'cell';
    cell.removeAttribute('data-symbol');
    cell.disabled = false;
  });
  running = true;
  updateStatus(`${currentPlayer}'s turn`);
}

function updateScores() {
  scoreXEl.textContent = scores.X;
  scoreOEl.textContent = scores.O;
}

/* ====== Events & accessibility ====== */
cells.forEach(cell => cell.addEventListener('click', handleCellClick));
resetBtn.addEventListener('click', resetGame);
restartSameBtn.addEventListener('click', restartSame);
muteBtn.addEventListener('click', () => {
  muted = !muted;
  muteBtn.textContent = muted ? '🔇 Sound Off' : '🔊 Sound On';
  muteBtn.setAttribute('aria-pressed', String(muted));
});

// keyboard navigation for grid
let focusedIndex = 0;
cells.forEach((cell, i) => {
  cell.tabIndex = 0;
  cell.addEventListener('focus', () => focusedIndex = i);
  cell.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); cell.click(); }
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(ev.key)) {
      ev.preventDefault();
      let r = Math.floor(focusedIndex/3), c = focusedIndex%3;
      if (ev.key === 'ArrowLeft') c = (c + 2) % 3;
      if (ev.key === 'ArrowRight') c = (c + 1) % 3;
      if (ev.key === 'ArrowUp') r = (r + 2) % 3;
      if (ev.key === 'ArrowDown') r = (r + 1) % 3;
      focusedIndex = r*3 + c;
      cells[focusedIndex].focus();
    }
  });
});

/* ====== First user gesture ensures audio resume (mobile autoplay policies) ====== */
function firstUserGestureHandler() {
  ensureAudio();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});
  audioAllowed = true;
  window.removeEventListener('pointerdown', firstUserGestureHandler);
}
window.addEventListener('pointerdown', firstUserGestureHandler, { once: true });

/* ====== Start game ====== */
initGame();
updateScores();
