const { Schema, model } = require('mongoose');

const GameSessionSchema = new Schema(
  {
    chatId: { type: String, index: true },
    game: { type: String, index: true },
    players: { type: [String], default: [] },
    state: { type: Object, default: {} },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 10 * 60 * 1000), index: { expires: 0 } }
  },
  { timestamps: true }
);

module.exports = model('GameSession', GameSessionSchema);
