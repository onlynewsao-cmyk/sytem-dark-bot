const { Schema, model } = require('mongoose');

const MediaSchema = new Schema(
  {
    name: { type: String, index: true },
    tags: { type: [String], default: [] },
    fileId: { type: String, required: true },
    mime: { type: String, default: 'application/octet-stream' },
    size: { type: Number, default: 0 },
    uploadedBy: { type: String, default: '' }
  },
  { timestamps: true }
);

MediaSchema.index({ name: 1 }, { unique: true });
module.exports = model('Media', MediaSchema);
