const C = 2 * Math.PI * 110;

let state = 'idle';
let focusStart = 0;
let focusElapsed = 0;
let breakTotal = 0;
let breakRemaining = 0;
let ticker = null;
let lastNotif = null;
let notifTimeOut = null;

/* ── localStorage ── */
const LS_KEY = 'foco-libre-sessions';

function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || [];
  } catch (e) { return []; }
}

function saveSessions(arr) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(arr)); } catch (e) { }
}

let sessions = loadSessions();
let totalFocusSec = sessions.reduce((a, s) => a + s.focus, 0);
let totalBreakSec = sessions.reduce((a, s) => a + s.breakTime, 0);

const el = id => document.getElementById(id);

/* ── Notifications ── */
let notifGranted = Notification.permission === 'granted';

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const seq = [
      { freq: 880, start: 0, dur: 0.12 },
      { freq: 880, start: 0.16, dur: 0.12 },
      { freq: 1174, start: 0.32, dur: 0.22 },
    ];
    seq.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + start + 0.01);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    });
  } catch (e) { }
}

function sendNotification() {
  beep();
  if (notifGranted) {
    try {
      if (lastNotif) lastNotif.close();
      lastNotif = new Notification('¡Descanso terminado!', {
        body: 'Hora de volver a concentrarse. 🎯',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23D85A30"/><text x="16" y="21" text-anchor="middle" font-size="16" fill="white">⏱</text></svg>',
        tag: 'foco-libre-break',
      });
    } catch (e) { }
  }
}

function requestNotifPermission() {
  Notification.requestPermission().then(p => {
    notifGranted = p === 'granted';
    banner.style.display = 'none';
  });
}

function showBannerIfNeeded() {
  if (Notification.permission === 'default') {
    banner.style.display = 'flex';
  }
}

const timeText = el('time-text');
const modeLabel = el('mode-label');
const dot = el('dot');
const subTxt = el('sub-txt');
const btnMain = el('btn-main');
const btnLabel = el('btn-label');
const btnIcon = el('btn-icon');
const btnSec = el('btn-secondary');
const ringFill = el('ring-fill');
const ringGlow = el('ring-bg-glow');
const histList = el('history-list');
const emptyHint = el('empty-hint');
const clearBtn = el('clear-btn');
const statSess = el('stat-sessions');
const statFocus = el('stat-focus');
const statBreak = el('stat-break');
const banner = el('notif-banner');

el('notif-allow').addEventListener('click', requestNotifPermission);
el('notif-dismiss').addEventListener('click', () => { banner.style.display = 'none'; });

showBannerIfNeeded();

/* ── Render saved sessions on load ── */
if (sessions.length > 0) {
  const emptyEl = el('empty-hint');
  if (emptyEl) emptyEl.remove();
  clearBtn.style.display = 'block';
  sessions.forEach((s, i) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.setAttribute('role', 'listitem');
    item.innerHTML = `
          <span class="h-num">#${i + 1}</span>
          <span class="h-focus">${fmtShort(s.focus)} foco</span>
          <span class="h-arrow">→</span>
          <span class="h-break">${fmtShort(s.breakTime)} descanso</span>
        `;
    histList.appendChild(item);
  });
  updateStats();
}

ringFill.style.strokeDasharray = C;
ringFill.style.strokeDashoffset = C;

function fmt(s) {
  // Aseguramos que los segundos sean enteros por si se pasan decimales
  s = Math.floor(s); 
  
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  
  ret = ''

  if (h > 0) {
    ret = String(h).padStart(2, '0') + ':' 
  }

  ret += String(m).padStart(2, '0') + ':' + 
         String(sec).padStart(2, '0');
  
  return ret
}

function fmtShort(s) {
  s = Math.floor(s);
  
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  if (h > 0) {
    // Si hay horas, mostramos la hora sin pad, pero los minutos SÍ llevan cero a la izquierda
    return String(h) + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  } else {
    // Si no hay horas, mostramos los minutos sin pad
    return String(m) + ':' + String(sec).padStart(2, '0');
  }
}

function setRing(progress, color, glowColor) {
  const offset = C * (1 - Math.min(progress, 1));
  ringFill.style.strokeDashoffset = offset;
  ringFill.style.stroke = color;
  ringGlow.style.stroke = glowColor;
  ringGlow.style.opacity = progress > 0.02 ? '0.18' : '0';
}

function updateStats() {
  statSess.textContent = sessions.length;
  statFocus.textContent = fmtShort(totalFocusSec);
  statBreak.textContent = fmtShort(totalBreakSec);
}

