// frontend/play.js
const API = 'http://localhost:3000/api';

// ─── Configuración desde setup.html ───
const defaultConfig = {
  opponent: { ai: 'groq', temp: 0.3 },
  expert: { ai: 'gemini' },
  humanColor: 'white'
};
const matchConfig = JSON.parse(sessionStorage.getItem('chess_human_config')) || defaultConfig;

const aiNames = {
  gemini: 'Gemini 2.5 Flash',
  groq: 'Groq Llama 3.1',
  cohere: 'Cohere Command R',
  mistral: 'Mistral Large',
};
function getAiDisplayName(engineId) {
  if (!engineId) return 'IA';
  if (engineId.toLowerCase().startsWith('ollama:')) {
    const modelTag = engineId.split(':')[1] || 'Ollama';
    return `Ollama (${modelTag})`;
  }
  return aiNames[engineId.toLowerCase()] || engineId;
}
const humanColor = matchConfig.humanColor === 'black' ? 'b' : 'w';
const opponentColor = humanColor === 'w' ? 'b' : 'w';

// ─── Estado del juego (local, independiente del modo IA vs IA) ───
const chess = new Chess();
let board = null;
let gameOver = false;
let waitingForOpponent = false;

const PIECE_THEME = (piece) =>
  `https://lichess1.org/assets/piece/cburnett/${piece}.svg`;

// ─── Piezas capturadas (reutilizado del modo IA vs IA) ───
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

function renderCapturedPieces() {
  const fen = chess.fen();
  const captured = getCapturedPieces(fen);

  // Piezas capturadas por el jugador (piezas del oponente que tomó)
  const playerContainer = document.getElementById('capturedByPlayer');
  const opponentContainer = document.getElementById('capturedByOpponent');
  if (!playerContainer || !opponentContainer) return;

  const playerCapturedColor = opponentColor; // piezas de ese color fueron capturadas por el jugador
  const opponentCapturedColor = humanColor;

  playerContainer.innerHTML = '';
  for (const [piece, count] of Object.entries(captured[playerCapturedColor])) {
    for (let i = 0; i < count; i++) {
      const img = document.createElement('img');
      img.src = PIECE_THEME(playerCapturedColor + piece.toUpperCase());
      img.alt = piece;
      playerContainer.appendChild(img);
    }
  }

  opponentContainer.innerHTML = '';
  for (const [piece, count] of Object.entries(captured[opponentCapturedColor])) {
    for (let i = 0; i < count; i++) {
      const img = document.createElement('img');
      img.src = PIECE_THEME(opponentCapturedColor + piece.toUpperCase());
      img.alt = piece;
      opponentContainer.appendChild(img);
    }
  }
}

// ─── Inicializar tablero ───
function initBoard() {
  const config = {
    position: chess.fen(),
    pieceTheme: PIECE_THEME,
    draggable: true,
    orientation: humanColor === 'w' ? 'white' : 'black',
    onDragStart: onDragStart,
    onDrop: onDrop,
  };

  board = Chessboard('board', config);
}

// ─── Validar inicio de arrastre ───
function onDragStart(source, piece) {
  if (gameOver || waitingForOpponent) return false;

  // Solo se puede mover si es turno del jugador
  if (chess.turn() !== humanColor) return false;

  // Solo se pueden arrastrar piezas propias
  const pieceColor = piece[0]; // 'w' o 'b'
  if (pieceColor !== humanColor) return false;

  return true;
}

// ─── Procesar movimiento del jugador ───
function onDrop(source, target) {
  // Intentar el movimiento (siempre promociona a reina por simplicidad)
  const move = chess.move({ from: source, to: target, promotion: 'q' });

  if (move === null) {
    return 'snapback'; // movimiento ilegal, regresar pieza
  }

  updateBoardAndState();
  checkGameOver();

  if (!gameOver) {
    // Turno de la IA oponente
    requestOpponentMove();
  }
}

