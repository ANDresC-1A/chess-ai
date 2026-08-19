// frontend/main.js
const API = 'http://localhost:3000/api';

let board = null;
let currentTurn = 'white';
let gameRunning = false;
let eventSource = null;

// ─── Configuración Dinámica de la Arena ───
const defaultConfig = {
  white: { ai: 'gemini', temp: 0.3 },
  black: { ai: 'groq', temp: 0.3 }
};
const gameConfig = JSON.parse(sessionStorage.getItem('chess_arena_config')) || defaultConfig;

const aiNames = {
  gemini: 'Gemini 2.5 Flash',
  groq: 'Groq Llama 3.1',
  cohere: 'Cohere Command-R',
  mistral: 'Mistral Large'
};

function getEngineName(engineKey) {
  if (!engineKey) return "Desconocido";
  const keyLower = engineKey.toLowerCase();
  
  if (keyLower.startsWith("ollama:")) {
    const modelTag = engineKey.split(":")[1] || "Local";
    return `Ollama: ${modelTag}`;
  }
  
  return aiNames[keyLower] || engineKey;
}

// ─── Inicializar tablero ───
const PIECE_THEME = (piece) =>
  `https://lichess1.org/assets/piece/cburnett/${piece}.svg`;

function initBoard(fen) {
  if (board) board.destroy();

  board = Chessboard('board', {
    position: fen || 'start',
    pieceTheme: PIECE_THEME,
    draggable: false,
  });
}

// ─── Piezas capturadas ───

const INITIAL_PIECES = {
  w: { p: 8, n: 2, b: 2, r: 2, q: 1 },
  b: { p: 8, n: 2, b: 2, r: 2, q: 1 }
};

function countPiecesFromFEN(fen) {
  const placement = fen.split(' ')[0];
  const counts = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0 }
  };

  for (const char of placement) {
    if (char === '/' || /\d/.test(char)) continue;
    const color = char === char.toUpperCase() ? 'w' : 'b';
    const piece = char.toLowerCase();
    if (counts[color][piece] !== undefined) {
      counts[color][piece]++;
    }
  }
  return counts;
}

function getCapturedPieces(fen) {
  const current = countPiecesFromFEN(fen);
  const captured = { w: {}, b: {} };

  for (const color of ['w', 'b']) {
    for (const piece of Object.keys(INITIAL_PIECES[color])) {
      const diff = INITIAL_PIECES[color][piece] - current[color][piece];
      if (diff > 0) captured[color][piece] = diff;
    }
  }
  return captured;
}

function renderCapturedPieces(fen) {
  const containerBlack = document.getElementById('capturedByBlack');
  const containerWhite = document.getElementById('capturedByWhite');

  // Si los contenedores no existen aún en el DOM, no hacer nada
  if (!containerBlack || !containerWhite) return;

  const captured = getCapturedPieces(fen);

  containerBlack.innerHTML = '';
  for (const [piece, count] of Object.entries(captured.w)) {
    for (let i = 0; i < count; i++) {
      const img = document.createElement('img');
      img.src = PIECE_THEME('w' + piece.toUpperCase());
      img.alt = piece;
      containerBlack.appendChild(img);
    }
  }

  containerWhite.innerHTML = '';
  for (const [piece, count] of Object.entries(captured.b)) {
    for (let i = 0; i < count; i++) {
      const img = document.createElement('img');
      img.src = PIECE_THEME('b' + piece.toUpperCase());
      img.alt = piece;
      containerWhite.appendChild(img);
    }
  }
}

// ─── Actualizar UI con el estado recibido ───
function updateUI(state) {
  const { fen, turn, history, status, result, moveCount } = state;
  
  // 1. PRIMERO: mover las piezas en el tablero (prioridad máxima)
  if (board) {
    board.position(fen, true);
  } else {
    console.warn('[UI] El tablero no está inicializado al recibir estado.');
  }

  currentTurn = turn;

  // 2. Piezas capturadas (aislado con try/catch para que no rompa el resto)
  try {
    renderCapturedPieces(fen);
  } catch (err) {
    console.error('[UI] Error renderizando piezas capturadas:', err);
  }

  // Contador de movimientos
  document.getElementById('moveCount').textContent = `Movimiento #${history.length}`;

  // Turno activo en paneles
  document.getElementById('panelWhite').classList.toggle('active-turn', turn === 'white' && status === 'running');
  document.getElementById('panelBlack').classList.toggle('active-turn', turn === 'black' && status === 'running');

  // Indicadores de pensando
  document.getElementById('thinkingWhite').classList.toggle('active', turn === 'white' && status === 'running');
  document.getElementById('thinkingBlack').classList.toggle('active', turn === 'black' && status === 'running');

  // Badge de estado
  const badge = document.getElementById('statusBadge');
  if (status === 'running') {
    const currentEngine = turn === 'white' ? gameConfig.white.ai : gameConfig.black.ai;
    const currentName = getEngineName(currentEngine).toUpperCase();

    badge.textContent = turn === 'white' ? `⬜ ${currentName} PIENSA` : `⬛ ${currentName} PIENSA`;
    badge.className = 'badge running';
  }
   else if (status === 'finished') {
    badge.textContent = 'PARTIDA TERMINADA';
    badge.className = 'badge finished';
  } else {
    badge.textContent = 'EN ESPERA';
    badge.className = 'badge';
  }

  // Log de movimientos (solo el último)
  if (history.length > 0) {
    const lastMove = history[history.length - 1];
    const lastColor = history.length % 2 === 1 ? 'white' : 'black';
    const logBody = document.getElementById('moveLog');

    const empty = logBody.querySelector('.log-empty');
    if (empty) empty.remove();

    const existing = logBody.querySelectorAll('.log-move');
    if (existing.length < history.length) {
      const chip = document.createElement('span');
      chip.className = `log-move ${lastColor}`;
      chip.textContent = `${history.length}. ${lastMove}`;
      logBody.appendChild(chip);
      logBody.scrollTop = logBody.scrollHeight;
    }
  }

  // Fin de partida
  if (status === 'finished') {
    showResult(result);
    setButtonState(false);
    gameRunning = false;
  }
}

