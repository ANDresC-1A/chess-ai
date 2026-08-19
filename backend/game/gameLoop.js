import { game } from './chessGame.js';
import { getAIMove } from '../agents/agentsmanager.js';

const DELAY_MS = 2000;
const MAX_MOVES = 200;

let loopRunning = false;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function startGameLoop(onMove, matchConfig) {
  if (loopRunning) {
    console.warn('[GameLoop] Ya hay una partida en curso.');
    return;
  }

  // Corregido: 'grok' -> 'groq' (typo que rompía el fallback)
  const config = matchConfig || {
    white: { ai: 'gemini', temp: 0.3 },
    black: { ai: 'groq', temp: 0.3 }
  };

  game.status = 'running';
  loopRunning = true;

  console.log(`[GameLoop] Partida iniciada en la arena: ${config.white.ai.toUpperCase()} vs ${config.black.ai.toUpperCase()}`);

  while (loopRunning && game.status === 'running' && game.moveHistory.length < MAX_MOVES) {
    const state = game.getState();
    const { fen, turn, legalMoves } = state;

    console.log(`\n[GameLoop] Turno: ${turn} | Movimiento #${game.moveHistory.length + 1}`);

    const currentAIConfig = config[turn];

    let uciMove;

    try {
      console.log(`[GameLoop] Consultando a ${currentAIConfig.ai.toUpperCase()} (Temp: ${currentAIConfig.temp})...`);

      uciMove = await getAIMove(
        currentAIConfig.ai,
        fen,
        legalMoves,
        currentAIConfig.temp
      );

      console.log(`[GameLoop] Movimiento elegido por ${currentAIConfig.ai.toUpperCase()}: ${uciMove}`);

      const result = game.applyMove(uciMove);

      if (!result.success) {
        console.error(`[GameLoop] Movimiento rechazado por chessGame: ${result.error}`);
        await sleep(500);
        continue;
      }

      console.log(`[GameLoop] Aplicado con éxito: ${uciMove} (${result.san})`);

      if (typeof onMove === 'function') {
        onMove(game.getState());
      }

    } catch (err) {
      console.error('[GameLoop] Error crítico en el turno actual:', err.message);
    }

    await sleep(DELAY_MS);
  }

  if (game.moveHistory.length >= MAX_MOVES && game.status === 'running') {
    game.status = 'finished';
    game.result = 'draw (límite de movimientos)';
  }

  loopRunning = false;
  console.log(`\n[GameLoop] Partida terminada en el servidor. Resultado: ${game.result}`);

  if (typeof onMove === 'function') {
    onMove(game.getState());
  }
}

export function stopGameLoop() {
  loopRunning = false;
  console.log('[GameLoop] Partida detenida manualmente.');
}

export function isLoopRunning() {
  return loopRunning;
}