// ─── Actualizar tablero, contador y piezas capturadas ───
function updateBoardAndState() {
  board.position(chess.fen());
  renderCapturedPieces();
  document.getElementById('moveCount').textContent = `Movimiento #${chess.history().length}`;
}

// ─── Verificar fin de partida ───
function checkGameOver() {
  if (chess.game_over()) {
    gameOver = true;
    let result;

    if (chess.in_checkmate()) {
      const winnerColor = chess.turn() === 'w' ? 'b' : 'w';
      result = winnerColor === humanColor ? 'humano' : 'ia';
    } else {
      result = 'draw';
    }

    showResult(result);
    setBadge('finished');
    return true;
  }

  if (chess.turn() === humanColor) {
    setBadge('player-turn');
  } else {
    setBadge('opponent-turn');
  }

  return false;
}

// ─── Badge de estado ───

function setBadge(state) {
  const badge = document.getElementById('statusBadge');

  if (state === 'player-turn') {
    badge.textContent = 'TU TURNO';
    badge.className = 'badge';
  } else if (state === 'opponent-turn') {
    const displayName = getAiDisplayName(matchConfig.opponent.ai);
    badge.textContent = `${displayName.toUpperCase()} PIENSA`;
    badge.className = 'badge running';
  } else if (state === 'finished') {
    badge.textContent = 'PARTIDA TERMINADA';
    badge.className = 'badge finished';
  }
}

// ─── Overlay de resultado ───
function showResult(result) {
  const overlay = document.getElementById('resultOverlay');
  const icon = document.getElementById('resultIcon');
  const title = document.getElementById('resultTitle');
  const sub = document.getElementById('resultSub');

  if (result === 'humano') {
    icon.textContent = '🏆';
    title.textContent = '¡Ganaste!';
    sub.textContent = 'Jaque mate a tu favor';
  } else if (result === 'ia') {
    icon.textContent = '🤖';
    const displayName = getAiDisplayName(matchConfig.opponent.ai);
    title.textContent = `Ganó ${displayName}`;
    sub.textContent = 'Jaque mate de la IA';
  } else {
    icon.textContent = '🤝';
    title.textContent = 'Empate';
    sub.textContent = 'Tablas';
  }

  overlay.classList.add('visible');
}

