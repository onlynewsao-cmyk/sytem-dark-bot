const { Schema, model } = require('mongoose');

const AuditLogSchema = new Schema(
  {
    chatId: String,
    sender: String,
    command: String,
    args: String,
    ok: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = model('AuditLog', AuditLogSchema);
