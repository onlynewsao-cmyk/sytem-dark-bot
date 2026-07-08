const { Schema, model } = require('mongoose');
const config = require('../config');

const BotSettingsSchema = new Schema(
  {
    settingsId: { type: String, default: 'global', unique: true },
    botName: { type: String, default: config.botName },
    ownerName: { type: String, default: config.ownerName },
    ownerNumbers: { type: [String], default: [config.ownerNumber] },
    prefixes: { type: [String], default: config.defaultPrefixes },
    businessContact: {
      name: { type: String, default: config.ownerName },
      phone: { type: String, default: config.ownerNumber },
      org: { type: String, default: 'DARK System' },
      email: { type: String, default: '' },
      site: { type: String, default: '' }
    },
    verifiedStatusText: { type: String, default: 'DARK System • WhatsApp Business' },
    maintenance: { type: Boolean, default: false },
    blockedGroups: { type: [String], default: [] },
    blockedUsers: { type: [String], default: [] },
    menuMediaUrl: { type: String, default: '' },
    menuMediaId: { type: String, default: '' },
    stats: {
      commands: { type: Number, default: 0 },
      messages: { type: Number, default: 0 },
      startedAt: { type: Date, default: Date.now }
    }
  },
  { timestamps: true }
);

module.exports = model('BotSettings', BotSettingsSchema);
