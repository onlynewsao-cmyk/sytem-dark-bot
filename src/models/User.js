const { Schema, model } = require('mongoose');

const UserSchema = new Schema(
  {
    jid: { type: String, unique: true, index: true },
    number: { type: String, index: true },
    name: { type: String, default: '' },
    banned: { type: Boolean, default: false },
    vipUntil: { type: Date, default: null },
    coins: { type: Number, default: 500 },
    bank: { type: Number, default: 0 },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    rep: { type: Number, default: 0 },
    fame: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    cooldowns: { type: Map, of: Number, default: {} },
    inventory: { type: Map, of: Number, default: {} },
    marriedWith: { type: String, default: '' },
    rpg: {
      className: { type: String, default: 'Sem classe' },
      hp: { type: Number, default: 100 },
      maxHp: { type: Number, default: 100 },
      atk: { type: Number, default: 12 },
      def: { type: Number, default: 5 },
      area: { type: String, default: 'Luanda Sombria' },
      monsters: { type: Number, default: 0 },
      bossKills: { type: Number, default: 0 },
      power: { type: Number, default: 10 }
    }
  },
  { timestamps: true }
);

module.exports = model('User', UserSchema);
