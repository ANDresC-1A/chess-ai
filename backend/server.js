// backend/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import gameRoutes from './routes/gameRoutes.js';
import { getAIMove } from './agents/agentsmanager.js'; // Asegúrate de que el nombre del archivo coincida exactamente

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Middlewares globales
app.use(cors());
app.use(express.json());

// 2. Ruta dinámica para procesar las jugadas de las IAs
// Al quitar el prefijo '/api', ahora responde correctamente en http://localhost:3000/api/move
app.post('/api/move', async (req, res) => {
  try {
    const { fen, legalMoves, engine, temperature } = req.body;
    
    // Validación por si el front manda datos vacíos
    if (!engine || !fen || !legalMoves) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos (engine, fen o legalMoves)' });
    }

    console.log(`[SERVER] Solicitando movimiento a ${engine.toUpperCase()} con Temp: ${temperature}`);
    const nextMove = await getAIMove(engine, fen, legalMoves, temperature);
    
    res.json({ move: nextMove });
  } catch (error) {
    console.error('[SERVER] Error procesando movimiento:', error.message);
    res.status(500).json({ error: 'Error interno al procesar el movimiento de la IA' });
  }
});

// 3. Tus otras rutas del juego (start, stop, stream, etc.)
app.use('/api', gameRoutes);

// 4. Health check
app.get('/', (req, res) => {
  res.json({ message: 'Chess AI backend corriendo ✅' });
});

// 5. Encendido del servidor (SIEMPRE AL FINAL)
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});