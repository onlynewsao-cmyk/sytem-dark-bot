const { Schema, model } = require('mongoose');

const DynamicCommandSchema = new Schema(
  {
    name: { type: String, index: true },
    response: { type: String, required: true },
    scope: { type: String, enum: ['global', 'group'], default: 'global' },
    chatId: { type: String, default: '' },
    createdBy: { type: String, default: '' }
  },
  { timestamps: true }
);

DynamicCommandSchema.index({ name: 1, scope: 1, chatId: 1 }, { unique: true });
module.exports = model('DynamicCommand', DynamicCommandSchema);