// ─── Pedir jugada a la IA oponente ───
async function requestOpponentMove() {
  waitingForOpponent = true;
  document.getElementById('thinkingOpponent').classList.add('active');
  document.getElementById('panelOpponent').classList.add('active-turn');
  document.getElementById('panelPlayer').classList.remove('active-turn');

  try {
    const fen = chess.fen();
    const legalMoves = chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion ?? ''));

    const res = await fetch(`${API}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fen,
        legalMoves,
        engine: matchConfig.opponent.ai,
        temperature: matchConfig.opponent.temp
      })
    });

    const data = await res.json();
    const uciMove = data.move;

    if (!uciMove) throw new Error('La IA no devolvió un movimiento.');

    const from = uciMove.slice(0, 2);
    const to = uciMove.slice(2, 4);
    const promotion = uciMove.length === 5 ? uciMove[4] : 'q';

    const move = chess.move({ from, to, promotion });

    if (!move) {
      console.error('[Opponent] Movimiento ilegal recibido:', uciMove);
      addChatMessage('system', `⚠ La IA intentó un movimiento inválido (${uciMove}). Reintentando...`);
      waitingForOpponent = false;
      document.getElementById('thinkingOpponent').classList.remove('active');
      return requestOpponentMove();
    }

    updateBoardAndState();
    checkGameOver();

  } catch (err) {
    console.error('[Opponent] Error obteniendo movimiento:', err);
    addChatMessage('system', '⚠ Error al obtener el movimiento de la IA oponente.');
  } finally {
    waitingForOpponent = false;
    document.getElementById('thinkingOpponent').classList.remove('active');
    document.getElementById('panelOpponent').classList.remove('active-turn');
    if (!gameOver && chess.turn() === humanColor) {
      document.getElementById('panelPlayer').classList.add('active-turn');
    }
  }
}

// ─── Chat del experto ───
function addChatMessage(type, text) {
  const messages = document.getElementById('chatMessages');
  const msg = document.createElement('div');
  msg.className = `chat-message ${type}`;
  msg.innerHTML = text;
  messages.appendChild(msg);
  messages.scrollTop = messages.scrollHeight;
}

async function requestExpertAdvice() {
  if (gameOver || waitingForOpponent) return;
  if (chess.turn() !== humanColor) {
    addChatMessage('system', 'Espera tu turno para pedir una sugerencia.');
    return;
  }

  const btn = document.getElementById('btnSuggest');
  btn.disabled = true;
  addChatMessage('system', '🧠 Pensando la mejor jugada...');

  try {
    const fen = chess.fen();
    const legalMoves = chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion ?? ''));

    const res = await fetch(`${API}/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fen,
        legalMoves,
        engine: matchConfig.expert.ai
      })
    });

    const data = await res.json();

    // Eliminar el mensaje "pensando"
    const messages = document.getElementById('chatMessages');
    const lastMsg = messages.lastElementChild;
    if (lastMsg && lastMsg.textContent.includes('Pensando')) {
      lastMsg.remove();
    }

    if (data.move) {
      const san = moveToSan(data.move);
      addChatMessage('expert', `Te recomiendo jugar <span class="chat-move-highlight">${san || data.move}</span>. ${data.explanation}`);
    } else {
      addChatMessage('system', '⚠ El experto no pudo generar una sugerencia.');
    }

  } catch (err) {
    console.error('[Expert] Error:', err);
    addChatMessage('system', '⚠ Error al consultar al experto.');
  } finally {
    btn.disabled = false;
  }
}

// ─── Convertir UCI a SAN para mostrar de forma legible ───
function moveToSan(uciMove) {
  const from = uciMove.slice(0, 2);
  const to = uciMove.slice(2, 4);
  const promotion = uciMove.length === 5 ? uciMove[4] : undefined;

  // Probar el movimiento en una copia para obtener el SAN sin alterar el estado real
  const tempChess = new Chess(chess.fen());
  const move = tempChess.move({ from, to, promotion: promotion ?? 'q' });

  return move ? move.san : null;
}

// ─── Inicialización ───
// ─── Inicialización ───
function init() {
  initBoard();
  renderCapturedPieces();

  const opponentName = getAiDisplayName(matchConfig.opponent.ai);
  const expertName = getAiDisplayName(matchConfig.expert.ai);

  // Configurar paneles con info del matchConfig
  document.getElementById('nameOpponent').textContent = opponentName;
  document.getElementById('detailsOpponent').textContent =
    (opponentColor === 'w' ? '⬜ Blancas' : '⬛ Negras') + ` (Temp: ${matchConfig.opponent.temp})`;

  document.getElementById('detailsPlayer').textContent =
    (humanColor === 'w' ? '⬜ Blancas' : '⬛ Negras');

  document.getElementById('expertName').textContent = expertName;

  setBadge(chess.turn() === humanColor ? 'player-turn' : 'opponent-turn');

  if (humanColor === 'w') {
    document.getElementById('panelPlayer').classList.add('active-turn');
  } else {
    document.getElementById('panelOpponent').classList.add('active-turn');
  }

  // Si el jugador es negro, la IA (blancas) mueve primero
  if (chess.turn() !== humanColor) {
    requestOpponentMove();
  }
}

// ─── Eventos ───
document.getElementById('btnSuggest').addEventListener('click', requestExpertAdvice);
document.getElementById('btnReset').addEventListener('click', () => location.reload());
document.getElementById('btnBack').addEventListener('click', () => {
  window.location.href = 'setup.html';
});

init();