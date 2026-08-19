// backend/routes/gameRoutes.js
import { Router } from 'express';
import { game } from '../game/chessGame.js';
import { startGameLoop, stopGameLoop, isLoopRunning } from '../game/gameLoop.js';
import { getLocalOllamaModels } from '../agents/agentsmanager.js';


const router = Router();

// Clientes SSE conectados
let sseClients = [];

// Función para notificar a todos los clientes SSE
function broadcastState(state) {
  const data = `data: ${JSON.stringify(state)}\n\n`;
  sseClients.forEach(res => res.write(data));
}

router.get('/ollama-models', async (req, res) => {
  const models = await getLocalOllamaModels();
  res.json({ success: true, models });
});

// GET /api/state → estado actual
router.get('/state', (req, res) => {
  res.json(game.getState());
});

// GET /api/stream → conexión SSE para actualizaciones en tiempo real
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.push(res);
  console.log(`[SSE] Cliente conectado. Total: ${sseClients.length}`);

  // Enviar estado inicial al conectarse
  res.write(`data: ${JSON.stringify(game.getState())}\n\n`);

  // Limpiar cliente al desconectarse
  req.on('close', () => {
    sseClients = sseClients.filter(client => client !== res);
    console.log(`[SSE] Cliente desconectado. Total: ${sseClients.length}`);
  });
});

// POST /api/start → iniciar partida IA vs IA
// Variable global dentro de las rutas para guardar la configuración elegida por el usuario
let matchConfig = {
  white: { ai: 'gemini', temp: 0.3 },
  black: { ai: 'grok', temp: 0.3 }
};

// POST /api/start → iniciar partida IA vs IA Dinámica
router.post('/start', async (req, res) => {
  if (isLoopRunning()) {
    return res.status(400).json({ error: 'Ya hay una partida en curso.' });
  }

  // 1. Capturar la configuración dinámica que viene del sessionStorage de tu frontend
  if (req.body && req.body.white && req.body.black) {
    matchConfig = req.body;
    console.log(`[ARENA] Configuración recibida: Blancas=${matchConfig.white.ai} (T:${matchConfig.white.temp}) vs Negras=${matchConfig.black.ai} (T:${matchConfig.black.temp})`);
  } else {
    console.warn('[ARENA] No se envió configuración en el body. Usando valores por defecto.');
  }

  // 2. Responder INMEDIATAMENTE al frontend para liberar el botón de Iniciar Partida
  res.json({ 
    message: 'Partida inicializada correctamente en la arena.', 
    config: matchConfig 
  });

  // 3. Pasar la configuración al bucle del juego para que use los motores correctos
  // Modificamos startGameLoop para recibir el objeto matchConfig
  startGameLoop(broadcastState, matchConfig);
});

// POST /api/stop → detener partida
router.post('/stop', (req, res) => {
  stopGameLoop();
  res.json({ message: 'Partida detenida.' });
});

// POST /api/reset → reiniciar
router.post('/reset', (req, res) => {
  if (isLoopRunning()) {
    stopGameLoop();
  }
  game.reset();
  broadcastState(game.getState());
  res.json({ message: 'Partida reiniciada.', state: game.getState() });
});

// POST /api/move → movimiento manual (para pruebas)
router.post('/move', (req, res) => {
  const { move } = req.body;
  if (!move) return res.status(400).json({ error: 'Falta el campo "move".' });

  const result = game.applyMove(move);
  if (!result.success) return res.status(400).json(result);

  broadcastState(game.getState());
  res.json(result);
});


import { getExpertAdvice } from '../agents/agentsmanager.js';

// POST /api/suggest → el experto sugiere una jugada y la explica
router.post('/suggest', async (req, res) => {
  try {
    const { fen, legalMoves, engine } = req.body;

    if (!engine || !fen || !legalMoves) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos (engine, fen o legalMoves)' });
    }

    console.log(`[SERVER] Solicitando consejo experto a ${engine.toUpperCase()}`);
    const advice = await getExpertAdvice(engine, fen, legalMoves);

    res.json(advice);
  } catch (error) {
    console.error('[SERVER] Error procesando sugerencia:', error.message);
    res.status(500).json({ error: 'Error interno al procesar la sugerencia del experto' });
  }
});

// POST /api/test-ai → Endpoint de diagnóstico para probar las IA con un saludo


export default router;