function addHistoryItem(n, fSec, bSec) {
  if (emptyHint) emptyHint.remove();
  clearBtn.style.display = 'block';
  const item = document.createElement('div');
  item.className = 'history-item';
  item.setAttribute('role', 'listitem');
  item.innerHTML = `
        <span class="h-num">#${n}</span>
        <span class="h-focus">${fmtShort(fSec)} foco</span>
        <span class="h-arrow">→</span>
        <span class="h-break">${fmtShort(bSec)} descanso</span>
      `;
  histList.insertBefore(item, histList.firstChild);
}

/* ── FOCUS START ── */
function startFocus() {
  state = 'focus';
  focusStart = Date.now();
  focusElapsed = 0;

  modeLabel.className = 'mode-label focus';
  modeLabel.textContent = 'concentrándose';
  timeText.className = 'focus';
  dot.className = 'dot active';
  subTxt.textContent = 'tiempo corriendo';
  btnLabel.textContent = 'terminar sesión';
  btnIcon.className = 'ti ti-player-stop';
  btnMain.className = 'btn';
  setRing(0, 'var(--focus)', 'var(--focus)');

  ticker = setInterval(() => {
    focusElapsed = Math.floor((Date.now() - focusStart) / 1000);
    timeText.textContent = fmt(focusElapsed);
    setRing(Math.min(focusElapsed / 5400, 1), 'var(--focus)', 'var(--focus)');
  }, 500);
}

/* ── FOCUS END → BREAK START ── */
function endFocus() {
  clearInterval(ticker);
  focusElapsed = Math.floor((Date.now() - focusStart) / 1000);
  breakTotal = Math.max(1, Math.round(focusElapsed / 5));
  breakRemaining = breakTotal;
  const breakStart = Date.now();

  const n = sessions.length + 1;
  sessions.push({ focus: focusElapsed, breakTime: breakTotal });
  saveSessions(sessions);
  totalFocusSec += focusElapsed;
  totalBreakSec += breakTotal;
  addHistoryItem(n, focusElapsed, breakTotal);
  updateStats();

  state = 'break';
  modeLabel.className = 'mode-label break';
  modeLabel.textContent = 'descansando';
  timeText.className = 'break';
  dot.className = 'dot active break';
  subTxt.textContent = 'descanso ganado';
  btnLabel.textContent = 'saltar descanso';
  btnIcon.className = 'ti ti-player-skip-forward';
  btnMain.className = 'btn break-mode';
  setRing(1, 'var(--break)', 'var(--break)');
  timeText.textContent = fmt(breakRemaining);

  notifTimeOut = setTimeout(() => {
    sendNotification();
    notifTimeOut = null; 
  }, breakRemaining * 1000);

  ticker = setInterval(() => {
    const elapsed = Math.floor((Date.now() - breakStart) / 1000);
    breakRemaining = breakTotal - elapsed;
    timeText.textContent = fmt(Math.max(breakRemaining, 0));
    setRing(Math.max(breakRemaining, 0) / breakTotal, 'var(--break)', 'var(--break)');
    if (breakRemaining <= 0) { finishBreak(); }
  }, 500);
}

/* ── BREAK END ── */
function finishBreak() {
  clearInterval(ticker);
  if (notifTimeOut) {
    clearTimeout(notifTimeOut);
    sendNotification();
    notifTimeOut = null;
  }
  state = 'idle';
  modeLabel.className = 'mode-label';
  modeLabel.textContent = '¡muy bien! listo para otra';
  timeText.textContent = '00:00';
  timeText.className = '';
  dot.className = 'dot';
  subTxt.textContent = 'concentración libre';
  btnLabel.textContent = 'iniciar';
  btnIcon.className = 'ti ti-player-play';
  btnMain.className = 'btn';
  ringFill.style.strokeDashoffset = C;
  ringGlow.style.opacity = '0';
}

/* ── RESET ── */
function reset() {
  clearInterval(ticker);
  clearTimeout(notifTimeOut);
  state = 'idle';
  focusElapsed = 0;
  modeLabel.className = 'mode-label';
  modeLabel.textContent = 'listo para comenzar';
  timeText.textContent = '00:00';
  timeText.className = '';
  dot.className = 'dot';
  subTxt.textContent = 'concentración libre';
  btnLabel.textContent = 'iniciar';
  btnIcon.className = 'ti ti-player-play';
  btnMain.className = 'btn';
  ringFill.style.strokeDashoffset = C;
  ringGlow.style.opacity = '0';
}

btnMain.addEventListener('click', () => {
  if (state === 'idle') startFocus();
  else if (state === 'focus') endFocus();
  else if (state === 'break') finishBreak();
});

btnSec.addEventListener('click', reset);

clearBtn.addEventListener('click', () => {
  sessions = [];
  totalFocusSec = 0;
  totalBreakSec = 0;
  saveSessions([]);
  histList.innerHTML = '<div class="empty" id="empty-hint">tus sesiones aparecerán aquí</div>';
  clearBtn.style.display = 'none';
  updateStats();
});