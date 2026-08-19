import { Chess } from 'chess.js';

class ChessGame {
  constructor() {
    this.chess = new Chess();
    this.moveHistory = [];
    this.status = 'idle';
    this.result = null;
  }

  getFEN() {
    return this.chess.fen();
  }

  getTurn() {
    return this.chess.turn() === 'w' ? 'white' : 'black';
  }

  getHistory() {
    return this.moveHistory;
  }

  applyMove(uciMove) {
    if (this.status === 'finished') {
      return { success: false, error: 'La partida ya terminó.' };
    }

    const from = uciMove.slice(0, 2);
    const to = uciMove.slice(2, 4);
    const promotion = uciMove.length === 5 ? uciMove[4] : undefined;

    try {
      const move = this.chess.move({ from, to, promotion: promotion ?? 'q' });

      if (!move) {
        return { success: false, error: `Movimiento inválido: ${uciMove}` };
      }

      this.moveHistory.push(uciMove);
      this._checkGameOver();

      return {
        success: true,
        move: uciMove,
        san: move.san,
        fen: this.getFEN(),
        status: this.status,
        result: this.result,
      };
    } catch (err) {
      return { success: false, error: `Error aplicando movimiento: ${err.message}` };
    }
  }

  getLegalMoves() {
    return this.chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion ?? ''));
  }

  reset() {
    this.chess = new Chess();
    this.moveHistory = [];
    this.status = 'idle';
    this.result = null;
  }

  getState() {
    return {
      fen: this.getFEN(),
      turn: this.getTurn(),
      history: this.moveHistory,
      status: this.status,
      result: this.result,
      legalMoves: this.getLegalMoves(),
      moveCount: this.moveHistory.length,
    };
  }

  _checkGameOver() {
    if (this.chess.isCheckmate()) {
      this.status = 'finished';
      this.result = this.getTurn() === 'white' ? 'black wins' : 'white wins';
    } else if (
      this.chess.isDraw() ||
      this.chess.isStalemate() ||
      this.chess.isThreefoldRepetition() ||
      this.chess.isInsufficientMaterial()
    ) {
      this.status = 'finished';
      this.result = 'draw';
    } else {
      this.status = 'running';
    }
  }
}

export const game = new ChessGame();