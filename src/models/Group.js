const { Schema, model } = require('mongoose');

const GroupSchema = new Schema(
  {
    chatId: { type: String, unique: true, index: true },
    name: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
    plan: { type: String, enum: ['free', 'vip', 'premium'], default: 'free' },
    prefixes: { type: [String], default: [] },
    welcome: { type: Boolean, default: true },
    goodbye: { type: Boolean, default: true },
    antilink: { type: Boolean, default: false },
    antibot: { type: Boolean, default: false },
    antistatus: { type: Boolean, default: false },
    antimencaostatus: { type: Boolean, default: false },
    adminOnly: { type: Boolean, default: false },
    rules: { type: String, default: 'Respeite os membros, evite spam e siga as orientações dos administradores.' },
    disabledCommands: { type: [String], default: [] },
    disabledUsers: { type: [String], default: [] },
    warnings: { type: Map, of: Number, default: {} },
    inviteCode: { type: String, default: '' },
    menuMediaUrl: { type: String, default: '' },
    menuMediaId: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = model('Group', GroupSchema);