// ─── Mostrar overlay de resultado ───
function showResult(result) {
  const overlay = document.getElementById('resultOverlay');
  const icon = document.getElementById('resultIcon');
  const title = document.getElementById('resultTitle');
  const sub = document.getElementById('resultSub');

  if (result === 'white wins') {
    icon.textContent = '🏆';
    title.textContent = `¡Ganó ${getEngineName(gameConfig.white.ai)}!`;
    sub.textContent = 'Las blancas ganan por jaque mate';
  } else if (result === 'black wins') {
    icon.textContent = '🏆';
    title.textContent = `¡Ganó ${getEngineName(gameConfig.black.ai)}!`;
    sub.textContent = 'Las negras ganan por jaque mate';
  } else {
    icon.textContent = '🤝';
    title.textContent = 'Empate';
    sub.textContent = result || 'Tablas';
  }

  overlay.classList.add('visible');
}

// ─── Conectar SSE ───
function connectSSE() {
  if (eventSource) eventSource.close();

  eventSource = new EventSource(`${API}/stream`);

  eventSource.onmessage = (e) => {
    try {
      const state = JSON.parse(e.data);
      updateUI(state);
    } catch (err) {
      console.error('[SSE] Error parseando estado:', err);
    }
  };

  eventSource.onerror = () => {
    console.warn('[SSE] Conexión perdida. Reintentando...');
  };
}

// ─── Acciones ───
async function startGame() {
  try {
    document.getElementById('btnStart').disabled = true;

    const res = await fetch(`${API}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gameConfig)
    });

    if (res.ok || res.status === 200) {
      gameRunning = true;
      document.getElementById('resultOverlay').classList.remove('visible');
      setButtonState(true);
      console.log('[UI] Partida iniciada/reanudada.');
    } else {
      const data = await res.json();
      alert(data.error || 'No se pudo reanudar la partida.');
      setButtonState(false);
    }
  } catch (err) {
    console.warn('[UI] Sincronizando estado de reanudación...');
    gameRunning = true;
    setButtonState(true);
  }
}

async function stopGame() {
  await fetch(`${API}/stop`, { method: 'POST' });
  gameRunning = false;
  setButtonState(false);
}

async function resetGame() {
  await fetch(`${API}/reset`, { method: 'POST' });
  gameRunning = false;
  setButtonState(false);
  document.getElementById('resultOverlay').classList.remove('visible');
  document.getElementById('moveLog').innerHTML = '<span class="log-empty">La partida aún no ha comenzado...</span>';
  document.getElementById('moveCount').textContent = 'Movimiento #0';
  document.getElementById('statusBadge').textContent = 'EN ESPERA';
  document.getElementById('statusBadge').className = 'badge';
  document.getElementById('panelWhite').classList.remove('active-turn');
  document.getElementById('panelBlack').classList.remove('active-turn');
  document.getElementById('thinkingWhite').classList.remove('active');
  document.getElementById('thinkingBlack').classList.remove('active');

  const cw = document.getElementById('capturedByWhite');
  const cb = document.getElementById('capturedByBlack');
  if (cw) cw.innerHTML = '';
  if (cb) cb.innerHTML = '';

  initBoard('start');
}

function setButtonState(running) {
  const btnStart = document.getElementById('btnStart');
  const btnStop = document.getElementById('btnStop');

  if (btnStart) btnStart.disabled = running;
  if (btnStop) btnStop.disabled = !running;
}

// ─── Eventos de botones ───
document.getElementById('btnStart').addEventListener('click', startGame);
document.getElementById('btnStop').addEventListener('click', stopGame);
document.getElementById('btnReset').addEventListener('click', resetGame);

// ─── Arranque ───

// Inicializar nombres y avatares dinámicos en los paneles basados en sessionStorage
if (document.getElementById('nameWhite')) {
  document.getElementById('nameWhite').innerText = getEngineName(gameConfig.white.ai);
  document.getElementById('detailsWhite').innerText = `⬜ Blancas (Temp: ${gameConfig.white.temp})`;
  document.getElementById('avatarWhite').innerText = gameConfig.white.ai[0].toUpperCase();

  document.getElementById('nameBlack').innerText = getEngineName(gameConfig.black.ai);
  document.getElementById('detailsBlack').innerText = `⬛ Negras (Temp: ${gameConfig.black.temp})`;
  document.getElementById('avatarBlack').innerText = gameConfig.black.ai[0].toUpperCase();
}


// 1. Inicializar el tablero PRIMERO, de forma síncrona, antes de cualquier llamada de red
initBoard('start');

// 2. Limpieza y conexión SSE
async function prepararArenaDesdeCero() {
  try {
    console.log('[Arena] Limpiando residuos de partidas anteriores en el servidor...');
    await fetch(`${API}/reset`, { method: 'POST' });
    console.log('[Arena] Lista y en espera para iniciar desde cero.');
  } catch (err) {
    console.error('[Arena] Error al preparar la sesión limpia:', err);
  } finally {
    connectSSE();
  }
}

prepararArenaDesdeCero();